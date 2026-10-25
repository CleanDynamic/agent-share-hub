// CA-13 P2: the Decision form's draft, pure. Strings while the maker types; `draftToInput` checks and converts.

import type { DecisionInput } from "./graph";
import { EXAMPLES_MAX, EXAMPLE_TEXT_MAX, decisionOf, questionsRefusal, sureOf, takesOptions, type DecisionAnswer, type DecisionExample, type DecisionFacts, type DecisionQuestion, type ExtractField, type LowConfidence, type QuestionType } from "./decision";
import type { DecisionImport } from "./decisionImport";

export interface QuestionDraft {
  id: string;
  type: QuestionType;
  instructions: string;
  options: { key: string; line: string }[];
  levels: string[];
  /** CA-15 P8: what an extraction pulls out. */
  field: ExtractField;
}

/** CA-15 P8: what to do at low confidence, as typed: nothing, a threshold (text, 0 to 1), or a person. */
export interface LowConfidenceDraft {
  mode: "" | "threshold" | "escalate";
  threshold: string;
}

export interface AnswerDraft {
  /** A choice's key, a score's level index as text, or a yes or no's number as text. */
  value: string;
  /** How sure, in percent, as typed. */
  sure: string;
  /** The stored answer this was read from. While the value and the share are as read, it is kept whole, probabilities and all. */
  kept?: DecisionAnswer;
}

export interface DecisionDraft {
  name: string;
  provider: string;
  model: string;
  via: "api" | "adapter";
  calledFrom: string[];
  reads: "step" | "paste";
  stateFrom: string | null;
  stateSample: string;
  questions: QuestionDraft[];
  answer: Record<string, AnswerDraft>;
  source: "run" | "maker";
  install: string;
  /** CA-15 P8. */
  examples: DecisionExample[];
  lowConfidence: LowConfidenceDraft;
}

export const blankQuestion = (): QuestionDraft => ({ id: "", type: "choice", instructions: "", options: [{ key: "", line: "" }, { key: "", line: "" }], levels: ["", ""], field: "text" });

export const emptyDraft = (): DecisionDraft => ({
  name: "",
  provider: "typesafe-jev",
  model: "",
  via: "api",
  calledFrom: [],
  reads: "paste",
  stateFrom: null,
  stateSample: "",
  questions: [blankQuestion()],
  answer: {},
  source: "maker",
  install: "",
  examples: [],
  lowConfidence: { mode: "", threshold: "" },
});

const draftOfQuestion = (q: DecisionQuestion): QuestionDraft => ({
  id: q.id,
  type: q.type,
  instructions: q.instructions,
  options: q.options?.length ? q.options.map((o) => ({ key: o.key, line: o.line ?? "" })) : [{ key: "", line: "" }, { key: "", line: "" }],
  levels: q.levels?.length ? [...q.levels] : ["", ""],
  field: q.field ?? "text",
});

const draftOfLow = (low: LowConfidence | undefined): LowConfidenceDraft => (!low ? { mode: "", threshold: "" } : "escalate" in low ? { mode: "escalate", threshold: "" } : { mode: "threshold", threshold: String(low.threshold) });

const answerDraft = (q: DecisionQuestion, a: DecisionAnswer): AnswerDraft => {
  const sure = sureOf(q, a);
  return { value: String(a.value), sure: sure !== undefined ? String(Math.round(sure * 100)) : "", kept: a };
};

/** A draft from a stored decision, for editing. */
export function draftFromFacts(facts: DecisionFacts, name: string | null = null): DecisionDraft {
  return {
    name: name ?? "",
    provider: facts.provider,
    model: facts.model,
    via: facts.via ?? "api",
    calledFrom: [...facts.calledFrom],
    reads: facts.stateFrom ? "step" : "paste",
    stateFrom: facts.stateFrom,
    stateSample: facts.stateSample ?? "",
    questions: facts.questions.map(draftOfQuestion),
    answer: Object.fromEntries(facts.questions.flatMap((q) => (facts.answer?.[q.id] ? [[q.id, answerDraft(q, facts.answer[q.id])]] : []))),
    source: facts.source === "run" ? "run" : "maker",
    install: facts.install ?? "",
    examples: (facts.examples ?? []).map((example) => ({ ...example })),
    lowConfidence: draftOfLow(facts.lowConfidence),
  };
}

/** What a pasted request fills in. Questions and the state are replaced; the provider is kept unless the paste names a model. */
export function applyImport(draft: DecisionDraft, read: DecisionImport): DecisionDraft {
  const questions = read.questions.map(draftOfQuestion);
  const answer = Object.fromEntries(read.questions.flatMap((q) => (read.answer?.[q.id] ? [[q.id, answerDraft(q, read.answer[q.id])]] : [])));
  return {
    ...draft,
    model: read.model ?? draft.model,
    questions,
    answer,
    // A pasted response is one read from the run; nothing else is.
    source: read.answer ? "run" : draft.source,
    ...(read.stateSample ? { stateSample: read.stateSample, reads: "paste" as const, stateFrom: null } : null),
  };
}

const num = (text: string): number | null => {
  const n = Number(text);
  return text.trim() && Number.isFinite(n) ? n : null;
};

/** The questions of a draft, checked as the stored shape. */
export function questionsOfDraft(draft: DecisionDraft): DecisionQuestion[] {
  return draft.questions.map((q) => ({
    id: q.id.trim(),
    type: q.type,
    instructions: q.instructions.trim(),
    ...(takesOptions(q.type) ? { options: q.options.filter((o) => o.key.trim()).map((o) => ({ key: o.key.trim(), ...(o.line.trim() ? { line: o.line.trim() } : null) })) } : null),
    ...(q.type === "score" ? { levels: q.levels.map((level) => level.trim()).filter(Boolean) } : null),
    ...(q.type === "extract" ? { field: q.field } : null),
  }));
}

