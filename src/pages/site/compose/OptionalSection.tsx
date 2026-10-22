/* CA-16 P5 — the Card's Optional section: rows that start closed.

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

import { ellipsis, text } from "./refinedStyles";

export function OptionalSection({ title = "Optional", children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <h2 style={{ ...text(13.5, 500, t.text), margin: 0 }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${t.hairlineModule}` }}>{children}</div>
    </section>
  );
}

export interface OptionalRowProps {
  /** "Summary", "Field", "Known issue". */
  label: string;
  /** What is set, as a line; empty or absent reads "Not set". */
  value?: string;
  /** On the right when closed: "2 suggestions", "1 question", "Read from your build". */
  count?: string;
  phone: boolean;
  /** An id for the row, so a test or a link can find it. */
  rowId?: string;
  /** Open on arrival. Rows start closed. */
  defaultOpen?: boolean;
  children: ReactNode;
}

export function OptionalRow({ label, value, count, phone, rowId, defaultOpen = false, children }: OptionalRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const generated = useId();
  const id = rowId ?? generated;
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const shown = value && value.trim() ? value : "Not set";
  const unset = !(value && value.trim());
  const row: CSSProperties = {
    width: "100%",
    minHeight: phone ? 44 : 40,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 4px",
    border: 0,
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    borderRadius: 6,
    ...text(13, 500, t.text),
    ...ring(state.focusVisible),
  };
  return (
    <div style={{ borderBottom: `1px solid ${t.hairlineModule}` }} data-row={id}>
      <button type="button" aria-expanded={open} aria-controls={`${id}-panel`} id={`${id}-button`} onClick={() => setOpen((v) => !v)} {...handlers} style={row}>
        <Glyph name={open ? "chevd" : "chev"} size={16} color={t.label} />
        <span style={{ flexShrink: 0 }}>{label}</span>
        <span style={{ ...text(12.5, 400, unset ? t.label : t.text2), ...ellipsis, flexGrow: 1, minWidth: 0, textAlign: "right" }}>{open ? "" : shown}</span>
        {count && !open ? <span style={{ ...text(11.5, 400, t.label), flexShrink: 0, whiteSpace: "nowrap" }}>{count}</span> : null}
      </button>
      {open ? (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-button`} style={{ padding: phone ? "4px 4px 16px" : "4px 4px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
