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
import { applyImport, blankQuestion, type AnswerDraft, type DecisionDraft, type QuestionDraft } from "@/lib/build/decisionDraft";
import { EXAMPLES_MAX, EXAMPLE_TEXT_MAX, EXTRACT_FIELDS, EXTRACT_FIELD_LABEL, QUESTION_TYPES, QUESTIONS_MAX, STATE_SAMPLE_MAX, isTypeSafe, questionTypeLabel, takesOptions, type ExtractField, type QuestionType } from "@/lib/build/decision";
import { KEY_REMOVED_LINE, parseDecisionCall } from "@/lib/build/decisionImport";
import { firstLineOf } from "@/lib/build/graph";

import { ChoiceGrid } from "./ChoiceGrid";
import {
  Block,
  BlockHead,
  Count,
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
  optionRowStyle,
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
  versionPlaceholder: "e.g. jev-1.13.0",
  invocation: "Invocation",
  direct: "Direct",
  adapter: "Through an adapter",
  questions: "Questions",
  addQuestion: "Add a question",
  key: "Key",
  keyPlaceholder: "e.g. team",
  paste: "Import from a logged request and response",
  pasteLine: "Populates the fields above from JSON, a curl command or Python",
  pastePlaceholder: "The JSON request body and response, a curl command, or Python with every value written out",
  import: "Import",
  readCode: "Read from a Code tile",
  callingCode: "Calling code",
  callingCodeLine: "The code that sends the request, added as a Code tile",
  noCode: "Add the code that calls it as a Code tile, so people copying this get the real thing",
  addCode: "Add code",
  input: "Input",
  inputLine: "The output of another step, or sample text",
  fromStep: "Output of another step",
  fromText: "Sample text",
  state: "Sample text",
  statePlaceholder: "e.g. Customer: I was charged twice for my order.",
  answer: "Recorded answer",
  answerLine: "One real answer the model returned",
  answerHint: "One value and confidence per question.",
  confidence: "Confidence",
  install: "Installation command",
  installLine: "Exactly as you typed it",
  installPlaceholder: "e.g. pip install typesafe",
  examples: "Examples",
  examplesLine: "Real inputs with the output returned for each",
  addExample: "Add an example",
  exampleInput: "Input",
  exampleOutput: "Expected output",
  lowConfidence: "Low-confidence handling",
  lowConfidenceLine: "A confidence threshold, or escalation to a person",
  threshold: "Confidence threshold",
  escalate: "Escalate to a person",
  thresholdPlaceholder: "e.g. 0.6",
  optionDescription: "Description (optional)",
  fieldType: "Field type",
  questionsCount: (n: number) => `${n} ${n === 1 ? "question" : "questions"}`,
  question: (n: number) => `Question ${n}`,
  removeQuestion: (n: number) => `Remove question ${n}`,
  type: "Type",
  instructions: "Instructions",
  instructionsPlaceholder: "e.g. Which team should handle this message?",
  options: "Options",
  levels: "Levels",
  addOption: "Add an option",
  addLevel: "Add a level",
  importCode: "Import from the code",
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
  open?: Partial<Record<"import" | "calling" | "input" | "answer" | "install" | "examples" | "low", boolean>>;
}

/** One option: a drag handle, its key, its description and its remove button. The handle drags; the arrow keys move it too. */
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
      style={optionRowStyle(phone)}
    >
      <button
        type="button"
        draggable
        aria-label={`Move ${label.toLowerCase()} ${index + 1}. Drag, or use the up and down arrow keys.`}
        onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
        onKeyDown={onKey}
        style={GRIP}
      >
        <Glyph name="grip" size={14} />
      </button>
      <FieldInput phone={phone} mono aria-label={`${label} ${index + 1}`} value={option.key} maxLength={80} placeholder="e.g. billing" onChange={(e) => onChange({ ...option, key: e.target.value })} />
      <FieldInput phone={phone} aria-label={`Description of ${label.toLowerCase()} ${index + 1}`} value={option.line} maxLength={200} placeholder={DECISION_COPY.optionDescription} onChange={(e) => onChange({ ...option, line: e.target.value })} />
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
          items={QUESTION_TYPES.map((value) => ({ value, label: value === "yesno" && isTypeSafe(provider) ? "Yes or no (Noul)" : questionTypeLabel(value) }))}
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
            {q.type === "rank" ? <Hint>The answer puts every option in order.</Hint> : null}
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
                <FieldInput phone={phone} aria-label={`Level ${i + 1}`} value={level} maxLength={60} placeholder={i === 0 ? "e.g. Calm" : "e.g. Annoyed"} onChange={(e) => onChange({ ...q, levels: q.levels.map((l, j) => (j === i ? e.target.value : l)) })} />
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
          <FieldInput phone={phone} id={`${uid}-v`} aria-label={`Answer to ${q.id}`} value={value} placeholder={q.type === "rank" ? "e.g. every option, in order, comma separated" : "e.g. billing, support"} onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} />
        ) : q.type === "extract" ? (
          <FieldInput phone={phone} id={`${uid}-v`} aria-label={`Answer to ${q.id}`} value={value} placeholder={`e.g. the ${EXTRACT_FIELD_LABEL[q.field].toLowerCase()} it pulled out`} onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} />
        ) : (
          <FieldInput phone={phone} mono id={`${uid}-v`} aria-label={`Answer to ${q.id}`} inputMode="decimal" value={value} placeholder="e.g. 0 to 1" onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} />
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
            <PickMenu field label="Step it reads" phone={phone} placeholder="Select a step" value={draft.stateFrom} options={stepChoices.map((choice) => ({ value: choice.id, label: choice.label }))} onChange={(next) => set({ stateFrom: next })} />
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

        <OptionalField name={DECISION_COPY.install} description={DECISION_COPY.installLine} summary={summaryOf(draft.install)} forceOpen={open.install} phone={phone}>
          <FieldInput phone={phone} mono aria-label={DECISION_COPY.install} value={draft.install} maxLength={400} placeholder={DECISION_COPY.installPlaceholder} onChange={(e) => set({ install: e.target.value })} />
        </OptionalField>

        <OptionalField name={DECISION_COPY.examples} description={DECISION_COPY.examplesLine} summary={examples.length > 0 ? `${examples.length} ${examples.length === 1 ? "example" : "examples"}` : null} forceOpen={open.examples} phone={phone}>
          {examples.map((example, at) => (
            <div key={at} role="group" aria-label={`Example ${at + 1}`} data-testid="decision-example" style={PANEL_LIST}>
              <FieldInput phone={phone} aria-label={`${DECISION_COPY.exampleInput} of example ${at + 1}`} maxLength={EXAMPLE_TEXT_MAX} value={example.input} placeholder="e.g. I was charged twice" onChange={(e) => setExample(at, { input: e.target.value })} />
              <FieldInput phone={phone} aria-label={`${DECISION_COPY.exampleOutput} of example ${at + 1}`} maxLength={EXAMPLE_TEXT_MAX} value={example.output} placeholder="e.g. team = billing" onChange={(e) => setExample(at, { output: e.target.value })} />
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
              <Hint>A number from 0 to 1. Below it, the answer is not trusted.</Hint>
            </>
          ) : null}
        </OptionalField>
      </OptionalSection>
    </>
  );
}
