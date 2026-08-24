// =============================================================================
// NeoScale — the intake reader interface (NS-P20a)
// =============================================================================
// What every intake reader implements, so that adding a third one is writing a
// reader rather than rebuilding a pipeline.
//
//   detect(file)          -> { confidence, reason }
//   parse(file, options)  -> { reader, outcome, envelope }
//
// DETECTION READS THE CONTENT, NEVER THE FILENAME. A creator drops what they
// have; working out what it is, is the system's job. A .json extension proves
// nothing — a transcript can be saved as .json — and a .txt extension disproves
// nothing, because an export saved from a browser often loses its extension.
// `IntakeFile.name` exists to be recorded, not to be routed on.
//
// THE WRONG-FILE SIGNATURE. "This is a source-code-only download" and "I do not
// recognise this file" are different answers and must stay different all the
// way to the caller. Lovable has no native session export: its own ZIP download
// and GitHub sync carry source code and none of the session, so the creator who
// takes the obvious path lands there, and they need to be told what happened
// and what to do instead. Collapsing that into "unrecognised" turns a five-word
// explanation into a shrug. `ReadOutcome` keeps the two apart, and `outcome` is
// returned beside the envelope rather than buried in a warning code.
//
// VERSION AND PROVENANCE. Every reader carries a READER_VERSION and the
// provenance of each schema it reads. Both are returned with every parse, so a
// reader broken by a third-party tool changing its serialiser identifies itself
// — "lovable/chat-export reader 1.0.0, schema read from <repo> on <date>"
// rather than presenting as a generic import failure with nothing to grep for.
// =============================================================================

import type { Envelope, ParseOptions } from "./envelope.ts";

// -----------------------------------------------------------------------------
// The file
// -----------------------------------------------------------------------------

/**
 * A dropped or pasted file, as text.
 *
 * `name` is metadata: it is recorded and may be shown to a creator, and no
 * reader may route on it. Archives are unpacked to text before they reach a
 * reader — see src/lib/build/lovable.ts, which does that on the client.
 */
export interface IntakeFile {
  text: string;
  name?: string | null;
}

/** Wraps a raw string, for the common case where there is no filename. */
export function intakeFile(text: string, name: string | null = null): IntakeFile {
  return { text, name };
}

// -----------------------------------------------------------------------------
// Detection
// -----------------------------------------------------------------------------

/**
 * One reader's answer to "is this yours?".
 *
 * `confidence` is bounded to 0..1, where 0 is "certainly not mine" and 1 is
 * "this file names my own schema". `reason` is one short human-readable line
 * that ends up in front of a creator when routing surprises them, so it says
 * what was seen — "messages[] carrying contentText and topPx" — rather than
 * restating the verdict.
 */
export interface Detection {
  confidence: number;
  reason: string;
}

export const MIN_CONFIDENCE = 0;
export const MAX_CONFIDENCE = 1;

/** Clamps to 0..1, so a reader cannot outbid the others by returning 99. */
export function detection(confidence: number, reason: string): Detection {
  const bounded = Number.isFinite(confidence)
    ? Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, confidence))
    : MIN_CONFIDENCE;
  return { confidence: bounded, reason };
}

// -----------------------------------------------------------------------------
// Outcomes
// -----------------------------------------------------------------------------

/**
 * What a reader made of the file. The three are distinct answers, and the
 * distinction survives to the caller.
 *
 * - `session`     — a session was read. The envelope carries it.
 * - `source_only` — this is a source-code download, not a session export. Real,
 *                   common, and the single most likely wrong file a creator
 *                   sends. Named separately so it can be answered with an
 *                   explanation rather than a shrug.
 * - `unrecognised`— nothing in this file looks like anything this reader reads.
 */
export const READ_OUTCOME = {
  SESSION: "session",
  SOURCE_ONLY: "source_only",
  UNRECOGNISED: "unrecognised",
} as const;

export type ReadOutcome = (typeof READ_OUTCOME)[keyof typeof READ_OUTCOME];

/** True for the two outcomes that mean "this file was not mine to read". */
export function isWrongFile(outcome: ReadOutcome): boolean {
  return outcome !== READ_OUTCOME.SESSION;
}

// -----------------------------------------------------------------------------
// Version and provenance
// -----------------------------------------------------------------------------

/**
 * Where one schema was read from, and when.
 *
 * None of the shapes these readers consume is a format its vendor controls or
 * documents, so "we read the serialising source on this date" is the strongest
 * honest claim available, and it is the claim that lets a future breakage be
 * diagnosed rather than guessed at.
 */
export interface SchemaProvenance {
  /**
   * The shape this describes — a reader's own detected_format value, or one
   * family name where every shape a reader reads shares a provenance.
   */
  format: string;
  /** The serialising source the schema was read from, in words. */
  source: string;
  /** Repository, commit or file, where one was recorded. Null when none was. */
  identifier: string | null;
  /** ISO date (YYYY-MM-DD) the schema was read. */
  read_on: string;
}

/**
 * The tags a reader stamps on every parse.
 *
 * Bump `version` when what the reader DOES changes — a new shape read, a rule
 * changed, a field filled differently. Do not bump it for a comment or a
 * refactor that leaves the output identical, because the point of the number is
 * to tell a creator's stale proposal apart from a current one.
 */
export interface ReaderTag {
  id: string;
  label: string;
  version: string;
  provenance: SchemaProvenance[];
}

// -----------------------------------------------------------------------------
// The reader
// -----------------------------------------------------------------------------

/**
 * A parse, plus the two things a generic import failure never carries: which
 * reader produced it, and what it made of the file.
 *
 * `envelope` is the canonical proposal envelope, unchanged — the same object
 * the reader's own entry point returns, field for field. The reader tags sit
 * BESIDE it rather than inside it, so an envelope stays an envelope and the
 * existing entry points keep returning exactly what they always returned.
 */
export interface ReaderResult<
  Format extends string = string,
  Source extends string = string,
  Kind extends string = string,
> {
  reader: ReaderTag;
  outcome: ReadOutcome;
  envelope: Envelope<Format, Source, Kind>;
}

export interface IntakeReader<
  Format extends string = string,
  Source extends string = string,
  Kind extends string = string,
> extends ReaderTag {
  /** Is this yours, and why do you say so? Never reads `file.name`. */
  detect(file: IntakeFile): Detection;
  /** Read it. Returns an envelope whatever the outcome — never throws on a wrong file. */
  parse(file: IntakeFile, options: ParseOptions): ReaderResult<Format, Source, Kind>;
}

/** Lifts a reader's own tags onto a result. Every reader ends its parse here. */
export function readerResult<
  Format extends string,
  Source extends string,
  Kind extends string,
>(
  reader: ReaderTag,
  outcome: ReadOutcome,
  envelope: Envelope<Format, Source, Kind>,
): ReaderResult<Format, Source, Kind> {
  return {
    reader: {
      id: reader.id,
      label: reader.label,
      version: reader.version,
      provenance: reader.provenance,
    },
    outcome,
    envelope,
  };
}
