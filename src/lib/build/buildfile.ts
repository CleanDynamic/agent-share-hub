// The Build File parser: an envelope written elsewhere, read into a proposal.
//
// portable.ts writes the envelope. This reads one back — and reads it under a
// weaker assumption than the exporter's, because by NS-P32 a Build File is no
// longer only something this site produced. Three kinds of file arrive here:
//
//   1. A site export, straight out of toPortable. Well-formed by construction.
//   2. An extractor file, written by a language model that was handed a chat
//      transcript and the extractor document (NS-P33) and asked to emit this
//      shape. Structurally right, frequently sloppy: wrapped in a fenced block
//      with a paragraph of commentary around it, trailing commas, smart quotes
//      where the model's tokeniser preferred them, a `type` it invented.
//   3. A compiler file, assembled from several sources, arriving as one phase
//      per source.
//
// All three land on the SAME intake review the transcript parser already feeds
// (NS-P13), because a creator confirming imported material should not have to
// learn a second surface to do it on. That is what fixes the output type: this
// module's job is finished when it has produced a TranscriptProposal, and every
// decision below is in service of producing one that materialiseProposal can
// write without further translation.
//
// TWO PRINCIPLES DECIDE EVERY TOLERANCE QUESTION HERE
//
// NOTHING IS SILENTLY DROPPED. A parser that quietly discards the half of a
// file it did not recognise is worse than one that refuses the file, because
// the creator accepts a proposal believing it to be complete. So an unknown
// node type becomes a note rather than a skipped node, an unrecognised payload
// key is moved into the node's note rather than deleted, and every one of those
// moves leaves a warning behind. The only things this refuses outright are the
// four that make the rest meaningless: a file too large to hold, text that is
// not JSON, a format version this code cannot read, and counts past the caps.
//
// REPAIR IS BOUNDED AND NAMED. Exactly two repairs are attempted, once, and
// only after an honest parse has already failed: trailing commas, and smart
// quotes outside string values. Everything else a malformed file might need is
// deliberately not attempted. An open-ended repairer is how a parser starts
// inventing content, and the failure mode — a file that imports "successfully"
// as something the creator did not write — is far worse than being told the
// file is broken.

import type {
  ParseWarning,
  ProposalSummary,
  ProposedEvent,
  ProposedField,
  ProposedNode,
  TranscriptProposal,
  TranscriptSourceRef,
} from "./intake";
import { PORTABLE_FORMAT_VERSION } from "./portable";
import type { FieldDef, NodeType } from "./types";

// =============================================================================
// Limits
// =============================================================================

/** Checked against the raw text BEFORE any parse is attempted. */
export const MAX_BUILDFILE_CHARS = 2_000_000;

/** Counted over the flattened tree, so children count towards it. */
export const MAX_BUILDFILE_NODES = 2_000;

export const MAX_BUILDFILE_EVENTS = 5_000;

/** Deeper nodes are re-parented to this depth rather than refused. */
export const MAX_NODE_DEPTH = 3;

/**
 * A pathological file could otherwise return a secret finding per string it
 * holds. The scan is an advisory shown to a human, and a list past this length
 * has stopped being one.
 */
export const MAX_SECRET_FINDINGS = 200;

/** The kinds build_events accepts. Anything else becomes a note. */
export const EVENT_KINDS = ["prompt", "milestone", "breakage", "deploy", "note"] as const;

export const EVENT_VISIBILITIES = ["kept", "folded", "hidden"] as const;

/**
 * Imported events arrive folded.
 *
 * An import can carry hundreds of events, and unfolding all of them would bury
 * the nodes — which are the part a creator has to place — under a wall of
 * history nobody asked to read yet.
 */
export const DEFAULT_EVENT_VISIBILITY = "folded";

/** source_ref.source when the file names no tool of its own. */
export const BUILDFILE_SOURCE = "buildfile";

/** Where a node whose type the registry does not hold ends up. */
export const FALLBACK_NODE_TYPE = "note";

/** Payload keys an event's display text is taken from, in order of preference. */
export const EVENT_TEXT_KEYS = [
  "text",
  "summary",
  "symptom",
  "problem",
  "decision",
  "note",
] as const;

// =============================================================================
// Errors and warnings
// =============================================================================

export type BuildFileErrorCode =
  | "FILE_TOO_LARGE"
  | "FILE_EMPTY"
  | "NOT_JSON"
  | "NOT_AN_OBJECT"
  | "UNSUPPORTED_VERSION"
  | "TOO_MANY_NODES"
  | "TOO_MANY_EVENTS";

export interface BuildFileError {
  code: BuildFileErrorCode;
  message: string;
}

export type BuildFileWarningCode =
  | "INPUT_REPAIRED"
  | "NODES_NOT_ARRAY"
  | "EVENTS_NOT_ARRAY"
  | "NODE_UNREADABLE"
  | "EVENT_UNREADABLE"
  | "UNKNOWN_TYPE"
  | "UNKNOWN_FIELD"
  | "DEPTH_FLATTENED"
  | "FIELD_COERCION"
  | "UNKNOWN_ENUM_VALUE"
  | "UNKNOWN_EVENT_KIND"
  | "UNKNOWN_VISIBILITY";

