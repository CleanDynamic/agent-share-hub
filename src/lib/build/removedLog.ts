// removedLog: what was removed during this visit, and how one thing is brought back out of turn (CA-20 P6). PURE.
//
// KEPT IN MEMORY, FOR THE VISIT. Everything removed (a tile, a session, a part, a file, the whole build) is listed with the
// snapshots from before and after it went. Nothing is written to the database for the list, and a reload empties it.
//
// RESTORE OUT OF TURN. Undo takes the last step back. Restore brings back one earlier thing while later steps stay: it puts back
// the rows the removal took, in their old places where those places still hold, and otherwise at the end of their session; a session
// that has gone since comes back with it (its entry, its place in the order, its row), and so does a part. What other steps wrote
// since is left as it is.

import type { GlyphName } from "@/components/brand/glyphs";

import { nestNodes } from "./nodes";
import { parentsFirst, type BuildSnapshot } from "./buildSnapshot";
import { planLayout } from "./sessionEdit";
import { storedWorkstreamsOf, sessionsMetaOf, type Workstream } from "./making";
import type { BuildSessionRow } from "./buildSessions";
import type { BuildNode } from "./types";
import type { ReferenceSnapshot } from "./referenceBridge";

export type RemovedKind = "tile" | "session" | "part" | "file" | "build";

/** What the list says about a removal: its badge (a tile's number, "S2", "B", or a file's glyph), its name and what it held. */
export interface RemovedMeta {
  kind: RemovedKind;
  badge: string | { glyph: GlyphName };
  /** "Prompt 3", "Session 2", "Part B", "orders.csv", "The whole build". */
  name: string;
  /** " · 3 tiles": what it held. */
  detail?: string;
  /** The groups and linked words that belonged to it. */
  refs?: ReferenceSnapshot;
}

export interface RemovedEntry extends RemovedMeta {
  id: string;
  at: number;
  before: BuildSnapshot;
  after: BuildSnapshot;
  /** False while its step is undone: the thing is back already. */
  visible: boolean;
}

export const REMOVED_COPY = {
  title: "Recently removed",
  subtitle: "Kept until you leave this page",
  empty: "Nothing removed during this visit.",
  note: "After you leave this page, removed things are gone",
  restore: "Restore",
  done: "Done",
  whole: "The whole build",
  restored: (name: string) => `Restored ${name}`,
  /** Why Restore cannot put the thing back, when it cannot. */
  cannot: "Couldn't restore that. Try again.",
} as const;

/** "Just now", "4 min ago", "2 h ago", "3 days ago". */
export function agoLine(at: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

const asObject = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);
const sessionOf = (row: BuildNode): string | null => {
  const key = asObject(row.payload).session;
  return typeof key === "string" && key ? key : null;
};

