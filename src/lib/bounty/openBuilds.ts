// OpenBuilds' reads (SV-14): the step requests with their steps strips, the reader's requests, and the reader's record.
//
// TWO ROUNDS FOR THE REQUESTS, NONE IN A LOOP ⟦supabase-postgres-best-practices › references/data-n-plus-one.md⟧. Round 1
// is the asks, their builds and gap titles embedded (the select the open bounties board uses). Round 2, together: their
// solution counts, their makers, the steps strips of their builds in one request, and the reader's Me too marks.
// listOpenBountyCards would answer round 1 and the first two of round 2, but it awaits them before it returns, so a strips
// read after it would be a third round.
//
// A REQUEST is an open bounty on a published build. Its SIZE is Step when it names a gap node, Whole build when it names
// none (gap_node_id null). A whole-build request has no strip; the build's step count comes from the same strips read.
//
// ORDER IS THE SERVER'S, so every sort pages the same way: by offset, read one row long to learn whether there is another
// page. Keyset paging (listOpenBountyCards) only works for one order, and the board has four.

import { supabase } from "@/integrations/supabase/client";
import { contributorColumnMissing, noteMissingContributorColumn } from "@/lib/build/contributors";
import { listSolverHandles, countSolutionsByBounty } from "./solutions";
import { BOUNTY_COLUMNS, OPEN_BOUNTIES_PAGE_SIZE } from "./bounties";
import { isMissingColumn } from "@/lib/classify/storage";
import { listActiveClaims, type RequestClaim } from "./claims";
import { myMeToo } from "./meToo";
import { bountyLayerError, type Bounty } from "./types";

export type StepRequestSort = "needed" | "newest" | "closing" | "reward";

/** Which requests: every size, or steps only (a named gap node). */
export type RequestSize = "all" | "step";

/** A node as the strips read returns it: the step's columns, and of its payload only the three keys that decide whether it is a step (`isStepNode`, graph.ts). */
export interface StepStripNode {
  id: string;
  build_id: string;
  parent_id: string | null;
  type: string;
  title: string | null;
  position: number | null;
  is_gap: boolean;
  payload: { tested?: unknown; setup?: unknown; step?: unknown };
}

export interface StepRequestRecord {
  bounty: Bounty;
  build: { id: string; slug: string; title: string };
  /** The build's maker; null when their profile cannot be read. */
  maker: { username: string | null; avatar_url: string | null } | null;
  /** The gap node's title, or null for a build-level ask. */
  gapTitle: string | null;
  /** What the maker wrote is wrong with the gap (`payload.gap_problem`); empty when nothing. */
  problem: string;
  /** Submitted and accepted solutions. */
  solutions: number;
  /** Whether the reader has said Me too. */
  meToo: boolean;
  /** SV-21: who is working on it, while their claim stands. */
  claim: RequestClaim | null;
  /** SV-21: opened from a run that did not work (`from_run_id`). */
  fromRun: boolean;
}

export interface StepRequestsPage {
  requests: StepRequestRecord[];
  /** Every strip row of the page's builds: their top-level steps and their gap nodes. */
  strips: StepStripNode[];
  /** Pass as `offset` for the next page; null on the last. */
  nextOffset: number | null;
}

export interface ListStepRequestsOptions {
  sort?: StepRequestSort;
  size?: RequestSize;
  offset?: number;
  limit?: number;
  /** The signed-in reader, for their Me too marks. */
  viewerId?: string | null;
}

/** The builder methods these reads call. Narrow on purpose, as gallery.ts's feed reads are: supabase-js's own types parse
    every select at the type level, and the type check of the whole app sits at the edge of Node's default heap. */
interface Query extends PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  eq(column: string, value: unknown): Query;
  neq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  not(column: string, operator: string, value: unknown): Query;
  or(filters: string): Query;
  order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): Query;
  range(from: number, to: number): Query;
  limit(count: number): Query;
}

const table = (name: string) => (supabase as unknown as { from: (name: string) => { select: (columns: string, options?: { count: "exact"; head: true }) => Query } }).from(name);

/** A build with more top-level steps than this draws its strip from the first of them. */
const STRIP_ROWS_PER_BUILD = 200;

const REQUESTS_SELECT =
  `${BOUNTY_COLUMNS}, builds!bounties_build_id_fkey!inner(id, slug, title, creator_id), build_nodes!bounties_gap_node_id_fkey(title)`;

/** SV-21: the two columns a request from a run uses. Asked for until an error says they are missing (the migration is not applied). */
const RUN_COLUMNS = "problem, from_run_id";
let runColumnsMissing = false;
export const resetRunColumns = (): void => {
  runColumnsMissing = false;
};

/** The strip's columns: the step's own, and three payload keys by path (never the payload whole), and the gap's problem. */
const STRIP_SELECT =
  "id, build_id, parent_id, type, title, position, is_gap, tested:payload->tested, setup:payload->setup, step:payload->step, gap_problem:payload->>gap_problem";