/**
 * Thrown by the extraction stage so `extractEnvelope` can keep the plain
 * `unknown` return the callers want, while parseBuildFile still learns which
 * of the four refusals happened rather than a bare null.
 */
export class BuildFileExtractError extends Error {
  readonly code: BuildFileErrorCode;

  constructor(code: BuildFileErrorCode, message: string) {
    super(message);
    this.name = "BuildFileExtractError";
    this.code = code;
  }

  /** The same failure in the shape parseBuildFile returns. */
  get error(): BuildFileError {
    return { code: this.code, message: this.message };
  }
}

// =============================================================================
// Result
// =============================================================================

export interface BuildFileOrigin {
  /** The tool that wrote the file. Becomes every source_ref's `source`. */
  tool: string | null;
  session_hint: string | null;
  exported_at: string | null;
  /** Where the file says it came from — the credit a Rebuild has to carry. */
  source_url: string | null;
}

export interface BuildFileCost {
  setup: number | null;
  monthly: number | null;
  currency: string | null;
}

/**
 * The build header as the file states it.
 *
 * TranscriptProposal carries a proposed title and outcome and nothing else, so
 * the remaining eight header columns have nowhere to travel inside the
 * proposal. They are held here instead of being dropped: a file that names a
 * live URL, a cost and a stack has said something a creator would otherwise
 * have to retype, and "nothing is silently dropped" is not a rule that stops at
 * the shapes intake happens to model.
 */
export interface BuildFileHeader {
  title: string | null;
  outcome: string | null;
  shape: string | null;
  made_for: string[];
  made_with: string[];
  live_url: string | null;
  repo_url: string | null;
  cost: BuildFileCost | null;
  time_to_first_result: number | null;
}

export interface BuildFileCounts {
  nodes: number;
  events: number;
  /** Nodes and events together that the file marked as inferred. */
  inferred: number;
}

export interface BuildFileMeta {
  /** "extractor-v1", "compiler-v1", or null for a site export. */
  generated_by: string | null;
  origin: BuildFileOrigin;
  counts: BuildFileCounts;
  /** The same array as `proposal.warnings`, not a copy. */
  warnings: ParseWarning[];
  secrets: SecretWarning[];
  header: BuildFileHeader;
}

export interface BuildFileSuccess {
  ok: true;
  proposal: TranscriptProposal;
  meta: BuildFileMeta;
}

export interface BuildFileFailure {
  ok: false;
  errors: BuildFileError[];
}

export type BuildFileResult = BuildFileSuccess | BuildFileFailure;

/**
 * Narrowing helpers, and not a stylistic preference.
 *
 * This project compiles with `strictNullChecks: false`, and under that setting
 * TypeScript does not narrow a discriminated union on a boolean discriminant —
 * `if (result.ok)` leaves `result` as the union, so reading `result.proposal`
 * afterwards is a compile error. A user-defined type guard narrows regardless,
 * so these are what a caller has to reach for. Verified against the repository
 * tsconfig rather than assumed.
 */
export function buildFileParsed(result: BuildFileResult): result is BuildFileSuccess {
  return result.ok;
}

export function buildFileRefused(result: BuildFileResult): result is BuildFileFailure {
  return !result.ok;
}

export interface BuildFileOptions {
  /**
   * The id recorded in every source_ref. Generated per parse when absent.
   *
   * Worth passing deliberately: materialiseProposal treats it as the
   * idempotency key, so re-importing the same file under the same id
   * recognises the rows it already wrote instead of doubling them.
   */
  sessionId?: string;
}

// =============================================================================
// Small helpers
// =============================================================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** A non-empty trimmed string, or null. Blank strings are not content. */
function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && NUMERIC.test(value.trim())) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => readString(item))
    .filter((item): item is string => item !== null);
}

/** What a value is, for an error message a human reads. */
function describeValue(value: unknown): string {
  if (value === undefined) return "nothing";
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return "a list";
  return "an object";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `buildfile-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

// =============================================================================
// Stage one: getting to a JSON value
// =============================================================================

/** Doubles a model might have reached for instead of a straight quote. */
const SMART_DOUBLE = /[“”„‟″]/;
const SMART_SINGLE = /[‘’‚‛′]/;

/** ```lang\n …body… ``` — body captured lazily so nested prose cannot swallow it. */
const FENCE = /```([A-Za-z0-9_+-]*)[^\S\r\n]*\r?\n([\s\S]*?)```/g;

const NUMERIC = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

interface FencedBlock {
  language: string;
  body: string;
}

function fencedBlocks(text: string): FencedBlock[] {
  const blocks: FencedBlock[] = [];
  FENCE.lastIndex = 0;
  let match = FENCE.exec(text);
  while (match !== null) {
    blocks.push({ language: (match[1] ?? "").toLowerCase(), body: match[2] ?? "" });
    match = FENCE.exec(text);
  }
  // ```json first, in document order, then every other fence in document order.
  // A file that labels its fence has told us which one it means, and honouring
  // that beats letting an earlier ```text example win the race.
  return [
    ...blocks.filter((block) => block.language === "json"),
    ...blocks.filter((block) => block.language !== "json"),
  ];
}

