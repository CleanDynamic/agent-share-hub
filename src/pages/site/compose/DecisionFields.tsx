/* CA-13 P2, CA-15 P8, CA-15b P2: the Decision form's fields, shared by Add › Decision and Details.

   Built from `modalRecipes` as the board "Add a decision" draws it. In this order:

   1. A "Model" group heading, then rows: Model or service (a picker field, from the Runtime models and services
      subcategory), Version (the data face, 200 wide) and Invocation (Direct, or Through an adapter).
   2. Questions ("1 question"): a panel per question. Its head is the grip, "Question 1" and its remove button; its rows are
      Key, Type (Single choice, Multiple choice, Score, Ranking, Yes or no, Extraction), Instructions, then what the type
      takes: Options (a grip, the key, the description and a remove button each, then "Add an option"), Levels, or an
      extraction's Field type (Text, Number, Date, Amount). "Add a question" follows the panels.
   3. The Optional section: Import from a logged request and response (through `parseDecisionCall`; Import, and Read from a
      Code tile), Calling code, Input, Recorded answer, Installation command, Examples (input and expected output pairs) and
      Low-confidence handling (a confidence threshold from 0 to 1, or Escalate to a person).

   It never runs anything and never keeps a key. */

import { useId, useState, type DragEvent, type KeyboardEvent } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { BEAM_WIDTH_MAX, BEAM_WIDTH_MIN, CANDIDATES_K_MAX, CANDIDATES_K_MIN, KNOWN_LIMITS_MAX, KNOWN_LIMIT_LINE_MAX, SELECTION_LABEL, SELECTION_METHODS, type AdaptationKind, type LabelStructure, type SelectionMethod } from "@/lib/build/pipelineFields";
import { applyImport, blankQuestion, type AnswerDraft, type DecisionDraft, type QuestionDraft } from "@/lib/build/decisionDraft";
import { EXAMPLES_MAX, EXAMPLE_TEXT_MAX, EXTRACT_FIELDS, EXTRACT_FIELD_LABEL, QUESTION_TYPES, QUESTIONS_MAX, STATE_SAMPLE_MAX, isTypeSafe, questionTypeLabel, takesOptions, type ExtractField, type QuestionType } from "@/lib/build/decision";
import { KEY_REMOVED_LINE, parseDecisionCall } from "@/lib/build/decisionImport";
import { firstLineOf } from "@/lib/build/graph";

import { ChoiceGrid } from "./ChoiceGrid";
import {
  BODY_TEXT,
  Block,
  BlockHead,
  Count,
  DATA_FACE,
  ELLIPSIS,
  FieldArea,
  FieldInput,
  GRIP,
  GroupHeading,
  Hint,
  IconSquare,
  Inline,
  NARROW,
  OptionGrid,
  Panel,
  PANEL_HEAD,
  PANEL_LIST,
  PANEL_TITLE,
  QuestionRow,
  RecipeButton,
  Row,
  SegmentedField,
  Spread,
  StatusLine,
  TextLink,
  optionKeyRowStyle, optionDescribeRowStyle,
  LabelText,
} from "./modalRecipes";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { PickMenu } from "./PickMenu";
import { ToolPicker } from "./ToolPicker";

const NONE = "__none__";

