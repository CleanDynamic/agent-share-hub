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
