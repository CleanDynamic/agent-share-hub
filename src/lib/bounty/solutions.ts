// Answering a gap, and accepting the answer (NS-P50).
//
// A solution on this path is a node payload: one build_nodes payload, for the
// node type the gap already declares, validated against that type's schema
// before it is stored and substituted into the build when it is accepted. That
// is the whole difference from the legacy path, where a solution was a fragment
// of a stage_grids blob and acceptance merged it in.

import { supabase } from "@/integrations/supabase/client";
import { getFieldsFor } from "@/lib/build/nodeTypes";
import { createNotification } from "@/lib/notifications/createNotification";
import type { NodePayload } from "@/lib/build/types";
import { checkNodePayload, payloadRejectionMessage } from "./payload";
import { bountyLayerError, type Bounty } from "./types";

export const SOLUTION_COLUMNS =
  "id, bounty_id, slot_kind, slot_id, solver_id, solver_note, content_payload, vote_count, i_would_implement_count, status, submitted_at, accepted_at, created_at, updated_at";

export interface SubmitSolutionInput {
  bountyId: string;
  /** The payload for the gap node's type. Validated before it is stored. */
  nodePayload: unknown;
  /**
   * The solver. solutions.solver_id is NOT NULL and its INSERT policy admits
   * only `solver_id = (select auth.uid())`, so a caller passing anyone else's
   * id gets a policy refusal rather than a wrong row.
   */
  solverId: string;
  solverNote?: string | null;
}

