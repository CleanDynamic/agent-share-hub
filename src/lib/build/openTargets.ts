// SV-21 P3: the sessions and parts a build's maker has opened as requests, read from `making`. Pure.

import { sessionsMetaOf, storedWorkstreamsOf } from "./making";

export interface OpenTarget {
  size: "session" | "part";
  /** The session's key in `sessions_meta`, or the part's `key`. */
  key: string;
  problem: string;
}

/** Parts first, then sessions, each in the order `making` holds them. */
export function openTargetsOf(making: unknown): OpenTarget[] {
  const parts = storedWorkstreamsOf(making).flatMap((part) => (part.open ? [{ size: "part" as const, key: part.key, problem: part.open.problem }] : []));
  const sessions = Object.entries(sessionsMetaOf(making)).flatMap(([key, meta]) => (meta.open ? [{ size: "session" as const, key, problem: meta.open.problem }] : []));
  return [...parts, ...sessions];
}
