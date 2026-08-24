// =============================================================================
// NeoScale — the shared intake substrate (NS-P20a)
// =============================================================================
// One import for everything a reader needs. See README.md in this directory for
// what each piece is for and how a new reader registers itself.
//
// This barrel deliberately does NOT re-export readers/, which imports the
// parser functions, which import this substrate. Keeping the dependency in one
// direction is what makes the substrate readable on its own.
// =============================================================================

export type {
  Envelope,
  ParseOptions,
  ParseResult,
  ParseSummary,
  ParseWarning,
  ProposedEvent,
  ProposedField,
  ProposedNode,
  SourceRef,
} from "./envelope.ts";

export {
  readAnchor,
  readTimestamp,
  RELATIVE_TIMESTAMP_REASON,
} from "./timestamps.ts";
export type { TimestampReading } from "./timestamps.ts";

export { guessed, mark, verbatim } from "./inferred.ts";
export type { InferenceMark } from "./inferred.ts";

export { createLocalIdMinter, renumberLocalIds } from "./local-id.ts";
export { createOrdinalCounter, renumberOrdinals } from "./ordinals.ts";
export { sourceRefFor } from "./source-ref.ts";

export {
  detection,
  intakeFile,
  isWrongFile,
  MAX_CONFIDENCE,
  MIN_CONFIDENCE,
  READ_OUTCOME,
  readerResult,
} from "./reader.ts";
export type {
  Detection,
  IntakeFile,
  IntakeReader,
  ReadOutcome,
  ReaderResult,
  ReaderTag,
  SchemaProvenance,
} from "./reader.ts";

export { createReaderRegistry, ReaderRegistry, ROUTING_FLOOR } from "./registry.ts";
export type { Routing } from "./registry.ts";
