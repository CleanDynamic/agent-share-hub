// public.bounties: filing a gap in a build as an ask, and reading it back.
//
// A bounty has exactly one home — a build, or a legacy content_items row — and
// the constraint that says so is in the database (bounties_one_home). Nothing
// in this file writes the legacy home: the forward path files against a build,
// and usually against one gap node inside it.

import { supabase } from "@/integrations/supabase/client";
import { BUILD_COLUMNS } from "@/lib/build/builds";
import { NODE_COLUMNS } from "@/lib/build/nodes";
import type { Build, BuildNode } from "@/lib/build/types";
import { myMeToo } from "./meToo";
import { countSolutionsByBounty } from "./solutions";
import {
  bountyLayerError,
  type Bounty,
  type BountyCounts,
  type BountyRecord,
  type BountyStatus,
  type DeadlineExtension,
  type GapNode,
} from "./types";

// One string literal, not a concatenation: PostgREST parses the column list at
// the type level and `+` erases the literal type it needs.
export const BOUNTY_COLUMNS =
  "id, build_id, gap_node_id, legacy_item_id, author_id, status, reward_gbp, closes_at, is_meta, meta_parent_id, accepted_solution_id, me_too_count, created_at, solved_at";

/** A build with more open asks than this has a data problem, not a page. */
const BUILD_BOUNTY_LIMIT = 200;

/** One screenful of the open-bounties board. */
export const OPEN_BOUNTIES_PAGE_SIZE = 20;

/** The board never hands back more than this in one call, whatever it asks for. */
const OPEN_BOUNTIES_MAX = 100;

export interface CreateBountyForGapInput {
  buildId: string;
  /**
   * The gap node this bounty is the header for. Omit it for a build-level ask
   * with no single node named — legal in the schema, and not solvable by node
   * substitution, so acceptSolution refuses it.
   */
  nodeId?: string | null;
  /** Cash reward in pounds. NUMERIC on the column — never a float literal. */
  rewardGbp?: number | null;
  closesAt?: string | null;
}

export interface ListOpenBountiesOptions {
  limit?: number;
  /**
   * Keyset cursor: the `created_at` of the last row of the previous page.
   * Keyset rather than offset because the board is ordered newest first and
   * something is filed while a reader is on page 2 — an offset page would show
   * them a row they have already seen and hide one they have not.
   */
  before?: string | null;
  /** Which home to list. Defaults to both, which is what a board shows. */
  home?: "all" | "build" | "legacy";
}

export interface OpenBountiesPage {
  bounties: Bounty[];
  /** Pass as `before` for the next page. Null when this page is the last one. */
  nextCursor: string | null;
}

/**
 * File a bounty against a gap in a build.
 *
 * REFUSED, in this order and before anything is written: a build that does not
 * exist, a node that belongs to another build, a node that is not a gap, and a
 * gap that already has a bounty. The first three are also enforced by
 * trg_bounties_gap_node_valid, which is the guarantee — this check is the
 * message, because "bounties.gap_node_id 4f… is not a gap node of build 9c…" is
 * not a sentence to put in front of a creator.
 *
 * author_id is the BUILD'S CREATOR, read here rather than taken from the
 * caller. NS-P45's INSERT policy only admits a row whose author owns the home
 * it names, so a caller-supplied author_id could only ever be the same value or
 * a rejected write, and reading it means one fewer thing a caller can get wrong.
 */
export async function createBountyForGap({
  buildId,
  nodeId = null,
  rewardGbp = null,
  closesAt = null,
}: CreateBountyForGapInput): Promise<Bounty> {
  const { data: build, error: buildError } = await supabase
    .from("builds")
    .select("id, creator_id")
    .eq("id", buildId)
    .maybeSingle();
  if (buildError) throw bountyLayerError("createBountyForGap (build)", buildError);
  if (!build) {
    throw new Error(`Build ${buildId} does not exist, so it cannot carry a bounty`);
  }

  if (nodeId) {
    const { data: node, error: nodeError } = await supabase
      .from("build_nodes")
      .select("id, build_id, is_gap, title")
      .eq("id", nodeId)
      .maybeSingle();
    if (nodeError) throw bountyLayerError("createBountyForGap (node)", nodeError);
    if (!node) {
      throw new Error(`Node ${nodeId} does not exist, so it cannot be a gap`);
    }
    if ((node as { build_id: string }).build_id !== buildId) {
      throw new Error("That node belongs to a different build");
    }
    if (!(node as { is_gap: boolean }).is_gap) {
      throw new Error(
        `“${(node as { title: string | null }).title ?? "That node"}” is not marked as a gap, so there is nothing to ask for`,
      );
    }
  }

  const { data, error } = await supabase
    .from("bounties")
    .insert({
      build_id: buildId,
      gap_node_id: nodeId,
      author_id: (build as { creator_id: string }).creator_id,
      status: "open",
      reward_gbp: rewardGbp,
      closes_at: closesAt,
    })
    .select(BOUNTY_COLUMNS)
    .single();

  // 23505 is idx_bounties_gap_unique: one bounty per gap, which is a rule a
  // creator can hit by double-clicking and deserves to hear in their own terms.
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new Error("That gap already has a bounty on it");
    }
    throw bountyLayerError("createBountyForGap", error);
  }
  return data as Bounty;
}

