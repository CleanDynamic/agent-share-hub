// The phone's bottom sheet (prompt 17). On the dialog primitive the repo already uses, so focus stays inside, Escape and a tap on
// the scrim close it, the page behind does not scroll, and focus goes back to what opened it.
//
// LOOK. Scrim `--scrim`; the sheet on Card, radius 16 16 0 0, padding 8 0 plus the bottom inset; a 36 by 4 grab handle in
// `--field-edge`; a header row (title 17/22 600 at 16 from the left, an optional line 13 Text 2, a 44 close button).
// HEIGHTS. `content` opens to its content, at most 90% of the screen; `half` is 50% and drags up to full; `full` ends 59 below the top.
// CLOSING. A drag down on the handle or the header closes past 80px, and a quick flick closes from anywhere above the body.
// If a field inside has changed (or `dirty` says so), closing first asks in an action sheet: "Discard changes?".
// FOOTER. Pinned to the bottom on Surface, 12 16 plus the inset: a status line at the left, the buttons at the right. The
// sheet rides above the on-screen keyboard.
// MOTION. The slide is the `data-motion="sheet"` rule in index.css (BASE up on STANDARD, FAST down; a fade under reduced motion).

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { PHONE_MARGIN, PHONE_SHEET_RADIUS } from "@/components/shell/chromeSize";
import { useWindowFocus } from "@/lib/focus/windowFocus";
import { ring } from "@/lib/theme/controls";
import { TOUCH_MIN } from "@/lib/theme/density";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { ActionSheet } from "./ActionSheet";
import { useKeyboardInset } from "./useKeyboardInset";

/** A downward drag of more than this many px on the handle or header closes the sheet. */
export const PHONE_SHEET_DRAG_CLOSE_PX = 80;
/** A downward flick faster than this (px per ms) over at least `FLICK_MIN_PX` closes it from anywhere above the body. */
export const FLICK_SPEED = 0.6;
export const FLICK_MIN_PX = 40;
/** `full` stops this far below the top of the screen. */
export const SHEET_TOP_GAP = 59;

export type PhoneSheetHeight = "content" | "half" | "full";

export interface PhoneBottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required: the dialog's accessible name. */
  title: string;
  /** Hide the visible title (the name stays). */
  hideTitle?: boolean;
  /** One line under the title, 13 Text 2. */
  line?: string;
  /** A small label on the title's line, after it: "8 of 20", in mono 13 Text 3. Not part of the dialog's name. */
  titleNote?: ReactNode;
  height?: PhoneSheetHeight;
  /** Force whether closing asks first. Absent: the sheet watches its fields. */
  dirty?: boolean;
  footer?: { status?: ReactNode; actions?: ReactNode };
  onCloseAutoFocus?: (event: Event) => void;
  /** The sheet's shade: Card (the default), or the Notepad tone for the reader's notepad (prompt 22). */
  tone?: "card" | "notepad";
  "data-testid"?: string;
  children?: ReactNode;
}