export const DECISION_COPY = {
  model: "Model",
  provider: "Model or service",
  selectProvider: "Select a model or service",
  version: "Version",
  versionPlaceholder: "jev-1.13.0",
  invocation: "Invocation",
  direct: "Direct",
  adapter: "Through an adapter",
  questions: "Questions",
  addQuestion: "Add a question",
  key: "Key",
  keyPlaceholder: "team",
  paste: "Import request and response",
  pasteLine: "From JSON, curl or Python",
  pastePlaceholder: "JSON request and response, curl, or Python",
  import: "Import",
  readCode: "Read from a Code tile",
  callingCode: "Calling code",
  callingCodeLine: "Code tile that sends the request",
  noCode: "No Code tile linked",
  addCode: "Add code",
  input: "Input",
  inputLine: "Another tile's output, or sample text",
  fromStep: "Another tile's output",
  fromText: "Sample text",
  state: "Sample text",
  statePlaceholder: "Customer: I was charged twice for my order.",
  answer: "Recorded answer",
  answerLine: "One real answer",
  answerHint: "Value and confidence per question",
  confidence: "Confidence",
  install: "Installation command",
  installLine: "As typed",
  installPlaceholder: "pip install typesafe",
  examples: "Examples",
  examplesLine: "Real inputs and their outputs",
  addExample: "Add an example",
  exampleInput: "Input",
  exampleOutput: "Expected output",
  lowConfidence: "Low-confidence handling",
  lowConfidenceLine: "Threshold or escalation",
  threshold: "Confidence threshold",
  escalate: "Escalate to a person",
  thresholdPlaceholder: "0.6",
  optionDescription: "Description",
  optionDescriptions: "Option descriptions",
  noOptionsYet: "No options yet",
  fieldType: "Field type",
  questionsCount: (n: number) => `${n} ${n === 1 ? "question" : "questions"}`,
  question: (n: number) => `Question ${n}`,
  removeQuestion: (n: number) => `Remove question ${n}`,
  type: "Type",
  instructions: "Instructions",
  instructionsPlaceholder: "Which team should handle this message?",
  options: "Options",
  levels: "Levels",
  addOption: "Add an option",
  addLevel: "Add a level",
  importCode: "Import from the code",
  /* SV-29 P1. */
  labelSet: "Label set",
  labelSetLine: "Every label a decision could output",
  labelSize: "Number of labels",
  labelName: "Label set name",
  labelVersion: "Label set version",
  flat: "Flat",
  hierarchical: "Hierarchical",
  candidates: "Candidates from",
  candidatesLine: "An earlier step offers this decision a short list",
  candidatesStep: "Step that offers them",
  candidatesK: "Candidates offered (k)",
  candidatesHint: "The options need not be listed when candidates come from a step",
  selection: "How it covers the label set",
  selectionLine: "One call, every label, a tree walk, or one call per node",
  beamWidth: "Beam width (k)",
  adaptation: "Adaptation",
  adaptationLine: "Zero-shot, few-shot, or fine-tuned",
  zeroShot: "Zero-shot",
  fewShot: "Few-shot",
  fineTuned: "Fine-tuned",
  fewShotHint: "Few-shot sends the examples below in the prompt",
  baseModel: "Base model",
  knownLimits: "Known limits",
  knownLimitsLine: "Where the maker says it performs badly, one per line, up to 5",
} as const;

export interface DecisionFieldsProps {
  draft: DecisionDraft;
  onChange: (next: DecisionDraft) => void;
  phone: boolean;
  /** The Code tiles in this build: what makes the call (rule 4), and what "Read from a Code tile" reads. */
  codeTiles: readonly { id: string; label: string; source: string }[];
  /** The steps the state can come from (earlier steps). */
  stepChoices: readonly { id: string; label: string }[];
  inBuild?: readonly string[];
  onAddCode?: () => void;
  /** A row opens on its own when told to (an error that points into it). */
  open?: Partial<Record<"import" | "calling" | "input" | "answer" | "install" | "examples" | "low" | "pipeline", boolean>>;
}

/** One option: a drag handle, its key and its remove button (its description is a field of the Optional section). The handle drags; the arrow keys move it too. */
function OptionRow({ index, count, option, onChange, onRemove, onMove, phone, label }: { index: number; count: number; option: { key: string; line: string }; onChange: (next: { key: string; line: string }) => void; onRemove: () => void; onMove: (from: number, to: number) => void; phone: boolean; label: string }) {
  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowUp" && index > 0) {
      event.preventDefault();
      onMove(index, index - 1);
    } else if (event.key === "ArrowDown" && index < count - 1) {
      event.preventDefault();
      onMove(index, index + 1);
    }
  };
  return (
    <div
      data-testid="option-row"
      onDragOver={(event: DragEvent) => event.preventDefault()}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData("text/plain"));
        if (Number.isInteger(from) && from !== index) onMove(from, index);
      }}
      style={optionKeyRowStyle(phone)}
    >
      <button
        type="button"
        draggable
        aria-label={`Move ${label.toLowerCase()} ${index + 1}`}
        onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
        onKeyDown={onKey}
        style={GRIP}
      >
        <Glyph name="grip" size={14} />
      </button>
      <FieldInput phone={phone} mono aria-label={`${label} ${index + 1}`} value={option.key} maxLength={80} placeholder="billing" onChange={(e) => onChange({ ...option, key: e.target.value })} />
      {count > 2 ? <IconSquare glyph="x" phone={phone} label={`Remove ${label.toLowerCase()} ${index + 1}`} onClick={onRemove} /> : <span />}
    </div>
  );
}

