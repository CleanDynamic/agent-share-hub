// Add from Library (SV-18): what a saved item fits, and the copy it makes. Pure.
//
// WHAT FITS WHERE is the composer's own rule (`nestRefusal` in graph.ts): inside an agent only prompts, inside a team only
// agents, at the top level anything. A saved session is a session, so it fits only at the top level. An item that does not
// fit is not listed, never listed and refused.
//
// THE COPY KEEPS ITS SOURCE. A tile carries `source_ref: { node_id, build_id, saved_item_id }` (saved_items_used_in counts a
// saved step or part by `node_id`) and the credit of the maker (`creditForInsert`: the source tile's contributor, else the
// source build's maker, nothing when the maker is the one copying). A session copy is a ready-made `SessionCopy` for
// `insertSession`, whose tiles carry `source_ref.import_session_id` (what saved_items_used_in counts a session by).
//
// ONE WRITER. A step or a part is a snapshot of tiles, so the writing is `restoreSnapshot`, the same writer Duplicate and Undo use.

import type { Json } from "@/integrations/supabase/types";
import type { LibrarySavedItem, PartChild, PartSnapshot, SavedKind, SessionSnapshot, StepSnapshot } from "@/lib/library/savedItems";

import { creditColumn, creditFor } from "./contributors";
import type { SessionCopy } from "./addSession";
import type { BuildSnapshot } from "./buildSnapshot";
import { PROMPT_TYPE } from "./composePrompts";
import { AGENT_TYPE, TEAM_TYPE } from "./graph";
import { methodOf } from "./forkRules";
import { newSessionKey, todayDay } from "./making";
import type { BuildNode } from "./types";

type Payload = Record<string, unknown>;

/** Where the maker is adding. */
export type LibraryPlace =
  | { kind: "top"; session: string | null; name: string }
  | { kind: "agent"; id: string; name: string }
  | { kind: "team"; id: string; name: string };

/** The kinds of saved item the window lists. */
export const INSERTABLE_KINDS: ReadonlySet<SavedKind> = new Set<SavedKind>(["step", "part", "session"]);

/** The tile types a container holds. The same words as `nestRefusal`; the test keeps the two together. */
const HELD: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  [AGENT_TYPE, new Set([PROMPT_TYPE])],
  [TEAM_TYPE, new Set([AGENT_TYPE])],
]);

/** The type of the container a place is, or null at the top level. */
export const containerTypeOf = (place: LibraryPlace): string | null => (place.kind === "agent" ? AGENT_TYPE : place.kind === "team" ? TEAM_TYPE : null);

const isRecord = (value: unknown): value is Payload => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** The snapshot of a saved item, read as a step. */
const stepOf = (item: Pick<LibrarySavedItem, "snapshot">): StepSnapshot => item.snapshot as unknown as StepSnapshot;
const sessionOf = (item: Pick<LibrarySavedItem, "snapshot">): SessionSnapshot => item.snapshot as unknown as SessionSnapshot;

/** Whether a saved item can be put at this place. */
export function fitsPlace(place: LibraryPlace, item: Pick<LibrarySavedItem, "kind" | "snapshot">): boolean {
  if (!INSERTABLE_KINDS.has(item.kind)) return false;
  if (item.kind === "session") return place.kind === "top" && (sessionOf(item).prompts ?? []).length > 0;
  const type = text(stepOf(item).type);
  if (!type) return false;
  const container = containerTypeOf(place);
  if (container === null) return true;
  // Inside an agent or a team: one tile of the type it holds. A part is a tile with tiles of its own, and goes at the top.
  return item.kind === "step" && (HELD.get(container)?.has(type) ?? false);
}

/** Why a kind is missing at this place, in the words the window shows beside its tabs; null when every kind fits. */
export function missingKindWords(place: LibraryPlace): string | null {
  if (place.kind === "agent") return "Sessions don't fit inside an agent";
  if (place.kind === "team") return "Sessions don't fit inside a team";
  return null;
}

/** "prompts", "agents" or "steps": what fits, for the line under the title. */
export function fitWords(place: LibraryPlace): string {
  return place.kind === "agent" ? "prompts" : place.kind === "team" ? "agents" : "steps and sessions";
}

/** What a copy is called in the footer: a prompt, an agent, a part, a session. */
export function copyNoun(item: Pick<LibrarySavedItem, "kind" | "snapshot">): string {
  if (item.kind === "session") return "session";
  if (item.kind === "part") return "part";
  const type = text(stepOf(item).type);
  return type === AGENT_TYPE ? "agent" : type === TEAM_TYPE ? "team" : type.replace(/_/g, " ") || "step";
}

/** Whose work the copy credits: the saved item's maker. */
export const makerIdOf = (item: Pick<LibrarySavedItem, "snapshot">): string | null => {
  const source = (item.snapshot as { source?: { makerId?: unknown } | null }).source;
  return typeof source?.makerId === "string" && source.makerId ? source.makerId : null;
};

/* ── the copy ── */

export interface InsertContext {
  buildId: string;
  /** The person copying: no credit is written when they are the maker. */
  copierId: string;
  newId: () => string;
  /** The id of the new top-level tile, when the caller needs it before the write (the animator's key). */
  topId?: string;
  now?: () => string;
}

export const LIBRARY_COPY = {
  one: (name: string): string => `Added ${name} from Library`,
  session: (name: string): string => `Added session ${name} from Library`,
  several: (count: number): string => `Added ${count} items from Library`,
  fallback: "an item",
} as const;

