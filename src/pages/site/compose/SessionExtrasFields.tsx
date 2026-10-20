/* CA-05 — the optional facts of a session in its Details: what it cost, how it was worked (P2), and, in later parts,
   what it started with and what it ran beside. Each is one Field with the word "Optional" beside its label, a
   well you type in or a choice row, and writes only when it is left. A session that never uses them shows only
   the fields, empty. PURE: values in, changes out. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState, type KeyboardEvent } from "react";

import { X } from "lucide-react";

import { Checkbox } from "@/components/brand/Checkbox";
import { IconButton } from "@/components/brand/IconButton";
import { Glyph } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { COST_MAX, costField, OWN_COPY_MAX, STARTED_WITH_MAX, type SessionExtras } from "@/lib/build/sessionFacts";
import { settingLines, worktreeOf } from "@/lib/build/startedWith";
import { DM_MONO } from "@/lib/theme/type";

import { checkRunsOf, checkRunsRefusal, CHECK_RUNS_KEPT, type CheckRun } from "@/lib/build/graph";

import { ChoiceRows } from "./ChoiceRows";
import { Field, TextButton } from "./composeControls";
import { menuItem, menuSurface, text, typedArea, typedField } from "./refinedStyles";
import { FLOATING_Z } from "./ToolPicker";

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
  startedWith: "Started with",
  startedWithHint: "claude --model opus --permission-mode plan",
  together: "Ran at the same time as",
  togetherNone: "No other session",
  ownCopy: "Own copy of the code",
  ownCopyHint: "fix-totals",
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

/** P3: Started with: the command that opened the session in a code well, and the settings it names in plain words. */
export function StartedWithField({ id, extras, phone, onChange }: { id: string; extras: SessionExtras; phone: boolean; onChange: (change: SessionExtras) => void }) {
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
    <Field id={`${id}-started`} label={EXTRAS_COPY.startedWith} hint={EXTRAS_COPY.optional}>
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
    </Field>
  );
}

/** A session of the build the maker can name: its key and "Session 3 · Claude Code". */
export interface OtherSession {
  key: string;
  label: string;
}

/** P5: Ran at the same time as (a menu, more than one allowed), and Own copy of the code (a branch or folder name). */
export function TogetherFields({ id, extras, others, phone, onTogether, onChange }: { id: string; extras: SessionExtras; others: readonly OtherSession[]; phone: boolean; onTogether?: (keys: string[]) => void; onChange: (change: SessionExtras) => void }) {
  const [open, setOpen] = useState(false);
  const chosen = new Set(extras.parallelWith ?? []);
  const shown = others.filter((other) => chosen.has(other.key)).map((other) => other.label.split(" · ")[0]);
  return (
    <>
      {others.length > 0 && onTogether ? (
        <Field id={`${id}-together`} label={EXTRAS_COPY.together} hint={EXTRAS_COPY.optional} group>
          <Menu.Root open={open} onOpenChange={setOpen}>
            <Menu.Trigger asChild>
              <MenuButton aria-label={EXTRAS_COPY.together} label={shown.length > 0 ? "" : EXTRAS_COPY.togetherNone} value={shown.join(", ")} open={open} style={{ maxWidth: "100%", ...(phone ? { height: 44 } : null) }} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="start" sideOffset={4} collisionPadding={16} style={{ ...menuSurface(), zIndex: FLOATING_Z, maxHeight: "min(360px, var(--radix-dropdown-menu-content-available-height))", overflowY: "auto" }}>
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
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </Field>
      ) : null}
      <Field id={`${id}-copy`} label={EXTRAS_COPY.ownCopy} hint={EXTRAS_COPY.optional}>
        <ExtrasInput
          key={`${id}:copy:${extras.ownCopy ?? ""}`}
          label={EXTRAS_COPY.ownCopy}
          value={extras.ownCopy ?? ""}
          placeholder={EXTRAS_COPY.ownCopyHint}
          max={OWN_COPY_MAX}
          phone={phone}
          onCommit={(value) => onChange({ ...extras, ownCopy: value.trim() || undefined })}
        />
      </Field>
    </>
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
  more: (n: number) => `Showing the newest ${n}. A check keeps 20 runs at most.`,
  bad: "Each run needs a date written as 2026-10-12, and whole numbers with passed no more than the total.",
} as const;

/** One run as the three wells hold it. */
interface RunDraft {
  at: string;
  passed: string;
  total: string;
}

const draftOf = (run: CheckRun): RunDraft => ({ at: run.at, passed: String(run.passed), total: String(run.total) });

/** The runs the drafts spell, newest first, or null when any row is not a whole run. An empty row is left out. */
function runsFromDrafts(drafts: readonly RunDraft[]): CheckRun[] | null {
  const runs: CheckRun[] = [];
  for (const draft of drafts) {
    if (!draft.at.trim() && !draft.passed.trim() && !draft.total.trim()) continue;
    if (!/^\d+$/.test(draft.passed.trim()) || !/^\d+$/.test(draft.total.trim())) return null;
    const run = { at: draft.at.trim(), passed: Number(draft.passed), total: Number(draft.total) };
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
          <div key={index} data-testid="check-run" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
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
          </div>
        ))}
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
