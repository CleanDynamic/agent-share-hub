// OpenBuilds' reads (SV-14): the step requests with their steps strips, the reader's requests, and the reader's record.
//
// TWO ROUNDS FOR THE REQUESTS, NONE IN A LOOP ⟦supabase-postgres-best-practices › references/data-n-plus-one.md⟧. Round 1
// is the asks, their builds and gap titles embedded (the select the open bounties board uses). Round 2, together: their
// solution counts, their makers, the steps strips of their builds in one request, and the reader's Me too marks.
// listOpenBountyCards would answer round 1 and the first two of round 2, but it awaits them before it returns, so a strips
// read after it would be a third round.
//
// A STEP REQUEST is an open bounty on a published build. One that names no gap node (a build-level ask) is still listed,
// as the open bounties board lists it, with no strip.
//
// ORDER IS THE SERVER'S, so every sort pages the same way: by offset, read one row long to learn whether there is another
// page. Keyset paging (listOpenBountyCards) only works for one order, and the board has four.

import { supabase } from "@/integrations/supabase/client";
import { listSolverHandles, countSolutionsByBounty } from "./solutions";
import { BOUNTY_COLUMNS, OPEN_BOUNTIES_PAGE_SIZE } from "./bounties";
import { myMeToo } from "./meToo";
import { bountyLayerError, type Bounty } from "./types";

export type StepRequestSort = "needed" | "newest" | "closing" | "reward";

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
  offset?: number;
  limit?: number;
  /** The signed-in reader, for their Me too marks. */
  viewerId?: string | null;
}

/** A build with more top-level steps than this draws its strip from the first of them. */
const STRIP_ROWS_PER_BUILD = 200;

// Typed as a plain string: as a literal, PostgREST's type-level parser walks the whole embed and the type check runs out of memory.
const REQUESTS_SELECT: string =
  `${BOUNTY_COLUMNS}, builds!bounties_build_id_fkey!inner(id, slug, title, creator_id), build_nodes!bounties_gap_node_id_fkey(title)`;

/** The strip's columns: the step's own, and three payload keys by path (never the payload whole), and the gap's problem. */
const STRIP_SELECT =
  "id, build_id, parent_id, type, title, position, is_gap, tested:payload->tested, setup:payload->setup, step:payload->step, gap_problem:payload->>gap_problem";

interface RequestRow extends Bounty {
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
  const { data, error } = await (supabase
    .from("build_nodes")
    .select(STRIP_SELECT as "id")
    .in("build_id", [...buildIds])
    .or(`parent_id.is.null${gaps}`)
    .order("build_id", { ascending: true })
    .order("position", { ascending: true })
    .limit(STRIP_ROWS_PER_BUILD * buildIds.length) as unknown as Promise<{ data: StripRow[] | null; error: unknown }>);
  if (error) throw bountyLayerError("listStepStrips", error);
  return data ?? [];
}

/**
 * One page of step requests in the order asked for: Most needed (`me_too_count`), Newest, Closing soon (no deadline last),
 * Reward (dearest first, none last); ties newest first, then by id, so offset pages never overlap.
 */
export async function listStepRequests({ sort = "needed", offset = 0, limit = OPEN_BOUNTIES_PAGE_SIZE, viewerId = null }: ListStepRequestsOptions = {}): Promise<StepRequestsPage> {
  const size = Math.min(Math.max(1, limit), 100);

  let query = supabase
    .from("bounties")
    .select(REQUESTS_SELECT)
    .eq("status", "open")
    .not("build_id", "is", null)
    .in("builds.status", ["published", "gallery"]);
  if (sort === "needed") query = query.order("me_too_count", { ascending: false });
  if (sort === "closing") query = query.order("closes_at", { ascending: true, nullsFirst: false });
  if (sort === "reward") query = query.order("reward_gbp", { ascending: false, nullsFirst: false });
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + size);
  if (error) throw bountyLayerError("listStepRequests", error);

  const rows = ((data ?? []) as unknown as RequestRow[]).slice(0, size).filter((row) => Boolean(row.builds));
  const more = (data ?? []).length > size;
  const ids = rows.map((row) => row.id);
  const buildIds = [...new Set(rows.map((row) => row.builds!.id))];
  const gapIds = [...new Set(rows.flatMap((row) => (row.gap_node_id ? [row.gap_node_id] : [])))];
  const makerIds = [...new Set(rows.map((row) => row.builds!.creator_id))];

  const [solutions, makers, strips, marked] = await Promise.all([
    countSolutionsByBounty(ids),
    makerIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("profiles").select("id, username, avatar_url").in("id", makerIds).limit(makerIds.length),
    listStepStrips(buildIds, gapIds),
    viewerId && ids.length > 0 ? myMeToo(ids, viewerId) : Promise.resolve(new Set<string>()),
  ]);
  if (makers.error) throw bountyLayerError("listStepRequests (makers)", makers.error);

  const makerOf = new Map(((makers.data ?? []) as Array<{ id: string; username: string | null; avatar_url: string | null }>).map((row) => [row.id, { username: row.username, avatar_url: row.avatar_url }]));
  const problemOf = new Map(strips.flatMap((row) => (row.gap_problem ? [[row.id, row.gap_problem] as const] : [])));

  return {
    requests: rows.map((row) => {
      const { builds, build_nodes, ...bounty } = row;
      return {
        bounty: bounty as Bounty,
        build: { id: builds!.id, slug: builds!.slug, title: builds!.title },
        maker: makerOf.get(builds!.creator_id) ?? null,
        gapTitle: build_nodes?.title?.trim() || null,
        problem: (row.gap_node_id && problemOf.get(row.gap_node_id)?.trim()) || "",
        solutions: solutions.get(row.id) ?? 0,
        meToo: marked.has(row.id),
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
  const { data, error } = await (supabase
    .from("solutions")
    .select(
      "id, bounty_id, solver_id, bounties!solutions_bounty_id_fkey!inner(id, status, builds!bounties_build_id_fkey!inner(slug, title, creator_id), build_nodes!bounties_gap_node_id_fkey(title))" as "id",
    )
    .eq("status", "submitted")
    .eq("bounties.status", "open")
    .eq("bounties.builds.creator_id", userId)
    .order("submitted_at", { ascending: false })
    .limit(MY_ANSWERS_LIMIT) as unknown as Promise<{ data: MySolutionRow[] | null; error: unknown }>);
  if (error) throw bountyLayerError("listMyOpenRequests", error);

  const byBounty = new Map<string, { row: MySolutionRow; answers: number }>();
  for (const row of data ?? []) {
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
  /** The reader's runs of builds other people made (build_reproductions rows). */
  reproduced: number;
  /** The reader's accepted solutions. */
  accepted: number;
}

/** Two counts, together, shown in full: so exact. */
export async function getMyRecord(userId: string): Promise<MyRecord> {
  const [reproduced, accepted] = await Promise.all([
    supabase
      .from("build_reproductions")
      .select("id, builds!build_reproductions_build_id_fkey!inner(creator_id)", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("builds.creator_id", userId),
    supabase.from("solutions").select("id", { count: "exact", head: true }).eq("solver_id", userId).eq("status", "accepted"),
  ]);
  if (reproduced.error) throw bountyLayerError("getMyRecord (reproduced)", reproduced.error);
  if (accepted.error) throw bountyLayerError("getMyRecord (accepted)", accepted.error);
  return { reproduced: reproduced.count ?? 0, accepted: accepted.count ?? 0 };
}
