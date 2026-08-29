// Marking a part of a build unsolved, and the one payload key that says why.
//
// A GAP IS A FLAG, NOT A TYPE. build_nodes.is_gap has been the flag since the
// NS-P02 schema and the public page has painted it since NS-P14 — a red rule
// down the card and the word "unsolved" beside the type pill. What NS-P51 adds
// is the creator's side of it: a toggle in the inspector, and somewhere to
// write down what is actually wrong.
//
// WHY THE NODE KEEPS ITS TYPE. The registry carries a 'gap' type whose renderer
// asks for a problem, what was tried, and the bar for solving it, so retyping a
// node into one is the obvious way to mark it unsolved. It is the wrong way.
// The type of a node is what it IS — a set of model parameters, a dataset, a
// result — and a creator who has not got the parameters right yet still has a
// model_params node. Retyping would throw away the fields they had already
// filled in, and it would leave a solver with no idea what shape the answer
// takes, which is exactly what src/lib/bounty's submitSolution validates a
// solution against: the GAP NODE'S OWN TYPE. So the flag goes on and the type
// stays, and the 'gap' type remains what it always was — a node whose whole
// content is a question, for a creator who wants to place one.
//
// WHERE THE PROBLEM GOES. `gap_problem`, a reserved key in the node's own
// payload. Not a column: that is a migration on the biggest table in the record
// to carry one string for a small minority of rows. Not `note`, which is the
// creator's free prose ABOUT the node and is rendered as such on the public
// page — a problem statement is a different sentence with a different reader.
// And not `problem`, which is the 'gap' type's own required field: two meanings
// on one key in one payload is a collision waiting for the first creator who
// marks a gap node unsolved.
//
// NO node_types SCHEMA DECLARES IT, deliberately — it is an annotation about
// the node rather than a value of its type's dialect. Three consequences worth
// knowing, none of them accidents:
//
//   * A renderer prints the fields its type declares, so the key does not show
//     up on the public page as a stray field. What a reader sees is the
//     treatment NodeCard already paints for is_gap.
//   * splitPayload — the Build File importer — moves undeclared keys into the
//     note with an UNKNOWN_FIELD warning, so a gap round-tripped through a
//     Build File comes back as prose rather than as a flag. That is the import
//     path's rule for every undeclared key and NS-P51 does not change it.
//   * checkNodePayload refuses undeclared keys in a SOLUTION, which is right:
//     an answer to the gap is a payload of the type's own fields, and it
//     replaces this one wholesale on acceptance. The problem statement goes
//     with the gap it described.

import type { Json } from "@/integrations/supabase/types";
import type { NodePayload } from "./types";

/**
 * The reserved payload key a gap's problem statement is written to.
 *
 * Exported rather than spelled out at each call site: the inspector writes it,
 * the publish sheet reads it, and a literal in two files is a typo away from
 * two different keys that both look right.
 */
export const GAP_PROBLEM_KEY = "gap_problem";

/**
 * What a node says is wrong with it, as a string.
 *
 * Empty for a node that is not a gap, for a gap nobody has written a problem
 * for, and for a payload holding something other than a string at the key — a
 * payload is Json and nothing stops an import from putting a number there.
 */
export function gapProblem(payload: Json | null | undefined): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const value = (payload as Record<string, Json | undefined>)[GAP_PROBLEM_KEY];
  return typeof value === "string" ? value : "";
}

/**
 * The payload patch that stores a problem statement, or clears it.
 *
 * A merge patch, for patchPayload — the key is set to null rather than deleted
 * when the creator empties the field, because the writer merges what it is
 * given into the payload as it stands and there is no "remove this key"
 * instruction in that contract. null reads back as "" through gapProblem,
 * which is what an empty field means.
 */
export function gapProblemPatch(text: string): NodePayload {
  const trimmed = text.trim();
  return { [GAP_PROBLEM_KEY]: trimmed === "" ? null : text };
}