interface RequestRow extends Bounty {
  problem?: string | null;
  from_run_id?: string | null;
  builds: { id: string; slug: string; title: string; creator_id: string } | null;
  build_nodes: { title: string | null } | null;
}

interface StripRow extends Omit<StepStripNode, "payload"> {
  tested: unknown;
  setup: unknown;
  step: unknown;
  gap_problem: string | null;
}

/** The builds' top-level steps and the named gap nodes, in one request. */
async function listStepStrips(buildIds: readonly string[], gapIds: readonly string[]): Promise<StripRow[]> {
  if (buildIds.length === 0) return [];
  const gaps = gapIds.length > 0 ? `,id.in.(${gapIds.join(",")})` : "";
  const { data, error } = await table("build_nodes")
    .select(STRIP_SELECT)
    .in("build_id", [...buildIds])
    .or(`parent_id.is.null${gaps}`)
    .order("build_id", { ascending: true })
    .order("position", { ascending: true })
    .limit(STRIP_ROWS_PER_BUILD * buildIds.length);
  if (error) throw bountyLayerError("listStepStrips", error);
  return (data ?? []) as StripRow[];
}

/**
 * One page of step requests in the order asked for: Most needed (`me_too_count`), Newest, Closing soon (no deadline last),
 * Reward (dearest first, none last); ties newest first, then by id, so offset pages never overlap.
 */
export async function listStepRequests({ sort = "needed", size: wanted = "all", offset = 0, limit = OPEN_BOUNTIES_PAGE_SIZE, viewerId = null }: ListStepRequestsOptions = {}): Promise<StepRequestsPage> {
  const size = Math.min(Math.max(1, limit), 100);

  const read = (columns: string) => {
    let query = table("bounties")
      .select(columns)
      .eq("status", "open")
      .not("build_id", "is", null)
      .in("builds.status", ["published", "gallery"]);
    if (wanted === "step") query = query.not("gap_node_id", "is", null);
    if (sort === "needed") query = query.order("me_too_count", { ascending: false });
    if (sort === "closing") query = query.order("closes_at", { ascending: true, nullsFirst: false });
    if (sort === "reward") query = query.order("reward_gbp", { ascending: false, nullsFirst: false });
    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + size);
  };
  let { data, error } = await read(runColumnsMissing ? REQUESTS_SELECT : `${REQUESTS_SELECT}, ${RUN_COLUMNS}`);
  if (error && !runColumnsMissing && isMissingColumn(error)) {
    runColumnsMissing = true;
    ({ data, error } = await read(REQUESTS_SELECT));
  }
  if (error) throw bountyLayerError("listStepRequests", error);

  const all = (data ?? []) as RequestRow[];
  const rows = all.slice(0, size).filter((row) => Boolean(row.builds));
  const more = all.length > size;
  const ids = rows.map((row) => row.id);
  const buildIds = [...new Set(rows.map((row) => row.builds!.id))];
  const gapIds = [...new Set(rows.flatMap((row) => (row.gap_node_id ? [row.gap_node_id] : [])))];
  const makerIds = [...new Set(rows.map((row) => row.builds!.creator_id))];

  const [solutions, makers, strips, marked, claims] = await Promise.all([
    countSolutionsByBounty(ids),
    makerIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : table("profiles").select("id, username, avatar_url").in("id", makerIds).limit(makerIds.length),
    listStepStrips(buildIds, gapIds),
    viewerId && ids.length > 0 ? myMeToo(ids, viewerId) : Promise.resolve(new Set<string>()),
    listActiveClaims(ids),
  ]);
  if (makers.error) throw bountyLayerError("listStepRequests (makers)", makers.error);

  const makerOf = new Map(((makers.data ?? []) as Array<{ id: string; username: string | null; avatar_url: string | null }>).map((row) => [row.id, { username: row.username, avatar_url: row.avatar_url }]));
  const problemOf = new Map(strips.flatMap((row) => (row.gap_problem ? [[row.id, row.gap_problem] as const] : [])));

  return {
    requests: rows.map((row) => {
      const { builds, build_nodes, problem: ownWords, from_run_id: fromRunId, ...bounty } = row;
      return {
        bounty: bounty as Bounty,
        build: { id: builds!.id, slug: builds!.slug, title: builds!.title },
        maker: makerOf.get(builds!.creator_id) ?? null,
        gapTitle: build_nodes?.title?.trim() || null,
        problem: (row.gap_node_id ? problemOf.get(row.gap_node_id)?.trim() : ownWords?.trim()) || "",
        solutions: solutions.get(row.id) ?? 0,
        meToo: marked.has(row.id),
        claim: claims.get(row.id) ?? null,
        fromRun: Boolean(fromRunId),
      };
    }),
    strips: strips.map(({ tested, setup, step, gap_problem: _problem, ...node }) => ({ ...node, payload: { tested, setup, step } })),
    nextOffset: more ? offset + size : null,
  };
}

/* ── the reader's requests ── */

