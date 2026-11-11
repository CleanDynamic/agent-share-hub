/* CA-28 P4: the Optional section drawn as closed rows, as CA-15 drew it before the windows opened their fields on demand.

   The windows of Add and Edit no longer use it: they use `OptionalSection`, one toggle that opens every field. Two places still read
   as rows, and use this: the Classification window, whose rows say what they hold when closed ("Task: Customer support, 2 suggestions"),
   and a reader's prompt window, which only reads. Nothing in the rows changed.

   A heading row, "Optional" (13/500) and on the right the count of its fields in mono ("6 fields"); then one row per field, each
   closed when the window opens. A closed row shows the field's name (13), under it one grey line (12.5, `--label`) saying what goes
   there, and a chevron. Pressing the row (Enter and Space work, it is a real button) opens it and shows the field under it; the
   chevron then points up. A row left to itself can be open beside others; a section that passes `open` and `onOpenChange` decides
   (F28: the Classification keeps one open at a time). A row that already holds a value says that value in the grey line, open or
   closed (F21), so nothing filled is hidden. A row opens on its own when `forceOpen` turns true. Opened from the keyboard, focus
   moves into the row's field. The only motion is the chevron's turn.

   F20 to F23: every row is label, value, suggestion count, chevron, with the same paddings. A row with no value reads its
   description ("Not set") and, beside it, its first suggestion as a dashed chip, "Suggested: <label>"; Accept (and, once accepted,
   Undo) is a text button laid over a fixed space between the count and the chevron, so nothing shifts. */

import { Children, isValidElement, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { useInteractive } from "@/lib/theme/interactive";

import { ELLIPSIS, ModalInset, OPTIONAL, useModalInset } from "./modalRecipes";
import { OPTIONAL_COPY } from "./OptionalSection";
import { size } from "@/lib/theme/space";

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
  /**
   * UX-03 P5: the first suggestion, offered on the closed row while it holds nothing: its words in the line, and an Accept text
   * button where the count is. Accepting does what choosing it inside the open row does. `name` is the button's accessible name.
   */
  accept?: { text: string; name: string; onAccept: () => void };
  /** F22: after Accept, Undo stands where Accept stood until the row opens or the window closes; it restores what the row held. */
  undo?: { name: string; onUndo: () => void };
  /** F28: the section holds which row is open; given, the row's own state is not used. `forceOpen` still opens it. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** One closed-by-default row. */
export function OptionalRow({ name, description, summary, forceOpen = false, phone = false, count, titleCount, filledText = false, accept, undo, open: openProp, onOpenChange, children }: OptionalRowProps) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp || forceOpen : ownOpen;
  const setOpen = (next: boolean) => {
    if (controlled) onOpenChange?.(next);
    else setOwnOpen(next);
  };
  const uid = useId();
  const region = useRef<HTMLDivElement>(null);
  /** Set when the row was opened from the keyboard, so focus follows into its field once it is drawn. */
  const byKey = useRef(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const filled = Boolean(summary && summary.trim());

  useEffect(() => {
    if (forceOpen) setOwnOpen(true);
  }, [forceOpen]);

  useEffect(() => {
    if (!open || !byKey.current) return;
    byKey.current = false;
    region.current?.querySelector<HTMLElement>("input, textarea, select, button, [tabindex]:not([tabindex='-1'])")?.focus();
  }, [open]);

  const inset = useModalInset();
  const offer = accept && !filled && !open ? accept : null;
  /* F22: Undo is a closed-row affordance, as Accept is. */
  const undoable = undo && !open ? undo : null;
  const action = offer ? { name: offer.name, label: "Accept", onClick: offer.onAccept, testId: "optional-accept" } : undoable ? { name: undoable.name, label: "Undo", onClick: undoable.onUndo, testId: "optional-undo" } : null;
  /* F21: the line says the value whether the row is open or closed. */
  const line = filledText && filled ? summary : description;
  const value = !filledText && filled ? summary : null;

  return (
    <div data-testid="optional-field" data-open={open || undefined} data-filled={filled || undefined} style={{ ...OPTIONAL.row, position: "relative" }}>
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
          <span style={OPTIONAL.lineRow}>
            {/* Beside a chip the short line ("Not set") keeps its words; the chip is the one that is cut. */}
            <span data-testid="optional-line" style={{ ...OPTIONAL.hint, ...ELLIPSIS, ...(offer ? { flexShrink: 0 } : null), ...(filledText && filled ? OPTIONAL.filledLine : null) }}>
              {line}
            </span>
            {offer ? (
              <span data-testid="optional-suggested-chip" style={OPTIONAL.suggestedChip}>
                {`Suggested: ${offer.text}`}
              </span>
            ) : null}
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
        {action ? <span aria-hidden="true" style={{ width: ACTION_ROOM, flexShrink: 0 }} /> : null}
        <span aria-hidden="true" style={OPTIONAL.chevron(open)}>
          <Glyph name="chevd" size={size.icon} />
        </span>
      </button>
      {action ? <AcceptButton action={action} right={inset + CHEVRON_ROOM} phone={phone} /> : null}
      {open ? (
        <div ref={region} id={`${uid}-region`} role="region" aria-labelledby={`${uid}-head`} style={OPTIONAL.body(inset)}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** UX-03 P5: the chevron and the gap before it, at the row's right; Accept sits left of them. */
const CHEVRON_ROOM = 14 + 16;
/** F23: the fixed space between the count and the chevron that Accept or Undo is laid over, so the chevron never moves. */
const ACTION_ROOM = 64 - 16;

/**
 * UX-03 P5: Accept (F22: or Undo), a text button laid over the row's right side (a button cannot sit inside the row's own button).
 * Underlined at once on hover, a fine pointer only; on a phone its hit area reaches 44.
 */
function AcceptButton({ action, right, phone }: { action: { name: string; label: string; onClick: () => void; testId: string }; right: number; phone: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={action.name}
      data-testid={action.testId}
      onClick={action.onClick}
      {...handlers}
      style={{
        position: "absolute",
        right,
        top: "50%",
        transform: "translateY(-50%)",
        minHeight: phone ? 44 : 28,
        padding: "0 8px",
        border: 0,
        borderRadius: 6,
        background: "transparent",
        cursor: "pointer",
        ...OPTIONAL.title,
        fontWeight: 500,
        textDecoration: state.hovered ? "underline" : "none",
        textUnderlineOffset: 3,
        ...OPTIONAL.focus(state.focusVisible),
      }}
    >
      {action.label}
    </button>
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
