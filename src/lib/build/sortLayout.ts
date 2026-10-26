// CA-21 P2: the skeleton behind the build while something is held, as geometry. PURE.
//
// The page measures each component's box once when something is picked up and again on every change of order; this turns
// those boxes into what is drawn behind them: a socket behind every component of the held kind, a lane around each container,
// a rail with a tick and a number for each place, and the place the held thing would land. Nothing here touches the DOM.
//
// All numbers are the prompt's: a socket sits 4 outside its component (half the gap where the gap is under 8), a lane 8
// outside its container with radius 14, the rail 24 left of the components with ticks 10 wide from 22 to 12 left, and numbers
// ending 26 left. The rail and numbers need 40 free to the left.

export type HeldKind = "tile" | "session" | "part";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A component of the held kind, in the layer's own coordinates. */
export interface SkeletonItem {
  id: string;
  /** The container it stands in: a session (tiles), a part (sessions), or the build (parts). */
  container: string;
  rect: Rect;
  radius: number;
}

/** A container of the held kind: where its items stand. `items` is the order the page now draws them in. */
export interface SkeletonContainer {
  id: string;
  rect: Rect;
  items: readonly string[];
  /** Parts already have a frame: no second outline, only the rail and numbers. */
  framed: boolean;
  /** A short name for the place line: "Session 2", "Part 2", "Build". */
  name: string;
}

export interface SkeletonInput {
  kind: HeldKind;
  items: readonly SkeletonItem[];
  containers: readonly SkeletonContainer[];
  /** The held thing: its place is the target. */
  held: string | null;
  /** Whether it has left the place it was picked up from. */
  moved: boolean;
  /** Free room to the left of the components, in px; under `RAIL_ROOM` there is no rail and no numbers. */
  room: number;
  /** SV-05 P4: an import's sockets: each number inside its socket, `SOCKET_NUMBER_IN` from its left edge, and no rail. */
  inside?: boolean;
}

export const SOCKET_OUT = 4;
export const SOCKET_MIN_GAP = 8;
export const LANE_OUT = 8;
export const LANE_RADIUS = 14;
export const RAIL_AT = 24;
export const TICK_FROM = 22;
export const TICK_TO = 12;
export const NUMBER_END = 26;
export const RAIL_ROOM = 40;
export const RAIL_INSET = 14;
export const SESSION_TICK_DOWN = 22;
/** SV-05 P4: how far in from a socket's left edge its number stands, when the numbers are inside. */
export const SOCKET_NUMBER_IN = 10;
export const EMPTY_PLACE_HEIGHT = 44;

export interface Socket {
  id: string;
  rect: Rect;
  radius: number;
}

export interface Lane {
  id: string;
  rect: Rect;
  radius: number;
  /** False for a part, which has its own frame. */
  outline: boolean;
}

export interface Tick {
  id: string;
  /** y of the tick, in the layer's coordinates. */
  y: number;
  /** The place within its container, from 1. */
  n: number;
  /** x of the right end of the number. */
  numberRight: number;
  /** SV-05 P4: x of the left end of the number, when it stands inside its socket. */
  numberLeft?: number;
  tickFrom: number;
  tickTo: number;
}

export interface Rail {
  container: string;
  x: number;
  top: number;
  bottom: number;
  ticks: Tick[];
  /** SV-05 P4: the numbers stand inside their sockets; no rail and no ticks are drawn. */
  inside?: boolean;
}

export interface Target {
  id: string;
  rect: Rect;
  radius: number;
  /** "Lands here · Session 2 · 2 of 3" once it has moved; none while it is over its own start. */
  words: { lead: string; place: string } | null;
}

export interface Skeleton {
  kind: HeldKind;
  sockets: Socket[];
  lanes: Lane[];
  rails: Rail[];
  target: Target | null;
}

const grow = (rect: Rect, top: number, right: number, bottom: number, left: number): Rect => ({ x: rect.x - left, y: rect.y - top, w: rect.w + left + right, h: rect.h + top + bottom });

