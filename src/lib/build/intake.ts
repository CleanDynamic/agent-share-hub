// Transcript intake: calling the parser, and turning its proposal into rows.
//
// parse-transcript (NS-P13) writes nothing. It reads one build row to confirm
// ownership and returns a PROPOSAL — events, nodes, a suggested title and
// outcome — that a creator accepts, edits or throws away on the intake surface.
// This module is the other half: the call out, and the one write that turns an
// accepted proposal into build_events and build_nodes rows.
//
// Two things about the parser's output are not columns and have to be dealt
// with here rather than passed through:
//
//   build_events has no source_ref column, so an event's provenance is folded
//   into payload.source_ref. That is the option the NS-P13 README names, and
//   it is the one that keeps the provenance rather than dropping it.
//
//   local_id is a handle within one response, not a uuid. It is recorded on
//   the node's source_ref so a second submission of the same proposal can
//   recognise a node it already wrote.
//
// Everything materialised lands in the tray (position NULL). Nothing is
// auto-placed: arranging material that already exists is a far easier first
// act than filling a blank form, and it is the creator's act, not the parser's.

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { updateBuild } from "./builds";
import {
  buildLayerError,
  type BuildEventInsert,
  type BuildNodeInsert,
  type BuildPatch,
} from "./types";

// -----------------------------------------------------------------------------
// The parser's contract
// -----------------------------------------------------------------------------
// Mirrored from supabase/functions/parse-transcript/parse.ts. The function is
// deployed separately from this bundle, so these are a restatement rather than
// a shared import — kept deliberately structural (`string` for the open
// vocabularies) so a parser that learns a new detected_format or warning code
// does not fail to typecheck here.

/** `{source, session_id, index}` — index is the TURN the item was read out of. */
export interface TranscriptSourceRef {
  source: string;
  session_id: string;
  index: number;
}

export interface ProposedEvent {
  /** 1..N over user turns. Not the ordinal the row ends up with — see below. */
  ordinal: number;
  kind: string;
  visibility: string;
  occurred_at: string | null;
  payload: { text: string; response_summary: string | null };
  source_ref: TranscriptSourceRef;
  inferred: boolean;
  inferred_reason: string | null;
}

export interface ProposedNode {
  /** A handle within one response. Mapped to a uuid on materialisation. */
  local_id: string;
  /** Always a node_types.key. */
  type: string;
  title: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  source_ref: TranscriptSourceRef;
  inferred: boolean;
  inferred_reason: string | null;
}

/** A proposed `builds` column value. title and outcome are not nodes. */
export interface ProposedField {
  value: string;
  source_ref: TranscriptSourceRef;
  inferred: boolean;
  inferred_reason: string | null;
}

export interface ParseWarning {
  code: string;
  message: string;
}

export interface ProposalSummary {
  /** The proposal id. Generated per call, recorded in every source_ref. */
  session_id: string;
  source_hint: string | null;
  detected_format: string;
  detected_labels: { user: string[]; assistant: string[] };
  turn_count: number;
  user_turn_count: number;
  assistant_turn_count: number;
  event_count: number;
  node_count: number;
  character_count: number;
  line_count: number;
  proposed_title: ProposedField | null;
  proposed_outcome: ProposedField | null;
}

export interface TranscriptProposal {
  events: ProposedEvent[];
  nodes: ProposedNode[];
  summary: ProposalSummary;
  warnings: ParseWarning[];
}

/** Rejected over this by the function, with a 413 that says to split the paste. */
export const MAX_RAW_TEXT_CHARS = 400_000;

// -----------------------------------------------------------------------------
// Calling the parser
// -----------------------------------------------------------------------------

/**
 * A non-2xx from an edge function arrives as a FunctionsHttpError whose body
 * is unread — `error.message` is only ever "Edge Function returned a
 * non-2xx status code". The function answers with `{error}` and distinguishes
 * 401 from 403 from 413 deliberately, so throwing that generic string away
 * would turn every one of those into the same unreadable failure.
 */
async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  const response = context as Response | undefined;

  if (response && typeof response.json === "function") {
    try {
      const body = await response.json();
      const message = (body as { error?: unknown })?.error;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // Body already consumed, or not JSON. Fall through to the generic text.
    }
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim()
    ? message
    : "parse-transcript could not be reached.";
}

/**
 * Ask the parser for a proposal against a build the caller owns.
 *
 * The build must exist before this is called: the function verifies ownership
 * against a real row, and creating the draft first is what leaves a creator
 * with a usable empty draft when parsing fails rather than with nothing.
 */
export async function requestProposal(
  buildId: string,
  rawText: string,
  sourceHint?: string | null
): Promise<TranscriptProposal> {
  const { data, error } = await supabase.functions.invoke("parse-transcript", {
    body: {
      raw_text: rawText,
      build_id: buildId,
      source_hint: sourceHint ?? null,
    },
  });

  if (error) {
    throw buildLayerError("parse-transcript", new Error(await readFunctionError(error)));
  }

  const proposal = data as TranscriptProposal | null;
  if (!proposal || typeof proposal !== "object" || !proposal.summary?.session_id) {
    throw buildLayerError(
      "parse-transcript",
      new Error("The parser returned a response this version does not understand.")
    );
  }

  return {
    events: proposal.events ?? [],
    nodes: proposal.nodes ?? [],
    summary: proposal.summary,
    warnings: proposal.warnings ?? [],
  };
}

