// The phone's bottom sheet, for menus (CA-10, CA-09 F1): the same items a desktop menu offers, as 44pt rows under a
// plain heading, rising from the dock edge.
//
// ON THE DIALOG PRIMITIVE THE CODEBASE USES (`@radix-ui/react-dialog`), so focus is kept inside, Escape and a tap on
// the scrim close it, the page behind does not scroll, and focus goes back to whatever opened it. A caller whose row
// moves focus somewhere else (Add › Prompt puts the caret in a field) passes `onCloseAutoFocus` and prevents it.
//
// THE LOOK is the refined window recipe as `shell/BottomSheet` draws it: `--window`, a 1px `--window-border`, radius 12
// at the top, `--sheet-shadow`, over `--scrim`, no blur; a grab line (40×5, `--line`) at the top, which a drag of more
// than 80px down closes. The heading is 15/600 `--text`. It rises from the bottom edge in `BASE` ms and does not move
// at all under `prefers-reduced-motion`.
//
// ROWS. `SheetRow` is a 44pt button: the name 13/500 `--text`, its line 11.5 `--label`, dimmed when disabled. A row's
// `onSelect` runs inside the tap's own handler, so a focus it moves raises the iPhone keyboard.
//
// CLOSING IN THE SAME TAP. `closeNow(setOpen)` shuts the sheet synchronously (`flushSync`), so the row can focus
// something outside it in the very handler that chose it; while the sheet is open its focus trap would take that
// focus straight back.

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

import { BASE, STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** A downward drag of more than this many px on the grab line closes the sheet. */
export const SHEET_DRAG_CLOSE_PX = 80;

/** A sheet row's height: the touch floor. */
export const SHEET_ROW_HEIGHT = 44;

/** Shut the sheet now, in this handler, so focus can move outside it straight after. */
export function closeNow(setOpen: (open: boolean) => void) {
  flushSync(() => setOpen(false));
}

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plain heading, and the dialog's accessible name: "Add". */
  title: string;
  /** Called as the sheet closes, before focus goes back to what opened it; `preventDefault()` keeps it where it is. */
  onCloseAutoFocus?: (event: Event) => void;
  "data-testid"?: string;
  children?: ReactNode;
}

export function BottomSheet({ open, onOpenChange, title, onCloseAutoFocus, children, ...rest }: BottomSheetProps) {
  const start = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    start.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current === null) return;
    setDrag(Math.max(0, event.clientY - start.current));
  };
  const onUp = () => {
    const far = drag > SHEET_DRAG_CLOSE_PX;
    start.current = null;
    setDrag(0);
    if (far) onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 40 }} />
        <Dialog.Content
          data-testid={rest["data-testid"] ?? "brand-bottom-sheet"}
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 41,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            maxHeight: "88dvh",
            overflowY: "auto",
            overscrollBehavior: "contain",
            boxSizing: "border-box",
            padding: "4px 8px calc(16px + env(safe-area-inset-bottom))",
            borderRadius: "12px 12px 0 0",
            background: t.window,
            border: `1px solid ${t.windowBorder}`,
            borderBottom: 0,
            boxShadow: t.sheetShadow,
            color: t.text,
            fontFamily: FIGTREE,
            animation: prefersReducedMotion() ? "none" : `rrSlide ${BASE}ms ${STANDARD}`,
            transform: drag ? `translateY(${drag}px)` : undefined,
          }}
        >
          <div
            data-testid="sheet-grab-line"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{ alignSelf: "center", padding: "8px 16px", touchAction: "none", cursor: "grab" }}
          >
            <div style={{ width: 40, height: 5, borderRadius: 3, background: t.line }} />
          </div>
          <Dialog.Title style={{ margin: "0 8px", fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>{title}</Dialog.Title>
          <div role="group" aria-label={title} style={{ display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export interface SheetRowProps {
  name: string;
  line?: string;
  disabled?: boolean;
  /** Runs inside the tap's own handler. */
  onSelect?: () => void;
  /** "true" or "false" for a row that opens more rows under it. */
  expanded?: boolean;
  /** Indented under the row that opened it. */
  inset?: boolean;
}

export function SheetRow({ name, line, disabled = false, onSelect, expanded, inset = false }: SheetRowProps) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const style: CSSProperties = {
    minHeight: SHEET_ROW_HEIGHT,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 2,
    padding: inset ? "4px 8px 4px 24px" : "4px 8px",
    boxSizing: "border-box",
    border: 0,
    borderRadius: 6,
    background: !disabled && state.hovered ? t.controlOn : "transparent",
    textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer",
    filter: disabled ? t.dimFilter : undefined,
    ...ring(state.focusVisible),
  };
  return (
    <button type="button" {...handlers} disabled={disabled} aria-expanded={expanded} onClick={onSelect} style={style}>
      <span style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, color: t.text }}>{name}</span>
      {line ? <span style={{ fontFamily: FIGTREE, fontSize: 11.5, color: t.label }}>{line}</span> : null}
    </button>
  );
}

export default BottomSheet;
