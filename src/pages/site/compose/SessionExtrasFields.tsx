/* CA-05 — the optional facts of a session in its Details: what it cost, how it was worked (P2), and, in later parts,
   what it started with and what it ran beside. Each is one Field with the word "Optional" beside its label, a
   well you type in or a choice row, and writes only when it is left. A session that never uses them shows only
   the fields, empty. PURE: values in, changes out. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState, type KeyboardEvent } from "react";

import { Checkbox } from "@/components/brand/Checkbox";
import { Glyph } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { COST_MAX, costField, OWN_COPY_MAX, STARTED_WITH_MAX, type SessionExtras } from "@/lib/build/sessionFacts";
import { settingLines, worktreeOf } from "@/lib/build/startedWith";
import { DM_MONO } from "@/lib/theme/type";

import { ChoiceRows } from "./ChoiceRows";
import { Field } from "./composeControls";
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