/** How far each socket sits outside its component, on every side: 4, or half the gap where the gap to a neighbour is under 8. */
export function socketReach(items: readonly SkeletonItem[]): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const reach = new Map(sorted.map((item) => [item.id, SOCKET_OUT]));
  for (let at = 0; at < sorted.length - 1; at += 1) {
    const above = sorted[at];
    const below = sorted[at + 1];
    // Side by side is not stacked: only items that overlap in x share a gap.
    if (above.rect.x + above.rect.w <= below.rect.x || below.rect.x + below.rect.w <= above.rect.x) continue;
    const gap = below.rect.y - (above.rect.y + above.rect.h);
    if (gap >= SOCKET_MIN_GAP) continue;
    const half = Math.max(0, gap) / 2;
    reach.set(above.id, Math.min(reach.get(above.id) ?? SOCKET_OUT, half));
    reach.set(below.id, Math.min(reach.get(below.id) ?? SOCKET_OUT, half));
  }
  return reach;
}

/** "Session 2 · 2 of 3", "Part 2 · 1 of 1", "Build · 3 of 4". */
export const placeLine = (name: string, index: number, count: number): string => `${name} · ${index + 1} of ${count}`;

export function skeletonOf(input: SkeletonInput): Skeleton {
  const reach = socketReach(input.items);
  const sockets: Socket[] = input.items.map((item) => {
    const out = reach.get(item.id) ?? SOCKET_OUT;
    return { id: item.id, rect: grow(item.rect, out, out, out, out), radius: item.radius + out };
  });
  const lanes: Lane[] = input.containers.map((container) => ({ id: container.id, rect: grow(container.rect, LANE_OUT, LANE_OUT, LANE_OUT, LANE_OUT), radius: LANE_RADIUS, outline: !container.framed }));
  const rails: Rail[] = [];
  const socketOf = new Map(sockets.map((socket) => [socket.id, socket]));
  if (input.inside || input.room >= RAIL_ROOM) {
    for (const container of input.containers) {
      const mine = container.items.map((id) => input.items.find((item) => item.id === id)).filter((item): item is SkeletonItem => Boolean(item));
      if (mine.length === 0) continue;
      const left = Math.min(...mine.map((item) => item.rect.x));
      const lane = grow(container.rect, LANE_OUT, LANE_OUT, LANE_OUT, LANE_OUT);
      rails.push({
        container: container.id,
        x: left - RAIL_AT,
        top: lane.y + RAIL_INSET,
        bottom: lane.y + lane.h - RAIL_INSET,
        ticks: mine.map((item, at) => ({
          id: item.id,
          n: at + 1,
          y: input.kind === "tile" ? item.rect.y + item.rect.h / 2 : item.rect.y + SESSION_TICK_DOWN,
          numberRight: item.rect.x - NUMBER_END,
          tickFrom: item.rect.x - TICK_FROM,
          tickTo: item.rect.x - TICK_TO,
          ...(input.inside ? { numberLeft: (socketOf.get(item.id)?.rect.x ?? item.rect.x) + SOCKET_NUMBER_IN } : null),
        })),
        ...(input.inside ? { inside: true } : null),
      });
    }
  }
  let target: Target | null = null;
  const held = input.held ? input.items.find((item) => item.id === input.held) : undefined;
  if (held) {
    const socket = sockets.find((entry) => entry.id === held.id) as Socket;
    const container = input.containers.find((entry) => entry.items.includes(held.id));
    const at = container ? container.items.indexOf(held.id) : 0;
    target = {
      id: held.id,
      rect: socket.rect,
      radius: socket.radius,
      words: input.moved && container ? { lead: "Lands here", place: placeLine(container.name, at, container.items.length) } : null,
    };
  }
  return { kind: input.kind, sockets, lanes, rails, target };
}

/** The room to the left of `column`, measured against the clipping edge of the page: the build column's left minus the left of what is to its left. */
export const roomLeftOf = (columnLeft: number, edge: number): number => Math.max(0, columnLeft - edge);