/**
 * The two repairs, applied in one pass, and only to text that already failed
 * to parse.
 *
 * The scan tracks whether it is inside a STRING, because that is what decides
 * whether a curly quote is a delimiter a model got wrong or a punctuation mark
 * a human typed. `"it doesn't work"` written with a curly apostrophe is
 * content, and rewriting it would corrupt the very prose the file exists to
 * carry — so inside a straight-quoted string nothing is touched at all.
 *
 * A string OPENED by a smart quote is the case that needs care: its closing
 * smart quote has to be rewritten too, or the repair leaves behind a string
 * that never terminates. Hence the opener is remembered rather than merely the
 * fact of being inside one.
 */
function repairJson(text: string): string {
  let out = "";
  let opener: "straight" | "smart" | null = null;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (opener !== null) {
      if (escaped) {
        out += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        out += char;
        escaped = true;
        continue;
      }
      if (char === '"') {
        out += '"';
        opener = null;
        continue;
      }
      if (opener === "smart" && SMART_DOUBLE.test(char)) {
        out += '"';
        opener = null;
        continue;
      }
      out += char;
      continue;
    }

    if (char === '"') {
      out += char;
      opener = "straight";
      continue;
    }
    if (SMART_DOUBLE.test(char)) {
      out += '"';
      opener = "smart";
      continue;
    }
    if (SMART_SINGLE.test(char)) {
      out += "'";
      continue;
    }
    if (char === ",") {
      let ahead = i + 1;
      while (ahead < text.length && /\s/.test(text[ahead])) ahead += 1;
      // A comma with nothing but a closer after it is the trailing comma.
      if (text[ahead] === "}" || text[ahead] === "]") continue;
      out += char;
      continue;
    }

    out += char;
  }

  return out;
}

interface ParseAttempt {
  value: unknown;
  repaired: boolean;
}

/** One candidate: an honest parse, then at most one repaired retry. */
function tryParse(candidate: string): ParseAttempt | null {
  const trimmed = candidate.trim();
  if (!trimmed) return null;

  try {
    return { value: JSON.parse(trimmed), repaired: false };
  } catch {
    // Fall through to the one repair attempt.
  }

  const repaired = repairJson(trimmed);
  if (repaired === trimmed) return null;

  try {
    return { value: JSON.parse(repaired), repaired: true };
  } catch {
    return null;
  }
}

interface Extraction extends ParseAttempt {
  from: "bare" | "fence";
}

function extract(raw: string): Extraction {
  const text = typeof raw === "string" ? raw : "";

  // Before the parse, not after: the cap exists so an enormous paste is
  // refused rather than handed to JSON.parse to block the tab on.
  if (text.length > MAX_BUILDFILE_CHARS) {
    throw new BuildFileExtractError(
      "FILE_TOO_LARGE",
      `This file is ${text.length.toLocaleString()} characters. The limit is ${MAX_BUILDFILE_CHARS.toLocaleString()}.`
    );
  }
  if (!text.trim()) {
    throw new BuildFileExtractError("FILE_EMPTY", "This file is empty.");
  }

  // The bare object first. A site export is exactly that, and trying it before
  // any fence scanning means the well-formed case never depends on the regex.
  const bare = tryParse(text);
  if (bare) return { ...bare, from: "bare" };

  for (const block of fencedBlocks(text)) {
    const parsed = tryParse(block.body);
    if (parsed) return { ...parsed, from: "fence" };
  }

  throw new BuildFileExtractError(
    "NOT_JSON",
    "No JSON object could be read from this file. A Build File is one JSON object, on its own or inside a ```json block."
  );
}

/**
 * The envelope inside whatever the creator actually pasted.
 *
 * Accepts the bare object, the object inside a fenced block, and a fenced
 * block with prose on either side of it — the extractor is told to write a
 * human summary alongside its output, so prose around the fence is the normal
 * case rather than the degenerate one.
 *
 * Throws BuildFileExtractError. parseBuildFile catches it; a direct caller
 * that wants the codes should too.
 */
export function extractEnvelope(raw: string): unknown {
  return extract(raw).value;
}

// =============================================================================
// Stage two: the walk
// =============================================================================

interface Context {
  types: Map<string, NodeType>;
  warnings: ParseWarning[];
  sessionId: string;
  source: string;
  /** parentPath -> children allocated so far, which is what makes paths unique. */
  childCount: Map<string, number>;
  nodes: ProposedNode[];
}

/**
 * The only part of a parse Context that the field dialect itself needs.
 *
 * coerceField and splitPayload are the whole of this file's knowledge of the
 * six-type dialect, and NS-P50 needs that knowledge outside a Build File parse:
 * a bounty solution is a payload for one node type and has to be checked
 * against the same schema by the same rules. They take this narrower shape so
 * a caller with no session, no registry and no proposal can still run them.
 * A full Context satisfies it structurally, so nothing inside this file
 * changed hands.
 */
export interface FieldWarnings {
  warnings: ParseWarning[];
}

function warn(context: FieldWarnings, code: BuildFileWarningCode, message: string): void {
  context.warnings.push({ code, message });
}

function allocatePath(context: Context, parentPath: string): string {
  const next = (context.childCount.get(parentPath) ?? 0) + 1;
  context.childCount.set(parentPath, next);
  return parentPath ? `${parentPath}.${next}` : String(next);
}

