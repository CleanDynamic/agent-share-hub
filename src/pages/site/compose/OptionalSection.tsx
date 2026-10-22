/* CA-15 P1 — the Optional section every tile modal ends with.

   A heading row, "Optional" (13/500) and on the right the count of its fields in mono ("6 fields"); then one row per
   optional field, each closed when the modal opens. A closed row shows the field's name (13), under it one grey line
   (12.5, `--label`) saying what goes there, and a chevron. Pressing the row (Enter and Space work, it is a real button)
   opens it and shows the field under it; the chevron then points up. Several rows can be open at once.

   A row that already holds a value (a saved tile being edited, or one the maker filled and closed) says that value in the
   grey line instead, cut to one line, so nothing filled is hidden. A row opens on its own when `forceOpen` turns true (the
   modal was opened from an error that points into it). Opened from the keyboard, focus moves into the row's field.

   The only motion is the chevron's turn; opening and closing are instant. */

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { bareButton, ellipsis, text, tnum } from "./refinedStyles";

export const OPTIONAL_COPY = { heading: "Optional", fields: (n: number) => `${n} ${n === 1 ? "field" : "fields"}` } as const;

/** What a row says when it holds a value: the value cut to one line by CSS; a list reads as its items joined. */
export function summaryOf(...values: readonly (string | number | readonly string[] | null | undefined)[]): string | null {
  const parts = values.flatMap((value) => {
    if (value === null || value === undefined) return [];
    if (typeof value === "number") return [String(value)];
    if (typeof value === "string") return value.trim() ? [value.trim().replace(/\s*\n\s*/g, ", ")] : [];
    const items = value.map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? [items.join(", ")] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

export interface OptionalFieldProps {
  /** The field's name: "Failure notes". */
  name: string;
  /** One grey line saying what goes here. Shown while the row holds nothing. */
  description: string;
  /** What the row holds, as one line; null or empty when it holds nothing. */
  summary?: string | null;
  /** Opens the row, and again each time it turns true. */
  forceOpen?: boolean;
  /** Reader views: the row is read, not edited. */
  readOnly?: boolean;
  phone?: boolean;
  children: ReactNode;
}

/** One closed-by-default row. */
export function OptionalField({ name, description, summary, forceOpen = false, phone = false, children }: OptionalFieldProps) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const region = useRef<HTMLDivElement>(null);
  /** Set when the row was opened from the keyboard, so focus follows into its field once it is drawn. */
  const byKey = useRef(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const filled = Boolean(summary && summary.trim());

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!open || !byKey.current) return;
    byKey.current = false;
    region.current?.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]:not([tabindex='-1'])")?.focus();
  }, [open]);

  return (
    <div data-testid="optional-field" data-open={open || undefined} data-filled={filled || undefined} style={{ minWidth: 0 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${uid}-region`}
        id={`${uid}-head`}
        // A keyboard press arrives as a click with no pointer: detail is 0.
        onClick={(event) => {
          if (!open && event.detail === 0) byKey.current = true;
          setOpen(!open);
        }}
        {...handlers}
        style={{
          ...bareButton,
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          gap: 12,
          minHeight: phone ? 44 : 40,
          padding: "8px 0",
          borderRadius: 6,
          ...ring(state.focusVisible),
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
          <span style={text(13, 400, t.text)}>{name}</span>
          <span data-testid="optional-line" style={{ ...text(12.5, 400, t.label), ...ellipsis }}>
            {filled && !open ? summary : description}
          </span>
        </span>
        <span aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0, color: t.label, transform: open ? "rotate(180deg)" : "none", transition: "transform 120ms" }}>
          <Glyph name="chevd" size={16} />
        </span>
      </button>
      {open ? (
        <div ref={region} id={`${uid}-region`} role="region" aria-labelledby={`${uid}-head`} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "4px 0 12px", minWidth: 0 }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface OptionalSectionProps {
  /** `OptionalField`s; a `null` or `false` child is not a field and is not counted. */
  children: ReactNode;
}

/** The section: its heading and count, then its rows split by hairlines. Draws nothing when it has no field. */
export function OptionalSection({ children }: OptionalSectionProps) {
  const rows = Children.toArray(children).filter(isValidElement);
  if (rows.length === 0) return null;
  return (
    <section aria-label={OPTIONAL_COPY.heading} data-testid="optional-section" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingBottom: 6, borderBottom: `1px solid ${t.hairline}` }}>
        <h3 style={{ ...text(13, 500, t.text), margin: 0 }}>{OPTIONAL_COPY.heading}</h3>
        <span data-testid="optional-count" style={{ fontFamily: DM_MONO, fontSize: 11.5, lineHeight: "normal", color: t.label, ...tnum }}>
          {OPTIONAL_COPY.fields(rows.length)}
        </span>
      </div>
      {rows.map((row, index) => (
        <div key={index} style={index === 0 ? undefined : { borderTop: `1px solid ${t.hairline}` }}>
          {row}
        </div>
      ))}
    </section>
  );
}

export default OptionalSection;
