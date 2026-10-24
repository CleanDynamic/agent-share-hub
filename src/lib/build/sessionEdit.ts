// CA-14 P5, P7: changing which session a tile is in, and what that does to the tiles' places.
//
// PURE FIRST. A change is planned on a copy of the tree: the tiles are given their new session (`reassigned`), the sessions
// are put in their order, and `planLayout` says which tiles' places change so that every session's tiles sit together
// in the order the sessions are numbered. The page then writes the plan: the tiles' payloads in one batch
// (`writeSessionOf`), their places (`reorderNodes`), the sessions' entries and order (`sessionLayout`).
//
// Nothing here touches an import. An imported session is the maker's, in any number of drafts, and each draft holds its own
// copy of the tiles; a tile's session is read from `payload.session` first, so reassigning it never edits the import.

import { supabase } from "@/integrations/supabase/client";
import { buildSteps, groupKey, sessionGroups, type SessionGroup, type Step } from "./graph";
import { sessionToolsOf, sessionsMetaOf, type MakingSession, type SessionMeta } from "./making";
import { NODE_COLUMNS, deleteNode, readNodeRows, type NodeMove } from "./nodes";
import { orderKeys, stackBySessionMoves } from "./sessionLayout";
import { checkRows, noteNodes } from "./staleWrites";
import { buildLayerError, type BuildNode, type NodeTree } from "./types";

const makingSessionsOf = (making: unknown): MakingSession[] => {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  return Array.isArray(list) ? (list as MakingSession[]) : [];
};

/** The tree with these top-level nodes' `payload.session` set. Every other node is the same object as before. */
export function reassigned(tree: readonly NodeTree[], to: ReadonlyMap<string, string>): NodeTree[] {
  return tree.map((node) => (to.has(node.id) ? { ...node, payload: { ...((node.payload ?? {}) as Record<string, unknown>), session: to.get(node.id) } as NodeTree["payload"] } : node));
}

export interface LayoutPlan {
  /** The places that change, as `reorderNodes` takes them. */
  moves: NodeMove[];
  groups: SessionGroup[];
  steps: Step[];
}

/** Where every top-level tile goes so that each session's tiles sit together, sessions in `order`. */
export function planLayout(tree: readonly NodeTree[], making: unknown, meta: Readonly<Record<string, SessionMeta>>, order: readonly string[], atEnd: readonly string[] = []): LayoutPlan {
  const steps = buildSteps(tree);
  const groups = sessionGroups(steps, makingSessionsOf(making), sessionToolsOf(making), meta, order);
  return { moves: stackBySessionMoves(tree, steps, groups, atEnd), groups, steps };
}

/** The top-level tiles of a session, in order: the steps its group holds. */
export function tilesOfSession(steps: readonly Step[], groups: readonly SessionGroup[], key: string): Step[] {
  const group = groups.find((entry) => groupKey(entry) === key);
  return group ? steps.filter((step) => group.stepNumbers.includes(step.number)) : [];
}

/** "2026-10-22": the day a tile was made, for a session split at it. Today when the row has none. */
export function dayOfNode(node: Pick<BuildNode, "created_at"> | undefined, today: string): string {
  const day = typeof node?.created_at === "string" ? node.created_at.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
}

/** The rows of a split: the tiles from `stepId` to the end of its session move into `key`. */
export function splitPlan(steps: readonly Step[], groups: readonly SessionGroup[], stepId: string): { from: string; tail: Step[] } | null {
  for (const group of groups) {
    if (group.implicit) continue;
    const mine = steps.filter((step) => group.stepNumbers.includes(step.number));
    const at = mine.findIndex((step) => step.id === stepId);
    if (at > 0) return { from: groupKey(group), tail: mine.slice(at) };
  }
  return null;
}

/** The text of the toast for a merge that kept one title and dropped the other, or null when no title was lost. */
export function mergeTitleNote(upper: string | undefined, lower: string | undefined): string | null {
  if (upper && lower) return `Kept '${upper}'. '${lower}' was removed.`;
  return null;
}

/** The title a merged session has: the upper one's, else the lower one's. */
export const mergedTitle = (upper: string | undefined, lower: string | undefined): string | undefined => upper ?? lower;

/** `order` with `key` taken out. */
export const withoutKey = (order: readonly string[], key: string): string[] => order.filter((entry) => entry !== key);

/** `order` with `key` put straight after `after` (the end when `after` is not in it). */
export function insertedAfter(order: readonly string[], key: string, after: string): string[] {
  const rest = withoutKey(order, key);
  const at = rest.indexOf(after);
  rest.splice(at < 0 ? rest.length : at + 1, 0, key);
  return rest;
}

/** The order the sessions are drawn in, from the tree and the making, with a saved order applied. */
export function orderOfTree(tree: readonly NodeTree[], making: unknown, order: readonly string[]): string[] {
  const steps = buildSteps(tree);
  return orderKeys(sessionGroups(steps, makingSessionsOf(making), sessionToolsOf(making), sessionsMetaOf(making), order));
}

const BATCH = 100;

/** Write whole node rows back (their payloads changed, or they were removed and come back). One request per 100 rows. */
export async function writeNodeRows(rows: readonly BuildNode[]): Promise<BuildNode[]> {
  const buildId = rows[0]?.build_id;
  // CA-23 P4: rows this tab knows are read against the database first; one changed elsewhere is merged, never overwritten.
  const checked = buildId ? (await checkRows(buildId, rows, readNodeRows, writeRowsPlain)).write : [...rows];
  const out = await writeRowsPlain(checked);
  if (buildId) noteNodes(buildId, out);
  return out;
}

async function writeRowsPlain(rows: readonly BuildNode[]): Promise<BuildNode[]> {
  const out: BuildNode[] = [];
  for (let at = 0; at < rows.length; at += BATCH) {
    const { data, error } = await supabase.from("build_nodes").upsert(rows.slice(at, at + BATCH) as never[], { onConflict: "id" }).select(NODE_COLUMNS);
    if (error) throw buildLayerError("writeNodeRows", error);
    out.push(...((data ?? []) as unknown as BuildNode[]));
  }
  return out;
}

/** The rows with `payload.session` set, ready for `writeNodeRows`. */
export function withSession(rows: readonly BuildNode[], key: string): BuildNode[] {
  return rows.map((row) => ({ ...row, payload: { ...((row.payload ?? {}) as Record<string, unknown>), session: key } as BuildNode["payload"] }));
}

/** Take these top-level tiles away, with whatever sits inside them (the foreign key takes the rest). */
export async function removeTopNodes(ids: readonly string[]): Promise<void> {
  for (const id of ids) await deleteNode(id);
}

/** Every node in a subtree, parents first: what a removed tile is put back from. */
export function flatRows(nodes: readonly NodeTree[]): BuildNode[] {
  return nodes.flatMap((node) => {
    const { children, ...row } = node;
    return [row as BuildNode, ...flatRows(children ?? [])];
  });
}
