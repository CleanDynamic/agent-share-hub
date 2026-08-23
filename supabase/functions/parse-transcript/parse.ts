// =============================================================================
// NeoScale — transcript intake parser (NS-P13)
// =============================================================================
// Pure, dependency-free splitting and extraction. No network, no database, no
// Deno APIs — index.ts owns the HTTP shell, the auth check and the ownership
// check, this file owns the reading. Keeping it pure is what makes it testable
// and what will let the next parser (NS-P15 and after) borrow from it.
//
// THE TWO RULES, from the handover, applying to every parser in this sequence:
//
//   1. Every proposed item carries source_ref recording where it came from.
//   2. Anything inferred rather than read carries inferred: true and a short
//      reason string.
//
// Read verbatim from the transcript => inferred: false, inferred_reason: null.
// Guessed, matched by heuristic, or assembled from scattered mentions =>
// inferred: true and a reason a creator can read and disagree with. Auto
// extraction is only trustworthy when it admits what it guessed.
//
// A NOTE ON TURN NUMBERING. Turns are numbered across BOTH speakers from 1, so
// a clean 20-exchange transcript has 40 turns: user turns 1, 3, 5 ... and
// assistant turns 2, 4, 6 ... source_ref.index is always that turn ordinal.
// Event ordinals are separate: they run 1..N over the USER turns only, because
// one build_event is emitted per user turn. So the twentieth event has
// ordinal 20 and source_ref.index 39.
//
// This module writes nothing and proposes everything.
// =============================================================================

export const MAX_RAW_TEXT_CHARS = 400_000;
export const DETECTION_WINDOW_LINES = 40;
export const RESPONSE_SUMMARY_CHARS = 240;
export const MAX_RESULT_CANDIDATES = 3;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type TurnRole = "user" | "assistant";

export type DetectedFormat =
  | "labelled_colon"
  | "markdown_bold"
  | "markdown_heading"
  | "blank_line_alternating"
  | "unstructured";

/** {source, session_id, index} — the shape build_nodes.source_ref already holds. */
export interface SourceRef {
  source: "transcript";
  session_id: string;
  /** Turn ordinal, counted across both speakers from 1. */
  index: number;
}

export interface Turn {
  /** 1-based, across both speakers. */
  ordinal: number;
  role: TurnRole;
  /** The speaker label as written, or null where the split was positional. */
  label: string | null;
  text: string;
  occurred_at: string | null;
  /** 1-based line in the raw text where this turn's content starts. */
  line: number;
}

export interface ProposedEvent {
  /** 1..N over user turns. Maps to build_events.ordinal. */
  ordinal: number;
  kind: "prompt";
  visibility: "folded";
  occurred_at: string | null;
  payload: { text: string; response_summary: string | null };
  source_ref: SourceRef;
  inferred: boolean;
  inferred_reason: string | null;
}

export interface ProposedNode {
  /** Local handle only. The client maps it to a uuid on materialisation. */
  local_id: string;
  /** A node_types.key. Never a value absent from the registry. */
  type: string;
  title: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  source_ref: SourceRef;
  inferred: boolean;
  inferred_reason: string | null;
}

/** A proposed builds column value — title and outcome are not nodes. */
export interface ProposedField {
  value: string;
  source_ref: SourceRef;
  inferred: boolean;
  inferred_reason: string | null;
}

export interface ParseWarning {
  code: string;
  message: string;
}

export interface ParseSummary {
  session_id: string;
  source_hint: string | null;
  detected_format: DetectedFormat;
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

export interface ParseResult {
  events: ProposedEvent[];
  nodes: ProposedNode[];
  summary: ParseSummary;
  warnings: ParseWarning[];
}

export interface ParseOptions {
  /** Identifies this paste. Recorded in every source_ref. */
  session_id: string;
  source_hint?: string | null;
}

// -----------------------------------------------------------------------------
// Speaker vocabulary
// -----------------------------------------------------------------------------
// Two tiers. Strong labels are speaker names and nothing else, so a line that
// opens with one is a turn boundary. Weak labels are words that lead ordinary
// prose just as often as they lead a turn ("Prompt:", "Output:"), so they are
// only consulted when no strong label appears in the detection window AND both
// sides of the conversation are represented. Without that gate, a document
// containing one stray "Response:" would be split into nonsense.

const STRONG_USER_LABELS = ["you", "user", "human", "me", "operator", "developer"];
const STRONG_ASSISTANT_LABELS = [
  "assistant", "chatgpt", "claude", "gpt", "openai", "anthropic", "ai", "bot",
  "copilot", "gemini", "bard", "llama", "mistral", "grok", "deepseek",
  "perplexity", "cursor", "codex", "agent",
];

const WEAK_USER_LABELS = ["prompt", "question", "q", "input", "request", "ask"];
const WEAK_ASSISTANT_LABELS = ["response", "answer", "a", "output", "reply", "model", "completion"];

// -----------------------------------------------------------------------------
// Small shared helpers
// -----------------------------------------------------------------------------

function normaliseNewlines(raw: string): string {
  return raw.replace(/\r\n?/g, "\n");
}

/** Drops leading and trailing blank lines without touching internal indentation. */
function trimBlock(raw: string): string {
  const lines = raw.split("\n");
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start++;
  while (end > start && lines[end - 1].trim() === "") end--;
  return lines.slice(start, end).join("\n");
}

/** Cuts at a word boundary where one is close enough. Used for titles, never for the 240. */
function excerpt(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.\-]+$/, "");
}

