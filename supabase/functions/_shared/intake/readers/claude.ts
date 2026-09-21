// =============================================================================
// buildgallery — the Claude.ai reader, as a registered reader (EX-P12)
// =============================================================================
// Unlike the two readers beside it, this one is NOT an adapter. There is no
// parse-claude function to front, so the parse lives here and is built entirely
// on the substrate helpers — sourceRefFor, createOrdinalCounter, readTimestamp,
// readAnchor, mark. Nothing in this file performs I/O or touches a Deno API: a
// string in, an envelope out, exercised without a running Supabase.
//
// WHAT THIS READER READS. The account export Claude.ai writes as
// `conversations.json`: a JSON array of conversation objects, each carrying a
// `name`, its own clock, and a `chat_messages` array. Every message carries a
// `sender` of "human" or "assistant", an absolute `created_at`, and a `content`
// array of typed blocks.
//
// THE TRAP. A message ALSO carries a top-level `text` field, and it is a
// flattened display string, not the message. In the export this reader was
// written against, 28 of 113 messages had `text` carrying the literal
// "This block is not supported on your current device yet." in place of every
// block the renderer could not draw. So the turn is built from the `text`
// BLOCKS inside `content`, joined with a blank line, and `message.text` is
// never read. Joining is not optional either: consecutive text blocks are
// separate utterances and raw concatenation runs their sentences together.
//
// THE FIVE MAPPING DECISIONS, each confirmed before this was written, and each
// marked on the event it affects rather than done silently:
//
//   1. SEVERAL CONVERSATIONS, ONE ENVELOPE. `parse` returns one envelope and
//      the connector never selects, so every turn of every conversation is
//      proposed, in file order, with a warning naming what the file held. The
//      creator selects on the upload page, which is where selection belongs.
//   2. THINKING IS DROPPED. Not a preference: every thinking block in this
//      format carries `thinking: ""` with `thinking_hidden: true`. There is no
//      reasoning text to keep. The `summaries` beside it are labels the
//      platform wrote about the reasoning, and carrying those would be
//      importing a summary, which this connector does not do. Counted in a
//      warning so nothing disappears quietly.
//   3. TOOL CALLS FOLD TO ONE LINE EACH. The name, and whether it errored.
//      Never `input`, never `content`: in the export this was read from, tool
//      payloads ran 15-33x the size of the conversation itself, they are other
//      systems' output rather than anything either party said, and a
//      tool_result is the largest untrusted surface in the file. The one line
//      is what keeps a turn that is ALL tool calls from becoming an empty
//      event — eight messages in that export had no text block at all.
//   4. AN INJECTED PROMPT BLOCK IS NOT THE CREATOR'S WRITING. Claude.ai
//      inserts these into a human turn (`injection_source: "date_note"` was the
//      one seen). The record is of what the creator wrote, so it is left out
//      and the turn says so. Handled by presence, never by source: a new
//      injection_source is still not something a person typed.
//   5. ATTACHMENTS ARE KEPT, FILES ARE NAMED. `attachments[].extracted_content`
//      is the text the creator put into the conversation, so it is carried
//      under a marker. `files[]` carries a name and a uuid and no bytes at all,
//      so the names are recorded and the uuid is never dereferenced — this
//      connector's world is closed and does not reach into Claude.ai storage.
//
// NOTHING HERE ACTS ON WHAT IT READS. Every string lifted out of an export is
// carried as data. No value in a conversation selects a code path, and no text
// in one is ever treated as an instruction.
// =============================================================================

import type {
  ParseOptions,
  ParseResult,
  ParseWarning,
  ProposedEvent,
  ProposedField,
} from "../envelope.ts";
import { mark } from "../inferred.ts";
import { createOrdinalCounter } from "../ordinals.ts";
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
import { sourceRefFor } from "../source-ref.ts";
import { readAnchor, readTimestamp } from "../timestamps.ts";

