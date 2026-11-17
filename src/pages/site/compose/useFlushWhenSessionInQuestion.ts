/* G22: what is still waiting to be written goes now, the moment the session is in question (the server refused a request and
   the listener is checking, or it has ended), so it is in the write guard's line, kept under the pending key, before the
   editor says anything about it. The guard holds it there until the member is signed in again (lib/build/writeGuard.ts). */

import { useEffect, useRef } from "react";

import { useSessionPhase } from "@/components/pagestate/useSessionPhase";

export function useFlushWhenSessionInQuestion(flush: () => void): void {
  const phase = useSessionPhase();
  const latest = useRef(flush);
  latest.current = flush;
  const inQuestion = phase !== "live";
  useEffect(() => {
    if (inQuestion) latest.current();
  }, [inQuestion]);
}
