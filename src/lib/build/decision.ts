// CA-13 Part 2 and 3: the Decision tile and "Runs when", pure.
//
// A DECISION is a small typed model an app asks (TypeSafe Jev, or an ordinary model made to answer in a shape): a state
// goes in, and each named question comes back with a typed answer and, where known, how sure it was. It belongs to how
// the finished thing RUNS, not to the steps the maker took, so only runtime tiles (agents, teams, code, tools, decisions)
// can branch on it (`RUNS_WHEN_KINDS`). Nothing here runs or evaluates anything.
//
// Stored in `build_nodes.payload` (type `decision`); `decisionOf` reads it defensively, so a payload with a bad part
// reads as less, never as an error.

import { toolName } from "@/lib/tools/registry";

export const DECISION_TYPE = "decision";

export type QuestionType = "choice" | "score" | "yesno";

export interface DecisionOption {
  key: string;
  line?: string;
}

export interface DecisionQuestion {
  /** The name the app used: "team". */
  id: string;
  type: QuestionType;
  instructions: string;
  /** Choice: 2 to 255. */
  options?: DecisionOption[];
  /** Score: lowest to highest, 2 to 20. */
  levels?: string[];
}

export interface DecisionAnswer {
  /** A choice's key, a score's level index (0 is the lowest), or 0..1 for yes or no. */
  value: string | number;
  probabilities?: Record<string, number>;
  /** 0..1. */
  confidence?: number;
}

/** Where an answer and its figures came from. "original" is the maker's answer on a build someone copied. */
export type AnswerSource = "run" | "maker" | "original";

export interface DecisionFacts {
  provider: string;
  model: string;
  via?: "api" | "adapter";
  /** The Code tiles that make the call (rule 4). */
  calledFrom: string[];
  /** The step the state came from (a Uses link), or null when typed. */
  stateFrom: string | null;
  stateSample?: string;
  questions: DecisionQuestion[];
  /** One real answer, optional. */
  answer?: Record<string, DecisionAnswer>;
  /** CA-13 P15: the original's answer on a copied build. It is never the copier's result. */
  expected?: Record<string, DecisionAnswer>;
  source?: AnswerSource;
  /** "How to install, optional", exactly as the maker gave it. */
  install?: string;
}

export const QUESTIONS_MIN = 1;
export const QUESTIONS_MAX = 20;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 255;
export const LEVELS_MIN = 2;
export const LEVELS_MAX = 20;
export const STATE_SAMPLE_MAX = 8000;
export const QUESTION_ID_MAX = 40;
export const INSTRUCTIONS_MAX = 600;
export const OPTION_KEY_MAX = 80;
export const OPTION_LINE_MAX = 200;
export const LEVEL_MAX = 60;
export const INSTALL_MAX = 400;

/** Below this share the words read "unsure". */
export const UNSURE_BELOW = 0.6;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);
const unit = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined);

// --- reading ------------------------------------------------------------------

function questionOf(raw: unknown): DecisionQuestion | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id)?.trim().slice(0, QUESTION_ID_MAX);
  if (!id || !["choice", "score", "yesno"].includes(raw.type as string)) return null;
  const type = raw.type as QuestionType;
  const question: DecisionQuestion = { id, type, instructions: (str(raw.instructions) ?? "").slice(0, INSTRUCTIONS_MAX) };
  if (type === "choice") {
    const options = (Array.isArray(raw.options) ? raw.options : []).flatMap((entry): DecisionOption[] => {
      if (!isRecord(entry)) return [];
      const key = str(entry.key)?.trim().slice(0, OPTION_KEY_MAX);
      const line = str(entry.line)?.trim().slice(0, OPTION_LINE_MAX);
      return key ? [{ key, ...(line ? { line } : null) }] : [];
    });
    question.options = options.slice(0, OPTIONS_MAX);
  } else if (type === "score") {
    question.levels = (Array.isArray(raw.levels) ? raw.levels : []).flatMap((entry) => (str(entry) ? [(entry as string).trim().slice(0, LEVEL_MAX)] : [])).slice(0, LEVELS_MAX);
  }
  return question;
}

