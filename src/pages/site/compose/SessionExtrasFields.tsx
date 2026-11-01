/* CA-05 — the optional facts of a session in its Details: what it cost, how it was worked (P2), and, in later parts,
   what it started with and what it ran beside. Each is one Field with the word "Optional" beside its label, a
   well you type in or a choice row, and writes only when it is left. A session that never uses them shows only
   the fields, empty. PURE: values in, changes out. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { traceUrlOf } from "@/lib/build/trace";
import { useState, type KeyboardEvent } from "react";

import { X } from "lucide-react";

import { Checkbox } from "@/components/brand/Checkbox";
import { IconButton } from "@/components/brand/IconButton";
import { Glyph } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { COST_MAX, costField, countWords, figureOf, MODEL_ID_MAX, OWN_COPY_MAX, STARTED_WITH_MAX, type RunFacts, type SessionExtras } from "@/lib/build/sessionFacts";
import { EFFORT_LABEL, EFFORTS, type Effort } from "@/lib/build/tileExtras";
import { REVIEW_FILES_MAX, REVIEW_SCOPES, reviewLine, reviewRefusal, type ReviewScope } from "@/lib/build/sessionReview";
import { OUTPUT_KINDS, OUTPUT_LABEL, OUTPUTS_MAX, outputRow, outputsCountLine, outputsRefusal, type OutputKind, type OutputLink } from "@/lib/build/sessionOutputs";
import { ACCESS_LABEL, ACCESS_SYSTEMS, ENVIRONMENT_LABEL, ENVIRONMENTS, ISOLATION_LABEL, ISOLATIONS, accessLine, type AccessScope, type AccessSystem, type Environment, type Isolation } from "@/lib/build/sessionAccess";
import { settingLines, worktreeOf } from "@/lib/build/startedWith";
import { DM_MONO } from "@/lib/theme/type";

import { RUN_CHANGED_MAX, RUN_HISTORY_HELP, RUN_ID_MAX } from "@/lib/build/evalHarness";
import { checkRunsOf, checkRunsRefusal, CHECK_RUNS_KEPT, type CheckRun } from "@/lib/build/graph";

import { ChoiceRows } from "./ChoiceRows";
import { Field, TextButton } from "./composeControls";
import { menuItem, menuSurface, text, typedArea, typedField } from "./refinedStyles";
import { FLOATING_Z } from "./ToolPicker";
import { MenuContent } from "./ComposeMenu";

export const EXTRAS_COPY = {
  cost: "What it cost",
  costHint: "3.40",
  costPound: "£",
  costDollar: "$",
  costBad: `Cost: 0 to ${COST_MAX.toLocaleString("en-GB")}`,
  showReaders: "Show readers",
  showReadersLine: "Off: cost hidden from readers",
  how: "Method",
  watching: "Supervised",
  background: "Ran in the background",
  time: "How long it ran",
  timeHint: "Minutes",
  tokens: "Tokens used",
  trace: "Trace link",
  traceHint: "https only",
  startedWith: "Started with",
  startedWithHint: "claude --model opus --permission-mode plan",
  together: "Ran alongside",
  togetherNone: "No other session",
  ownCopy: "Own copy of the code",
  ownCopyHint: "fix-totals",
  /** SV-30 P1. */
  modelId: "Model ID",
  modelIdHint: "claude-opus-4-5-20251101",
  effort: "Reasoning effort",
  makersFigure: "Maker's figure",
  fromRun: "From the run",
} as const;

export function ExtrasInput({ label, value, placeholder, max, phone, inputMode, onCommit }: { label: string; value: string; placeholder?: string; max: number; phone: boolean; inputMode?: "decimal" | "numeric"; onCommit: (value: string) => void }) {
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

/* CA-28 P4: the session's optional facts are the fields of the window's Optional section, which draws each label and hint. What is
   left here is the control of each: a well you type in or a choice row, writing when it is left. Each says what it holds
   (`…Held`) so the section can count the fields that hold something. */

type Save = (change: Partial<SessionExtras>) => void;

/** What it cost, as the section counts it. */
export const costHeld = (extras: SessionExtras): string | null => (extras.cost !== undefined ? `${extras.currency === "USD" ? EXTRAS_COPY.costDollar : EXTRAS_COPY.costPound}${extras.cost.toFixed(2)}` : null);

/** What it cost, and Show readers. */
export function CostControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  const [wrong, setWrong] = useState(false);
  const symbol = extras.currency === "USD" ? EXTRAS_COPY.costDollar : EXTRAS_COPY.costPound;
  /** The whole entry again with one key changed; a key set to undefined goes. */
  const save: Save = (change) => onChange({ ...extras, ...change });
  return (
    <>
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
    </>
  );
}

