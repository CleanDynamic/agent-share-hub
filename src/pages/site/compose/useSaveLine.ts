/* CA-23 P1: what the status line needs besides the save state's words.

   `useShownSave` holds `saving…` back until a write has been in flight for 300 ms, so a quick save never flickers: the line
   keeps saying what it said until then, and a save that lands sooner is never shown. `useMinuteNow` is the one timer every
   status line shares: once a minute it moves "saved 2 min ago" on. */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { SAVING_SHOWN_AFTER_MS, type SaveState } from "./composeModel";

/** The state to draw: `saving` only once it has lasted `delay`; until then what the line said before it. */
export function useShownSave(save: SaveState, delay: number = SAVING_SHOWN_AFTER_MS): SaveState {
  const [late, setLate] = useState(false);
  const calm = useRef<SaveState>(save === "saving" ? "idle" : save);
  if (save !== "saving") calm.current = save;
  useEffect(() => {
    if (save !== "saving") {
      setLate(false);
      return;
    }
    const timer = window.setTimeout(() => setLate(true), delay);
    return () => window.clearTimeout(timer);
  }, [save, delay]);
  return save === "saving" ? (late ? "saving" : calm.current) : save;
}

const MINUTE_MS = 60_000;
const listeners = new Set<() => void>();
let timer: number | null = null;
let now = Date.now();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      for (const each of [...listeners]) each();
    }, MINUTE_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };
}

/** The time, moved on once a minute by one timer for every line that asks. */
export function useMinuteNow(): number {
  return useSyncExternalStore(subscribe, () => now, () => Date.now());
}
