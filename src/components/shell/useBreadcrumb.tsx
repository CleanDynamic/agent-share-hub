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
  /** UX-09 P6: the crumb between the section and the page (a topic's first space). */
  parent: Crumb | null;
  setTitle: (title: string | null, parent?: Crumb | null) => void;
}

const CrumbTitleContext = createContext<CrumbTitleState | null>(null);

export function CrumbTitleProvider({ children }: { children: ReactNode }) {
  const [named, setNamed] = useState<{ title: string | null; parent: Crumb | null }>({ title: null, parent: null });
  // One setter for the provider's life, as the bare state setter was: a page's effect depends on it.
  const [setTitle] = useState(() => (title: string | null, parent: Crumb | null = null) => setNamed({ title, parent }));
  const value = useMemo(() => ({ ...named, setTitle }), [named, setTitle]);
  return <CrumbTitleContext.Provider value={value}>{children}</CrumbTitleContext.Provider>;
}

/** Call once the record has loaded. `null` or `undefined` means "still loading". Clears itself on unmount. `parent` (UX-09 P6) is
    the crumb between the section and the page, when the page has one. */
export function useCrumbTitle(title: string | null | undefined, parent?: Crumb | null): void {
  const ctx = useContext(CrumbTitleContext);
  const setTitle = ctx?.setTitle;
  const next = title ?? null;
  const parentLabel = parent?.label ?? null;
  const parentHref = parent?.href;
  useEffect(() => {
    if (!setTitle) return;
    setTitle(next, parentLabel !== null ? { label: parentLabel, href: parentHref } : null);
    return () => setTitle(null);
  }, [setTitle, next, parentLabel, parentHref]);
}

/** The trail for the current route. */
export function useBreadcrumb(): Crumb[] {
  const { pathname } = useLocation();
  const ctx = useContext(CrumbTitleContext);
  const title = ctx?.title ?? null;
  const parent = ctx?.parent ?? null;
  return useMemo(() => trailFor(pathname, title, parent), [pathname, title, parent]);
}
