/* CA-21 P3, P4: moving by hand on the build page. The state of a drag, and what it makes of the page.

   While something is held, the build is drawn from a LIVE ORDER (`MoveModel`): the held thing's place moves from slot to slot as the
   pointer's middle passes each neighbour's middle, and everything around it slides (SV-06: the List's one animator, which measures
   round every commit; nothing here plays or cancels a slide).
   Nothing folds and nothing changes size. The held thing itself is a copy of its element in the `DragOverlay`; its own place stays
   in the page as a plain socket (its element, hidden), which the skeleton layer draws behind.

   The rules for where things can go are `moveRules.ts`; the geometry of the layer is `sortLayout.ts`. This file is the glue: it reads
   the pointer, decides a place, keeps the live order, measures the page for the layer, and at the drop hands the write to the page,
   keeps the new order showing until the data says the same, and slides everything back when it does not.

   SV-06 P6: a pointer move only stores where the pointer is; the place is decided at most once a frame. Where everything stands
   comes from the animator's places at rest (`restOf`), kept by its pass, so a move reads no layout and a scroll needs no new measure. */

import type { DragEndEvent, DragMoveEvent, DragStartEvent, KeyboardCoordinateGetter } from "@dnd-kit/core";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

import { DWELL_OPEN_MS, DWELL_SEND_MS, SETTLE_MS } from "@/lib/build/buildMotion";
import type { Step } from "@/lib/build/graph";
import { flatOrder, locate, moveBy, movedLine, placeNested, placePart, placeSession, placeTile, sameModel, spotOf, withoutTile, writeOf, type Move, type MoveKind, type MoveModel, type MoveNames, type Spot, type Write } from "@/lib/build/moveRules";
import { RAIL_ROOM, skeletonOf, type HeldKind, type Skeleton, type SkeletonContainer, type SkeletonItem } from "@/lib/build/sortLayout";
import { prefersReducedMotion } from "@/lib/theme/motion";

import { SLIDE_ATTR, type Box } from "./flip";

/** What is held: a top-level tile, a tile among its siblings, a session, a part. */
export type HeldType = "tile" | "nested" | "session" | "part";

export interface Held {
  id: string;
  type: HeldType;
}

/** The ids the drag handles carry. A tile's is its own id. */
export const SESSION_DRAG = "sdrag:";
export const WORKSTREAM_DRAG = "wdrag:";
/** UX-02 P3: a row of Sources, held: a session that can be added (its library id) or a file of the build (its node id). They never match a node, session or part id. */
export const SOURCE_SESSION_DRAG = "src-session:";
export const SOURCE_FILE_DRAG = "src-file:";

/** UX-02 P3: what a row of Sources says it is (`useDraggable`'s data). */
export interface SourceDragData {
  source: "session" | "file";
  /** The library id of a session; the node id of a file. */
  id: string;
}

/** The id an incoming file holds while it is held over the List: it is not a node yet. An incoming session holds its own key (its library id), the key it will have. */
export const INCOMING_FILE = "incoming-file:";

/** An item from outside the build, held over the List (UX-02 P3 Stage C). */
export interface Incoming {
  source: "session" | "file";
  /** The library id, or the file's node id. */
  id: string;
}

/** Where an incoming item was dropped, handed to the page to write. */
export type IncomingAdd =
  | { kind: "add-session"; libraryId: string; part: string; before: string | null }
  | { kind: "add-file"; fileId: string; session: string; index: number }
  | { kind: "attach-file"; fileId: string; into: string };

export const isSourceDrag = (dragId: string): boolean => dragId.startsWith(SOURCE_SESSION_DRAG) || dragId.startsWith(SOURCE_FILE_DRAG);

export function heldOf(dragId: string, model: MoveModel): Held | null {
  if (dragId.startsWith(SESSION_DRAG)) return { id: dragId.slice(SESSION_DRAG.length), type: "session" };
  if (dragId.startsWith(WORKSTREAM_DRAG)) return { id: dragId.slice(WORKSTREAM_DRAG.length), type: "part" };
  const found = locate(model, dragId);
  if (found?.kind === "nested") return { id: dragId, type: "nested" };
  return found?.kind === "tile" ? { id: dragId, type: "tile" } : null;
}

/* ── the page as the live order draws it ── */

interface ViewBase<Head extends { key: string }, Part extends { view: { key: string; sessions: number }; sessions: readonly string[] }> {
  steps: readonly Step[];
  dividers: ReadonlyMap<string, Head>;
  emptySessions?: readonly Head[];
  parts?: { parts: readonly Part[] } | undefined;
}

/**
 * What the List draws while `live` is the order: the steps in their live order (and the tiles inside a step in theirs), each
 * session's head on its first tile, the sessions with no tile in `emptySessions`, and the parts with the sessions they now hold.
 * At rest (`live` null) the same props come back.
 */