/** Strips the markdown a label or heading carries, for display and matching. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/, "")
    .replace(/[*_`~]/g, "")
    .replace(/^\s*[-+*]\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normaliseLabel(raw: string): string {
  return stripMarkdown(raw)
    .replace(/^[[({<]+/, "")
    .replace(/[\])}>]+$/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.,;:!?\-–—]+$/, "")
    .trim()
    .toLowerCase();
}

/**
 * Exact match, or the vocabulary word followed by a version-ish continuation:
 * "gpt-4o", "claude 3.5 sonnet", "chatgpt said", "user 2".
 */
function vocabularyMatch(label: string, vocabulary: string[]): boolean {
  for (const word of vocabulary) {
    if (label === word) return true;
    if (label.startsWith(word) && /^[\s\-–—.0-9]/.test(label.slice(word.length))) return true;
  }
  return false;
}

function roleForLabel(raw: string, allowWeak: boolean): TurnRole | null {
  const label = normaliseLabel(raw);
  if (!label || label.length > 32) return null;
  const users = allowWeak ? [...STRONG_USER_LABELS, ...WEAK_USER_LABELS] : STRONG_USER_LABELS;
  const assistants = allowWeak
    ? [...STRONG_ASSISTANT_LABELS, ...WEAK_ASSISTANT_LABELS]
    : STRONG_ASSISTANT_LABELS;
  if (vocabularyMatch(label, users)) return "user";
  if (vocabularyMatch(label, assistants)) return "assistant";
  return null;
}

// -----------------------------------------------------------------------------
// Timestamps
// -----------------------------------------------------------------------------
// build_events.occurred_at is timestamptz, so only a date-bearing timestamp can
// be emitted. A bare clock time ("2:31 PM") names no day and is dropped rather
// than anchored to a day we invented — but it is warned about once, so the
// creator knows the transcript carried times the parser could not use.

const ISO_TIMESTAMP = /\b(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?)\s?(Z|[+-]\d{2}:?\d{2})?)?\b/;
const CLOCK_ONLY = /\b\d{1,2}:\d{2}(?::\d{2})?\s?(?:[ap]\.?m\.?)?\b/i;

