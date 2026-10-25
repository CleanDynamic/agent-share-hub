/* CA-28 P4: the Optional section drawn as closed rows, as CA-15 drew it before the windows opened their fields on demand.

   The windows of Add and Edit no longer use it: they use `OptionalSection`, one toggle that opens every field. Two places still read
   as rows, and use this: the Classification window, whose rows say what they hold when closed ("Task: Customer support, 2 suggestions"),
   and a reader's prompt window, which only reads. Nothing in the rows changed.

   A heading row, "Optional" (13/500) and on the right the count of its fields in mono ("6 fields"); then one row per field, each
   closed when the window opens. A closed row shows the field's name (13), under it one grey line (12.5, `--label`) saying what goes
   there, and a chevron. Pressing the row (Enter and Space work, it is a real button) opens it and shows the field under it; the
   chevron then points up. Several rows can be open at once. A row that already holds a value says that value in the grey line instead,
   cut to one line, so nothing filled is hidden. A row opens on its own when `forceOpen` turns true. Opened from the keyboard, focus
   moves into the row's field. The only motion is the chevron's turn. */

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { useInteractive } from "@/lib/theme/interactive";

import { ELLIPSIS, ModalInset, OPTIONAL, useModalInset } from "./modalRecipes";
import { OPTIONAL_COPY } from "./OptionalSection";

export interface OptionalRowProps {
  /** The field's name: "Failure notes". */
  name: string;
  /** One grey line saying what goes here. Shown while the row holds nothing. */
  description?: string;
  /** What the row holds, as one line; null or empty when it holds nothing. */
  summary?: string | null;
  /** Opens the row, and again each time it turns true. */
  forceOpen?: boolean;
  /** Reader views: the row is read, not edited. */
  readOnly?: boolean;
  phone?: boolean;
  /** CA-16b: a count at the right, in mono, before the chevron ("2 suggestions"). Absent: none. */
  count?: string;
  /** CA-15b: a count 6 after the title ("Multi-agent only"). */
  titleCount?: string;
  /** CA-16b: a filled row's line is drawn in `--text` rather than `--label`. Absent: as it was. */
  filledText?: boolean;
  children: ReactNode;
}

/** One closed-by-default row. */
export function OptionalRow({ name, description, summary, forceOpen = false, phone = false, count, titleCount, filledText = false, children }: OptionalRowProps) {
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

  const inset = useModalInset();
  const line = filledText && filled && !open ? summary : description;
  const value = !filledText && filled && !open ? summary : null;

  return (
    <div data-testid="optional-field" data-open={open || undefined} data-filled={filled || undefined} style={OPTIONAL.row}>
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
        data-ring-inset=""
        style={{ ...OPTIONAL.summary(inset, state.hovered && inset > 0, phone), ...OPTIONAL.focus(state.focusVisible) }}
      >
        <span style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0 }}>
          <span style={OPTIONAL.titleLine}>
            <span data-testid="optional-title" style={OPTIONAL.title}>
              {name}
            </span>
            {titleCount ? (
              <span data-testid="optional-title-count" style={OPTIONAL.count}>
                {titleCount}
              </span>
            ) : null}
          </span>
          <span data-testid="optional-line" style={{ ...OPTIONAL.hint, ...ELLIPSIS, ...(filledText && filled && !open ? OPTIONAL.filledLine : null) }}>
            {line}
          </span>
        </span>
        {count ? (
          <span data-testid="optional-row-count" style={OPTIONAL.value}>
            {count}
          </span>
        ) : value ? (
          <span data-testid="optional-value" style={OPTIONAL.value}>
            {value}
          </span>
        ) : null}
        <span aria-hidden="true" style={OPTIONAL.chevron(open)}>
          <Glyph name="chevd" size={14} />
        </span>
      </button>
      {open ? (
        <div ref={region} id={`${uid}-region`} role="region" aria-labelledby={`${uid}-head`} style={OPTIONAL.body(inset)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface OptionalRowsProps {
  /** `OptionalField`s; a `null` or `false` child is not a field and is not counted. */
  children: ReactNode;
  /** CA-16b: said at the right of the heading in place of the field count ("Suggestions come from your build"). */
  hint?: string;
  /** CA-16b: the body's side padding to run the rules across ("bleed" 20 in a window padded 20): the section reaches the window's edges and pads its own rows back in. */
  bleed?: number;
}

/** The section: its heading and count, then its rows split by hairlines. Draws nothing when it has no field. */
export function OptionalRows({ children, hint, bleed = 0 }: OptionalRowsProps) {
  const context = useModalInset();
  const rows = Children.toArray(children).filter(isValidElement);
  if (rows.length === 0) return null;
  const inset = bleed || context;
  return (
    <ModalInset.Provider value={inset}>
      <section aria-label={OPTIONAL_COPY.heading} data-testid="optional-section" style={OPTIONAL.sectionAt(bleed)}>
        <div style={OPTIONAL.header(inset)}>
          <h3 style={OPTIONAL.heading}>{OPTIONAL_COPY.heading}</h3>
          <span data-testid="optional-count" style={OPTIONAL.count}>
            {hint ?? OPTIONAL_COPY.fields(rows.length)}
          </span>
        </div>
        {rows}
      </section>
    </ModalInset.Provider>
  );
}

export default OptionalRows;
