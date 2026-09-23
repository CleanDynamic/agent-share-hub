// =============================================================================
// buildgallery — Claude.ai reader tests (EX-P12)
// =============================================================================
// Run with:
//   deno test --allow-read supabase/functions/_shared/intake/readers/
//
// No Supabase is running and none is needed: this reader is a string in and an
// envelope out. The only permission is --allow-read, for the two fixtures.
//
// THE FIXTURES ARE NOT A TRANSCRIPT. Both keep the shape of a real Claude.ai
// account export — its keys, its block types, the order they appear in, the
// alternation of speakers, the turn count — and every word of content in them
// is invented. See fixtures/README.md.
//
// The two fixtures cover the split the reader has to get right: one
// conversation that exercises every block type it folds, and a file holding
// two conversations, which is what an import can never be.
// =============================================================================

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@^1.0.0";

import {
  claudeReader,
  parseClaudeExport,
  READER_VERSION,
  SCHEMA_PROVENANCE,
} from "./claude.ts";
import { INTAKE_READERS, intakeRegistry } from "./index.ts";
import { intakeFile } from "../reader.ts";

const SESSION = "11111111-2222-4333-8444-555555555555";

const fixture = (name: string): string =>
  Deno.readTextFileSync(new URL(`./fixtures/${name}`, import.meta.url));

const ONE = fixture("claude-one-conversation.json");
const TWO = fixture("claude-two-conversations.json");

const read = (raw: string) => parseClaudeExport(raw, { session_id: SESSION });

/** A transcript, for the "does not claim what is not its" assertions. */
const TRANSCRIPT = "You said:\nHow do I resize a photo?\n\nChatGPT said:\nUse sips on macOS.";

// -----------------------------------------------------------------------------
// Detection
// -----------------------------------------------------------------------------

Deno.test("EX-P12: detect reads the content and says what it saw, not what it decided", () => {
  // Named as a text file, because detection never reads the filename.
  const seen = claudeReader.detect(intakeFile(ONE, "not-an-export.txt"));

  assertEquals(seen.confidence, 0.98);
  assertStringIncludes(seen.reason, "1 conversation carrying chat_messages");
  assertStringIncludes(seen.reason, "8 messages");
  assertStringIncludes(seen.reason, "4 from human and 4 from assistant");

  // And the same file under the name of something else entirely.
  assertEquals(claudeReader.detect(intakeFile(ONE, "recipes.zip")).confidence, 0.98);
  assertEquals(claudeReader.detect(intakeFile(ONE, null)).confidence, 0.98);
});

Deno.test("EX-P12: detect counts every conversation in a multi-conversation file", () => {
  const seen = claudeReader.detect(intakeFile(TWO));
  assertEquals(seen.confidence, 0.98);
  assertStringIncludes(seen.reason, "2 conversations carrying chat_messages");
  assertStringIncludes(seen.reason, "4 messages");
});

Deno.test("EX-P12: detect refuses what is not this reader's, with a reason rather than a throw", () => {
  assertEquals(claudeReader.detect(intakeFile("")).confidence, 0);
  assertStringIncludes(claudeReader.detect(intakeFile("   ")).reason, "empty");

  // A transcript saved under an export's name is still a transcript.
  const text = claudeReader.detect(intakeFile(TRANSCRIPT, "conversations.json"));
  assertEquals(text.confidence, 0);
  assertStringIncludes(text.reason, "Not JSON");

  const broken = claudeReader.detect(intakeFile('{"chat_messages": [', "conversations.json"));
  assertEquals(broken.confidence, 0);
  assertStringIncludes(broken.reason, "Opens like JSON but is not JSON");
});

