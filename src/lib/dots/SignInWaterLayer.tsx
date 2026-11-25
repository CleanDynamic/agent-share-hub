/* The water behind the sign-in dialog, as React. Used only by the sign-in dialog.

   `SignInWaterCanvas` is the one implementation: a canvas, a `SignInField` (signinField.ts) and one loop. It reads two things off the
   page, by attribute: the `data-occlude` element's top (the phone's card, which hides what is under it, so nothing there is drawn)
   and the `data-clear` image (the beaver, round which the water fades to the page).

   On a desktop `SignInWaterLayer` puts it over the whole viewport, above the dialog's clear overlay and below the dialog, in place of
   a dim scrim; the pointer listeners are on the canvas itself, so the dialog above it stays interactive. On a phone the dialog's own
   frame draws the canvas inside itself, `position: absolute; inset: 0`, under the beaver and the card.

   One loop, every frame (60 a second), with time from real elapsed time capped at 50ms a step; it pauses while the tab is hidden.
   Under reduced motion it draws one still frame and listens to nothing.

   CLOSING (desktop). When the dialog closes the layer fades out over the scrim's 900ms and then says it is done. */

import { useEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { useRoom } from "@/components/brand/useRoom";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { dotPalette, startLoop } from "./engine";
import { SignInField, type FieldLayout } from "./signinField";

/** Between the dialog's overlay (50) and the dialog (52). */
export const WATER_Z = 51;

/** The longest step the field takes: a stalled frame never throws the water forward. */
export const MAX_STEP_S = 0.05;
/** How often the page is asked where the card and the logo are. */
const MEASURE_EVERY_S = 0.08;

/** Where the card and the logo are, in the canvas's own pixels. */
export function measureLayout(canvas: HTMLCanvasElement): FieldLayout {
  const box = canvas.getBoundingClientRect();
  const occlude = document.querySelector<HTMLElement>("[data-occlude]");
  const clear = document.querySelector<HTMLImageElement>("img[data-clear]");
  let logo: FieldLayout["logo"] = null;
  if (clear) {
    const at = clear.getBoundingClientRect();
    if (at.width > 0 && at.height > 0) {
      logo = { img: clear.complete && clear.naturalWidth > 0 ? clear : null, x: at.left - box.left, y: at.top - box.top, w: at.width, h: at.height };
    }
  }
  return { occludeTop: occlude ? occlude.getBoundingClientRect().top - box.top : null, logo };
}

export interface SignInWaterCanvasProps {
  style?: CSSProperties;
  "data-closing"?: string;
}

export function SignInWaterCanvas({ style, ...rest }: SignInWaterCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const field = useRef<SignInField | null>(null);
  const room = useRoom();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const water = new SignInField(canvas);
    field.current = water;
    const reduced = prefersReducedMotion();
    const size = () => {
      const box = canvas.getBoundingClientRect();
      water.resize(box.width || window.innerWidth, box.height || window.innerHeight, window.devicePixelRatio || 1);
      water.layout(measureLayout(canvas));
    };
    size();
    if (typeof document !== "undefined" && document.fonts?.ready) void document.fonts.ready.then(() => water.refreshAtlas());

    if (reduced) {
      const paint = () => water.draw(dotPalette(), true);
      paint();
      const onResize = () => {
        size();
        paint();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const point = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return [event.clientX - box.left, event.clientY - box.top] as const;
    };
    const onDown = (event: PointerEvent) => {
      const [x, y] = point(event);
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* a pointer that is gone */
      }
      water.pointerDown(x, y, event.timeStamp);
    };
    const onMove = (event: PointerEvent) => {
      const [x, y] = point(event);
      if (event.pointerType === "mouse" && event.buttons === 0) water.hover(x, y);
      else water.pointerMove(x, y);
    };
    const onUp = (event: PointerEvent) => {
      const [x, y] = point(event);
      water.pointerUp(x, y, event.timeStamp, event.pointerType === "mouse");
    };
    const onCancel = () => water.pointerCancel();
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") water.leave();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", size);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(size);
    observer?.observe(canvas);

    let measured = 0;
    const stop = startLoop((_now, dt) => {
      const step = Math.min(MAX_STEP_S, dt);
      water.step(step);
      measured += step;
      if (measured >= MEASURE_EVERY_S) {
        measured = 0;
        water.layout(measureLayout(canvas));
      }
      water.draw(dotPalette());
    });
    return () => {
      stop();
      observer?.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", size);
    };
  }, []);

  /* The dot tokens change with the theme: a still field is drawn again at once. */
  useEffect(() => {
    if (prefersReducedMotion()) field.current?.draw(dotPalette(), true);
  }, [room]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      tabIndex={-1}
      data-testid="signin-water"
      {...rest}
      style={{ display: "block", background: t.frame, touchAction: "none", ...style }}
    />
  );
}

export interface SignInWaterLayerProps {
  /** The dialog is closing: fade out, then call `onDone`. */
  closing?: boolean;
  onDone?: () => void;
  /** How long the fade out takes. */
  fadeOutMs?: number;
}

export function SignInWaterLayer({ closing = false, onDone, fadeOutMs = 900 }: SignInWaterLayerProps) {
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => onDone?.(), prefersReducedMotion() ? 0 : fadeOutMs);
    return () => window.clearTimeout(timer);
  }, [closing, onDone, fadeOutMs]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <SignInWaterCanvas
      data-closing={closing ? "true" : undefined}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: WATER_Z,
        pointerEvents: closing ? "none" : "auto",
        opacity: closing ? 0 : 1,
        transition: prefersReducedMotion() ? undefined : `opacity ${fadeOutMs}ms ease-out`,
      }}
    />,
    document.body,
  );
}

export default SignInWaterLayer;
