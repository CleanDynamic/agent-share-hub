// =============================================================================
// NeoScale — the Lovable reader, as a registered reader (NS-P20a)
// =============================================================================
// An adapter, not a second parser. Detection calls parse-lovable's own exported
// `detect`, and reading calls its own `parseLovable`, so this reader cannot
// disagree with the function it fronts. The client's copy of the routing logic
// (src/lib/build/lovable.ts) can and one day will; that is the duplication this
// registry exists to end, and ending it is a later prompt's work.
//
// WHAT THIS READER READS. Lovable has no native session export. Its own ZIP
// download and GitHub sync carry source code and none of the session — no
// prompts, no timestamps, no ordering. The two shapes that DO carry a session
// both come from third-party tooling, and both are recorded below with the
// serialising source their schema was read from. parse-lovable/README.md
// carries the same facts at length, with a sample of each.
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
  ReadOutcome,
  ReaderResult,
  SchemaProvenance,
} from "../reader.ts";
import {
  detect as detectLovableShape,
  parseLovable,
} from "../../../parse-lovable/parse.ts";
import type { DetectedFormat } from "../../../parse-lovable/parse.ts";

/**
 * Bump when what this reader DOES changes — a third shape read, a rule changed,
 * a field filled differently. Not for a comment or a refactor whose output is
 * identical: the number exists to tell a stale proposal from a current one.
 */
export const READER_VERSION = "1.0.0";

/**
 * Where each schema was read from, and when.
 *
 * Read from the SERIALISING SOURCE CODE of the tools that write these files,
 * not inferred from a sample and not guessed — NS-P20 had no captured export
 * available. That is stronger than a guess and weaker than a validated sample,
 * and the difference bites in exactly one place: `timestampText`, which is
 * scraped display text rather than a timestamp. See the warning in the README.
 *
 * `identifier` carries the repository, because a repository is what NS-P20's
 * README recorded. No commit was recorded, and none is invented here.
 */
export const SCHEMA_PROVENANCE: SchemaProvenance[] = [
  {
    format: "lovable_chat_export",
    source:
      "lucioamor/lovable-chat-exporter — content.js, the exportJSON() return and parseMessageElement()",
    identifier: "github.com/lucioamor/lovable-chat-exporter",
    read_on: "2026-08-24",
  },
  {
    format: "lovable_trajectory",
    source:
      "brendangooden/lovable-chat-history-capture — src/messages.ts, the TrajectoryMessage interface and buildTrajectoryMessage()",
    identifier: "github.com/brendangooden/lovable-chat-history-capture",
    read_on: "2026-08-24",
  },
  {
    format: "lovable_source_only",
    source:
      "Lovable's own ZIP download and GitHub sync — a package.json, a tsconfig.json and a file manifest, carrying no session at all",
    identifier: null,
    read_on: "2026-08-24",
  },
];

/** A session shape: this file names a schema this reader was written against. */
const SESSION_CONFIDENCE = 0.95;
/** A Lovable artefact, but the wrong one. Still this reader's to explain. */
const SOURCE_ONLY_CONFIDENCE = 0.6;
/**
 * Valid JSON carrying no Lovable marker. Deliberately equal to the transcript
 * reader's bid for the same file: two equal top bids is how this substrate says
 * "undecidable", and the compose route already asks the creator in that case
 * rather than guessing.
 */
const AMBIGUOUS_CONFIDENCE = 0.15;

function outcomeFor(format: DetectedFormat): ReadOutcome {
  if (format === "lovable_source_only") return READ_OUTCOME.SOURCE_ONLY;
  if (format === "unrecognised") return READ_OUTCOME.UNRECOGNISED;
  return READ_OUTCOME.SESSION;
}

export const lovableReader: IntakeReader<
  DetectedFormat,
  "lovable",
  "prompt" | "deploy" | "breakage"
> = {
  id: "lovable",
  label: "Lovable session export",
  version: READER_VERSION,
  provenance: SCHEMA_PROVENANCE,

  detect(file: IntakeFile): Detection {
    const trimmed = file.text.trim();
    if (trimmed === "") return detection(0, "The file is empty.");
    // Cheap gate before a 400,000 character JSON.parse: no JSON document starts
    // with anything else, and a transcript almost never starts with either.
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return detection(0, "Not JSON. Every shape this reader reads is a JSON document.");
    }

    let root: unknown;
    try {
      root = JSON.parse(trimmed);
    } catch {
      return detection(0, "Opens like JSON but is not JSON, so it is text rather than an export.");
    }

    // The function's own detection, not a second opinion about it.
    const shape = detectLovableShape(root);
    switch (shape.format) {
      case "lovable_chat_export":
        return detection(
          SESSION_CONFIDENCE,
          `${shape.messages.length} messages carrying the chat exporter's contentText and timestampText.`,
        );
      case "lovable_trajectory":
        return detection(
          SESSION_CONFIDENCE,
          `${shape.messages.length} messages carrying the trajectory CLI's createdAt and patch records.`,
        );
      case "lovable_source_only":
        return detection(
          SOURCE_ONLY_CONFIDENCE,
          "A project manifest and no messages: this is a Lovable code download, which this reader recognises and explains.",
        );
      default:
        return detection(
          AMBIGUOUS_CONFIDENCE,
          "Valid JSON with no Lovable marker in it. It could as easily be another tool's export.",
        );
    }
  },

  parse(
    file: IntakeFile,
    options: ParseOptions,
  ): ReaderResult<DetectedFormat, "lovable", "prompt" | "deploy" | "breakage"> {
    const envelope = parseLovable(file.text, options);
    return readerResult(lovableReader, outcomeFor(envelope.summary.detected_format), envelope);
  },
};