export interface MyOpenRequest {
  bountyId: string;
  build: { slug: string; title: string };
  gapTitle: string | null;
  /** The answers waiting for the maker: submitted, not yet accepted. */
  answers: number;
  /** The handle of the latest answer's solver; null when it cannot be read. */
  latestSolver: string | null;
}

interface MySolutionRow {
  id: string;
  bounty_id: string;
  solver_id: string;
  bounties: { id: string; builds: { slug: string; title: string } | null; build_nodes: { title: string | null } | null } | null;
}

/** How many answers the side column reads at most. */
const MY_ANSWERS_LIMIT = 100;

/**
 * The open bounties on builds the reader made that have answers waiting: submitted solutions, not yet accepted, latest
 * first, grouped by bounty. Two requests: the answers with their bounties embedded, then their solvers' handles.
 */
export async function listMyOpenRequests(userId: string): Promise<MyOpenRequest[]> {
  const { data, error } = await table("solutions")
    .select(
      "id, bounty_id, solver_id, bounties!solutions_bounty_id_fkey!inner(id, status, builds!bounties_build_id_fkey!inner(slug, title, creator_id), build_nodes!bounties_gap_node_id_fkey(title))",
    )
    .eq("status", "submitted")
    .eq("bounties.status", "open")
    .eq("bounties.builds.creator_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(MY_ANSWERS_LIMIT);
  if (error) throw bountyLayerError("listMyOpenRequests", error);

  const byBounty = new Map<string, { row: MySolutionRow; answers: number }>();
  for (const row of (data ?? []) as MySolutionRow[]) {
    if (!row.bounties?.builds) continue;
    const held = byBounty.get(row.bounty_id);
    if (held) held.answers += 1;
    else byBounty.set(row.bounty_id, { row, answers: 1 });
  }
  const handles = await listSolverHandles([...byBounty.values()].map((entry) => entry.row.solver_id));
  return [...byBounty.values()].map(({ row, answers }) => ({
    bountyId: row.bounty_id,
    build: { slug: row.bounties!.builds!.slug, title: row.bounties!.builds!.title },
    gapTitle: row.bounties!.build_nodes?.title?.trim() || null,
    answers,
    latestSolver: handles.get(row.solver_id) ?? null,
  }));
}

/* ── the reader's record ── */

export interface MyRecord {
  /** Builds other people made that the reader ran and got working. One row per person per build (UNIQUE (build_id, user_id)), so rows are builds. */
  reproduced: number;
  /** Builds other people made that the reader ran and did not get working. */
  tried: number;
  /** The reader's accepted solutions. */
  accepted: number;
  /** SV-16: distinct builds by other people with a tile credited to the reader. Absent until the contributor column is live. */
  contributed?: number;
}

/** Most tiles read to find the distinct builds: a reader past this has contributed to more builds than a record line needs. */
const CONTRIBUTED_TILE_LIMIT = 1000;

/** SV-16: builds by others that hold a tile the reader made, counted from their tiles. Undefined when the column is not there yet. */
async function buildsContributedTo(userId: string): Promise<number | undefined> {
  const { data, error } = await (supabase as unknown as { from: (name: string) => { select: (columns: string) => Query } })
    .from("build_nodes")
    .select("build_id, builds!build_nodes_build_id_fkey!inner(creator_id)")
    .eq("contributor_id", userId)
    .neq("builds.creator_id", userId)
    .limit(CONTRIBUTED_TILE_LIMIT);
  if (error) {
    if (noteMissingContributorColumn(error)) return undefined;
    throw bountyLayerError("getMyRecord (contributed)", error);
  }
  return new Set((data as { build_id: string }[] | null ?? []).map((row) => row.build_id)).size;
}

/** The reader's runs of others' builds that worked (or did not), counted exactly. */
const runsOnOthers = (userId: string, worked: boolean) =>
  table("build_reproductions")
    .select("id, builds!build_reproductions_build_id_fkey!inner(creator_id)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("worked", worked)
    .neq("builds.creator_id", userId);

/** Three counts, together, shown in full: so exact. */
export async function getMyRecord(userId: string): Promise<MyRecord> {
  const [reproduced, tried, accepted, contributed] = await Promise.all([
    runsOnOthers(userId, true),
    runsOnOthers(userId, false),
    table("solutions").select("id", { count: "exact", head: true }).eq("solver_id", userId).eq("status", "accepted"),
    contributorColumnMissing() ? Promise.resolve(undefined) : buildsContributedTo(userId),
  ]);
  if (reproduced.error) throw bountyLayerError("getMyRecord (reproduced)", reproduced.error);
  if (tried.error) throw bountyLayerError("getMyRecord (tried)", tried.error);
  if (accepted.error) throw bountyLayerError("getMyRecord (accepted)", accepted.error);
  return { reproduced: reproduced.count ?? 0, tried: tried.count ?? 0, accepted: accepted.count ?? 0, ...(contributed === undefined ? null : { contributed }) };
}
