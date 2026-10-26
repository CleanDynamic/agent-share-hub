// SV-04 P2: the page change's one transition, and `go()`. Placed once inside the router, around the routes.
//
// `go` is go.ts's three steps: the mark (beginChange), the start (warmPath, with who is asking from the stored session),
// and the address changed inside this provider's `startTransition`. Its `isPending` says whether a change is waiting. A
// change to the page already on screen with new parameters (a tab, a filter, a view) is only the address, in the same
// transition: no mark, no timer, and the old content stays until the new arrives.
//
// It also listens for popstate, so Back and Forward to a page whose code is not in show its placeholder at once
// (go.ts `beginPop`), and it settles the store when the address has changed.

import { QueryClientContext } from "@tanstack/react-query";
import { useContext, useEffect, useLayoutEffect, useTransition, type ReactNode } from "react";
import { createPath, resolvePath, useLocation, useNavigate } from "react-router-dom";

import { beginChange, beginPop, forcePlaceholder, PageChangeContext, PLACEHOLDER_AFTER_MS, settle, type Go } from "./go";
import { storedUserId } from "./useIntent";
import { warmPath } from "./warm";

export function PageChangeProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useContext(QueryClientContext);
  const [isPending, startTransition] = useTransition();

  useLayoutEffect(() => {
    settle(location.pathname);
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
    if (pathname !== location.pathname) {
      const token = beginChange(pathname);
      if (queryClient) void storedUserId().then((userId) => warmPath(pathname, queryClient, userId));
      window.setTimeout(() => forcePlaceholder(token), PLACEHOLDER_AFTER_MS);
    }
    startTransition(() => navigate(to, { ...options, replace }));
  };

  return <PageChangeContext.Provider value={{ go, isPending }}>{children}</PageChangeContext.Provider>;
}

export default PageChangeProvider;
