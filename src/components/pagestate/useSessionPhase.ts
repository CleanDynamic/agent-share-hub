import { useSyncExternalStore } from "react";

import { sessionPhase, subscribeSession, type SessionPhase } from "@/lib/query/sessionSignal";

/**
 * G18: the session's phase, and a redraw when it moves. PageState reads it; so does a container that decides the page-level
 * failed state with allFailed, which holds while the session is in question.
 */
export function useSessionPhase(): SessionPhase {
  return useSyncExternalStore(subscribeSession, sessionPhase, sessionPhase);
}
