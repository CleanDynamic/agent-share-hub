// SV-03: the moment a page's first screen shows real content.
//
// `usePageReady("drafts", ready)` sets `data-page-ready="drafts"` on <html> and
// calls `performance.mark("page-ready:drafts")` the first time `ready` is true
// for this visit to the page. The attribute goes when the page unmounts, so the
// next page starts without one. `npm run audit:pages` waits for the attribute and
// reads the mark; the idle loader (idleLoad.ts) waits for the first one too.

import { useEffect } from "react";

export const PAGE_READY_ATTRIBUTE = "data-page-ready";
export const PAGE_READY_EVENT = "bg:page-ready";

export function markPageReady(name: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(PAGE_READY_ATTRIBUTE, name);
  try {
    performance.mark(`page-ready:${name}`);
  } catch {
    /* an engine without the User Timing API still gets the attribute */
  }
  window.dispatchEvent(new CustomEvent(PAGE_READY_EVENT, { detail: name }));
}

export function clearPageReady(name: string): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (root.getAttribute(PAGE_READY_ATTRIBUTE) === name) root.removeAttribute(PAGE_READY_ATTRIBUTE);
}

export function usePageReady(name: string, ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    markPageReady(name);
    return () => clearPageReady(name);
  }, [name, ready]);
}
