// =============================================================================
// NeoScale — the canonical proposal envelope (NS-P20a)
// =============================================================================
// One source of truth for the shape every intake reader returns. These
// declarations were MOVED here from supabase/functions/parse-transcript/parse.ts
// — NS-P13 wrote them, NS-P13's meanings are unchanged, and parse-transcript
// still exports every one of them by its original name from its original path.
// Nothing was redefined and nothing was renamed.
//
// WHY GENERICS. NS-P13 declared `source: "transcript"` and NS-P20 declared
// `source: "lovable"`, which is the only field in the whole envelope that is
// supposed to vary per reader — plus `detected_format`, which names a shape only
// its own reader knows, and `kind`, which NS-P13 fixed to "prompt" while NS-P20
// also emits "deploy" and "breakage". Parameterising exactly those three and
// nothing else lets each reader keep its own narrow literal types while the
// other twenty-odd fields are declared once. Every parameter defaults to
// `string`, so a caller that does not care — intake.ts does not — reads the
// envelope with no type arguments at all.
//
// These are types. They are erased at compile time, carry no runtime code, and
// import nothing.
// =============================================================================

/**
 * {source, session_id, index} — the shape build_nodes.source_ref already holds.
 *
 * `index` is the turn or message this item was read out of, counted across both
 * speakers from 1. `source` is the reader's own discriminator, and is the one
 * value a client could branch on. intake.ts types it as `string` and does not.
 */
export interface SourceRef<Source extends string = string> {
  source: Source;
  session_id: string;
  index: number;
}

/** Maps to a build_events row. `ordinal` is renumbered against the build on write. */
export interface ProposedEvent<
  Source extends string = string,
  Kind extends string = string,
> {
  ordinal: number;
  kind: Kind;
  visibility: "folded";
  occurred_at: string | null;
  payload: { text: string; response_summary: string | null };
  source_ref: SourceRef<Source>;
  inferred: boolean;
  inferred_reason: string | null;
}

/** Maps to a build_nodes row. `local_id` is a handle within one response only. */
export interface ProposedNode<Source extends string = string> {
  /** Local handle only. The client maps it to a uuid on materialisation. */
  local_id: string;
  /** A node_types.key. Never a value absent from the registry. */
  type: string;
  title: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  source_ref: SourceRef<Source>;
  inferred: boolean;
  inferred_reason: string | null;
}

/** A proposed builds column value — title and outcome are not nodes. */
export interface ProposedField<Source extends string = string> {
  value: string;
  source_ref: SourceRef<Source>;
  inferred: boolean;
  inferred_reason: string | null;
}

export interface ParseWarning {
  code: string;
  message: string;
}

/**
 * Everything a creator needs to judge the proposal before accepting any of it.
 *
 * turn_count / user_turn_count / assistant_turn_count keep their transcript
 * names whatever the source calls them: renaming per reader would fork the
 * envelope, and the client reads them by name.
 */
export interface ParseSummary<
  Format extends string = string,
  Source extends string = string,
> {
  session_id: string;
  source_hint: string | null;
  detected_format: Format;
  detected_labels: { user: string[]; assistant: string[] };
  turn_count: number;
  user_turn_count: number;
  assistant_turn_count: number;
  event_count: number;
  node_count: number;
  character_count: number;
  line_count: number;
  proposed_title: ProposedField<Source> | null;
  proposed_outcome: ProposedField<Source> | null;
}

export interface ParseResult<
  Format extends string = string,
  Source extends string = string,
  Kind extends string = string,
> {
  events: ProposedEvent<Source, Kind>[];
  nodes: ProposedNode<Source>[];
  summary: ParseSummary<Format, Source>;
  warnings: ParseWarning[];
}

export interface ParseOptions {
  /** Identifies this paste or drop. Recorded in every source_ref. */
  session_id: string;
  source_hint?: string | null;
}

/**
 * The name the substrate uses for a ParseResult when it is being passed around
 * as a whole rather than read field by field. Same type, clearer at a call site.
 */
export type Envelope<
  Format extends string = string,
  Source extends string = string,
  Kind extends string = string,
> = ParseResult<Format, Source, Kind>;