// -----------------------------------------------------------------------------
// Materialisation
// -----------------------------------------------------------------------------

/**
 * The one-line message the workspace shows on arrival from intake.
 *
 * Carried in router state from /compose/new to /compose/:buildId. It lives here
 * rather than on either page because both ends need the shape and neither
 * should import the other: a tray full of material and no instruction is its
 * own kind of blank surface, and a parse that failed has to say so somewhere.
 */
export interface IntakeArrival {
  tone: "settled" | "failed";
  message: string;
}

/** What the creator kept. Anything absent was discarded and is never written. */
export interface IntakeSelections {
  /** Proposal-local event ordinals (1..N), not the ordinals rows end up with. */
  eventOrdinals: Iterable<number>;
  nodeLocalIds: Iterable<string>;
  title: boolean;
  outcome: boolean;
}

export interface MaterialiseCounts {
  events: number;
  nodes: number;
  titleApplied: boolean;
  outcomeApplied: boolean;
  /**
   * This proposal had already been written to this build. Rows already present
   * were left alone; only genuinely missing ones were written.
   */
  alreadyMaterialised: boolean;
}

/** Every selection off, for a creator who discarded the lot. */
export const NO_SELECTIONS: IntakeSelections = {
  eventOrdinals: [],
  nodeLocalIds: [],
  title: false,
  outcome: false,
};

/**
 * The reviewing form of a selection: sets, so a toggle is O(1) and React holds
 * one object. A Set is an Iterable, so this satisfies IntakeSelections as it
 * stands and needs no conversion on the way to materialiseProposal.
 */
export interface IntakeSelectionState extends IntakeSelections {
  eventOrdinals: Set<number>;
  nodeLocalIds: Set<string>;
  title: boolean;
  outcome: boolean;
}

/**
 * Everything on, which is where a review starts.
 *
 * The creator has already done this work somewhere else; making them opt each
 * piece back in would be asking them to do it twice.
 */