Deno.test("EX-P12: unmarked JSON bids BELOW the deliberate lovable/transcript tie", () => {
  // That 0.15 tie is how the substrate says "undecidable" between those two.
  // A JSON document with no chat_messages is not undecidable here — it is
  // definitely not a Claude.ai export — so this reader stays out of the tie
  // rather than becoming the runner-up in someone else's uncertainty reason.
  const json = JSON.stringify({ notes: ["a thought", "another"], version: 2 });
  const bid = claudeReader.detect(intakeFile(json));

  assertEquals(bid.confidence, 0.1);
  assert(bid.confidence > 0, "low, not zero — the registry asks a last resort to bid low");
  assertStringIncludes(bid.reason, "no chat_messages array");

  const bids = intakeRegistry().detect(intakeFile(json));
  assertEquals(bids[0].reader.id, "lovable");
  assertEquals(bids[1].reader.id, "transcript");
  assertEquals(bids[0].detection.confidence, bids[1].detection.confidence);
  assertEquals(bids[2].reader.id, "claude");
  assert(
    bids[2].detection.confidence < bids[1].detection.confidence,
    "claude must not displace either half of the tie",
  );
});

// -----------------------------------------------------------------------------
// The turn count, and the first and last ordinal's text
// -----------------------------------------------------------------------------

Deno.test("EX-P12: the fixture reads as eight turns, one event each", () => {
  const { events, summary } = read(ONE);

  assertEquals(summary.turn_count, 8);
  assertEquals(events.length, 8);
  assertEquals(summary.event_count, 8);
  assertEquals(summary.user_turn_count, 4);
  assertEquals(summary.assistant_turn_count, 4);
  assertEquals(summary.detected_format, "claude_conversations_export");
  assertEquals(summary.detected_labels, { user: ["human"], assistant: ["assistant"] });
});

Deno.test("EX-P12: the first ordinal carries the first turn's text, its attachment and its file names", () => {
  const first = read(ONE).events[0];

  assertEquals(first.ordinal, 1);
  assertEquals(first.source_ref, { source: "claude", session_id: SESSION, index: 1 });
  assert(
    first.payload.text.startsWith("this is the little recipe scaler ive been poking at."),
    first.payload.text.slice(0, 80),
  );
  // The attachment's text, under a marker naming the file it came from.
  assertStringIncludes(first.payload.text, "[attachment: scaler-notes.md]");
  assertStringIncludes(
    first.payload.text,
    "Known gap: no idea yet what to do about a recipe that names a tin size.",
  );
  // files[] carries a name and no bytes, so the names are all that is recorded.
  // The one with no name is labelled rather than dropped or invented.
  assertStringIncludes(first.payload.text, "[files on this turn: wrong-thirds.png, unnamed file]");
});

Deno.test("EX-P12: the last ordinal carries the last turn's text with its code block intact", () => {
  const events = read(ONE).events;
  const last = events[events.length - 1];

  assertEquals(last.ordinal, 8);
  assertEquals(last.source_ref.index, 8);
  assert(
    last.payload.text.startsWith("Paste this under Scaling rules:"),
    last.payload.text.slice(0, 80),
  );
  assert(
    last.payload.text.endsWith("The last line is the one that matters: refusing is a result, not a failure."),
    last.payload.text.slice(-90),
  );

  // The fence survives whole: both markers, and the lines between them
  // unreflowed, indentation and comment included.
  assertEquals(last.payload.text.split("```").length - 1, 2, "opening and closing fence");
  assertStringIncludes(last.payload.text, "scale(recipe, from, to):");
  assertStringIncludes(last.payload.text, "    if ingredient.counts_whole:      # eggs, tins, sheets");
  assertStringIncludes(last.payload.text, "  never scale: baking time, tin size, oven temperature");
});

// -----------------------------------------------------------------------------
// Ordinals, indexes and timestamps
// -----------------------------------------------------------------------------

