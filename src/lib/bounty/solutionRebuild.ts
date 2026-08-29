// Solving a bounty by rebuilding the build it lives on (NS-P53).
//
// THE TWO WAYS TO ANSWER A GAP, AND WHY THIS ONE IS THE PRIMARY ONE.
// NS-P52 gave a gap one answer shape: a payload for the gap node's type,
// written into a form on somebody else's page. That is the right shape for an
// answer that IS one node — a prompt that works, a model setting, a link to a
// dataset — and it stays exactly as it was.
//
// It is the wrong shape for everything else. A gap that says "retrieval returns
// junk on long documents" is usually not solved by writing a better retrieval
// node; it is solved by changing the chunker two steps earlier, re-ordering the
// pipeline, and THEN the retrieval node reads differently. A solver who did
// that work has a whole build, and the only way to file it before now was to
// publish it, open the author's form, and retype the one node the form asks
// for — throwing away the eight changes that made it work and the evidence that
// it does.
//
// So the primary path is: fork the bounty's build, fill the gap inside your own
// copy, publish it as yours, and submit THAT. The solver keeps a build with
// their name on it and their own reproduction count; the author still accepts
// one node, because a build cannot absorb a foreign build into one gap; and the
// credit on the filled node links back to where the answer actually lives.
//
// WHAT MATCHES A NODE TO ITS COUNTERPART, AND WHY IT IS NOT WRITTEN HERE.
// A fork shares no node ids with its source — fork.ts mints every id fresh and
// copies no pointer back — so "the solver's version of the author's gap node"
// is a question with a heuristic answer. matchNodes() is that heuristic: it
// pairs on carried source_ref identity first and on structural descent second,
// and it is the SAME function the publish gate's diff runs. This module calls
// it rather than reimplementing it, so a rebuild whose diff says it changed the
// gap node and a submission that says it filled the gap node can never be
// talking about two different nodes.

import { supabase } from "@/integrations/supabase/client";
import {
  deleteBuild,
  getBuild,
  getFieldsFor,
  matchNodes,
  startRebuild,
  updateBuild,
  type Build,
  type BuildNode,
  type BuildRecord,
  type NodePayload,
} from "@/lib/build";
import { createNotification } from "@/lib/notifications/createNotification";
import { checkNodePayload, payloadRejectionMessage } from "./payload";
import type { SubmittedSolution } from "./solutions";
import { SOLUTION_COLUMNS, bountyLayerError, type Bounty } from "./types";

/** The statuses that mean "a reader can open this". listRebuilds' set. */
const PUBLISHED_STATUSES = ["published", "gallery"] as const;

/** The bounty columns every function here reads. Named, never `*`. */
const BOUNTY_FIELDS = "id, build_id, gap_node_id, status, author_id";

/** The header columns the solver's own rebuild is judged and rendered by. */
export const SOLUTION_BUILD_COLUMNS =
  "id, slug, title, status, creator_id, solves_node_id, reproduction_count, published_at";

/**
 * One of the solver's published rebuilds that declares it solves a given gap.
 *
 * What the panel offers as "Submit your rebuild as the solution", and what the
 * solutions list links to. reproduction_count is on the row because it is the
 * thing that ranks a rebuild-solution against its neighbours: an answer three
 * people have reproduced is a different claim from an answer nobody has run.
 */
export interface SolutionBuild {
  id: string;
  slug: string;
  title: string;
  status: string;
  creator_id: string;
  solves_node_id: string | null;
  reproduction_count: number;
  published_at: string | null;
}

// =============================================================================
// Starting one
// =============================================================================

/**
 * Fork the bounty's build and mark the fork as an attempt at its gap.
 *
 * The fork itself is startRebuild's, unchanged and uncopied: the solver gets
 * the same draft, the same frozen credit columns and the same trip to /compose
 * that the Rebuild button on the build page gives them. The one thing this adds
 * is the DECLARATION — builds.solves_node_id, the column NS-P36 created and
 * nothing has written until now — which is what later lets submitSolutionRebuild
 * tell a rebuild offered as an answer from a rebuild that merely happens to
 * exist.
 *
 * REFUSED before the fork, not after: a bounty that does not exist, a legacy
 * content_items bounty (which has no build to fork), a bounty naming no gap, and
 * a bounty that is not open. Forking first and complaining second would leave
 * the solver holding a draft of a build they cannot submit.
 *
 * On a failure after the fork the draft is deleted rather than left behind,
 * which is startRebuild's own rule for the same situation: a fork that silently
 * lost its declaration would publish as an ordinary rebuild and be refused at
 * submission with nothing on screen explaining why.
 */
