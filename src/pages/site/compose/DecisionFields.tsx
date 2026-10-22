/* CA-13 P2 — the Decision form's fields, shared by Add › Decision and Details.

   Six sections, in this order: Model (provider and model from the Runtime models and services subcategory, called directly or
   through an adapter), Called from (the Code tiles that make the call, rule 4), What it reads (another step's output, or a
   state pasted here), Questions (a builder), One real answer (optional) and the fast route, "Paste a logged request and
   response", which fills the others through `parseDecisionCall`. It never runs anything and never keeps a key. */

import { useId, useState } from "react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Segmented } from "@/components/brand/Segmented";
import { applyImport, blankQuestion, type AnswerDraft, type DecisionDraft, type QuestionDraft } from "@/lib/build/decisionDraft";
import { isTypeSafe, questionTypeLabel, QUESTIONS_MAX, STATE_SAMPLE_MAX, type QuestionType } from "@/lib/build/decision";
import { KEY_REMOVED_LINE, parseDecisionCall } from "@/lib/build/decisionImport";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
import { text as type, tnum, typedArea, typedField } from "./refinedStyles";
import { PickMenu } from "./PickMenu";
import { ToolPicker } from "./ToolPicker";

const NONE = "__none__";

export const DECISION_COPY = {
  model: "Model",
  provider: "Model or service",
  modelName: "Model",
  modelPlaceholder: "jev-1.13.0",
  direct: "Called directly",
  adapter: "Through an adapter",
  calledFrom: "Called from",
  noCode: "Add the code that calls it as a Code tile, so people copying this get the real thing",
  addCode: "Add code",
  reads: "What it reads",
  fromStep: "Another step's output",
  fromText: "Text I'll paste",
  state: "The state",
  statePlaceholder: "Customer: I was charged twice for my order.",
  questions: "Questions",
  addQuestion: "Add a question",
  answer: "One real answer",
  paste: "Paste a logged request and response",
  pastePlaceholder: "The JSON request body and response, a curl command, or Python with every value written out",
  read: "Read it",
  readCode: "Read from a Code tile",
  install: "How to install",
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
}

const quiet = type(12, 400, t.label);

