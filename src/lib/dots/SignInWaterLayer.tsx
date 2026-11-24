/* Synth 13 Part B: the water behind the sign-in dialog, as a layer. Used only by the sign-in host.

   A canvas over the whole viewport, in place of the dim scrim: above the dialog's overlay and below the dialog. The
   pointer listeners are on the canvas itself (Radix leaves the page under a modal without pointer events; the canvas
   takes them back), so the dialog above it stays fully interactive. One loop at 30 frames a second, paused while the tab
   is hidden. Under reduced motion it draws one still frame and listens to nothing.

   CLOSING. When the dialog closes the layer fades out over the scrim's 900ms and then says it is done. */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useRoom } from "@/components/brand/useRoom";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { startLoop } from "./engine";
import { FRAME_S, SignInWater, STILL_T } from "./signinWater";

/** Between the dialog's overlay (50) and the dialog (52). */
export const WATER_Z = 51;

export interface SignInWaterLayerProps {
  /** The dialog is closing: fade out, then call `onDone`. */
  closing?: boolean;
  onDone?: () => void;
  /** How long the fade out takes. */
  fadeOutMs?: number;
}

export function SignInWaterLayer({ closing = false, onDone, fadeOutMs = 900 }: SignInWaterLayerProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const water = useRef<SignInWater | null>(null);
  const room = useRoom();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const field = new SignInWater(canvas);
    water.current = field;
    const reduced = prefersReducedMotion();
    const size = () => field.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
    size();
    const clock = () => performance.now() / 1000;

    if (reduced) {
      field.draw(STILL_T);
      const onResize = () => {
        size();
        field.draw(STILL_T);
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const point = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect();
      return [event.clientX - box.left, event.clientY - box.top] as const;
    };
    const onMove = (event: PointerEvent) => {
      const [x, y] = point(event);
      field.move(x, y, clock());
    };
    const onDown = (event: PointerEvent) => {
      const [x, y] = point(event);
      field.splash(x, y, clock());
    };
    const onLeave = () => field.leave();
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", size);

    let drawn = -Infinity;
    const stop = startLoop(() => {
      const now = clock();
      if (now - drawn < FRAME_S) return;
      drawn = now;
      field.draw(now);
    });
    return () => {
      stop();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", size);
    };
  }, []);

  /* The dot tokens change with the theme: draw once at once so a still field follows it too. */
  useEffect(() => {
    if (prefersReducedMotion()) water.current?.draw(STILL_T);
  }, [room]);

  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => onDone?.(), prefersReducedMotion() ? 0 : fadeOutMs);
    return () => window.clearTimeout(timer);
  }, [closing, onDone, fadeOutMs]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <canvas
      ref={ref}
      aria-hidden="true"
      tabIndex={-1}
      data-testid="signin-water"
      data-closing={closing ? "true" : undefined}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: WATER_Z,
        display: "block",
        background: t.frame,
        pointerEvents: closing ? "none" : "auto",
        touchAction: "none",
        opacity: closing ? 0 : 1,
        transition: prefersReducedMotion() ? undefined : `opacity ${fadeOutMs}ms ease-out`,
      }}
    />,
    document.body,
  );
}

export default SignInWaterLayer;