export function keepEverything(proposal: TranscriptProposal): IntakeSelectionState {
  return {
    eventOrdinals: new Set(proposal.events.map((event) => event.ordinal)),
    nodeLocalIds: new Set(proposal.nodes.map((node) => node.local_id)),
    title: Boolean(proposal.summary.proposed_title),
    outcome: Boolean(proposal.summary.proposed_outcome),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** The source_ref folded into an event payload, or onto a node column. */
function readSourceRef(value: unknown): TranscriptSourceRef | null {
  if (!isRecord(value)) return null;
  const ref = isRecord(value.source_ref) ? value.source_ref : value;
  const sessionId = ref.session_id;
  const index = ref.index;
  if (typeof sessionId !== "string" || typeof index !== "number") return null;
  return {
    source: typeof ref.source === "string" ? ref.source : "transcript",
    session_id: sessionId,
    index,
  };
}

/**
 * Write an accepted proposal into a build.
 *
 * Order matters: events first, because they carry the ordinals and because a
 * node links to the event it came out of. Nodes follow, with position NULL, and
 * with build_nodes.event_id pointing at the event covering their turn.
 *
 * IDEMPOTENCY. Submitting the same proposal twice must not double the rows.
 * The proposal id (summary.session_id) is recorded on every row this writes —
 * on a node's source_ref, and folded into an event's payload — so a second
 * submission recognises what is already there and writes only what is missing.
 * The check is per item rather than all-or-nothing, which also means a run that
 * failed halfway can simply be run again to finish.
 *
 * TRANSACTIONALITY. supabase-js has no multi-statement transaction from the
 * browser, so this is one ordered sequence of batched statements rather than
 * one transaction: every event in a single insert, every node in a single
 * insert, then the header. Each statement is atomic on its own, and the
 * per-item idempotency above is what makes the sequence safe to resume rather
 * than something that leaves a half-written proposal unrepeatable.
 */
export async function materialiseProposal(
  buildId: string,
  proposal: TranscriptProposal,
  selections: IntakeSelections
): Promise<MaterialiseCounts> {
  const sessionId = proposal.summary.session_id;
  if (!sessionId) {
    throw buildLayerError(
      "materialiseProposal",
      new Error("The proposal carries no id, so it cannot be written safely.")
    );
  }

  const keptEvents = new Set(selections.eventOrdinals);
  const keptNodes = new Set(selections.nodeLocalIds);

  // --- what this build already holds -----------------------------------------

  const { data: eventRows, error: eventReadError } = await supabase
    .from("build_events")
    .select("id, ordinal, payload")
    .eq("build_id", buildId);
  if (eventReadError) {
    throw buildLayerError("materialiseProposal (events read)", eventReadError);
  }

  const { data: nodeRows, error: nodeReadError } = await supabase
    .from("build_nodes")
    .select("id, source_ref")
    .eq("build_id", buildId);
  if (nodeReadError) {
    throw buildLayerError("materialiseProposal (nodes read)", nodeReadError);
  }

  // The build may already hold events from an earlier paste — the parser's own
  // 413 tells a creator to split a long transcript and accept each part into
  // the same build — so new ordinals continue the sequence rather than
  // restarting it and colliding.
  const highestOrdinal = (eventRows ?? []).reduce(
    (highest, row) => Math.max(highest, typeof row.ordinal === "number" ? row.ordinal : 0),
    0
  );

  /** Turn index -> event uuid, for events of THIS proposal only. */
  const eventIdByTurn = new Map<number, string>();
  for (const row of eventRows ?? []) {
    const ref = readSourceRef(row.payload);
    if (ref?.session_id === sessionId) eventIdByTurn.set(ref.index, row.id);
  }

  const writtenLocalIds = new Set<string>();
  for (const row of nodeRows ?? []) {
    const ref = readSourceRef(row.source_ref);
    if (ref?.session_id !== sessionId) continue;
    const localId = isRecord(row.source_ref) ? row.source_ref.local_id : null;
    if (typeof localId === "string") writtenLocalIds.add(localId);
  }

  const alreadyMaterialised = eventIdByTurn.size > 0 || writtenLocalIds.size > 0;

  // --- events, first: they carry the ordinals ---------------------------------

  const pendingEvents = proposal.events.filter(
    (event) => keptEvents.has(event.ordinal) && !eventIdByTurn.has(event.source_ref.index)
  );

  if (pendingEvents.length > 0) {
    const rows: BuildEventInsert[] = pendingEvents.map((event, offset) => ({
      build_id: buildId,
      ordinal: highestOrdinal + offset + 1,
      kind: event.kind,
      visibility: event.visibility,
      occurred_at: event.occurred_at,
      // build_events has no source_ref column. Folding it into payload keeps
      // the provenance and gives the idempotency check something to read.
      payload: {
        ...event.payload,
        source_ref: { ...event.source_ref },
      } as unknown as Json,
    }));

    const { data: inserted, error } = await supabase
      .from("build_events")
      .insert(rows)
      .select("id, payload");
    if (error) throw buildLayerError("materialiseProposal (events)", error);

    for (const row of inserted ?? []) {
      const ref = readSourceRef(row.payload);
      if (ref) eventIdByTurn.set(ref.index, row.id);
    }
  }

  // --- nodes, second: they land in the tray and point back at an event --------

  /**
   * The parser links no node to an event explicitly, so the link is derived
   * from the turn numbering it does document: turns run 1..N across both
   * speakers, one event per user turn. A node read out of turn 4 belongs to the
   * exchange opened by the user turn before it, so the covering event is the
   * one with the greatest turn index at or below the node's.
   */
  const eventTurns = [...eventIdByTurn.keys()].sort((a, b) => a - b);
  const coveringEventId = (turn: number): string | null => {
    let covering: string | null = null;
    for (const eventTurn of eventTurns) {
      if (eventTurn > turn) break;
      covering = eventIdByTurn.get(eventTurn) ?? covering;
    }
    return covering;
  };

  const pendingNodes = proposal.nodes.filter(
    (node) => keptNodes.has(node.local_id) && !writtenLocalIds.has(node.local_id)
  );

  if (pendingNodes.length > 0) {
    const rows: BuildNodeInsert[] = pendingNodes.map((node) => ({
      build_id: buildId,
      type: node.type,
      title: node.title,
      note: node.note,
      payload: (node.payload ?? {}) as Json,
      // local_id rides along on source_ref: it is what a second submission
      // recognises, and it costs nothing next to the provenance already here.
      source_ref: {
        ...node.source_ref,
        local_id: node.local_id,
      } as unknown as Json,
      // Everything lands in the tray. The creator decides where it goes.
      position: null,
      event_id: coveringEventId(node.source_ref.index),
    }));

    const { error } = await supabase.from("build_nodes").insert(rows);
    if (error) throw buildLayerError("materialiseProposal (nodes)", error);
  }

  // --- the header, last -------------------------------------------------------
  //
  // Only what the creator kept. A discarded title leaves the build called
  // "Untitled build", which is the honest state: nobody has named it yet.
  //
  // Skipped entirely on a resubmission — the header was settled the first time
  // and may have been edited by hand since, which a re-apply would silently
  // overwrite.

  const patch: BuildPatch = {};
  const title = proposal.summary.proposed_title;
  const outcome = proposal.summary.proposed_outcome;

  if (!alreadyMaterialised) {
    if (selections.title && title?.value.trim()) patch.title = title.value.trim();
    if (selections.outcome && outcome?.value.trim()) patch.outcome = outcome.value.trim();
  }

  const titleApplied = patch.title !== undefined;
  const outcomeApplied = patch.outcome !== undefined;

  if (titleApplied || outcomeApplied) {
    await updateBuild(buildId, patch);
  }

  return {
    events: pendingEvents.length,
    nodes: pendingNodes.length,
    titleApplied,
    outcomeApplied,
    alreadyMaterialised,
  };
}