function QuestionEditor({ q, index, onChange, onRemove, phone, provider, canRemove }: { q: QuestionDraft; index: number; onChange: (next: QuestionDraft) => void; onRemove: () => void; phone: boolean; provider: string; canRemove: boolean }) {
  const uid = useId();
  const types: QuestionType[] = ["choice", "score", "yesno"];
  return (
    <div role="group" aria-label={`Question ${index + 1}`} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: t.tile, border: `1px solid ${t.tileBorder}`, borderRadius: 6 }}>
      <Field id={`${uid}-name`} label="Name">
        <input id={`${uid}-name`} type="text" value={q.id} maxLength={40} placeholder="team" onChange={(e) => onChange({ ...q, id: e.target.value })} style={typedField(phone)} />
      </Field>
      <Segmented<QuestionType>
        label={`Type of question ${index + 1}`}
        size={segSize(phone)}
        fontSize={13}
        items={types.map((value) => ({ value, label: value === "yesno" && isTypeSafe(provider) ? "Yes or no (Noul)" : value === "yesno" ? "Yes or no" : questionTypeLabel(value) }))}
        value={q.type}
        onChange={(next) => onChange({ ...q, type: next })}
      />
      {q.type === "yesno" ? <span style={quiet}>{questionTypeLabel("yesno")}</span> : null}
      <Field id={`${uid}-ins`} label="Instructions">
        <textarea id={`${uid}-ins`} rows={2} value={q.instructions} maxLength={600} onChange={(e) => onChange({ ...q, instructions: e.target.value })} style={typedArea(phone)} />
      </Field>
      {q.type === "choice" ? (
        <div role="group" aria-label={`Options of question ${index + 1}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {q.options.map((option, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input aria-label={`Option ${i + 1}`} type="text" value={option.key} maxLength={80} placeholder="billing" onChange={(e) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? { ...o, key: e.target.value } : o)) })} style={typedField(phone, { flex: "0 0 38%", minWidth: 0 })} />
              <input aria-label={`Line for option ${i + 1}`} type="text" value={option.line} maxLength={200} placeholder="A line about it, optional" onChange={(e) => onChange({ ...q, options: q.options.map((o, j) => (j === i ? { ...o, line: e.target.value } : o)) })} style={typedField(phone, { flex: 1, minWidth: 0 })} />
              {q.options.length > 2 ? (
                <TextButton target={phone} onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== i) })} aria-label={`Remove option ${i + 1}`}>
                  Remove
                </TextButton>
              ) : null}
            </div>
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
              <input aria-label={`Level ${i + 1}`} type="text" value={level} maxLength={60} placeholder={i === 0 ? "Calm" : "Annoyed"} onChange={(e) => onChange({ ...q, levels: q.levels.map((l, j) => (j === i ? e.target.value : l)) })} style={typedField(phone, { flex: 1, minWidth: 0 })} />
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
        ) : (
          <input id={`${uid}-v`} type="text" inputMode="decimal" value={value} placeholder="0 to 1" onChange={(e) => (e.target.value ? set({ value: e.target.value }) : onChange(null))} style={typedField(phone, tnum)} />
        )}
      </Field>
      {q.type !== "yesno" ? (
        <Field id={`${uid}-s`} label="How sure" hint="Percent, optional">
          <input id={`${uid}-s`} type="text" inputMode="numeric" value={answer?.sure ?? ""} disabled={!value} onChange={(e) => set({ sure: e.target.value })} style={typedField(phone, { width: 80, ...tnum })} />
        </Field>
      ) : null}
    </div>
  );
}

export function DecisionFields({ draft, onChange, phone, codeTiles, stepChoices, inBuild = [], onAddCode }: DecisionFieldsProps) {
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
    setNote({ text: `Read ${result.value.questions.length} ${result.value.questions.length === 1 ? "question" : "questions"}${result.value.answer ? " and an answer" : ""}. Check them below.${result.value.keyRemoved ? ` ${KEY_REMOVED_LINE}` : ""}`, problem: false });
    setPasted("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: phone ? 16 : 13 }}>
      <Field id={`${uid}-paste`} label={DECISION_COPY.paste} hint="The quick way">
        <textarea id={`${uid}-paste`} rows={4} value={pasted} placeholder={DECISION_COPY.pastePlaceholder} onChange={(e) => setPasted(e.target.value)} style={typedArea(phone, { fontFamily: "var(--font-data)", fontSize: phone ? 16 : 12 })} />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Button variant="secondary" size={phoneSize(phone)} disabled={!pasted.trim()} onClick={() => read(pasted)}>
            {DECISION_COPY.read}
          </Button>
          {codeTiles.length > 0 ? (
            <>
              <PickMenu
                label={DECISION_COPY.readCode}
                phone={phone}
                placeholder={DECISION_COPY.readCode}
                value={codeId || null}
                options={codeTiles.map((tile) => ({ value: tile.id, label: tile.label }))}
                onChange={setCodeId}
                style={{ maxWidth: 220 }}
              />
              <Button variant="secondary" size={phoneSize(phone)} disabled={!codeId} onClick={() => read(codeTiles.find((tile) => tile.id === codeId)?.source ?? "")}>
                Read it from the code
              </Button>
            </>
          ) : null}
        </div>
        {note ? (
          <span role="status" style={type(12, 400, note.problem ? t.text : t.label)}>
            {note.text}
          </span>
        ) : null}
      </Field>

      <Field id={`${uid}-prov`} label={DECISION_COPY.provider} group>
        <div>
          <ToolPicker label={DECISION_COPY.provider} value={draft.provider || null} onChange={(next) => set({ provider: next ?? "" })} inBuild={inBuild} phone={phone} step="agent" runtime placeholder="Select a model or service" />
        </div>
      </Field>
      <Field id={`${uid}-model`} label={DECISION_COPY.modelName}>
        <input id={`${uid}-model`} type="text" value={draft.model} maxLength={80} placeholder={DECISION_COPY.modelPlaceholder} onChange={(e) => set({ model: e.target.value })} style={typedField(phone)} />
      </Field>
      <Segmented<"api" | "adapter">
        label="How it is called"
        size={segSize(phone)}
        fontSize={13}
        items={[{ value: "api", label: DECISION_COPY.direct }, { value: "adapter", label: DECISION_COPY.adapter }]}
        value={draft.via}
        onChange={(via) => set({ via })}
      />

      <Field id={`${uid}-called`} label={DECISION_COPY.calledFrom} group>
        {codeTiles.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {codeTiles.map((tile) => (
              <label key={tile.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 24 }}>
                <Checkbox
                  checked={draft.calledFrom.includes(tile.id)}
                  onChange={(e) => set({ calledFrom: e.target.checked ? [...draft.calledFrom, tile.id] : draft.calledFrom.filter((id) => id !== tile.id) })}
                />
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
      </Field>

      <Field id={`${uid}-reads`} label={DECISION_COPY.reads} group>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Segmented<"step" | "paste">
            label={DECISION_COPY.reads}
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
        </div>
      </Field>

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

      <Field id={`${uid}-ans`} label={DECISION_COPY.answer} hint="Optional" group>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
        </div>
      </Field>

      <Field id={`${uid}-install`} label={DECISION_COPY.install} hint="Optional, exactly as you would type it">
        <input id={`${uid}-install`} type="text" value={draft.install} maxLength={400} onChange={(e) => set({ install: e.target.value })} style={typedField(phone)} />
      </Field>
    </div>
  );
}