export function viewOf<Head extends { key: string }, Part extends { view: { key: string; sessions: number }; sessions: readonly string[] }, Base extends ViewBase<Head, Part>>(base: Base, live: MoveModel | null): Base {
  if (!live) return base;
  const byId = new Map<string, Step>();
  const note = (step: Step) => {
    byId.set(step.id, step);
    for (const child of [...(step.sentWith ?? []), ...step.children]) note(child);
  };
  base.steps.forEach(note);
  const inOrder = (list: readonly Step[], at: string): Step[] => {
    const ids = live.nested[at];
    if (!ids) return [...list];
    const known = new Map(list.map((step) => [step.id, step]));
    const sorted = ids.flatMap((id) => (known.has(id) ? [known.get(id) as Step] : []));
    return [...sorted, ...list.filter((step) => !ids.includes(step.id))];
  };
  const dressed = (step: Step): Step => {
    const next: Step = { ...step };
    if (step.sentWith) next.sentWith = inOrder(step.sentWith, step.id).map(dressed);
    if (step.children.length > 0) next.children = inOrder(step.children, step.id);
    return next;
  };
  const heads = new Map<string, Head>();
  for (const head of base.dividers.values()) heads.set(head.key, head);
  for (const head of base.emptySessions ?? []) heads.set(head.key, head);
  const order = flatOrder(live);
  const steps: Step[] = [];
  const dividers = new Map<string, Head>();
  const empties: Head[] = [];
  for (const id of live.loose) if (byId.has(id)) steps.push(dressed(byId.get(id) as Step));
  for (const key of order) {
    const tiles = (live.tiles[key] ?? []).flatMap((id) => (byId.has(id) ? [byId.get(id) as Step] : []));
    const head = heads.get(key);
    if (tiles.length === 0) {
      if (head) empties.push(head);
      continue;
    }
    if (head) dividers.set(tiles[0].number, head);
    for (const tile of tiles) steps.push(dressed(tile));
  }
  const parts = base.parts && live.hasParts ? { ...base.parts, parts: live.parts.flatMap((part) => (base.parts?.parts.find((entry) => entry.view.key === part.key) ? [{ ...(base.parts?.parts.find((entry) => entry.view.key === part.key) as Part), sessions: part.sessions, view: { ...(base.parts?.parts.find((entry) => entry.view.key === part.key) as Part).view, sessions: part.sessions.length } }] : [])) } : base.parts;
  return { ...base, steps, dividers, emptySessions: empties, parts };
}

/* ── reading the page ── */

const SELECTOR = {
  tile: '[data-skel-kind="tile"]',
  nested: '[data-skel-kind="nested"]',
  session: '[data-skel-kind="session"]',
  part: '[data-skel-kind="part"]',
} as const;

/** Where an element stands: from the places the animator keeps (`restOf`), or, with none, its box as drawn. */
export type BoxOf = (element: Element) => Box;

/** An element's box as it is drawn now. */
export const drawnBox: BoxOf = (element) => {
  const r = element.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** Where an element stands from `restOf` (by its slide id), its drawn box for one the animator does not know. */
export const boxFrom = (restOf: ((slideId: string) => Box | null) | undefined): BoxOf => (element) => {
  const id = element.getAttribute(SLIDE_ATTR);
  return (id && restOf?.(id)) || drawnBox(element);
};

const idOf = (element: Element) => element.getAttribute("data-skel-id") as string;
const containerOf = (element: Element) => element.getAttribute("data-skel-container") ?? "";

function itemsOf(root: HTMLElement, type: HeldType, container?: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(SELECTOR[type])].filter((element) => (type === "nested" ? containerOf(element) === container : true));
}

/** Where the pointer puts the held thing: the container under it, and the index among what that holds, not counting the held thing. */
export interface Placement {
  model: MoveModel;
  /** The session a folded head holds the pointer over (to open it), or null. */
  folded: string | null;
  /** A tile that could take the held tile, with the pointer in the middle third of it. */
  sendCandidate: string | null;
}

/** The nearest of `boxes` to `y` (the one it is inside, else by distance). */
function nearest<T>(boxes: readonly { item: T; box: Box }[], y: number): { item: T; box: Box } | null {
  let best: { item: T; box: Box } | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const entry of boxes) {
    const d = y < entry.box.y ? entry.box.y - y : y > entry.box.y + entry.box.h ? y - (entry.box.y + entry.box.h) : 0;
    if (d < distance) {
      distance = d;
      best = entry;
    }
  }
  return best;
}

/** How many of `others` stand wholly above the pointer's line: their middle is above `y`. */
const countAbove = (others: readonly Element[], y: number, boxOf: BoxOf): number => others.filter((element) => {
  const box = boxOf(element);
  return box.y + box.h / 2 < y;
}).length;

export function placeAt(root: HTMLElement, held: Held, model: MoveModel, point: { x: number; y: number }, options: { canTake: (id: string, parent: string) => boolean; collapsed?: ReadonlySet<string>; boxOf?: BoxOf }): Placement {
  const none: Placement = { model, folded: null, sendCandidate: null };
  const boxOf = options.boxOf ?? drawnBox;
  if (held.type === "nested") {
    const found = locate(model, held.id);
    if (!found || found.kind !== "nested") return none;
    const others = itemsOf(root, "nested", found.parent).filter((element) => idOf(element) !== held.id);
    return { ...none, model: placeNested(model, held.id, countAbove(others, point.y, boxOf)) };
  }
  if (held.type === "part") {
    const others = itemsOf(root, "part").filter((element) => idOf(element) !== held.id);
    return { ...none, model: placePart(model, held.id, countAbove(others, point.y, boxOf)) };
  }
  if (held.type === "session") {
    const parts = model.hasParts ? itemsOf(root, "part").map((element) => ({ item: idOf(element), box: boxOf(element) })) : [{ item: "", box: { x: 0, y: Number.NEGATIVE_INFINITY, w: 0, h: Number.POSITIVE_INFINITY } as Box }];
    const target = nearest(parts, point.y);
    if (!target) return none;
    const part = model.parts.find((entry) => entry.key === target.item);
    const collapsed = Boolean(options.collapsed?.has(target.item));
    const others = itemsOf(root, "session").filter((element) => idOf(element) !== held.id && (part?.sessions ?? []).includes(idOf(element)));
    const at = collapsed ? (part?.sessions ?? []).filter((id) => id !== held.id).length : countAbove(others, point.y, boxOf);
    return { ...none, model: placeSession(model, held.id, target.item, at) };
  }
  // A top-level tile: the session under the pointer, then its place among that session's tiles.
  const sessions = itemsOf(root, "session").map((element) => ({ item: idOf(element), box: boxOf(element) }));
  const target = nearest(sessions, point.y);
  if (!target) return none;
  const key = target.item;
  const closed = Boolean(options.collapsed?.has(key));
  const tiles = itemsOf(root, "tile").filter((element) => containerOf(element) === key && idOf(element) !== held.id);
  const at = closed ? (model.tiles[key] ?? []).filter((id) => id !== held.id).length : countAbove(tiles, point.y, boxOf);
  const next = placeTile(model, held.id, key, at);
  // Over the middle third of a tile that can take it: it may become the target.
  let sendCandidate: string | null = null;
  for (const element of itemsOf(root, "tile")) {
    const id = idOf(element);
    if (id === held.id) continue;
    const box = boxOf(element);
    const third = box.h / 3;
    if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y + third && point.y <= box.y + 2 * third && options.canTake(held.id, id)) {
      sendCandidate = id;
      break;
    }
  }
  const headOver = closed && point.y >= target.box.y && point.y <= target.box.y + target.box.h;
  return { model: next, folded: headOver ? key : null, sendCandidate };
}