export async function startSolutionRebuild(bountyId: string): Promise<Build> {
  const bounty = await readOpenBounty(bountyId, "startSolutionRebuild");

  const draft = await startRebuild({ sourceBuildId: bounty.build_id as string });

  try {
    return await updateBuild(draft.id, { solves_node_id: bounty.gap_node_id });
  } catch (error) {
    await deleteBuild(draft.id).catch(() => undefined);
    throw error;
  }
}

// =============================================================================
// Finding the answer inside it
// =============================================================================

/** A gap and the node that stands where it stood in somebody's rebuild. */
export interface MatchedSolutionNode {
  /** The node in the SOLVER'S build. */
  node: BuildNode;
  /** Its payload, which is what acceptance pulls. */
  payload: NodePayload;
}

/**
 * The solver's counterpart of one gap node, or the reason there isn't one.
 *
 * Pure apart from its arguments, so the whole matching rule is testable without
 * a database. Returns null when the two trees give the gap no partner at all —
 * a solver who deleted the node instead of filling it — and the callers turn
 * that into their own message, because "you deleted it" and "the author cannot
 * accept it" are different sentences to different people.
 *
 * THE TRAY IS NOT SEARCHED, for the reason matchNodes states: unplaced material
 * is the creator's workings, it renders nowhere public and a fork does not copy
 * it, so a payload sitting there is not part of the published record and must
 * not become part of somebody else's.
 */
export function matchSolutionNode(
  source: BuildRecord,
  rebuild: BuildRecord,
  gapNodeId: string,
): BuildNode | null {
  const { draftBySource } = matchNodes(source.tree, rebuild.tree);
  const matchedId = draftBySource.get(gapNodeId);
  if (!matchedId) return null;

  const found = flatten(rebuild.tree).find((node) => node.id === matchedId);
  return found ?? null;
}

