/* CA-13 P3 — "Runs when", in Details, next to "How did it run?".

   Only a runtime tile (agent, team, code, tool, decision) has it, and only when a decision sits above it. Three menus: the
   decision above, then its question, then the value: "team is billing", "tone is Annoyed or more", "escalation is yes".
   "Always" takes the condition off. A condition whose decision was removed says so, in words, and can be cleared. */

import { useId, useState } from "react";

import type { RunsWhen, RunsWhenIs } from "@/lib/build/decision";
import { t } from "@/lib/theme/tokens";

import { Field } from "./composeControls";
import { PickMenu } from "./PickMenu";
import { text } from "./refinedStyles";

const NONE = "__none__";
import type { RunsWhenView } from "./runtimeView";

export const RUNS_WHEN_COPY = { label: "Runs when", always: "Always", decision: "Decision", question: "Question", value: "Value", pickDecision: "Pick a decision", pickQuestion: "Pick a question", pickValue: "Pick a value", none: "Add a decision above this step first" } as const;

const sameIs = (a: RunsWhenIs, b: RunsWhenIs) => JSON.stringify(a) === JSON.stringify(b);

export function RunsWhenField({ view, phone, onChange }: { view: RunsWhenView; phone: boolean; onChange: (next: RunsWhen | null) => void }) {
  const uid = useId();
  const [decision, setDecision] = useState(view.current?.decision ?? "");
  const [question, setQuestion] = useState(view.current?.question ?? "");
  const decisions = view.decisions;
  const chosenDecision = decisions.find((d) => d.id === decision);
  const chosenQuestion = chosenDecision?.questions.find((q) => q.id === question);
  const valueIndex = chosenQuestion && view.current && view.current.decision === decision && view.current.question === question ? chosenQuestion.choices.findIndex((choice) => sameIs(choice.is, view.current!.is)) : -1;

  if (decisions.length === 0 && !view.current) {
    return <span style={text(12, 400, t.label)}>{RUNS_WHEN_COPY.label}: {RUNS_WHEN_COPY.none}</span>;
  }
  return (
    <Field id={`${uid}-rw`} label={RUNS_WHEN_COPY.label} hint={view.currentLabel ?? RUNS_WHEN_COPY.always} group>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <PickMenu
          label={RUNS_WHEN_COPY.decision}
          phone={phone}
          placeholder={RUNS_WHEN_COPY.pickDecision}
          value={decision || null}
          options={[
            { value: NONE, label: RUNS_WHEN_COPY.always },
            ...decisions.map((d) => ({ value: d.id, label: d.label })),
            ...(view.current && !chosenDecision && decision ? [{ value: decision, label: "A decision that was removed" }] : []),
          ]}
          onChange={(next) => {
            if (next === NONE) {
              setDecision("");
              setQuestion("");
              onChange(null);
              return;
            }
            setDecision(next);
            setQuestion("");
          }}
        />
        {chosenDecision ? (
          <PickMenu label={RUNS_WHEN_COPY.question} phone={phone} placeholder={RUNS_WHEN_COPY.pickQuestion} value={question || null} options={chosenDecision.questions.map((q) => ({ value: q.id, label: q.id }))} onChange={setQuestion} />
        ) : null}
        {chosenQuestion ? (
          <PickMenu
            label={RUNS_WHEN_COPY.value}
            phone={phone}
            placeholder={RUNS_WHEN_COPY.pickValue}
            value={valueIndex >= 0 ? String(valueIndex) : null}
            options={chosenQuestion.choices.map((choice, index) => ({ value: String(index), label: choice.label }))}
            onChange={(next) => {
              const choice = chosenQuestion.choices[Number(next)];
              if (choice) onChange({ decision, question, is: choice.is });
            }}
          />
        ) : null}
        {view.broken && view.current ? <span role="status" style={text(12, 400, t.label)}>{view.broken}</span> : null}
      </div>
    </Field>
  );
}