/** The first `segments` levels of a path: trimPath("1.2.3", 2) === "1.2". */
function trimPath(path: string, segments: number): string {
  if (!path) return "";
  return path.split(".").slice(0, segments).join(".");
}

// --- payload -----------------------------------------------------------------

/** An unrecognised value as one line of note text, losing nothing. */
function asNoteValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * One value against one field of the six-type dialect.
 *
 * Coercion happens only where it is lossless — "0.7" into a number field is the
 * same value written differently, so it is corrected silently. Anything that
 * would require a judgement is left exactly as the file wrote it and warned
 * about instead. A parser that guessed here would be deciding what a creator
 * meant, and it has strictly less information than the creator does.
 */
export function coerceField(
  value: unknown,
  field: FieldDef,
  context: FieldWarnings,
  where: string
): unknown {
  if (value === null || value === undefined) return null;

  switch (field.type) {
    case "number": {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      const parsed = readNumber(value);
      if (parsed !== null) return parsed;
      warn(
        context,
        "FIELD_COERCION",
        `${where}: "${field.key}" expects a number but holds ${describeValue(value)}. It was kept as it was written.`
      );
      return value;
    }

    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const flag = value.trim().toLowerCase();
        if (flag === "true") return true;
        if (flag === "false") return false;
      }
      warn(
        context,
        "FIELD_COERCION",
        `${where}: "${field.key}" expects true or false but holds ${describeValue(value)}. It was kept as it was written.`
      );
      return value;
    }

    case "enum": {
      if (typeof value !== "string") {
        warn(
          context,
          "FIELD_COERCION",
          `${where}: "${field.key}" expects one of its listed options but holds ${describeValue(value)}. It was kept as it was written.`
        );
        return value;
      }
      const options = field.options ?? [];
      if (options.length > 0 && !options.includes(value)) {
        warn(
          context,
          "UNKNOWN_ENUM_VALUE",
          `${where}: "${field.key}" is "${value}", which is not one of ${options.join(", ")}. It was kept as it was written.`
        );
      }
      return value;
    }

    case "list": {
      if (!Array.isArray(value)) {
        warn(
          context,
          "FIELD_COERCION",
          `${where}: "${field.key}" expects a list but holds ${describeValue(value)}. It was kept as it was written.`
        );
        return value;
      }
      const members = field.of ?? [];
      if (members.length === 0) return value;
      const byKey = new Map(members.map((member) => [member.key, member]));
      return value.map((item) => {
        if (!isRecord(item)) return item;
        const out: Record<string, unknown> = {};
        for (const [key, member] of Object.entries(item)) {
          const definition = byKey.get(key);
          // A member key the schema does not declare stays where it is. It is
          // already nested, and hoisting it into the note would separate it
          // from the row it belongs to.
          out[key] = definition ? coerceField(member, definition, context, where) : member;
        }
        return out;
      });
    }

    case "string":
    case "text":
    default: {
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      warn(
        context,
        "FIELD_COERCION",
        `${where}: "${field.key}" expects text but holds ${describeValue(value)}. It was kept as it was written.`
      );
      return value;
    }
  }
}

export interface SplitPayload {
  payload: Record<string, unknown>;
  /** "key: value" lines for everything the schema did not declare. */
  extras: string[];
}

export function splitPayload(
  raw: unknown,
  fields: FieldDef[],
  context: FieldWarnings,
  where: string
): SplitPayload {
  const source = isRecord(raw) ? raw : {};
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const payload: Record<string, unknown> = {};
  const extras: string[] = [];
  const unknown: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    const field = byKey.get(key);
    if (!field) {
      unknown.push(key);
      extras.push(`${key}: ${asNoteValue(value)}`);
      continue;
    }
    payload[key] = coerceField(value, field, context, where);
  }

  // One warning naming every moved key, rather than one per key: a node whose
  // type was not recognised moves its whole payload, and a warning list longer
  // than the import itself is not a thing anyone reads.
  if (unknown.length > 0) {
    warn(
      context,
      "UNKNOWN_FIELD",
      `${where}: ${unknown.length} key${unknown.length === 1 ? "" : "s"} the schema does not declare (${unknown.join(", ")}) ${unknown.length === 1 ? "was" : "were"} moved into the note.`
    );
  }

  return { payload, extras };
}

// --- source_ref --------------------------------------------------------------

/**
 * The item's own provenance if it carries any, otherwise this parse's.
 *
 * `index` is an arrival index over the WHOLE file — every node first, in tree
 * order, then every event. That ordering is not cosmetic: materialiseProposal
 * links a node to the event whose index is the greatest one at or below the
 * node's, and a Build File genuinely does not say which event produced which
 * node. Numbering every node below every event makes that lookup find nothing,
 * which is the honest answer, where an interleaved numbering would invent a
 * link the file never claimed.
 */
function sourceRef(
  item: Record<string, unknown>,
  index: number,
  context: Context
): TranscriptSourceRef {
  const carried = isRecord(item.source_ref) ? item.source_ref : null;
  if (carried && typeof carried.session_id === "string" && typeof carried.index === "number") {
    return {
      source: readString(carried.source) ?? context.source,
      session_id: carried.session_id,
      index: carried.index,
    };
  }
  return { source: context.source, session_id: context.sessionId, index };
}

