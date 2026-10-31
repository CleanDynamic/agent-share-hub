// SV-26 P2: a window that draws nothing until something opens it is loaded the first time it opens, or at idle after the
// first page is ready, whichever comes first. The provider keeps the context and its API; the window's code arrives apart.

import { useEffect, useState } from "react";
import { savingData } from "./idleLoad";

type Idle = (callback: () => void) => unknown;

const whenIdle: Idle = (callback) =>
  typeof window !== "undefined" && typeof window.requestIdleCallback === "function"
    ? window.requestIdleCallback(() => callback(), { timeout: 4000 })
    : window.setTimeout(callback, 1);

/** True from the first time `open` is true, and after: a window that was opened stays mounted so it can close with its own motion. */
export function useEverOpened(open: boolean): boolean {
  const [ever, setEver] = useState(open);
  if (open && !ever) setEver(true);
  return ever;
}

/** Fetch a window's code when the browser is idle, once. Nothing when the reader asked for less data. */
export function useLoadAtIdle(loader: () => Promise<unknown>): void {
  useEffect(() => {
    if (savingData()) return;
    let stopped = false;
    whenIdle(() => {
      if (!stopped) void loader().catch(() => undefined);
    });
    return () => {
      stopped = true;
    };
    // The loader is a module-level function, stable for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** False until the browser is idle after first render, then true for good. For a listener that draws nothing at first. */
export function useIdleReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false;
    whenIdle(() => {
      if (!stopped) setReady(true);
    });
    return () => {
      stopped = true;
    };
  }, []);
  return ready;
}