function answersOf(raw: unknown): Record<string, DecisionAnswer> | undefined {
  if (!isRecord(raw)) return undefined;
  const out: Record<string, DecisionAnswer> = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) continue;
    const value = typeof entry.value === "number" && Number.isFinite(entry.value) ? entry.value : str(entry.value);
    if (value === null) continue;
    const probabilities = isRecord(entry.probabilities)
      ? Object.fromEntries(Object.entries(entry.probabilities).flatMap(([key, p]) => (unit(p) !== undefined ? [[key, p as number]] : [])))
      : undefined;
    const confidence = unit(entry.confidence);
    out[id] = { value, ...(probabilities && Object.keys(probabilities).length ? { probabilities } : null), ...(confidence !== undefined ? { confidence } : null) };
  }
  return Object.keys(out).length ? out : undefined;
}

/** A decision node's facts, read defensively; null when the payload holds no question at all. */
export function decisionOf(payload: unknown): DecisionFacts | null {
  if (!isRecord(payload)) return null;
  const questions = (Array.isArray(payload.questions) ? payload.questions : []).flatMap((raw) => {
    const q = questionOf(raw);
    return q ? [q] : [];
  }).slice(0, QUESTIONS_MAX);
  if (questions.length === 0) return null;
  const calledFrom = (Array.isArray(payload.called_from) ? payload.called_from : []).filter((id): id is string => typeof id === "string" && id.length > 0);
  const answer = answersOf(payload.answer);
  const expected = answersOf(payload.expected);
  const source = ["run", "maker", "original"].includes(payload.source as string) ? (payload.source as AnswerSource) : undefined;
  const sample = str(payload.state_sample)?.slice(0, STATE_SAMPLE_MAX);
  const install = str(payload.install)?.trim().slice(0, INSTALL_MAX);
  return {
    provider: str(payload.provider)?.trim() ?? "",
    model: str(payload.model)?.trim() ?? "",
    ...(payload.via === "api" || payload.via === "adapter" ? { via: payload.via } : null),
    calledFrom,
    stateFrom: str(payload.state_from),
    ...(sample ? { stateSample: sample } : null),
    questions,
    ...(answer ? { answer } : null),
    ...(expected ? { expected } : null),
    ...(source ? { source } : null),
    ...(install ? { install } : null),
  };
}

// --- checking -----------------------------------------------------------------

/** Why these questions cannot be saved, or null. Fixed words only. */
export function questionsRefusal(questions: readonly DecisionQuestion[], name?: string): string | null {
  const said = name ? `Decision '${name}'` : "A decision";
  if (questions.length < QUESTIONS_MIN) return `${said} has no questions`;
  if (questions.length > QUESTIONS_MAX) return `${said} asks ${QUESTIONS_MAX} questions at most`;
  const seen = new Set<string>();
  for (const q of questions) {
    if (!q.id.trim()) return `${said} has a question with no name`;
    if (seen.has(q.id)) return `${said} asks '${q.id}' twice`;
    seen.add(q.id);
    if (q.type === "choice" && (q.options?.length ?? 0) < OPTIONS_MIN) return `${said} has no options`;
    if (q.type === "choice" && (q.options?.length ?? 0) > OPTIONS_MAX) return `A choice has ${OPTIONS_MAX} options at most`;
    if (q.type === "choice" && new Set(q.options?.map((o) => o.key)).size !== q.options?.length) return `'${q.id}' has two options with the same name`;
    if (q.type === "score" && (q.levels?.length ?? 0) < LEVELS_MIN) return `${said} has no levels`;
    if (q.type === "score" && (q.levels?.length ?? 0) > LEVELS_MAX) return `A score has ${LEVELS_MAX} levels at most`;
  }
  return null;
}

// --- wording ------------------------------------------------------------------

/** "Yes or no (0 to 1)", with Noul in the label when the provider is TypeSafe. */
export const questionTypeLabel = (type: QuestionType): string => (type === "choice" ? "Choice" : type === "score" ? "Score" : "Yes or no (0 to 1)");

/** "Noul" is TypeSafe's word for a yes or no scored 0 to 1. */
export const isTypeSafe = (provider: string): boolean => /typesafe|jev/i.test(provider);

/** "Jev 1.13" from "jev-1.13.0" and the provider; the provider's name alone when the model says no version. */
export function modelShort(provider: string, model: string): string {
  const name = toolName(provider) ?? provider;
  const match = /^([a-z][a-z0-9]*)[-_ ]v?(\d+(?:\.\d+)?)(?:\.\d+)*/i.exec(model.trim());
  if (match) return `${match[1].charAt(0).toUpperCase()}${match[1].slice(1)} ${match[2]}`;
  return model.trim() ? (name && !model.toLowerCase().includes(name.toLowerCase()) ? `${name} · ${model.trim()}` : model.trim()) : name || "Decision model";
}