// --- nodes -------------------------------------------------------------------

/**
 * Every entry in the tree, children included, without building any of it.
 *
 * Iterative, and it stops counting once it is past the cap. Both matter for the
 * same reason: this runs BEFORE the cap is enforced, on a file that has been
 * parsed but not yet trusted. A recursive count would put the nesting depth of
 * an untrusted file on the call stack, and an exhaustive one would walk a
 * million nodes to report a number no caller reads. The return is exact up to
 * `limit` and only guaranteed to exceed it above that, which is all the cap
 * check needs.
 */
function countNodes(raw: unknown, limit = MAX_BUILDFILE_NODES): number {
  if (!Array.isArray(raw)) return 0;

  let total = 0;
  const pending: unknown[] = [...raw];

  while (pending.length > 0) {
    const entry = pending.pop();
    total += 1;
    if (total > limit) return total;
    // A loop, not push(...children): spreading an array of half a million
    // children into arguments is its own stack overflow.
    if (isRecord(entry) && Array.isArray(entry.children)) {
      for (const child of entry.children) pending.push(child);
    }
  }

  return total;
}

function proposeNode(
  entry: Record<string, unknown>,
  path: string,
  context: Context
): ProposedNode {
  const declared = readString(entry.type);
  const known = declared ? context.types.get(declared) : undefined;
  const type = known ? declared! : FALLBACK_NODE_TYPE;
  const where = `Node ${path}`;

  let title = readString(entry.title);

  if (!known) {
    warn(
      context,
      "UNKNOWN_TYPE",
      declared
        ? `${where}: "${declared}" is not a type this NeoScale knows. It was imported as a note and the type name kept in the title.`
        : `${where}: no type was given. It was imported as a note.`
    );
    // The name survives in the title rather than being thrown away: it is the
    // only record of what the file meant this node to be, and a creator
    // retyping it is a far smaller loss than a creator never learning it.
    if (declared) title = title ? `${declared}: ${title}` : declared;
  }

  const fields = context.types.get(type)?.schema.fields ?? [];
  const { payload, extras } = splitPayload(entry.payload, fields, context, where);

  const existing = readString(entry.note);
  const note = [existing, extras.length > 0 ? extras.join("\n") : null]
    .filter((part): part is string => part !== null)
    .join("\n\n");

  return {
    local_id: path,
    type,
    title,
    note: note ? note : null,
    payload,
    source_ref: sourceRef(entry, context.nodes.length, context),
    inferred: entry.inferred === true,
    inferred_reason: readString(entry.inferred_reason),
  };
}

/**
 * The tree, depth-first, into the flat list the proposal carries.
 *
 * `local_id` is the node's path — "1", "1.2", "1.2.1". A path is unique within
 * the file by construction, which is what local_id has to be, and it is the
 * only handle that still says something about where the node sat once the
 * proposal has flattened the tree. materialiseProposal records it on the row's
 * source_ref, so a second import of the same file recognises what it wrote.
 *
 * Depth is capped rather than refused. A node below the third level is
 * re-parented to the deepest ancestor that can still hold it and numbered
 * after that ancestor's existing children, so the file's ordering survives even
 * though its nesting does not.
 */
function walkNodes(
  raw: unknown,
  parentPath: string,
  depth: number,
  context: Context
): void {
  if (!Array.isArray(raw)) return;

  for (const entry of raw) {
    if (!isRecord(entry)) {
      warn(
        context,
        "NODE_UNREADABLE",
        `A node under ${parentPath ? `node ${parentPath}` : "the root"} is ${describeValue(entry)} rather than an object. It was skipped.`
      );
      continue;
    }

    const tooDeep = depth > MAX_NODE_DEPTH;
    const effectiveParent = tooDeep ? trimPath(parentPath, MAX_NODE_DEPTH - 1) : parentPath;
    const path = allocatePath(context, effectiveParent);

    if (tooDeep) {
      const stated = readString(entry.path);
      warn(
        context,
        "DEPTH_FLATTENED",
        `${stated ? `Node ${stated}` : `"${readString(entry.title) ?? "A node"}"`} sits deeper than ${MAX_NODE_DEPTH} levels. It was moved up to ${path}.`
      );
    }

    context.nodes.push(proposeNode(entry, path, context));
    walkNodes(entry.children, path, path.split(".").length + 1, context);
  }
}

// --- events ------------------------------------------------------------------

/**
 * ProposedEvent.payload is declared as exactly {text, response_summary} because
 * the transcript parser only ever produces those two. A Build File's event
 * payload is an open object, so this widens it: the file's payload is spread
 * first and the two declared keys written over the top, which satisfies the
 * declared shape without discarding the keys it does not mention. The extra
 * keys survive materialisation untouched — intake.ts spreads the payload whole
 * into the row.
 */
export type BuildFileEventPayload = ProposedEvent["payload"] & Record<string, unknown>;
type EventPayload = BuildFileEventPayload;

