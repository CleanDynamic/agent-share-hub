// SV-03 P6: after the first page is ready, load the code of the pages a reader goes to next, while the browser is idle.
//
// Home, Builds, Drafts and Library; and the composer when signed in. Nothing when the reader asked for less data
// (`navigator.connection.saveData`). Safari has no requestIdleCallback: a 1 ms timeout stands in for it.

import { PAGE_READY_EVENT, PAGE_READY_ATTRIBUTE } from "./pageReady";
import { ROUTE_TABLE } from "./routeTable";

const ALWAYS = ["home", "gallery", "drafts", "library"] as const;
const SIGNED_IN = ["create"] as const;

type Idle = (callback: () => void) => unknown;

const whenIdle: Idle = (callback) =>
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(() => callback()) : window.setTimeout(callback, 1);

export function savingData(): boolean {
  return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
}

const asked = new Set<string>();

/** Load the chunks (once each) when the browser is idle. The composer joins them as soon as the reader is known to be signed in. */
export function loadChunksWhenIdle(signedIn: boolean): void {
  if (savingData()) return;
  whenIdle(() => {
    for (const key of [...ALWAYS, ...(signedIn ? SIGNED_IN : [])]) {
      if (asked.has(key)) continue;
      asked.add(key);
      void ROUTE_TABLE[key].load().catch(() => asked.delete(key));
    }
  });
}

let ready = false;

/** Wait for the first page-ready mark, then load the chunks. Returns the stop function. */
export function startIdleLoad(signedIn: () => boolean): () => void {
  if (typeof window === "undefined") return () => undefined;
  const run = () => {
    ready = true;
    loadChunksWhenIdle(signedIn());
  };
  if (ready || document.documentElement.hasAttribute(PAGE_READY_ATTRIBUTE)) {
    run();
    return () => undefined;
  }
  window.addEventListener(PAGE_READY_EVENT, run, { once: true });
  return () => window.removeEventListener(PAGE_READY_EVENT, run);
}

/** For tests. */
export function resetIdleLoad(): void {
  ready = false;
  asked.clear();
}