/** The snapshot that brings one removal back into the build as it stands now. */
export function restoreTarget(current: BuildSnapshot, entry: Pick<RemovedEntry, "before" | "after">): BuildSnapshot {
  const { before, after } = entry;
  const here = new Set(current.nodes.map((row) => row.id));
  const stood = new Set(after.nodes.map((row) => row.id));
  const taken = before.nodes.filter((row) => !stood.has(row.id));
  const takenIds = new Set(taken.map((row) => row.id));
  const beforeRow = new Map(before.nodes.map((row) => [row.id, row]));
  const afterRow = new Map(after.nodes.map((row) => [row.id, row]));

  /* What the removal only changed in a row that is still there is put back, and nothing else of that row: a tile that used a file
     is given the file again, a tile that was moved out of a session that went is moved back; what was written since stays. */
  const mended = current.nodes.map((row) => {
    const was = beforeRow.get(row.id);
    const then = afterRow.get(row.id);
    if (!was || !then || JSON.stringify(was.payload) === JSON.stringify(then.payload)) return row;
    const payload = { ...asObject(row.payload) };
    const wasPayload = asObject(was.payload);
    const thenPayload = asObject(then.payload);
    const uses = Array.isArray(payload.uses) ? [...(payload.uses as unknown[])] : [];
    const back = (Array.isArray(wasPayload.uses) ? (wasPayload.uses as { node_id?: string }[]) : []).filter((use) => use?.node_id && takenIds.has(use.node_id) && !uses.some((entry) => (entry as { node_id?: string })?.node_id === use.node_id));
    if (back.length > 0) payload.uses = [...uses, ...back];
    if (wasPayload.session !== thenPayload.session && payload.session === thenPayload.session) {
      if (wasPayload.session === undefined) delete payload.session;
      else payload.session = wasPayload.session;
    }
    return JSON.stringify(payload) === JSON.stringify(asObject(row.payload)) ? row : { ...row, payload: payload as BuildNode["payload"] };
  });

  /* What the removal took comes back where it stood: straight after the sibling it came after, if that is still there; at the
     end if that place has gone (the tile's own session then takes it to the end of the session); at the start if it was first. */
  let list: BuildNode[] = [...mended];
  const present = new Set([...here, ...takenIds]);
  const byParent = new Map<string | null, BuildNode[]>();
  for (const row of taken) byParent.set(row.parent_id, [...(byParent.get(row.parent_id) ?? []), row]);
  for (const [parent, group] of byParent) {
    const parentKey = parent === null || present.has(parent) ? parent : null;
    const siblings = list.filter((row) => row.parent_id === parentKey).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const was = before.nodes.filter((row) => row.parent_id === parent).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const row of [...group].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))) {
      const index = was.findIndex((entry) => entry.id === row.id);
      let at = -1;
      for (let step = index - 1; step >= 0 && at < 0; step -= 1) {
        const found = siblings.findIndex((entry) => entry.id === was[step].id);
        if (found >= 0) at = found + 1;
      }
      siblings.splice(at >= 0 ? at : index === 0 ? 0 : siblings.length, 0, { ...row, parent_id: parentKey });
    }
    const ordered = siblings.map((row, place) => ({ ...row, position: place }));
    const ids = new Set(ordered.map((row) => row.id));
    list = [...list.filter((row) => !ids.has(row.id) && !(row.parent_id === parentKey && ids.has(row.id))), ...ordered];
  }
  const rows = list;
  const making: Record<string, unknown> = { ...current.making };
  let sessions: BuildSessionRow[] = current.sessions.map((row) => ({ ...row }));

  const beforeOrder = asStrings(before.making.session_order);
  const afterOrder = asStrings(after.making.session_order);
  let order = asStrings(making.session_order);
  const meta = { ...sessionsMetaOf(making) } as Record<string, ReturnType<typeof sessionsMetaOf>[string]>;
  const beforeMeta = sessionsMetaOf(before.making);
  const known = (key: string) => order.includes(key) || key in meta || sessions.some((row) => row.sessionKey === key);

  // The sessions that come back: the ones the removal took, and the ones the tiles it took were in.
  const named = rows.filter((row) => !here.has(row.id) && row.parent_id === null).flatMap((row) => sessionOf(row) ?? []);
  const gone = beforeOrder.filter((key) => !afterOrder.includes(key));
  const needed = [...new Set([...gone, ...named])].filter((key) => !known(key) && (beforeOrder.includes(key) || key in beforeMeta));
  for (const key of needed) {
    if (beforeMeta[key]) meta[key] = beforeMeta[key];
    const wanted = beforeOrder.indexOf(key);
    if (wanted >= 0) {
      // After the last session that stood before it and is still there.
      const before_ = beforeOrder.slice(0, wanted).filter((entry) => order.includes(entry));
      const at = before_.length === 0 ? 0 : order.indexOf(before_[before_.length - 1]) + 1;
      order = [...order.slice(0, at), key, ...order.slice(at)];
    } else order = [...order, key];
    const row = before.sessions.find((entry) => entry.sessionKey === key);
    if (row && !sessions.some((entry) => entry.sessionKey === key)) sessions = [...sessions, { ...row, position: Number.MAX_SAFE_INTEGER }];
  }

  // The parts that come back: the ones the removal took, and the ones the sessions that come back were in.
  const parts: Workstream[] = storedWorkstreamsOf(making);
  const partsBefore = storedWorkstreamsOf(before.making);
  const partsAfter = storedWorkstreamsOf(after.making);
  const partsGone = partsBefore.filter((part) => !partsAfter.some((entry) => entry.key === part.key));
  const partsNamed = needed.flatMap((key) => (beforeMeta[key]?.workstream ? [beforeMeta[key].workstream as string] : []));
  const back = [...new Set([...partsGone.map((part) => part.key), ...partsNamed])].filter((key) => !parts.some((part) => part.key === key));
  let nextParts = [...parts];
  for (const key of back) {
    const stored = partsBefore.find((part) => part.key === key);
    if (!stored) continue;
    const wanted = partsBefore.findIndex((part) => part.key === key);
    const standing = partsBefore.slice(0, wanted).filter((part) => nextParts.some((entry) => entry.key === part.key));
    const at = standing.length === 0 ? 0 : nextParts.findIndex((entry) => entry.key === standing[standing.length - 1].key) + 1;
    nextParts = [...nextParts.slice(0, at), stored, ...nextParts.slice(at)];
  }
  // Sessions that were in a part that goes keep to it when they have not been moved since.
  for (const key of Object.keys(meta)) {
    const was = beforeMeta[key]?.workstream;
    if (was && back.includes(was) && meta[key] && meta[key].workstream === sessionsMetaOf(after.making)[key]?.workstream) meta[key] = { ...meta[key], workstream: was };
  }
  if (back.length > 0 || partsGone.length > 0) making.workstreams = nextParts;

  making.sessions_meta = meta;
  making.session_order = order;
  // Positions follow the order.
  sessions = sessions.map((row) => ({ ...row, position: order.includes(row.sessionKey) ? order.indexOf(row.sessionKey) : order.length + sessions.indexOf(row) }));

  // The tiles stand where their sessions are: a tile whose old place is gone goes to the end of its session.
  const moves = planLayout(nestNodes(rows.map((row) => ({ ...row }))), making, meta, order).moves;
  const place = new Map(moves.map((move) => [move.id, move.position]));
  const placed = rows.map((row) => (place.has(row.id) ? { ...row, position: place.get(row.id) as number } : row));
  return { nodes: parentsFirst(placed), sessions, making };
}
