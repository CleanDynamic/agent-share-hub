/* The halftone layer (Reference C, G17 to G20): a canvas of dots that plays around the sign-in dialog while it is open
   and winds down when it closes. While a mouse button or a key is held with the dialog open, the same field is drawn as
   monospace characters instead (Reference D, G21 to G23).

   It exists only while the dialog is open or winding down: the host mounts it and takes it away once the wind-down has
   passed (back > 520). Fixed, the whole viewport, no pointer events, hidden from assistive technology and never
   focusable; it sits above the scrim (z 50) and below the dialog (z 52). One animation loop, paused while the tab is
   hidden. Under reduced motion it draws one still frame at t = 3: no reveal, no wind-down, no cursor effect. */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useRoom } from "@/components/brand/useRoom";
import { sizeCanvas, startLoop } from "@/lib/dots/engine";
import { prefersReducedMotion } from "@/lib/theme/motion";

import { buildCodeSprites, type CodeSprites } from "./codeSprites";
import { DARK_PALETTE, HalftoneField, LIGHT_PALETTE, type Rect } from "./halftoneField";
import { isSigningIn } from "./signinActivity";

/** Between the scrim (50) and the dialog (52). */
export const LAYER_Z = 51;

/** The still frame's time under reduced motion. */
const STILL_T = 3;

/** Code style (Reference D): a tap shows for at least 0.14s; a held key's repeats refresh a 0.6s safety timeout. */
const MIN_SHOW_MS = 140;
const KEY_SAFETY_MS = 600;

/**
 * Whether a button or a key is held, from window events, only while the dialog is open (G22). On at once; off at once
 * on release, except that a tap stays on for 0.14s; a held key stays on while its repeats keep coming (0.6s apart at
 * most); pointercancel and the window losing focus also let go.
 */
function holdWatcher(onChange: () => void) {
  let held = false;
  let since = 0;
  let offTimer = 0;
  let safety = 0;
  const on = () => {
    window.clearTimeout(offTimer);
    if (!held) {
      held = true;
      since = performance.now();
      onChange();
    }
  };
  const off = () => {
    window.clearTimeout(safety);
    if (!held) return;
    const shown = performance.now() - since;
    window.clearTimeout(offTimer);
    const release = () => {
      held = false;
      onChange();
    };
    if (shown >= MIN_SHOW_MS) release();
    else offTimer = window.setTimeout(release, MIN_SHOW_MS - shown);
  };
  const onKeyDown = () => {
    on();
    window.clearTimeout(safety);
    safety = window.setTimeout(off, KEY_SAFETY_MS);
  };
  // Only the window's own blur: a capturing listener also hears every control's blur, which a press elsewhere causes.
  const onBlur = (event: Event) => {
    if (event.target === window) off();
  };
  const events: [string, (event: Event) => void][] = [
    ["pointerdown", on],
    ["keydown", onKeyDown],
    ["pointerup", off],
    ["keyup", off],
    ["pointercancel", off],
    ["blur", onBlur],
  ];
  for (const [name, handler] of events) window.addEventListener(name, handler, true);
  return {
    held: () => held,
    stop: () => {
      for (const [name, handler] of events) window.removeEventListener(name, handler, true);
      window.clearTimeout(offTimer);
      window.clearTimeout(safety);
      held = false;
    },
  };
}

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
  const state = useRef({ closing, closedAt: null as number | null, onDone, code: false });
  state.current.closing = closing;
  state.current.onDone = onDone;

  /* G21, G22: the hold is listened for on window while the dialog is open, and not otherwise (not while it winds down,
     and never under reduced motion, which has no code style). */
  useEffect(() => {
    if (closing || prefersReducedMotion()) return;
    const shared = state.current;
    const el = canvas.current;
    const watcher = holdWatcher(() => {
      shared.code = watcher.held();
      el?.setAttribute("data-mode", watcher.held() ? "code" : "dots");
    });
    return () => {
      watcher.stop();
      shared.code = false;
      el?.setAttribute("data-mode", "dots");
    };
  }, [closing]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const field = new HalftoneField();
    const palette = room === "dusk" ? DARK_PALETTE : LIGHT_PALETTE;
    let rect: Rect | null = null;
    let ratio = 1;
    let sprites: CodeSprites | null = null;
    let spriteRatio = 0;
    const layout = () => {
      rect = dialogRect() ?? rect;
      if (!rect) return;
      ratio = sizeCanvas(el, window.innerWidth, window.innerHeight);
      field.layout({ width: window.innerWidth, height: window.innerHeight, dialog: rect, palette });
      // The code style's sheet, once per theme and device pixel ratio (not under reduced motion: no code style there).
      if (spriteRatio !== ratio && !prefersReducedMotion()) {
        spriteRatio = ratio;
        const wanted = ratio;
        void buildCodeSprites(room, ratio).then((built) => {
          if (spriteRatio !== wanted) return;
          sprites = built;
          el.setAttribute("data-font", built.face);
        });
      }
    };
    layout();

    const draw = (t: number, reveal: boolean, openedAt: number, closedAt: number | null) => {
      const started = performance.now();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, el.width, el.height);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      field.fillField(t);
      // Code style while a button or a key is held, once its sheet is ready; the dots otherwise.
      if (state.current.code && sprites) {
        field.drawCode(ctx, t, openedAt, closedAt, sprites, ratio);
        recordCost("modal-code", performance.now() - started);
      } else {
        field.drawDots(ctx, t, openedAt, closedAt, reveal);
        recordCost("modal-dots", performance.now() - started);
      }
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
      data-mode="dots"
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", zIndex: LAYER_Z, pointerEvents: "none" }}
    />,
    document.body,
  );
}

export default HalftoneLayer;
