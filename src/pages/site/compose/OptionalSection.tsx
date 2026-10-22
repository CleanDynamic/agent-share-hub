/* CA-16 P5: the Card's Optional section: rows that start closed.

   CA-15 has not added its `OptionalSection` and `OptionalField` yet, so these are the equivalent: the same idea (an
   optional thing is one quiet line until it is wanted) on the refined recipes. A closed row shows its name, its value
   (or "Not set") and, on the right, a count ("2 suggestions", "1 question") or "Read from your build". Open or closed
   is `aria-expanded` on the row's button, which a screen reader announces; the button controls the panel under it.
   44 high on a phone. */

import { useId, useState, type CSSProperties, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { ellipsis, text } from "./refinedStyles";

export function OptionalSection({ title = "Optional", hint, phone = false, children }: { title?: string; hint?: string; phone?: boolean; children: ReactNode }) {
  const pad = phone ? 16 : 24;
  return (
    <section aria-label={title} style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: `14px ${pad}px 10px`, borderTop: `1px solid ${t.hairlineModule}` }}>
        <h2 style={{ ...text(13.5, 500, t.text), margin: 0 }}>{title}</h2>
        {hint ? <span style={{ fontFamily: DM_MONO, fontSize: 11, color: t.label, textAlign: "right" }}>{hint}</span> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </section>
  );
}

export interface OptionalRowProps {
  /** "Summary", "Field", "Known issue". */
  label: string;
  /** What is set, as a line under the label; empty or absent reads `empty`. */
  value?: string;
  /** What the line says when nothing is set. Default "Not set". */
  empty?: string;
  /** On the right: "2 suggestions", "1 question", "Read from your build". */
  count?: string;
  phone: boolean;
  /** An id for the row, so a test or a link can find it. */
  rowId?: string;
  /** Open on arrival. Rows start closed. */
  defaultOpen?: boolean;
  /** A row inside another row's panel: no side padding of its own. */
  nested?: boolean;
  children: ReactNode;
}

export function OptionalRow({ label, value, empty = "Not set", count, phone, rowId, defaultOpen = false, nested = false, children }: OptionalRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const generated = useId();
  const id = rowId ?? generated;
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const unset = !(value && value.trim());
  const shown = unset ? empty : (value as string);
  const pad = nested ? 0 : phone ? 16 : 24;
  const row: CSSProperties = {
    width: "100%",
    minHeight: phone ? 56 : 52,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: `8px ${pad}px`,
    border: 0,
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    ...text(13, 500, t.text),
    ...ring(state.focusVisible),
  };
  return (
    <div style={{ borderTop: `1px solid ${t.hairlineModule}` }} data-row={id}>
      <button type="button" aria-expanded={open} aria-controls={`${id}-panel`} id={`${id}-button`} aria-labelledby={`${id}-label`} aria-describedby={`${id}-value${count ? ` ${id}-count` : ""}`} onClick={() => setOpen((v) => !v)} {...handlers} style={row}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span id={`${id}-label`}>{label}</span>
          <span id={`${id}-value`} style={{ ...text(12.5, 400, unset ? t.label : t.text2), ...ellipsis }}>{shown}</span>
        </span>
        {count ? (
          <span id={`${id}-count`} style={{ fontFamily: DM_MONO, fontSize: 11, color: t.label, flexShrink: 0, whiteSpace: "nowrap" }}>
            {count}
          </span>
        ) : null}
        <Glyph name={open ? "up" : "chevd"} size={16} color={t.label} />
      </button>
      {open ? (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} style={{ padding: `4px ${pad}px 16px`, display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