function QuestionEditor({ q, index, onChange, onRemove, phone, provider, canRemove }: { q: QuestionDraft; index: number; onChange: (next: QuestionDraft) => void; onRemove: () => void; phone: boolean; provider: string; canRemove: boolean }) {
  const uid = useId();
  const optionLabel = q.type === "rank" ? "Ranked option" : "Option";
  const move = (from: number, to: number) => {
    const next = [...q.options];
    const [taken] = next.splice(from, 1);
    next.splice(to, 0, taken);
    onChange({ ...q, options: next });
  };
  return (
    <Panel label={DECISION_COPY.question(index + 1)} padding="10px 14px 14px">
      <div style={PANEL_HEAD}>
        <span aria-hidden="true" style={GRIP}>
          <Glyph name="grip" size={14} />
        </span>
        <span style={PANEL_TITLE}>{DECISION_COPY.question(index + 1)}</span>
        {canRemove ? <IconSquare glyph="x" phone={phone} label={DECISION_COPY.removeQuestion(index + 1)} onClick={onRemove} /> : null}
      </div>
      <QuestionRow id={`${uid}-key`} label={DECISION_COPY.key} phone={phone}>
        <FieldInput phone={phone} mono id={`${uid}-key`} value={q.id} maxLength={40} placeholder={DECISION_COPY.keyPlaceholder} onChange={(e) => onChange({ ...q, id: e.target.value })} />
      </QuestionRow>
      <QuestionRow id={`${uid}-type`} label={DECISION_COPY.type} group phone={phone}>
        <SegmentedField<QuestionType>
          label={`Type of question ${index + 1}`}
          phone={phone}
          items={QUESTION_TYPES.map((value) => ({ value, label: value === "yesno" && isTypeSafe(provider) ? "Yes or no" : questionTypeLabel(value) }))}
          value={q.type}
          onChange={(next) => onChange({ ...q, type: next })}
        />
      </QuestionRow>
      <QuestionRow id={`${uid}-ins`} label={DECISION_COPY.instructions} top phone={phone}>
        <FieldArea phone={phone} id={`${uid}-ins`} rows={2} value={q.instructions} maxLength={600} placeholder={DECISION_COPY.instructionsPlaceholder} onChange={(e) => onChange({ ...q, instructions: e.target.value })} />
      </QuestionRow>
      {takesOptions(q.type) ? (
        <>
          <QuestionRow id={`${uid}-options`} label={DECISION_COPY.options} group top phone={phone}>
            {q.type === "rank" ? <Hint>Answer ranks every option</Hint> : null}
          </QuestionRow>
          <div role="group" aria-label={`Options of question ${index + 1}`} style={PANEL_LIST}>
            {q.options.map((option, i) => (
              <OptionRow
                key={i}
                index={i}
                count={q.options.length}
                option={option}
                label={optionLabel}
                phone={phone}
                onMove={move}
                onChange={(next) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? next : o)) })}
                onRemove={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })}
              />
            ))}
            <TextLink phone={phone} onClick={() => onChange({ ...q, options: [...q.options, { key: "", line: "" }] })}>
              {DECISION_COPY.addOption}
            </TextLink>
          </div>
        </>
      ) : null}
      {q.type === "score" ? (
        <QuestionRow id={`${uid}-levels`} label={DECISION_COPY.levels} group top phone={phone}>
          <div role="group" aria-label={`Levels of question ${index + 1}, lowest to highest`} style={PANEL_LIST}>
            <Hint>Lowest to highest</Hint>
            {q.levels.map((level, i) => (
              <Spread key={i}>
                <FieldInput phone={phone} aria-label={`Level ${i + 1}`} value={level} maxLength={60} placeholder={i === 0 ? "Calm" : "Annoyed"} onChange={(e) => onChange({ ...q, levels: q.levels.map((l, j) => (j === i ? e.target.value : l)) })} />
                {q.levels.length > 2 ? <IconSquare glyph="x" phone={phone} label={`Remove level ${i + 1}`} onClick={() => onChange({ ...q, levels: q.levels.filter((_, j) => j !== i) })} /> : null}
              </Spread>
            ))}
            <TextLink phone={phone} onClick={() => onChange({ ...q, levels: [...q.levels, ""] })}>
              {DECISION_COPY.addLevel}
            </TextLink>
          </div>
        </QuestionRow>
      ) : null}
      {q.type === "extract" ? (
        <QuestionRow id={`${uid}-field`} label={DECISION_COPY.fieldType} group phone={phone}>
          <ChoiceGrid<ExtractField> bare label={`Field type of question ${index + 1}`} items={EXTRACT_FIELDS.map((value) => ({ value, label: EXTRACT_FIELD_LABEL[value] }))} value={q.field} onChange={(next) => next && onChange({ ...q, field: next })} phone={phone} columns={4} />
        </QuestionRow>
      ) : null}
    </Panel>
  );
}

