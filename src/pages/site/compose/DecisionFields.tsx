/* CA-13 P2, CA-15 P8: the Decision form's fields, shared by Add › Decision and Details.

   In this order:

   1. A "Model" heading: Model or service (from the Runtime models and services subcategory), Version, and Invocation (Direct,
      or Through an adapter).
   2. Questions, a builder: Key, Type (Single choice, Multiple choice, Score, Ranking, Yes or no, Extraction), then what the type
      takes: options (with a drag handle each), levels, or an extraction's field type (Text, Number, Date, Amount).
   3. The Optional section: Import from a logged request and response (the fast route, through `parseDecisionCall`; Import,
      and Read from a Code tile), Calling code, Input, Recorded answer, Installation command, Examples (input and expected
      output pairs) and Low-confidence handling (a confidence threshold from 0 to 1, or Escalate to a person).

   It never runs anything and never keeps a key. */

import { useId, useState, type DragEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph } from "@/components/brand/Glyph";
import { Segmented } from "@/components/brand/Segmented";
import { applyImport, blankQuestion, type AnswerDraft, type DecisionDraft, type QuestionDraft } from "@/lib/build/decisionDraft";
import { EXAMPLES_MAX, EXAMPLE_TEXT_MAX, EXTRACT_FIELDS, EXTRACT_FIELD_LABEL, QUESTION_TYPES, QUESTIONS_MAX, STATE_SAMPLE_MAX, isTypeSafe, questionTypeLabel, takesOptions, type ExtractField, type QuestionType } from "@/lib/build/decision";
import { KEY_REMOVED_LINE, parseDecisionCall } from "@/lib/build/decisionImport";
import { firstLineOf } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";

import { ChoiceGrid } from "./ChoiceGrid";
import { Field, TextButton } from "./composeControls";
import { FieldRow, FieldRows, Hint, SectionHeading } from "./ModalFrame";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";
import { PickMenu } from "./PickMenu";
import { text as type, tnum, typedArea, typedField } from "./refinedStyles";
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
  pasteLine: "Fills in the questions, and an answer when the response is included",
  pastePlaceholder: "e.g. The JSON request body and response, a curl command, or Python with every value written out",
  import: "Import",
  readCode: "Read from a Code tile",
  callingCode: "Calling code",
  callingCodeLine: "The Code tiles that make the call",
  noCode: "Add the code that calls it as a Code tile, so people copying this get the real thing",
  addCode: "Add code",
  input: "Input",
  inputLine: "What the decision reads",
  fromStep: "Output of another step",
  fromText: "Sample text",
  state: "Sample text",
  statePlaceholder: "e.g. Customer: I was charged twice for my order.",
  answer: "Recorded answer",
  answerLine: "An answer the decision actually gave",
  confidence: "Confidence",
  install: "Installation command",
  installLine: "Exactly as you would type it",
  installPlaceholder: "e.g. pip install typesafe",
  examples: "Examples",
  examplesLine: "Inputs with the output expected for each",
  addExample: "Add an example",
  exampleInput: "Input",
  exampleOutput: "Expected output",
  lowConfidence: "Low-confidence handling",
  lowConfidenceLine: "What happens when the decision is not confident",
  threshold: "Confidence threshold",
  escalate: "Escalate to a person",
  thresholdPlaceholder: "e.g. 0.6",
  optionDescription: "Description (optional)",
  fieldType: "Field type",
} as const;

const phoneSize = (phone: boolean) => (phone ? 44 : 32);
const segSize = (phone: boolean) => (phone ? 50 : 32);

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

const quiet = type(12, 400, t.label);

