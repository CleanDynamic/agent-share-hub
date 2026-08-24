// =============================================================================
// NeoScale — parse-lovable (NS-P20): the reading
// =============================================================================
// Pure. Imports nothing, touches no Deno API, performs no I/O. A string in, a
// ParseResult out — which is what lets this be exercised without a running
// Supabase, and what let the shape below be checked against parse-transcript's
// envelope field by field before it was ever deployed.
//
// THE ENVELOPE IS parse-transcript's, UNCHANGED. Every field NS-P13 returns is
// returned here with the same name, the same type and the same meaning. The
// only values that differ are the ones that are *supposed* to vary per parser:
// source_ref.source is "lovable" rather than "transcript", and detected_format
// names a Lovable shape. intake.ts types both as `string`, so materialiseProposal
// consumes this proposal with no source-specific branch. Nothing was changed in
// parse-transcript, and nothing needed to be.
//
// WHAT A "LOVABLE EXPORT" ACTUALLY IS. Lovable has no native session export.
// Its own download is source code only and carries no chat history at all. The
// two real session-bearing shapes both come from third-party tooling, and this
// parser reads both — see README.md, which records each one and where the
// schema was read from. A creator drops what they have; this works out what it
// is rather than asking them to classify it.
//
// FENCE HANDLING IS RE-IMPLEMENTED HERE, deliberately and against the advice in
// the NS-P13 README. That README invites the next parser to borrow fenceMask,
// extractFences and excerpt — but those are module-private in
// parse-transcript/parse.ts (`function`, not `export function`), and exporting
// them would mean editing a file this prompt puts out of bounds. Re-deriving a
// hundred lines was the cheaper of the two rule-breaks. NS-P21 should lift the
// shared half into supabase/functions/_shared/ and have both parsers import it.
// =============================================================================

export const MAX_RAW_TEXT_CHARS = 400_000;
export const RESPONSE_SUMMARY_CHARS = 240;
/** Beyond this a "retry" reading is noise rather than a signal. */
export const MAX_BREAKAGE_CANDIDATES = 8;

// -----------------------------------------------------------------------------
// Types — the same envelope parse-transcript returns
// -----------------------------------------------------------------------------
// The envelope is declared once, in _shared/intake/envelope.ts, and narrowed
// here to this reader's own literals. NS-P20 re-declared it field by field to
// avoid editing parse-transcript; NS-P20a moved the declarations to the shared
// module so there is one source of truth rather than two agreeing copies.
// `import type` is erased at compile time, so this adds no runtime import.
import type {
  ParseOptions as SharedParseOptions,
  ParseResult as SharedParseResult,
  ParseSummary as SharedParseSummary,
  ParseWarning as SharedParseWarning,
  ProposedEvent as SharedProposedEvent,
  ProposedField as SharedProposedField,
  ProposedNode as SharedProposedNode,
  SourceRef as SharedSourceRef,
} from "../_shared/intake/envelope.ts";

export type DetectedFormat =
  /** The Chrome extension's JSON: {exportedAt, url, messageCount, messages[]}. */
  | "lovable_chat_export"
  /** The Firestore CLI's TrajectoryMessage records. Genuine timestamps. */
  | "lovable_trajectory"
  /** Lovable's own code download. Real, common, and carries no session at all. */
  | "lovable_source_only"
  /** Valid JSON, but nothing in it looks like a Lovable session. */
  | "unrecognised";

/**
 * {source, session_id, index} — structurally identical to NS-P13's SourceRef.
 * `source` is the discriminator, and build_nodes.source_ref holds it as-is.
 */
export type SourceRef = SharedSourceRef<"lovable">;

/** `kind` is wider here than NS-P13's: this shape earns deploy and breakage too. */
export type ProposedEvent = SharedProposedEvent<"lovable", "prompt" | "deploy" | "breakage">;

export type ProposedNode = SharedProposedNode<"lovable">;

export type ProposedField = SharedProposedField<"lovable">;

export type ParseWarning = SharedParseWarning;

/**
 * Field-for-field NS-P13's ParseSummary, because it IS NS-P13's ParseSummary.
 * turn_count / user_turn_count / assistant_turn_count keep their transcript
 * names even though a Lovable export calls them messages: renaming them would
 * fork the envelope, and the client reads them by name.
 */
export type ParseSummary = SharedParseSummary<DetectedFormat, "lovable">;