/* ── measuring for the layer ── */

const heldKindOf = (type: HeldType): HeldKind => (type === "session" ? "session" : type === "part" ? "part" : "tile");

export function measureSkeleton(root: HTMLElement, held: Held, live: MoveModel, start: MoveModel, names: MoveNames, edge: number, boxOf: BoxOf = drawnBox): Skeleton {
  const origin = drawnBox(root);
  // Prompt 6 G3: every box on whole pixels, against the origin's whole pixel (the layer is moved there, `skeleton.tsx`).
  const at = { x: Math.round(origin.x), y: Math.round(origin.y) };
  const rel = (box: Box) => {
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    return { x: x - at.x, y: y - at.y, w: Math.round(box.x + box.w) - x, h: Math.round(box.y + box.h) - y };
  };
  const radiusOf = (element: Element, fallback: number) => {
    const target = element.getAttribute("data-skel-kind") === "tile" || element.getAttribute("data-skel-kind") === "nested" ? (element.firstElementChild ?? element) : element;
    const r = typeof getComputedStyle === "function" ? Number.parseFloat(getComputedStyle(target).borderTopLeftRadius) : Number.NaN;
    return Number.isFinite(r) && r > 0 ? r : fallback;
  };
  const items: SkeletonItem[] = [];
  const containers: SkeletonContainer[] = [];
  const kind = heldKindOf(held.type);
  const moved = (() => {
    const was = spotOf(start, held.id);
    const now = spotOf(live, held.id);
    return Boolean(was && now && (was.index !== now.index || was.session !== now.session || was.part !== now.part || was.parent !== now.parent));
  })();
  if (held.type === "tile" || held.type === "nested") {
    const found = locate(live, held.id);
    const parent = found?.kind === "nested" ? found.parent : null;
    const elements = itemsOf(root, parent ? "nested" : "tile", parent ?? undefined);
    for (const element of elements) items.push({ id: idOf(element), container: containerOf(element), rect: rel(boxOf(element)), radius: radiusOf(element, 12) });
    if (parent) {
      const box = elements.map((element) => boxOf(element));
      if (box.length > 0) {
        const x = Math.min(...box.map((b) => b.x));
        const y = Math.min(...box.map((b) => b.y));
        const right = Math.max(...box.map((b) => b.x + b.w));
        const bottom = Math.max(...box.map((b) => b.y + b.h));
        containers.push({ id: parent, rect: rel({ x, y, w: right - x, h: bottom - y }), items: live.nested[parent] ?? [], framed: false, name: names.tile(parent) });
      }
    } else {
      for (const element of itemsOf(root, "session")) {
        const key = idOf(element);
        containers.push({ id: key, rect: rel(boxOf(element)), items: live.tiles[key] ?? [], framed: false, name: names.session(key) });
      }
    }
  } else if (held.type === "session") {
    for (const element of itemsOf(root, "session")) items.push({ id: idOf(element), container: containerOf(element), rect: rel(boxOf(element)), radius: 12 });
    if (live.hasParts) {
      for (const element of itemsOf(root, "part")) {
        const key = idOf(element);
        containers.push({ id: key, rect: rel(boxOf(element)), items: live.parts.find((part) => part.key === key)?.sessions ?? [], framed: true, name: names.part(key) });
      }
    } else {
      const boxes = items.map((item) => item.rect);
      if (boxes.length > 0) {
        const x = Math.min(...boxes.map((b) => b.x));
        const y = Math.min(...boxes.map((b) => b.y));
        containers.push({ id: "", rect: { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y }, items: flatOrder(live), framed: false, name: "Build" });
      }
    }
  } else {
    for (const element of itemsOf(root, "part")) items.push({ id: idOf(element), container: "", rect: rel(boxOf(element)), radius: radiusOf(element, 14) });
    const boxes = items.map((item) => item.rect);
    if (boxes.length > 0) {
      const x = Math.min(...boxes.map((b) => b.x));
      const y = Math.min(...boxes.map((b) => b.y));
      containers.push({ id: "", rect: { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y }, items: live.parts.map((part) => part.key), framed: false, name: "Build" });
    }
  }
  // Prompt 6 G2: a list tile held in a build with parts: the rail stands from the part frame's left edge, and the room is measured from it.
  const frames = held.type === "tile" && live.hasParts ? itemsOf(root, "part").map((element) => rel(boxOf(element)).x) : [];
  const frame = frames.length > 0 ? Math.min(...frames) : undefined;
  const left = frame !== undefined ? frame + at.x : items.length > 0 ? Math.min(...items.map((item) => item.rect.x)) + at.x : origin.x;
  return { ...skeletonOf({ kind, items, containers, held: held.id, moved, room: left - edge, frame }), origin: { x: origin.x, y: origin.y } };
}

