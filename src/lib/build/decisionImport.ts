// CA-13 Part 2: "Paste a logged request and response", pure.
//
// `parseDecisionCall(text)` reads a Decision's questions, the state it was given and, when a response came with it, one real
// answer. It NEVER runs or evaluates code, and reads only the shapes below. Its order of trust:
//   1. The JSON request body and the JSON response. These are reliable; an app's logs or the TypeSafe playground give them.
//   2. curl with an inline --data body.
//   3. Python using typesafe_sdk's Choice, Score and Noul, as a best try, only when every value is written out literally.
//      Real code often builds questions from variables; then it says so and refuses.
// It refuses with a plain line when it cannot read the text. Any key in the text is removed before anything is read, and the
// caller is told, so it is never stored or shown.

import { isCall, PyReader, type Py } from "./pyLiteral";
import {
  INSTRUCTIONS_MAX,
  LEVEL_MAX,
  OPTION_KEY_MAX,
  OPTION_LINE_MAX,
  QUESTION_ID_MAX,
  STATE_SAMPLE_MAX,
  type DecisionAnswer,
  type DecisionOption,
  type DecisionQuestion,
  type QuestionType,
  questionsRefusal,
} from "./decision";

export interface DecisionImport {
  model?: string;
  questions: DecisionQuestion[];
  stateSample?: string;
  /** One real answer, when a response came with the request. */
  answer?: Record<string, DecisionAnswer>;
  /** True when a key was found and taken out of the text. */
  keyRemoved: boolean;
}

export type DecisionParse = { ok: true; value: DecisionImport } | { ok: false; reason: string; keyRemoved: boolean };

export const KEY_REMOVED_LINE = "Your key was removed; it is never stored.";
export const BUILT_IN_CODE_LINE = "These questions are built in code, so they can't be read safely. Paste a logged request instead, or fill them in.";
export const NOTHING_READ_LINE = "That does not look like a Decision request. Paste the JSON body that was sent, a curl command, or the Python that calls it with every value written out.";
export const RESPONSE_ONLY_LINE = "That looks like an answer with no request. Paste the request too, so the questions can be read.";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// --- keys ---------------------------------------------------------------------

