/* CA-27 P3: what keeps a build of hundreds of tiles light.

   STEP ONE, `SessionTiles`: a session's tile list is drawn with `content-visibility: auto`, so the browser skips the layout and the
   paint of a session that is far from the view, with `contain-intrinsic-size` set to the height it measured when it was last drawn.
   The first time a list is drawn it is measured as it is, then the skipping is switched on; so nothing moves and nothing changes to
   look at (the build page is a document that scrolls, and a skipped list keeps its measured height in the scroll). A list that is
   folded or empty has no height to keep and is left alone.

   STEP TWO, `WindowedTile`, only where step one was not enough (it was not: the work that costs is React drawing three hundred tiles,
   not the browser laying them out). In a build of `WINDOW_FROM` tiles or more, a top-level tile is drawn only while it is within one
   and a half screens above or below the view; the rest stand as an empty box of the height they were last drawn at (an estimate,
   the average of the tiles drawn so far, until they have been). Nothing is lost by it:
     - the box keeps the tile's place, its `data-skel-*` attributes and its height, so CA-21's skeleton and drag read every tile;
     - a tile the page needs is drawn whatever its place: the selected one, the one Find or Go to it is on, the one held in a drag
       (`forced`), and `tileElement` finds a tile's box when its card is not drawn, so a movement key can scroll to it first;
     - a smaller build is not windowed at all. */

export const WINDOW_FROM = 60;
/** The tiles drawn before anything has been measured: the first screens. */
const FIRST_DRAWN = 16;
/** How many screens above and below the view are drawn. */
const SCREENS = 1.5;
/** A tile's height before it has been drawn, until some have been. */
const GUESS = 150;

const HEIGHTS = new Map<string, number>();
/** What is known of each kind of tile (a prompt, a file, a manual step): tiles of a kind stand about as tall as each other, so a tile not yet drawn is guessed at its kind's average. */
const KINDS = new Map<string, { total: number; count: number; of: Map<string, number> }>();
function note(kind: string, id: string, height: number) {
  const known = KINDS.get(kind) ?? { total: 0, count: 0, of: new Map<string, number>() };
  const before = known.of.get(id);
  if (before === undefined) known.count += 1;
  known.total += height - (before ?? 0);
  known.of.set(id, height);
  KINDS.set(kind, known);
}
const guess = (kind: string): number => {
  const known = KINDS.get(kind);
  if (known && known.count > 0) return known.total / known.count;
  let total = 0;
  let count = 0;
  for (const other of KINDS.values()) {
    total += other.total;
    count += other.count;
  }
  return count > 0 ? total / count : GUESS;
};

/** One observer for every tile: told when a tile comes within SCREENS of the view, or goes past it. */
const LISTENERS = new Map<Element, (near: boolean) => void>();
let observer: IntersectionObserver | null = null;
let observedFor = 0;
function sharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  const height = typeof window === "undefined" ? 0 : window.innerHeight;
  // A window that has changed size by a third gets a new margin.
  if (observer && Math.abs(height - observedFor) < observedFor / 3) return observer;
  observer?.disconnect();
  observedFor = height;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) LISTENERS.get(entry.target)?.(entry.isIntersecting);
    },
    { rootMargin: `${Math.round(height * SCREENS)}px 0px` },
  );
  for (const element of LISTENERS.keys()) observer.observe(element);
  return observer;
}

