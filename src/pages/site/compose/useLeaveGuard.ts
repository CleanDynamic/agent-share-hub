/* CA-23 P3: leaving the composer while writes are still waiting.

   INSIDE THE SITE. The app's router is a `BrowserRouter`, which has no blocker (`useBlocker` needs a data router and throws
   without one), so in-app navigation is intercepted in this one place:
   - a link, the breadcrumb or any `navigate()` goes through the router's `navigator.push` / `replace`, which are wrapped while
     writes are pending;
   - the browser's Back and Forward are a `popstate` the history library hears after the address has already changed; it is
     heard first here (capture), held back from the router, and the address is put back with `history.go(-delta)`, as React
     Router's own blocker does. Leave replays it.
   A move that stays in the composer (the draft's address changing from /compose/new to /compose/{id}, the tab in the query)
   is never stopped.

   If the writes finish while the question is open, it closes itself and the move goes ahead.

   CLOSING OR RELOADING THE TAB uses `beforeunload` with `preventDefault()`, for as long as the count is above 0 and no longer. */

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UNSAFE_NavigationContext, useLocation, type To } from "react-router-dom";

export interface LeaveGuard {
  /** The question is open. */
  open: boolean;
  /** How many changes are still waiting, live. */
  count: number;
  stay: () => void;
  leave: () => void;
}

const pathOf = (to: To): string => (typeof to === "string" ? to : (to.pathname ?? "")).split(/[?#]/)[0];
const inComposer = (path: string): boolean => path === "/compose" || path.startsWith("/compose/");
const indexOf = (state: unknown): number | null => {
  const idx = state && typeof state === "object" ? (state as { idx?: unknown }).idx : null;
  return typeof idx === "number" ? idx : null;
};

export function useLeaveGuard(pending: number): LeaveGuard {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const location = useLocation();
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const hereRef = useRef(location.pathname);
  hereRef.current = location.pathname;
  const [asked, setAsked] = useState<{ proceed: () => void } | null>(null);

  /* ── a link, the breadcrumb, navigate() ── */
  useEffect(() => {
    const push = navigator.push.bind(navigator);
    const replace = navigator.replace.bind(navigator);
    const held = (to: To): boolean => {
      if (pendingRef.current === 0) return false;
      const there = pathOf(to);
      return there !== "" && there !== hereRef.current && !(inComposer(there) && inComposer(hereRef.current));
    };
    navigator.push = (to, state, options) => {
      if (!held(to)) return push(to, state, options);
      setAsked({ proceed: () => push(to, state, options) });
    };
    navigator.replace = (to, state, options) => {
      if (!held(to)) return replace(to, state, options);
      setAsked({ proceed: () => replace(to, state, options) });
    };
    return () => {
      navigator.push = push;
      navigator.replace = replace;
    };
  }, [navigator]);

  /* ── the browser's Back and Forward ── */
  const lastIndex = useRef<number | null>(indexOf(typeof window === "undefined" ? null : window.history.state));
  useEffect(() => {
    lastIndex.current = indexOf(window.history.state);
  }, [location]);
  useEffect(() => {
    let reverting = false;
    let allow = false;
    const onPop = (event: PopStateEvent) => {
      if (reverting) {
        reverting = false;
        event.stopImmediatePropagation();
        return;
      }
      if (allow) {
        allow = false;
        return;
      }
      const next = indexOf(event.state);
      const delta = next !== null && lastIndex.current !== null ? next - lastIndex.current : null;
      if (pendingRef.current === 0 || delta === null || delta === 0) return;
      event.stopImmediatePropagation();
      reverting = true;
      window.history.go(-delta);
      setAsked({
        proceed: () => {
          allow = true;
          window.history.go(delta);
        },
      });
    };
    window.addEventListener("popstate", onPop, true);
    return () => window.removeEventListener("popstate", onPop, true);
  }, []);

  /* ── closing or reloading the tab ── */
  useEffect(() => {
    if (pending === 0) return;
    const onUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers want a value; none of them show it.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [pending > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const stay = useCallback(() => setAsked(null), []);
  const leave = useCallback(() => {
    const go = asked;
    setAsked(null);
    go?.proceed();
  }, [asked]);

  // The writes landed while the question was open: it goes, and the move goes ahead.
  useEffect(() => {
    if (asked && pending === 0) {
      const go = asked;
      setAsked(null);
      go.proceed();
    }
  }, [asked, pending]);

  return { open: asked !== null, count: pending, stay, leave };
}