function eventPayload(
  source: Record<string, unknown>,
  phaseTitle: string | null
): EventPayload {
  let text = "";
  for (const key of EVENT_TEXT_KEYS) {
    const candidate = readString(source[key]);
    if (candidate) {
      text = candidate;
      break;
    }
  }

  const declared = readString(source.response_summary);
  const summary = readString(source.summary);
  const responseSummary = declared ?? (summary && summary !== text ? summary : null);

  const payload: EventPayload = { ...source, text, response_summary: responseSummary };

  // build_events HAS a phase_title column, but ProposedEvent has no field for
  // it and materialiseProposal writes no such column, so carrying it in the
  // payload is the only way it survives this module at all. Noted in the
  // NS-P32 handoff: promoting it to the column needs intake.ts widened.
  if (phaseTitle) payload.phase_title = phaseTitle;

  return payload;
}

function proposeEvent(
  entry: unknown,
  ordinal: number,
  index: number,
  context: Context
): ProposedEvent | null {
  if (!isRecord(entry)) {
    warn(
      context,
      "EVENT_UNREADABLE",
      `Event ${ordinal} is ${describeValue(entry)} rather than an object. It was skipped.`
    );
    return null;
  }

  const declaredKind = readString(entry.kind);
  const kinds: readonly string[] = EVENT_KINDS;
  const kind = declaredKind && kinds.includes(declaredKind) ? declaredKind : "note";
  if (kind !== declaredKind) {
    warn(
      context,
      "UNKNOWN_EVENT_KIND",
      declaredKind
        ? `Event ${ordinal}: "${declaredKind}" is not a kind this NeoScale records. It was imported as a note.`
        : `Event ${ordinal}: no kind was given. It was imported as a note.`
    );
  }

  const declaredVisibility = readString(entry.visibility);
  const visibilities: readonly string[] = EVENT_VISIBILITIES;
  let visibility: string = DEFAULT_EVENT_VISIBILITY;
  if (declaredVisibility) {
    if (visibilities.includes(declaredVisibility)) {
      visibility = declaredVisibility;
    } else {
      warn(
        context,
        "UNKNOWN_VISIBILITY",
        `Event ${ordinal}: "${declaredVisibility}" is not a visibility this NeoScale records. It was imported as ${DEFAULT_EVENT_VISIBILITY}.`
      );
    }
  }

  const source = isRecord(entry.payload) ? entry.payload : {};

  return {
    // Dense, in arrival order, across the whole file. A compiler file arrives
    // as one phase per source and its phases are NOT renumbered against each
    // other — the sequence is the file's sequence, with phase_title riding
    // along on the payload to say which phase each event came from.
    ordinal,
    kind,
    visibility,
    occurred_at: readString(source.occurred_at) ?? readString(entry.occurred_at),
    payload: eventPayload(source, readString(entry.phase_title)),
    source_ref: sourceRef(entry, index, context),
    inferred: entry.inferred === true,
    inferred_reason: readString(entry.inferred_reason),
  };
}

// --- header ------------------------------------------------------------------

function readHeader(raw: unknown): BuildFileHeader {
  const source = isRecord(raw) ? raw : {};
  const cost = isRecord(source.cost) ? source.cost : null;
  const setup = cost ? readNumber(cost.setup) : null;
  const monthly = cost ? readNumber(cost.monthly) : null;

  return {
    title: readString(source.title),
    outcome: readString(source.outcome),
    shape: readString(source.shape),
    made_for: readStringList(source.made_for),
    made_with: readStringList(source.made_with),
    live_url: readString(source.live_url),
    repo_url: readString(source.repo_url),
    cost: setup !== null || monthly !== null
      ? { setup, monthly, currency: cost ? readString(cost.currency) : null }
      : null,
    time_to_first_result: readNumber(source.time_to_first_result),
  };
}

function proposedField(
  value: string | null,
  index: number,
  context: Context
): ProposedField | null {
  if (!value) return null;
  return {
    value,
    // Stated by the file, not deduced from it, so inferred is false: the
    // creator is confirming something that was written down.
    source_ref: { source: context.source, session_id: context.sessionId, index },
    inferred: false,
    inferred_reason: null,
  };
}

// =============================================================================
// parseBuildFile
// =============================================================================

/**
 * A Build File as a proposal the existing intake review can materialise.
 *
 * `nodeTypes` is passed in rather than fetched: getNodeTypes is async and
 * caches per session, the caller has already loaded the registry to render the
 * review, and a pure function is the only version of this that a test can drive
 * against a two-row registry.
 */
