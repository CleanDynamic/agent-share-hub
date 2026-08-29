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