Deno.test("EX-P12: ordinals are dense and ascending, and source_ref.index counts across both speakers", () => {
  const { events } = read(ONE);

  assertEquals(events.map((event) => event.ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
  assertEquals(events.map((event) => event.source_ref.index), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const event of events) {
    assertEquals(event.kind, "prompt");
    assertEquals(event.visibility, "folded");
    assertEquals(event.payload.response_summary, null);
    assertEquals(event.source_ref.source, "claude");
    assertEquals(event.source_ref.session_id, SESSION);
  }
});

Deno.test("EX-P12: an absolute created_at is read as it stands, never inferred", () => {
  const { events } = read(ONE);

  assertEquals(events[0].occurred_at, "2026-05-04T09:02:11.100Z");
  assertEquals(events[7].occurred_at, "2026-05-04T09:33:52.800Z");
  // Ascending, and every one of them read rather than resolved.
  const stamps = events.map((event) => event.occurred_at);
  assert(stamps.every((stamp) => typeof stamp === "string"), "every turn carries a date");
  assertEquals([...stamps].sort(), stamps, "in the order the export records them");
});

// -----------------------------------------------------------------------------
// The five mapping decisions
// -----------------------------------------------------------------------------

Deno.test("EX-P12: tool calls fold to one line each and no tool payload reaches the envelope", () => {
  const envelope = read(ONE);
  const second = envelope.events[1];

  assertStringIncludes(second.payload.text, "[ran view]");
  assertStringIncludes(second.payload.text, "[ran bash_tool — it returned an error]");
  // Folded where the call ran, not collected into a block at the end.
  assert(
    second.payload.text.indexOf("[ran view]") < second.payload.text.indexOf("[ran bash_tool"),
    "tool lines keep the order the calls ran in",
  );

  // Not one byte of any tool's input or result, anywhere in the envelope. These
  // are other systems' output, and a tool_result is the largest untrusted
  // surface in the file.
  const serialised = JSON.stringify(envelope);
  for (
    const payload of [
      "node scale.js",
      "cannot read property",
      "3 cases, 3 failures",
      "8in round",
      "0.5625 cup",
    ]
  ) {
    assert(!serialised.includes(payload), `tool payload leaked: ${payload}`);
  }

  const warning = envelope.warnings.find((one) => one.code === "tool_calls_folded");
  assert(warning, "the folding is counted where the creator can see it");
  assertStringIncludes(warning.message, "6 tool calls were folded");
});

Deno.test("EX-P12: thinking is left out because the export carries none, and its summaries stay out too", () => {
  const envelope = read(ONE);
  const serialised = JSON.stringify(envelope);

  // The platform's own summary labels are a summary, and this connector does
  // not import a summary.
  for (
    const summary of [
      "Reading the notes before answering.",
      "Working through the three failing cases.",
      "Drafting the readme rule.",
    ]
  ) {
    assert(!serialised.includes(summary), `a thinking summary leaked: ${summary}`);
  }

  const warning = envelope.warnings.find((one) => one.code === "thinking_dropped");
  assert(warning, "the drop is counted rather than silent");
  assertStringIncludes(warning.message, "5 thinking blocks were left out");
  assertStringIncludes(warning.message, "text already removed");
});

Deno.test("EX-P12: a turn the reader folded says so, and a turn of plain prose does not", () => {
  const { events } = read(ONE);

  // Turn 1: an attachment carried and two files named.
  assertEquals(events[0].inferred, true);
  assertStringIncludes(events[0].inferred_reason ?? "", "attachment's text carried under a marker");
  assertStringIncludes(events[0].inferred_reason ?? "", "2 files named only");

  // Turn 2: tool calls folded and thinking dropped.
  assertEquals(events[1].inferred, true);
  assertStringIncludes(events[1].inferred_reason ?? "", "2 tool calls folded to one line each");
  assertStringIncludes(events[1].inferred_reason ?? "", "2 thinking blocks left out");

  // Turn 5: one text block and nothing else. Read, so not marked.
  assertEquals(events[4].inferred, false);
  assertEquals(events[4].inferred_reason, null);
  assertStringIncludes(events[4].payload.text, "do the tin one properly");
});

Deno.test("EX-P12: files are named and never fetched, and the export's own title is read when there is one conversation", () => {
  const envelope = read(ONE);

  const warning = envelope.warnings.find((one) => one.code === "files_not_in_export");
  assert(warning, "a file with no contents in the export is said out loud");
  assertStringIncludes(warning.message, "5 files are named on their turns but not carried");
  assertStringIncludes(warning.message, "does not reach into Claude.ai");

  // No uuid from files[] is anywhere in the envelope: nothing to dereference.
  const serialised = JSON.stringify(envelope);
  for (const uuid of ["f1-fixture", "f3-fixture", "f5-fixture"]) {
    assert(!serialised.includes(uuid), `a file uuid leaked: ${uuid}`);
  }

  // One conversation, so its own name is read rather than chosen.
  assertEquals(envelope.summary.proposed_title?.value, "Recipe scaler rounding problems");
  assertEquals(envelope.summary.proposed_title?.inferred, false);
  assertEquals(envelope.summary.proposed_title?.inferred_reason, null);
  assertEquals(envelope.summary.proposed_outcome, null);
  // A build's anatomy is not something a conversation states.
  assertEquals(envelope.nodes, []);
  assertEquals(envelope.summary.node_count, 0);
});

// -----------------------------------------------------------------------------
// Several conversations in one file
// -----------------------------------------------------------------------------

Deno.test("EX-P12: a file of two conversations parses into ONE envelope, and the warning says so", () => {
  const envelope = read(TWO);

  // One envelope, every turn of both, in the order the file records them.
  assertEquals(envelope.summary.turn_count, 4);
  assertEquals(envelope.events.length, 4);
  assertEquals(envelope.events.map((event) => event.ordinal), [1, 2, 3, 4]);
  // The index runs across the whole file, not per conversation: it has to be
  // unique within one proposal.
  assertEquals(envelope.events.map((event) => event.source_ref.index), [1, 2, 3, 4]);

  // The boundary is real — turns 1-2 are one conversation, 3-4 the other.
  assertStringIncludes(envelope.events[0].payload.text, "second prove");
  assertStringIncludes(envelope.events[2].payload.text, "lowest gear");

  const warning = envelope.warnings.find((one) => one.code === "multiple_conversations");
  assert(warning, "the creator is told what arrived");
  assertStringIncludes(warning.message, "This file holds 2 conversations, and an import is one.");
  assertStringIncludes(warning.message, "nothing was chosen for you");
  assertStringIncludes(warning.message, '"Sourdough timings" (turns 1-2)');
  assertStringIncludes(warning.message, '"Bike gear ratios" (turns 3-4)');
});

Deno.test("EX-P12: with several conversations the proposed title is the first one's, and is marked as such", () => {
  const title = read(TWO).summary.proposed_title;

  assertEquals(title?.value, "Sourdough timings");
  assertEquals(title?.inferred, true);
  assertStringIncludes(title?.inferred_reason ?? "", "held 2 conversations");
  assertStringIncludes(title?.inferred_reason ?? "", "not a title for all of them");

  // One conversation in the same reader is not marked, so the mark means
  // something.
  assertEquals(read(ONE).summary.proposed_title?.inferred, false);
});

Deno.test("EX-P12: an injected prompt block is left out of the turn and the turn says why", () => {
  const envelope = read(TWO);
  const first = envelope.events[0];

  // Claude.ai wrote it, not the person whose turn it sits in.
  assert(
    !first.payload.text.includes("The current date is"),
    `an injected block reached the record: ${first.payload.text}`,
  );
  assert(!JSON.stringify(envelope).includes("The current date is"), "nor anywhere else");
  assertEquals(first.payload.text, "how long should the second prove be in a cold kitchen");

  assertEquals(first.inferred, true);
  assertStringIncludes(first.inferred_reason ?? "", "Claude.ai inserted into this turn left out");
  assertStringIncludes(first.inferred_reason ?? "", "the creator did not write them");

  const warning = envelope.warnings.find((one) => one.code === "injected_blocks_dropped");
  assert(warning, "counted where the creator can see it");
  assertStringIncludes(warning.message, "The record is of what you wrote");
});

// -----------------------------------------------------------------------------
// The reader's own tags, and its registration
// -----------------------------------------------------------------------------

Deno.test("EX-P12: the reader stamps its version and provenance on every parse", () => {
  const result = claudeReader.parse(intakeFile(ONE, "conversations.json"), { session_id: SESSION });

  assertEquals(result.outcome, "session");
  assertEquals(result.reader.id, "claude");
  assertEquals(result.reader.label, "Claude.ai conversation export");
  assertEquals(result.reader.version, READER_VERSION);
  assertEquals(result.reader.provenance, SCHEMA_PROVENANCE);

  // Provenance is a claim about where the schema was read, so it has to be one
  // that is true: read from a captured export, with no identifier to pin.
  assertEquals(SCHEMA_PROVENANCE.length, 1);
  assertEquals(SCHEMA_PROVENANCE[0].format, "claude_conversations_export");
  assertEquals(SCHEMA_PROVENANCE[0].identifier, null);
  assertEquals(SCHEMA_PROVENANCE[0].read_on, "2026-09-21");
  assertStringIncludes(SCHEMA_PROVENANCE[0].source, "conversations.json");
});

Deno.test("EX-P12: nothing read at all is unrecognised, and is never called source_only", () => {
  // There is no Claude.ai code download that is nearly a conversation export,
  // so this reader has no source_only case to claim.
  const empty = claudeReader.parse(intakeFile("[]"), { session_id: SESSION });
  assertEquals(empty.outcome, "unrecognised");
  assertEquals(empty.envelope.summary.turn_count, 0);
  assertEquals(empty.envelope.summary.detected_format, "unrecognised");

  const notJson = claudeReader.parse(intakeFile(TRANSCRIPT), { session_id: SESSION });
  assertEquals(notJson.outcome, "unrecognised");
  assertEquals(notJson.envelope.events, []);
  // Even refusing, the envelope is an envelope: it never throws on a wrong file.
  assertEquals(notJson.envelope.summary.session_id, SESSION);
  assertEquals(notJson.envelope.summary.character_count, TRANSCRIPT.length);
});

Deno.test("EX-P12: registered before the fallback, and the registry routes an export to it", () => {
  const ids = INTAKE_READERS.map((reader) => reader.id);

  assertEquals(ids, ["lovable", "claude", "transcript"]);
  assert(
    ids.indexOf("claude") < ids.indexOf("transcript"),
    "a reader with a schema comes before the fallback",
  );
  assertEquals(ids[ids.length - 1], "transcript", "the fallback is still found by position");

  const registry = intakeRegistry();
  const routed = registry.route(intakeFile(ONE, "whatever.bin"));
  assertEquals(routed?.reader.id, "claude");

  // And the fallback still wins what is actually text.
  assertEquals(registry.route(intakeFile(TRANSCRIPT))?.reader.id, "transcript");
});

Deno.test("EX-P12: an export is routed here even though the Lovable reader also claims it", () => {
  // THE COLLISION THIS BID EXISTS FOR. parse-lovable's detect reads a top-level
  // JSON array as its message list and calls it a trajectory when the objects
  // in it carry created_at. Every conversation in a Claude.ai export does, so
  // Lovable bids 0.95 on one and would win the tie on registration order,
  // reading a whole conversation as a single message.
  const bids = intakeRegistry().detect(intakeFile(ONE));
  const lovable = bids.find((bid) => bid.reader.id === "lovable");
  const claude = bids.find((bid) => bid.reader.id === "claude");

  assertEquals(lovable?.detection.confidence, 0.95, "the collision is real, not hypothetical");
  assertEquals(claude?.detection.confidence, 0.98);
  assertEquals(bids[0].reader.id, "claude", "the named schema outbids the structural guess");

  // And the bid is targeted: a Lovable shape is still Lovable's. Nothing this
  // reader does raises a claim on a file carrying no chat_messages.
  const trajectory = JSON.stringify([
    { id: "1", role: "user", content: "add a login page", createdAt: "2026-05-01T10:00:00Z" },
    { id: "2", role: "assistant", content: "done", createdAt: "2026-05-01T10:01:00Z", patch: "diff" },
  ]);
  const onTrajectory = intakeRegistry().detect(intakeFile(trajectory));
  assertEquals(onTrajectory[0].reader.id, "lovable");
  assertEquals(
    onTrajectory.find((bid) => bid.reader.id === "claude")?.detection.confidence,
    0.1,
    "a genuine Lovable export is not claimed by this reader",
  );
});

Deno.test("EX-P12: the whole envelope is JSON, field for field, as the proposal column stores it", () => {
  const envelope = read(ONE);
  const round = JSON.parse(JSON.stringify(envelope));

  assertEquals(round, envelope, "nothing in here fails to survive a round trip");
  // The two keys every proposed item ends with, in the position they have
  // always occupied.
  const keys = Object.keys(round.events[0]);
  assertEquals(keys[keys.length - 2], "inferred");
  assertEquals(keys[keys.length - 1], "inferred_reason");
});
