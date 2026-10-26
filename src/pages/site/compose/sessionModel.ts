// SV-07 P2: the draft's sessions as the page draws them, from the click to the saved row. The stored `making` is the model; the
// session on its way (`arriving`) is laid over it during render, never copied into other state. Pure.
//
// An import into a draft whose only session is the empty Session 1 takes that session's place (`addSessionToBuild` deletes it
// and puts the import where it stood). From the click, the page draws it that way: the empty Session 1 is left out, so it is
// never drawn beside the import and the import is never numbered after it.

import { isTypedSession, sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";
import { workstreamKeyOf } from "@/lib/build/workstreams";

/** What the model needs of the session on its way. */
export interface ArrivingEntry {
  key: string;
  kind: "chat" | "empty";
  /** The part it joins; none: the last. */
  part?: string;
  status: "writing" | "written" | "failed";
}

/**
 * The empty Session 1 an arriving chat replaces, decided as `emptyFirstSession` decides it: the draft's first session, made
 * here, with no app and no tile, in the part the chat joins. Null when there is none, or nothing is arriving.
 */
export function replacedBy(making: unknown, order: readonly string[], hasTiles: (key: string) => boolean, arriving: ArrivingEntry | null): string | null {
  if (!arriving || arriving.kind !== "chat" || arriving.status === "failed") return null;
  const meta = sessionsMetaOf(making);
  // A new draft's Session 1 may be in `sessions_meta` before it is in any order.
  const first = order[0] ?? Object.keys(meta).find((key) => isTypedSession(key) && Boolean(meta[key].date));
  if (!first || first === arriving.key || !isTypedSession(first) || meta[first]?.tool || hasTiles(first)) return null;
  if (arriving.part && workstreamKeyOf(meta[first], storedWorkstreamsOf(making)) !== arriving.part) return null;
  return first;
}

/** `making` without one session: its entry and its place in the order. The same object when there is none to take out. */
export function withoutSession(making: unknown, key: string | null): unknown {
  if (!key || !making || typeof making !== "object") return making;
  const made = making as Record<string, unknown>;
  const meta = { ...sessionsMetaOf(made) };
  delete meta[key];
  const order = Array.isArray(made.session_order) ? (made.session_order as unknown[]).filter((entry) => entry !== key) : made.session_order;
  return { ...made, sessions_meta: meta, ...(order === undefined ? null : { session_order: order }) };
}

/**
 * The groups numbered with the session on its way in its place: from the click, every session at or after the number it will
 * have moves up one, so no two are drawn with one number and none is renumbered later, when it lands. Once its group is in the
 * data the numbering already holds it, and the groups are as given.
 */
export function numberedWithArriving<G extends { key?: string | null; sessionId?: string | null; number: number; implicit?: boolean }>(
  groups: readonly G[],
  arriving: (ArrivingEntry & { head: { number: number } }) | null,
  keyOf: (group: G) => string,
): G[] {
  if (!arriving || arriving.status === "failed" || groups.some((group) => keyOf(group) === arriving.key)) return groups as G[];
  const from = arriving.head.number;
  return groups.map((group) => (!group.implicit && group.number >= from ? { ...group, number: group.number + 1 } : group));
}

/**
 * SV-07 P3: `making` with the parts Add a part is writing, from the click. Once the stored parts hold every one of them the
 * stored parts are drawn, so nothing changes when the write lands.
 */
export function withParts(making: unknown, parts: readonly { key: string }[] | null): unknown {
  if (!parts) return making;
  const stored = storedWorkstreamsOf(making);
  if (parts.every((part) => stored.some((have) => have.key === part.key))) return making;
  return { ...(making && typeof making === "object" ? (making as Record<string, unknown>) : {}), workstreams: parts.map((part) => ({ ...part })) };
}

/** SV-07 P3: `making` with the parts the maker has just folded or opened, until the stored parts say the same. */
export function withPartFolds(making: unknown, folds: Readonly<Record<string, boolean>>): unknown {
  const stored = storedWorkstreamsOf(making);
  if (!stored.some((part) => part.key in folds && Boolean(part.collapsed) !== folds[part.key])) return making;
  const workstreams = stored.map((part) => (part.key in folds ? { ...part, collapsed: folds[part.key] } : part));
  return { ...(making as Record<string, unknown>), workstreams };
}

/**
 * `making` with the session on its way in the part it was added to, before its entry says so: its tiles can be read before the
 * entry that names its part is written, and it is never drawn in another part meanwhile. An import with no entry is given one
 * (an entry alone draws nothing for an import); a session made here is changed only once its own entry is there.
 */
export function withArrivingPart(making: unknown, arriving: ArrivingEntry | null): unknown {
  if (!arriving?.part || arriving.status === "failed") return making;
  const meta = sessionsMetaOf(making);
  const own = meta[arriving.key];
  if (own?.workstream || (!own && isTypedSession(arriving.key))) return making;
  const made = making && typeof making === "object" ? (making as Record<string, unknown>) : {};
  return { ...made, sessions_meta: { ...meta, [arriving.key]: { tool: null, date: "", ...own, workstream: arriving.part } } };
}