/** The right edge of whatever stands to the left of the build column: Sources, or its rail. */
export function leftEdge(): number {
  let edge = 0;
  for (const element of document.querySelectorAll<HTMLElement>('[data-testid="sources-panel"], [data-testid="sources-rail"]')) edge = Math.max(edge, element.getBoundingClientRect().right);
  return edge;
}

/* ── the lines ── */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function pickedLine(held: Held, model: MoveModel, names: MoveNames): string {
  const spot = spotOf(model, held.id);
  if (!spot) return "";
  const at = `${spot.index + 1} of ${spot.count}`;
  if (held.type === "session") return `Picked up ${names.session(held.id)} and its ${plural(model.tiles[held.id]?.length ?? 0, "step", "steps")}. ${spot.part ? names.part(spot.part) : "The build"}, ${at}.`;
  if (held.type === "part") return `Picked up ${names.part(held.id)} and its ${plural(model.parts.find((part) => part.key === held.id)?.sessions.length ?? 0, "session", "sessions")}. The build, ${at}.`;
  if (held.type === "nested") return `Picked up ${names.tile(held.id)}. ${names.tile(spot.parent ?? "")}, ${at}.`;
  return `Picked up ${names.tile(held.id)}. ${spot.session ? names.session(spot.session) : "The build"}, ${at}.`;
}

export function overLine(held: Held, live: MoveModel, names: MoveNames): string {
  const spot = spotOf(live, held.id);
  if (!spot) return "";
  const at = `${spot.index + 1} of ${spot.count}`;
  if (held.type === "session") return `Over ${spot.part ? names.part(spot.part) : "the build"}, ${at}.`;
  if (held.type === "part") return `Over the build, ${at}.`;
  if (held.type === "nested") return `Over ${names.tile(spot.parent ?? "")}, ${at}.`;
  return `Over ${spot.session ? names.session(spot.session) : "the build"}, ${at}.`;
}

export function putBackLine(held: Held, start: MoveModel, names: MoveNames): string {
  const spot = spotOf(start, held.id);
  if (held.type === "session") return `Put back in ${spot?.part ? names.part(spot.part) : "the build"}.`;
  if (held.type === "part") return "Put back where it was.";
  if (held.type === "nested") return `Put back in ${names.tile(spot?.parent ?? "")}.`;
  return `Put back in ${spot?.session ? names.session(spot.session) : "the build"}.`;
}

/* ── the hook ── */

export interface Commit {
  held: Held;
  write: Write;
  move: Move;
  start: MoveModel;
  end: MoveModel;
  /** "Moved Prompt 2 to Session 2": the step the history takes. */
  sentence: string;
  line: string;
}

export interface SortingOptions {
  /** The build as the props draw it, at rest. */
  model: MoveModel;
  phone: boolean;
  names: MoveNames;
  canTake: (id: string, parentId: string) => boolean;
  collapsed?: ReadonlySet<string>;
  /** A folded session's head held over for `DWELL_OPEN_MS`. */
  onOpen?: (sessionKey: string) => void;
  /** Prompt 6 G9: a tile picked up by a press on it and let go in place is selected, as a click would. */
  onSelect?: (id: string) => void;
  /** The write at the drop. Resolves true when it was written, false when it was not; void when the page cannot say. */
  commit: (commit: Commit) => Promise<unknown> | void;
  /** One tile sent with another at the drop. Resolves true once written. */
  send: (id: string, parentId: string) => Promise<boolean>;
  /** The line the send ends with. */
  sentLine: (id: string, parentId: string) => string;
  /** The line under the build, which is also what a screen reader hears. */
  say: (line: string) => void;
  /** Where an element stands at rest, by its slide id: the List's animator (`ListMotion.restOf`). Without it, boxes are read as drawn. */
  restOf?: (slideId: string) => Box | null;
  /** UX-02 P3: an item from Sources dropped on the List. Resolves true once written, false when it was not. Absent: the List takes nothing from outside. */
  add?: (add: IncomingAdd) => Promise<boolean>;
  /** UX-02 P3: whether a held file can go inside this tile (a dropped file attaches inside that step). */
  takesFile?: (id: string) => boolean;
  /** UX-02 P3: the polite line for an add from outside. */
  addedLine?: (add: IncomingAdd) => string;
}

interface Drag {
  held: Held;
  start: MoveModel;
  live: MoveModel;
  send: string | null;
  html: string;
  size: { w: number; h: number };
  /** UX-02 P3: an item from Sources, not yet in the build. Its held copy is its row's markup, taken at the start. */
  incoming?: Incoming;
}

