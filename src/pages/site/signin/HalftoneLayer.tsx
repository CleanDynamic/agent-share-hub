/* The halftone layer (Reference C, G17 to G20): a canvas of dots that plays around the sign-in dialog while it is open
   and winds down when it closes.

   It exists only while the dialog is open or winding down: the host mounts it and takes it away once the wind-down has
   passed (back > 520). Fixed, the whole viewport, no pointer events, hidden from assistive technology and never
   focusable; it sits above the scrim (z 50) and below the dialog (z 52). One animation loop, paused while the tab is
   hidden. Under reduced motion it draws one still frame at t = 3: no reveal, no wind-down, no cursor effect. */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useRoom } from "@/components/brand/useRoom";
import { sizeCanvas, startLoop } from "@/lib/dots/engine";
import { prefersReducedMotion } from "@/lib/theme/motion";

import { DARK_PALETTE, HalftoneField, LIGHT_PALETTE, type Rect } from "./halftoneField";
import { isSigningIn } from "./signinActivity";

/** Between the scrim (50) and the dialog (52). */
export const LAYER_Z = 51;

/** The still frame's time under reduced motion. */
const STILL_T = 3;

export interface HalftoneLayerProps {
  /** The dialog is closing: the wind-down starts now. */
  closing: boolean;
  /** The wind-down has passed: the host takes the layer away. */
  onDone: () => void;
}

/** The dialog's rectangle, from where it rests (its layout box, not its entrance transform). */
function dialogRect(): Rect | null {
  const el = document.querySelector<HTMLElement>('[data-testid="signin-dialog"]');
  if (!el) return null;
  return { left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight };
}

/** Frame costs for the G29 measurement, kept only when a test asks for them. */
function recordCost(name: string, ms: number) {
  const store = (window as unknown as { __dotsFrameTimes?: Record<string, number[]> }).__dotsFrameTimes;
  if (store) (store[name] ??= []).push(ms);
}

export function HalftoneLayer({ closing, onDone }: HalftoneLayerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const room = useRoom();
  const state = useRef({ closing, closedAt: null as number | null, onDone });
  state.current.closing = closing;
  state.current.onDone = onDone;

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const field = new HalftoneField();
    const palette = room === "dusk" ? DARK_PALETTE : LIGHT_PALETTE;
    let rect: Rect | null = null;
    let ratio = 1;
    const layout = () => {
      rect = dialogRect() ?? rect;
      if (!rect) return;
      ratio = sizeCanvas(el, window.innerWidth, window.innerHeight);
      field.layout({ width: window.innerWidth, height: window.innerHeight, dialog: rect, palette });
    };
    layout();

    const draw = (t: number, reveal: boolean, openedAt: number, closedAt: number | null) => {
      const started = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      field.fillField(t);
      field.drawDots(ctx, t, openedAt, closedAt, reveal);
      recordCost("modal-dots", performance.now() - started);
    };

    if (prefersReducedMotion()) {
      // One still frame, at t = 3: no reveal, no wind-down, no cursor. The dialog's chunk may arrive after this one, so the
      // frame waits for its rectangle (a frame at a time, nothing drawn meanwhile) and is then drawn once.
      let waiting = 0;
      const still = () => {
        layout();
        if (rect) draw(STILL_T, false, 0, null);
        else waiting = requestAnimationFrame(still);
      };
      still();
      window.addEventListener("resize", still);
      return () => {
        cancelAnimationFrame(waiting);
        window.removeEventListener("resize", still);
      };
    }

    let origin = -1;
    const onPointerMove = (event: PointerEvent) => field.pointer(event.clientX, event.clientY);
    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) field.pointer(null, null);
    };
    window.addEventListener("resize", layout);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut);
    const stop = startLoop((now, dt) => {
      // The reveal starts from the dialog: until its rectangle is known there is nothing to reveal around.
      if (!rect) layout();
      if (!rect) return;
      if (origin < 0) origin = now;
      const t = now - origin;
      if (state.current.closing && state.current.closedAt === null) state.current.closedAt = t;
      if (!state.current.closing) state.current.closedAt = null;
      field.step(dt, isSigningIn(), false);
      draw(t, true, 0, state.current.closedAt);
      if (field.done(t, state.current.closedAt)) {
        state.current.onDone();
        return false;
      }
    });
    return () => {
      stop();
      window.removeEventListener("resize", layout);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
    };
  }, [room]);

  return createPortal(
    <canvas
      ref={canvas}
      data-testid="signin-halftone"
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: LAYER_Z, pointerEvents: "none" }}
    />,
    document.body,
  );
}

export default HalftoneLayer;