/** "Decision · Jev 1.13". */
export const decisionHeadline = (facts: Pick<DecisionFacts, "provider" | "model">): string => `Decision · ${modelShort(facts.provider, facts.model)}`;

/** The question and its options in a line, for a decision with no answer recorded: "team: billing, support, kitchen". */
export function questionLine(q: DecisionQuestion): string {
  if (q.type === "choice") {
    const keys = (q.options ?? []).map((o) => o.key);
    return keys.length > 4 ? `${q.id}: ${keys.slice(0, 3).join(", ")} and ${keys.length - 3} more` : `${q.id}: ${keys.join(", ")}`;
  }
  if (q.type === "score") {
    const levels = q.levels ?? [];
    return levels.length ? `${q.id}: ${levels[0]} to ${levels[levels.length - 1]}` : q.id;
  }
  return `${q.id}: yes or no`;
}

/** How a recorded answer's value reads: a choice's key, a score's level name, "yes" or "no". */
export function answerWord(q: DecisionQuestion, a: DecisionAnswer): string {
  if (q.type === "yesno") return Number(a.value) >= 0.5 ? "yes" : "no";
  if (q.type === "score") {
    const index = Number(a.value);
    return (q.levels ?? [])[index] ?? String(a.value);
  }
  return String(a.value);
}

/** The share of the chosen answer, 0..1, when the answer says one. A yes or no has no "sure"; it has its number. */
export function sureOf(q: DecisionQuestion, a: DecisionAnswer): number | undefined {
  if (q.type === "yesno") return undefined;
  if (q.type === "score") {
    const index = Number(a.value);
    const named = a.probabilities?.[(q.levels ?? [])[index] ?? ""] ?? a.probabilities?.[String(index)];
    return named ?? a.confidence;
  }
  return a.probabilities?.[String(a.value)] ?? a.confidence;
}

export const percent = (share: number): number => Math.round(share * 100);

const trim2 = (n: number): string => String(Math.round(n * 100) / 100);

/** The line of one answered question: "team → billing · 92% sure", "tone → Annoyed (2 of 3) · 71% sure", "escalation → no · 0.18". */
export function answerLine(q: DecisionQuestion, a: DecisionAnswer): string {
  const word = answerWord(q, a);
  if (q.type === "yesno") return `${q.id} → ${word} · ${trim2(Number(a.value))}`;
  const place = q.type === "score" && (q.levels ?? [])[Number(a.value)] !== undefined ? ` (${Number(a.value) + 1} of ${(q.levels ?? []).length})` : "";
  const sure = sureOf(q, a);
  return `${q.id} → ${word}${place}${sure !== undefined ? ` · ${percent(sure)}% sure` : ""}`;
}

/** A tile's lines: one per question, answered when the decision recorded an answer, else the question and its options. */
export function decisionLines(facts: Pick<DecisionFacts, "questions" | "answer">): { text: string; answered: boolean }[] {
  return facts.questions.map((q) => {
    const a = facts.answer?.[q.id];
    return a ? { text: answerLine(q, a), answered: true } : { text: questionLine(q), answered: false };
  });
}

/** CA-13 P15: "The original answered billing (92% sure) on this example; check yours does too." */
export function expectedLine(q: DecisionQuestion, a: DecisionAnswer): string {
  const sure = sureOf(q, a);
  const word = q.type === "yesno" ? `${answerWord(q, a)} (${trim2(Number(a.value))})` : `${answerWord(q, a)}${sure !== undefined ? ` (${percent(sure)}% sure)` : ""}`;
  return `The original answered ${q.id} → ${word} on this example; check yours does too.`;
}

/** CA-13 P16: the check a copier is given: "On this example, your copy should answer team = billing." */
export const checkLine = (q: DecisionQuestion, a: DecisionAnswer): string => `On this example, your copy should answer ${q.id} = ${answerWord(q, a)}.`;

/** Where the figures came from, in the words the page uses. The site never states a vendor's figure as fact. */
export function sourceNote(source: AnswerSource | undefined): string | null {
  if (source === "run") return "From the run";
  if (source === "maker") return "Maker's figure";
  if (source === "original") return "The original's answer";
  return null;
}

// --- copying a request --------------------------------------------------------

export const COPY_REQUEST_NOTE = "Written from the settings on this page, not the maker's own code";

