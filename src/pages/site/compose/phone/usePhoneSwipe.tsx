/* Prompt 23: swipe a tile to the left. Duplicate (Raised) and Remove (Danger fill) show behind it, 84 wide each, the icon over
   the word 13. A swipe past half the tray's width holds it open; a shorter one, a tap elsewhere or a scroll closes it. The
   same actions as the tile's menu and the computer's Cmd D and Delete.

   The tile moves by a transform only, and the tray is drawn in the list's own box under the tile's place, so nothing in the
   List's layout changes. A press on the grip is a drag, never a swipe; a press on a control inside the tile does what it does. */

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { BASE, FAST, STANDARD, prefersReducedMotion } from "@/lib/theme/motion";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { NO_DRAG } from "../listNest";
import { PHONE_EDITOR_COPY } from "./phoneEditorModel";

export const SWIPE_ACTION = 84;
const TRAY = SWIPE_ACTION * 2;
/** How far a finger goes sideways before the gesture is a swipe and not a scroll or a tap. */
const SWIPE_START = 10;

interface Open {
  id: string;
  top: number;
  height: number;
  name: string;
}

function TrayButton({ label, icon, danger, onClick }: { label: string; icon: "copy" | "trash"; danger?: boolean; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={danger ? "swipe-remove" : "swipe-duplicate"}
      {...handlers}
      style={{
        width: SWIPE_ACTION,
        height: "100%",
        padding: 0,
        border: 0,
        background: danger ? t.dangerText : t.control,
        color: danger ? t.bg : t.text,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        fontFamily: FIGTREE,
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        ...ring(state.focusVisible),
      }}
    >
      <MobileIcon name={icon} size={20} />
      {label}
    </button>
  );
}

const tileOf = (id: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);

function slide(element: HTMLElement, x: number, ms: number) {
  const reduced = prefersReducedMotion();
  element.style.transition = ms > 0 && !reduced ? `transform ${ms}ms ${STANDARD}` : "none";
  element.style.transform = x === 0 ? "" : `translateX(${x}px)`;
  if (x === 0) {
    element.style.position = "";
    element.style.zIndex = "";
  } else {
    element.style.position = "relative";
    element.style.zIndex = "1";
  }
}

export function usePhoneSwipe(
  root: RefObject<HTMLElement>,
  { enabled, onDuplicate, onRemove }: { enabled: boolean; onDuplicate: (id: string) => void; onRemove: (id: string) => void },
): { tray: ReactNode; consumed: () => boolean } {
  const [open, setOpen] = useState<Open | null>(null);
  const openRef = useRef<Open | null>(null);
  openRef.current = open;
  /** The click that ends a swipe is not a tap on the tile. */
  const swallow = useRef(false);

  const close = useCallback((ms = FAST) => {
    const current = openRef.current;
    if (current) {
      const element = tileOf(current.id);
      if (element) slide(element, 0, ms);
    }
    setOpen(null);
  }, []);

  useEffect(() => {
    if (!enabled) close(0);
  }, [enabled, close]);

  useEffect(() => {
    const host = root.current;
    if (!host || !enabled) return;
    let start: { x: number; y: number; id: string; element: HTMLElement } | null = null;
    let swiping = false;
    let dx = 0;

    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || !(event.target instanceof Element)) return;
      if (openRef.current && !event.target.closest('[data-testid="swipe-tray"]')) {
        close();
        swallow.current = true;
        return;
      }
      const element = event.target.closest<HTMLElement>("[data-node-id]");
      if (!element || !host.contains(element) || event.target.closest("[data-grip]")) return;
      const control = event.target.closest(NO_DRAG);
      if (control && control !== element && element.contains(control)) return;
      start = { x: event.clientX, y: event.clientY, id: element.dataset.nodeId ?? "", element };
      swiping = false;
      dx = 0;
    };
    const move = (event: PointerEvent) => {
      if (!start) return;
      const x = event.clientX - start.x;
      const y = event.clientY - start.y;
      if (!swiping) {
        if (Math.abs(y) > SWIPE_START && Math.abs(y) > Math.abs(x)) {
          start = null;
          return;
        }
        if (x > -SWIPE_START || Math.abs(x) < Math.abs(y)) return;
        swiping = true;
      }
      dx = Math.max(-TRAY - 24, Math.min(0, x));
      slide(start.element, dx, 0);
      if (!openRef.current || openRef.current.id !== start.id) {
        const box = start.element.getBoundingClientRect();
        const hostBox = host.getBoundingClientRect();
        const name = start.element.getAttribute("aria-label")?.split(":")[0] ?? "";
        setOpen({ id: start.id, top: box.top - hostBox.top, height: box.height, name });
      }
    };
    const up = () => {
      if (!start) return;
      if (swiping) {
        swallow.current = true;
        if (dx < -TRAY / 4) slide(start.element, -TRAY, BASE);
        else close();
      }
      start = null;
      swiping = false;
    };
    const click = (event: MouseEvent) => {
      if (!swallow.current) return;
      swallow.current = false;
      if (event.target instanceof Element && event.target.closest('[data-testid="swipe-tray"]')) return;
      event.stopPropagation();
      event.preventDefault();
    };
    const scroll = () => {
      if (openRef.current && !start) close();
    };
    host.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    host.addEventListener("click", click, true);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      host.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      host.removeEventListener("click", click, true);
      window.removeEventListener("scroll", scroll);
    };
  }, [root, enabled, close]);

  const tray = open ? (
    <div
      role="group"
      aria-label={PHONE_EDITOR_COPY.swipeActions(open.name)}
      data-testid="swipe-tray"
      style={{ position: "absolute", right: 16, top: open.top, height: open.height, width: TRAY, display: "flex", borderRadius: 12, overflow: "hidden", zIndex: 0 }}
    >
      <TrayButton
        label={PHONE_EDITOR_COPY.duplicate}
        icon="copy"
        onClick={() => {
          const id = open.id;
          close(0);
          onDuplicate(id);
        }}
      />
      <TrayButton
        label={PHONE_EDITOR_COPY.remove}
        icon="trash"
        danger
        onClick={() => {
          const id = open.id;
          close(0);
          onRemove(id);
        }}
      />
    </div>
  ) : null;

  return { tray, consumed: () => swallow.current };
}
