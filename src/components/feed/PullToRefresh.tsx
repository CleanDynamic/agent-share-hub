/* Prompt 29a Part C: pull to refresh with the beaver, on the phone Home only (below 768px). It replaces the dot ring there; the
   other screens keep theirs.

   THE PARTS. A canvas over the top of the screen (full width, 320 tall, no pointer events, hidden from screen readers, above the
   top bar and the feed) where `beaverFrames.ts` draws the 16 frames; the top bar's logo <img> stays as the resting state and the
   engine fades it out as the frames fade in, and back at the end. The children (Home's tabs and feed) move down as one, so the
   pull opens space directly under the top bar.

   THE GESTURE starts only at the very top of the page with no sheet open, on a downward move. `touchmove` is non-passive and calls
   preventDefault only while a pull is in progress; the page has `overscroll-behavior-y: none` while this is mounted.

   THE DATA. Released past the arm point, `onRefresh` runs (Home refetches its feed and its count of new posts) and the engine is
   told `done()` when it settles. Failed, or longer than 10 seconds: `done()` anyway, and after the return the repo's failed toast
   with "Try again".

   WITHOUT THE FRAMES. With reduced motion on there is no canvas, the feed does not follow the finger (a pull past 150 still
   refreshes) and the logo's opacity pulses between 1 and 0.45 while refreshing. If the frames have not loaded when a pull starts,
   the feed follows the finger and the logo pulses in the same way. */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { couldntLoad, RETRY_LABEL } from "@/lib/copy/copy";
import { ring } from "@/lib/theme/controls";
import { BASE, prefersReducedMotion } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { ARM, makeBeaver, pullOffset, T_BACK, type Beaver } from "./beaverFrames";
import { hapticLight, hapticSuccess } from "./haptics";

/** The 16-frame atlas the owner supplies (4 x 4 cells of 384 x 345). */
export const ATLAS_SRC = "/brand/beaver-frames.webp";
/** With reduced motion, a pull this long still refreshes. */
export const REDUCED_ARM = 150;
/** A refresh that takes longer than this is let go. */
export const REFRESH_TIMEOUT = 10_000;
/** The canvas's height over the top of the screen. */
export const CANVAS_HEIGHT = 320;
/** The frame where the head breaks the surface (frame 13, index 12): the success haptic. */
const SURFACE_FRAME = 12;
/** The logo's pulse while refreshing without the frames: 1 to 0.45 and back. */
const PULSE_MS = BASE * 6;

export const PTR_COPY = { refreshing: "Refreshing", refresh: "Refresh" } as const;

/** Where the top bar's logo is: the resting state the frames grow out of. */
const LOGO_SELECTOR = "[data-phone-logo] img";
const BAR_SELECTOR = "[data-testid='phone-top-bar']";

export interface PullToRefreshProps {
  /** Refetch; resolves with the count of new posts. A rejection is the failed path. */
  onRefresh: () => Promise<number>;
  /** What the live region says when the refresh ends, from that count. */
  doneLine: (count: number) => string;
  /** A sheet is open: no pull. */
  disabled?: boolean;
  children: ReactNode;
}

type Track = { x0: number; y0: number; dy: number; pulling: boolean; armed: boolean };
type Kind = "engine" | "follow" | "still";

const eOut = (x: number): number => 1 - Math.pow(1 - x, 3);
const atTop = (): boolean => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
const sheetOpen = (): boolean => document.querySelector("[role='dialog']") !== null;

