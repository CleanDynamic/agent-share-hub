// UX-15 P3: one request from a form, as the four states it has: idle, sending, sent, error.
//
// `run` calls the function; a thrown `SettingsError` shows its own sentence, anything else shows `FALLBACK` and is reported (identifiers
// only, through `reportError`). A second `run` while one is sending is ignored.

import { useCallback, useRef, useState } from "react";

import { reportError } from "@/lib/errors/report";

export const FALLBACK = "Something went wrong. Try again.";

/** An error whose message is meant for the person. */
export class SettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettingsError";
  }
}

export type ActionState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent" }
  | { status: "error"; message: string };

export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<void>, source = "settings") {
  const [state, setState] = useState<ActionState>({ status: "idle" });
  const busy = useRef(false);
  const run = useCallback(
    async (...args: A): Promise<boolean> => {
      if (busy.current) return false;
      busy.current = true;
      setState({ status: "sending" });
      try {
        await fn(...args);
        setState({ status: "sent" });
        return true;
      } catch (error) {
        if (error instanceof SettingsError) setState({ status: "error", message: error.message });
        else {
          reportError(error, { source, context: "settings" });
          setState({ status: "error", message: FALLBACK });
        }
        return false;
      } finally {
        busy.current = false;
      }
    },
    [fn, source],
  );
  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, run, reset };
}