/** The request body for the stored questions, as the logged shape the importer reads: state, model and named questions. */
export function decisionBody(facts: Pick<DecisionFacts, "model" | "questions" | "stateSample">): Record<string, unknown> {
  const questions: Record<string, unknown> = {};
  for (const q of facts.questions) {
    questions[q.id] =
      q.type === "choice"
        ? { type: "choice", instructions: q.instructions, options: Object.fromEntries((q.options ?? []).map((o) => [o.key, o.line ?? ""])) }
        : q.type === "score"
          ? { type: "score", instructions: q.instructions, levels: q.levels ?? [] }
          : { type: "noul", instructions: q.instructions };
  }
  return { model: facts.model, state: facts.stateSample ?? "", questions };
}

/** "Copy as a request": Python and curl for the stored questions, with the key as a placeholder, never a value. */
export function decisionRequest(facts: Pick<DecisionFacts, "provider" | "model" | "questions" | "stateSample">): { json: string; python: string; curl: string } {
  const json = JSON.stringify(decisionBody(facts), null, 2);
  const python = [
    `# ${COPY_REQUEST_NOTE}.`,
    "# Set TYPESAFE_API_URL from TypeSafe's documentation, and TYPESAFE_API_KEY to your key.",
    "import os",
    "import requests",
    "",
    `body = ${json.replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False").replace(/\bnull\b/g, "None")}`,
    "",
    "response = requests.post(",
    '    os.environ["TYPESAFE_API_URL"],',
    '    headers={"Authorization": f"Bearer {os.environ[\'TYPESAFE_API_KEY\']}"},',
    "    json=body,",
    ")",
    "print(response.json())",
  ].join("\n");
  const curl = [`# ${COPY_REQUEST_NOTE}.`, 'curl -X POST "$TYPESAFE_API_URL" \\', '  -H "Authorization: Bearer $TYPESAFE_API_KEY" \\', '  -H "Content-Type: application/json" \\', `  --data '${json.replace(/'/g, "'\\''")}'`].join("\n");
  return { json, python, curl };
}

// --- "Runs when" --------------------------------------------------------------

/** What a condition tests. A choice: one or more keys. A score: at least a level index. A yes or no: yes or no, cut at 0.5. */
export type RunsWhenIs = string[] | { atLeast: number } | { yes: boolean };

export interface RunsWhen {
  /** The Decision node's id. */
  decision: string;
  /** The question's id. */
  question: string;
  is: RunsWhenIs;
}

/** CA-13 rule 1: only runtime tiles branch. A prompt, manual step, file, result or session head never shows "Runs when". */
export const RUNS_WHEN_KINDS = ["agent", "team", "code", "tool", "decision"] as const;

export const canRunWhen = (kind: string): boolean => (RUNS_WHEN_KINDS as readonly string[]).includes(kind);

/** A condition, read defensively; null for a value that is not one. */
export function runsWhenOf(value: unknown): RunsWhen | null {
  if (!isRecord(value)) return null;
  const decision = str(value.decision);
  const question = str(value.question);
  if (!decision || !question) return null;
  const is = value.is;
  if (Array.isArray(is)) {
    const keys = is.filter((key): key is string => typeof key === "string" && key.length > 0);
    return keys.length ? { decision, question, is: keys } : null;
  }
  if (isRecord(is) && typeof is.atLeast === "number" && Number.isInteger(is.atLeast) && is.atLeast >= 0) return { decision, question, is: { atLeast: is.atLeast } };
  if (isRecord(is) && typeof is.yes === "boolean") return { decision, question, is: { yes: is.yes } };
  return null;
}

/** The part after the question's name: "billing", "billing or support", "Annoyed or more", "yes". */
export function runsWhenValue(rw: RunsWhen, question: DecisionQuestion | undefined): string {
  if (Array.isArray(rw.is)) return rw.is.length > 2 ? `${rw.is.slice(0, -1).join(", ")} or ${rw.is[rw.is.length - 1]}` : rw.is.join(" or ");
  if ("atLeast" in rw.is) return `${(question?.levels ?? [])[rw.is.atLeast] ?? `level ${rw.is.atLeast + 1}`} or more`;
  return rw.is.yes ? "yes" : "no";
}

/** "team is billing": the words a branch's head and its steps use. */
export const runsWhenClause = (rw: RunsWhen, question: DecisionQuestion | undefined): string => `${rw.question} is ${runsWhenValue(rw, question)}`;

/** "Runs when team is billing". */
export const runsWhenLabel = (rw: RunsWhen, question: DecisionQuestion | undefined): string => `Runs when ${runsWhenClause(rw, question)}`;

/** "If team is billing". */
export const branchHead = (rw: RunsWhen, question: DecisionQuestion | undefined): string => `If ${runsWhenClause(rw, question)}`;