export function PullToRefresh({ onRefresh, doneLine, disabled = false, children }: PullToRefreshProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [live, setLive] = useState("");
  const content = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const atlas = useRef<HTMLImageElement | null>(null);

  // The latest props, read from the listeners attached once.
  const latest = useRef({ onRefresh, doneLine, disabled });
  latest.current = { onRefresh, doneLine, disabled };

  /** Set by the effect: the Refresh button's (and Try again's) way in. */
  const refreshNow = useRef<() => void>(() => undefined);

  /* The atlas, after the first paint, in an idle callback. */
  useEffect(() => {
    if (reduced) return;
    const idle = (cb: () => void): number => (typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(cb, { timeout: 2000 }) : window.setTimeout(cb, 1));
    const cancel = (id: number) => (typeof window.cancelIdleCallback === "function" ? window.cancelIdleCallback(id) : window.clearTimeout(id));
    const id = idle(() => {
      const image = new Image();
      image.onload = () => {
        atlas.current = image;
      };
      image.src = ATLAS_SRC;
    });
    return () => cancel(id);
  }, [reduced]);

  /* The page does not bounce while Home is shown: the pull is the only thing a drag at the top does. */
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const was = [root.style.overscrollBehaviorY, body.style.overscrollBehaviorY];
    root.style.overscrollBehaviorY = "none";
    body.style.overscrollBehaviorY = "none";
    return () => {
      root.style.overscrollBehaviorY = was[0];
      body.style.overscrollBehaviorY = was[1];
    };
  }, []);

  useEffect(() => {
    let track: Track | null = null;
    let kind: Kind = "still";
    let engine: Beaver | null = null;
    let busy = false;
    let failed = false;
    let surfaced = false;
    let tween = 0;
    let pulse: Animation | null = null;

    const logo = () => document.querySelector<HTMLImageElement>(LOGO_SELECTOR);
    const setOffset = (px: number) => {
      const node = content.current;
      if (node) node.style.transform = px > 0 ? `translate3d(0, ${px}px, 0)` : "";
    };

    const startPulse = () => {
      const img = logo();
      if (!img || typeof img.animate !== "function") return;
      pulse = img.animate([{ opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], { duration: PULSE_MS, iterations: Infinity });
    };
    const stopPulse = () => {
      pulse?.cancel();
      pulse = null;
    };

    const showFailed = () => {
      toast.error(couldntLoad("the feed"), { action: { label: RETRY_LABEL, onClick: () => refreshNow.current() } });
    };

    /** The refetch, with the 10 second limit. True when it settled well. */
    const refetch = async (): Promise<boolean> => {
      setLive(PTR_COPY.refreshing);
      let timer = 0;
      try {
        const count = await Promise.race([
          latest.current.onRefresh(),
          new Promise<never>((_, reject) => {
            timer = window.setTimeout(() => reject(new Error("refresh timed out")), REFRESH_TIMEOUT);
          }),
        ]);
        setLive(latest.current.doneLine(count));
        return true;
      } catch {
        setLive("");
        return false;
      } finally {
        window.clearTimeout(timer);
      }
    };

    /** Without the frames: the logo pulses while the refetch runs. */
    const pulseRefresh = () => {
      if (busy) return;
      busy = true;
      startPulse();
      void refetch().then((ok) => {
        stopPulse();
        busy = false;
        if (!ok) showFailed();
      });
    };
    refreshNow.current = pulseRefresh;

    /** The feed back to 0 over 200ms, ease-out (the frameless pull). */
    const settle = (from: number, then?: () => void) => {
      const start = performance.now();
      const step = (now: number) => {
        const x = Math.min(1, (now - start) / (T_BACK * 1000));
        setOffset(from * (1 - eOut(x)));
        if (x < 1) tween = requestAnimationFrame(step);
        else {
          tween = 0;
          then?.();
        }
      };
      tween = requestAnimationFrame(step);
    };

    const begin = () => {
      surfaced = false;
      const img = logo();
      const cv = canvas.current;
      const bar = document.querySelector(BAR_SELECTOR);
      if (prefersReducedMotion()) {
        kind = "still";
        return;
      }
      if (!img || !cv || !atlas.current || !bar) {
        kind = "follow";
        return;
      }
      kind = "engine";
      const box = img.getBoundingClientRect();
      const geo = { cx: box.left + box.width / 2, cy: box.top + box.height / 2, w: box.width, barBottom: bar.getBoundingClientRect().bottom, width: window.innerWidth, height: CANVAS_HEIGHT };
      engine = makeBeaver(cv, img, atlas.current, geo, {
        offset: setOffset,
        frame: (index) => {
          if (busy && !surfaced && index >= SURFACE_FRAME && engine?.state().mode === "rise") {
            surfaced = true;
            hapticSuccess();
          }
        },
        rest: () => {
          engine = null;
          if (busy) {
            busy = false;
            if (failed) showFailed();
          }
        },
      });
    };

    const drive = (dy: number) => {
      if (track && !track.armed && pullOffset(dy) >= ARM && kind !== "still") {
        track.armed = true;
        hapticLight();
      }
      if (track && !track.armed && kind === "still" && dy >= REDUCED_ARM) {
        track.armed = true;
        hapticLight();
      }
      if (kind === "engine") engine?.pull(dy);
      else if (kind === "follow") setOffset(pullOffset(dy));
    };

    const finish = (dy: number) => {
      if (kind === "engine" && engine) {
        const armed = engine.release();
        if (!armed) return;
        busy = true;
        failed = false;
        const run = engine;
        void refetch().then((ok) => {
          failed = !ok;
          run.done();
        });
        return;
      }
      if (kind === "follow") {
        const armed = pullOffset(dy) >= ARM;
        settle(pullOffset(dy));
        if (armed) pulseRefresh();
        return;
      }
      if (dy >= REDUCED_ARM) pulseRefresh();
    };

    const onStart = (event: TouchEvent) => {
      track = null;
      if (event.touches.length !== 1 || latest.current.disabled || busy || engine || tween || !atTop() || sheetOpen()) return;
      const touch = event.touches[0];
      track = { x0: touch.clientX, y0: touch.clientY, dy: 0, pulling: false, armed: false };
    };
    const onMove = (event: TouchEvent) => {
      if (!track) return;
      const touch = event.touches[0];
      if (!touch) return;
      const dy = touch.clientY - track.y0;
      const dx = touch.clientX - track.x0;
      if (!track.pulling) {
        if (dy > 0 && Math.abs(dy) > Math.abs(dx) && atTop()) {
          track.pulling = true;
          begin();
        } else if (dy < 0 || Math.abs(dx) > Math.abs(dy)) {
          track = null;
          return;
        } else return;
      }
      event.preventDefault();
      track.dy = dy;
      drive(dy);
    };
    const onEnd = () => {
      const was = track;
      track = null;
      if (was?.pulling) finish(was.dy);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
      engine?.destroy();
      if (tween) cancelAnimationFrame(tween);
      stopPulse();
      setOffset(0);
    };
  }, []);

  return (
    <>
      {reduced ? null : (
        <canvas
          ref={canvas}
          aria-hidden="true"
          data-testid="ptr-canvas"
          style={{ position: "fixed", top: 0, left: 0, width: "100%", height: CANVAS_HEIGHT, pointerEvents: "none", zIndex: 21 }}
        />
      )}
      <span className="sr-only" aria-live="polite" data-testid="ptr-live">
        {live}
      </span>
      <div ref={content} data-testid="ptr-content">
        <RefreshButton onPress={() => refreshNow.current()} />
        {children}
      </div>
    </>
  );
}

/** "Refresh", for keyboard and screen reader users: first in the feed, visually hidden until focused. */
function RefreshButton({ onPress }: { onPress: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <button
      type="button"
      data-testid="ptr-refresh"
      className={focused ? undefined : "sr-only"}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={onPress}
      style={
        focused
          ? { display: "block", minHeight: 44, margin: "8px 16px", padding: "0 16px", border: 0, borderRadius: r.full, background: t.inverse, color: t.onInverse, fontFamily: FIGTREE, fontSize: 15, fontWeight: 500, lineHeight: "20px", cursor: "pointer", ...ring(true) }
          : undefined
      }
    >
      {PTR_COPY.refresh}
    </button>
  );
}

export default PullToRefresh;
