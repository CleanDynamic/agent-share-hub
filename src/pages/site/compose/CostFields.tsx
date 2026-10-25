/* CA-13 P8 — two collapsed sections in Details: "Build cost" on a build tile and "Running cost" on a runtime
   tile. Different things, never added together (rule 3). Time is typed in seconds, tokens as whole numbers, money in pounds
   or dollars. A figure typed here is "Maker's figure"; one read from a run file is "From the run". */

import { useId, useState } from "react";

import { Button } from "@/components/brand/Button";
import { Segmented } from "@/components/brand/Segmented";
import { costRefusal, RUN_PERS, type CostFigures, type RunCost, type RunPer } from "@/lib/build/cost";
import type { Currency } from "@/lib/build/sessionFacts";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
import { text, tnum, typedField } from "./refinedStyles";

export const COST_COPY = { build: "Build cost", run: "Running cost", save: "Save", clear: "Clear" } as const;

const PER_LABEL: Record<RunPer, string> = { call: "Each call", run: "Each run", hour: "Per hour", day: "Per day" };

interface Draft {
  seconds: string;
  tokensIn: string;
  tokensOut: string;
  cost: string;
  currency: Currency;
  per: RunPer;
  source: "run" | "maker";
}

const draftOf = (value: CostFigures | RunCost | null | undefined): Draft => ({
  seconds: value?.ms !== undefined ? String(value.ms / 1000) : "",
  tokensIn: value?.tokensIn !== undefined ? String(value.tokensIn) : "",
  tokensOut: value?.tokensOut !== undefined ? String(value.tokensOut) : "",
  cost: value?.cost !== undefined ? String(value.cost) : "",
  currency: value?.currency ?? "GBP",
  per: value && "per" in value ? value.per : "call",
  source: value?.source ?? "maker",
});

const num = (text: string): number | undefined | null => {
  const said = text.trim().replace(/^[£$]/, "").replace(/,/g, "");
  if (!said) return undefined;
  const n = Number(said);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** The figures a draft makes, `null` when it holds none, or the plain line saying why not. */
export function figuresFromDraft(d: Draft, run: boolean): { value: CostFigures | RunCost | null } | { error: string } {
  const seconds = num(d.seconds);
  const tokensIn = num(d.tokensIn);
  const tokensOut = num(d.tokensOut);
  const cost = num(d.cost);
  if ([seconds, tokensIn, tokensOut, cost].some((n) => n === null)) return { error: "Numbers, 0 or more" };
  const figures: Partial<CostFigures> = {
    ...(seconds !== undefined ? { ms: Math.round((seconds as number) * 1000) } : null),
    ...(tokensIn !== undefined ? { tokensIn: Math.round(tokensIn as number) } : null),
    ...(tokensOut !== undefined ? { tokensOut: Math.round(tokensOut as number) } : null),
    ...(cost !== undefined ? { cost: cost as number, currency: d.currency } : null),
  };
  if (Object.keys(figures).filter((key) => key !== "currency").length === 0) return { value: null };
  const why = costRefusal(figures);
  if (why) return { error: why };
  return { value: { ...figures, source: d.source, ...(run ? { per: d.per } : null) } as CostFigures | RunCost };
}

export function CostFields({ kind, value, phone, onChange }: { kind: "build" | "run"; value: CostFigures | RunCost | null | undefined; phone: boolean; onChange: (next: CostFigures | RunCost | null) => void }) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(() => draftOf(value));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const label = kind === "build" ? COST_COPY.build : COST_COPY.run;
  const save = () => {
    const made = figuresFromDraft(d, kind === "run");
    if ("error" in made) {
      setError(made.error);
      return;
    }
    setError(null);
    onChange(made.value);
  };
  const size = phone ? 44 : 28;
  return (
    <section aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <TextButton target={phone} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls={`${uid}-body`} style={{ ...text(12.5, 500, t.text), alignSelf: "flex-start" }}>
        {label}
        {value ? " · given" : ""}
      </TextButton>
      {open ? (
        <div id={`${uid}-body`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kind === "run" ? <Segmented<RunPer> label="Per" size={phone ? 50 : 32} fontSize={13} items={RUN_PERS.map((per) => ({ value: per, label: PER_LABEL[per] }))} value={d.per} onChange={(per) => set({ per })} /> : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Field id={`${uid}-s`} label="Time" hint="Seconds"><input id={`${uid}-s`} type="text" inputMode="decimal" value={d.seconds} onChange={(e) => set({ seconds: e.target.value })} style={typedField(phone, { width: 96, ...tnum })} /></Field>
            <Field id={`${uid}-ti`} label="Tokens in"><input id={`${uid}-ti`} type="text" inputMode="numeric" value={d.tokensIn} onChange={(e) => set({ tokensIn: e.target.value })} style={typedField(phone, { width: 112, ...tnum })} /></Field>
            <Field id={`${uid}-to`} label="Tokens out"><input id={`${uid}-to`} type="text" inputMode="numeric" value={d.tokensOut} onChange={(e) => set({ tokensOut: e.target.value })} style={typedField(phone, { width: 112, ...tnum })} /></Field>
            <Field id={`${uid}-c`} label="Cost"><input id={`${uid}-c`} type="text" inputMode="decimal" value={d.cost} onChange={(e) => set({ cost: e.target.value })} style={typedField(phone, { width: 112, ...tnum })} /></Field>
          </div>
          <Segmented<Currency> label="Currency" size={phone ? 50 : 32} fontSize={13} items={[{ value: "GBP", label: "£" }, { value: "USD", label: "$" }]} value={d.currency} onChange={(currency) => set({ currency })} />
          <Segmented<"run" | "maker"> label="Where the figures came from" size={phone ? 50 : 32} fontSize={13} items={[{ value: "run", label: "From the run" }, { value: "maker", label: "Maker's figure" }]} value={d.source} onChange={(source) => set({ source })} />
          {error ? <span role="alert" style={text(12.5, 400, t.text)}>{error}</span> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" size={size} fontSize={12} onClick={save}>{COST_COPY.save}</Button>
            {value ? <Button variant="secondary" size={size} fontSize={12} onClick={() => { setD(draftOf(null)); onChange(null); }}>{COST_COPY.clear}</Button> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