/** How long it ran, in minutes. */
export const timeHeld = (extras: SessionExtras): string | null => (extras.ms !== undefined ? String(Math.round((extras.ms / 60_000) * 10) / 10) : null);
export function TimeControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <div style={{ width: 120 }}>
      <ExtrasInput
        key={`${id}:ms:${extras.ms ?? ""}`}
        label={EXTRAS_COPY.time}
        value={timeHeld(extras) ?? ""}
        placeholder="45"
        max={8}
        phone={phone}
        inputMode="decimal"
        onCommit={(value) => {
          const minutes = Number(value.trim());
          onChange({ ...extras, ms: value.trim() && Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes * 60_000) : undefined });
        }}
      />
    </div>
  );
}

/** Tokens used. */
export const tokensHeld = (extras: SessionExtras): string | null => (extras.tokens !== undefined ? String(extras.tokens) : null);
export function TokensControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <div style={{ width: 160 }}>
      <ExtrasInput
        key={`${id}:tokens:${extras.tokens ?? ""}`}
        label={EXTRAS_COPY.tokens}
        value={tokensHeld(extras) ?? ""}
        placeholder="1200000"
        max={14}
        phone={phone}
        inputMode="numeric"
        onCommit={(value) => {
          const n = Number(value.trim().replace(/,/g, ""));
          onChange({ ...extras, tokens: value.trim() && Number.isInteger(n) && n > 0 ? n : undefined });
        }}
      />
    </div>
  );
}

/** The trace link (https only). */
export function TraceControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <ExtrasInput
      key={`${id}:trace:${extras.traceUrl ?? ""}`}
      label={EXTRAS_COPY.trace}
      value={extras.traceUrl ?? ""}
      placeholder="https://smith.langchain.com/…"
      max={2000}
      phone={phone}
      onCommit={(value) => onChange({ ...extras, traceUrl: traceUrlOf(value) ?? undefined })}
    />
  );
}

/** Method: supervised or in the background. Held only when it is the background, the one that is stored. */
export const methodHeld = (extras: SessionExtras): string | null => (extras.background ? EXTRAS_COPY.background : null);
export function MethodControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <ChoiceRows<"watching" | "background">
      label={EXTRAS_COPY.how}
      name={`how-${id}`}
      phone={phone}
      value={extras.background ? "background" : "watching"}
      onChange={(how) => onChange({ ...extras, background: how === "background" ? true : undefined })}
      rows={[
        { value: "watching", label: EXTRAS_COPY.watching },
        { value: "background", label: EXTRAS_COPY.background },
      ]}
    />
  );
}