export type ParseResult = SharedParseResult<DetectedFormat, "lovable", "prompt" | "deploy" | "breakage">;

export type ParseOptions = SharedParseOptions;

// -----------------------------------------------------------------------------
// The normalised message
// -----------------------------------------------------------------------------
// Both real shapes collapse into this before a single line of proposal logic
// runs, so the pipeline below is written once rather than twice.

interface LovableMessage {
  /** 1-based across both speakers — becomes source_ref.index. */
  index: number;
  role: "user" | "assistant";
  text: string;
  /** ISO 8601, or null. */
  occurred_at: string | null;
  /** True when occurred_at was computed rather than read. */
  occurred_at_inferred: boolean;
  /** Files this message changed, when the shape carries them. */
  patch: { path: string; action: string }[];
}

// -----------------------------------------------------------------------------
// Text utilities
// -----------------------------------------------------------------------------

function normaliseNewlines(raw: string): string {
  return raw.replace(/\r\n?/g, "\n");
}

function trimBlock(raw: string): string {
  return normaliseNewlines(raw).replace(/^\n+/, "").replace(/\s+$/, "");
}

function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  // Break on a word boundary where one is close enough to the cut to be worth it.
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * contentHtml -> text, for the one shape that can arrive without contentText.
 *
 * Block-level tags become newlines before tags are stripped, so a list or a
 * sequence of paragraphs does not collapse into one run-on line. <pre> and
 * <code> survive as fenced blocks, because that is where a code node comes
 * from and losing the boundary would lose the node.
 */
function htmlToText(html: string): string {
  let text = normaliseNewlines(html);

  // Fence <pre> blocks before anything else strips their boundary.
  text = text.replace(
    /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi,
    (_match, inner: string) => `\n\`\`\`\n${inner.replace(/<[^>]+>/g, "")}\n\`\`\`\n`,
  );

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "");

  // Entities, commonest first. &amp; is decoded last so "&amp;lt;" survives.
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");

  return trimBlock(text.replace(/\n{3,}/g, "\n\n"));
}

// -----------------------------------------------------------------------------
// Timestamps
// -----------------------------------------------------------------------------
// build_events.occurred_at is timestamptz, so a value without a date is worse
// than no value: it would anchor the event to a day the export never named.
// NS-P13 drops those and warns; this does the same, with one addition it can
// honestly make and NS-P13 could not — a relative stamp ("2 days ago") is
// resolvable against the export's own exportedAt, and is marked inferred.

const ISO_LIKE =
  /\b(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)\s*(Z|[+-]\d{2}:?\d{2})?)?\b/;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** "Aug 24, 2026, 2:31 PM" and "24 August 2026 14:31". */
const NAMED_MONTH =
  /\b(?:(\d{1,2})\s+)?([A-Za-z]{3,9})\.?\s+(?:(\d{1,2})[,\s]+)?(\d{4})\b(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?)?/i;

const RELATIVE = /\b(\d+)\s*(second|minute|hour|day|week|month)s?\s+ago\b/i;
const CLOCK_ONLY = /\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?\b/i;

