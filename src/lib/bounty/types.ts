// Shared types for the bounty data layer that runs over builds (NS-P50).
//
// A bounty is a row in public.bounties with exactly one home: a build — usually
// a named gap node inside it — or a legacy content_items row. This module is
// the forward half. The legacy half still lives in src/lib/bounty-solver/,
// which reads and writes the same table through resolveBountyByLegacyItem.
//
// Row shapes are DERIVED from the generated Supabase types rather than
// hand-written, so a column added in a later migration shows up here the moment
// src/integrations/supabase/types.ts is regenerated.

import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/integrations/supabase/types";
import type { Build, BuildNode, NodePayload } from "@/lib/build/types";

// --- row types ---------------------------------------------------------------

export type Bounty = Tables<"bounties">;
export type BountyInsert = TablesInsert<"bounties">;
export type BountyPatch = Omit<TablesUpdate<"bounties">, "id" | "author_id">;
export type DeadlineExtension = Tables<"bounty_deadline_extensions">;

// --- constrained string columns ----------------------------------------------
//
// Postgres enforces these as CHECK constraints rather than enum types, so the
// generated types widen them to `string`. Narrow them back here.

/**
 * 'expired' arrived with the table in NS-P45 and is still written by nothing.
 * Whatever sweeps deadlines writes it first; until then a bounty whose
 * closes_at has passed reads as 'open', exactly as it did on content_items.
 */
export type BountyStatus = "open" | "solved" | "closed" | "expired";

/**
 * The three kinds of hole a solution can fill. 'stage' and 'block' are
 * positions in a legacy content_items stage_grids blob; 'node' is a gap node in
 * a build, and it is the only one this module ever writes.
 */
export type SlotKind = "stage" | "block" | "node";

// --- the composed record -----------------------------------------------------

/** A gap node with its payload typed as the field dialect rather than Json. */
export type GapNode = Omit<BuildNode, "payload"> & { payload: NodePayload };

/**
 * What a bounty page needs, assembled by one call.
 *
 * Consumers take this shape whole rather than assembling it themselves, for the
 * same reason src/lib/build's BuildRecord exists: four dependent reads written
 * out at four call sites become fifteen the moment a second surface wants the
 * same thing.
 */
export interface BountyRecord {
  bounty: Bounty;
  /**
   * The build this bounty lives on, or null for a legacy content_items bounty.
   * The header only — a caller that needs the tree calls getBuild for it.
   */
  build: Build | null;
  /** The gap node this bounty is the header for, or null for a build-level ask. */
  gapNode: GapNode | null;
  counts: BountyCounts;
}

export interface BountyCounts {
  /** Solutions that have been submitted, accepted included. Drafts excluded. */
  solutions: number;
  /** Of those, the accepted ones — 0 or 1 for a bounty on a gap node. */
  accepted: number;
  /** Root and reply comments in the bounty's discussion thread. */
  comments: number;
}

// --- read shapes -------------------------------------------------------------

/**
 * The solution columns every reader on this path names. Never `*`.
 *
 * IT LIVES HERE, not in solutions.ts, so that solutionRebuild.ts can write a
 * row without importing the module that imports it. acceptSolution has to call
 * into the rebuild path to resolve a payload, and the rebuild path has to
 * insert a solutions row; a constant both need is the whole of what made that a
 * cycle, and types.ts is the file neither of them can be imported by.
 *
 * solution_build_id (NS-P53) is read everywhere a solution is: it is what tells
 * a renderer whether it is looking at a typed payload or at somebody's build.
 */
export const SOLUTION_COLUMNS =
  "id, bounty_id, slot_kind, slot_id, solver_id, solver_note, content_payload, " +
  "solution_build_id, vote_count, i_would_implement_count, status, submitted_at, " +
  "accepted_at, created_at, updated_at";

// --- errors ------------------------------------------------------------------

/**
 * Every Supabase failure in this module is rethrown through here so the message
 * names the operation that failed. The same helper src/lib/build/types.ts
 * carries, kept separate rather than imported so a build-layer refactor cannot
 * silently change what a bounty error reads like.
 */
export function bountyLayerError(operation: string, cause: unknown): Error {
  const detail =
    cause && typeof cause === "object" && "message" in cause
      ? String((cause as { message: unknown }).message)
      : String(cause);
  const error = new Error(`${operation} failed: ${detail}`);
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}