/** P3: Started with: the command that opened the session in a code well, and the settings it names in plain words. */
export function StartedWithControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  const command = extras.startedWith ?? "";
  const [draft, setDraft] = useState(command);
  const { state, handlers } = useInteractive<HTMLTextAreaElement>({
    onBlur: () => {
      if (draft.trim() === command.trim()) return;
      const said = draft.trim();
      // A command that names a worktree also names the session's own copy of the code, unless the maker said one.
      const copy = said && !extras.ownCopy ? worktreeOf(said) : null;
      onChange({ ...extras, startedWith: said || undefined, ...(copy ? { ownCopy: copy } : null) });
    },
  });
  const lines = settingLines(draft.trim());
  return (
    <>
      <textarea
        id={`${id}-started`}
        aria-label={EXTRAS_COPY.startedWith}
        rows={2}
        maxLength={STARTED_WITH_MAX}
        value={draft}
        placeholder={EXTRAS_COPY.startedWithHint}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        {...handlers}
        style={{ ...typedArea(phone, ring(state.focusVisible)), fontFamily: DM_MONO, fontSize: phone ? 16 : 12, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      />
      {lines.length > 0 ? (
        <ul data-testid="started-with-settings" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
          {lines.map((line) => (
            <li key={line} style={text(12.5, 400, t.text2)}>
              {line}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** A session of the build the maker can name: its key and "Session 3 · Claude Code". */
export interface OtherSession {
  key: string;
  label: string;
}

/** Own copy of the code (a branch or folder name). */
export function OwnCopyControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <ExtrasInput
      key={`${id}:copy:${extras.ownCopy ?? ""}`}
      label={EXTRAS_COPY.ownCopy}
      value={extras.ownCopy ?? ""}
      placeholder={EXTRAS_COPY.ownCopyHint}
      max={OWN_COPY_MAX}
      phone={phone}
      onCommit={(value) => onChange({ ...extras, ownCopy: value.trim() || undefined })}
    />
  );
}

/** P5: Ran alongside: the other sessions of the build, a menu that allows more than one. */
export const togetherHeld = (extras: SessionExtras, others: readonly OtherSession[]): string | null => {
  const chosen = new Set(extras.parallelWith ?? []);
  const shown = others.filter((other) => chosen.has(other.key)).map((other) => other.label.split(" · ")[0]);
  return shown.length > 0 ? shown.join(", ") : null;
};
export function TogetherControl({ extras, others, phone, onTogether }: { extras: SessionExtras; others: readonly OtherSession[]; phone: boolean; onTogether: (keys: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const chosen = new Set(extras.parallelWith ?? []);
  const shown = togetherHeld(extras, others) ?? "";
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger asChild>
        <MenuButton aria-label={EXTRAS_COPY.together} label={shown ? "" : EXTRAS_COPY.togetherNone} value={shown} open={open} style={{ maxWidth: "100%", ...(phone ? { height: 44 } : null) }} />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="start" sideOffset={4} style={{ ...menuSurface(), zIndex: FLOATING_Z, maxHeight: "min(360px, var(--radix-dropdown-menu-content-available-height))", overflowY: "auto" }}>
          {others.map((other) => (
            <Menu.CheckboxItem
              key={other.key}
              checked={chosen.has(other.key)}
              // The menu stays open, so more than one can be ticked.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(on) => onTogether(on ? [...chosen, other.key] : [...chosen].filter((key) => key !== other.key))}
              style={{ ...menuItem(true, phone), gap: 6 }}
            >
              <span style={{ width: 14, display: "inline-flex" }}>
                <Menu.ItemIndicator>
                  <Glyph name="check" size={14} />
                </Menu.ItemIndicator>
              </span>
              {other.label}
            </Menu.CheckboxItem>
          ))}
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

/* ── CA-05 P7: the runs of a check ── */

export const RUNS_FIELD_COPY = {
  title: "Runs",
  optional: "Optional",
  add: "Add a run",
  date: "Date",
  passed: "Passed",
  total: "Out of",
  of: "of",
  remove: (n: number) => `Remove run ${n}`,
  more: (n: number) => `Newest ${n} · 20 max`,
  bad: "Each run: date as 2026-10-12, whole numbers, passed no more than total",
} as const;

/** One run as the three wells hold it, and (SV-29 P4, under More) its name, what changed, its baseline, the comparison and its cost. */
interface RunDraft {
  at: string;
  passed: string;
  total: string;
  id?: string;
  changed?: string;
  vs?: string;
  fixed?: string;
  regressions?: string;
  nowFlaky?: string;
  stillFailing?: string;
  cost?: string;
  costSource?: "run" | "maker" | "original";
  minutes?: string;
  more?: boolean;
}

const draftOf = (run: CheckRun): RunDraft => ({
  at: run.at,
  passed: String(run.passed),
  total: String(run.total),
  id: run.id ?? "",
  changed: run.changed ?? "",
  vs: run.vs ?? "",
  fixed: run.compare ? String(run.compare.fixed) : "",
  regressions: run.compare ? String(run.compare.regressions) : "",
  nowFlaky: run.compare ? String(run.compare.now_flaky) : "",
  stillFailing: run.compare ? String(run.compare.still_failing) : "",
  cost: run.cost ? String(run.cost.cost) : "",
  costSource: run.cost?.source ?? "maker",
  minutes: run.minutes === undefined ? "" : String(run.minutes),
  more: Boolean(run.id || run.changed || run.vs || run.cost || run.minutes !== undefined),
});

/** The runs the drafts spell, newest first, or null when any row is not a whole run. An empty row is left out. */
function runsFromDrafts(drafts: readonly RunDraft[]): CheckRun[] | null {
  const runs: CheckRun[] = [];
  for (const draft of drafts) {
    if (!draft.at.trim() && !draft.passed.trim() && !draft.total.trim()) continue;
    if (!/^\d+$/.test(draft.passed.trim()) || !/^\d+$/.test(draft.total.trim())) return null;
    const count = (text: string | undefined): number => Number((text ?? "").trim() || 0);
    const run: CheckRun = {
      at: draft.at.trim(),
      passed: Number(draft.passed),
      total: Number(draft.total),
      ...(draft.id?.trim() ? { id: draft.id.trim() } : null),
      ...(draft.changed?.trim() ? { changed: draft.changed.trim() } : null),
      ...(draft.vs?.trim() ? { vs: draft.vs.trim() } : null),
      ...(draft.vs?.trim() && (draft.fixed || draft.regressions || draft.nowFlaky || draft.stillFailing) ? { compare: { fixed: count(draft.fixed), regressions: count(draft.regressions), now_flaky: count(draft.nowFlaky), still_failing: count(draft.stillFailing) } } : null),
      ...(draft.cost?.trim() ? { cost: { cost: Number(draft.cost), currency: "USD" as const, source: draft.costSource ?? "maker" } } : null),
      ...(draft.minutes?.trim() ? { minutes: Number(draft.minutes) } : null),
    };
    if (checkRunsRefusal([run])) return null;
    runs.push(run);
  }
  return checkRunsOf(runs);
}

/** P7: Runs, Optional, on a Check: rows of date and "{passed} of {total}", newest first, up to 20. A row is saved when it is whole. */
export function CheckRunsField({ id, runs, phone, onChange }: { id: string; runs: readonly CheckRun[]; phone: boolean; onChange: (runs: CheckRun[]) => void }) {
  const [drafts, setDrafts] = useState<RunDraft[]>(() => runs.map(draftOf));
  const [wrong, setWrong] = useState(false);
  const commit = (next: RunDraft[]) => {
    const whole = runsFromDrafts(next);
    setWrong(whole === null);
    if (whole === null) return;
    // Only a change in the runs is written; a half-typed new row waits.
    if (JSON.stringify(whole) !== JSON.stringify(runs)) onChange(whole);
  };
  const edit = (index: number, change: Partial<RunDraft>) => setDrafts((rows) => rows.map((row, at) => (at === index ? { ...row, ...change } : row)));
  const full = drafts.length >= CHECK_RUNS_KEPT;
  return (
    <Field id={`${id}-runs`} label={RUNS_FIELD_COPY.title} hint={RUNS_FIELD_COPY.optional} group>
      <div data-testid="check-runs" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {drafts.map((row, index) => (
          <div key={index} data-testid="check-run" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
            <div style={{ width: 112, flexShrink: 0 }}>
              <ExtrasInput label={`${RUNS_FIELD_COPY.date} of run ${index + 1}`} value={row.at} placeholder="2026-10-12" max={10} phone={phone} onCommit={(at) => { const next = drafts.map((d, i) => (i === index ? { ...d, at } : d)); setDrafts(next); commit(next); }} />
            </div>
            <div style={{ width: 56, flexShrink: 0 }}>
              <ExtrasInput label={`${RUNS_FIELD_COPY.passed} in run ${index + 1}`} value={row.passed} max={5} phone={phone} inputMode="numeric" onCommit={(passed) => { const next = drafts.map((d, i) => (i === index ? { ...d, passed } : d)); setDrafts(next); commit(next); }} />
            </div>
            <span style={text(12.5, 400, t.text2)}>{RUNS_FIELD_COPY.of}</span>
            <div style={{ width: 56, flexShrink: 0 }}>
              <ExtrasInput label={`${RUNS_FIELD_COPY.total} in run ${index + 1}`} value={row.total} max={5} phone={phone} inputMode="numeric" onCommit={(total) => { const next = drafts.map((d, i) => (i === index ? { ...d, total } : d)); setDrafts(next); commit(next); }} />
            </div>
            <TextButton target={phone} style={text(12, 500, t.text2)} onClick={() => edit(index, { more: !row.more })}>
              {row.more ? "Fewer" : "More"}
            </TextButton>
            <IconButton
              icon={X}
              glyph="x"
              boxed={false}
              label={RUNS_FIELD_COPY.remove(index + 1)}
              size={26}
              onClick={() => {
                const next = drafts.filter((_, at) => at !== index);
                setDrafts(next);
                commit(next);
              }}
            />
            {row.more ? (
              <div data-testid="check-run-more" style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <ExtrasInput label={`Run ID of run ${index + 1}`} value={row.id ?? ""} placeholder="main-prompt-v3" max={RUN_ID_MAX} phone={phone} onCommit={(value) => { const next = drafts.map((d, i) => (i === index ? { ...d, id: value } : d)); setDrafts(next); commit(next); }} />
                <ExtrasInput label={`What run ${index + 1} changed`} value={row.changed ?? ""} placeholder="Answer only from the docs" max={RUN_CHANGED_MAX} phone={phone} onCommit={(value) => { const next = drafts.map((d, i) => (i === index ? { ...d, changed: value } : d)); setDrafts(next); commit(next); }} />
                <ExtrasInput label={`Baseline run of run ${index + 1}`} value={row.vs ?? ""} placeholder="main-prompt-v2" max={RUN_ID_MAX} phone={phone} onCommit={(value) => { const next = drafts.map((d, i) => (i === index ? { ...d, vs: value } : d)); setDrafts(next); commit(next); }} />
                {row.vs?.trim() ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(["fixed", "regressions", "nowFlaky", "stillFailing"] as const).map((key) => (
                      <div key={key} style={{ width: 96 }}>
                        <ExtrasInput label={`${{ fixed: "Fixed", regressions: "Regressions", nowFlaky: "Now flaky", stillFailing: "Still failing" }[key]} in run ${index + 1}`} value={row[key] ?? ""} placeholder={{ fixed: "Fixed", regressions: "Regress.", nowFlaky: "Flaky", stillFailing: "Failing" }[key]} max={4} phone={phone} inputMode="numeric" onCommit={(value) => { const next = drafts.map((d, i) => (i === index ? { ...d, [key]: value } : d)); setDrafts(next); commit(next); }} />
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ width: 120 }}>
                    <ExtrasInput label={`Cost of run ${index + 1}, dollars`} value={row.cost ?? ""} placeholder="1.40" max={8} phone={phone} inputMode="decimal" onCommit={(value) => { const next = drafts.map((d, i) => (i === index ? { ...d, cost: value } : d)); setDrafts(next); commit(next); }} />
                  </div>
                  <div style={{ width: 96 }}>
                    <ExtrasInput label={`Minutes of run ${index + 1}`} value={row.minutes ?? ""} placeholder="8" max={6} phone={phone} inputMode="decimal" onCommit={(value) => { const next = drafts.map((d, i) => (i === index ? { ...d, minutes: value } : d)); setDrafts(next); commit(next); }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {drafts.some((row) => row.more) ? <span data-testid="run-history-help" style={text(12, 400, t.label)}>{RUN_HISTORY_HELP}</span> : null}
        {wrong ? <span style={text(12, 400, t.text2)}>{RUNS_FIELD_COPY.bad}</span> : null}
        {full ? (
          <span style={text(12, 400, t.text2)}>{RUNS_FIELD_COPY.more(CHECK_RUNS_KEPT)}</span>
        ) : (
          <span>
            <TextButton target={phone} style={text(12.5, 500, t.text2)} onClick={() => setDrafts((rows) => [{ at: "", passed: "", total: "" }, ...rows])}>
              {RUNS_FIELD_COPY.add}
            </TextButton>
          </span>
        )}
      </div>
    </Field>
  );
}

/* ── SV-30 P1: the exact model ID and the reasoning effort ── */

/** The model ID, as the section counts it. */
export const modelIdHeld = (extras: SessionExtras): string | null => extras.model_id ?? null;
export function ModelIdControl({ id, extras, phone, fromRun, onChange }: { id: string; extras: SessionExtras; phone: boolean; fromRun?: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <>
      <ExtrasInput key={`${id}:model_id:${extras.model_id ?? ""}`} label={EXTRAS_COPY.modelId} value={extras.model_id ?? ""} placeholder={EXTRAS_COPY.modelIdHint} max={MODEL_ID_MAX} phone={phone} onCommit={(value) => onChange({ ...extras, model_id: value.trim() || undefined })} />
      {extras.model_id ? <span style={text(12, 400, t.label)}>{fromRun ? EXTRAS_COPY.fromRun : EXTRAS_COPY.makersFigure}</span> : null}
    </>
  );
}

/** Reasoning effort, as the section counts it. */
export const effortHeld = (extras: SessionExtras): string | null => (extras.effort ? EFFORT_LABEL[extras.effort] : null);
export function EffortControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <ChoiceRows<Effort>
      label={EXTRAS_COPY.effort}
      name={`effort-${id}`}
      phone={phone}
      value={extras.effort ?? "default"}
      onChange={(effort) => onChange({ ...extras, effort: effort === "default" ? undefined : effort })}
      rows={EFFORTS.map((value) => ({ value, label: EFFORT_LABEL[value] }))}
    />
  );
}

/* ── SV-30 P4: where it ran, how it was kept apart, and what it could reach ── */

export const environmentHeld = (extras: SessionExtras): string | null => (extras.environment ? ENVIRONMENT_LABEL[extras.environment] : null);
export function EnvironmentControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  return (
    <>
      <ChoiceRows<Environment | "unsaid">
        label="Where it ran"
        name={`environment-${id}`}
        phone={phone}
        value={extras.environment ?? "unsaid"}
        onChange={(environment) => onChange({ ...extras, environment: environment === "unsaid" ? undefined : environment })}
        rows={[{ value: "unsaid", label: "Not said" }, ...ENVIRONMENTS.map((value) => ({ value, label: ENVIRONMENT_LABEL[value] }))]}
      />
      <ChoiceRows<Isolation | "unsaid">
        label="Isolation"
        name={`isolation-${id}`}
        phone={phone}
        value={extras.isolation ?? "unsaid"}
        onChange={(isolation) => onChange({ ...extras, isolation: isolation === "unsaid" ? undefined : isolation })}
        rows={[{ value: "unsaid", label: "Not said" }, ...ISOLATIONS.map((value) => ({ value, label: ISOLATION_LABEL[value] }))]}
      />
      <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 28, cursor: "pointer" }}>
        <Checkbox checked={extras.can_install === true} onChange={(event) => onChange({ ...extras, can_install: event.target.checked ? true : undefined })} />
        <span style={text(13, 400, t.text)}>Could install packages</span>
      </label>
    </>
  );
}

export const accessHeld = (extras: SessionExtras): string | null => accessLine(extras.access)?.replace(/^Access: /, "") ?? null;
/** Each system with Read and Write; a system from the session's setup is proposed (marked, unticked) until the maker ticks it. */
export function AccessControl({ id, extras, proposed = [], phone, onChange }: { id: string; extras: SessionExtras; proposed?: readonly AccessSystem[]; phone: boolean; onChange: (change: SessionExtras) => void }) {
  const held = new Map((extras.access ?? []).map((entry) => [entry.system, entry.scope] as const));
  const set = (system: AccessSystem, scope: AccessScope | null) => {
    const next = ACCESS_SYSTEMS.flatMap((candidate) => {
      const was = candidate === system ? scope : (held.get(candidate) ?? null);
      return was ? [{ system: candidate, scope: was }] : [];
    });
    onChange({ ...extras, access: next.length > 0 ? next : undefined });
  };
  return (
    <div role="group" aria-label="Access" data-testid="access-control" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {ACCESS_SYSTEMS.map((system) => {
        const scope = held.get(system) ?? null;
        return (
          <div key={system} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: phone ? 44 : 28, flexWrap: "wrap" }}>
            <span style={{ ...text(13, 400, t.text), minWidth: 120 }}>
              {ACCESS_LABEL[system]}
              {proposed.includes(system) && !scope ? <span style={text(12, 400, t.label)}> · in this session&apos;s setup</span> : null}
            </span>
            {ACCESS_SCOPES_UI.map((candidate) => (
              <label key={candidate} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <Checkbox aria-label={`${ACCESS_LABEL[system]}: ${candidate}`} checked={scope === candidate} onChange={(event) => set(system, event.target.checked ? candidate : null)} />
                <span style={text(13, 400, t.text2)}>{candidate === "read" ? "Read" : "Write"}</span>
              </label>
            ))}
          </div>
        );
      })}
    </div>
  );
}
const ACCESS_SCOPES_UI: readonly AccessScope[] = ["read", "write"];

/* ── SV-30 P6: how the session was driven ── */

/** How many turns, and how many compactions; a figure read from the run is said so, the maker's own is the maker's. */
export const messagesHeld = (extras: SessionExtras, run?: RunFacts): string | null => {
  const figure = figureOf(extras.messages, run?.messages);
  return figure ? countWords.messages(figure.value) : null;
};
export const compactionsHeld = (extras: SessionExtras, run?: RunFacts): string | null => {
  const figure = figureOf(extras.compactions, run?.compactions);
  return figure ? countWords.compactions(figure.value) : null;
};
function CountControl({ id, field, label, extras, run, phone, onChange }: { id: string; field: "messages" | "compactions"; label: string; extras: SessionExtras; run?: RunFacts; phone: boolean; onChange: (change: SessionExtras) => void }) {
  const figure = figureOf(extras[field], run?.[field]);
  return (
    <>
      <div style={{ width: 120 }}>
        <ExtrasInput
          key={`${id}:${field}:${extras[field] ?? ""}`}
          label={label}
          value={figure ? String(figure.value) : ""}
          placeholder={field === "messages" ? "3714" : "2"}
          max={9}
          phone={phone}
          inputMode="numeric"
          onCommit={(value) => {
            const n = Number(value.trim().replace(/,/g, ""));
            onChange({ ...extras, [field]: value.trim() && Number.isInteger(n) && n > 0 ? n : undefined });
          }}
        />
      </div>
      {figure ? <span style={text(12, 400, t.label)}>{figure.from === "run" ? EXTRAS_COPY.fromRun : EXTRAS_COPY.makersFigure}</span> : null}
    </>
  );
}
export const MessagesControl = (props: Omit<Parameters<typeof CountControl>[0], "field" | "label">) => <CountControl {...props} field="messages" label="Messages" />;
export const CompactionsControl = (props: Omit<Parameters<typeof CountControl>[0], "field" | "label">) => <CountControl {...props} field="compactions" label="Compactions" />;

/* ── SV-30 P7: what the session produced ── */

export const outputsHeld = (extras: SessionExtras): string | null => outputsCountLine(extras.outputs ?? []);
/**
 * Links entered by hand: a kind, then a repository and SHA for a commit or an https address for the rest. The list is kept as typed;
 * a row that is not whole waits and says why. Show readers is off until the maker ticks it (a private repository stays private).
 */
export function OutputsControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  const [rows, setRows] = useState<{ kind: OutputKind; a: string; b: string }[]>(() => (extras.outputs ?? []).map((entry) => (entry.kind === "commit" ? { kind: entry.kind, a: entry.repo, b: entry.sha } : { kind: entry.kind, a: entry.url, b: "" })));
  const [wrong, setWrong] = useState<string | null>(null);
  const toLinks = (list: typeof rows): OutputLink[] => list.map((row) => (row.kind === "commit" ? { kind: "commit", repo: row.a.trim(), sha: row.b.trim() } : { kind: row.kind, url: row.a.trim() }));
  const commit = (next: typeof rows) => {
    setRows(next);
    const links = toLinks(next.filter((row) => row.a.trim() || row.b.trim()));
    const why = outputsRefusal(links);
    setWrong(why);
    if (why) return;
    onChange({ ...extras, outputs: links.length > 0 ? links : undefined, ...(links.length === 0 ? { showOutputs: undefined } : null) });
  };
  return (
    <div data-testid="outputs-control" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((row, index) => (
        <div key={index} data-testid="output-row" style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, minWidth: 0 }}>
          <select
            aria-label={`Kind of output ${index + 1}`}
            value={row.kind}
            onChange={(event) => commit(rows.map((other, at) => (at === index ? { kind: event.target.value as OutputKind, a: "", b: "" } : other)))}
            style={{ ...typedField(phone, ring(false)), width: 150 }}
          >
            {OUTPUT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {OUTPUT_LABEL[kind].one.replace(/^./, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
            <ExtrasInput key={`${id}:o${index}a:${row.a}`} label={row.kind === "commit" ? `Repository of output ${index + 1}` : `Link of output ${index + 1}`} value={row.a} placeholder={row.kind === "commit" ? "https://github.com/acme/app" : "https://…"} max={2000} phone={phone} onCommit={(a) => commit(rows.map((other, at) => (at === index ? { ...other, a } : other)))} />
          </div>
          {row.kind === "commit" ? (
            <div style={{ width: 140 }}>
              <ExtrasInput key={`${id}:o${index}b:${row.b}`} label={`SHA of output ${index + 1}`} value={row.b} placeholder="a1b2c3d" max={40} phone={phone} onCommit={(b) => commit(rows.map((other, at) => (at === index ? { ...other, b } : other)))} />
            </div>
          ) : null}
          <IconButton icon={X} glyph="x" boxed={false} label={`Remove output ${index + 1}`} size={26} onClick={() => commit(rows.filter((_, at) => at !== index))} />
        </div>
      ))}
      {wrong ? <span style={text(12, 400, t.text2)}>{wrong}</span> : null}
      {rows.length < OUTPUTS_MAX ? (
        <span>
          <TextButton target={phone} style={text(12.5, 500, t.text2)} onClick={() => setRows((now) => [...now, { kind: "commit", a: "", b: "" }])}>
            Add a link
          </TextButton>
        </span>
      ) : (
        <span style={text(12, 400, t.text2)}>{OUTPUTS_MAX} max</span>
      )}
      {(extras.outputs ?? []).length > 0 ? (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, minHeight: phone ? 44 : 28, cursor: "pointer" }}>
            <Checkbox checked={extras.showOutputs === true} onChange={(event) => onChange({ ...extras, showOutputs: event.target.checked ? true : undefined })} />
            <span style={text(13, 400, t.text)}>{EXTRAS_COPY.showReaders}</span>
          </label>
          <span style={text(12, 400, t.text2)}>Off: links hidden from readers. {extras.from_original ? "These came with the original." : ""}</span>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {(extras.outputs ?? []).map((entry, at) => (
              <li key={at} style={text(12, 400, t.label)}>
                {outputRow(entry).label}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/* ── SV-30 P8: how much a human reviewed ── */

const REVIEW_CHOICE: Record<ReviewScope | "unsaid", string> = { unsaid: "Not said", none: "None", high_blast_radius: "High-blast-radius files only", all: "All changes" };
export const reviewHeld = (extras: SessionExtras): string | null => (extras.review ? reviewLine(extras.review).replace(/^Human review: /, "") : null);
/** None, the central files and migrations only (up to 10 paths, one per line), or all. A fact the maker states about their own work. */
export function ReviewControl({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
  const [files, setFiles] = useState((extras.review?.files ?? []).join("\n"));
  const [wrong, setWrong] = useState<string | null>(null);
  const save = (scope: ReviewScope | "unsaid", text: string) => {
    if (scope === "unsaid") return onChange({ ...extras, review: undefined });
    const list = scope === "high_blast_radius" ? text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
    const review = { scope, ...(list.length > 0 ? { files: list } : null) };
    const why = reviewRefusal(review);
    setWrong(why);
    if (!why) onChange({ ...extras, review });
  };
  return (
    <>
      <ChoiceRows<ReviewScope | "unsaid">
        label="Human review"
        name={`review-${id}`}
        phone={phone}
        value={extras.review?.scope ?? "unsaid"}
        onChange={(scope) => save(scope, files)}
        rows={(["unsaid", ...REVIEW_SCOPES] as const).map((value) => ({ value, label: REVIEW_CHOICE[value] }))}
      />
      {extras.review?.scope === "high_blast_radius" ? (
        <textarea
          aria-label="Files reviewed"
          rows={3}
          value={files}
          placeholder={`One path per line, ${REVIEW_FILES_MAX} at most`}
          spellCheck={false}
          onChange={(event) => setFiles(event.target.value)}
          onBlur={() => save("high_blast_radius", files)}
          style={{ ...typedArea(phone, ring(false)), fontFamily: DM_MONO, fontSize: phone ? 16 : 12 }}
        />
      ) : null}
      {wrong ? <span style={text(12, 400, t.text2)}>{wrong}</span> : null}
      {extras.from_original && extras.review ? <span style={text(12, 400, t.label)}>The original&apos;s</span> : null}
    </>
  );
}