/**
 * One bounty, with its build header, its gap node and its counts.
 *
 * The four reads after the header run concurrently; the header has to come
 * first because it names the build and the node the others are about.
 *
 * COUNTS ARE EXACT, against the project's usual preference for estimates. An
 * estimate comes from the planner's row statistics, which are wrong by design
 * for a filter this narrow — "solutions on this one bounty" is a handful of
 * rows out of a table-wide estimate — and "3 solutions" over a list of 4 is a
 * bug report. head: true keeps the rows themselves off the wire.
 */
export async function getBounty(bountyId: string): Promise<BountyRecord | null> {
  const { data: header, error } = await supabase
    .from("bounties")
    .select(BOUNTY_COLUMNS)
    .eq("id", bountyId)
    .maybeSingle();
  if (error) throw bountyLayerError("getBounty", error);
  if (!header) return null;

  const bounty = header as Bounty;

  const [buildRes, nodeRes, counts] = await Promise.all([
    bounty.build_id
      ? supabase.from("builds").select(BUILD_COLUMNS).eq("id", bounty.build_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    bounty.gap_node_id
      ? supabase
          .from("build_nodes")
          .select(NODE_COLUMNS)
          .eq("id", bounty.gap_node_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    countsFor(bountyId),
  ]);

  if (buildRes.error) throw bountyLayerError("getBounty (build)", buildRes.error);
  if (nodeRes.error) throw bountyLayerError("getBounty (gap node)", nodeRes.error);

  return {
    bounty,
    build: (buildRes.data as Build | null) ?? null,
    gapNode: (nodeRes.data as BuildNode | null) as GapNode | null,
    counts,
  };
}

/** The three numbers a bounty header renders, in three counting reads. */
async function countsFor(bountyId: string): Promise<BountyCounts> {
  const [solutions, accepted, comments] = await Promise.all([
    supabase
      .from("solutions")
      .select("id", { count: "exact", head: true })
      .eq("bounty_id", bountyId)
      .in("status", ["submitted", "accepted"]),
    supabase
      .from("solutions")
      .select("id", { count: "exact", head: true })
      .eq("bounty_id", bountyId)
      .eq("status", "accepted"),
    supabase
      .from("bounty_discussion_comments")
      .select("id", { count: "exact", head: true })
      .eq("bounty_id", bountyId),
  ]);

  return {
    solutions: solutions.count ?? 0,
    accepted: accepted.count ?? 0,
    comments: comments.count ?? 0,
  };
}

/**
 * Every bounty on a build, newest first.
 *
 * Not filtered to open ones: a solved gap is the interesting half of a build
 * that has been filled in by other people, and a caller that only wants the
 * open ones has the status on every row.
 */
export async function listBountiesForBuild(buildId: string): Promise<Bounty[]> {
  const { data, error } = await supabase
    .from("bounties")
    .select(BOUNTY_COLUMNS)
    .eq("build_id", buildId)
    .order("created_at", { ascending: false })
    .limit(BUILD_BOUNTY_LIMIT);
  if (error) throw bountyLayerError("listBountiesForBuild", error);
  return (data ?? []) as Bounty[];
}

/**
 * The open-bounties board, newest first, keyset-paged.
 *
 * The page is read one row longer than asked for and the extra row is dropped:
 * that is how the caller learns there is another page without a count query,
 * and it is why nextCursor is null on the last page rather than pointing at a
 * page that turns out to be empty.
 *
 * created_at is not unique, so two bounties filed in the same microsecond can
 * in principle straddle a page boundary and one of them be skipped. The board
 * is a browsing surface and the window is a microsecond wide; a composite
 * cursor to close it would cost every page an OR clause that no index serves.
 */
export async function listOpenBounties({
  limit = OPEN_BOUNTIES_PAGE_SIZE,
  before = null,
  home = "all",
}: ListOpenBountiesOptions = {}): Promise<OpenBountiesPage> {
  const size = Math.min(Math.max(1, limit), OPEN_BOUNTIES_MAX);

  let query = supabase
    .from("bounties")
    .select(BOUNTY_COLUMNS)
    .eq("status", "open");

  if (home === "build") query = query.not("build_id", "is", null);
  if (home === "legacy") query = query.not("legacy_item_id", "is", null);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(size + 1);
  if (error) throw bountyLayerError("listOpenBounties", error);

  const rows = (data ?? []) as Bounty[];
  const bounties = rows.slice(0, size);
  const nextCursor =
    rows.length > size && bounties.length > 0
      ? bounties[bounties.length - 1].created_at
      : null;

  return { bounties, nextCursor };
}

/**
 * Close a bounty without solving it.
 *
 * 'closed' is the author withdrawing the ask; 'expired' is a deadline passing
 * and belongs to whatever sweeps deadlines, not here. A solved bounty is not
 * closeable — its answer is already in the build, and a status that said
 * otherwise would make accepted_solution_id a lie.
 */
export async function closeBounty(bountyId: string): Promise<Bounty> {
  const { data: current, error: readError } = await supabase
    .from("bounties")
    .select("id, status")
    .eq("id", bountyId)
    .maybeSingle();
  if (readError) throw bountyLayerError("closeBounty (read)", readError);
  if (!current) throw new Error(`Bounty ${bountyId} does not exist`);

  const status = (current as { status: string }).status as BountyStatus;
  if (status === "solved") {
    throw new Error("This bounty has been solved, so it cannot be closed");
  }
  if (status === "closed") return getBountyRow(bountyId, "closeBounty");

  const { data, error } = await supabase
    .from("bounties")
    .update({ status: "closed" })
    .eq("id", bountyId)
    .select(BOUNTY_COLUMNS)
    .single();
  if (error) throw bountyLayerError("closeBounty", error);
  return data as Bounty;
}

export interface ExtendDeadlineInput {
  bountyId: string;
  /** ISO timestamp. Must be later than the deadline it replaces. */
  newDeadline: string;
  /** The author extending it. Written to the extension row as extended_by. */
  extendedBy: string;
  reason?: string | null;
}

/**
 * Push a bounty's deadline out, and record that it moved.
 *
 * The extension row is written FIRST and the bounty's closes_at second. Both
 * orders can half-apply — PostgREST has no transaction for a browser — and this
 * one fails towards a recorded extension that did not take effect, which a
 * reader can see and an author can retry. The other fails towards a deadline
 * that moved with nothing saying why, which is the version nobody can audit.
 */
export async function extendDeadline({
  bountyId,
  newDeadline,
  extendedBy,
  reason = null,
}: ExtendDeadlineInput): Promise<DeadlineExtension> {
  const { data: current, error: readError } = await supabase
    .from("bounties")
    .select("id, status, closes_at")
    .eq("id", bountyId)
    .maybeSingle();
  if (readError) throw bountyLayerError("extendDeadline (read)", readError);
  if (!current) throw new Error(`Bounty ${bountyId} does not exist`);

  const row = current as { status: string; closes_at: string | null };
  if (row.status !== "open") {
    throw new Error(`A ${row.status} bounty's deadline cannot be extended`);
  }
  if (row.closes_at && newDeadline <= row.closes_at) {
    throw new Error("An extension has to be later than the deadline it replaces");
  }

  const { data, error } = await supabase
    .from("bounty_deadline_extensions")
    .insert({
      bounty_id: bountyId,
      extended_by: extendedBy,
      previous_deadline: row.closes_at,
      new_deadline: newDeadline,
      reason,
    })
    .select("id, bounty_id, extended_by, previous_deadline, new_deadline, reason, created_at")
    .single();
  if (error) throw bountyLayerError("extendDeadline (record)", error);

  const { error: updateError } = await supabase
    .from("bounties")
    .update({ closes_at: newDeadline })
    .eq("id", bountyId);
  if (updateError) throw bountyLayerError("extendDeadline (apply)", updateError);

  return data as DeadlineExtension;
}

/** One bounty row by id, for the paths that have already proved it exists. */
async function getBountyRow(bountyId: string, operation: string): Promise<Bounty> {
  const { data, error } = await supabase
    .from("bounties")
    .select(BOUNTY_COLUMNS)
    .eq("id", bountyId)
    .single();
  if (error) throw bountyLayerError(operation, error);
  return data as Bounty;
}

// =============================================================================
// The open bounties board (RC-P12)
// =============================================================================

/** One row of the board: the ask, the build it is on, whose it is, its answers. */
export interface OpenBountyCard {
  bounty: Bounty;
  build: { id: string; slug: string; title: string; made_with: string[] };
  /** The build's maker. Null fields when their profile cannot be read. */
  author: { username: string | null; display_name: string | null; avatar_url: string | null };
  /** The gap node's title, or null for a build-level ask that names no node. */
  gapTitle: string | null;
  /** Submitted and accepted solutions. */
  solutions: number;
}

export interface ListOpenBountyCardsOptions {
  limit?: number;
  /** Keyset cursor: the created_at of the last card of the previous page. */
  before?: string | null;
  /** Tools from the build's made_with; several are an OR. */
  madeWith?: string[];
}

export interface OpenBountyCardsPage {
  cards: OpenBountyCard[];
  /** Pass as `before` for the next page. Null when this page is the last one. */
  nextCursor: string | null;
}

/** The embedded build, as the board's select returns it. */
interface BoardRow extends Bounty {
  builds: {
    id: string;
    slug: string;
    title: string;
    made_with: string[] | null;
    creator_id: string;
  } | null;
  build_nodes: { title: string | null } | null;
}

/**
 * The columns the board's one select names: the bounty, its build and, when it
 * names one, its gap node. `!inner` on the build, so an ask whose build this
 * reader cannot read never takes a place on the page, and the made_with filter
 * narrows the asks rather than blanking their builds.
 */
const BOARD_SELECT =
  `${BOUNTY_COLUMNS}, builds!bounties_build_id_fkey!inner(id, slug, title, made_with, creator_id), ` +
  "build_nodes!bounties_gap_node_id_fkey(title)";

/**
 * One page of the open bounties board: every open ask on a build, newest first.
 *
 * THREE REQUESTS A PAGE, NONE IN A LOOP ⟦supabase-postgres-best-practices ›
 * references/data-n-plus-one.md⟧: the asks with their builds and gap titles
 * embedded; then, together, one batched count of their solutions and one batched
 * read of their makers' profiles. KEYSET on created_at, read one row long to
 * learn whether there is a next page without a count ⟦references/
 * data-pagination.md⟧ — the same rule listOpenBounties uses, for the same
 * reason: something is filed while a reader is on page two.
 *
 * NEVER A DRAFT'S ASK. The build's own read policy would show a creator the
 * asks on their unpublished builds; the board is public, so it holds the same
 * rule the feed's bounty arm does: published or gallery builds only.
 */
export async function listOpenBountyCards({
  limit = OPEN_BOUNTIES_PAGE_SIZE,
  before = null,
  madeWith = [],
}: ListOpenBountyCardsOptions = {}): Promise<OpenBountyCardsPage> {
  const size = Math.min(Math.max(1, limit), OPEN_BOUNTIES_MAX);

  let query = supabase
    .from("bounties")
    .select(BOARD_SELECT)
    .eq("status", "open")
    .not("build_id", "is", null)
    .in("builds.status", ["published", "gallery"]);

  const tools = [...new Set(madeWith.map((tool) => tool.trim()).filter(Boolean))];
  if (tools.length > 0) query = query.overlaps("builds.made_with", tools);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(size + 1);
  if (error) throw bountyLayerError("listOpenBountyCards", error);

  const rows = (data ?? []) as unknown as BoardRow[];
  const page = rows.slice(0, size);
  // A row can lose its build only if the embed came back empty anyway; it has
  // nothing to link to, so it is dropped rather than drawn half.
  const kept = page.filter((row) => Boolean(row.builds));

  const ids = kept.map((row) => row.id);
  const creatorIds = [...new Set(kept.map((row) => row.builds!.creator_id))];

  const [solutions, profiles] = await Promise.all([
    countSolutionsByBounty(ids),
    creatorIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", creatorIds)
          .limit(creatorIds.length),
  ]);
  if (profiles.error) throw bountyLayerError("listOpenBountyCards (makers)", profiles.error);

  const makers = new Map<string, OpenBountyCard["author"]>();
  for (const row of (profiles.data ?? []) as Array<{ id: string } & OpenBountyCard["author"]>) {
    makers.set(row.id, {
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    });
  }

  const cards: OpenBountyCard[] = kept.map((row) => {
    const { builds, build_nodes, ...bounty } = row;
    return {
      bounty: bounty as Bounty,
      build: {
        id: builds!.id,
        slug: builds!.slug,
        title: builds!.title,
        made_with: builds!.made_with ?? [],
      },
      author: makers.get(builds!.creator_id) ?? {
        username: null,
        display_name: null,
        avatar_url: null,
      },
      gapTitle: build_nodes?.title?.trim() || null,
      solutions: solutions.get(row.id) ?? 0,
    };
  });

  // The last card's created_at when a (size + 1)th row came back. The page's
  // last row stands in only if every row on it was dropped, so a page of
  // unreadable asks cannot end the board early.
  const nextCursor =
    rows.length > size && page.length > 0
      ? cards[cards.length - 1]?.bounty.created_at ?? page[page.length - 1].created_at
      : null;

  return { cards, nextCursor };
}

/** One Made with option on the board: the tool, and how many open asks carry it. */
export interface BountyFacet {
  value: string;
  count: number;
}

/** At most this many options come back; the board shows six and "More". */
const BOUNTY_FACETS_MAX = 12;

/**
 * How many open asks there are before the counts below are undercounts. A
 * board of more open bounties than this has outgrown a client-side tally, and
 * its counts err low rather than failing.
 */
const BOUNTY_FACET_SCAN = 1000;

/**
 * The Made with values worth offering on the board, counted over open asks on
 * published builds only — the same set the board lists — highest count first,
 * at most twelve. ONE REQUEST: the asks' builds' made_with arrays, tallied here.
 */
export async function bountyFacetsMadeWith(): Promise<BountyFacet[]> {
  const { data, error } = await supabase
    .from("bounties")
    .select("id, builds!bounties_build_id_fkey!inner(made_with)")
    .eq("status", "open")
    .not("build_id", "is", null)
    .in("builds.status", ["published", "gallery"])
    .limit(BOUNTY_FACET_SCAN);
  if (error) throw bountyLayerError("bountyFacetsMadeWith", error);

  const tally = new Map<string, number>();
  for (const row of (data ?? []) as unknown as Array<{ builds: { made_with: string[] | null } | null }>) {
    for (const tool of new Set(row.builds?.made_with ?? [])) {
      const value = tool.trim();
      if (value) tally.set(value, (tally.get(value) ?? 0) + 1);
    }
  }

  return [...tally.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, BOUNTY_FACETS_MAX);
}

// =============================================================================
// What the build page's gap panels need
// =============================================================================

/** One open ask on a build, with the two numbers its panel prints. */
export interface BuildBounty {
  bounty: Bounty;
  /** Submitted and accepted solutions. Drafts are nobody's answer yet. */
  solutions: number;
  /** Whether the reader has already said they need this too. */
  meToo: boolean;
}

export interface ListBuildBountiesOptions {
  buildId: string;
  /** The reader, so their own me-too marks come back. Null when signed out. */
  viewerId?: string | null;
  /** Defaults to the open ones, which is what a gap panel is about. */
  status?: BountyStatus | "any";
}

/**
 * The bounties on a build, with the counts each panel renders.
 *
 * THREE QUERIES FOR THE WHOLE PAGE, whatever number of gaps it carries: the
 * headers, then one batched count over every one of their ids and one batched
 * read of the viewer's own marks, run concurrently. getBounty is the other
 * shape — four reads about ONE bounty, for a surface that is about one bounty —
 * and calling it per gap is where the N+1 would be.
 *
 * A build with no bounties costs exactly one query and returns an empty array;
 * nothing below is attempted for it.
 */
export async function listBuildBounties({
  buildId,
  viewerId = null,
  status = "open",
}: ListBuildBountiesOptions): Promise<BuildBounty[]> {
  const all = await listBountiesForBuild(buildId);
  const bounties = status === "any" ? all : all.filter((row) => row.status === status);
  if (bounties.length === 0) return [];

  const ids = bounties.map((row) => row.id);
  const [solutions, marks] = await Promise.all([
    countSolutionsByBounty(ids),
    viewerId ? myMeToo(ids, viewerId) : Promise.resolve(new Set<string>()),
  ]);

  return bounties.map((bounty) => ({
    bounty,
    solutions: solutions.get(bounty.id) ?? 0,
    meToo: marks.has(bounty.id),
  }));
}
