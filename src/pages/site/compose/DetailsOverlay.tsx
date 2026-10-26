/* CA-18 P5, CA-27 P4: Details in a window too narrow to hold it beside the build.

   From 768 up to where Details fits (about 1244): a 300-wide panel that slides in over the right edge of the composer's box, the full
   height of the columns area (it stays in view as the page scrolls), opened by a tap on a tile and closed by a tap outside, its button
   or Escape; not modal. The window recipe: `--window`, a 1px `--window-border`, radius 12, a shadow cast to the left, padding 14.
   Tapping what is in it opens the tile's window, except Copy, a link, Read all and the close button. Its foot, at the bottom left, reads
   "Tap to edit" on a tablet and on any touch screen, "Click to edit" with a mouse in a wider window. It enters over `BASE`: 16 across
   and a fade. On a phone the same content sits in the "Details" sheet with "Tap to edit".
   Where Details fits beside the build none of this is drawn: there is no foot and a click on the content does nothing. */

import { captureOpener, returnFocus, type Opener } from "@/lib/focus/windowFocus";
import { X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { HEADER_HEIGHT } from "@/components/shell/chromeSize";
import { BASE, STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { OVERLAY_EDGE, OVERLAY_FOOT_COPY, OVERLAY_FOOT_PAD, OVERLAY_PANEL_PAD, OVERLAY_WIDTH, TABLET_MAX } from "./detailsRecipes";
import { text } from "./refinedStyles";

/** What a click on the content must not take as "edit": the controls inside it. */
const CONTROLS = "button, a, input, select, textarea, [role='button'], [role='menuitem']";

/** The content, clickable as a whole to open the window, with the foot that says so. */
export function ClickToEdit({ onEdit, phone, pad = 0, touch = phone, panel = false, children }: { onEdit?: () => void; phone: boolean; pad?: number; /** The foot says Tap to edit. */ touch?: boolean; /** In the tablet panel: the foot has no rule above it and is not padded in. */ panel?: boolean; children: ReactNode }) {
  if (!onEdit) return <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: pad }}>{children}</div>;
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(CONTROLS)) return;
    onEdit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && event.target === event.currentTarget) onEdit();
  };
  return (
    <>
      <div data-testid="details-clickable" tabIndex={0} onClick={onClick} onKeyDown={onKeyDown} style={{ cursor: "pointer", outline: "none", flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: pad }}>
        {children}
      </div>
      <p data-testid="details-foot" style={{ ...text(12, 400, t.label), margin: 0, flex: "0 0 auto", ...(panel ? { paddingTop: 8, textAlign: "left" } : { padding: OVERLAY_FOOT_PAD, borderTop: `1px solid ${t.hairline}` }) }}>
        {touch ? OVERLAY_FOOT_COPY.tap : OVERLAY_FOOT_COPY.click}
      </p>
    </>
  );
}

export interface DetailsOverlayProps {
  /** The selected tile's key; a new one opens the panel. */
  selectedKey: string | null | undefined;
  /** The panel's left edge, in the columns area's own coordinates: its right edge is the composer box's. */
  left: number;
  /** The window is a tablet's (or the screen is touched): the foot says Tap to edit. */
  touch: boolean;
  onEdit?: () => void;
  children: ReactNode;
}

/** Whether the window is a tablet's, or the screen is touched. */
export function useTouchPanel(width: number): boolean {
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return width <= TABLET_MAX || coarse;
}

export function DetailsOverlay({ selectedKey, left, touch, onEdit, children }: DetailsOverlayProps) {
  const [open, setOpen] = useState(false);
  const returnTo = useRef<Opener>({ el: null, place: null });
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selectedKey) {
      setOpen(false);
      return;
    }
    returnTo.current = captureOpener();
    setOpen(true);
  }, [selectedKey]);

  /* It slides in: 16 across from the right, and a fade, over BASE. */
  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el || prefersReducedMotion() || typeof el.animate !== "function") return;
    const run = el.animate([{ opacity: 0, transform: "translateX(16px)" }, { opacity: 1, transform: "translateX(0)" }], { duration: BASE, easing: STANDARD });
    return () => run.cancel();
  }, [open, selectedKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"]')) close();
    };
    /* A tap outside closes it; what a menu or window holds is not outside. */
    const onPress = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || panel.current?.contains(target) || target.closest('[role="menu"], [role="dialog"], [data-radix-popper-content-wrapper]')) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress, { capture: true, passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    returnFocus(returnTo.current, panel.current);
  }

  if (!open || !selectedKey) return null;
  const top = HEADER_HEIGHT + OVERLAY_EDGE;
  return (
    <div data-testid="details-overlay-slot" style={{ position: "absolute", top: 0, bottom: 0, left, width: OVERLAY_WIDTH, zIndex: 15, pointerEvents: "none" }}>
      <section
        ref={panel}
        aria-label="Details"
        data-testid="details-overlay"
        style={{
          position: "sticky",
          top,
          height: `min(100%, calc(100vh - ${top + OVERLAY_EDGE}px))`,
          width: OVERLAY_WIDTH,
          pointerEvents: "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          padding: OVERLAY_PANEL_PAD,
          background: t.window,
          border: `1px solid ${t.windowBorder}`,
          borderRadius: 12,
          boxShadow: t.panelShadow,
          overflow: "hidden",
        } satisfies CSSProperties}
      >
        <div style={{ display: "flex", justifyContent: "flex-end", flex: "0 0 auto" }}>
          <IconButton icon={X} glyph="x" boxed={false} label="Close details" size={26} onClick={close} />
        </div>
        <ClickToEdit onEdit={onEdit} phone={false} touch={touch} panel>
          {children}
        </ClickToEdit>
      </section>
    </div>
  );
}

export default DetailsOverlay;