function AnswerEditor({ q, answer, onChange, phone }: { q: QuestionDraft; answer: AnswerDraft | undefined; onChange: (next: AnswerDraft | null) => void; phone: boolean }) {
  const uid = useId();
  const value = answer?.value ?? "";
  const set = (patch: Partial<AnswerDraft>) => onChange({ value, sure: answer?.sure ?? "", kept: answer?.kept, ...patch });
  const options = q.options.filter((o) => o.key.trim());
  const levels = q.levels.filter((level) => level.trim());
  return (
    <QuestionRow id={`${uid}-v`} label={q.id.trim() || "Question"} first phone={phone}>
      <Inline>
        {q.type === "choice" ? (
          <PickMenu field id={`${uid}-v`} label={`Answer to ${q.id}`} phone={phone} placeholder="No answer" value={value || null} options={[{ value: NONE, label: "No answer" }, ...options.map((o) => ({ value: o.key, label: o.key }))]} onChange={(next) => (next === NONE ? onChange(null) : set({ value: next }))} />
        ) : q.type === "score" ? (
          <PickMenu field id={`${uid}-v`} label={`Answer to ${q.id}`} phone={phone} placeholder="No answer" value={value || null} options={[{ value: NONE, label: "No answer" }, ...levels.map((level, i) => ({ value: String(i), label: level }))]} onChange={(next) => (next === NONE ? onChange(null) : set({ value: next }))} />
        ) : q.type === "multi" || q.type === "rank" ? (
          <FieldInput phone={phone} id={`${uid}-v`} aria-label={`Answer to ${q.id}`} value={value} placeholder={q.type === "rank" ? "Every option, in order, comma separated" : "billing, support"} onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} />
        ) : q.type === "extract" ? (
          <FieldInput phone={phone} id={`${uid}-v`} aria-label={`Answer to ${q.id}`} value={value} placeholder={`the ${EXTRACT_FIELD_LABEL[q.field].toLowerCase()} it pulled out`} onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} />
        ) : (
          <FieldInput phone={phone} mono id={`${uid}-v`} aria-label={`Answer to ${q.id}`} inputMode="decimal" value={value} placeholder="0 to 1" onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} />
        )}
        {q.type !== "yesno" ? <FieldInput phone={phone} mono width={NARROW.date} aria-label={`${DECISION_COPY.confidence}, percent`} inputMode="numeric" placeholder="Percent" value={answer?.sure ?? ""} disabled={!value} onChange={(e) => set({ sure: e.target.value })} /> : null}
      </Inline>
    </QuestionRow>
  );
}