/** Depth-first, the order the tree reads in. */
function flatten(tree: BuildRecord["tree"]): BuildNode[] {
  const out: BuildNode[] = [];
  const walk = (nodes: BuildRecord["tree"]) => {
    for (const node of nodes) {
      out.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  return out;
}

/** A payload with nothing in it has filled nothing. */
export function isEmptyPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return true;
  return Object.keys(payload as Record<string, unknown>).length === 0;
}

/**
 * The solver's filled node for a gap, with every requirement checked.
 *
 * ONE FUNCTION FOR BOTH ENDS OF THE PATH. submitSolutionRebuild runs it to
 * decide whether a rebuild may be filed, and acceptSolution runs it again to
 * decide what payload to pull — and running the same checks at both ends is the
 * point, not duplication: a rebuild that qualified in the morning can have been
 * unpublished, restructured or emptied by the afternoon, and the acceptance is
 * the moment that matters. It returns the node so the caller can name it to the
 * database, which verifies the same facts a third time against data no client
 * can edit.
 */
export async function resolveSolutionNode({
  bounty,
  rebuild,
  operation,
}: {
  bounty: Pick<Bounty, "id" | "build_id" | "gap_node_id">;
  rebuild: SolutionBuild;
  /** Named in every message, so a refusal says which end refused. */
  operation: string;
}): Promise<MatchedSolutionNode> {
  if (!PUBLISHED_STATUSES.includes(rebuild.status as (typeof PUBLISHED_STATUSES)[number])) {
    throw new Error(
      "That rebuild is still a draft. Publish it first — a solution has to be something the creator can open and read.",
    );
  }

  if (rebuild.solves_node_id !== bounty.gap_node_id) {
    throw new Error(
      rebuild.solves_node_id
        ? "That rebuild was started against a different gap, so it cannot be submitted here."
        : "That rebuild does not say it solves this gap. Start one from the bounty itself and the declaration is written for you.",
    );
  }

  const [source, rebuiltRecord] = await Promise.all([
    getBuild(bounty.build_id as string),
    getBuild(rebuild.id),
  ]);
  if (!source) throw new Error(`${operation}: the build this bounty lives on could not be read`);
  if (!rebuiltRecord) throw new Error(`${operation}: that rebuild could not be read`);

  const matched = matchSolutionNode(source, rebuiltRecord, bounty.gap_node_id as string);
  if (!matched) {
    throw new Error(
      "The gap has no counterpart in that rebuild — it looks like the node was removed rather than filled.",
    );
  }

  if (matched.is_gap) {
    throw new Error(
      "That part is still marked unsolved in your own rebuild. Fill it in and publish, then submit.",
    );
  }

  const payload = (matched.payload ?? {}) as NodePayload;
  if (isEmptyPayload(payload)) {
    throw new Error(
      "That part is still empty in your rebuild, so there is nothing to offer as an answer.",
    );
  }

  // The gap's own type decides the shape of the answer here for exactly the
  // reason submitSolution validates against it: the question decides the shape
  // of the answer, and acceptance is going to put this payload on a node of
  // that type in somebody else's published build.
  const fields = await getFieldsFor(matched.type);
  const checked = checkNodePayload(payload, fields);
  if (checked.errors.length > 0) {
    throw new Error(payloadRejectionMessage(checked.errors));
  }

  return { node: matched, payload: checked.payload };
}

// =============================================================================
// Submitting one
// =============================================================================

export interface SubmitSolutionRebuildInput {
  bountyId: string;
  /** The solver's own published build, declaring it solves this bounty's gap. */
  solutionBuildId: string;
  solverNote?: string | null;
}

/**
 * File a published rebuild as the solution to a bounty.
 *
 * THE SOLVER IS THE BUILD'S CREATOR, and is read off the build rather than
 * passed in. submitSolution takes a solverId because its payload comes from a
 * form and has no other owner; a build has one, it is a column, and taking the
 * id from the caller instead would be inviting a mismatch that RLS then refuses
 * halfway through. The insert policy admits only `solver_id = (select
 * auth.uid())`, so a caller who is not the build's creator is refused by policy
 * rather than by a check written here that could go out of date.
 *
 * REFUSED: a bounty that is closed, legacy, or names no gap; a build that is not
 * the caller's, is unpublished, or declares a different gap; a build whose
 * matched node is still a gap or is empty; and a build already filed against
 * this bounty. The last one is a courtesy rather than a rule — nothing breaks
 * if the same rebuild is filed twice — but two identical rows in the author's
 * list is a worse experience than one clear message.
 *
 * content_payload IS WRITTEN AS WELL AS THE BUILD ID, and the migration's check
 * says why: the row carries the matched payload as a summary so a reader who
 * cannot open the solver's build still sees what was offered, while acceptance
 * re-reads the build itself. Where the two ever disagree, the one a reader can
 * open is the one that is true.
 */
export async function submitSolutionRebuild({
  bountyId,
  solutionBuildId,
  solverNote = null,
}: SubmitSolutionRebuildInput): Promise<SubmittedSolution> {
  const bounty = await readOpenBounty(bountyId, "submitSolutionRebuild");

  const { data: gapRow, error: gapError } = await supabase
    .from("build_nodes")
    .select("id, build_id, type, is_gap")
    .eq("id", bounty.gap_node_id as string)
    .maybeSingle();
  if (gapError) throw bountyLayerError("submitSolutionRebuild (gap node)", gapError);
  if (!gapRow) throw new Error("This bounty's gap node no longer exists");
  if ((gapRow as { is_gap: boolean }).is_gap === false) {
    throw new Error("This gap has already been filled");
  }

  const rebuild = await getSolutionBuild(solutionBuildId);

  const { payload } = await resolveSolutionNode({
    bounty,
    rebuild,
    operation: "submitSolutionRebuild",
  });

  await refuseDuplicate(bountyId, solutionBuildId);

  const { data, error } = await supabase
    .from("solutions")
    .insert({
      bounty_id: bountyId,
      slot_kind: "node",
      slot_id: bounty.gap_node_id as string,
      solver_id: rebuild.creator_id,
      solver_note: solverNote,
      content_payload: payload,
      solution_build_id: solutionBuildId,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select(SOLUTION_COLUMNS)
    .single();
  if (error) throw bountyLayerError("submitSolutionRebuild", error);

  const solution = data as unknown as SubmittedSolution;

  // Best-effort and non-blocking, exactly as submitSolution's is, and without a
  // targetType for the same reason: notifications.content_id is foreign-keyed to
  // content_items, so a bounties id there is a rejected insert rather than a
  // broken link. The ids travel in the metadata until notifications learn about
  // builds.
  void (async () => {
    try {
      await createNotification({
        recipientId: bounty.author_id,
        actorId: rebuild.creator_id,
        kind: "bounty_interaction",
        metadata: {
          subkind: "solution_submitted",
          bounty_id: bountyId,
          build_id: bounty.build_id,
          node_id: bounty.gap_node_id,
          solution_id: solution.id,
          solution_build_id: solutionBuildId,
        },
      });
    } catch (e) {
      console.warn("[submitSolutionRebuild] author notification failed", e);
    }
  })();

  return solution;
}

// =============================================================================
// Finding the solver's own qualifying rebuilds
// =============================================================================

/**
 * The caller's published rebuilds that declare they solve this gap.
 *
 * What lets the panel greet a returning solver with "Submit your rebuild as the
 * solution" instead of making them find it themselves. Reads through the
 * partial index NS-P37 put on builds(solves_node_id) for exactly this question.
 *
 * Newest first, and capped: a solver with more than a handful of published
 * rebuilds against ONE gap has an unusual workflow, not a paging problem, and
 * the cap keeps a stray loop from turning a panel into a list.
 */
export async function listMySolutionRebuilds({
  gapNodeId,
  creatorId,
  limit = 5,
}: {
  gapNodeId: string;
  creatorId: string;
  limit?: number;
}): Promise<SolutionBuild[]> {
  const { data, error } = await supabase
    .from("builds")
    .select(SOLUTION_BUILD_COLUMNS)
    .eq("solves_node_id", gapNodeId)
    .eq("creator_id", creatorId)
    .in("status", [...PUBLISHED_STATUSES])
    .order("published_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 20)));

  if (error) throw bountyLayerError("listMySolutionRebuilds", error);
  return (data ?? []) as unknown as SolutionBuild[];
}

/**
 * The builds behind a set of rebuild-solutions, in ONE query.
 *
 * The solutions list renders a card per rebuild-solution with the build's title
 * and its reproduction count, and a component that resolved those itself would
 * issue one query per row — the home feed's mistake at a smaller scale. Builds
 * that cannot be read (deleted, or unpublished since) are simply absent from the
 * map; callers render the row without its card rather than hiding the answer.
 */
export async function listSolutionBuilds(
  buildIds: readonly string[],
): Promise<Map<string, SolutionBuild>> {
  const wanted = [...new Set(buildIds)].filter(Boolean);
  const builds = new Map<string, SolutionBuild>();
  if (wanted.length === 0) return builds;

  const { data, error } = await supabase
    .from("builds")
    .select(SOLUTION_BUILD_COLUMNS)
    .in("id", wanted)
    .limit(wanted.length);
  if (error) throw bountyLayerError("listSolutionBuilds", error);

  for (const row of (data ?? []) as unknown as SolutionBuild[]) builds.set(row.id, row);
  return builds;
}

// =============================================================================
// Shared reads
// =============================================================================

/** The bounty, proved to be one this path can act on. */
async function readOpenBounty(
  bountyId: string,
  operation: string,
): Promise<Pick<Bounty, "id" | "build_id" | "gap_node_id" | "status" | "author_id">> {
  const { data, error } = await supabase
    .from("bounties")
    .select(BOUNTY_FIELDS)
    .eq("id", bountyId)
    .maybeSingle();
  if (error) throw bountyLayerError(`${operation} (bounty)`, error);
  if (!data) throw new Error(`Bounty ${bountyId} does not exist`);

  const bounty = data as Pick<
    Bounty,
    "id" | "build_id" | "gap_node_id" | "status" | "author_id"
  >;

  if (!bounty.build_id) {
    throw new Error(
      "This is a legacy bounty; solve it through the bounty page's own path",
    );
  }
  if (!bounty.gap_node_id) {
    throw new Error("This bounty names no gap node, so there is nothing to fill");
  }
  if (bounty.status !== "open") {
    throw new Error(`This bounty is ${bounty.status}, so it is not taking solutions`);
  }
  return bounty;
}

/**
 * One candidate rebuild's header, or a message saying it is not readable.
 *
 * Exported because acceptSolution needs the same six columns for the same
 * judgement a moment later, and a second query written out there would be a
 * second opinion about which columns decide whether a build can be a solution.
 * An unreadable build is a refusal rather than a null: RLS hides an unpublished
 * build from everyone but its creator, and "not found" and "not yours to see"
 * are the same answer to the caller and the same outcome for the acceptance.
 */
export async function getSolutionBuild(buildId: string): Promise<SolutionBuild> {
  const { data, error } = await supabase
    .from("builds")
    .select(SOLUTION_BUILD_COLUMNS)
    .eq("id", buildId)
    .maybeSingle();
  if (error) throw bountyLayerError("getSolutionBuild", error);
  if (!data) {
    throw new Error("That build could not be read, so it cannot be submitted as a solution");
  }
  return data as unknown as SolutionBuild;
}

/** One rebuild, one row. See submitSolutionRebuild's note. */
async function refuseDuplicate(bountyId: string, solutionBuildId: string): Promise<void> {
  const { data, error } = await supabase
    .from("solutions")
    .select("id")
    .eq("bounty_id", bountyId)
    .eq("solution_build_id", solutionBuildId)
    .in("status", ["submitted", "accepted"])
    .limit(1);
  if (error) throw bountyLayerError("submitSolutionRebuild (duplicate)", error);
  if ((data ?? []).length > 0) {
    throw new Error("You have already submitted that rebuild as a solution to this bounty.");
  }
}