export function PhoneBottomSheet({ open, onOpenChange, title, hideTitle = false, line, titleNote, height = "content", dirty, footer, onCloseAutoFocus, tone = "card", children, ...rest }: PhoneBottomSheetProps) {
  const focus = useWindowFocus(open, onCloseAutoFocus);
  const keyboard = useKeyboardInset();
  const start = useRef<{ y: number; at: number } | null>(null);
  const [drag, setDrag] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [touched, setTouched] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!open) {
      setTouched(false);
      setAsking(false);
      setExpanded(false);
      setDrag(0);
    }
  }, [open]);

  const isDirty = dirty ?? touched;
  const requestClose = () => {
    if (isDirty) setAsking(true);
    else onOpenChange(false);
  };

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest?.("[data-sheet-body]")) return;
    if ((event.target as HTMLElement).closest?.("button, a, input, textarea, select")) return;
    start.current = { y: event.clientY, at: event.timeStamp };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setDrag(Math.max(0, event.clientY - start.current.y));
  };
  const onUp = (event: PointerEvent<HTMLDivElement>) => {
    const from = start.current;
    start.current = null;
    setDrag(0);
    if (!from) return;
    const dy = (event.clientY ?? from.y) - from.y;
    const speed = dy / Math.max(1, event.timeStamp - from.at);
    if (dy > PHONE_SHEET_DRAG_CLOSE_PX || (dy > FLICK_MIN_PX && speed > FLICK_SPEED)) requestClose();
    else if (height === "half" && dy < -FLICK_MIN_PX) setExpanded(true);
  };

  const full = height === "full" || (height === "half" && expanded);
  /* Prompt 24: with the keyboard open the sheet ends at the keyboard's top and is that much shorter, so its top stays put. */
  const size: CSSProperties = full
    ? { height: `calc(100dvh - ${SHEET_TOP_GAP + keyboard}px)` }
    : height === "half"
      ? { height: `min(50dvh, calc(100dvh - ${SHEET_TOP_GAP + keyboard}px))` }
      : { maxHeight: `calc(90dvh - ${keyboard}px)` };

  /* And the field being typed in stays in sight above the footer. */
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!keyboard) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && body.current?.contains(active)) active.scrollIntoView?.({ block: "center" });
  }, [keyboard]);

  const close = useInteractive<HTMLButtonElement>();

  return (
    <>
      <Dialog.Root open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <Dialog.Portal>
          <Dialog.Overlay data-motion="scrim" style={{ position: "fixed", inset: 0, background: t.scrim, zIndex: 40 }} />
          <Dialog.Content
            data-testid={rest["data-testid"] ?? "bottom-sheet"}
            data-motion="sheet"
            data-height={height}
            data-fill={tone}
            aria-describedby={undefined}
            onOpenAutoFocus={focus.onOpenAutoFocus}
            onCloseAutoFocus={focus.onCloseAutoFocus}
            onInput={() => setTouched(true)}
            onChange={() => setTouched(true)}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: keyboard,
              zIndex: 41,
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              ...size,
              padding: footer ? "8px 0 0" : "8px 0 env(safe-area-inset-bottom)",
              borderRadius: `${PHONE_SHEET_RADIUS}px ${PHONE_SHEET_RADIUS}px 0 0`,
              background: tone === "notepad" ? t.notepad : t.module,
              color: t.text,
              fontFamily: FIGTREE,
              overscrollBehavior: "contain",
              transform: drag ? `translateY(${drag}px)` : undefined,
            }}
          >
            <div data-testid="sheet-grabber" style={{ alignSelf: "stretch", display: "flex", justifyContent: "center", padding: "0 0 8px", margin: "4px 0 0", touchAction: "none", cursor: "grab" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: t.fieldEdge }} />
            </div>
            <div data-testid="sheet-header" style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: `0 4px 0 ${PHONE_MARGIN}px`, touchAction: "none" }}>
              <div style={{ flex: 1, minWidth: 0, padding: "11px 0 8px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <Dialog.Title style={hideTitle ? VISUALLY_HIDDEN : { margin: 0, fontSize: 17, fontWeight: 600, lineHeight: "22px", color: t.text }}>{title}</Dialog.Title>
                  {titleNote ? <span style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.label }}>{titleNote}</span> : null}
                </div>
                {line ? <p style={{ margin: 0, fontSize: 13, lineHeight: "16px", color: t.text2 }}>{line}</p> : null}
              </div>
              <button
                type="button"
                aria-label={`Close ${title}`}
                onClick={requestClose}
                {...close.handlers}
                style={{
                  flexShrink: 0,
                  width: TOUCH_MIN,
                  height: TOUCH_MIN,
                  padding: 0,
                  border: 0,
                  borderRadius: r.full,
                  background: "transparent",
                  color: t.text,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  ...ring(close.state.focusVisible),
                }}
              >
                <MobileIcon name="close" size={24} />
              </button>
            </div>
            <div ref={body} data-sheet-body="" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
              {children}
            </div>
            {footer ? (
              <div
                data-testid="sheet-footer"
                data-fill="surface"
                style={{
                  flex: "0 0 auto",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: `12px ${PHONE_MARGIN}px calc(12px + env(safe-area-inset-bottom))`,
                  background: t.surface,
                }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: "16px", color: t.label }}>{footer.status}</span>
                <span style={{ display: "inline-flex", gap: 8, flexShrink: 0 }}>{footer.actions}</span>
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ActionSheet
        open={asking}
        onOpenChange={setAsking}
        title="Discard changes?"
        action={{
          label: "Discard",
          danger: true,
          onSelect: () => {
            setAsking(false);
            setTouched(false);
            onOpenChange(false);
          },
        }}
        cancelLabel="Keep editing"
      />
    </>
  );
}

export default PhoneBottomSheet;