export function parseBuildFile(
  raw: string,
  nodeTypes: NodeType[],
  options: BuildFileOptions = {}
): BuildFileResult {
  let extraction: Extraction;
  try {
    extraction = extract(raw);
  } catch (cause) {
    if (cause instanceof BuildFileExtractError) return { ok: false, errors: [cause.error] };
    throw cause;
  }

  const envelope = extraction.value;
  if (!isRecord(envelope)) {
    return {
      ok: false,
      errors: [
        {
          code: "NOT_AN_OBJECT",
          message: `A Build File is one JSON object. This file holds ${describeValue(envelope)}.`,
        },
      ],
    };
  }

  const version = envelope.neoscale_build;
  const versionOk =
    version === PORTABLE_FORMAT_VERSION ||
    (typeof version === "string" && version.trim() === String(PORTABLE_FORMAT_VERSION));
  if (!versionOk) {
    return {
      ok: false,
      errors: [
        {
          code: "UNSUPPORTED_VERSION",
          message: `This file declares neoscale_build ${describeValue(version)}. This version of NeoScale reads format ${PORTABLE_FORMAT_VERSION}.`,
        },
      ],
    };
  }

  // Counts are checked together so a file over both caps is told both at once
  // rather than sent back twice.
  const nodeTotal = countNodes(envelope.nodes);
  const eventTotal = Array.isArray(envelope.events) ? envelope.events.length : 0;
  const capErrors: BuildFileError[] = [];
  if (nodeTotal > MAX_BUILDFILE_NODES) {
    capErrors.push({
      code: "TOO_MANY_NODES",
      message: `This file holds ${nodeTotal.toLocaleString()} nodes. The limit is ${MAX_BUILDFILE_NODES.toLocaleString()}.`,
    });
  }
  if (eventTotal > MAX_BUILDFILE_EVENTS) {
    capErrors.push({
      code: "TOO_MANY_EVENTS",
      message: `This file holds ${eventTotal.toLocaleString()} events. The limit is ${MAX_BUILDFILE_EVENTS.toLocaleString()}.`,
    });
  }
  if (capErrors.length > 0) return { ok: false, errors: capErrors };

  const originSource = isRecord(envelope.origin) ? envelope.origin : {};
  const origin: BuildFileOrigin = {
    tool: readString(originSource.tool),
    session_hint: readString(originSource.session_hint),
    exported_at: readString(originSource.exported_at) ?? readString(envelope.exported_at),
    source_url: readString(originSource.source_url) ?? readString(envelope.source_url),
  };

  const context: Context = {
    types: new Map(nodeTypes.map((type) => [type.key, type])),
    warnings: [],
    sessionId: options.sessionId ?? newSessionId(),
    source: origin.tool ?? BUILDFILE_SOURCE,
    childCount: new Map(),
    nodes: [],
  };

  if (extraction.repaired) {
    warn(
      context,
      "INPUT_REPAIRED",
      "This file was not valid JSON as written. Trailing commas and smart quotes were corrected before reading it."
    );
  }

  if (envelope.nodes !== undefined && !Array.isArray(envelope.nodes)) {
    warn(
      context,
      "NODES_NOT_ARRAY",
      `"nodes" is ${describeValue(envelope.nodes)} rather than a list. No nodes were read.`
    );
  }
  if (envelope.events !== undefined && !Array.isArray(envelope.events)) {
    warn(
      context,
      "EVENTS_NOT_ARRAY",
      `"events" is ${describeValue(envelope.events)} rather than a list. No events were read.`
    );
  }

  walkNodes(envelope.nodes, "", 1, context);

  const events: ProposedEvent[] = [];
  if (Array.isArray(envelope.events)) {
    envelope.events.forEach((entry, offset) => {
      const proposed = proposeEvent(
        entry,
        events.length + 1,
        context.nodes.length + offset,
        context
      );
      if (proposed) events.push(proposed);
    });
  }

  const header = readHeader(envelope.build);
  const headerIndex = context.nodes.length + events.length;

  const summary: ProposalSummary = {
    session_id: context.sessionId,
    source_hint: readString(envelope.generated_by) ?? origin.tool,
    detected_format: BUILDFILE_SOURCE,
    // A Build File has no turns and no speakers. Reporting zeroes says that,
    // where inventing a turn count would put a number the file never contained
    // in front of the creator.
    detected_labels: { user: [], assistant: [] },
    turn_count: 0,
    user_turn_count: 0,
    assistant_turn_count: 0,
    event_count: events.length,
    node_count: context.nodes.length,
    character_count: raw.length,
    line_count: raw.split("\n").length,
    proposed_title: proposedField(header.title, headerIndex, context),
    proposed_outcome: proposedField(header.outcome, headerIndex + 1, context),
  };

  const proposal: TranscriptProposal = {
    events,
    nodes: context.nodes,
    summary,
    warnings: context.warnings,
  };

  const inferred =
    context.nodes.filter((node) => node.inferred).length +
    events.filter((event) => event.inferred).length;

  return {
    ok: true,
    proposal,
    meta: {
      generated_by: readString(envelope.generated_by),
      origin,
      counts: { nodes: context.nodes.length, events: events.length, inferred },
      warnings: context.warnings,
      secrets: scanForSecrets(proposal),
      header,
    },
  };
}

// =============================================================================
// Secrets
// =============================================================================

export type SecretKind =
  | "openai_key"
  | "aws_access_key"
  | "github_token"
  | "slack_token"
  | "private_key"
  | "env_line"
  | "high_entropy_token";

export interface SecretWarning {
  kind: SecretKind;
  where: "node" | "event";
  /** A node's local_id, or an event's ordinal as a string. */
  ref: string;
  /** The payload key path — "params", "variables[0].example" — or "note". */
  field: string;
  /** The match with its middle replaced, so a log of this leaks nothing. */
  excerpt: string;
}

