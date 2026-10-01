/* UI-P18 — the breadcrumb's two hooks and the small context between them.

   `useBreadcrumb()` turns the current route into its trail. A page that names a
   record — a build, a profile — calls `useCrumbTitle(title)` once the record has
   loaded; until then the current crumb is a skeleton. There is no global store
   and no fetching here: the provider holds one string for as long as the frame
   is mounted, and a page clears it when it unmounts. */

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { trailFor, type Crumb } from "./breadcrumbTrail";

interface CrumbTitleState {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const CrumbTitleContext = createContext<CrumbTitleState | null>(null);

export function CrumbTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return <CrumbTitleContext.Provider value={value}>{children}</CrumbTitleContext.Provider>;
}

/** Call once the record has loaded. `null` or `undefined` means "still loading". Clears itself on unmount. */
export function useCrumbTitle(title: string | null | undefined): void {
  const ctx = useContext(CrumbTitleContext);
  const setTitle = ctx?.setTitle;
  const next = title ?? null;
  useEffect(() => {
    if (!setTitle) return;
    setTitle(next);
    return () => setTitle(null);
  }, [setTitle, next]);
}

/** The trail for the current route. */
export function useBreadcrumb(): Crumb[] {
  const { pathname } = useLocation();
  const title = useContext(CrumbTitleContext)?.title ?? null;
  return useMemo(() => trailFor(pathname, title), [pathname, title]);
}