/**
 * Bump when what this reader DOES changes — a shape read, a rule changed, a
 * field filled differently. Not for a comment or a refactor whose output is
 * identical: the number exists to tell a stale proposal from a current one.
 */
export const READER_VERSION = "1.0.0";

/**
 * Where the schema was read from, and when.
 *
 * Read from a REAL EXPORT rather than from a serialising source, which is the
 * opposite of the Lovable reader's provenance and is the honest description of
 * what was available: Claude.ai's export writer is not public, so the file it
 * produces is the only evidence there is. One account export of 10
 * conversations and 113 messages, every block type it contained counted.
 *
 * `identifier` is null and stays null. The export records no schema version, no
 * generator string and no format number — nothing to pin — and inventing one
 * would be worse than admitting there is none.
 */
export const SCHEMA_PROVENANCE: SchemaProvenance[] = [
  {
    format: "claude_conversations_export",
    source:
      "Claude.ai's own account export, conversations.json — a captured export of 10 conversations / 113 messages, read block type by block type: text, thinking, tool_use, tool_result and injected_prompt_block",
    identifier: null,
    read_on: "2026-09-21",
  },
];

/**
 * This file names the schema this reader was written against.
 *
 * ABOVE THE LOVABLE READER'S 0.95, deliberately, and this is the one number in
 * here that needs its reasoning written down.
 *
 * parse-lovable's `detect` takes a top-level JSON array as its message list and
 * calls the shape `lovable_trajectory` when the objects in it carry a
 * `createdAt` or a `created_at` (parse-lovable/parse.ts, the `trajectoryish`
 * count). A Claude.ai export is a top-level array of conversation objects and
 * every one of them carries `created_at` — so the Lovable reader bids 0.95 on
 * one, reading the whole conversation as a single message. At an equal bid the
 * tie goes to registration order, which is Lovable, and a creator's export
 * would be read by the wrong reader into nonsense.
 *
 * The two bids are not equally evidenced and the numbers now say so. Lovable's
 * is a structural guess from one common key; this one is a named schema —
 * `chat_messages` arrays whose messages carry `sender` of human or assistant
 * and typed content blocks. Nothing else writes that.
 *
 * This raises no bid against a file that is actually Lovable's: readConversations
 * requires `chat_messages`, which no Lovable shape carries, so a genuine Lovable
 * export still meets 0.1 from here. The cleaner fix is for parse-lovable's
 * detect to require a message-shaped key rather than any `created_at`, which is
 * a change to a file this step must not touch — recorded in the handover.
 */
const SESSION_CONFIDENCE = 0.98;
/**
 * Valid JSON carrying no `chat_messages` anywhere.
 *
 * Deliberately BELOW the 0.15 the Lovable and transcript readers both bid on
 * unmarked JSON. That tie is the substrate's way of saying "undecidable"
 * between those two, and this reader has no business joining it: a JSON
 * document with no `chat_messages` array is definitely not a Claude.ai export,
 * where the same document might still be a Lovable shape or a transcript saved
 * as .json. Low rather than zero, per the registry's own guidance.
 */
const NO_MARKER_CONFIDENCE = 0.1;

export type DetectedFormat = "claude_conversations_export" | "unrecognised";

// -----------------------------------------------------------------------------
// Reading the shape
// -----------------------------------------------------------------------------
// Every accessor below tolerates a missing or wrongly-typed field and answers
// with a default. An export half a version out of date should lose the field
// that changed, not the conversation around it.

interface ContentBlock {
  type: string;
  text?: unknown;
  name?: unknown;
  id?: unknown;
  tool_use_id?: unknown;
  is_error?: unknown;
}

interface Message {
  sender: string;
  created_at: string | null;
  content: ContentBlock[];
  attachments: { file_name: string; extracted_content: string }[];
  files: { file_name: string }[];
}

