/* CA-05 P8 — How it was run, and Where, under a model: for a model run on the maker's own computer (Ollama, LM Studio)
   or one whose weights are open. Two Fields marked Optional, each a menu; Other takes a name up to 20 characters.
   PURE: the run in, the run out. Nothing is shown for a model that is not either. */

import { useState } from "react";

import { type ModelRun, PRECISION_OTHER_MAX, PRECISIONS, RUN_COPY } from "@/lib/build/modelRun";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";

import { Field } from "./composeControls";
import { PickMenu } from "./PickMenu";
import { typedField } from "./refinedStyles";

type HowChoice = (typeof PRECISIONS)[number] | "other" | "none";
type WhereChoice = "computer" | "server" | "none";

const HOW_OPTIONS = [
  { value: "full", label: RUN_COPY.full },
  { value: "8-bit", label: RUN_COPY.eight },
  { value: "4-bit", label: RUN_COPY.four },
  { value: "other", label: RUN_COPY.other },
  { value: "none", label: RUN_COPY.none },
] as const;

const WHERE_OPTIONS = [
  { value: "computer", label: RUN_COPY.computer },
  { value: "server", label: RUN_COPY.server },
  { value: "none", label: RUN_COPY.none },
] as const;

function OtherName({ value, phone, onCommit }: { value: string; phone: boolean; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const { state, handlers } = useInteractive<HTMLInputElement>({ onBlur: () => draft.trim() !== value.trim() && onCommit(draft.trim()) });
  return (
    <input
      type="text"
      aria-label={`${RUN_COPY.how}: ${RUN_COPY.other}`}
      maxLength={PRECISION_OTHER_MAX}
      value={draft}
      placeholder={RUN_COPY.otherHint}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          if (draft.trim() !== value.trim()) onCommit(draft.trim());
        }
      }}
      {...handlers}
      style={typedField(phone, ring(state.focusVisible))}
    />
  );
}

export function ModelRunFields({ id, run, phone, onChange }: { id: string; run: ModelRun | null; phone: boolean; onChange: (run: ModelRun | null) => void }) {
  const precision = run?.precision;
  const isOther = precision !== undefined && !(PRECISIONS as readonly string[]).includes(precision);
  const [asked, setAsked] = useState(false);
  const how: HowChoice = isOther || asked ? "other" : ((precision as HowChoice | undefined) ?? "none");
  const where: WhereChoice = run?.where ?? "none";
  const save = (change: Partial<ModelRun>) => {
    const next: ModelRun = { ...run, ...change };
    if (next.precision === undefined) delete next.precision;
    if (next.where === undefined) delete next.where;
    onChange(next.precision || next.where ? next : null);
  };
  return (
    <>
      <Field id={`${id}-how-run`} label={RUN_COPY.how} hint={RUN_COPY.optional} group>
        <PickMenu<HowChoice>
          label={RUN_COPY.how}
          options={HOW_OPTIONS}
          value={how}
          placeholder={RUN_COPY.none}
          phone={phone}
          onChange={(choice) => {
            setAsked(choice === "other");
            if (choice === "other") return;
            save({ precision: choice === "none" ? undefined : choice });
          }}
        />
        {how === "other" ? <OtherName key={`${id}:${precision ?? ""}`} value={isOther ? (precision ?? "") : ""} phone={phone} onCommit={(value) => save({ precision: value || undefined })} /> : null}
      </Field>
      <Field id={`${id}-where-run`} label={RUN_COPY.where} hint={RUN_COPY.optional} group>
        <PickMenu<WhereChoice> label={RUN_COPY.where} options={WHERE_OPTIONS} value={where} placeholder={RUN_COPY.none} phone={phone} onChange={(choice) => save({ where: choice === "none" ? undefined : choice })} />
      </Field>
    </>
  );
}