const ids = (value: Json | undefined, map: ReadonlyMap<string, string>): Json | undefined => {
  if (typeof value === "string") return map.get(value) ?? value;
  if (Array.isArray(value)) return value.map((entry) => ids(entry as Json, map) as Json);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, ids(entry as Json, map)])) as Json;
  return value;
};

/** A new row for a copy. */
function rowFor(context: InsertContext, input: { id: string; parentId: string | null; position: number; type: string; title: string | null; note: string | null; payload: Payload; sourceRef: Payload | null; credit: string | null }): BuildNode {
  return {
    id: input.id,
    build_id: context.buildId,
    parent_id: input.parentId,
    position: input.position,
    type: input.type,
    title: input.title,
    note: input.note,
    payload: input.payload as Json,
    source_ref: input.sourceRef as Json | null,
    event_id: null,
    is_gap: false,
    created_at: (context.now ?? (() => new Date().toISOString()))(),
    ...creditColumn(input.credit),
  } as BuildNode;
}

const lastPosition = (rows: readonly BuildNode[], parent: string | null): number =>
  rows.reduce((highest, row) => (row.parent_id === parent ? Math.max(highest, row.position ?? 0) : highest), parent === null ? -1 : 0);

export interface Inserted {
  snapshot: BuildSnapshot;
  /** The new top-level tile's id (the copy's keys, for the animator). */
  ids: string[];
}

/**
 * Put a saved step or part at a place: a new tile with the snapshot's method, the source it came from and the credit of its
 * maker. Nothing else of the build changes. A part comes with the tiles inside it, pointers between them rewritten. Null when
 * the item does not fit.
 */
export function insertSavedTile(snapshot: BuildSnapshot, item: Pick<LibrarySavedItem, "id" | "kind" | "snapshot">, place: LibraryPlace, context: InsertContext): Inserted | null {
  if (!fitsPlace(place, item) || item.kind === "session") return null;
  const source = stepOf(item);
  const credit = creditFor(makerIdOf(item), context.copierId);
  const sourceRef = (nodeId: string | undefined): Payload => ({ ...(nodeId ? { node_id: nodeId } : null), build_id: source.source?.buildId ?? null, saved_item_id: item.id });
  const parent = place.kind === "top" ? null : place.id;
  const made: BuildNode[] = [];
  const topId = context.topId ?? context.newId();

  const children = item.kind === "part" ? ((item.snapshot as unknown as PartSnapshot).children ?? []) : [];
  const map = new Map<string, string>();
  const walk = (entries: readonly PartChild[]) => {
    for (const entry of entries) {
      map.set(entry.id, context.newId());
      walk(entry.children ?? []);
    }
  };
  walk(children);
  if (source.source?.nodeId) map.set(source.source.nodeId, topId);

  const payloadOf = (raw: Payload, session: string | null): Payload => {
    const method = ids(methodOf(raw) as Json, map) as Payload;
    return session ? { ...method, session } : { ...method };
  };
  const session = place.kind === "top" ? place.session : null;
  made.push(
    rowFor(context, {
      id: topId,
      parentId: parent,
      position: lastPosition(snapshot.nodes, parent) + 1,
      type: source.type,
      title: source.title ?? null,
      note: source.note ?? null,
      payload: payloadOf(isRecord(source.payload) ? source.payload : {}, session),
      sourceRef: sourceRef(source.source?.nodeId),
      credit,
    }),
  );
  const copyChildren = (entries: readonly PartChild[], under: string) => {
    entries.forEach((entry, at) => {
      const id = map.get(entry.id) as string;
      made.push(rowFor(context, { id, parentId: under, position: at + 1, type: entry.type, title: entry.title ?? null, note: entry.note ?? null, payload: payloadOf(isRecord(entry.payload) ? entry.payload : {}, null), sourceRef: sourceRef(entry.id), credit }));
      copyChildren(entry.children ?? [], id);
    });
  };
  copyChildren(children, topId);
  return { snapshot: { ...snapshot, nodes: [...snapshot.nodes, ...made] }, ids: [topId] };
}

/**
 * A saved session as a ready-made session for `insertSession`: a session made here (a new `typed-…` key), the prompts as
 * tiles with the text and the model, each tile naming the saved session as its source, the maker credited.
 */
export function sessionCopyOf(item: Pick<LibrarySavedItem, "id" | "ref" | "snapshot">, copierId: string, key: string = newSessionKey(), today: string = todayDay()): SessionCopy {
  const snap = sessionOf(item);
  const credit = creditFor(makerIdOf(item), copierId);
  const sourceRef = { import_session_id: item.ref ?? item.id, build_id: snap.source?.buildId ?? null, saved_item_id: item.id } as unknown as Json;
  return {
    key,
    meta: { tool: snap.source?.tool?.trim() || null, date: today, ...(snap.model ? { model: snap.model } : null), ...(snap.title?.trim() ? { title: snap.title.trim().slice(0, 80) } : null), ...(credit ? { contributor_id: credit } : null) },
    tiles: (snap.prompts ?? []).map((prompt) => ({
      type: PROMPT_TYPE,
      title: null,
      note: null,
      payload: { text: text(prompt.text), ...(snap.model ? { model: snap.model } : null) } as Json,
      source_ref: sourceRef,
    })),
  };
}

/** What the step is called in the history sentence. */
export const savedName = (item: Pick<LibrarySavedItem, "snapshot">): string => {
  const snap = item.snapshot as { title?: unknown; payload?: { text?: unknown }; prompts?: { text?: unknown }[] };
  return text(snap.title).trim() || text(snap.payload?.text).trim().split(/\s+/).slice(0, 6).join(" ") || text(snap.prompts?.[0]?.text).trim().split(/\s+/).slice(0, 6).join(" ") || LIBRARY_COPY.fallback;
};
