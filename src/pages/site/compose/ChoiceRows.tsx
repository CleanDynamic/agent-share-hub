/* CA-03 P2 — choosing one of four or more options, or options with a second line: a list of choice rows.

   The Components table's one drawing: each row 32 high (44 on a phone), radius 6, its label 13 `--text`, an optional
   second line 12 `--text2`. The chosen row is one step up in fill (`--selected-fill`) with the control's border, as
   the table words it: not `SELECTED`'s brighter edge and ring, which drew a light outline round the row in Dusk. A
   14px ring drawn from tokens sits at the left: a `--line` ring, and a `--text` dot in it when chosen. The real
   `<input type="radio">` stays in the row for the keyboard and screen readers, visually hidden; the focus ring is the
   row's, from `ring()`, on keyboard focus only. */

import type { ReactNode } from "react";

import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { text } from "./refinedStyles";

export interface ChoiceRow<V extends string> {
  value: V;
  label: string;
  /** A second line under the label. */
  line?: ReactNode;
}

export interface ChoiceRowsProps<V extends string> {
  /** The group's accessible name. */
  label: string;
  /** The radios' shared name. */
  name: string;
  rows: readonly ChoiceRow<V>[];
  value: V;
  onChange: (value: V) => void;
  phone: boolean;
}

/** The 14px ring at a row's left: `--line`, with a `--text` dot when chosen. */
export function ChoiceRing({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 14, height: 14, boxSizing: "border-box", borderRadius: "50%", border: `1px solid ${t.line}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      {on ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.text }} /> : null}
    </span>
  );
}

/** The chosen row: one step up in fill, the control's border. */
export const CHOSEN = { background: t.selectedFill, borderColor: t.controlBorder } as const;

function Row<V extends string>({ row, name, chosen, phone, onChange }: { row: ChoiceRow<V>; name: string; chosen: boolean; phone: boolean; onChange: (value: V) => void }) {
  const { state, handlers } = useInteractive<HTMLInputElement>();
  return (
    <label
      data-testid="choice-row"
      data-chosen={chosen ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: row.line ? "flex-start" : "center",
        gap: 8,
        minHeight: phone ? 44 : 32,
        padding: row.line ? "6px 8px" : "0 8px",
        boxSizing: "border-box",
        borderRadius: 6,
        border: "1px solid transparent",
        ...(chosen ? CHOSEN : null),
        cursor: "pointer",
        position: "relative",
        ...ring(state.focusVisible),
      }}
    >
      <input
        type="radio"
        name={name}
        value={row.value}
        checked={chosen}
        onChange={() => onChange(row.value)}
        onFocus={handlers.onFocus}
        onBlur={handlers.onBlur}
        style={VISUALLY_HIDDEN}
      />
      <span style={{ display: "inline-flex", paddingTop: row.line ? 2 : 0 }}>
        <ChoiceRing on={chosen} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ ...text(13, 400, t.text), lineHeight: "18px" }}>{row.label}</span>
        {row.line ? <span style={{ ...text(12, 400, t.text2), lineHeight: "16px" }}>{row.line}</span> : null}
      </span>
    </label>
  );
}

export function ChoiceRows<V extends string>({ label, name, rows, value, onChange, phone }: ChoiceRowsProps<V>) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((row) => (
        <Row key={row.value} row={row} name={name} chosen={row.value === value} phone={phone} onChange={onChange} />
      ))}
    </div>
  );
}

export default ChoiceRows;