function toIso(date: Date): string | null {
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function withClock(
  year: number, month: number, day: number,
  hour: string | undefined, minute: string | undefined,
  second: string | undefined, meridiem: string | undefined,
): string | null {
  let h = hour ? Number(hour) : 0;
  if (meridiem) {
    const pm = /^p/i.test(meridiem);
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  return toIso(new Date(Date.UTC(year, month, day, h, minute ? Number(minute) : 0, second ? Number(second) : 0)));
}

export interface TimestampReading {
  iso: string | null;
  inferred: boolean;
  /** A clock time with no date — the one case that is dropped rather than kept. */
  clockOnly: boolean;
}

/**
 * Read whatever a display string is willing to give up.
 *
 * `anchor` is the export's own exportedAt, and is the only thing that makes a
 * relative stamp resolvable. Without it a relative stamp reads as no date.
 */
export function readTimestamp(raw: string | null, anchor: Date | null): TimestampReading {
  const none: TimestampReading = { iso: null, inferred: false, clockOnly: false };
  if (!raw || raw.trim() === "") return none;
  const text = raw.trim();

  const iso = text.match(ISO_LIKE);
  if (iso) {
    const [, date, clock, zone] = iso;
    // A stamp naming no zone is read as UTC rather than as the server's local
    // time, so the same export parses identically wherever it is parsed.
    const composed = clock ? `${date}T${clock}${zone ?? "Z"}` : `${date}T00:00:00Z`;
    const parsed = toIso(new Date(composed));
    if (parsed) return { iso: parsed, inferred: false, clockOnly: false };
  }

  const named = text.match(NAMED_MONTH);
  if (named) {
    const [, dayBefore, monthWord, dayAfter, year, hour, minute, second, meridiem] = named;
    const month = MONTHS[monthWord.slice(0, 3).toLowerCase()];
    const day = dayBefore ?? dayAfter;
    if (month !== undefined && day) {
      const parsed = withClock(Number(year), month, Number(day), hour, minute, second, meridiem);
      if (parsed) return { iso: parsed, inferred: false, clockOnly: false };
    }
  }

  const relative = text.match(RELATIVE);
  if (relative && anchor) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const ms: Record<string, number> = {
      second: 1000, minute: 60_000, hour: 3_600_000,
      day: 86_400_000, week: 604_800_000, month: 2_592_000_000,
    };
    const parsed = toIso(new Date(anchor.getTime() - amount * (ms[unit] ?? 0)));
    // Computed, not read: the creator is told, and can disagree.
    if (parsed) return { iso: parsed, inferred: true, clockOnly: false };
  }

  return { iso: null, inferred: false, clockOnly: CLOCK_ONLY.test(text) };
}

// -----------------------------------------------------------------------------
// Fenced code
// -----------------------------------------------------------------------------
// Re-derived rather than imported — see the header. The behaviour matches
// NS-P13: an unmapped language is filed as `other` with a warning rather than
// inventing a seventh enum value, and an unterminated fence runs to the end of
// the message and says so.

/** node_types.code -> fields.language, which is an enum and closed. */
const LANGUAGE_OPTIONS = [
  "ts", "tsx", "js", "jsx", "python", "sql",
  "json", "yaml", "bash", "html", "css", "other",
] as const;

const LANGUAGE_ALIASES: Record<string, string> = {
  typescript: "ts", ts: "ts", tsx: "tsx",
  javascript: "js", js: "js", mjs: "js", cjs: "js", jsx: "jsx",
  python: "python", py: "python",
  sql: "sql", postgres: "sql", postgresql: "sql", plpgsql: "sql",
  json: "json", jsonc: "json",
  yaml: "yaml", yml: "yaml",
  bash: "bash", sh: "bash", shell: "bash", zsh: "bash", console: "bash",
  html: "html", markup: "html",
  css: "css", scss: "css", sass: "css",
};

const FILENAME_LIKE = /^[\w./\\@-]+\.[A-Za-z0-9]{1,8}$/;

interface Fence {
  language: string;
  /** True when the fence named a language this registry has no value for. */
  unmapped: boolean;
  filename: string | null;
  source: string;
}

/**
 * Pull fenced blocks out of one message.
 *
 * The info string carries both things worth having: ```ts src/lib/x.ts names a
 * language and a file. Lovable's own replies routinely fence a path this way,
 * which is where a code node's filename comes from when no patch[] exists.
 */
function extractFences(text: string): { fences: Fence[]; unterminated: boolean } {
  const lines = normaliseNewlines(text).split("\n");
  const fences: Fence[] = [];
  let open: { info: string; body: string[] } | null = null;
  let unterminated = false;

  for (const line of lines) {
    const marker = line.match(/^\s*(?:```|~~~)(.*)$/);
    if (marker) {
      if (open) {
        fences.push(readFence(open.info, open.body.join("\n")));
        open = null;
      } else {
        open = { info: marker[1].trim(), body: [] };
      }
      continue;
    }
    if (open) open.body.push(line);
  }

  if (open) {
    unterminated = true;
    // Kept rather than discarded: a truncated block is still the code.
    if (open.body.length > 0) fences.push(readFence(open.info, open.body.join("\n")));
  }

  return { fences: fences.filter((fence) => fence.source.trim() !== ""), unterminated };
}

function readFence(info: string, source: string): Fence {
  const tokens = info.split(/\s+/).filter(Boolean);
  let language = "other";
  let unmapped = false;
  let filename: string | null = null;

  for (const token of tokens) {
    const bare = token.replace(/^[.{(]+|[})]+$/g, "").trim();
    if (bare === "") continue;
    if (FILENAME_LIKE.test(bare) && bare.includes(".")) {
      filename ??= bare;
      // A path also implies a language when the fence named none.
      const extension = bare.split(".").pop()?.toLowerCase() ?? "";
      if (language === "other" && LANGUAGE_ALIASES[extension]) {
        language = LANGUAGE_ALIASES[extension];
      }
      continue;
    }
    const mapped = LANGUAGE_ALIASES[bare.toLowerCase()];
    if (mapped) {
      language = mapped;
    } else if (language === "other") {
      // Named something, but nothing this enum holds.
      unmapped = true;
    }
  }

  if (!LANGUAGE_OPTIONS.includes(language as (typeof LANGUAGE_OPTIONS)[number])) {
    language = "other";
    unmapped = true;
  }

  return { language, unmapped, filename, source: trimBlock(source) };
}

/** A filename's extension, for a patch[] entry that names a path and nothing else. */
function languageForPath(path: string): { language: string; unmapped: boolean } {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const mapped = LANGUAGE_ALIASES[extension];
  return mapped ? { language: mapped, unmapped: false } : { language: "other", unmapped: false };
}

// -----------------------------------------------------------------------------
// Detection and normalisation
// -----------------------------------------------------------------------------
// Detection reads the CONTENT, never a filename and never a picker. The two
// session-bearing shapes are told apart by the fields their own writers emit —
// see README.md for where each schema was read from.

interface Detection {
  format: DetectedFormat;
  messages: LovableMessage[];
  /** The export's own clock, used to anchor relative stamps. */
  anchor: Date | null;
  /** Lovable project URL, when the shape carries one. */
  projectUrl: string | null;
  projectName: string | null;
  labels: { user: string[]; assistant: string[] };
}

function normaliseRole(raw: unknown, id: string | null): "user" | "assistant" {
  const role = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (role === "user" || role === "human") return "user";
  if (role === "ai" || role === "assistant" || role === "model" || role === "bot") {
    return "assistant";
  }
  // The extension derives role from the id prefix, so fall back the same way.
  return id && id.startsWith("umsg_") ? "user" : "assistant";
}

function readPatch(value: unknown): { path: string; action: string }[] {
  if (!Array.isArray(value)) return [];
  const entries: { path: string; action: string }[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const path = readString(item.path) ?? readString(item.file_path) ?? readString(item.filePath);
    if (!path) continue;
    // The CLI defaults a missing action to "unknown"; matched here.
    entries.push({ path, action: readString(item.action) ?? "unknown" });
  }
  return entries;
}

/** The project slug out of https://lovable.dev/projects/<id>. */
function readProjectName(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/lovable\.dev\/projects\/([\w-]+)/i);
  if (!match) return null;
  const slug = match[1];
  // A bare uuid is an id, not a name, and is not worth proposing as a title.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)) return null;
  return slug.replace(/[-_]+/g, " ").trim() || null;
}

/**
 * Work out what was dropped.
 *
 * Order matters: the trajectory shape is checked first because it is the one
 * carrying genuine timestamps, and a record that satisfies both readings should
 * be read as the better of the two.
 */
export function detect(root: unknown): Detection {
  const empty: Detection = {
    format: "unrecognised", messages: [], anchor: null,
    projectUrl: null, projectName: null,
    labels: { user: [], assistant: [] },
  };

  const container = isRecord(root) ? root : null;
  const list: unknown[] = Array.isArray(root)
    ? root
    : Array.isArray(container?.messages)
      ? (container!.messages as unknown[])
      : [];

  const projectUrl = readString(container?.url) ?? null;
  const anchorRaw = readString(container?.exportedAt) ?? readString(container?.exported_at);
  const anchor = anchorRaw ? new Date(anchorRaw) : null;
  const usableAnchor = anchor && Number.isFinite(anchor.getTime()) ? anchor : null;

  if (list.length === 0) {
    // A Lovable code download has no messages anywhere in it. Saying so is far
    // more use to a creator than an empty proposal they cannot explain.
    const looksLikeSource =
      container !== null &&
      ("dependencies" in container || "devDependencies" in container ||
        "files" in container || "compilerOptions" in container);
    return { ...empty, format: looksLikeSource ? "lovable_source_only" : "unrecognised" };
  }

  const records = list.filter(isRecord);
  const trajectoryish = records.filter(
    (item) => "createdAt" in item || "created_at" in item || "createTime" in item || "patch" in item,
  ).length;
  const extensionish = records.filter(
    (item) => "contentText" in item || "contentHtml" in item || "timestampText" in item || "topPx" in item,
  ).length;

  if (trajectoryish === 0 && extensionish === 0) return { ...empty, format: "unrecognised" };

  const format: DetectedFormat =
    trajectoryish >= extensionish ? "lovable_trajectory" : "lovable_chat_export";

  const labels = { user: new Set<string>(), assistant: new Set<string>() };
  const messages: LovableMessage[] = [];

  records.forEach((item, position) => {
    const id = readString(item.id);
    const role = normaliseRole(item.role, id);

    const text =
      format === "lovable_trajectory"
        ? readString(item.content) ?? readString(item.contentText) ?? ""
        : readString(item.contentText) ??
          (readString(item.contentHtml) ? htmlToText(item.contentHtml as string) : "") ??
          "";

    // Genuine first, display text second. createdAt is Lovable's own clock;
    // createTime is Firestore's and is a hair later, so it is the fallback.
    const reading =
      format === "lovable_trajectory"
        ? readTimestamp(
            readString(item.createdAt) ?? readString(item.created_at) ??
              readString(item.createTime) ?? readString(item.updateTime),
            usableAnchor,
          )
        : readTimestamp(readString(item.timestampText), usableAnchor);

    const label = readString(item.name);
    if (label) labels[role].add(label.slice(0, 48));

    messages.push({
      index: position + 1,
      role,
      text: trimBlock(text),
      occurred_at: reading.iso,
      occurred_at_inferred: reading.inferred,
      patch: readPatch(item.patch),
    });
  });

  return {
    format,
    messages,
    anchor: usableAnchor,
    projectUrl,
    projectName: readProjectName(projectUrl),
    labels: {
      user: [...labels.user],
      assistant: [...labels.assistant],
    },
  };
}

// -----------------------------------------------------------------------------
// Reading the session
// -----------------------------------------------------------------------------

const DEPLOY_PATTERNS = [
  /\bdeploy(?:ed|ing|ment)?\b/i,
  /\bpublish(?:ed|ing)?\b/i,
  /\byour (?:app|site|project) is (?:now )?live\b/i,
  /\bwent live\b/i,
];

/** A Lovable deployment lands on one of these, so a URL is real evidence. */
const DEPLOY_URL = /https?:\/\/[\w.-]+\.(?:lovable\.app|lovableproject\.com|netlify\.app|vercel\.app)[^\s)"'<]*/i;

const FAILURE_PATTERNS = [
  /\berror\b/i, /\bfailed\b/i, /\bfailure\b/i, /\bexception\b/i,
  /\bcannot find\b/i, /\bis not defined\b/i, /\bunexpected token\b/i,
  /\bbuild failed\b/i, /\btype error\b/i, /\bstack trace\b/i,
  /\bdoes not exist\b/i, /\bcrash(?:ed|ing)?\b/i,
];

const RETRY_PATTERNS = [
  /\bstill (?:not|broken|failing|doesn'?t)\b/i,
  /\btry again\b/i, /\bsame (?:error|problem|issue)\b/i,
  /\bthat didn'?t work\b/i, /\bit'?s still\b/i,
  /\bagain\b/i, /\bnot fixed\b/i, /\bstill errors?\b/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Content words only, so "please fix the login button" ≈ "fix login button". */
function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

/** Jaccard overlap. Cheap, and good enough to spot a re-asked prompt. */
function similarity(a: string, b: string): number {
  const left = tokenise(a);
  const right = tokenise(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

const REPEATED_PROMPT_THRESHOLD = 0.6;

interface Reading {
  events: ProposedEvent[];
  nodes: ProposedNode[];
  warnings: ParseWarning[];
}

function read(detection: Detection, sessionId: string): Reading {
  const { messages } = detection;
  const events: ProposedEvent[] = [];
  const nodes: ProposedNode[] = [];
  const warnings: ParseWarning[] = [];

  const ref = (index: number): SourceRef => ({ source: "lovable", session_id: sessionId, index });

  let clockOnlySeen = false;
  let relativeSeen = false;
  let unmappedLanguage = false;
  let unterminatedFence = false;
  let breakageCount = 0;

  /** Ordinals run 1..N across every kind, so each is a unique selection key. */
  let ordinal = 0;
  const nextOrdinal = () => (ordinal += 1);

  let previousUserText: string | null = null;
  let failureSincePrompt: string | null = null;

  messages.forEach((message, position) => {
    const next = messages[position + 1];

    if (message.role === "user") {
      // --- the prompt itself ------------------------------------------------
      const responseSummary =
        next && next.role === "assistant" && next.text
          ? excerpt(next.text, RESPONSE_SUMMARY_CHARS)
          : null;

      if (message.occurred_at_inferred) relativeSeen = true;

      events.push({
        ordinal: nextOrdinal(),
        kind: "prompt",
        visibility: "folded",
        occurred_at: message.occurred_at,
        payload: { text: message.text, response_summary: responseSummary },
        source_ref: ref(message.index),
        // The prompt is read verbatim. Only a computed timestamp makes it a guess.
        inferred: message.occurred_at_inferred,
        inferred_reason: message.occurred_at_inferred
          ? "occurred_at was computed from a relative timestamp ('2 days ago') against the export's own exportedAt, not read as a date."
          : null,
      });

      // --- a retry after a failure -----------------------------------------
      // The single most educational artefact in a build: the thing broke, and
      // this is the creator going back at it. Always a candidate, never a
      // conclusion — nothing in either export shape says "this was a retry".
      const repeats =
        previousUserText !== null &&
        similarity(previousUserText, message.text) >= REPEATED_PROMPT_THRESHOLD;
      const saysRetry = matchesAny(message.text, RETRY_PATTERNS);

      if (failureSincePrompt && (repeats || saysRetry) && breakageCount < MAX_BREAKAGE_CANDIDATES) {
        breakageCount += 1;
        events.push({
          ordinal: nextOrdinal(),
          kind: "breakage",
          visibility: "folded",
          occurred_at: message.occurred_at,
          payload: {
            text: message.text,
            response_summary: excerpt(failureSincePrompt, RESPONSE_SUMMARY_CHARS),
          },
          source_ref: ref(message.index),
          inferred: true,
          inferred_reason: repeats
            ? "The previous reply reported an error and this prompt largely repeats the one before it, which reads as a retry. Neither export shape records failure, so this is a candidate for you to confirm or discard."
            : "The previous reply reported an error and this prompt says the problem persists. Neither export shape records failure, so this is a candidate for you to confirm or discard.",
        });
      }

      previousUserText = message.text;
      failureSincePrompt = null;
      return;
    }

    // --- assistant ----------------------------------------------------------
    if (matchesAny(message.text, FAILURE_PATTERNS)) {
      failureSincePrompt = message.text;
    }

    const deployUrl = message.text.match(DEPLOY_URL)?.[0] ?? null;
    if (deployUrl || matchesAny(message.text, DEPLOY_PATTERNS)) {
      events.push({
        ordinal: nextOrdinal(),
        kind: "deploy",
        visibility: "folded",
        occurred_at: message.occurred_at,
        payload: {
          text: deployUrl ? `Deployed to ${deployUrl}` : excerpt(message.text, RESPONSE_SUMMARY_CHARS),
          response_summary: null,
        },
        source_ref: ref(message.index),
        inferred: true,
        inferred_reason: deployUrl
          ? "Read from a deployment URL in the reply. Neither export shape records deploys as events, so the moment is inferred from what the reply said."
          : "Read from deployment wording in the reply. Neither export shape records deploys as events, and wording alone can describe a deploy that never happened.",
      });

      if (deployUrl) {
        nodes.push({
          local_id: `node-${nodes.length + 1}`,
          type: "live_app",
          title: "Live app",
          note: null,
          payload: { url: deployUrl, embeddable: false },
          source_ref: ref(message.index),
          inferred: true,
          inferred_reason: "The URL was read from the reply, but nothing confirms it is still live.",
        });
      }
    }
  });

  // --- code, from whichever source the shape offers --------------------------

  for (const message of messages) {
    // A patch[] entry is the file-change summary the trajectory shape records
    // per prompt. It carries the path and the action and deliberately no body,
    // so the node lands with its source empty for the creator to fill.
    for (const entry of message.patch) {
      const { language } = languageForPath(entry.path);
      nodes.push({
        local_id: `node-${nodes.length + 1}`,
        type: "code",
        title: entry.path,
        note: `${entry.action} by this prompt. The export records the path and the action, not the file contents — paste the code in.`,
        payload: { language, source: "", filename: entry.path, entrypoint: false },
        source_ref: ref(message.index),
        inferred: true,
        inferred_reason:
          "The path and the action were read from the export's file-change record, but it carries no file body, so the code itself is missing.",
      });
    }

    const { fences, unterminated } = extractFences(message.text);
    if (unterminated) unterminatedFence = true;

    for (const fence of fences) {
      if (fence.unmapped) unmappedLanguage = true;
      nodes.push({
        local_id: `node-${nodes.length + 1}`,
        type: "code",
        title: fence.filename ?? `${fence.language} block`,
        note: null,
        payload: {
          language: fence.language,
          source: fence.source,
          filename: fence.filename,
          entrypoint: false,
        },
        source_ref: ref(message.index),
        // Read out of a fence, verbatim. The one thing here that is not a guess.
        inferred: false,
        inferred_reason: null,
      });
    }
  }

  // --- warnings --------------------------------------------------------------

  // A message that yielded no date at all: either its stamp was a bare clock
  // time, or the shape carried no stamp for it. Both land the same way — the
  // ordering survives, the wall-clock moment does not.
  clockOnlySeen = messages.some((message) => message.occurred_at === null && message.text !== "");

  if (relativeSeen) {
    warnings.push({
      code: "relative_timestamps_anchored",
      message:
        "Some messages carried a relative time ('2 days ago') rather than a date. Those were resolved against the export's own exportedAt and are marked inferred — check them before you publish.",
    });
  }
  if (clockOnlySeen) {
    warnings.push({
      code: "timestamps_without_date",
      message:
        "Some messages carried no usable date, so their occurred_at was left empty rather than anchored to a day the export never named. The order they ran in is still correct.",
    });
  }
  if (unmappedLanguage) {
    warnings.push({
      code: "unmapped_code_language",
      message:
        "A code block named a language this registry has no value for. It was filed as 'other' rather than inventing a new one.",
    });
  }
  if (unterminatedFence) {
    warnings.push({
      code: "unterminated_code_fence",
      message:
        "A code block was never closed. It was read to the end of the message, so it may carry trailing prose.",
    });
  }
  if (breakageCount > 0) {
    warnings.push({
      code: "breakage_candidates_inferred",
      message:
        `${breakageCount} retry-after-failure ${breakageCount === 1 ? "moment was" : "moments were"} proposed as breakage. Neither export shape records failure, so every one is a guess read from wording — keep the real ones and discard the rest.`,
    });
  }

  // Nodes are built in two passes (events first, then code), so they leave the
  // loop in construction order rather than session order. Sorting them by the
  // message they came out of makes the proposal read top to bottom the way the
  // session ran; local_id is only a handle within one response, so renumbering
  // after the sort costs nothing and keeps the handles ascending too.
  nodes.sort((a, b) => a.source_ref.index - b.source_ref.index);
  nodes.forEach((node, position) => {
    node.local_id = `node-${position + 1}`;
  });

  return { events, nodes, warnings };
}

// -----------------------------------------------------------------------------
// Title and outcome
// -----------------------------------------------------------------------------
// builds columns, not nodes, which is why they sit in summary. Both inferred,
// always: a project slug is a name someone typed once, and an opening prompt is
// an intention rather than a result. The creator is expected to rewrite them.

const TITLE_CHARS = 90;
const OUTCOME_CHARS = 240;

function proposeTitleAndOutcome(
  detection: Detection,
  sessionId: string,
): { title: ProposedField | null; outcome: ProposedField | null } {
  const firstUser = detection.messages.find((message) => message.role === "user" && message.text !== "");
  const ref = (index: number): SourceRef => ({ source: "lovable", session_id: sessionId, index });

  let title: ProposedField | null = null;

  if (detection.projectName) {
    title = {
      value: excerpt(detection.projectName, TITLE_CHARS),
      source_ref: ref(firstUser?.index ?? 1),
      inferred: true,
      inferred_reason:
        "Read from the project URL in the export. It is the name the project was given in Lovable, not a title written for readers.",
    };
  } else if (firstUser) {
    title = {
      value: excerpt(firstUser.text, TITLE_CHARS),
      source_ref: ref(firstUser.index),
      inferred: true,
      inferred_reason:
        "Taken from the opening prompt, which is what was asked for rather than what was built.",
    };
  }

  const outcome: ProposedField | null = firstUser
    ? {
        value: excerpt(firstUser.text, OUTCOME_CHARS),
        source_ref: ref(firstUser.index),
        inferred: true,
        inferred_reason:
          "Taken from the opening prompt. It describes the intention the session started with, not what it ended up producing.",
      }
    : null;

  return { title, outcome };
}

// -----------------------------------------------------------------------------
// Entry point
// -----------------------------------------------------------------------------

/**
 * A Lovable export in, a proposal out. Writes nothing and reads nothing.
 *
 * `rawText` is the export file's text. Parsing it here rather than taking an
 * object keeps this function's HTTP shell identical to parse-transcript's —
 * one `raw_text` string in the body — and keeps this module free of any
 * assumption about how the file reached it.
 */
export function parseLovable(rawText: string, options: ParseOptions): ParseResult {
  const sessionId = options.session_id;
  const sourceHint =
    typeof options.source_hint === "string" && options.source_hint.trim() !== ""
      ? options.source_hint.trim()
      : null;

  const characterCount = rawText.length;
  const lineCount = normaliseNewlines(rawText).split("\n").length;

  const base = (
    format: DetectedFormat,
    warnings: ParseWarning[],
  ): ParseResult => ({
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

  let root: unknown;
  try {
    root = JSON.parse(rawText);
  } catch {
    // Not a failure: it is a file that is not this parser's to read, and the
    // intake surface routes on that answer rather than treating it as an error.
    return base("unrecognised", [
      {
        code: "not_json",
        message:
          "This file is not JSON, so it is not a Lovable session export. If it is a chat transcript, paste it as text instead.",
      },
    ]);
  }

  const detection = detect(root);

  if (detection.format === "lovable_source_only") {
    return base("lovable_source_only", [
      {
        code: "no_session_history",
        message:
          "This looks like a Lovable code download. It carries your project's source but none of the session — no prompts, no timestamps, no order. Lovable has no native session export; use a chat-history exporter to capture the session itself.",
      },
    ]);
  }

  if (detection.format === "unrecognised" || detection.messages.length === 0) {
    return base("unrecognised", [
      {
        code: "no_session_history",
        message:
          "This JSON carries no messages this parser recognises. Both supported shapes are recorded in the parse-lovable README.",
      },
    ]);
  }

  // ORDER. The extension writes its messages already sorted; the trajectory
  // shape is a directory of one file per message and can arrive in filename
  // order, which is not session order. Sorting is only safe when every message
  // carries a stamp — a partial sort would interleave dated and undated
  // messages arbitrarily — so otherwise the given order is kept and trusted.
  const everyMessageDated = detection.messages.every((message) => message.occurred_at !== null);
  if (everyMessageDated) {
    detection.messages.sort(
      (a, b) => Date.parse(a.occurred_at!) - Date.parse(b.occurred_at!) || a.index - b.index,
    );
    // Re-index so source_ref.index reads as position in the session, which is
    // what intake.ts walks when it links a node to the event that produced it.
    detection.messages.forEach((message, position) => {
      message.index = position + 1;
    });
  }

  const { events, nodes, warnings } = read(detection, sessionId);
  const { title, outcome } = proposeTitleAndOutcome(detection, sessionId);

  const userCount = detection.messages.filter((message) => message.role === "user").length;
  const assistantCount = detection.messages.length - userCount;

  if (userCount === 0) {
    warnings.push({
      code: "no_user_turns",
      message:
        "No user messages were found, so there are no prompts to sequence. The export may have captured only the replies.",
    });
  }
  if (events.length === 0) {
    warnings.push({
      code: "no_events",
      message: "No events could be read from this export.",
    });
  }
  if (!everyMessageDated && detection.format === "lovable_trajectory") {
    warnings.push({
      code: "order_not_verified",
      message:
        "Not every message carried a timestamp, so the order in the file was kept rather than re-sorted. Check the sequence before you publish.",
    });
  }

  return {
    events,
    nodes,
    summary: {
      session_id: sessionId,
      source_hint: sourceHint,
      detected_format: detection.format,
      detected_labels: detection.labels,
      turn_count: detection.messages.length,
      user_turn_count: userCount,
      assistant_turn_count: assistantCount,
      event_count: events.length,
      node_count: nodes.length,
      character_count: characterCount,
      line_count: lineCount,
      proposed_title: title,
      proposed_outcome: outcome,
    },
    warnings,
  };
}