interface SecretPattern {
  kind: SecretKind;
  pattern: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { kind: "openai_key", pattern: /sk-[A-Za-z0-9_-]{16,}/g },
  { kind: "aws_access_key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "github_token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { kind: "slack_token", pattern: /\bxox[abp]-[A-Za-z0-9-]{10,}/g },
  { kind: "private_key", pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g },
  { kind: "env_line", pattern: /^[A-Z0-9_]{3,}=\S+/gm },
];

/**
 * base64ish, at least 32 long, not part of a longer word.
 *
 * The leading boundary is a captured group rather than a lookbehind on purpose:
 * a regex LITERAL is compiled when this module loads, so a lookbehind here
 * would throw on load — taking the whole bundle with it — in any browser that
 * does not support one, rather than merely failing this scan.
 */
const TOKEN_PATTERN = /(^|[^\w-])([A-Za-z0-9+/=_-]{32,})(?![\w-])/g;

/** Bits per character. A key is near-uniform; a sentence is not. */
function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * A long token that is probably not a word.
 *
 * Both classes are required because the pattern's character set matches long
 * prose words and long hyphenated slugs too, and neither of those is worth
 * putting in front of a creator as a possible credential.
 */
function looksLikeSecret(token: string): boolean {
  if (!/[0-9]/.test(token)) return false;
  if (!/[A-Za-z]/.test(token)) return false;
  return shannonEntropy(token) >= 3.5;
}

function maskValue(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length);
  const head = value.slice(0, 4);
  const tail = value.slice(-2);
  return `${head}${"•".repeat(Math.min(12, value.length - 6))}${tail}`;
}

/** An env line keeps its variable name — that is the useful half of the alert. */
function excerptFor(kind: SecretKind, match: string): string {
  const bounded = match.length > 120 ? match.slice(0, 120) : match;
  if (kind === "private_key") return bounded;
  if (kind === "env_line") {
    const split = bounded.indexOf("=");
    if (split > 0) return `${bounded.slice(0, split + 1)}${maskValue(bounded.slice(split + 1))}`;
  }
  return maskValue(bounded);
}

interface Finding {
  kind: SecretKind;
  start: number;
  end: number;
  match: string;
}

function findingsIn(value: string): Finding[] {
  const findings: Finding[] = [];

  for (const { kind, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(value);
    while (match !== null) {
      findings.push({ kind, start: match.index, end: match.index + match[0].length, match: match[0] });
      // A zero-length match would spin here. The patterns cannot produce one,
      // but the guard costs nothing and the failure would be a hung tab.
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
      match = pattern.exec(value);
    }
  }

  // The entropy sweep runs last and yields to anything already named: an
  // OpenAI key is also a long base64ish token, and reporting it twice under
  // two labels makes the list look worse than the file is.
  TOKEN_PATTERN.lastIndex = 0;
  let token = TOKEN_PATTERN.exec(value);
  while (token !== null) {
    const matched = token[2];
    const start = token.index + token[1].length;
    const end = start + matched.length;
    const covered = findings.some((finding) => start >= finding.start && end <= finding.end);
    if (!covered && looksLikeSecret(matched)) {
      findings.push({ kind: "high_entropy_token", start, end, match: matched });
    }
    if (token.index === TOKEN_PATTERN.lastIndex) TOKEN_PATTERN.lastIndex += 1;
    token = TOKEN_PATTERN.exec(value);
  }

  return findings;
}

/**
 * The payload dialect nests one level deep. This allows twelve, so a
 * hand-written payload is swept whole, and refuses to go further rather than
 * putting an untrusted file's nesting on the call stack.
 */
const MAX_SWEEP_DEPTH = 12;

function sweep(
  value: unknown,
  field: string,
  where: "node" | "event",
  ref: string,
  into: SecretWarning[],
  depth = 0
): void {
  if (into.length >= MAX_SECRET_FINDINGS || depth > MAX_SWEEP_DEPTH) return;

  if (typeof value === "string") {
    for (const finding of findingsIn(value)) {
      if (into.length >= MAX_SECRET_FINDINGS) return;
      into.push({
        kind: finding.kind,
        where,
        ref,
        field,
        excerpt: excerptFor(finding.kind, finding.match),
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      sweep(item, `${field}[${index}]`, where, ref, into, depth + 1)
    );
    return;
  }

  if (isRecord(value)) {
    for (const [key, member] of Object.entries(value)) {
      sweep(member, field ? `${field}.${key}` : key, where, ref, into, depth + 1);
    }
  }
}

/**
 * Every string in the proposal that looks like a credential.
 *
 * This never blocks a parse and never edits a payload. A creator pasting their
 * own working config is the common case, the regexes cannot tell a live key
 * from an example one, and a parser that stripped what it suspected would be
 * silently editing the build. NS-P34 shows these before the write, which is the
 * moment a human can actually make the call.
 *
 * Node NOTES are swept as well as payloads, because an unrecognised payload key
 * is moved into the note by the rules above — a secret under a key the schema
 * did not declare would otherwise walk straight past this.
 */
export function scanForSecrets(proposal: TranscriptProposal): SecretWarning[] {
  const found: SecretWarning[] = [];

  for (const node of proposal.nodes) {
    sweep(node.payload, "", "node", node.local_id, found);
    if (node.note) sweep(node.note, "note", "node", node.local_id, found);
  }

  for (const event of proposal.events) {
    sweep(event.payload, "", "event", String(event.ordinal), found);
  }

  return found;
}