const PLACEHOLDER = /^(\$|\{|<|\[removed\]|os\.environ|process\.env|env\b|your[_-]|xxx)/i;

/** The text with every key taken out, and whether there was one. A placeholder such as $TYPESAFE_API_KEY is not a key. */
export function removeKeys(text: string): { text: string; removed: boolean } {
  let removed = false;
  const hide = (replacement: string) => {
    removed = true;
    return replacement;
  };
  let out = text.replace(/(authorization["']?\s*[:=]\s*["']?)(bearer\s+)?([^\s"',}\\]+)/gi, (all, head: string, bearer: string | undefined, value: string) =>
    PLACEHOLDER.test(value) ? all : hide(`${head}${bearer ?? ""}[removed]`),
  );
  out = out.replace(/\bbearer\s+([A-Za-z0-9._\-]{8,})/gi, (all, value: string) => (PLACEHOLDER.test(value) ? all : hide("Bearer [removed]")));
  out = out.replace(/\b(TYPESAFE_API_KEY|SCALEDOWN_API_KEY|api[_-]?key|x-api-key)(["']?\s*[:=]\s*["']?)([A-Za-z0-9._\-]{8,})/gi, (all, name: string, glue: string, value: string) =>
    PLACEHOLDER.test(value) ? all : hide(`${name}${glue}[removed]`),
  );
  out = out.replace(/\b(?:sk|tsk|sd)[-_][A-Za-z0-9_\-]{16,}/g, () => hide("[removed]"));
  return { text: out, removed };
}

// --- JSON ---------------------------------------------------------------------

/** Every top-level JSON object or array in the text, in order: the whole text when it is one document, else balanced blocks. */
function jsonDocuments(text: string): unknown[] {
  const whole = tryJson(text.trim());
  if (whole !== undefined) return [whole];
  const out: unknown[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text[i];
    if (open !== "{" && open !== "[") {
      i += 1;
      continue;
    }
    const end = balancedEnd(text, i);
    if (end < 0) {
      i += 1;
      continue;
    }
    const parsed = tryJson(text.slice(i, end + 1));
    if (parsed !== undefined) {
      out.push(parsed);
      i = end + 1;
    } else i += 1;
  }
  return out;
}

const tryJson = (text: string): unknown | undefined => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** The index of the bracket that closes the one at `start`, skipping strings; -1 when it never closes. */
function balancedEnd(text: string, start: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"') quote = ch;
    else if (ch === "{" || ch === "[") depth += 1;
    else if (ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const cut = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");

const typeOf = (raw: Record<string, unknown>): QuestionType | null => {
  const named = typeof raw.type === "string" ? raw.type.toLowerCase().replace(/[\s_-]/g, "") : "";
  if (named === "choice" || named === "select") return "choice";
  if (named === "score" || named === "scale" || named === "ordinal") return "score";
  if (named === "noul" || named === "yesno" || named === "boolean" || named === "bool") return "yesno";
  if (raw.options !== undefined || raw.choices !== undefined) return "choice";
  if (raw.levels !== undefined || raw.scale !== undefined || raw.labels !== undefined) return "score";
  return null;
};

function optionsOf(raw: unknown): DecisionOption[] {
  const entries: [unknown, unknown][] = Array.isArray(raw)
    ? raw.map((entry): [unknown, unknown] => (isRecord(entry) ? [entry.key ?? entry.name ?? entry.id ?? entry.value ?? entry.label, entry.line ?? entry.description ?? entry.instructions] : [entry, undefined]))
    : isRecord(raw)
      ? Object.entries(raw)
      : [];
  return entries.flatMap(([key, line]): DecisionOption[] => {
    const k = cut(key, OPTION_KEY_MAX);
    const l = cut(line, OPTION_LINE_MAX);
    return k ? [{ key: k, ...(l ? { line: l } : null) }] : [];
  });
}

const levelsOf = (raw: unknown): string[] => (Array.isArray(raw) ? raw.flatMap((level) => (typeof level === "string" || typeof level === "number" ? [cut(String(level), LEVEL_MAX)] : [])).filter(Boolean) : []);

/** One question from its logged form, or null when it cannot be told what kind it is. */
function questionFrom(id: string, raw: unknown): DecisionQuestion | null {
  const name = id.trim().slice(0, QUESTION_ID_MAX);
  if (!name) return null;
  if (typeof raw === "string") return null;
  if (!isRecord(raw)) return null;
  const type = typeOf(raw);
  if (!type) return null;
  const instructions = cut(raw.instructions ?? raw.instruction ?? raw.prompt ?? raw.description ?? raw.question, INSTRUCTIONS_MAX);
  if (type === "choice") return { id: name, type, instructions, options: optionsOf(raw.options ?? raw.choices) };
  if (type === "score") return { id: name, type, instructions, levels: levelsOf(raw.levels ?? raw.scale ?? raw.labels) };
  return { id: name, type, instructions };
}

function questionsFrom(raw: unknown): DecisionQuestion[] {
  if (Array.isArray(raw)) return raw.flatMap((entry) => (isRecord(entry) ? [questionFrom(String(entry.name ?? entry.id ?? entry.key ?? ""), entry)] : [])).filter((q): q is DecisionQuestion => q !== null);
  if (isRecord(raw)) return Object.entries(raw).map(([id, entry]) => questionFrom(id, entry)).filter((q): q is DecisionQuestion => q !== null);
  return [];
}

const stateOf = (raw: unknown): string | undefined => {
  if (raw === undefined || raw === null) return undefined;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw, null, 2);
  return text.trim() ? text.slice(0, STATE_SAMPLE_MAX) : undefined;
};

/** Whether a JSON document is a request: it carries questions. */
const isRequest = (doc: unknown): doc is Record<string, unknown> => isRecord(doc) && doc.questions !== undefined;

/** A request may sit inside a log's wrapper: { request: {...} } or { body: {...} }. */
function requestIn(doc: unknown): Record<string, unknown> | null {
  if (isRequest(doc)) return doc;
  if (isRecord(doc)) {
    for (const key of ["request", "body", "input", "payload", "data"]) {
      const inner = doc[key];
      if (isRequest(inner)) return inner;
      if (typeof inner === "string") {
        const parsed = tryJson(inner);
        if (isRequest(parsed)) return parsed;
      }
    }
  }
  return null;
}

const probabilitiesOf = (raw: unknown, q: DecisionQuestion): Record<string, number> | undefined => {
  let entries: [string, unknown][] = [];
  if (isRecord(raw)) entries = Object.entries(raw);
  else if (Array.isArray(raw) && q.type === "score") entries = raw.map((p, i): [string, unknown] => [(q.levels ?? [])[i] ?? String(i), p]);
  else if (Array.isArray(raw) && q.type === "choice") entries = raw.map((p, i): [string, unknown] => [(q.options ?? [])[i]?.key ?? String(i), p]);
  const out = Object.fromEntries(entries.filter(([, p]) => typeof p === "number" && Number.isFinite(p) && p >= 0 && p <= 1));
  return Object.keys(out).length ? (out as Record<string, number>) : undefined;
};

/** One answer, read against its question; undefined when it holds nothing usable. */
function answerFrom(q: DecisionQuestion, raw: unknown): DecisionAnswer | undefined {
  if (!isRecord(raw)) {
    if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return answerFrom(q, { answer: raw });
    return undefined;
  }
  const probabilities = probabilitiesOf(raw.probabilities ?? raw.probs ?? raw.distribution, q);
  const confidenceRaw = raw.confidence;
  const confidence = typeof confidenceRaw === "number" && confidenceRaw >= 0 && confidenceRaw <= 1 ? confidenceRaw : undefined;
  let said = raw.answer ?? raw.value ?? raw.choice ?? raw.label ?? raw.score ?? raw.result;
  if (said === undefined && probabilities && q.type !== "yesno") said = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
  let value: string | number | undefined;
  if (q.type === "choice") value = typeof said === "string" || typeof said === "number" ? String(said) : undefined;
  else if (q.type === "score") {
    const levels = q.levels ?? [];
    if (typeof said === "string" && levels.includes(said)) value = levels.indexOf(said);
    else if (typeof said === "number" && Number.isInteger(said) && said >= 0 && said < levels.length) value = said;
    else if (typeof said === "string" && /^\d+$/.test(said) && Number(said) < levels.length) value = Number(said);
  } else if (typeof said === "number" && said >= 0 && said <= 1) value = said;
  else if (typeof said === "boolean") value = said ? 1 : 0;
  else if (typeof said === "string" && /^(yes|true)$/i.test(said)) value = 1;
  else if (typeof said === "string" && /^(no|false)$/i.test(said)) value = 0;
  if (value === undefined) return undefined;
  return { value, ...(probabilities ? { probabilities } : null), ...(confidence !== undefined ? { confidence } : null) };
}

/** The answers in a response document, for the questions of the request; undefined when none matched. */
function answersFrom(questions: readonly DecisionQuestion[], doc: unknown): Record<string, DecisionAnswer> | undefined {
  if (!isRecord(doc)) return undefined;
  const inner = [doc.answers, doc.results, doc.output, doc.response, doc].find((candidate) => isRecord(candidate) && questions.some((q) => candidate[q.id] !== undefined));
  if (!isRecord(inner)) return undefined;
  const out: Record<string, DecisionAnswer> = {};
  for (const q of questions) {
    const answer = answerFrom(q, inner[q.id]);
    if (answer) out[q.id] = answer;
  }
  return Object.keys(out).length ? out : undefined;
}

function fromJsonDocs(docs: unknown[], keyRemoved: boolean): DecisionParse | null {
  const request = docs.map(requestIn).find((doc) => doc !== null) ?? null;
  if (!request) return null;
  const questions = questionsFrom(request.questions);
  if (questions.length === 0) return { ok: false, reason: "The questions in that request could not be read. Each needs a type (choice, score or noul), with its options or levels.", keyRemoved };
  const answer = docs.filter((doc) => !isRequest(doc) && requestIn(doc) === null).map((doc) => answersFrom(questions, doc)).find((found) => found !== undefined);
  const state = stateOf(request.state ?? request.input ?? request.context);
  return finish({ model: cut(request.model, 80) || undefined, questions, ...(state ? { stateSample: state } : null), ...(answer ? { answer } : null), keyRemoved });
}

/** Last check: the questions must be savable as they are. */
function finish(value: DecisionImport): DecisionParse {
  const problem = questionsRefusal(value.questions);
  if (problem) return { ok: false, reason: `${problem}.`, keyRemoved: value.keyRemoved };
  return { ok: true, value };
}

// --- curl ---------------------------------------------------------------------

/** The bodies a curl command sends inline: the quoted argument of --data, --data-raw, --data-binary or -d. */
function curlBodies(text: string): string[] {
  const out: string[] = [];
  const pattern = /(?:--data(?:-raw|-binary|-ascii)?|-d)\s+(['"])/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const quote = match[1];
    const start = match.index + match[0].length;
    let i = start;
    let body = "";
    while (i < text.length) {
      const ch = text[i];
      if (quote === '"' && ch === "\\" && i + 1 < text.length) {
        body += text[i + 1];
        i += 2;
        continue;
      }
      if (quote === "'" && text.startsWith("'\\''", i)) {
        body += "'";
        i += 4;
        continue;
      }
      if (ch === quote) break;
      body += ch;
      i += 1;
    }
    out.push(body);
  }
  return out;
}

// --- Python -------------------------------------------------------------------


/** A literal Python question (Choice, Score or Noul) as a request-shaped record, so the JSON reader reads it. */
function pyQuestion(value: Py): unknown {
  if (!isCall(value)) return value;
  const type = value.call === "Choice" ? "choice" : value.call === "Score" ? "score" : "noul";
  const first = typeof value.args[0] === "string" ? value.args[0] : undefined;
  return { type, instructions: value.kwargs.instructions ?? value.kwargs.instruction ?? first, ...value.kwargs };
}

function fromPython(text: string, keyRemoved: boolean): DecisionParse | null {
  if (!/\b(?:Choice|Score|Noul)\s*\(/.test(text)) return null;
  const at = /\bquestions\s*[=:]\s*/.exec(text);
  if (!at) return { ok: false, reason: BUILT_IN_CODE_LINE, keyRemoved };
  let value: Py;
  try {
    value = new PyReader(text, at.index + at[0].length).value();
  } catch {
    return { ok: false, reason: BUILT_IN_CODE_LINE, keyRemoved };
  }
  if (!isRecord(value) || isCall(value)) return { ok: false, reason: BUILT_IN_CODE_LINE, keyRemoved };
  const record = Array.isArray(value) ? null : (value as { [key: string]: Py });
  if (!record) return { ok: false, reason: BUILT_IN_CODE_LINE, keyRemoved };
  const questions = questionsFrom(Object.fromEntries(Object.entries(record).map(([id, q]) => [id, pyQuestion(q)])));
  if (questions.length === 0) return { ok: false, reason: BUILT_IN_CODE_LINE, keyRemoved };
  const literal = (name: string): string | undefined => {
    const found = new RegExp(`\\b${name}\\s*=\\s*`).exec(text);
    if (!found) return undefined;
    try {
      const v = new PyReader(text, found.index + found[0].length).value();
      return typeof v === "string" ? v : undefined;
    } catch {
      return undefined;
    }
  };
  const state = literal("state");
  const model = literal("model");
  return finish({ ...(model ? { model: model.slice(0, 80) } : null), questions, ...(state ? { stateSample: state.slice(0, STATE_SAMPLE_MAX) } : null), keyRemoved });
}

// --- the entry ----------------------------------------------------------------

/**
 * Read a pasted request, request and response, curl command or literal Python. Pure: nothing is run, fetched or stored.
 * `keyRemoved` says a key was found; show KEY_REMOVED_LINE. A pasted state sample is passed through the same key removal.
 */
export function parseDecisionCall(input: string): DecisionParse {
  const { text, removed } = removeKeys(input);
  if (!text.trim()) return { ok: false, reason: NOTHING_READ_LINE, keyRemoved: removed };

  // 1. JSON documents, and the JSON bodies a curl command sends (with the rest of the text, where a response may follow).
  const bodies = curlBodies(text).map(tryJson).filter((doc): doc is NonNullable<unknown> => doc !== undefined);
  const docs = [...bodies, ...jsonDocuments(text)];
  const fromJson = fromJsonDocs(docs, removed);
  if (fromJson) return fromJson;

  // 3. Python, best try.
  const fromPy = fromPython(text, removed);
  if (fromPy) return fromPy;

  // A response with no request is a different mistake from text that is not a Decision at all.
  if (docs.some((doc) => isRecord(doc) && (doc.answers !== undefined || doc.probabilities !== undefined || JSON.stringify(doc).includes('"confidence"')))) {
    return { ok: false, reason: RESPONSE_ONLY_LINE, keyRemoved: removed };
  }
  return { ok: false, reason: NOTHING_READ_LINE, keyRemoved: removed };
}