interface Conversation {
  name: string;
  updated_at: string | null;
  messages: Message[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readBlocks(value: unknown): ContentBlock[] {
  return asArray(value)
    .filter(isRecord)
    .filter((block) => typeof block.type === "string")
    .map((block) => block as unknown as ContentBlock);
}

function readMessage(value: unknown): Message | null {
  if (!isRecord(value)) return null;
  return {
    sender: asString(value.sender),
    created_at: asStringOrNull(value.created_at),
    content: readBlocks(value.content),
    attachments: asArray(value.attachments)
      .filter(isRecord)
      .map((attachment) => ({
        file_name: asString(attachment.file_name),
        extracted_content: asString(attachment.extracted_content),
      })),
    files: asArray(value.files)
      .filter(isRecord)
      .map((file) => ({ file_name: asString(file.file_name) })),
  };
}

/**
 * The conversations in a parsed root, in file order.
 *
 * A bare array is the shape the account export writes. A lone object is
 * accepted too, because a creator who pulls one conversation out of that array
 * and saves it has a file that is still unmistakably this format, and refusing
 * it on a bracket would be routing on punctuation.
 */
function readConversations(root: unknown): Conversation[] {
  const candidates = Array.isArray(root) ? root : [root];
  const conversations: Conversation[] = [];

  for (const candidate of candidates) {
    if (!isRecord(candidate) || !Array.isArray(candidate.chat_messages)) continue;
    const messages = candidate.chat_messages
      .map(readMessage)
      .filter((message): message is Message => message !== null);
    conversations.push({
      name: asString(candidate.name).trim(),
      updated_at: asStringOrNull(candidate.updated_at),
      messages,
    });
  }

  return conversations;
}

/** Parses, or null. Opening like JSON and not being JSON is a text file. */
function parseJson(trimmed: string): unknown | null {
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Building one turn's text
// -----------------------------------------------------------------------------

/** What the reader did to a turn beyond reading its prose. */
interface Folded {
  text: string;
  toolCalls: number;
  thinkingBlocks: number;
  injectedBlocks: number;
  attachments: number;
  namedFiles: number;
}

const UNNAMED = "unnamed file";

function fileLabel(name: string): string {
  const trimmed = name.trim();
  return trimmed === "" ? UNNAMED : trimmed;
}

/**
 * One turn, as the text of one event.
 *
 * Walks `content` IN ORDER so a folded tool line lands where the call ran
 * rather than in a block at the end, then appends the message-level
 * attachments and files, which sit beside `content` rather than inside it.
 */
function foldTurn(message: Message): Folded {
  // tool_use carries the name, tool_result carries whether it failed. Paired by
  // id so the line can say so without emitting a second line for the result.
  const errored = new Map<string, boolean>();
  for (const block of message.content) {
    if (block.type !== "tool_result") continue;
    const id = asString(block.tool_use_id);
    if (id !== "") errored.set(id, block.is_error === true);
  }

  const pieces: string[] = [];
  let toolCalls = 0;
  let thinkingBlocks = 0;
  let injectedBlocks = 0;

  for (const block of message.content) {
    switch (block.type) {
      case "text": {
        const text = asString(block.text);
        if (text.trim() !== "") pieces.push(text.trim());
        break;
      }
      case "tool_use": {
        toolCalls += 1;
        const name = asString(block.name).trim() || "an unnamed tool";
        const failed = errored.get(asString(block.id)) === true;
        pieces.push(failed ? `[ran ${name} — it returned an error]` : `[ran ${name}]`);
        break;
      }
      case "thinking":
        // Empty in this format, every time. Counted, not carried.
        thinkingBlocks += 1;
        break;
      case "injected_prompt_block":
        // Inserted by Claude.ai into someone's turn. Not their writing.
        injectedBlocks += 1;
        break;
      default:
        // tool_result is folded through its tool_use above. Anything else is a
        // block type this reader has not seen, and a turn is not lost over one.
        break;
    }
  }

  let attachments = 0;
  for (const attachment of message.attachments) {
    const content = attachment.extracted_content;
    if (content.trim() === "") continue;
    attachments += 1;
    pieces.push(`[attachment: ${fileLabel(attachment.file_name)}]\n${content.trim()}`);
  }

  const names = message.files.map((file) => fileLabel(file.file_name));
  if (names.length > 0) pieces.push(`[files on this turn: ${names.join(", ")}]`);

  return {
    text: pieces.join("\n\n"),
    toolCalls,
    thinkingBlocks,
    injectedBlocks,
    attachments,
    namedFiles: names.length,
  };
}

/**
 * Why this turn's text is not simply what was in the export.
 *
 * Null when nothing was folded, dropped or added, which is the ordinary case
 * for a turn of plain prose. One sentence a creator can read and disagree with.
 */
function foldReason(folded: Folded): string | null {
  const parts: string[] = [];
  if (folded.toolCalls > 0) {
    parts.push(
      `${folded.toolCalls} tool ${folded.toolCalls === 1 ? "call" : "calls"} folded to one line each, without their inputs or results`,
    );
  }
  if (folded.thinkingBlocks > 0) {
    parts.push(
      `${folded.thinkingBlocks} thinking ${folded.thinkingBlocks === 1 ? "block" : "blocks"} left out, because the export carries no reasoning text in them`,
    );
  }
  if (folded.injectedBlocks > 0) {
    parts.push(
      `${folded.injectedBlocks} ${folded.injectedBlocks === 1 ? "block" : "blocks"} Claude.ai inserted into this turn left out, because the creator did not write them`,
    );
  }
  if (folded.attachments > 0) {
    parts.push(
      `${folded.attachments} ${folded.attachments === 1 ? "attachment's" : "attachments'"} text carried under a marker naming the file`,
    );
  }
  if (folded.namedFiles > 0) {
    parts.push(
      `${folded.namedFiles} ${folded.namedFiles === 1 ? "file" : "files"} named only, because the export carries no file contents`,
    );
  }
  if (parts.length === 0) return null;
  return `${parts.join("; ")}.`;
}

// -----------------------------------------------------------------------------
// The parse
// -----------------------------------------------------------------------------

const WARNING = {
  MULTIPLE_CONVERSATIONS: "multiple_conversations",
  THINKING_DROPPED: "thinking_dropped",
  TOOL_CALLS_FOLDED: "tool_calls_folded",
  INJECTED_BLOCKS_DROPPED: "injected_blocks_dropped",
  FILES_NOT_IN_EXPORT: "files_not_in_export",
  NO_MESSAGES: "no_messages",
} as const;

const SOURCE = "claude";

export function parseClaudeExport(
  rawText: string,
  options: ParseOptions,
): ParseResult<DetectedFormat, "claude", "prompt"> {
  const sessionId = options.session_id;
  const sourceHint =
    typeof options.source_hint === "string" && options.source_hint.trim() !== ""
      ? options.source_hint.trim()
      : null;

  const characterCount = rawText.length;
  const lineCount = rawText.replace(/\r\n?/g, "\n").split("\n").length;
  const ref = sourceRefFor(SOURCE, sessionId);

  const empty = (
    format: DetectedFormat,
    warnings: ParseWarning[],
  ): ParseResult<DetectedFormat, "claude", "prompt"> => ({
    events: [],
    nodes: [],
    summary: {
      session_id: sessionId,
      source_hint: sourceHint,
      detected_format: format,
      detected_labels: { user: [], assistant: [] },
      turn_count: 0,
      user_turn_count: 0,
      assistant_turn_count: 0,
      event_count: 0,
      node_count: 0,
      character_count: characterCount,
      line_count: lineCount,
      proposed_title: null,
      proposed_outcome: null,
    },
    warnings,
  });

  const root = parseJson(rawText.trim());
  if (root === null) return empty("unrecognised", []);

  const conversations = readConversations(root);
  if (conversations.length === 0) return empty("unrecognised", []);

  const events: ProposedEvent<"claude", "prompt">[] = [];
  const warnings: ParseWarning[] = [];
  const ordinal = createOrdinalCounter();

  let index = 0;
  let userTurns = 0;
  let assistantTurns = 0;
  let toolCalls = 0;
  let thinkingBlocks = 0;
  let injectedBlocks = 0;
  let namedFiles = 0;

  for (const conversation of conversations) {
    // The conversation's own clock, for a relative stamp to resolve against.
    // Every stamp in the captured export was absolute, so this never fired
    // there — but a reader with no anchor reads a relative stamp as no date,
    // and there is a real anchor here, so it is supplied rather than omitted.
    const anchor = readAnchor(conversation.updated_at);

    for (const message of conversation.messages) {
      index += 1;
      if (message.sender === "human") userTurns += 1;
      else if (message.sender === "assistant") assistantTurns += 1;

      const folded = foldTurn(message);
      toolCalls += folded.toolCalls;
      thinkingBlocks += folded.thinkingBlocks;
      injectedBlocks += folded.injectedBlocks;
      namedFiles += folded.namedFiles;

      const stamp = readTimestamp(message.created_at, anchor);
      const reason = foldReason(folded);

      events.push({
        ordinal: ordinal.next(),
        kind: "prompt",
        visibility: "folded",
        // Rule 3 of the timestamp rules: a clock with no date is dropped
        // rather than anchored to a day the export never named.
        occurred_at: stamp.clockOnly ? null : stamp.iso,
        payload: { text: folded.text, response_summary: null },
        source_ref: ref(index),
        ...mark(reason),
      });
    }
  }

  if (conversations.length > 1) {
    // Selection is the creator's act, on the upload page. This says what
    // arrived so the choice in front of them is not a surprise.
    const spans: string[] = [];
    let seen = 0;
    for (const conversation of conversations) {
      const from = seen + 1;
      seen += conversation.messages.length;
      const title = conversation.name === "" ? "untitled" : conversation.name;
      spans.push(
        conversation.messages.length === 0
          ? `"${title}" (no turns)`
          : `"${title}" (turns ${from}-${seen})`,
      );
    }
    warnings.push({
      code: WARNING.MULTIPLE_CONVERSATIONS,
      message:
        `This file holds ${conversations.length} conversations, and an import is one. ` +
        `Every turn of all ${conversations.length} is proposed, in the order the file records ` +
        `them, so nothing was chosen for you — keep the ones you want and drop the rest: ` +
        `${spans.join("; ")}.`,
    });
  }

  if (events.length === 0) {
    warnings.push({
      code: WARNING.NO_MESSAGES,
      message:
        conversations.length === 1
          ? "The conversation in this file has no messages in it, so there is nothing to propose."
          : `All ${conversations.length} conversations in this file are empty, so there is nothing to propose.`,
    });
    return empty("claude_conversations_export", warnings);
  }

  if (thinkingBlocks > 0) {
    warnings.push({
      code: WARNING.THINKING_DROPPED,
      message:
        `${thinkingBlocks} thinking ${thinkingBlocks === 1 ? "block was" : "blocks were"} left out. ` +
        `This export carries thinking blocks with their text already removed, so there was no ` +
        `reasoning to keep; the short labels beside them are the platform's own summaries, and ` +
        `this connector does not import a summary.`,
    });
  }

  if (toolCalls > 0) {
    warnings.push({
      code: WARNING.TOOL_CALLS_FOLDED,
      message:
        `${toolCalls} tool ${toolCalls === 1 ? "call was" : "calls were"} folded to one line each, ` +
        `naming the tool and whether it failed. Their inputs and results are not carried: they are ` +
        `other systems' output rather than anything either of you said, and they routinely run many ` +
        `times the size of the conversation itself.`,
    });
  }

  if (injectedBlocks > 0) {
    warnings.push({
      code: WARNING.INJECTED_BLOCKS_DROPPED,
      message:
        `${injectedBlocks} ${injectedBlocks === 1 ? "block" : "blocks"} Claude.ai inserted into a ` +
        `turn ${injectedBlocks === 1 ? "was" : "were"} left out. The record is of what you wrote, ` +
        `and nobody typed those.`,
    });
  }

  if (namedFiles > 0) {
    warnings.push({
      code: WARNING.FILES_NOT_IN_EXPORT,
      message:
        `${namedFiles} ${namedFiles === 1 ? "file is" : "files are"} named on their turns but not ` +
        `carried. This export records a file's name and an id, never its contents, and this ` +
        `connector does not reach into Claude.ai to fetch them.`,
    });
  }

  // The first conversation's own name. Read when that is the only conversation
  // in the file; concluded, and marked, when it is one of several.
  const headline = conversations[0].name;
  const proposedTitle: ProposedField<"claude"> | null =
    headline === ""
      ? null
      : {
        value: headline,
        source_ref: ref(1),
        ...mark(
          conversations.length === 1
            ? null
            : `This file held ${conversations.length} conversations and this is the first one's own title, not a title for all of them.`,
        ),
      };

  return {
    events,
    // No nodes. A build's anatomy is not something this reader can read out of
    // a conversation, and guessing at one would be interpreting the content
    // rather than carrying it.
    nodes: [],
    summary: {
      session_id: sessionId,
      source_hint: sourceHint,
      detected_format: "claude_conversations_export",
      // The sender values this format actually uses, as they appear in it.
      detected_labels: { user: ["human"], assistant: ["assistant"] },
      turn_count: events.length,
      user_turn_count: userTurns,
      assistant_turn_count: assistantTurns,
      event_count: events.length,
      node_count: 0,
      character_count: characterCount,
      line_count: lineCount,
      proposed_title: proposedTitle,
      // Nothing in the export states an outcome, and inventing one from the
      // last thing said would be the reader deciding what the build was.
      proposed_outcome: null,
    },
    warnings,
  };
}

// -----------------------------------------------------------------------------
// The reader
// -----------------------------------------------------------------------------

export const claudeReader: IntakeReader<DetectedFormat, "claude", "prompt"> = {
  id: SOURCE,
  label: "Claude.ai conversation export",
  version: READER_VERSION,
  provenance: SCHEMA_PROVENANCE,

  detect(file: IntakeFile): Detection {
    const trimmed = file.text.trim();
    if (trimmed === "") return detection(0, "The file is empty.");
    // Cheap gate before a 400,000 character JSON.parse. Read from the content:
    // the filename is metadata here as it is everywhere in this substrate.
    if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
      return detection(0, "Not JSON. A Claude.ai export is a JSON document.");
    }

    const root = parseJson(trimmed);
    if (root === null) {
      return detection(0, "Opens like JSON but is not JSON, so it is text rather than an export.");
    }

    const conversations = readConversations(root);
    if (conversations.length === 0) {
      return detection(
        NO_MARKER_CONFIDENCE,
        "Valid JSON with no chat_messages array anywhere in it, so it is not a Claude.ai export.",
      );
    }

    const messages = conversations.reduce((total, one) => total + one.messages.length, 0);
    const senders = new Set<string>();
    for (const conversation of conversations) {
      for (const message of conversation.messages) senders.add(message.sender);
    }
    const named = [...senders].filter((sender) => sender !== "").sort();

    return detection(
      SESSION_CONFIDENCE,
      `${conversations.length} ${conversations.length === 1 ? "conversation" : "conversations"} ` +
        `carrying chat_messages, ${messages} ${messages === 1 ? "message" : "messages"}` +
        (named.length > 0 ? ` with sender ${named.join(" / ")}.` : "."),
    );
  },

  parse(
    file: IntakeFile,
    options: ParseOptions,
  ): ReaderResult<DetectedFormat, "claude", "prompt"> {
    const envelope = parseClaudeExport(file.text, options);
    // No source_only case: Claude.ai has no code download that is nearly a
    // conversation export. Nothing read at all is the only way this file was
    // not this reader's to read.
    const outcome = envelope.summary.turn_count === 0
      ? READ_OUTCOME.UNRECOGNISED
      : READ_OUTCOME.SESSION;
    return readerResult(claudeReader, outcome, envelope);
  },
};