/** A tile's box when its card is drawn or not: the card (`data-node-id`), else the box the card stands in. */
export const tileElement = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`) ?? document.querySelector<HTMLElement>(`[data-skel-kind="tile"][data-skel-id="${CSS.escape(id)}"]`);

export interface WindowedTileProps {
  id: string;
  /** The kind of tile, for guessing the height of one that has not been drawn. */
  kind: string;
  /** Its place among the top-level tiles, for the first screens that are drawn before anything is measured. */
  index: number;
  /** Drawn whatever its place. */
  forced: boolean;
  /** The box's own attributes and style (the skeleton's, the slide's, the held tile's). */
  box: Omit<HTMLAttributes<HTMLDivElement>, "children"> & Record<string, unknown>;
  render: () => ReactNode;
}

export function WindowedTile({ id, kind, index, forced, box, render }: WindowedTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(index < FIRST_DRAWN);
  const drawn = near || forced;

  useLayoutEffect(() => {
    const element = ref.current;
    const watch = sharedObserver();
    if (!element || !watch) {
      setNear(true);
      return;
    }
    LISTENERS.set(element, setNear);
    watch.observe(element);
    return () => {
      LISTENERS.delete(element);
      observer?.unobserve(element);
    };
  }, []);

  /* Drawn, its height is kept; undrawn, the box holds it. */
  useLayoutEffect(() => {
    const element = ref.current;
    if (!drawn || !element) return;
    const read = () => {
      const height = element.getBoundingClientRect().height;
      if (height > 0) {
        HEIGHTS.set(id, height);
        note(kind, id, height);
      }
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(element);
    return () => watch.disconnect();
  }, [drawn, id, kind]);

  useEffect(() => () => void HEIGHTS.delete(id), [id]);

  const style: CSSProperties = { ...(box.style as CSSProperties | undefined), ...(drawn ? null : { height: HEIGHTS.get(id) ?? guess(kind) }) };
  return (
    <div {...box} ref={ref} style={style} data-drawn={drawn ? "true" : "false"}>
      {drawn ? render() : null}
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";

/** The last height each session's list was drawn at, by key; kept across a re-draw so a list that comes back is not measured again. */
const MEASURED = new Map<string, number>();

/** How far a paint may reach past a list's box: a focus ring, a selected tile's shadow. The skipping clips to this. */
const CLIP_MARGIN = 12;

export interface SessionTilesProps {
  id: string;
  /** The session's key, for its measured height. */
  sessionKey: string;
  hidden?: boolean;
  /** The build is a large one (`WINDOW_FROM` tiles or more): only then is a list skipped. A smaller build is drawn exactly as it always was. */
  skip: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

export function SessionTiles({ id, sessionKey, hidden = false, skip, style, children }: SessionTilesProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(MEASURED.get(sessionKey) ?? null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || hidden) return;
    const read = () => {
      const now = element.getBoundingClientRect().height;
      if (now <= 0) return;
      MEASURED.set(sessionKey, now);
      setHeight((before) => (before !== null && Math.abs(before - now) < 0.01 ? before : now));
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(read);
    watch.observe(element);
    return () => watch.disconnect();
  }, [sessionKey, hidden]);

  useEffect(() => () => void MEASURED.delete(sessionKey), [sessionKey]);

  const skipping: CSSProperties | null = skip && height !== null && !hidden ? { contentVisibility: "auto", containIntrinsicSize: `auto ${height}px`, overflowClipMargin: CLIP_MARGIN } : null;
  return (
    <div id={id} ref={ref} data-testid="session-tiles" hidden={hidden} style={{ ...style, ...skipping }}>
      {children}
    </div>
  );
}

/**
 * Keeps a tile where a jump sent it. In a windowed build the tiles above a far tile are boxes of a guessed height until the jump has
 * passed them; as each is drawn and measured, what was guessed shifts. For a moment after the jump, every frame says whether the tile
 * is still where it was sent (`keep`) and puts it back (`put`) if it is not. Any scroll the person makes ends it. Returns a stop.
 */
export function settle(keep: () => boolean, put: () => void, ms = 1500): () => void {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return () => undefined;
  let frame = 0;
  let stopped = false;
  const began = performance.now();
  const stop = () => {
    stopped = true;
    window.cancelAnimationFrame(frame);
    for (const event of ["wheel", "touchmove", "keydown", "mousedown"]) window.removeEventListener(event, stop, true);
  };
  for (const event of ["wheel", "touchmove", "keydown", "mousedown"]) window.addEventListener(event, stop, { capture: true, passive: true, once: true });
  const tick = (now: number) => {
    if (stopped) return;
    if (!keep()) put();
    if (now - began < ms) frame = window.requestAnimationFrame(tick);
    else stop();
  };
  frame = window.requestAnimationFrame(tick);
  return stop;
}

/**
 * Home and End in a windowed build: the first or last tile may not be drawn. It is chosen (so it is drawn), scrolled to, and given
 * focus once its card is there. Returns false when that tile is drawn already and the list's own movement will do.
 */
export function jumpToEdge(root: HTMLElement, end: boolean, choose: (id: string) => void): boolean {
  const boxes = [...root.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')];
  const box = end ? boxes.at(-1) : boxes[0];
  const id = box?.dataset.skelId;
  if (!box || !id || box.dataset.drawn !== "false") return false;
  choose(id);
  box.scrollIntoView?.({ block: "nearest" });
  let tries = 0;
  const focus = () => {
    const card = root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    if (card) {
      card.focus();
      return;
    }
    if ((tries += 1) < 30) window.requestAnimationFrame(focus);
  };
  window.requestAnimationFrame(focus);
  settle(
    () => {
      const now = tileElement(id)?.getBoundingClientRect();
      return !now || now.height === 0 || (now.top >= 0 && now.bottom <= window.innerHeight) || now.height > window.innerHeight;
    },
    () => tileElement(id)?.scrollIntoView?.({ block: "nearest" }),
  );
  return true;
}
