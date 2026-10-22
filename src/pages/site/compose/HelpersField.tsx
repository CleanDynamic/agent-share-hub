/* CA-13 P6, CA-15 P7 — "Supporting models", on an agent: in Details and in the Add agent dialog.

   The list of supporting models as chips with a Remove each, then "Add a supporting model": the job first, then the provider (ScaleDown,
   TypeSafe or typed), then that job's few fields in sentence case, and under all of them an optional "What it did on the
   run". The percentage a helper made smaller is never typed: it is worked out from the before and after. */

import { useId, useState } from "react";

import { Button } from "@/components/brand/Button";
import { Checkbox } from "@/components/brand/Checkbox";
import { Segmented } from "@/components/brand/Segmented";
import { HelperChips } from "@/components/build/RuntimeChips";
import { HELPER_JOB_LABEL, HELPER_JOBS, HELPERS_MAX, helpersRefusal, type Helper, type HelperDid, type HelperJob } from "@/lib/build/helpers";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
import { PickMenu } from "./PickMenu";
import { text, tnum, typedField } from "./refinedStyles";

const PROVIDERS = [{ value: "scaledown", label: "ScaleDown" }, { value: "typesafe", label: "TypeSafe" }, { value: "typed", label: "Another provider" }];

interface Draft {
  job: HelperJob;
  provider: string;
  typedProvider: string;
  model: string;
  at: string;
  keep: string;
  tools: string[];
  fields: string[];
  fieldInput: string;
  labels: string[];
  labelInput: string;
  stopLabel: string;
  stopAt: string;
  decision: string;
  did: boolean;
  times: string;
  before: string;
  after: string;
  unit: "characters" | "tokens";
  values: string;
  stoppedLabel: string;
  stoppedScore: string;
  source: "run" | "maker";
}

const blank = (): Draft => ({ job: "summarize", provider: "scaledown", typedProvider: "", model: "", at: "", keep: "", tools: [], fields: [], fieldInput: "", labels: [], labelInput: "", stopLabel: "", stopAt: "", decision: "", did: false, times: "", before: "", after: "", unit: "characters", values: "", stoppedLabel: "", stoppedScore: "", source: "maker" });

