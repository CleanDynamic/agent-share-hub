// UX-02 P1: where a file dropped on the List lands, and where a new tile stands among its session's tiles. PURE: the List reads the
// boxes once, at the drop, and hands them here; the page writes.

/** A box as the page draws it. */
export interface DropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A session as drawn: its whole box, its head's box, and its top-level tiles' boxes in order. */
export interface DropSession {
  key: string;
  box: DropBox;
  head: DropBox | null;
  tiles: readonly { id: string; box: DropBox }[];
}

/** Where a new File tile goes: a session, and its place among that session's tiles (from 0; the tile count is the end). */
export interface FilePlace {
  session: string;
  index: number;
}

const inside = (point: { x: number; y: number }, box: DropBox) => point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;

/**
 * A drop on a session's head: the end of that session. Anywhere else inside a session (a gap, or a tile that does not take files):
 * the place among its tiles the pointer's line passes, by each tile's middle. Outside every session: null, and the page puts the
 * tile where the picker would (the end of the current session).
 */
export function fileDropPlace(point: { x: number; y: number }, sessions: readonly DropSession[]): FilePlace | null {
  const session = sessions.find((entry) => inside(point, entry.box));
  if (!session) return null;
  if (session.head && inside(point, session.head)) return { session: session.key, index: session.tiles.length };
  const index = session.tiles.filter((tile) => tile.box.y + tile.box.h / 2 < point.y).length;
  return { session: session.key, index };
}

/**
 * The step a new tile is put straight after so that it stands at `index` among `sessionTiles` (that session's tile ids, in order),
 * from `topOrder` (every top-level step, in order). A new tile is written last, so at the end of its session nothing moves: undefined.
 * Null: the start of the build.
 */
export function afterForIndex(topOrder: readonly string[], sessionTiles: readonly string[], index: number): string | null | undefined {
  if (index >= sessionTiles.length) return undefined;
  if (index > 0) return sessionTiles[index - 1];
  const at = topOrder.indexOf(sessionTiles[0]);
  return at > 0 ? topOrder[at - 1] : null;
}