export function DecisionFields({ draft, onChange, phone, codeTiles, stepChoices, inBuild = [], onAddCode, open = {} }: DecisionFieldsProps) {
  const uid = useId();
  const [pasted, setPasted] = useState("");
  const [note, setNote] = useState<{ text: string; problem: boolean } | null>(null);
  const [codeId, setCodeId] = useState("");
  const [fromCode, setFromCode] = useState(false);
  const set = (patch: Partial<DecisionDraft>) => onChange({ ...draft, ...patch });

  const read = (source: string) => {
    const result = parseDecisionCall(source);
    if (result.ok === false) {
      setNote({ text: `${result.reason}${result.keyRemoved ? ` ${KEY_REMOVED_LINE}` : ""}`, problem: true });
      return;
    }
    onChange(applyImport(draft, result.value));
    setNote({ text: `Read ${result.value.questions.length} ${result.value.questions.length === 1 ? "question" : "questions"}${result.value.answer ? " and an answer" : ""}. Check them above.${result.value.keyRemoved ? ` ${KEY_REMOVED_LINE}` : ""}`, problem: false });
    setPasted("");
  };

  const answered = draft.questions.filter((q) => q.id.trim() && draft.answer[q.id]);
  const called = draft.calledFrom.map((id) => codeTiles.find((tile) => tile.id === id)?.label).filter((label): label is string => Boolean(label));
  const low = draft.lowConfidence;
  const examples = draft.examples;
  /** Each question that takes options, with the options that have a key: the descriptions are filled in under Optional. */
  const optioned = draft.questions.map((q, at) => ({ q, at })).filter(({ q }) => takesOptions(q.type) && q.options.some((option) => option.key.trim()));
  const described = draft.questions.flatMap((q) => (takesOptions(q.type) ? q.options.filter((option) => option.line.trim()).map((option) => `${option.key.trim()}: ${option.line.trim()}`) : []));
  const setOptionLine = (question: number, option: number, line: string) =>
    set({ questions: draft.questions.map((q, i) => (i === question ? { ...q, options: q.options.map((o, j) => (j === option ? { ...o, line } : o)) } : q)) });
  const pipe = draft.pipeline;
  const setPipe = (patch: Partial<DecisionDraft["pipeline"]>) => set({ pipeline: { ...pipe, ...patch } });
  const stepLabel = stepChoices.find((choice) => choice.id === pipe.candidatesStep)?.label;
  const setExample = (at: number, patch: Partial<{ input: string; output: string }>) => set({ examples: examples.map((example, i) => (i === at ? { ...example, ...patch } : example)) });

  return (
    <>
      <GroupHeading>{DECISION_COPY.model}</GroupHeading>
      <Row id={`${uid}-prov`} label={DECISION_COPY.provider} group noRule phone={phone}>
        <ToolPicker label={DECISION_COPY.provider} value={draft.provider || null} onChange={(next) => set({ provider: next ?? "" })} inBuild={inBuild} phone={phone} step="agent" runtime placeholder={DECISION_COPY.selectProvider} field />
      </Row>
      <Row id={`${uid}-version`} label={DECISION_COPY.version} phone={phone}>
        <FieldInput phone={phone} mono width={NARROW.version} id={`${uid}-version`} value={draft.model} maxLength={80} placeholder={DECISION_COPY.versionPlaceholder} onChange={(e) => set({ model: e.target.value })} />
      </Row>
      <Row id={`${uid}-via`} label={DECISION_COPY.invocation} group phone={phone}>
        <SegmentedField<"api" | "adapter"> label={DECISION_COPY.invocation} phone={phone} items={[{ value: "api", label: DECISION_COPY.direct }, { value: "adapter", label: DECISION_COPY.adapter }]} value={draft.via} onChange={(via) => set({ via })} />
      </Row>

      <Block label={DECISION_COPY.questions}>
        <BlockHead label={DECISION_COPY.questions} heading count={DECISION_COPY.questionsCount(draft.questions.length)} />
        {draft.questions.map((q, index) => (
          <QuestionEditor
            key={index}
            q={q}
            index={index}
            phone={phone}
            provider={draft.provider}
            canRemove={draft.questions.length > 1}
            onChange={(next) => set({ questions: draft.questions.map((candidate, i) => (i === index ? next : candidate)) })}
            onRemove={() => set({ questions: draft.questions.filter((_, i) => i !== index) })}
          />
        ))}
        <Inline>
          <RecipeButton small phone={phone} disabled={draft.questions.length >= QUESTIONS_MAX} onClick={() => set({ questions: [...draft.questions, blankQuestion()] })}>
            {DECISION_COPY.addQuestion}
          </RecipeButton>
        </Inline>
      </Block>

      <OptionalSection>
        <OptionalField name={DECISION_COPY.optionDescriptions} summary={summaryOf(described)} phone={phone}>
          {optioned.length === 0 ? <Hint>{DECISION_COPY.noOptionsYet}</Hint> : null}
          {optioned.map(({ q, at }) => (
            <div key={at} role="group" aria-label={`Option descriptions of question ${at + 1}`} style={PANEL_LIST}>
              <LabelText>{q.id.trim() || DECISION_COPY.question(at + 1)}</LabelText>
              {q.options.map((option, i) =>
                option.key.trim() ? (
                  <div key={i} style={optionDescribeRowStyle(phone)}>
                    <span style={{ ...BODY_TEXT, ...DATA_FACE, ...ELLIPSIS }}>{option.key.trim()}</span>
                    <FieldInput phone={phone} aria-label={`Description of ${q.type === "rank" ? "ranked option" : "option"} ${i + 1}`} value={option.line} maxLength={200} placeholder={DECISION_COPY.optionDescription} onChange={(e) => setOptionLine(at, i, e.target.value)} />
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </OptionalField>
        <OptionalField name={DECISION_COPY.paste} description={DECISION_COPY.pasteLine} forceOpen={open.import} phone={phone}>
          <FieldArea phone={phone} rows={3} mono aria-label={DECISION_COPY.paste} value={pasted} placeholder={DECISION_COPY.pastePlaceholder} onChange={(e) => setPasted(e.target.value)} />
          {codeTiles.length > 0 ? (
            <TextLink phone={phone} onClick={() => setFromCode(!fromCode)}>
              {DECISION_COPY.readCode}
            </TextLink>
          ) : null}
          {fromCode && codeTiles.length > 0 ? (
            <Inline>
              <PickMenu field label={DECISION_COPY.readCode} phone={phone} placeholder={DECISION_COPY.readCode} value={codeId || null} options={codeTiles.map((tile) => ({ value: tile.id, label: tile.label }))} onChange={setCodeId} />
              <RecipeButton small phone={phone} disabled={!codeId} onClick={() => read(codeTiles.find((tile) => tile.id === codeId)?.source ?? "")}>
                {DECISION_COPY.importCode}
              </RecipeButton>
            </Inline>
          ) : null}
          <Inline>
            <RecipeButton small phone={phone} disabled={!pasted.trim()} onClick={() => read(pasted)}>
              {DECISION_COPY.import}
            </RecipeButton>
          </Inline>
          {note ? <StatusLine strong={note.problem}>{note.text}</StatusLine> : null}
        </OptionalField>

        <OptionalField name={DECISION_COPY.callingCode} description={DECISION_COPY.callingCodeLine} summary={summaryOf(called)} forceOpen={open.calling} phone={phone}>
          {codeTiles.length > 0 ? (
            <OptionGrid
              label={DECISION_COPY.callingCode}
              phone={phone}
              multiple
              columns={2}
              items={codeTiles.map((tile) => ({ value: tile.id, label: tile.label }))}
              chosen={draft.calledFrom}
              onPick={(id) => set({ calledFrom: draft.calledFrom.includes(id) ? draft.calledFrom.filter((other) => other !== id) : [...draft.calledFrom, id] })}
            />
          ) : (
            <Hint>{DECISION_COPY.noCode}</Hint>
          )}
          {onAddCode ? (
            <Inline>
              <RecipeButton small phone={phone} onClick={onAddCode}>
                {DECISION_COPY.addCode}
              </RecipeButton>
            </Inline>
          ) : null}
        </OptionalField>

        <OptionalField name={DECISION_COPY.input} description={DECISION_COPY.inputLine} summary={draft.reads === "step" ? summaryOf(stepChoices.find((choice) => choice.id === draft.stateFrom)?.label) : summaryOf(firstLineOf(draft.stateSample, 80))} forceOpen={open.input} phone={phone}>
          <SegmentedField<"step" | "paste"> label={DECISION_COPY.input} phone={phone} items={[{ value: "step", label: DECISION_COPY.fromStep, disabled: stepChoices.length === 0 }, { value: "paste", label: DECISION_COPY.fromText }]} value={draft.reads} onChange={(reads) => set({ reads })} />
          {draft.reads === "step" ? (
            <PickMenu field label="Tile it reads" phone={phone} placeholder="Select a tile" value={draft.stateFrom} options={stepChoices.map((choice) => ({ value: choice.id, label: choice.label }))} onChange={(next) => set({ stateFrom: next })} />
          ) : (
            <>
              <FieldArea phone={phone} rows={3} aria-label={DECISION_COPY.state} value={draft.stateSample} maxLength={STATE_SAMPLE_MAX} placeholder={DECISION_COPY.statePlaceholder} onChange={(e) => set({ stateSample: e.target.value })} />
              <Count>
                {draft.stateSample.length.toLocaleString("en-GB")} / {STATE_SAMPLE_MAX.toLocaleString("en-GB")}
              </Count>
            </>
          )}
        </OptionalField>

        <OptionalField name={DECISION_COPY.answer} description={DECISION_COPY.answerLine} summary={summaryOf(answered.map((q) => `${q.id} → ${draft.answer[q.id].value}`))} forceOpen={open.answer} phone={phone}>
          <Hint>{DECISION_COPY.answerHint}</Hint>
          {draft.questions.filter((q) => q.id.trim()).map((q) => (
            <AnswerEditor
              key={q.id}
              q={q}
              phone={phone}
              answer={draft.answer[q.id]}
              onChange={(next) => {
                const answer = { ...draft.answer };
                if (next) answer[q.id] = next;
                else delete answer[q.id];
                set({ answer });
              }}
            />
          ))}
          {Object.keys(draft.answer).length > 0 ? (
            <SegmentedField<"run" | "maker"> label="Where the answer came from" phone={phone} items={[{ value: "run", label: "From the run" }, { value: "maker", label: "Maker's figure" }]} value={draft.source} onChange={(source) => set({ source })} />
          ) : null}
        </OptionalField>

        <OptionalField name={DECISION_COPY.labelSet} description={DECISION_COPY.labelSetLine} summary={summaryOf(pipe.labelName, pipe.labelSize ? `${pipe.labelSize} labels` : null)} forceOpen={open.pipeline} phone={phone}>
          <Inline>
            <LabelText>Labels</LabelText>
            <FieldInput phone={phone} mono width={NARROW.date} aria-label={DECISION_COPY.labelSize} inputMode="numeric" value={pipe.labelSize} placeholder="6000" onChange={(e) => setPipe({ labelSize: e.target.value.replace(/[^0-9]/g, "") })} />
            <SegmentedField<LabelStructure> label="Structure" phone={phone} items={[{ value: "flat", label: DECISION_COPY.flat }, { value: "hierarchical", label: DECISION_COPY.hierarchical }]} value={pipe.labelStructure} onChange={(labelStructure) => setPipe({ labelStructure })} />
          </Inline>
          <FieldInput phone={phone} aria-label={DECISION_COPY.labelName} maxLength={80} value={pipe.labelName} placeholder="Shopify product taxonomy" onChange={(e) => setPipe({ labelName: e.target.value })} />
          <FieldInput phone={phone} mono width={NARROW.version} aria-label={DECISION_COPY.labelVersion} maxLength={40} value={pipe.labelVersion} placeholder="Sept 2026" onChange={(e) => setPipe({ labelVersion: e.target.value })} />
        </OptionalField>

        <OptionalField name={DECISION_COPY.candidates} description={DECISION_COPY.candidatesLine} summary={summaryOf(stepLabel, pipe.candidatesK ? `top ${pipe.candidatesK}` : null)} forceOpen={open.pipeline} phone={phone}>
          <PickMenu field label={DECISION_COPY.candidatesStep} phone={phone} placeholder="No candidate step" value={pipe.candidatesStep} options={[{ value: NONE, label: "No candidate step" }, ...stepChoices.map((choice) => ({ value: choice.id, label: choice.label }))]} onChange={(next) => setPipe({ candidatesStep: next === NONE ? null : next })} />
          {pipe.candidatesStep ? (
            <Inline>
              <LabelText>Top</LabelText>
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={DECISION_COPY.candidatesK} inputMode="numeric" value={pipe.candidatesK} placeholder="30" onChange={(e) => setPipe({ candidatesK: e.target.value.replace(/[^0-9]/g, "") })} />
            </Inline>
          ) : null}
          <Hint>{DECISION_COPY.candidatesHint}. {CANDIDATES_K_MIN} to {CANDIDATES_K_MAX.toLocaleString("en-GB")}</Hint>
        </OptionalField>

        <OptionalField name={DECISION_COPY.selection} description={DECISION_COPY.selectionLine} summary={summaryOf(pipe.selection ? SELECTION_LABEL[pipe.selection] : null)} forceOpen={open.pipeline} phone={phone}>
          <OptionGrid
            label={DECISION_COPY.selection}
            phone={phone}
            columns={2}
            items={SELECTION_METHODS.map((method) => ({ value: method, label: SELECTION_LABEL[method] }))}
            chosen={pipe.selection ? [pipe.selection] : []}
            onPick={(method) => setPipe({ selection: pipe.selection === method ? "" : (method as SelectionMethod) })}
          />
          {pipe.selection === "beam_search" ? (
            <Inline>
              <LabelText>Beam width</LabelText>
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={DECISION_COPY.beamWidth} inputMode="numeric" value={pipe.beamWidth} placeholder="5" onChange={(e) => setPipe({ beamWidth: e.target.value.replace(/[^0-9]/g, "") })} />
            </Inline>
          ) : null}
          {pipe.selection === "beam_search" ? <Hint>{BEAM_WIDTH_MIN} to {BEAM_WIDTH_MAX}</Hint> : null}
        </OptionalField>

        <OptionalField name={DECISION_COPY.adaptation} description={DECISION_COPY.adaptationLine} summary={summaryOf(pipe.adaptation ? { zero_shot: DECISION_COPY.zeroShot, few_shot: DECISION_COPY.fewShot, fine_tuned: DECISION_COPY.fineTuned }[pipe.adaptation] : null)} forceOpen={open.pipeline} phone={phone}>
          <SegmentedField<AdaptationKind>
            label={DECISION_COPY.adaptation}
            phone={phone}
            items={[{ value: "zero_shot", label: DECISION_COPY.zeroShot }, { value: "few_shot", label: DECISION_COPY.fewShot }, { value: "fine_tuned", label: DECISION_COPY.fineTuned }]}
            value={pipe.adaptation === "" ? null : pipe.adaptation}
            onChange={(next) => setPipe({ adaptation: next === pipe.adaptation ? "" : next })}
          />
          {pipe.adaptation === "few_shot" ? <Hint>{DECISION_COPY.fewShotHint}</Hint> : null}
          {pipe.adaptation === "fine_tuned" ? <FieldInput phone={phone} mono aria-label={DECISION_COPY.baseModel} maxLength={80} value={pipe.baseModel} placeholder="gemma-3-4b" onChange={(e) => setPipe({ baseModel: e.target.value })} /> : null}
        </OptionalField>

        <OptionalField name={DECISION_COPY.knownLimits} description={DECISION_COPY.knownLimitsLine} summary={summaryOf(pipe.limits)} forceOpen={open.pipeline} phone={phone}>
          <FieldArea phone={phone} rows={3} aria-label={DECISION_COPY.knownLimits} value={pipe.limits} placeholder="Sequential narrowing over large label sets degrades accuracy" onChange={(e) => setPipe({ limits: e.target.value })} />
          <Hint>Up to {KNOWN_LIMITS_MAX} lines of {KNOWN_LIMIT_LINE_MAX} characters</Hint>
        </OptionalField>

        <OptionalField name={DECISION_COPY.install} description={DECISION_COPY.installLine} summary={summaryOf(draft.install)} forceOpen={open.install} phone={phone}>
          <FieldInput phone={phone} mono aria-label={DECISION_COPY.install} value={draft.install} maxLength={400} placeholder={DECISION_COPY.installPlaceholder} onChange={(e) => set({ install: e.target.value })} />
        </OptionalField>

        <OptionalField name={DECISION_COPY.examples} description={DECISION_COPY.examplesLine} summary={examples.length > 0 ? `${examples.length} ${examples.length === 1 ? "example" : "examples"}` : null} forceOpen={open.examples} phone={phone}>
          {examples.map((example, at) => (
            <div key={at} role="group" aria-label={`Example ${at + 1}`} data-testid="decision-example" style={PANEL_LIST}>
              <FieldInput phone={phone} aria-label={`${DECISION_COPY.exampleInput} of example ${at + 1}`} maxLength={EXAMPLE_TEXT_MAX} value={example.input} placeholder="I was charged twice" onChange={(e) => setExample(at, { input: e.target.value })} />
              <FieldInput phone={phone} aria-label={`${DECISION_COPY.exampleOutput} of example ${at + 1}`} maxLength={EXAMPLE_TEXT_MAX} value={example.output} placeholder="team = billing" onChange={(e) => setExample(at, { output: e.target.value })} />
              <TextLink phone={phone} onClick={() => set({ examples: examples.filter((_, i) => i !== at) })} aria-label={`Remove example ${at + 1}`}>
                Remove
              </TextLink>
            </div>
          ))}
          <Inline>
            <RecipeButton small phone={phone} disabled={examples.length >= EXAMPLES_MAX} onClick={() => set({ examples: [...examples, { input: "", output: "" }] })}>
              {DECISION_COPY.addExample}
            </RecipeButton>
          </Inline>
        </OptionalField>

        <OptionalField
          name={DECISION_COPY.lowConfidence}
          description={DECISION_COPY.lowConfidenceLine}
          summary={low.mode === "escalate" ? DECISION_COPY.escalate : low.mode === "threshold" && low.threshold.trim() ? `${DECISION_COPY.threshold} ${low.threshold.trim()}` : null}
          forceOpen={open.low}
          phone={phone}
        >
          <SegmentedField<"threshold" | "escalate">
            label={DECISION_COPY.lowConfidence}
            phone={phone}
            items={[{ value: "threshold", label: DECISION_COPY.threshold }, { value: "escalate", label: DECISION_COPY.escalate }]}
            value={low.mode === "" ? null : low.mode}
            onChange={(next) => set({ lowConfidence: { ...low, mode: next === low.mode ? "" : next } })}
          />
          {low.mode === "threshold" ? (
            <>
              <FieldInput phone={phone} mono width={NARROW.date} aria-label={DECISION_COPY.threshold} inputMode="decimal" value={low.threshold} placeholder={DECISION_COPY.thresholdPlaceholder} onChange={(e) => set({ lowConfidence: { ...low, threshold: e.target.value.replace(/[^0-9.]/g, "") } })} />
              <Hint>0 to 1. Below it: not trusted</Hint>
            </>
          ) : null}
        </OptionalField>
      </OptionalSection>
    </>
  );
}