export interface Sorting {
  rootRef: RefObject<HTMLDivElement | null>;
  /** The live order while something is held or its write is on its way; null at rest. */
  live: MoveModel | null;
  /** Whether something is being held right now. */
  holding: boolean;
  held: Held | null;
  /** The element of the held thing stays as its own place: hidden, in the layout. */
  hidden: string | null;
  send: string | null;
  skeleton: Skeleton | null;
  skeletonShown: boolean;
  overlay: { html: string; w: number; h: number; type: HeldType } | null;
  /** Where the held thing was when it was picked up: the copy keeps to it, though its own element moves. Prompt 6 G7: `column`
   *  for a tile of the list (top-level or nested), whose copy then moves up and down only. */
  initial: { left: number; top: number; column?: boolean } | null;
  /** Where a drag by the keys has put the held copy: on its place. Null for a drag by the pointer. */
  keyboardAt: { x: number; y: number } | null;
  /** Up and Down while something is held by the keys: one place at a time, by `moveBy`'s rules. */
  coordinateGetter: KeyboardCoordinateGetter;
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  /** Show a move that something else writes (a menu's Move up): the new order at once, sliding, put back when the write does not land. */
  show: (model: MoveModel, line: string, run: Promise<unknown> | void) => void;
  /** Everything is sliding back to where it was (Esc, a write that did not land): those slides take `SETTLE_MS`. Null otherwise. */
  settleMs: number | null;
  /** UX-02 P3: the item from Sources held over the List, or last held: its size, for the slot the List draws for it. */
  incoming: (Incoming & { held: Held; size: { w: number; h: number } }) | null;
  /** Whether the held copy flies back to its place when let go: a tile, a session or a part does; a row of Sources disappears at once. */
  settles: boolean;
}

/** A copy of an element's markup, without what must stay unique on the page. */
export function cloneHtml(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const node of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) {
    for (const name of ["id", "data-testid", "data-node-id", "data-skel-id", "data-skel-kind", "data-skel-container", "data-slide-id", "data-session-key", "data-workstream-group", "aria-controls", "aria-describedby", "tabindex"]) node.removeAttribute(name);
  }
  copy.style.visibility = "visible";
  return copy.outerHTML;
}

const point = (event: Event | null | undefined): { x: number; y: number } | null => {
  if (!event) return null;
  const touch = (event as TouchEvent).touches?.[0] ?? (event as TouchEvent).changedTouches?.[0];
  const source = touch ?? (event as MouseEvent);
  return typeof source.clientX === "number" ? { x: source.clientX, y: source.clientY } : null;
};