function findTimestamp(text: string): string | null {
  const match = text.match(ISO_TIMESTAMP);
  if (!match) return null;
  const [, date, time, zoneRaw] = match;
  const clock = time ? (time.length === 5 ? `${time}:00` : time) : "00:00:00";
  let zone = "Z";
  if (zoneRaw && zoneRaw !== "Z") {
    zone = zoneRaw.length === 5 ? `${zoneRaw.slice(0, 3)}:${zoneRaw.slice(3)}` : zoneRaw;
  }
  const parsed = new Date(`${date}T${clock}${zone}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function hasClockOnly(text: string): boolean {
  return !ISO_TIMESTAMP.test(text) && CLOCK_ONLY.test(text);
}

// -----------------------------------------------------------------------------
// Fenced code
// -----------------------------------------------------------------------------

/**
 * True for every line that sits inside a fenced block, delimiters included.
 * Label matching and blank-line splitting both consult this: a yaml block
 * containing "model: gpt-4o" is not a speaker turn, and a blank line inside a
 * code sample is not a paragraph break.
 */
function fenceMask(lines: string[]): boolean[] {
  const mask: boolean[] = [];
  let open: string | null = null;
  for (const line of lines) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (open === null) {
      if (fence) {
        open = fence[1][0];
        mask.push(true);
      } else {
        mask.push(false);
      }
    } else {
      mask.push(true);
      if (fence && fence[1][0] === open && fence[2].trim() === "") open = null;
    }
  }
  return mask;
}

interface FenceBlock {
  info: string;
  source: string;
}

function extractFences(text: string): { blocks: FenceBlock[]; unterminated: boolean } {
  const lines = text.split("\n");
  const blocks: FenceBlock[] = [];
  let open: string | null = null;
  let info = "";
  let buffer: string[] = [];
  let unterminated = false;

  for (const line of lines) {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (open === null) {
      if (fence) {
        open = fence[1][0];
        info = fence[2].trim();
        buffer = [];
      }
      continue;
    }
    if (fence && fence[1][0] === open && fence[2].trim() === "") {
      blocks.push({ info, source: buffer.join("\n") });
      open = null;
      continue;
    }
    buffer.push(line);
  }

  if (open !== null) {
    unterminated = true;
    if (buffer.join("").trim() !== "") blocks.push({ info, source: buffer.join("\n") });
  }
  return { blocks, unterminated };
}

// -----------------------------------------------------------------------------
// Speaker label matching
// -----------------------------------------------------------------------------

type LabelStyle = "colon" | "bold" | "heading";

interface LabelHit {
  role: TurnRole;
  style: LabelStyle;
  label: string;
  /** Whatever followed the label on the same line. */
  inline: string;
  occurred_at: string | null;
}

const MAX_LABEL_CHARS = 48;

const STYLE_TO_FORMAT: Record<LabelStyle, DetectedFormat> = {
  colon: "labelled_colon",
  bold: "markdown_bold",
  heading: "markdown_heading",
};

/** The label as a person would name it: no decoration, no parenthetical timestamp. */
function displayLabel(raw: string): string {
  return stripMarkdown(raw)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // A trailing time or date is decoration on the label, not part of the
    // speaker's name — but only a real clock or ISO date is stripped, so
    // "GPT-4" and "Claude 3.5 Sonnet" keep their versions.
    .replace(/[\s\-–—·|,]+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?$/i, "")
    .replace(/[\s\-–—·|,]+\d{1,2}\s*[ap]\.?m\.?$/i, "")
    .replace(/[\s\-–—·|,]+\d{4}-\d{2}-\d{2}(?:[T ][\d:]+(?:Z|[+-][\d:]+)?)?$/i, "")
    .trim()
    .replace(/[.,;:!?\-–—]+$/, "")
    .trim();
}

/**
 * Removes what follows a bold or heading label but still belongs to it: the
 * separating colon, and a bracketed timestamp such as "**Human** (2026-08-23
 * 09:14):". The bracket is only eaten when it contains a digit, so a genuine
 * aside — "**Claude**: (see the note below) ..." — stays in the turn.
 */
function stripLabelDecoration(rest: string): string {
  const decoration = rest.match(/^[\s:：\-–—]*(?:[([][^)\]]*\d[^)\]]*[)\]])?[\s:：\-–—]*/);
  return decoration ? rest.slice(decoration[0].length) : rest;
}

/**
 * Splits "Claude (2026-08-23 10:22): text" into its label and its content.
 * The head can itself contain a colon — a timestamp puts one there — so every
 * colon within reach is tried and the longest head the vocabulary recognises
 * wins. Stopping at the first colon would cut the label at "10" and hand the
 * turn a body beginning "22): ".
 */
function findLabelSplit(
  body: string,
  allowWeak: boolean,
): { head: string; rest: string; role: TurnRole } | null {
  let found: { head: string; rest: string; role: TurnRole } | null = null;
  for (let i = 0; i < body.length && i <= MAX_LABEL_CHARS; i++) {
    if (body[i] !== ":" && body[i] !== "：") continue;
    const head = body.slice(0, i);
    const role = roleForLabel(head, allowWeak);
    if (role) found = { head, rest: body.slice(i + 1).replace(/^\s+/, ""), role };
  }
  return found;
}

function matchLabelLine(rawLine: string, allowWeak: boolean): LabelHit | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  // A quoted transcript is still a transcript, so "> You:" opens a turn.
  let body = trimmed.replace(/^>+\s?/, "").trim();
  if (!body) return null;

  // A list item is not a speaker, though. "- User: postgres" in a config
  // listing is far commoner than a transcript that bullets its turns, and
  // reading it as a turn would cut an assistant's answer in half.
  if (/^(?:[-+*]|\d{1,3}[.)])\s/.test(body)) return null;

  let style: LabelStyle = "colon";

  const heading = body.match(/^#{1,6}\s+(.*)$/);
  if (heading) {
    body = heading[1].trim();
    style = "heading";
  }

  // "**You**", "**You:**", "__ChatGPT__:", "*Human*:"
  const bold = body.match(/^(\*\*|__|\*|_)([^*_\n]{1,40})\1\s*(.*)$/);
  if (bold) {
    const role = roleForLabel(bold[2], allowWeak);
    if (!role) return null;
    return {
      role,
      style: style === "heading" ? "heading" : "bold",
      label: displayLabel(bold[2]),
      inline: stripLabelDecoration(bold[3]),
      occurred_at: findTimestamp(`${bold[2]} ${bold[3].slice(0, 60)}`),
    };
  }

  // "You:", "ChatGPT said:", "Claude (2026-08-23 10:22):"
  const split = findLabelSplit(body, allowWeak);
  if (split) {
    return {
      role: split.role,
      style,
      label: displayLabel(split.head),
      inline: split.rest,
      occurred_at: findTimestamp(split.head),
    };
  }

  // A heading needs no colon: "## You"
  if (style === "heading") {
    const role = roleForLabel(body, allowWeak);
    if (role) {
      return {
        role,
        style: "heading",
        label: displayLabel(body),
        inline: "",
        occurred_at: findTimestamp(body),
      };
    }
  }

  return null;
}

interface ScannedHit {
  index: number;
  hit: LabelHit;
}

function scanLabels(lines: string[], mask: boolean[], allowWeak: boolean): ScannedHit[] {
  const hits: ScannedHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (mask[i]) continue;
    const hit = matchLabelLine(lines[i], allowWeak);
    if (hit) hits.push({ index: i, hit });
  }
  return hits;
}

// -----------------------------------------------------------------------------
// Splitting
// -----------------------------------------------------------------------------

function splitLabelled(lines: string[], hits: ScannedHit[]): Turn[] {
  const turns: Turn[] = [];
  hits.forEach((entry, position) => {
    const start = entry.index + 1;
    const end = position + 1 < hits.length ? hits[position + 1].index : lines.length;
    const body = lines.slice(start, end);
    const text = trimBlock([entry.hit.inline, ...body].join("\n"));
    turns.push({
      ordinal: turns.length + 1,
      role: entry.hit.role,
      label: entry.hit.label,
      text,
      occurred_at: entry.hit.occurred_at,
      line: entry.index + 1,
    });
  });
  return turns.filter((turn) => turn.text !== "").map((turn, i) => ({ ...turn, ordinal: i + 1 }));
}

/**
 * Bare alternating paragraphs. Only accepted when the blocks look like turns
 * rather than like the lines of a poem: the brief says never guess a split that
 * produces one-line turns, so a majority of blocks must be multi-line or at
 * least 80 characters before this convention is believed.
 */
function splitAlternating(lines: string[], mask: boolean[]): Turn[] | null {
  const blocks: { start: number; lines: string[] }[] = [];
  let current: string[] = [];
  let start = 0;

  lines.forEach((line, i) => {
    const isBreak = line.trim() === "" && !mask[i];
    if (isBreak) {
      if (current.length) blocks.push({ start, lines: current });
      current = [];
      return;
    }
    if (!current.length) start = i;
    current.push(line);
  });
  if (current.length) blocks.push({ start, lines: current });

  // A block that opens inside a fence is the previous speaker still talking:
  // nobody's turn is a bare code sample. Without this, the blank line most
  // people leave above a fence would hand the code its own turn and flip every
  // speaker after it.
  const joined: { start: number; lines: string[] }[] = [];
  for (const block of blocks) {
    if (joined.length > 0 && mask[block.start]) {
      joined[joined.length - 1].lines.push("", ...block.lines);
      continue;
    }
    joined.push(block);
  }
  blocks.length = 0;
  blocks.push(...joined);

  if (blocks.length < 2) return null;

  const substantial = blocks.filter((block) => {
    const text = block.lines.join("\n").trim();
    return block.lines.length >= 2 || text.length >= 80;
  }).length;
  if (substantial / blocks.length < 0.5) return null;

  return blocks.map((block, i) => ({
    ordinal: i + 1,
    role: (i % 2 === 0 ? "user" : "assistant") as TurnRole,
    label: null,
    text: trimBlock(block.lines.join("\n")),
    occurred_at: findTimestamp(block.lines[0] ?? ""),
    line: block.start + 1,
  }));
}

interface SplitOutcome {
  turns: Turn[];
  format: DetectedFormat;
  labels: { user: string[]; assistant: string[] };
  warnings: ParseWarning[];
}

function dominantFormat(hits: ScannedHit[]): DetectedFormat {
  const counts: Record<LabelStyle, number> = { colon: 0, bold: 0, heading: 0 };
  for (const entry of hits) counts[entry.hit.style]++;
  let best: LabelStyle = "colon";
  for (const style of ["colon", "bold", "heading"] as LabelStyle[]) {
    if (counts[style] > counts[best]) best = style;
  }
  return STYLE_TO_FORMAT[best];
}

function collectLabels(turns: Turn[]): { user: string[]; assistant: string[] } {
  const user = new Set<string>();
  const assistant = new Set<string>();
  for (const turn of turns) {
    if (!turn.label) continue;
    (turn.role === "user" ? user : assistant).add(turn.label);
  }
  return { user: [...user], assistant: [...assistant] };
}

/**
 * The convention is chosen from the first DETECTION_WINDOW_LINES lines, then
 * applied to the whole text. The window decides WHICH convention; it does not
 * cap how far the split runs, because a transcript whose first turn is fifty
 * lines long still opens with its convention on line one.
 */
function splitIntoTurns(text: string, sourceHint: string | null): SplitOutcome {
  const lines = text.split("\n");
  const mask = fenceMask(lines);
  const windowLines = lines.slice(0, DETECTION_WINDOW_LINES);
  const windowMask = mask.slice(0, DETECTION_WINDOW_LINES);
  const warnings: ParseWarning[] = [];

  let allowWeak = false;
  let windowHits = scanLabels(windowLines, windowMask, false);

  if (windowHits.length === 0) {
    const weakHits = scanLabels(windowLines, windowMask, true);
    const roles = new Set(weakHits.map((entry) => entry.hit.role));
    if (weakHits.length >= 2 && roles.size === 2) {
      allowWeak = true;
      windowHits = weakHits;
      warnings.push({
        code: "weak_labels_used",
        message:
          "No conventional speaker label appeared in the first 40 lines, so the split fell back to " +
          "generic labels (Prompt/Response and the like). Check the turn boundaries before accepting.",
      });
    }
  }

  if (windowHits.length > 0) {
    const hits = scanLabels(lines, mask, allowWeak);
    const turns = splitLabelled(lines, hits);
    const hasUser = turns.some((turn) => turn.role === "user");
    // One labelled turn is only believable when the label opens the document.
    const believable = turns.length >= 2 || (turns.length === 1 && hits[0].index <= 2);
    if (hasUser && believable) {
      return { turns, format: dominantFormat(hits), labels: collectLabels(turns), warnings };
    }
    if (turns.length > 0 && !hasUser) {
      warnings.push({
        code: "no_user_turns",
        message:
          "Speaker labels were found but none of them names the person, so no prompt events could " +
          "be attributed. The transcript was kept whole instead.",
      });
    }
  }

  const alternating = splitAlternating(lines, mask);
  if (alternating && alternating.length >= 2) {
    warnings.push({
      code: "positional_split",
      message:
        "No speaker labels were found. Turns were taken as blank-line separated paragraphs " +
        "alternating user then assistant, which is a guess about who spoke — check it before accepting.",
    });
    return {
      turns: alternating,
      format: "blank_line_alternating",
      labels: { user: [], assistant: [] },
      warnings,
    };
  }

  warnings.push({
    code: "no_format_detected",
    message:
      "No transcript convention matched" +
      (sourceHint ? ` (source hint: ${sourceHint})` : "") +
      ". The text was kept whole as a single event rather than split on a guess. " +
      "Add speaker labels such as 'You:' and 'Assistant:' and parse again for a turn-by-turn sequence.",
  });

  const whole = trimBlock(text);
  return {
    turns: whole
      ? [{ ordinal: 1, role: "user", label: null, text: whole, occurred_at: findTimestamp(whole.slice(0, 200)), line: 1 }]
      : [],
    format: "unstructured",
    labels: { user: [], assistant: [] },
    warnings,
  };
}

// -----------------------------------------------------------------------------
// Events — one per user turn
// -----------------------------------------------------------------------------

function buildEvents(turns: Turn[], sessionId: string): ProposedEvent[] {
  const events: ProposedEvent[] = [];
  turns.forEach((turn, i) => {
    if (turn.role !== "user") return;
    const next = turns[i + 1];
    // The reply is the turn immediately following. Where the person sent two
    // messages in a row, the first honestly has no reply rather than borrowing
    // the second one's.
    const reply = next && next.role === "assistant" ? next : null;
    events.push({
      ordinal: events.length + 1,
      kind: "prompt",
      visibility: "folded",
      occurred_at: turn.occurred_at,
      payload: {
        text: turn.text,
        response_summary: reply ? reply.text.slice(0, RESPONSE_SUMMARY_CHARS) : null,
      },
      source_ref: { source: "transcript", session_id: sessionId, index: turn.ordinal },
      inferred: false,
      inferred_reason: null,
    });
  });
  return events;
}

// -----------------------------------------------------------------------------
// Code nodes — read, not inferred
// -----------------------------------------------------------------------------

const LANGUAGE_OPTIONS = [
  "ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other",
];

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: "ts", typescript: "ts", tsx: "tsx", typescriptreact: "tsx",
  js: "js", javascript: "js", node: "js", mjs: "js", cjs: "js",
  jsx: "jsx", javascriptreact: "jsx",
  py: "python", python: "python", python3: "python", ipython: "python",
  sql: "sql", postgres: "sql", postgresql: "sql", psql: "sql", plpgsql: "sql",
  json: "json", jsonc: "json", json5: "json",
  yaml: "yaml", yml: "yaml",
  bash: "bash", sh: "bash", shell: "bash", zsh: "bash", console: "bash",
  terminal: "bash", shellsession: "bash",
  html: "html", htm: "html", svg: "html",
  css: "css", scss: "css", sass: "css", less: "css",
};

const FILENAME_LIKE = /^[\w./\\@-]+\.[A-Za-z0-9]{1,8}$/;

interface FenceInfo {
  language: string;
  declared: string | null;
  filename: string | null;
}

function parseFenceInfo(info: string, source: string): FenceInfo {
  const tokens = info.trim().split(/\s+/).filter(Boolean);
  const first = tokens[0] ?? "";
  // "ts:src/lib/build/parse.ts" — the colon form used by several doc tools.
  const [head, ...tail] = first.split(":");
  const declared = head ? head.toLowerCase() : null;

  let filename: string | null = null;
  const colonPath = tail.join(":");
  if (colonPath && FILENAME_LIKE.test(colonPath)) filename = colonPath;

  if (!filename) {
    for (const token of tokens.slice(1)) {
      const attribute = token.match(/^(?:title|file|filename)=["']?([^"']+)["']?$/i);
      if (attribute && FILENAME_LIKE.test(attribute[1])) {
        filename = attribute[1];
        break;
      }
      if (FILENAME_LIKE.test(token)) {
        filename = token;
        break;
      }
    }
  }

  if (!filename) {
    // "// src/App.tsx", "# app/main.py", "-- supabase/migrations/x.sql"
    const firstLine = source.split("\n").find((line) => line.trim() !== "") ?? "";
    const comment = firstLine.trim().match(/^(?:\/\/|#|--|<!--|\/\*)\s*([\w./\\@-]+\.[A-Za-z0-9]{1,8})/);
    if (comment) filename = comment[1];
  }

  const language = declared && LANGUAGE_ALIASES[declared]
    ? LANGUAGE_ALIASES[declared]
    : LANGUAGE_OPTIONS.includes(declared ?? "")
    ? (declared as string)
    : "other";

  return { language, declared: declared || null, filename };
}

function extractCodeNodes(
  turns: Turn[],
  sessionId: string,
  nextLocalId: () => string,
  warnings: ParseWarning[],
): ProposedNode[] {
  const nodes: ProposedNode[] = [];
  const unmapped = new Set<string>();
  let sawUnterminated = false;

  for (const turn of turns) {
    if (turn.role !== "assistant") continue;
    const { blocks, unterminated } = extractFences(turn.text);
    if (unterminated) sawUnterminated = true;

    for (const block of blocks) {
      const source = trimBlock(block.source);
      if (!source) continue;
      const info = parseFenceInfo(block.info, source);
      if (info.declared && info.language === "other" && !LANGUAGE_ALIASES[info.declared]) {
        unmapped.add(info.declared);
      }
      const payload: Record<string, unknown> = { language: info.language, source };
      if (info.filename) payload.filename = info.filename;

      nodes.push({
        local_id: nextLocalId(),
        type: "code",
        title: info.filename ??
          (info.declared
            ? `${info.declared} block from turn ${turn.ordinal}`
            : `Code block from turn ${turn.ordinal}`),
        note: null,
        payload,
        source_ref: { source: "transcript", session_id: sessionId, index: turn.ordinal },
        inferred: false,
        inferred_reason: null,
      });
    }
  }

  if (unmapped.size > 0) {
    warnings.push({
      code: "unmapped_code_language",
      message:
        `Fence languages outside the node type's enum were filed as 'other': ${[...unmapped].sort().join(", ")}.`,
    });
  }
  if (sawUnterminated) {
    warnings.push({
      code: "unterminated_code_fence",
      message:
        "A code fence was opened and never closed. Its contents were taken to the end of that turn — " +
        "check the block's boundaries.",
    });
  }
  return nodes;
}