/** Two conditions that say the same thing. */
export function sameCondition(a: RunsWhen, b: RunsWhen): boolean {
  if (a.decision !== b.decision || a.question !== b.question) return false;
  if (Array.isArray(a.is) && Array.isArray(b.is)) return a.is.length === b.is.length && a.is.every((key, i) => key === b.is[i]);
  if (!Array.isArray(a.is) && !Array.isArray(b.is)) return JSON.stringify(a.is) === JSON.stringify(b.is);
  return false;
}

/** The options a question can be tested against, for the "Runs when" menus: choice keys, levels as "at least", yes or no. */
export function runsWhenChoices(q: DecisionQuestion): { label: string; is: RunsWhenIs }[] {
  if (q.type === "choice") return (q.options ?? []).map((o) => ({ label: o.key, is: [o.key] }));
  if (q.type === "score") return (q.levels ?? []).map((level, index) => ({ label: `${level} or more`, is: { atLeast: index } }));
  return [{ label: "yes", is: { yes: true } }, { label: "no", is: { yes: false } }];
}

/** Whether a condition's value is one its question can take. */
export function runsWhenFits(rw: RunsWhen, q: DecisionQuestion): boolean {
  if (Array.isArray(rw.is)) return q.type === "choice" && rw.is.every((key) => (q.options ?? []).some((o) => o.key === key));
  if ("atLeast" in rw.is) return q.type === "score" && rw.is.atLeast < (q.levels ?? []).length;
  return q.type === "yesno";
}

/** What a condition's decision turned out to be: a kind and an order, as the build holds them. */
export interface DecisionRef {
  id: string;
  /** Top-level order, 0 first. */
  index: number;
  facts: DecisionFacts | null;
}

/**
 * Why a "Runs when" cannot be saved or kept, or null. `index` is where the step sits (top level, 0 first); the decision
 * must come before it. Fixed words only (CONTRACT §9).
 */
export function runsWhenRefusal(kind: string, index: number, rw: RunsWhen, decisions: readonly DecisionRef[]): string | null {
  if (!canRunWhen(kind)) return "Only an agent, a team, code, a tool or a decision runs when something was decided.";
  const decision = decisions.find((d) => d.id === rw.decision);
  if (!decision || !decision.facts) return "That decision is no longer in the build.";
  if (decision.index >= index) return "A step can only run when a decision above it went a certain way.";
  const q = decision.facts.questions.find((candidate) => candidate.id === rw.question);
  if (!q) return "That question is no longer in the decision.";
  if (!runsWhenFits(rw, q)) return "That value is not one the question can take.";
  return null;
}

// --- branches, for the Map ----------------------------------------------------

/** A stable key for a condition: the same decision, question and value. */
export const conditionKey = (rw: RunsWhen): string => `${rw.decision}|${rw.question}|${JSON.stringify(rw.is)}`;

/** Where a condition sits: by question, then among that question's options, so branches are ordered as the options are. */
export function conditionOrder(rw: RunsWhen, questions: readonly DecisionQuestion[] | undefined): number {
  const at = (questions ?? []).findIndex((q) => q.id === rw.question);
  const q = at < 0 ? undefined : questions?.[at];
  const base = (at < 0 ? 999 : at) * 1000;
  if (Array.isArray(rw.is)) {
    const index = (q?.options ?? []).findIndex((o) => o.key === rw.is[0]);
    return base + (index < 0 ? 999 : index);
  }
  if ("atLeast" in rw.is) return base + rw.is.atLeast;
  return base + (rw.is.yes ? 0 : 1);
}

/** How many of a question's options (levels, yes or no) none of these conditions covers: what "Other options: no step" stands for. */
export function uncoveredCount(q: DecisionQuestion, conditions: readonly RunsWhen[]): number {
  const mine = conditions.filter((rw) => rw.question === q.id);
  if (q.type === "choice") {
    const taken = new Set(mine.flatMap((rw) => (Array.isArray(rw.is) ? rw.is : [])));
    return (q.options ?? []).filter((o) => !taken.has(o.key)).length;
  }
  if (q.type === "score") {
    const floors = mine.flatMap((rw) => (!Array.isArray(rw.is) && "atLeast" in rw.is ? [rw.is.atLeast] : []));
    return floors.length ? Math.min(...floors) : (q.levels ?? []).length;
  }
  const answered = new Set(mine.flatMap((rw) => (!Array.isArray(rw.is) && "yes" in rw.is ? [rw.is.yes] : [])));
  return 2 - answered.size;
}
