// SV-04 P2: one way to change page.
//
// `go(to)` (from `useGo()`, or a `PageLink`) does three things:
//   1. marks the target as current at once (`useCurrentPath`), so the nav item the reader pressed shows as current in the
//      next frame, before the page has changed;
//   2. starts the page: its chunk and its first-screen reads, through the route table (`warmPath`), which a hover may
//      already have started;
//   3. changes the address inside the one transition of `PageChangeProvider`, so the old page stays on screen while the
//      new one's code loads (React keeps a boundary that is showing content during a transition).
// Whether it is waiting is that transition's `isPending` (`usePageChange`); the progress line reads it. Past
// PLACEHOLDER_AFTER_MS of waiting, the new page's placeholder takes the page area (`useForcedPlaceholder`).
//
// IT DOES NOT WAIT FOR DATA. SV-04 Part 2 builds that only for the tour steps Part 1 left failing, and none failed for data
// that waiting up to 800 ms would have brought (sv-04-after.md). A page whose reads are not in yet shows its own loading
// state, which is the route's Placeholder.
//
// BACK AND FORWARD DON'T WAIT. The router runs them as a transition too, which would hold the old page while the code of
// the one being returned to loads. So a popstate to a page whose chunk has not loaded shows that page's placeholder at
// once (PageChangeProvider listens), and a page already loaded changes in the same frame.
//
// The last call wins: a second `go` takes the mark, and the first one's timer finds itself stale.

import { createContext, useContext, useSyncExternalStore } from "react";
import { useLocation, type NavigateOptions, type To } from "react-router-dom";

import { matchRoute } from "./routeTable";

/** The progress line shows once a change has waited this long. */
export const SHOW_LINE_AFTER_MS = 300;
/** The new page's placeholder takes the page area once a change has waited this long. */
export const PLACEHOLDER_AFTER_MS = 800;

interface State {
  /** The pathname a change is on its way to, or null. */
  pending: string | null;
  /** The pathname whose placeholder takes the page area, or null. */
  forced: string | null;
  token: number;
}

let state: State = { pending: null, forced: null, token: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<State>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/* ── which pages' code is in ─────────────────────────────────────────────── */

const loaded = new Set<string>();

/** Load a route table entry's chunk, and remember that it came. */
export function loadEntry(key: string, load: () => Promise<unknown>): Promise<unknown> {
  return load().then((module) => {
    loaded.add(key);
    return module;
  });
}

export function isLoaded(pathname: string): boolean {
  const match = matchRoute(pathname);
  return match === null || loaded.has(match.entry.key);
}

/* ── the store's moves ───────────────────────────────────────────────────── */

/** A change to `pathname` starts: it is current now. Returns the change's token. */
export function beginChange(pathname: string): number {
  const token = state.token + 1;
  set({ pending: pathname, forced: null, token });
  return token;
}

/** Waited too long: the new page's placeholder takes the page area, if this change is still the one on its way. */
export function forcePlaceholder(token: number): void {
  if (state.token === token && state.pending !== null) set({ forced: state.pending });
}

/** Back or Forward to `pathname`: current at once, and its placeholder now if its code is not in. */
export function beginPop(pathname: string): void {
  const token = beginChange(pathname);
  if (!isLoaded(pathname)) forcePlaceholder(token);
}

/** The address has changed to `pathname`: whatever was on its way there has arrived. */
export function settle(pathname: string): void {
  if (state.pending === null && state.forced === null) return;
  if (state.pending === pathname || state.forced === pathname) set({ pending: null, forced: null });
}

/** For tests. */
export function resetGo(): void {
  state = { pending: null, forced: null, token: 0 };
  loaded.clear();
  for (const listener of listeners) listener();
}

/* ── reading it ──────────────────────────────────────────────────────────── */

/** The pathname a change is on its way to, or null. */
export function usePendingPath(): string | null {
  return useSyncExternalStore(subscribe, () => state.pending, () => null);
}

/** The pathname whose placeholder takes the page area, or null. */
export function useForcedPlaceholder(): string | null {
  return useSyncExternalStore(subscribe, () => state.forced, () => null);
}

/** The page that is current for the nav: the one a change is on its way to, else the one the address names. */
export function useCurrentPath(): string {
  const { pathname } = useLocation();
  return usePendingPath() ?? pathname;
}

/* ── changing page ───────────────────────────────────────────────────────── */

export type Go = (to: To, options?: NavigateOptions) => void;

export interface PageChange {
  go: Go;
  /** The one transition is waiting: the new page's code (or a heavy first render) is not in yet. */
  isPending: boolean;
}

export const PageChangeContext = createContext<PageChange | null>(null);

/** The frame's page change; null outside PageChangeProvider (a view drawn on its own, a test). */
export function usePageChange(): PageChange | null {
  return useContext(PageChangeContext);
}

/** `go(to)`. Outside PageChangeProvider it is null, and a link stays a plain link. */
export function useGo(): Go | null {
  return usePageChange()?.go ?? null;
}