const pct = (value: string): number | undefined => {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : undefined;
};
const whole = (value: string): number | undefined => {
  const n = Number(value.replace(/,/g, ""));
  return value.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** The helper a draft makes, or the plain line saying what is missing. */
export function helperFromDraft(d: Draft): { helper: Helper } | { error: string } {
  const provider = d.provider === "typed" ? d.typedProvider.trim() : d.provider;
  const did: HelperDid = { source: d.source };
  if (d.did) {
    const times = whole(d.times);
    const before = whole(d.before);
    const after = whole(d.after);
    if (times !== undefined) did.times = times;
    if (before !== undefined && after !== undefined) {
      did.before = before;
      did.after = after;
      did.unit = d.unit;
    }
    const values = Object.fromEntries(d.values.split(/[\n,]+/).flatMap((pair) => {
      const [k, ...v] = pair.split("=");
      return k?.trim() && v.join("=").trim() ? [[k.trim(), v.join("=").trim()]] : [];
    }));
    if (Object.keys(values).length) did.values = values;
    const score = Number(d.stoppedScore);
    if (d.stoppedLabel.trim() && Number.isFinite(score) && d.stoppedScore.trim()) did.stopped = { label: d.stoppedLabel.trim(), score };
  }
  const helper: Helper = {
    provider,
    job: d.job,
    ...(d.job === "summarize" && d.model.trim() ? { model: d.model.trim() } : null),
    ...(d.job === "summarize" && (pct(d.at) !== undefined || pct(d.keep) !== undefined) ? { trigger: { ...(pct(d.at) !== undefined ? { at: pct(d.at) } : null), ...(pct(d.keep) !== undefined ? { keep: pct(d.keep) } : null) } } : null),
    ...(d.job === "compress" && d.tools.length ? { tools: d.tools } : null),
    ...(d.job === "extract" ? { fields: d.fields } : null),
    ...(d.job === "classify" ? { labels: d.labels, ...(pct(d.stopAt) !== undefined ? { stopAt: pct(d.stopAt) } : null) } : null),
    ...(d.job === "decide" && d.decision ? { questions: d.decision } : null),
    ...(Object.keys(did).length > 1 ? { did } : null),
  };
  const why = helpersRefusal([helper]);
  return why ? { error: `${why}.` } : { helper };
}

function ChipsInput({ label, items, input, onInput, onItems, phone }: { label: string; items: string[]; input: string; onInput: (v: string) => void; onItems: (v: string[]) => void; phone: boolean }) {
  const uid = useId();
  const add = () => {
    const said = input.trim();
    if (said && !items.includes(said)) onItems([...items, said]);
    onInput("");
  };
  return (
    <Field id={uid} label={label}>
      <div style={{ display: "flex", gap: 6 }}>
        <input id={uid} type="text" value={input} maxLength={60} onChange={(e) => onInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} style={typedField(phone, { flex: 1, minWidth: 0 })} />
        <Button variant="secondary" size={phone ? 44 : 32} onClick={add} disabled={!input.trim()}>Add</Button>
      </div>
      {items.length ? (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {items.map((item) => (
            <TextButton key={item} onClick={() => onItems(items.filter((x) => x !== item))} aria-label={`Remove ${item}`} style={text(12, 500, t.text2)}>
              {item} ×
            </TextButton>
          ))}
        </span>
      ) : null}
    </Field>
  );
}

export interface HelpersFieldProps {
  helpers: readonly Helper[];
  /** The agent's tools, by name, for "Results of". */
  toolNames: readonly string[];
  /** The Decision tiles, for "Decision". */
  decisions: readonly { id: string; label: string }[];
  phone: boolean;
  onChange: (helpers: Helper[]) => void;
  /** CA-15 P7: the Optional section's row names it already; draw no heading of its own. */
  bare?: boolean;
}

export const HELPERS_COPY = {
  title: "Supporting models",
  add: "Add a supporting model",
  addThis: "Add this supporting model",
  remove: (n: number) => `Remove supporting model ${n}`,
} as const;

export function HelpersField({ helpers, toolNames, decisions, phone, onChange, bare = false }: HelpersFieldProps) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Draft>(blank);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));
  const size = phone ? 44 : 32;
  const add = () => {
    const made = helperFromDraft(d);
    if ("error" in made) {
      setError(made.error);
      return;
    }
    onChange([...helpers, made.helper]);
    setD(blank());
    setError(null);
    setOpen(false);
  };
  return (
    <section aria-label={HELPERS_COPY.title} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {bare ? null : <h3 style={{ ...text(12.5, 500, t.text), margin: 0 }}>{HELPERS_COPY.title}</h3>}
      {helpers.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {helpers.map((helper, index) => (
            <div key={`${helper.job}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <HelperChips helpers={[helper]} decisionName={(id) => decisions.find((x) => x.id === id)?.label} style={{ flex: 1 }} />
              <TextButton target={phone} onClick={() => onChange(helpers.filter((_, i) => i !== index))} aria-label={HELPERS_COPY.remove(index + 1)}>Remove</TextButton>
            </div>
          ))}
        </div>
      ) : null}
      {open ? (
        <div role="group" aria-label={HELPERS_COPY.add} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: t.tile, border: `1px solid ${t.tileBorder}`, borderRadius: 6 }}>
          <Field id="helper-job" label="Job" group>
            <PickMenu label="Job of the helper" phone={phone} value={d.job} options={HELPER_JOBS.map((job) => ({ value: job, label: HELPER_JOB_LABEL[job] }))} onChange={(job) => set({ ...blank(), job, provider: job === "decide" ? "typesafe" : "scaledown" })} />
          </Field>
          <Field id="helper-provider" label="Provider" group>
            <Segmented<string> label="Provider of the helper" size={phone ? 50 : 32} fontSize={13} items={PROVIDERS} value={d.provider} onChange={(provider) => set({ provider })} />
          </Field>
          {d.provider === "typed" ? <input aria-label="Provider name" type="text" value={d.typedProvider} maxLength={40} onChange={(e) => set({ typedProvider: e.target.value })} style={typedField(phone)} /> : null}
          {d.job === "summarize" ? (
            <>
              <Field id="helper-model" label="Model" hint="As you gave it"><input id="helper-model" type="text" value={d.model} maxLength={80} placeholder="e.g. openai:gpt-6-sol" onChange={(e) => set({ model: e.target.value })} style={typedField(phone)} /></Field>
              <Field id="helper-at" label="When the history reaches" hint="Percent of the context"><input id="helper-at" type="text" inputMode="numeric" value={d.at} placeholder="e.g. 80" onChange={(e) => set({ at: e.target.value })} style={typedField(phone, { width: 96, ...tnum })} /></Field>
              <Field id="helper-keep" label="Keep the newest" hint="Percent"><input id="helper-keep" type="text" inputMode="numeric" value={d.keep} placeholder="e.g. 10" onChange={(e) => set({ keep: e.target.value })} style={typedField(phone, { width: 96, ...tnum })} /></Field>
            </>
          ) : null}
          {d.job === "compress" ? (
            <Field id="helper-tools" label="Results of" group>
              {toolNames.length ? (
                toolNames.map((name) => (
                  <label key={name} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 24 }}>
                    <Checkbox checked={d.tools.includes(name)} onChange={(e) => set({ tools: e.target.checked ? [...d.tools, name] : d.tools.filter((x) => x !== name) })} />
                    <span style={text(13, 400, t.text)}>{name}</span>
                  </label>
                ))
              ) : (
                <span style={text(12, 400, t.label)}>This agent has no tools yet. Leave it blank to compress every tool's results.</span>
              )}
            </Field>
          ) : null}
          {d.job === "extract" ? <ChipsInput label="Fields to pull out" items={d.fields} input={d.fieldInput} onInput={(fieldInput) => set({ fieldInput })} onItems={(fields) => set({ fields })} phone={phone} /> : null}
          {d.job === "classify" ? (
            <>
              <ChipsInput label="Labels" items={d.labels} input={d.labelInput} onInput={(labelInput) => set({ labelInput })} onItems={(labels) => set({ labels })} phone={phone} />
              <Field id="helper-stop" label="Stop the run when" hint="A label scores at or above, in percent">
                <input id="helper-stop" type="text" inputMode="numeric" value={d.stopAt} placeholder="e.g. 80" onChange={(e) => set({ stopAt: e.target.value })} style={typedField(phone, { width: 96, ...tnum })} />
              </Field>
            </>
          ) : null}
          {d.job === "decide" ? (
            <Field id="helper-decision" label="Decision" group>
              {decisions.length ? <PickMenu label="Decision it calls" phone={phone} placeholder="Select a decision" value={d.decision || null} options={decisions.map((x) => ({ value: x.id, label: x.label }))} onChange={(decision) => set({ decision })} /> : <span style={text(12, 400, t.label)}>Add a Decision tile first.</span>}
            </Field>
          ) : null}
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 24 }}>
            <Checkbox checked={d.did} onChange={(e) => set({ did: e.target.checked })} />
            <span style={text(13, 400, t.text)}>What it did on the run</span>
          </label>
          {d.did ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Field id="did-times" label="Times it ran"><input id="did-times" type="text" inputMode="numeric" value={d.times} onChange={(e) => set({ times: e.target.value })} style={typedField(phone, { width: 96, ...tnum })} /></Field>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Field id="did-before" label="Before"><input id="did-before" type="text" inputMode="numeric" value={d.before} onChange={(e) => set({ before: e.target.value })} style={typedField(phone, { width: 112, ...tnum })} /></Field>
                <Field id="did-after" label="After"><input id="did-after" type="text" inputMode="numeric" value={d.after} onChange={(e) => set({ after: e.target.value })} style={typedField(phone, { width: 112, ...tnum })} /></Field>
              </div>
              <Segmented<"characters" | "tokens"> label="Unit of before and after" size={phone ? 50 : 32} fontSize={13} items={[{ value: "characters", label: "Characters" }, { value: "tokens", label: "Tokens" }]} value={d.unit} onChange={(unit) => set({ unit })} />
              <Field id="did-values" label="Values it pulled out" hint="order_id = 4821, one per line"><textarea id="did-values" rows={2} value={d.values} onChange={(e) => set({ values: e.target.value })} style={typedField(phone, { height: "auto", padding: "6px 8px" })} /></Field>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Field id="did-stopped" label="Stopped on label"><input id="did-stopped" type="text" value={d.stoppedLabel} onChange={(e) => set({ stoppedLabel: e.target.value })} style={typedField(phone, { width: 140 })} /></Field>
                <Field id="did-score" label="Score, 0 to 1"><input id="did-score" type="text" inputMode="decimal" value={d.stoppedScore} onChange={(e) => set({ stoppedScore: e.target.value })} style={typedField(phone, { width: 96, ...tnum })} /></Field>
              </div>
              <Segmented<"run" | "maker"> label="Where the figures came from" size={phone ? 50 : 32} fontSize={13} items={[{ value: "run", label: "From the run" }, { value: "maker", label: "Maker's figure" }]} value={d.source} onChange={(source) => set({ source })} />
            </div>
          ) : null}
          {error ? <span role="alert" style={text(12.5, 400, t.text)}>{error}</span> : null}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size={size} onClick={add}>{HELPERS_COPY.addThis}</Button>
            <Button variant="secondary" size={size} onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="secondary" size={size} disabled={helpers.length >= HELPERS_MAX} onClick={() => setOpen(true)}>{HELPERS_COPY.add}</Button>
        </div>
      )}
    </section>
  );
}