/** CA-15 P8: the label of the first required field a draft still lacks, as "Required: ..." says it; null when the model or service and the questions are complete. */
export function decisionMissing(draft: DecisionDraft): string | null {
  if (!draft.provider.trim()) return "Model or service";
  const keys = draft.questions.map((q) => q.id.trim());
  if (draft.questions.length === 0 || keys.some((key) => !key)) return "Key";
  if (new Set(keys).size !== keys.length) return "Key";
  for (const q of draft.questions) {
    const filled = q.options.filter((o) => o.key.trim());
    if (takesOptions(q.type) && filled.length < 2) return "Options";
    if (takesOptions(q.type) && new Set(filled.map((o) => o.key.trim())).size !== filled.length) return "Options";
    if (q.type === "score" && q.levels.filter((level) => level.trim()).length < 2) return "Levels";
  }
  return null;
}

/** The draft as a write, or the plain line that says why it cannot be saved. */
export function draftToInput(draft: DecisionDraft): { input: DecisionInput } | { error: string } {
  if (!draft.provider.trim()) return { error: "Select the model or service the decision uses." };
  const questions = questionsOfDraft(draft);
  const why = questionsRefusal(questions, draft.name.trim() || undefined);
  if (why) return { error: `${why}.` };
  const answer: Record<string, DecisionAnswer> = {};
  for (const q of questions) {
    const a = draft.answer[q.id];
    if (!a || !a.value.trim()) continue;
    if (a.kept) {
      const was = answerDraft(q, a.kept);
      if (was.value === a.value && was.sure === a.sure) {
        answer[q.id] = a.kept;
        continue;
      }
    }
    const sure = num(a.sure);
    const share = sure !== null && sure >= 0 && sure <= 100 ? sure / 100 : undefined;
    if (q.type === "choice") {
      if (!(q.options ?? []).some((o) => o.key === a.value)) return { error: `'${q.id}' was answered with something that is not one of its options.` };
      answer[q.id] = { value: a.value, ...(share !== undefined ? { probabilities: { [a.value]: share }, confidence: share } : null) };
    } else if (q.type === "multi" || q.type === "rank") {
      // Several keys, comma separated: the ones picked, or all of them in order.
      const keys = a.value.split(",").map((key) => key.trim()).filter(Boolean);
      const known = new Set((q.options ?? []).map((o) => o.key));
      if (keys.length === 0 || keys.some((key) => !known.has(key)) || new Set(keys).size !== keys.length) return { error: `'${q.id}' was answered with something that is not made of its options.` };
      if (q.type === "rank" && keys.length !== known.size) return { error: `'${q.id}' is a ranking: answer with every option, in order.` };
      answer[q.id] = { value: keys.join(", "), ...(share !== undefined ? { confidence: share } : null) };
    } else if (q.type === "extract") {
      answer[q.id] = { value: a.value.trim(), ...(share !== undefined ? { confidence: share } : null) };
    } else if (q.type === "score") {
      const index = num(a.value);
      if (index === null || !Number.isInteger(index) || index < 0 || index >= (q.levels ?? []).length) return { error: `'${q.id}' was answered with something that is not one of its levels.` };
      answer[q.id] = { value: index, ...(share !== undefined ? { probabilities: { [(q.levels ?? [])[index]]: share }, confidence: share } : null) };
    } else {
      const value = num(a.value);
      if (value === null || value < 0 || value > 1) return { error: `'${q.id}' is a yes or no from 0 to 1.` };
      answer[q.id] = { value };
    }
  }
  const examples = draft.examples.map((example) => ({ input: example.input.trim(), output: example.output.trim() })).filter((example) => example.input || example.output);
  if (examples.some((example) => !example.input || !example.output)) return { error: "Each example needs an input and an expected output." };
  if (examples.length > EXAMPLES_MAX) return { error: `A decision keeps ${EXAMPLES_MAX} examples at most.` };
  if (examples.some((example) => example.input.length > EXAMPLE_TEXT_MAX || example.output.length > EXAMPLE_TEXT_MAX)) return { error: `An example is at most ${EXAMPLE_TEXT_MAX} characters on each side.` };
  let lowConfidence: LowConfidence | null = null;
  if (draft.lowConfidence.mode === "escalate") lowConfidence = { escalate: true };
  else if (draft.lowConfidence.mode === "threshold") {
    const threshold = num(draft.lowConfidence.threshold);
    if (threshold === null || threshold < 0 || threshold > 1) return { error: "The confidence threshold is a number from 0 to 1." };
    lowConfidence = { threshold };
  }
  return {
    input: {
      name: draft.name.trim() || null,
      provider: draft.provider.trim(),
      model: draft.model.trim(),
      via: draft.via,
      calledFrom: draft.calledFrom,
      stateFrom: draft.reads === "step" ? draft.stateFrom : null,
      stateSample: draft.reads === "paste" ? draft.stateSample : "",
      questions,
      ...(Object.keys(answer).length ? { answer, source: draft.source } : null),
      ...(draft.install.trim() ? { install: draft.install.trim() } : null),
      ...(examples.length > 0 ? { examples } : null),
      ...(lowConfidence ? { lowConfidence } : null),
    },
  };
}

/** Whether the stored decision survives a round trip through the form. */
export const roundTrips = (facts: DecisionFacts): boolean => decisionOf({ ...facts, questions: facts.questions }) !== null;