export function useBuildSorting(options: SortingOptions): Sorting {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  /** The order showing after the drop until the data says the same. */
  const [pending, setPending] = useState<{ model: MoveModel; held: Held | null } | null>(null);
  const [skeleton, setSkeleton] = useState<Skeleton | null>(null);
  const [skeletonShown, setSkeletonShown] = useState(false);
  const [hidden, setHidden] = useState<string | null>(null);
  const [keyboardAt, setKeyboardAt] = useState<{ x: number; y: number } | null>(null);
  const viaKeys = useRef(false);
  /** Prompt 6 G9: the drag started from a press on a tile's surface (not its grip, not the keys). */
  const fromSurface = useRef(false);
  const [refocus, setRefocus] = useState<string | null>(null);
  const [initial, setInitial] = useState<{ left: number; top: number; column?: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const dragRef = useRef<Drag | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const setSaid = (line: string) => optionsRef.current.say(line);
  const boxOf: BoxOf = (element) => boxFrom(optionsRef.current.restOf)(element);
  /** Where the pointer is: written by every move, read once a frame. Not state: a move draws nothing. */
  const pointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const frame = useRef(0);
  /** Putting back: the slides of the commits that follow take `SETTLE_MS`, as the held copy's own drop does. */
  const [settleMs, setSettleMs] = useState<number | null>(null);
  const timers = useRef<{ send?: number; open?: number; settle?: number; fade?: number; give?: number }>({});
  /** UX-02 P3: the item from Sources held, or written and not yet in the data: what the List draws its slot from. */
  const [incoming, setIncoming] = useState<Sorting["incoming"]>(null);
  /** A row of Sources let go does not fly back to its row: its copy disappears at once. */
  const [settles, setSettles] = useState(true);
  const candidate = useRef<{ send: string | null; open: string | null }>({ send: null, open: null });

  const clearTimers = () => {
    for (const key of ["send", "open"] as const) window.clearTimeout(timers.current[key]);
    candidate.current = { send: null, open: null };
  };

  const set = (next: Drag | null) => {
    dragRef.current = next;
    setDrag(next);
    setTick((value) => value + 1);
  };

  // After every change of order: measure the page for the layer. (What moved is already sliding: the animator's pass.)
  const live = drag?.live ?? pending?.model ?? null;
  const heldNow = drag?.held ?? pending?.held ?? null;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // UX-02 P3: an item from Sources that is not over the List has no place, and no slot.
    if (heldNow && live && drag && drag.incoming && !spotOf(live, heldNow.id)) setSkeleton(null);
    else if (heldNow && live && drag) setSkeleton(measureSkeleton(root, heldNow, live, drag.start, optionsRef.current.names, leftEdge(), boxOf));
    if (viaKeys.current && heldNow && drag && initial) {
      const own = root.querySelector<HTMLElement>(`${SELECTOR[heldNow.type]}[data-skel-id="${heldNow.id}"]`);
      if (own) {
        const box = boxOf(own);
        setKeyboardAt({ x: box.x - initial.left, y: box.y - initial.top });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  // The held copy: the markup of its own element at its own size, taken after the page has drawn the hold.
  const copied = drag?.held.id ?? null;
  const copyDone = drag ? drag.html !== "" : true;
  useLayoutEffect(() => {
    const current = dragRef.current;
    const root = rootRef.current;
    if (!current || !root || current.html !== "" || current.incoming) return;
    const element = root.querySelector<HTMLElement>(`${SELECTOR[current.held.type]}[data-skel-id="${current.held.id}"]`);
    if (!element) return;
    const box = element.getBoundingClientRect();
    const source = element.firstElementChild instanceof HTMLElement && (current.held.type === "tile" || current.held.type === "nested") ? element.firstElementChild : element;
    set({ ...current, html: cloneHtml(source), size: { w: box.width, h: box.height } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copied, copyDone]);

  /** Where the pointer puts the held thing now. Run at most once a frame; every box it reads comes from the animator's places. */
  const decide = useEffectEvent(() => {
    const current = dragRef.current;
    const root = rootRef.current;
    if (!current || !root) return;
    const o = optionsRef.current;
    // UX-02 P3: an item from Sources has a place only while the pointer is over the List; off it, the List is as it was, at once.
    if (current.incoming) {
      const box = drawnBox(root);
      const { x, y } = pointer.current;
      if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) {
        window.clearTimeout(timers.current.send);
        candidate.current.send = null;
        if (current.send || !sameModel(current.live, current.start)) set({ ...current, live: current.start, send: null });
        return;
      }
    }
    // UX-02 P3: a file from Sources that is already sent with a tile stays so while the pointer is anywhere on that tile: its slot has
    // closed and the tile has moved up under the pointer, which must not take the target away again.
    if (current.incoming && current.send) {
      const target = root.querySelector(`[data-skel-kind="tile"][data-skel-id="${current.send}"]`);
      const box = target ? boxOf(target) : null;
      const { x, y } = pointer.current;
      if (box && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return;
    }
    const canTake = current.incoming ? (_held: string, id: string) => current.incoming?.source === "file" && Boolean(o.takesFile?.(id)) : o.canTake;
    const found = placeAt(root, current.held, current.start, pointer.current, { canTake, collapsed: o.collapsed, boxOf });
    // While it is over a tile that could take it, its slot stays where it was, so that tile does not move from under the pointer.
    const placement = current.incoming && found.sendCandidate ? { ...found, model: current.live } : found;
    // The tile that could take the held one: held over for `DWELL_SEND_MS`, it becomes the target and the place leaves.
    if (placement.sendCandidate !== candidate.current.send) {
      window.clearTimeout(timers.current.send);
      candidate.current.send = placement.sendCandidate;
      if (current.send && placement.sendCandidate !== current.send) {
        set({ ...current, send: null });
      }
      if (placement.sendCandidate) {
        const target = placement.sendCandidate;
        timers.current.send = window.setTimeout(() => {
          const now = dragRef.current;
          if (!now || candidate.current.send !== target) return;
          set({ ...now, send: target, live: withoutTile(now.start, now.held.id) });
          setSaid(`Attach to ${optionsRef.current.names.tile(target)}`);
        }, DWELL_SEND_MS);
      }
    }
    if (placement.folded !== candidate.current.open) {
      window.clearTimeout(timers.current.open);
      candidate.current.open = placement.folded;
      if (placement.folded) {
        const key = placement.folded;
        timers.current.open = window.setTimeout(() => {
          if (candidate.current.open === key) optionsRef.current.onOpen?.(key);
        }, DWELL_OPEN_MS);
      }
    }
    const now = dragRef.current;
    if (!now || now.send) return;
    if (!sameModel(now.live, placement.model)) {
      const next = { ...now, live: placement.model };
      set(next);
      setSaid(overLine(now.held, placement.model, o.names));
    }
  });

  // The pointer, wherever it is on the page. A move or a scroll asks for one decision on the next frame; however many come in a
  // frame, it is made once. Both listeners are passive: neither calls `preventDefault`.
  const holding = drag !== null;
  useEffect(() => {
    if (!holding) return;
    const ask = () => {
      if (frame.current === 0) {
        frame.current = window.requestAnimationFrame(() => {
          frame.current = 0;
          decide();
        });
      }
    };
    const move = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      ask();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", ask, { passive: true, capture: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", ask, { capture: true });
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
    // `decide` is an effect event: it reads the latest of everything without being a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holding]);

  useEffect(
    () => () => {
      for (const key of Object.keys(timers.current) as (keyof typeof timers.current)[]) window.clearTimeout(timers.current[key]);
    },
    [],
  );

  const fadeOut = (after: number) => {
    window.clearTimeout(timers.current.fade);
    timers.current.fade = window.setTimeout(() => {
      setSkeletonShown(false);
      window.clearTimeout(timers.current.settle);
      timers.current.settle = window.setTimeout(() => {
        setSkeleton(null);
        setHidden(null);
      }, prefersReducedMotion() ? 0 : SETTLE_MS);
    }, prefersReducedMotion() ? 0 : after);
  };

  const onDragStart = (event: DragStartEvent) => {
    const o = optionsRef.current;
    const dragId = String(event.active.id);
    if (isSourceDrag(dragId)) return startIncoming(event, dragId);
    const held = heldOf(dragId, o.model);
    const root = rootRef.current;
    if (!held || !root) return;
    setSettles(true);
    window.clearTimeout(timers.current.fade);
    window.clearTimeout(timers.current.settle);
    setSettleMs(null);
    const from = point(event.activatorEvent as Event);
    viaKeys.current = (event.activatorEvent as Event | null)?.type === "keydown";
    const pressed = (event.activatorEvent as Event | null)?.target;
    fromSurface.current = !viaKeys.current && (held.type === "tile" || held.type === "nested") && pressed instanceof Element && !pressed.closest('[data-testid$="drag-handle"]');
    setKeyboardAt(null);
    if (from) pointer.current = from;
    // Its copy is made once the page has drawn the hold (no tile shows what it shows when it is near), in `useLayoutEffect` below.
    const next: Drag = { held, start: o.model, live: o.model, send: null, html: "", size: { w: 0, h: 0 } };
    setHidden(held.id);
    setSkeletonShown(true);
    setPending(null);
    const rect = event.active.rect.current.initial;
    // Prompt 6 G7: a tile of the list keeps to its column. dnd-kit has often not measured it yet here, so its own box is read once.
    const column = held.type === "tile" || held.type === "nested";
    const own = column && !rect ? root.querySelector(`${SELECTOR[held.type]}[data-skel-id="${held.id}"]`)?.getBoundingClientRect() : undefined;
    setInitial(rect ? { left: rect.left, top: rect.top, ...(column ? { column: true } : null) } : own ? { left: own.left, top: own.top, column: true } : null);
    set(next);
    setSaid(pickedLine(held, o.model, o.names));
  };

  /**
   * UX-02 P3: a row of Sources picked up. A session already in the build moves as its head would; a session to add and a file are
   * incoming: not in the build's model, placed by the same pointer and boxes once over the List. The held copy is the row's own markup.
   */
  const startIncoming = (event: DragStartEvent, dragId: string) => {
    const o = optionsRef.current;
    const data = event.active.data.current as SourceDragData | undefined;
    const row = document.querySelector<HTMLElement>(`[data-source-drag="${dragId}"]`);
    if (!data || !row || !rootRef.current || !o.add) return;
    const inBuild = data.source === "session" && Boolean(locate(o.model, data.id));
    const held: Held = data.source === "session" ? { id: data.id, type: "session" } : { id: `${INCOMING_FILE}${data.id}`, type: "tile" };
    window.clearTimeout(timers.current.fade);
    window.clearTimeout(timers.current.settle);
    setSettleMs(null);
    viaKeys.current = (event.activatorEvent as Event | null)?.type === "keydown";
    setKeyboardAt(null);
    const from = point(event.activatorEvent as Event);
    if (from) pointer.current = from;
    const box = row.getBoundingClientRect();
    const size = { w: box.width, h: box.height };
    const source: Incoming | undefined = inBuild ? undefined : { source: data.source, id: data.id };
    setSettles(inBuild);
    setIncoming(source ? { ...source, held, size } : null);
    setHidden(held.id);
    setSkeletonShown(true);
    setPending(null);
    const rect = event.active.rect.current.initial;
    setInitial(rect ? { left: rect.left, top: rect.top } : null);
    set({ held, start: o.model, live: o.model, send: null, html: cloneHtml(row), size, ...(source ? { incoming: source } : null) });
    setSaid(inBuild ? pickedLine(held, o.model, o.names) : `Picked up ${data.source === "session" ? "a session" : "a file"} from Sources.`);
  };

  /** An item from Sources let go off the List, or Escape: nothing is written, and the List is as it was at once. */
  const dropIncoming = () => {
    clearTimers();
    dragRef.current = null;
    setDrag(null);
    setPending(null);
    setSkeleton(null);
    setSkeletonShown(false);
    setHidden(null);
    setIncoming(null);
    setTick((value) => value + 1);
    setSaid("Not added.");
  };

  /** The pointer is read from the window (`decide`), so scrolling while held keeps the place under it. */
  const onDragMove = (_event: DragMoveEvent) => undefined;

  /** Slide back to where it was picked up from. */
  const putBack = (current: Drag) => {
    clearTimers();
    setSettleMs(SETTLE_MS);
    const start = current.start;
    setSaid(putBackLine(current.held, start, optionsRef.current.names));
    dragRef.current = null;
    setDrag(null);
    setPending({ model: start, held: current.held });
    setTick((value) => value + 1);
    fadeOut(SETTLE_MS);
    window.setTimeout(() => setPending((value) => (value && value.model === start ? null : value)), SETTLE_MS + 50);
  };

  const coordinateGetter: KeyboardCoordinateGetter = (event, { currentCoordinates }) => {
    if (event.code !== "ArrowUp" && event.code !== "ArrowDown") return undefined;
    const current = dragRef.current;
    if (current) {
      const by = event.code === "ArrowUp" ? -1 : 1;
      const o = optionsRef.current;
      const result = moveBy(current.live, current.held.id, by);
      if (!result) setSaid(`${overLine(current.held, current.live, o.names)} That is the ${by === -1 ? "first" : "last"} place.`);
      else {
        set({ ...current, live: result.model });
        setSaid(overLine(current.held, result.model, o.names));
      }
    }
    return currentCoordinates;
  };

  const onDragCancel = () => {
    const current = dragRef.current;
    if (current?.incoming) dropIncoming();
    else if (current) putBack(current);
  };

  /** Keep the new order showing until the data says the same; put everything back when it does not land. */
  const hold = (model: MoveModel, held: Held | null, start: MoveModel, run: Promise<unknown> | void, failed: string) => {
    setPending({ model, held });
    const finish = (ok: boolean) => {
      if (ok) return;
      setSettleMs(SETTLE_MS);
      setPending({ model: start, held });
      setTick((value) => value + 1);
      setSaid(failed);
      window.setTimeout(() => setPending(null), SETTLE_MS + 50);
    };
    Promise.resolve(run).then(
      (result) => {
        if (result === false) return finish(false);
        window.clearTimeout(timers.current.give);
        // Written: the data is in, and `pending` is let go (at once when the data says the same). A page that cannot say gets longer;
        // when the data never catches up, it was not written.
        timers.current.give = window.setTimeout(
          () => {
            setPending((current) => {
              if (!current || current.model !== model) return current;
              if (result === true) return null;
              setSettleMs(SETTLE_MS);
              setSaid(failed);
              setTick((value) => value + 1);
              window.setTimeout(() => setPending((now) => (now && now.model === start ? null : now)), SETTLE_MS + 50);
              return { model: start, held };
            });
          },
          result === true ? 400 : 2500,
        );
      },
      () => finish(false),
    );
  };

  // The data catches up with the order showing: let it go.
  useEffect(() => {
    if (pending && !drag && sameModel(pending.model, options.model)) {
      window.clearTimeout(timers.current.give);
      setPending(null);
      setIncoming(null);
    }
  }, [options.model, pending, drag]);

  const onDragEnd = (_event: DragEndEvent) => {
    const current = dragRef.current;
    if (!current) return;
    if (current.incoming) return endIncoming(current, current.incoming);
    clearTimers();
    const o = optionsRef.current;
    dragRef.current = null;
    setDrag(null);
    setTick((value) => value + 1);
    fadeOut(SETTLE_MS);
    if (viaKeys.current) setRefocus(current.held.id);
    if (current.send) {
      const target = current.send;
      setSaid(o.sentLine(current.held.id, target));
      hold(withoutTile(current.start, current.held.id), current.held, current.start, o.send(current.held.id, target), "Step not moved");
      return;
    }
    const write = writeOf(current.start, current.live, current.held.id);
    if (!write) {
      setSaid(putBackLine(current.held, current.start, o.names));
      // G9: picked up by a press on the tile and let go where it was: the click the drag took is given back.
      if (fromSurface.current && sameModel(current.live, current.start)) o.onSelect?.(current.held.id);
      return;
    }
    const was = spotOf(current.start, current.held.id) as Spot;
    const now = spotOf(current.live, current.held.id) as Spot;
    const crossed = (was.session ?? "") !== (now.session ?? "") || (was.part ?? "") !== (now.part ?? "");
    const move: Move = { kind: (current.held.type === "nested" ? "nested" : current.held.type) as MoveKind, id: current.held.id, from: was, to: now, crossed };
    const line = movedLine(move, o.names);
    setSaid(line);
    const run = o.commit({ held: current.held, write, move, start: current.start, end: current.live, sentence: line.replace(/\.$/, ""), line });
    hold(current.live, current.held, current.start, run, "Step not moved");
  };

  /**
   * UX-02 P3: an item from Sources dropped. Over a tile that takes it, a file goes inside that step; in a place, it is added there;
   * anywhere else, nothing. The slot stays until the write lands; a write that does not land puts the List back as it was.
   */
  const endIncoming = (current: Drag, source: Incoming) => {
    const o = optionsRef.current;
    const spot = spotOf(current.live, current.held.id);
    const add: IncomingAdd | null = current.send
      ? { kind: "attach-file", fileId: source.id, into: current.send }
      : !spot
        ? null
        : source.source === "file"
          ? spot.session
            ? { kind: "add-file", fileId: source.id, session: spot.session, index: spot.index }
            : null
          : { kind: "add-session", libraryId: source.id, part: spot.part ?? "", before: current.live.parts.find((part) => part.key === (spot.part ?? ""))?.sessions[spot.index + 1] ?? null };
    if (!add || !o.add) return dropIncoming();
    clearTimers();
    dragRef.current = null;
    setDrag(null);
    setTick((value) => value + 1);
    setSaid(o.addedLine?.(add) ?? "");
    const run = o.add(add);
    if (add.kind === "attach-file") {
      setSkeleton(null);
      setSkeletonShown(false);
      setHidden(null);
      setIncoming(null);
      return;
    }
    fadeOut(SETTLE_MS);
    setPending({ model: current.live, held: current.held });
    const failed = source.source === "file" ? "File not added" : "Session not added";
    void run.then(
      (ok) => {
        if (!ok) {
          setSettleMs(SETTLE_MS);
          setPending({ model: current.start, held: current.held });
          setTick((value) => value + 1);
          setSaid(failed);
          window.setTimeout(() => {
            setPending(null);
            setIncoming(null);
          }, SETTLE_MS + 50);
          return;
        }
        // A file's tile has its own id, not the slot's: the slot goes as the tile is drawn. A session keeps its key, so its order shows until the data says the same.
        if (source.source === "file") {
          setPending(null);
          setIncoming(null);
          return;
        }
        window.clearTimeout(timers.current.give);
        timers.current.give = window.setTimeout(() => {
          setPending((now) => (now && now.model === current.live ? null : now));
          setIncoming(null);
        }, 400);
      },
      () => {
        setPending(null);
        setIncoming(null);
        setSaid(failed);
      },
    );
  };

  const show = (model: MoveModel, line: string, run: Promise<unknown> | void) => {
    setSettleMs(null);
    const start = optionsRef.current.model;
    if (line) setSaid(line);
    setTick((value) => value + 1);
    hold(model, null, start, run, "Step not moved");
  };

  // Focus stays on the moved thing after a drag by the keys, with the existing focus ring, scrolled into view.
  useEffect(() => {
    if (!refocus || drag) return;
    const handle = rootRef.current?.querySelector<HTMLElement>(`[data-skel-id="${refocus}"] [data-testid$="drag-handle"]`);
    handle?.focus({ preventScroll: true });
    handle?.scrollIntoView?.({ block: "nearest" });
    setRefocus(null);
  }, [refocus, drag, tick]);

  const overlay = useMemo(() => (drag && drag.html ? { html: drag.html, w: drag.size.w, h: drag.size.h, type: drag.held.type } : null), [drag]);

  return {
    rootRef,
    live,
    holding,
    held: drag?.held ?? null,
    hidden,
    send: drag?.send ?? null,
    skeleton,
    skeletonShown,
    overlay,
    initial,
    keyboardAt: viaKeys.current ? keyboardAt : null,
    coordinateGetter,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    show,
    settleMs: settleMs !== null && (pending !== null || drag !== null) ? settleMs : null,
    incoming,
    settles,
  };
}

export { RAIL_ROOM };
