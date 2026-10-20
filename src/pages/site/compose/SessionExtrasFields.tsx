/* CA-05 — the optional facts of a session in its Details: what it cost, how it was worked (P2), and, in later parts,
   what it started with and what it ran beside. Each is one Field with the word "Optional" beside its label, a
   well you type in or a choice row, and writes only when it is left. A session that never uses them shows only
   the fields, empty. PURE: values in, changes out. */

import { useState, type KeyboardEvent } from "react";

import { Checkbox } from "@/components/brand/Checkbox";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { COST_MAX, costField, type SessionExtras } from "@/lib/build/sessionFacts";

import { ChoiceRows } from "./ChoiceRows";
import { Field } from "./composeControls";
import { text, typedField } from "./refinedStyles";

export const EXTRAS_COPY = {
  optional: "Optional",
  cost: "What it cost",
  costHint: "3.40",
  costPound: "£",
  costDollar: "$",
  costBad: `Cost is a number from 0 to ${COST_MAX.toLocaleString("en-GB")}.`,
  showReaders: "Show readers",
  showReadersLine: "Readers see what it cost only when this is on.",
  how: "How did you work?",
  watching: "With me watching",
  background: "In the background",
} as const;

function ExtrasInput({ label, value, placeholder, max, phone, inputMode, onCommit }: { label: string; value: string; placeholder?: string; max: number; phone: boolean; inputMode?: "decimal"; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft.trim() !== value.trim()) onCommit(draft);
  };
  const { state, handlers } = useInteractive<HTMLInputElement>({ onBlur: commit });
  return (
    <input
      type="text"
      aria-label={label}
      inputMode={inputMode}
      value={draft}
      placeholder={placeholder}
      maxLength={max}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") setDraft(value);
      }}
      {...handlers}
      style={typedField(phone, ring(state.focusVisible))}
    />
  );
}

/** P2: What it cost, Show readers, and How did you work?. */
export function SessionFactsFields({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  const [wrong, setWrong] = useState(false);
  const symbol = extras.currency === "USD" ? EXTRAS_COPY.costDollar : EXTRAS_COPY.costPound;
  /** The whole entry again with one key changed; a key set to undefined goes. */
  const save = (change: Partial<SessionExtras>) => onChange({ ...extras, ...change });
  return (
    <>
      <Field id={`${id}-cost`} label={EXTRAS_COPY.cost} hint={EXTRAS_COPY.optional}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={text(13, 400, t.text2)}>{symbol}</span>
          <div style={{ width: 120 }}>
            <ExtrasInput
              key={`${id}:cost:${extras.cost ?? ""}`}
              label={EXTRAS_COPY.cost}
              value={extras.cost !== undefined ? extras.cost.toFixed(2) : ""}
              placeholder={EXTRAS_COPY.costHint}
              max={10}
              phone={phone}
              inputMode="decimal"
              onCommit={(value) => {
                const cost = costField(value);
                setWrong(cost === null);
                if (cost === null) return;
                // A typed cost is in pounds; one read from a result file stays in the file's dollars until it is retyped.
                save(cost === undefined ? { cost: undefined, currency: undefined } : { cost, currency: extras.currency ?? "GBP" });
              }}
            />
          </div>
        </div>
        {wrong ? <span style={text(12, 400, t.text2)}>{EXTRAS_COPY.costBad}</span> : null}
        <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 28, cursor: "pointer" }}>
          <Checkbox checked={extras.showCost === true} onChange={(event) => save({ showCost: event.target.checked ? true : undefined })} />
          <span style={text(13, 400, t.text)}>{EXTRAS_COPY.showReaders}</span>
        </label>
        <span style={text(12, 400, t.text2)}>{EXTRAS_COPY.showReadersLine}</span>
      </Field>
      <Field id={`${id}-how`} label={EXTRAS_COPY.how} hint={EXTRAS_COPY.optional} group>
        <ChoiceRows<"watching" | "background">
          label={EXTRAS_COPY.how}
          name={`how-${id}`}
          phone={phone}
          value={extras.background ? "background" : "watching"}
          onChange={(how) => save({ background: how === "background" ? true : undefined })}
          rows={[
            { value: "watching", label: EXTRAS_COPY.watching },
            { value: "background", label: EXTRAS_COPY.background },
          ]}
        />
      </Field>
    </>
  );
}
