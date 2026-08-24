// =============================================================================
// NeoScale — the transcript reader, as a registered reader (NS-P20a)
// =============================================================================
// An adapter, not a second parser, and in one respect a stricter one than the
// Lovable adapter beside it: parse-transcript's detection is not exported —
// splitIntoTurns and its label scanner are module-private, and NS-P20a is not
// allowed to edit that file — so `detect` here runs the parser and reads the
// answer out of `summary.detected_format`.
//
// That is a real cost (a text file routed here is split twice) bought for a
// real property: this reader's detection CANNOT disagree with its parse,
// because it is its parse. The client-side mirror in src/lib/build/lovable.ts
// has no such guarantee, and a routing decision that disagrees with the parser
// it routes to is how a creator ends up at a function that cannot read their
// file. A later prompt allowed to edit parse-transcript should export the split
// and have this call that instead.
//
// This is the FALLBACK reader, registered last. A transcript is text, and text
// is what is left when no other reader claims a file — so it bids on anything
// non-empty rather than refusing outright, and low enough that a reader with a
// schema always outbids it.
// =============================================================================

import type { ParseOptions } from "../envelope.ts";
import {
  detection,
  READ_OUTCOME,
  readerResult,
} from "../reader.ts";
import type {
  Detection,
  IntakeFile,
  IntakeReader,
  ReaderResult,
  SchemaProvenance,
} from "../reader.ts";
import { parseTranscript } from "../../../parse-transcript/parse.ts";
import type { DetectedFormat } from "../../../parse-transcript/parse.ts";

/** See the Lovable reader for the bump rule. Same rule, same reason. */
export const READER_VERSION = "1.0.0";

/**
 * One entry, covering every shape this reader reads, because they share a
 * provenance: there is no serialising source to cite. A pasted transcript is
 * not a file any tool writes to a schema — it is the conventions chat UIs
 * happen to render, "You said:" from ChatGPT's web export and "**Human**" from
 * a Claude-style paste, which is why NS-P13's detection is a vocabulary and a
 * confidence rather than a parser for a documented format.
 *
 * `identifier` is null and stays null. There is nothing to pin.
 */
export const SCHEMA_PROVENANCE: SchemaProvenance[] = [
  {
    format: "transcript",
    source:
      "No third-party serialiser. The five shapes this reader splits — labelled_colon, markdown_bold, markdown_heading, blank_line_alternating, unstructured — are conventions of chat UIs, read from the transcript samples recorded in parse-transcript/README.md",
    identifier: null,
    read_on: "2026-08-23",
  },
];

/** A convention matched: labels were found and the split followed them. */
const SPLIT_CONFIDENCE = 0.8;
/**
 * No convention matched. Still a real proposal — NS-P13 keeps the text whole as
 * one event rather than splitting on a guess — so this is a claim, not a
 * refusal.
 */
const PROSE_CONFIDENCE = 0.4;
/**
 * Valid JSON. A transcript can be saved as .json, but a JSON document usually
 * belongs to a reader with a schema. Deliberately equal to the Lovable reader's
 * bid for JSON it finds no marker in: two equal top bids is how this substrate
 * says "undecidable", and the compose route already asks the creator in that
 * case rather than guessing.
 */
const JSON_CONFIDENCE = 0.15;

function looksLikeJson(trimmed: string): boolean {
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    // Opens like JSON, is not JSON. It is text, and text is a transcript.
    return false;
  }
}

export const transcriptReader: IntakeReader<DetectedFormat, "transcript", "prompt"> = {
  id: "transcript",
  label: "Pasted chat transcript",
  version: READER_VERSION,
  provenance: SCHEMA_PROVENANCE,

  detect(file: IntakeFile): Detection {
    const trimmed = file.text.trim();
    if (trimmed === "") return detection(0, "The file is empty.");
    if (looksLikeJson(trimmed)) {
      return detection(
        JSON_CONFIDENCE,
        "Valid JSON. A transcript is text, so this more likely belongs to a reader with a schema.",
      );
    }

    // The parser's own answer, not a second opinion about it.
    const { summary } = parseTranscript(file.text, { session_id: "detect" });
    if (summary.detected_format === "unstructured") {
      return detection(
        PROSE_CONFIDENCE,
        "No speaker convention matched. Readable as prose, and kept whole as one event rather than split on a guess.",
      );
    }
    const labels = [...summary.detected_labels.user, ...summary.detected_labels.assistant];
    return detection(
      SPLIT_CONFIDENCE,
      `Split as ${summary.detected_format} into ${summary.turn_count} ` +
        `${summary.turn_count === 1 ? "turn" : "turns"}` +
        (labels.length > 0 ? ` on ${labels.join(" / ")}.` : "."),
    );
  },

  parse(
    file: IntakeFile,
    options: ParseOptions,
  ): ReaderResult<DetectedFormat, "transcript", "prompt"> {
    const envelope = parseTranscript(file.text, options);
    // A transcript reader has no source-only case: there is no such thing as a
    // code download that is nearly a transcript. Nothing read at all is the only
    // way this file was not its to read.
    const outcome =
      envelope.summary.turn_count === 0 ? READ_OUTCOME.UNRECOGNISED : READ_OUTCOME.SESSION;
    return readerResult(transcriptReader, outcome, envelope);
  },
};
