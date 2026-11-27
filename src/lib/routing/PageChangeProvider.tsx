// SV-04 P2: the page change's one transition, and `go()`. Placed once inside the router, around the routes.
//
// `go` is go.ts's three steps: the mark (beginChange), the start (warmPath, with who is asking from the stored session),
// and the address changed inside this provider's `startTransition`. Its `isPending` says whether a change is waiting. A
// change to the page already on screen with new parameters (a tab, a filter, a view) is only the address, in the same
// transition: no mark, no timer, and the old content stays until the new arrives.
//
// THE FADE (Part 3). A change to a page whose code is in runs inside `document.startViewTransition`: the browser holds a
// picture of the old page, the address changes in the transition, and the callback's promise settles when the new address
// has been committed (the layout effect below), so the new page is drawn inside the callback. index.css names the frame's
// pieces and keeps them still, and crossfades the page area over FAST. A transition already running is finished first
// (`skipTransition`). The router's own update cannot be put in `flushSync` here: with `v7_startTransition` the router
// wraps it in `startTransition` itself, so the callback waits for the commit instead, for at most FADE_WAIT_LIMIT_MS. A page
// whose code is not in, reduced motion, and a browser without view transitions change with no fade.
//
// It also listens for popstate, so Back and Forward to a page whose code is not in show its placeholder at once
// (go.ts `beginPop`), and it settles the store when the address has changed.

import { QueryClientContext } from "@tanstack/react-query";
import { useContext, useEffect, useLayoutEffect, useRef, useTransition, type ReactNode } from "react";
import { createPath, resolvePath, useLocation, useNavigate } from "react-router-dom";

import { prefersReducedMotion } from "@/lib/theme/motion";

import { isPhoneView } from "./dockScroll";
import { phoneNavKind, type PhoneNavKind } from "./phoneNav";
import { beginChange, beginPop, forcePlaceholder, isLoaded, PageChangeContext, PLACEHOLDER_AFTER_MS, settle, type Go } from "./go";
import { storedUserId } from "./useIntent";
import { warmPath } from "./warm";

/** The longest the browser holds the old page's picture while the new one commits. */
export const FADE_WAIT_LIMIT_MS = 300;

interface ViewTransitionLike {
  finished: Promise<void>;
  skipTransition: () => void;
}
type StartViewTransition = (update: () => Promise<void>) => ViewTransitionLike;

/** 29e: on a phone a change is a push or a back (index.css `data-phone-nav`); with reduced motion it is a PHONE_QUICK fade, not nothing. */
function viewTransitions(phone: boolean): StartViewTransition | null {
  if (typeof document === "undefined" || (prefersReducedMotion() && !phone)) return null;
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  return typeof start === "function" ? start.bind(document) : null;
}

let running: ViewTransitionLike | null = null;

export function PageChangeProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useContext(QueryClientContext);
  const [isPending, startTransition] = useTransition();
  /** The fades waiting for the new address to be committed. */
  const committed = useRef<(() => void)[]>([]);

  useLayoutEffect(() => {
    settle(location.pathname);
    for (const resolve of committed.current.splice(0)) resolve();
  }, [location.pathname, location.key]);

  useEffect(() => {
    const onPop = () => beginPop(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go: Go = (to, options) => {
    const target = resolvePath(to, location.pathname);
    const { pathname } = target;
    // As a Link does: the address already on screen is replaced, not pushed again.
    const replace = options?.replace ?? createPath(target) === createPath(location);
    const change = () => startTransition(() => navigate(to, { ...options, replace }));
    if (pathname === location.pathname) {
      change();
      return;
    }
    const token = beginChange(pathname);
    if (queryClient) void storedUserId().then((userId) => warmPath(pathname, queryClient, userId));
    window.setTimeout(() => forcePlaceholder(token), PLACEHOLDER_AFTER_MS);

    const phone = isPhoneView();
    const kind: PhoneNavKind | null = phone ? phoneNavKind(location.pathname, pathname) : null;
    run(isLoaded(pathname) && kind !== "none" ? viewTransitions(phone) : null, kind, change);
  };

  /** The change inside a view transition when there is one. `kind` marks the root for the phone's push and back. */
  const run = (start: StartViewTransition | null, kind: PhoneNavKind | null, change: () => void) => {
    if (!start) {
      change();
      return;
    }
    running?.skipTransition();
    const root = document.documentElement;
    if (kind && kind !== "none") root.dataset.phoneNav = kind;
    const fade = start(
      () =>
        new Promise<void>((resolve) => {
          committed.current.push(resolve);
          window.setTimeout(resolve, FADE_WAIT_LIMIT_MS);
          change();
        }),
    );
    running = fade;
    void fade.finished.catch(() => undefined).finally(() => {
      if (running === fade) {
        running = null;
        delete root.dataset.phoneNav;
      }
    });
  };

  /** The page's Back (the header's chevron): one step through the history, drawn as a back. */
  const back = () => {
    const phone = isPhoneView();
    const change = () => startTransition(() => navigate(-1));
    run(phone ? viewTransitions(true) : null, phone ? "back" : null, change);
  };

  return <PageChangeContext.Provider value={{ go, back, isPending }}>{children}</PageChangeContext.Provider>;
}

export default PageChangeProvider;