export interface SubmittedSolution {
  id: string;
  bounty_id: string;
  slot_kind: string;
  slot_id: string;
  solver_id: string;
  solver_note: string | null;
  content_payload: NodePayload;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

export interface AcceptedSolution {
  bountyId: string;
  solutionId: string;
  solverId: string;
  /** The node the payload was substituted into. It is no longer a gap. */
  nodeId: string;
  /** The milestone appended to the build's sequence. */
  eventId: string;
  acceptedAt: string;
}

/**
 * Submit a solution to a bounty on a build.
 *
 * REFUSED, before anything is written: a bounty that does not exist, a legacy
 * bounty (which has stages and blocks, not nodes), a bounty with no gap node, a
 * bounty that is not open, and a payload that does not validate against the gap
 * node's type schema.
 *
 * There is no draft step here, unlike the legacy path's createSolutionDraft. A
 * draft is a row that exists to be edited over days, and NS-P50 has no surface
 * that edits one; adding the row now would mean a status nothing ever leaves.
 * The compose-side draft is NS-P51's, and it inserts against the same table.
 */
export async function submitSolution({
  bountyId,
  nodePayload,
  solverId,
  solverNote = null,
}: SubmitSolutionInput): Promise<SubmittedSolution> {
  const { data: header, error: headerError } = await supabase
    .from("bounties")
    .select("id, build_id, gap_node_id, status, author_id")
    .eq("id", bountyId)
    .maybeSingle();
  if (headerError) throw bountyLayerError("submitSolution (bounty)", headerError);
  if (!header) throw new Error(`Bounty ${bountyId} does not exist`);

  const bounty = header as Pick<
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

  const { data: node, error: nodeError } = await supabase
    .from("build_nodes")
    .select("id, build_id, type, is_gap, title")
    .eq("id", bounty.gap_node_id)
    .maybeSingle();
  if (nodeError) throw bountyLayerError("submitSolution (gap node)", nodeError);
  if (!node) throw new Error("This bounty's gap node no longer exists");

  const gap = node as {
    id: string;
    build_id: string;
    type: string;
    is_gap: boolean;
    title: string | null;
  };
  if (!gap.is_gap) {
    throw new Error("This gap has already been filled");
  }

  // The schema the payload has to satisfy is the gap node's own type — the
  // question decides the shape of the answer, so a solver cannot decide to
  // answer a prompt node with a dataset.
  const fields = await getFieldsFor(gap.type);
  const checked = checkNodePayload(nodePayload, fields);
  if (checked.errors.length > 0) {
    throw new Error(payloadRejectionMessage(checked.errors));
  }

  const { data, error } = await supabase
    .from("solutions")
    .insert({
      bounty_id: bountyId,
      slot_kind: "node",
      slot_id: gap.id,
      solver_id: solverId,
      solver_note: solverNote,
      content_payload: checked.payload,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select(SOLUTION_COLUMNS)
    .single();
  if (error) throw bountyLayerError("submitSolution", error);

  const solution = data as unknown as SubmittedSolution;

  // Best-effort, non-blocking, and deliberately without a targetType: the
  // quick-link column createNotification fills for targetType 'bounty' is
  // notifications.content_id, which is foreign-keyed to content_items. A
  // bounties id there is a rejected insert, not a broken link, so the ids go in
  // the metadata until notifications learn about builds.
  void (async () => {
    try {
      await createNotification({
        recipientId: bounty.author_id,
        actorId: solverId,
        kind: "bounty_interaction",
        metadata: {
          subkind: "solution_submitted",
          bounty_id: bountyId,
          build_id: bounty.build_id,
          node_id: gap.id,
          solution_id: solution.id,
        },
      });
    } catch (e) {
      console.warn("[submitSolution] author notification failed", e);
    }
  })();

  return solution;
}

/**
 * Accept a solution: the answer becomes the build.
 *
 * Five writes that are one fact — the solution is accepted, the acceptance is
 * logged, the bounty is solved, THE GAP NODE IS REPLACED by the accepted
 * payload and stops being a gap, and a milestone is appended to the build's
 * sequence — so they go through public.accept_bounty_solution(), where the
 * function body is the transaction. Half of this applied is a build whose node
 * holds an answer that no bounty records accepting.
 *
 * The payload is re-validated here, against the node type as it stands now,
 * before the substitution is asked for. It was validated at submission; a node
 * type's schema can be edited by an admin in between, and this is the last
 * moment before the payload becomes a node in somebody's published build.
 */
export async function acceptSolution(
  bountyId: string,
  solutionId: string,
): Promise<AcceptedSolution> {
  const { data: solutionRow, error: solutionError } = await supabase
    .from("solutions")
    .select("id, bounty_id, slot_kind, slot_id, solver_id, status, content_payload")
    .eq("id", solutionId)
    .eq("bounty_id", bountyId)
    .maybeSingle();
  if (solutionError) throw bountyLayerError("acceptSolution (solution)", solutionError);
  if (!solutionRow) {
    throw new Error("That solution is not filed against this bounty");
  }

  const solution = solutionRow as {
    id: string;
    slot_kind: string;
    slot_id: string;
    solver_id: string;
    status: string;
    content_payload: unknown;
  };
  if (solution.status !== "submitted") {
    throw new Error(
      `This solution is ${solution.status}, and only a submitted solution can be accepted`,
    );
  }
  if (solution.slot_kind !== "node") {
    throw new Error("This solution answers a legacy slot, not a gap node");
  }

  const { data: node, error: nodeError } = await supabase
    .from("build_nodes")
    .select("id, type")
    .eq("id", solution.slot_id)
    .maybeSingle();
  if (nodeError) throw bountyLayerError("acceptSolution (gap node)", nodeError);
  if (!node) throw new Error("The gap node this solution answers no longer exists");

  const fields = await getFieldsFor((node as { type: string }).type);
  const checked = checkNodePayload(solution.content_payload, fields);
  if (checked.errors.length > 0) {
    throw new Error(
      `This solution no longer fits the node's type: ${payloadRejectionMessage(checked.errors)}`,
    );
  }

  const { data, error } = await supabase.rpc("accept_bounty_solution", {
    p_bounty_id: bountyId,
    p_solution_id: solutionId,
  });
  if (error) throw bountyLayerError("acceptSolution", error);

  const result = (data ?? {}) as {
    bounty_id?: string;
    solution_id?: string;
    solver_id?: string;
    author_id?: string;
    node_id?: string;
    event_id?: string;
    accepted_at?: string;
  };

  const accepted: AcceptedSolution = {
    bountyId: result.bounty_id ?? bountyId,
    solutionId: result.solution_id ?? solutionId,
    solverId: result.solver_id ?? solution.solver_id,
    nodeId: result.node_id ?? solution.slot_id,
    eventId: result.event_id ?? "",
    acceptedAt: result.accepted_at ?? new Date().toISOString(),
  };

  // Best-effort, non-blocking, and outside the transaction on purpose: a
  // notification service being down must not roll back an acceptance that has
  // already changed the build.
  void (async () => {
    try {
      await createNotification({
        recipientId: accepted.solverId,
        actorId: result.author_id ?? null,
        kind: "bounty_interaction",
        metadata: {
          subkind: "solution_accepted",
          bounty_id: accepted.bountyId,
          solution_id: accepted.solutionId,
          node_id: accepted.nodeId,
        },
      });
    } catch (e) {
      console.warn("[acceptSolution] solver notification failed", e);
    }
  })();

  return accepted;
}

// =============================================================================
// Reading the answers back
// =============================================================================
//
// getSolutions in src/lib/bounty-solver/ does this for the LEGACY path and
// cannot be reused here: its first act is resolveBountyByLegacyItem, which
// takes a content_items id and throws for a bounty that never had one. A
// bounty on a build never had one. So the read is written out again, over the
// same table, in the shape the new path's panel needs.

/** Who answered. The four public columns a byline renders, and no more. */
export interface SolutionSolver {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * One solution, as the solve panel renders it.
 *
 * `content_payload` is typed as NodePayload rather than Json because every row
 * this path writes went through checkNodePayload against the gap node's type
 * before it was stored. A row written by something else could hold anything;
 * the renderer that draws it treats a payload defensively either way, exactly
 * as it does for a node.
 */
export interface BountySolution {
  id: string;
  bounty_id: string;
  slot_id: string;
  solver_id: string;
  solver_note: string | null;
  content_payload: NodePayload;
  vote_count: number;
  i_would_implement_count: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
  /** Null when the solver's profile is gone. The byline says "someone". */
  solver: SolutionSolver | null;
  /** Whether the viewer has upvoted this one. False for a signed-out reader. */
  myVote: boolean;
  /** Whether the viewer has said they would implement it. */
  myImplement: boolean;
}

export interface ListSolutionsOptions {
  bountyId: string;
  /** The reader, so their own votes come back marked. Null when signed out. */
  viewerId?: string | null;
}

/** A gap with more answers than this has a spam problem, not a panel. */
const SOLUTIONS_LIMIT = 100;

/**
 * Every submitted and accepted solution on one bounty, with its solver.
 *
 * THREE QUERIES, NEVER ONE PER ROW. The solutions come back first because they
 * name the solvers; the profiles and the viewer's own votes are then two
 * batched `in` lookups over that one set of ids, run concurrently. A panel with
 * twelve answers costs three requests, not twenty-five.
 *
 * Drafts are excluded, as everywhere else on this path: a draft is one person's
 * unfinished work and is not an answer to anything yet.
 *
 * THE ORDER IS THE ANSWER FIRST. An accepted solution leads whatever its vote
 * count, because it is no longer a candidate — it is what the build now says.
 * Below it, most-voted first, and the older one wins a tie: two answers with
 * one vote each are ordered by who got there first, which is the only tiebreak
 * that does not reward posting late.
 */
export async function listSolutions({
  bountyId,
  viewerId = null,
}: ListSolutionsOptions): Promise<BountySolution[]> {
  const { data, error } = await supabase
    .from("solutions")
    .select(SOLUTION_COLUMNS)
    .eq("bounty_id", bountyId)
    .in("status", ["submitted", "accepted"])
    .order("created_at", { ascending: true })
    .limit(SOLUTIONS_LIMIT);
  if (error) throw bountyLayerError("listSolutions", error);

  const rows = (data ?? []) as unknown as Array<
    Omit<BountySolution, "solver" | "myVote" | "myImplement">
  >;
  if (rows.length === 0) return [];

  const solverIds = [...new Set(rows.map((row) => row.solver_id))];
  const solutionIds = rows.map((row) => row.id);

  const [profiles, votes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", solverIds)
      .limit(solverIds.length),
    viewerId
      ? supabase
          .from("solution_votes")
          .select("solution_id, vote_kind")
          .eq("voter_id", viewerId)
          .in("solution_id", solutionIds)
          // Two kinds per solution at most, and the set is already capped.
          .limit(solutionIds.length * 2)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // A failed profile read costs the bylines their names, not the panel its
  // answers: the payloads are the substance and they are already in hand.
  if (profiles.error) {
    console.warn("[listSolutions] solver profiles failed", profiles.error);
  }
  if (votes.error) throw bountyLayerError("listSolutions (votes)", votes.error);

  const byId = new Map<string, SolutionSolver>();
  for (const row of (profiles.data ?? []) as SolutionSolver[]) byId.set(row.id, row);

  const mine = new Set<string>();
  for (const vote of (votes.data ?? []) as Array<{
    solution_id: string;
    vote_kind: string;
  }>) {
    mine.add(`${vote.solution_id}::${vote.vote_kind}`);
  }

  const solutions: BountySolution[] = rows.map((row) => ({
    ...row,
    content_payload: (row.content_payload ?? {}) as NodePayload,
    solver: byId.get(row.solver_id) ?? null,
    myVote: mine.has(`${row.id}::upvote`),
    myImplement: mine.has(`${row.id}::i_would_implement`),
  }));

  solutions.sort((a, b) => {
    const accepted = Number(b.status === "accepted") - Number(a.status === "accepted");
    if (accepted !== 0) return accepted;
    if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count;
    return a.created_at.localeCompare(b.created_at);
  });

  return solutions;
}

/**
 * How many answers each of these bounties has, in ONE query.
 *
 * The build page renders a panel per open bounty and each one shows a count.
 * countsFor() above answers that for a single bounty in three counting reads,
 * which is right for a bounty's own page and wrong for a page holding four of
 * them — twelve requests to print four integers. This reads the ids of the
 * matching rows once and counts them here.
 *
 * The cap is the same one listSolutions applies, for the same reason, and a
 * bounty that reaches it undercounts rather than lying about which answers
 * exist. Bounties with no answers are absent from the map; callers read a
 * missing key as zero.
 */
export async function countSolutionsByBounty(
  bountyIds: readonly string[],
): Promise<Map<string, number>> {
  const wanted = [...new Set(bountyIds)];
  const counts = new Map<string, number>();
  if (wanted.length === 0) return counts;

  const { data, error } = await supabase
    .from("solutions")
    .select("id, bounty_id")
    .in("bounty_id", wanted)
    .in("status", ["submitted", "accepted"])
    .limit(SOLUTIONS_LIMIT * wanted.length);
  if (error) throw bountyLayerError("countSolutionsByBounty", error);

  for (const row of (data ?? []) as Array<{ bounty_id: string }>) {
    counts.set(row.bounty_id, (counts.get(row.bounty_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * profiles.username for a set of solvers, in ONE query.
 *
 * What the build page's credit line reads. accept_bounty_solution writes
 * source_ref = {source: 'bounty', solver_id, solution_id} onto the node it
 * fills, which names the solver by id and not by handle — deliberately, because
 * a handle can be changed and an id cannot. Turning the ids into names is
 * therefore a read, and it is one read for the page rather than one per node.
 *
 * A solver whose profile is gone, or who has no username, maps to null: the
 * credit line says "a solver" rather than inventing one.
 */
export async function listSolverHandles(
  solverIds: readonly string[],
): Promise<Map<string, string | null>> {
  const wanted = [...new Set(solverIds)];
  const handles = new Map<string, string | null>();
  if (wanted.length === 0) return handles;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .in("id", wanted)
    .limit(wanted.length);
  if (error) throw bountyLayerError("listSolverHandles", error);

  for (const row of (data ?? []) as Array<{ id: string; username: string | null }>) {
    handles.set(row.id, row.username ?? null);
  }
  return handles;
}