/** One option: a drag handle, its key, its description and Remove. The handle drags; the arrow keys move it too. */
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
      style={{ display: "flex", gap: 6, alignItems: "center" }}
    >
      <button
        type="button"
        draggable
        aria-label={`Move ${label.toLowerCase()} ${index + 1}. Drag, or use the up and down arrow keys.`}
        onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
        onKeyDown={onKey}
        style={{ appearance: "none", background: "none", border: 0, padding: 0, width: phone ? 44 : 20, height: phone ? 44 : 28, flexShrink: 0, color: t.label, cursor: "grab", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        <Glyph name="grip" size={14} />
      </button>
      <input aria-label={`${label} ${index + 1}`} type="text" value={option.key} maxLength={80} placeholder="e.g. billing" onChange={(e) => onChange({ ...option, key: e.target.value })} style={typedField(phone, { flex: "0 0 36%", minWidth: 0 })} />
      <input aria-label={`Description of ${label.toLowerCase()} ${index + 1}`} type="text" value={option.line} maxLength={200} placeholder={DECISION_COPY.optionDescription} onChange={(e) => onChange({ ...option, line: e.target.value })} style={typedField(phone, { flex: 1, minWidth: 0 })} />
      {count > 2 ? (
        <TextButton target={phone} onClick={onRemove} aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}>
          Remove
        </TextButton>
      ) : null}
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
    <div role="group" aria-label={`Question ${index + 1}`} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: t.tile, border: `1px solid ${t.tileBorder}`, borderRadius: 6 }}>
      <Field id={`${uid}-key`} label={DECISION_COPY.key}>
        <input id={`${uid}-key`} type="text" value={q.id} maxLength={40} placeholder={DECISION_COPY.keyPlaceholder} onChange={(e) => onChange({ ...q, id: e.target.value })} style={typedField(phone)} />
      </Field>
      <ChoiceGrid<QuestionType>
        label={`Type of question ${index + 1}`}
        items={QUESTION_TYPES.map((value) => ({ value, label: value === "yesno" && isTypeSafe(provider) ? "Yes or no (Noul)" : questionTypeLabel(value) }))}
        value={q.type}
        onChange={(next) => next && onChange({ ...q, type: next })}
        phone={phone}
      />
      <Field id={`${uid}-ins`} label="Instructions">
        <textarea id={`${uid}-ins`} rows={2} value={q.instructions} maxLength={600} onChange={(e) => onChange({ ...q, instructions: e.target.value })} style={typedArea(phone)} />
      </Field>
      {takesOptions(q.type) ? (
        <div role="group" aria-label={`Options of question ${index + 1}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {q.type === "rank" ? <span style={quiet}>The answer puts every option in order.</span> : null}
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
          <div>
            <Button variant="secondary" size={phoneSize(phone)} onClick={() => onChange({ ...q, options: [...q.options, { key: "", line: "" }] })}>
              Add an option
            </Button>
          </div>
        </div>
      ) : null}
      {q.type === "score" ? (
        <div role="group" aria-label={`Levels of question ${index + 1}, lowest to highest`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={quiet}>Lowest to highest</span>
          {q.levels.map((level, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input aria-label={`Level ${i + 1}`} type="text" value={level} maxLength={60} placeholder={i === 0 ? "e.g. Calm" : "e.g. Annoyed"} onChange={(e) => onChange({ ...q, levels: q.levels.map((l, j) => (j === i ? e.target.value : l)) })} style={typedField(phone, { flex: 1, minWidth: 0 })} />
              {q.levels.length > 2 ? (
                <TextButton target={phone} onClick={() => onChange({ ...q, levels: q.levels.filter((_, j) => j !== i) })} aria-label={`Remove level ${i + 1}`}>
                  Remove
                </TextButton>
              ) : null}
            </div>
          ))}
          <div>
            <Button variant="secondary" size={phoneSize(phone)} onClick={() => onChange({ ...q, levels: [...q.levels, ""] })}>
              Add a level
            </Button>
          </div>
        </div>
      ) : null}
      {q.type === "extract" ? (
        <Field id={`${uid}-field`} label={DECISION_COPY.fieldType} group>
          <ChoiceGrid<ExtractField> bare label={`Field type of question ${index + 1}`} items={EXTRACT_FIELDS.map((value) => ({ value, label: EXTRACT_FIELD_LABEL[value] }))} value={q.field} onChange={(next) => next && onChange({ ...q, field: next })} phone={phone} columns={4} />
        </Field>
      ) : null}
      {canRemove ? (
        <div>
          <TextButton target={phone} onClick={onRemove} aria-label={`Remove question ${index + 1}`}>
            Remove question
          </TextButton>
        </div>
      ) : null}
    </div>
  );
}

function AnswerEditor({ q, answer, onChange, phone }: { q: QuestionDraft; answer: AnswerDraft | undefined; onChange: (next: AnswerDraft | null) => void; phone: boolean }) {
  const uid = useId();
  const value = answer?.value ?? "";
  const set = (patch: Partial<AnswerDraft>) => onChange({ value, sure: answer?.sure ?? "", kept: answer?.kept, ...patch });
  const options = q.options.filter((o) => o.key.trim());
  const levels = q.levels.filter((level) => level.trim());
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <Field id={`${uid}-v`} label={q.id.trim() || "Question"}>
        {q.type === "choice" ? (
          <PickMenu
            id={`${uid}-v`}
            label={`Answer to ${q.id}`}
            phone={phone}
            placeholder="No answer"
            value={value || null}
            options={[{ value: NONE, label: "No answer" }, ...options.map((o) => ({ value: o.key, label: o.key }))]}
            onChange={(next) => (next === NONE ? onChange(null) : set({ value: next }))}
          />
        ) : q.type === "score" ? (
          <PickMenu
            id={`${uid}-v`}
            label={`Answer to ${q.id}`}
            phone={phone}
            placeholder="No answer"
            value={value || null}
            options={[{ value: NONE, label: "No answer" }, ...levels.map((level, i) => ({ value: String(i), label: level }))]}
            onChange={(next) => (next === NONE ? onChange(null) : set({ value: next }))}
          />
        ) : q.type === "multi" || q.type === "rank" ? (
          <input id={`${uid}-v`} aria-label={`Answer to ${q.id}`} type="text" value={value} placeholder={q.type === "rank" ? "e.g. every option, in order, comma separated" : "e.g. billing, support"} onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} style={typedField(phone)} />
        ) : q.type === "extract" ? (
          <input id={`${uid}-v`} aria-label={`Answer to ${q.id}`} type="text" value={value} placeholder={`e.g. the ${EXTRACT_FIELD_LABEL[q.field].toLowerCase()} it pulled out`} onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} style={typedField(phone)} />
        ) : (
          <input id={`${uid}-v`} type="text" inputMode="decimal" value={value} placeholder="e.g. 0 to 1" onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} style={typedField(phone, tnum)} />
        )}
      </Field>
      {q.type !== "yesno" ? (
        <Field id={`${uid}-s`} label={DECISION_COPY.confidence} hint="Percent">
          <input id={`${uid}-s`} type="text" inputMode="numeric" value={answer?.sure ?? ""} disabled={!value} onChange={(e) => set({ sure: e.target.value })} style={typedField(phone, { width: 80, ...tnum })} />
        </Field>
      ) : null}
    </div>
  );
}

export function DecisionFields({ draft, onChange, phone, codeTiles, stepChoices, inBuild = [], onAddCode, open = {} }: DecisionFieldsProps) {
  const uid = useId();
  const [pasted, setPasted] = useState("");
  const [note, setNote] = useState<{ text: string; problem: boolean } | null>(null);
  const [codeId, setCodeId] = useState("");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}>
      <SectionHeading>{DECISION_COPY.model}</SectionHeading>
      <FieldRows>
        <FieldRow id={`${uid}-prov`} label={DECISION_COPY.provider} group phone={phone}>
          <div>
            <ToolPicker label={DECISION_COPY.provider} value={draft.provider || null} onChange={(next) => set({ provider: next ?? "" })} inBuild={inBuild} phone={phone} step="agent" runtime placeholder={DECISION_COPY.selectProvider} />
          </div>
        </FieldRow>
        <FieldRow id={`${uid}-version`} label={DECISION_COPY.version} phone={phone}>
          <input id={`${uid}-version`} type="text" value={draft.model} maxLength={80} placeholder={DECISION_COPY.versionPlaceholder} onChange={(e) => set({ model: e.target.value })} style={typedField(phone)} />
        </FieldRow>
        <FieldRow id={`${uid}-via`} label={DECISION_COPY.invocation} group phone={phone}>
          <Segmented<"api" | "adapter">
            label={DECISION_COPY.invocation}
            semantics="radio"
            size={segSize(phone)}
            fontSize={13}
            items={[{ value: "api", label: DECISION_COPY.direct }, { value: "adapter", label: DECISION_COPY.adapter }]}
            value={draft.via}
            onChange={(via) => set({ via })}
          />
        </FieldRow>
      </FieldRows>

      <Field id={`${uid}-qs`} label={DECISION_COPY.questions} group>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
          <div>
            <Button variant="secondary" size={phoneSize(phone)} disabled={draft.questions.length >= QUESTIONS_MAX} onClick={() => set({ questions: [...draft.questions, blankQuestion()] })}>
              {DECISION_COPY.addQuestion}
            </Button>
          </div>
        </div>
      </Field>

      <OptionalSection>
        <OptionalField name={DECISION_COPY.paste} description={DECISION_COPY.pasteLine} forceOpen={open.import} phone={phone}>
          <textarea aria-label={DECISION_COPY.paste} rows={4} value={pasted} placeholder={DECISION_COPY.pastePlaceholder} onChange={(e) => setPasted(e.target.value)} style={typedArea(phone, { fontFamily: "var(--font-data)", fontSize: phone ? 16 : 12 })} />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="secondary" size={phoneSize(phone)} disabled={!pasted.trim()} onClick={() => read(pasted)}>
              {DECISION_COPY.import}
            </Button>
            {codeTiles.length > 0 ? (
              <>
                <PickMenu label={DECISION_COPY.readCode} phone={phone} placeholder={DECISION_COPY.readCode} value={codeId || null} options={codeTiles.map((tile) => ({ value: tile.id, label: tile.label }))} onChange={setCodeId} style={{ maxWidth: 220 }} />
                <Button variant="secondary" size={phoneSize(phone)} disabled={!codeId} onClick={() => read(codeTiles.find((tile) => tile.id === codeId)?.source ?? "")}>
                  Import from the code
                </Button>
              </>
            ) : null}
          </div>
          {note ? (
            <span role="status" style={type(12, 400, note.problem ? t.text : t.label)}>
              {note.text}
            </span>
          ) : null}
        </OptionalField>

        <OptionalField name={DECISION_COPY.callingCode} description={DECISION_COPY.callingCodeLine} summary={summaryOf(called)} forceOpen={open.calling} phone={phone}>
          {codeTiles.length > 0 ? (
            <div role="group" aria-label={DECISION_COPY.callingCode} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {codeTiles.map((tile) => (
                <label key={tile.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 24 }}>
                  <Checkbox checked={draft.calledFrom.includes(tile.id)} onChange={(e) => set({ calledFrom: e.target.checked ? [...draft.calledFrom, tile.id] : draft.calledFrom.filter((id) => id !== tile.id) })} />
                  <span style={type(13, 400, t.text)}>{tile.label}</span>
                </label>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
              <span style={quiet}>{DECISION_COPY.noCode}</span>
              {onAddCode ? (
                <Button variant="secondary" size={phoneSize(phone)} onClick={onAddCode}>
                  {DECISION_COPY.addCode}
                </Button>
              ) : null}
            </div>
          )}
        </OptionalField>

        <OptionalField name={DECISION_COPY.input} description={DECISION_COPY.inputLine} summary={draft.reads === "step" ? summaryOf(stepChoices.find((choice) => choice.id === draft.stateFrom)?.label) : summaryOf(firstLineOf(draft.stateSample, 80))} forceOpen={open.input} phone={phone}>
          <Segmented<"step" | "paste">
            label={DECISION_COPY.input}
            semantics="radio"
            size={segSize(phone)}
            fontSize={13}
            items={[{ value: "step", label: DECISION_COPY.fromStep, disabled: stepChoices.length === 0 }, { value: "paste", label: DECISION_COPY.fromText }]}
            value={draft.reads}
            onChange={(reads) => set({ reads })}
          />
          {draft.reads === "step" ? (
            <PickMenu label="Step it reads" phone={phone} placeholder="Select a step" value={draft.stateFrom} options={stepChoices.map((choice) => ({ value: choice.id, label: choice.label }))} onChange={(next) => set({ stateFrom: next })} />
          ) : (
            <>
              <textarea aria-label={DECISION_COPY.state} rows={3} value={draft.stateSample} maxLength={STATE_SAMPLE_MAX} placeholder={DECISION_COPY.statePlaceholder} onChange={(e) => set({ stateSample: e.target.value })} style={typedArea(phone)} />
              <span style={{ ...quiet, ...tnum, alignSelf: "flex-end" }}>
                {draft.stateSample.length.toLocaleString("en-GB")} / {STATE_SAMPLE_MAX.toLocaleString("en-GB")}
              </span>
            </>
          )}
        </OptionalField>

        <OptionalField name={DECISION_COPY.answer} description={DECISION_COPY.answerLine} summary={summaryOf(answered.map((q) => `${q.id} → ${draft.answer[q.id].value}`))} forceOpen={open.answer} phone={phone}>
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
            <Segmented<"run" | "maker">
              label="Where the answer came from"
              size={segSize(phone)}
              fontSize={13}
              items={[{ value: "run", label: "From the run" }, { value: "maker", label: "Maker's figure" }]}
              value={draft.source}
              onChange={(source) => set({ source })}
            />
          ) : null}
        </OptionalField>

        <OptionalField name={DECISION_COPY.install} description={DECISION_COPY.installLine} summary={summaryOf(draft.install)} forceOpen={open.install} phone={phone}>
          <input aria-label={DECISION_COPY.install} type="text" value={draft.install} maxLength={400} placeholder={DECISION_COPY.installPlaceholder} onChange={(e) => set({ install: e.target.value })} style={typedField(phone)} />
        </OptionalField>

        <OptionalField name={DECISION_COPY.examples} description={DECISION_COPY.examplesLine} summary={examples.length > 0 ? `${examples.length} ${examples.length === 1 ? "example" : "examples"}` : null} forceOpen={open.examples} phone={phone}>
          {examples.map((example, at) => (
            <div key={at} role="group" aria-label={`Example ${at + 1}`} data-testid="decision-example" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input aria-label={`${DECISION_COPY.exampleInput} of example ${at + 1}`} type="text" maxLength={EXAMPLE_TEXT_MAX} value={example.input} placeholder="e.g. I was charged twice" onChange={(e) => setExample(at, { input: e.target.value })} style={typedField(phone)} />
              <input aria-label={`${DECISION_COPY.exampleOutput} of example ${at + 1}`} type="text" maxLength={EXAMPLE_TEXT_MAX} value={example.output} placeholder="e.g. team = billing" onChange={(e) => setExample(at, { output: e.target.value })} style={typedField(phone)} />
              <div>
                <TextButton target={phone} onClick={() => set({ examples: examples.filter((_, i) => i !== at) })} aria-label={`Remove example ${at + 1}`}>
                  Remove
                </TextButton>
              </div>
            </div>
          ))}
          <div>
            <Button variant="secondary" size={phoneSize(phone)} disabled={examples.length >= EXAMPLES_MAX} onClick={() => set({ examples: [...examples, { input: "", output: "" }] })}>
              {DECISION_COPY.addExample}
            </Button>
          </div>
        </OptionalField>

        <OptionalField
          name={DECISION_COPY.lowConfidence}
          description={DECISION_COPY.lowConfidenceLine}
          summary={low.mode === "escalate" ? DECISION_COPY.escalate : low.mode === "threshold" && low.threshold.trim() ? `${DECISION_COPY.threshold} ${low.threshold.trim()}` : null}
          forceOpen={open.low}
          phone={phone}
        >
          <ChoiceGrid<"threshold" | "escalate">
            label={DECISION_COPY.lowConfidence}
            items={[{ value: "threshold", label: DECISION_COPY.threshold }, { value: "escalate", label: DECISION_COPY.escalate }]}
            value={low.mode === "" ? null : low.mode}
            onChange={(next) => set({ lowConfidence: { ...low, mode: next ?? "" } })}
            phone={phone}
            columns={2}
            allowClear
          />
          {low.mode === "threshold" ? (
            <>
              <input aria-label={DECISION_COPY.threshold} type="text" inputMode="decimal" value={low.threshold} placeholder={DECISION_COPY.thresholdPlaceholder} onChange={(e) => set({ lowConfidence: { ...low, threshold: e.target.value.replace(/[^0-9.]/g, "") } })} style={typedField(phone, { width: 120, ...tnum })} />
              <Hint>A number from 0 to 1. Below it, the answer is not trusted.</Hint>
            </>
          ) : null}
        </OptionalField>
      </OptionalSection>
    </div>
  );
}