// -----------------------------------------------------------------------------
// Model parameters — inferred
// -----------------------------------------------------------------------------

const MODEL_BASES = [
  "gpt", "chatgpt", "claude", "sonnet", "opus", "haiku", "gemini", "llama",
  "mistral", "mixtral", "grok", "deepseek", "qwen", "codex",
];

const VERSION_LIKE =
  /^(?:v?\d+(?:\.\d+)*(?:[a-z]{1,3})?|\d+[bkm]|4o|o1|o3|turbo|pro|flash|ultra|mini|nano|micro|preview|latest|instruct|thinking|chat|sonnet|opus|haiku|max|large|medium|small)$/i;

const PARAM_PATTERNS: { key: string; re: RegExp; kind: "float" | "int" | "string" }[] = [
  { key: "temperature", re: /\btemperature\b["'\s]*[:=]\s*["']?(\d*\.?\d+)/i, kind: "float" },
  { key: "max_tokens", re: /\bmax[_ -]?tokens\b["'\s]*[:=]\s*["']?(\d+)/i, kind: "int" },
  { key: "top_p", re: /\btop[_ -]?p\b["'\s]*[:=]\s*["']?(\d*\.?\d+)/i, kind: "float" },
  { key: "context_window", re: /\bcontext[_ -]?window\b["'\s]*[:=]\s*["']?(\d+)/i, kind: "int" },
  { key: "seed", re: /\bseed\b["'\s]*[:=]\s*["']?([\w-]+)/i, kind: "string" },
];

interface ModelMention {
  text: string;
  count: number;
  firstTurn: number;
  specificity: number;
}

function detectModelMentions(turns: Turn[]): ModelMention[] {
  const found = new Map<string, ModelMention>();

  for (const turn of turns) {
    const tokens = turn.text.split(/[\s,;()[\]{}"'`|]+/).filter(Boolean);
    tokens.forEach((rawToken, i) => {
      const token = rawToken.replace(/[.,:;!?]+$/, "");
      const lower = token.toLowerCase();
      const base = MODEL_BASES.find(
        (candidate) => lower === candidate || (lower.startsWith(candidate) && /^[-.\d]/.test(lower.slice(candidate.length))),
      );
      if (!base) return;

      // The token itself may carry the version ("gpt-4o"); otherwise take up to
      // two version-like tokens sitting beside it ("claude 3.5 sonnet").
      const parts = [token];
      if (lower === base) {
        for (let ahead = 1; ahead <= 2; ahead++) {
          const next = (tokens[i + ahead] ?? "").replace(/[.,:;!?]+$/, "");
          if (next && VERSION_LIKE.test(next)) parts.push(next);
          else break;
        }
      }
      const mention = parts.join(" ");
      const key = mention.toLowerCase();
      const existing = found.get(key);
      if (existing) {
        existing.count++;
        return;
      }
      found.set(key, {
        text: mention,
        count: 1,
        firstTurn: turn.ordinal,
        specificity: parts.length + (/\d/.test(mention) ? 1 : 0),
      });
    });
  }

  return [...found.values()].sort(
    (a, b) => b.specificity - a.specificity || b.count - a.count || a.firstTurn - b.firstTurn,
  );
}

function detectModelParams(
  turns: Turn[],
  sessionId: string,
  nextLocalId: () => string,
): ProposedNode | null {
  const mentions = detectModelMentions(turns);
  if (mentions.length === 0) return null;

  const primary = mentions[0];
  const payload: Record<string, unknown> = { model: primary.text };

  const whole = turns.map((turn) => turn.text).join("\n");
  const readParams: string[] = [];
  for (const pattern of PARAM_PATTERNS) {
    const match = whole.match(pattern.re);
    if (!match) continue;
    const value =
      pattern.kind === "float"
        ? Number.parseFloat(match[1])
        : pattern.kind === "int"
        ? Number.parseInt(match[1], 10)
        : match[1];
    if (typeof value === "number" && Number.isNaN(value)) continue;
    payload[pattern.key] = value;
    readParams.push(pattern.key);
  }

  const others = mentions.slice(1, 6).map((mention) => mention.text);
  const note = others.length
    ? `Other models mentioned in the transcript: ${others.join(", ")}.`
    : null;

  const reason =
    `Assembled from ${primary.count} mention${primary.count === 1 ? "" : "s"} of "${primary.text}" in the ` +
    `transcript, not from a stated configuration` +
    (readParams.length ? `; ${readParams.join(", ")} read from the text` : "") +
    ". Confirm the model and version.";

  return {
    local_id: nextLocalId(),
    type: "model_params",
    title: primary.text,
    note,
    payload,
    source_ref: { source: "transcript", session_id: sessionId, index: primary.firstTurn },
    inferred: true,
    inferred_reason: reason,
  };
}

// -----------------------------------------------------------------------------
// Result candidates — inferred
// -----------------------------------------------------------------------------

const SUCCESS_PATTERNS = [
  /\b(?:it|that|this)\s+(?:now\s+)?works?\b/i,
  /\bworking\s+(?:now|correctly|as expected)\b/i,
  /\bsuccess(?:full(?:y)?)?\b/i,
  /\ball\s+(?:the\s+)?tests?\s+(?:are\s+)?pass(?:ing|ed|es)?\b/i,
  /\btests?\s+pass(?:ing|ed|es)?\b/i,
  /\b(?:deployed|is now live|now live|shipped)\b/i,
  /\b(?:fixed|resolved|solved)\b/i,
  /\bup and running\b/i,
  /\bno\s+(?:more\s+)?errors?\b/i,
  /\bhere'?s?\s+the\s+(?:working|final|complete|finished)\b/i,
  /✅|🎉/u,
];

function firstSuccessSentence(text: string): string | null {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  for (const sentence of sentences) {
    const clean = sentence.trim();
    if (!clean || clean.startsWith("```")) continue;
    if (SUCCESS_PATTERNS.some((pattern) => pattern.test(clean))) return clean;
  }
  return null;
}

/** Prose with the fenced blocks removed, so a summary is not a wall of code. */
function withoutFences(text: string): string {
  const lines = text.split("\n");
  const mask = fenceMask(lines);
  return trimBlock(lines.filter((_, i) => !mask[i]).join("\n"));
}

function detectResultNodes(
  turns: Turn[],
  format: DetectedFormat,
  sessionId: string,
  nextLocalId: () => string,
): ProposedNode[] {
  // "The last turn of the transcript" means nothing when the transcript is one
  // unsplit block, so unstructured input proposes no result at all.
  if (format === "unstructured") return [];

  const candidates = new Map<number, { turn: Turn; summary: string; reason: string }>();
  const last = turns[turns.length - 1];
  const lastOrdinal = last && last.role === "assistant" ? last.ordinal : null;

  const claims: { turn: Turn; sentence: string }[] = [];
  for (const turn of turns) {
    if (turn.role !== "assistant") continue;
    const sentence = firstSuccessSentence(withoutFences(turn.text));
    if (sentence) claims.push({ turn, sentence });
  }

  // Explicit claims outrank the positional last turn, and later claims outrank
  // earlier ones: a transcript usually gets it working towards the end.
  for (const claim of [...claims].reverse()) {
    if (candidates.size >= MAX_RESULT_CANDIDATES) break;
    const where = claim.turn.ordinal === lastOrdinal
      ? "the last turn of the transcript"
      : `assistant turn ${claim.turn.ordinal}`;
    candidates.set(claim.turn.ordinal, {
      turn: claim.turn,
      summary: excerpt(claim.sentence, RESPONSE_SUMMARY_CHARS),
      reason: `Matched a success statement — "${excerpt(claim.sentence, 80)}" — in ${where}. Nothing was verified.`,
    });
  }

  if (lastOrdinal !== null && !candidates.has(lastOrdinal) && candidates.size < MAX_RESULT_CANDIDATES) {
    const prose = withoutFences(last.text) || last.text;
    const summary = prose.slice(0, RESPONSE_SUMMARY_CHARS).trim();
    if (summary) {
      candidates.set(lastOrdinal, {
        turn: last,
        summary,
        reason:
          "The last turn of the transcript, which is where an outcome usually lands. It claims no success in so many words.",
      });
    }
  }

  return [...candidates.values()]
    .sort((a, b) => a.turn.ordinal - b.turn.ordinal)
    .slice(0, MAX_RESULT_CANDIDATES)
    .map((candidate) => ({
      local_id: nextLocalId(),
      type: "result",
      title: excerpt(candidate.summary, 60) || `Result from turn ${candidate.turn.ordinal}`,
      note: null,
      payload: { summary: candidate.summary },
      source_ref: { source: "transcript", session_id: sessionId, index: candidate.turn.ordinal },
      inferred: true,
      inferred_reason: candidate.reason,
    }));
}

// -----------------------------------------------------------------------------
// Title and outcome — inferred, and not nodes
// -----------------------------------------------------------------------------

function proposeTitleAndOutcome(
  turns: Turn[],
  sessionId: string,
): { title: ProposedField | null; outcome: ProposedField | null } {
  const first = turns.find((turn) => turn.role === "user");
  if (!first) return { title: null, outcome: null };

  const prose = withoutFences(first.text) || first.text;
  const lines = prose.split("\n").map((line) => stripMarkdown(line)).filter((line) => line !== "");
  if (lines.length === 0) return { title: null, outcome: null };

  const ref: SourceRef = { source: "transcript", session_id: sessionId, index: first.ordinal };

  const title = excerpt(lines[0], 80);
  const sentences = prose.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
  const outcome = excerpt(sentences.slice(0, 2).join(" "), 160);

  return {
    title: title
      ? {
          value: title,
          source_ref: ref,
          inferred: true,
          inferred_reason: "Taken from the opening line of the first prompt, which states the ask rather than the outcome.",
        }
      : null,
    outcome: outcome
      ? {
          value: outcome,
          source_ref: ref,
          inferred: true,
          inferred_reason: "Summarised from the first prompt. The transcript never states an outcome in its own words.",
        }
      : null,
  };
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

export function parseTranscript(rawText: string, options: ParseOptions): ParseResult {
  const sessionId = options.session_id;
  const sourceHint = options.source_hint ?? null;
  const text = normaliseNewlines(rawText);

  const split = splitIntoTurns(text, sourceHint);
  const warnings = [...split.warnings];
  const turns = split.turns;

  let localIdSeq = 0;
  const nextLocalId = () => `node-${++localIdSeq}`;

  const events = buildEvents(turns, sessionId);
  if (turns.length > 0 && events.length === 0) {
    warnings.push({
      code: "no_events",
      message: "No user turn was identified, so no prompt events were proposed.",
    });
  }

  const nodes: ProposedNode[] = [];
  nodes.push(...extractCodeNodes(turns, sessionId, nextLocalId, warnings));
  const modelNode = detectModelParams(turns, sessionId, nextLocalId);
  if (modelNode) nodes.push(modelNode);
  nodes.push(...detectResultNodes(turns, split.format, sessionId, nextLocalId));

  if (turns.some((turn) => hasClockOnly(turn.label ?? ""))) {
    warnings.push({
      code: "timestamps_without_date",
      message:
        "Turn labels carry clock times but no date, so occurred_at was left empty rather than " +
        "anchored to a day the transcript never names.",
    });
  }

  const { title, outcome } = proposeTitleAndOutcome(turns, sessionId);

  return {
    events,
    nodes,
    warnings,
    summary: {
      session_id: sessionId,
      source_hint: sourceHint,
      detected_format: split.format,
      detected_labels: split.labels,
      turn_count: turns.length,
      user_turn_count: turns.filter((turn) => turn.role === "user").length,
      assistant_turn_count: turns.filter((turn) => turn.role === "assistant").length,
      event_count: events.length,
      node_count: nodes.length,
      character_count: text.length,
      line_count: text.split("\n").length,
      proposed_title: title,
      proposed_outcome: outcome,
    },
  };
}
