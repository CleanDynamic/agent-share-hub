// 29e: swipe back from the left edge, on a pushed page, on a phone. Drives the page's `data-ui="surface"` and the header with
// the finger (transform only), and on release completes or returns it (phoneEdgeSwipe.ts). Completing goes back through the
// history with no view transition (the page is already off the screen); the transform is cleared in a layout effect when the
// address has changed, so the new page is never drawn off to the right. The page underneath is not kept mounted, so it
// appears as the pushed page leaves rather than moving in from -30%. Renders nothing.

import { startTransition, useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { dockSectionOf } from "@/lib/routing/dockScroll";
import { installReadingAnchor } from "@/lib/routing/readingAnchor";
import { PHONE_EASE, PHONE_QUICK, prefersReducedMotion } from "@/lib/theme/motion";

import { EDGE_PX, edgeSwipeEnabled, swipeEnd } from "./phoneEdgeSwipe";
import { useIsPhone } from "./useMinWidth";

const pieces = (): HTMLElement[] =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-ui="surface"], [data-slot="mobile-header"]'));

/** What each piece had inline before the gesture touched it (the header's own bar transform), put back by `clear`. */
const own = new WeakMap<HTMLElement, { transform: string; transition: string; opacity: string }>();
const remember = (el: HTMLElement) => {
  if (!own.has(el)) own.set(el, { transform: el.style.transform, transition: el.style.transition, opacity: el.style.opacity });
};

function setX(x: number, transition: string): void {
  for (const el of pieces()) {
    remember(el);
    el.style.transition = transition;
    el.style.transform = x ? `translateX(${x}px)` : "";
  }
}

function clear(): void {
  for (const el of pieces()) {
    const was = own.get(el);
    el.style.transition = was?.transition ?? "";
    el.style.transform = was?.transform ?? "";
    el.style.opacity = was?.opacity ?? "";
    own.delete(el);
  }
}

export function PhoneEdgeSwipe() {
  const phone = useIsPhone();
  const { pathname, key } = useLocation();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (!phone || dockSectionOf(pathname) !== null || !edgeSwipeEnabled()) return;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx <= 0) return;

    let mode: "idle" | "pending" | "drag" | "done" = "idle";
    let x0 = 0;
    let y0 = 0;
    let dx = 0;
    let last = { x: 0, t: 0 };
    let velocity = 0;
    const timers: number[] = [];
    const later = (run: () => void, ms: number) => timers.push(window.setTimeout(run, ms));

    const onStart = (event: TouchEvent) => {
      if (mode === "done" || event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > EDGE_PX || document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      mode = "pending";
      x0 = touch.clientX;
      y0 = touch.clientY;
      dx = 0;
      velocity = 0;
      last = { x: touch.clientX, t: event.timeStamp };
    };
    const onMove = (event: TouchEvent) => {
      if (mode !== "pending" && mode !== "drag") return;
      const touch = event.touches[0];
      const moveX = touch.clientX - x0;
      const moveY = touch.clientY - y0;
      if (mode === "pending") {
        if (Math.abs(moveY) > 8 && Math.abs(moveY) > Math.abs(moveX)) {
          mode = "idle";
          return;
        }
        if (moveX < 10) return;
        mode = "drag";
      }
      event.preventDefault();
      dx = Math.max(0, moveX);
      const dt = event.timeStamp - last.t;
      if (dt > 0) velocity = (touch.clientX - last.x) / dt;
      last = { x: touch.clientX, t: event.timeStamp };
      setX(dx, "none");
    };
    const onEnd = () => {
      if (mode === "pending") mode = "idle";
      if (mode !== "drag") return;
      const width = window.innerWidth;
      const end = swipeEnd(dx, velocity, width);
      if (!end.back) {
        mode = "idle";
        setX(0, `transform ${end.ms}ms ${PHONE_EASE}`);
        later(clear, end.ms + 40);
        return;
      }
      mode = "done";
      const finish = () => startTransition(() => navigate(-1));
      if (prefersReducedMotion()) {
        for (const el of pieces()) {
          remember(el);
          el.style.transition = `opacity ${PHONE_QUICK}ms ${PHONE_EASE}`;
          el.style.transform = "";
          el.style.opacity = "0";
        }
        later(finish, PHONE_QUICK);
      } else {
        setX(width, `transform ${end.ms}ms ${PHONE_EASE}`);
        later(finish, end.ms);
      }
      // If the address never changes, do not leave a blank screen.
      later(clear, 2000);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      for (const timer of timers) window.clearTimeout(timer);
      clear();
    };
  }, [phone, pathname, key, navigate]);

  return null;
}

export default PhoneEdgeSwipe;

/** 29e: keeps the post being read in place when posts are inserted above it. Renders nothing. */
export function PhoneReadingAnchor() {
  const phone = useIsPhone();
  useEffect(() => {
    const main = document.getElementById("main");
    if (!phone || !main) return;
    return installReadingAnchor(main);
  }, [phone]);
  return null;
}
