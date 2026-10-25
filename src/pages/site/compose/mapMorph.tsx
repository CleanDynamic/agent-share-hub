/* CA-22 P7: List to Map, and back. On a computer, switching the tabs morphs one view into the other.

   LIST TO MAP
     1. every session's tiles fold up behind its head (`MAP_FOLD`: they rise 24 and fade);
     2. the map is drawn, hidden, and measured; each session head in the list morphs into its map box over `MAP_MORPH`: a temporary
        layer holds a copy of the head and a copy of the box, both moved from the head's place to the box's with transforms only,
        the head's words fading out and the box's fading in while they go;
     3. when the boxes land the real map is shown: its lines draw in over `MAP_LINES` (`stroke-dashoffset`), and the part labels,
        stage labels and strip fade in.
   MAP TO LIST
     1. the lines retract over 100; 2. the boxes morph back into heads (`MAP_MORPH`); 3. the tiles unfold (`dropIn`, as a fold does).
   TOO MANY. With more than `MAP_MORPH_MAX` (30) sessions, or when the map's boxes do not fit on screen, the new view fades in over
   `FAST` instead.

   Phones are untouched (they have no Map). Under reduced motion the view simply changes. A switch while another is running ends
   the running one at once. The copies are `fixed`, `pointer-events: none` and removed when they land: nothing in the page moves
   but by `transform`. */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { FOLD_RISE, MAP_FOLD, MAP_LINES, MAP_LINES_BACK, MAP_MORPH, MAP_MORPH_MAX, UNFOLD_STAGGER, UNFOLD_STAGGERED } from "@/lib/build/buildMotion";
import { FAST, STANDARD } from "@/lib/theme/motion";

import { dropIn, fadeIn, finishRunning, liftOut, motionOn, type MotionRun } from "./buildMotion";
import type { SandboxLens } from "./SandboxView";

interface Flight {
  key: string;
  /** Where it was, in the window. */
  from: DOMRect;
  /** A copy of it, as it looked. */
  html: string;
}

const LAYER = "map-morph-layer";

const copyOf = (element: HTMLElement): string => {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const node of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) {
    for (const name of ["id", "data-testid", "data-node-id", "data-skel-id", "data-skel-kind", "data-skel-container", "data-slide-id", "data-session-key", "data-workstream-group", "aria-controls", "aria-describedby", "tabindex"]) node.removeAttribute(name);
  }
  copy.style.visibility = "visible";
  return copy.outerHTML;
};

const keyOf = (element: HTMLElement): string | null => element.closest("[data-session-key]")?.getAttribute("data-session-key") ?? element.getAttribute("data-session-key");

const headsIn = (root: HTMLElement): { key: string; element: HTMLElement }[] =>
  [...root.querySelectorAll<HTMLElement>('[data-testid="build-list"] [data-testid="session-head"]')].flatMap((element) => {
    const key = keyOf(element);
    return key ? [{ key, element }] : [];
  });

const boxesIn = (root: HTMLElement): { key: string; element: HTMLElement }[] =>
  [...root.querySelectorAll<HTMLElement>('[data-testid="map-box"]')].flatMap((element) => {
    const key = element.getAttribute("data-session-key");
    return key ? [{ key, element }] : [];
  });

const fits = (box: DOMRect): boolean => box.width > 0 && box.height > 0 && box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight;

/** A copy flying from one place to another: fixed at the first, moved with a transform to the second. */
function fly(layer: HTMLElement, flight: Flight, to: DOMRect, fade: "out" | "in" | "none"): MotionRun {
  const holder = layer.ownerDocument.createElement("div");
  // SV-01: raw HTML on purpose. `flight.html` is `copyOf(element).outerHTML` above, the markup React already drew; it is never user text.
  holder.innerHTML = flight.html;
  const node = holder.firstElementChild as HTMLElement | null;
  if (!node) return { finished: Promise.resolve(), finish: () => undefined, cancel: () => undefined };
  Object.assign(holder.style, { position: "fixed", left: `${flight.from.left}px`, top: `${flight.from.top}px`, width: `${flight.from.width}px`, height: `${flight.from.height}px`, margin: "0", pointerEvents: "none", transformOrigin: "0 0", boxSizing: "border-box" });
  node.style.width = "100%";
  node.style.height = "100%";
  layer.appendChild(holder);
  const sx = flight.from.width > 0 ? to.width / flight.from.width : 1;
  const sy = flight.from.height > 0 ? to.height / flight.from.height : 1;
  const move = holder.animate([{ transform: "none", opacity: fade === "in" ? 0 : 1 }, { transform: `translate(${to.left - flight.from.left}px, ${to.top - flight.from.top}px) scale(${sx}, ${sy})`, opacity: fade === "out" ? 0 : 1 }], { duration: MAP_MORPH, easing: STANDARD, fill: "forwards", id: "bm:morph" });
  return { finished: Promise.resolve(move.finished).then(() => undefined, () => undefined), finish: () => move.finish?.(), cancel: () => move.cancel?.() };
}

/** Lines draw in from their start (`stroke-dashoffset`), or retract. */
function drawLines(root: HTMLElement, ms: number, backwards: boolean): MotionRun[] {
  return [...root.querySelectorAll<SVGPathElement>('[data-testid="map-line-stroke"], [data-testid="map-line-halo"]')].flatMap((path) => {
    const length = typeof path.getTotalLength === "function" ? path.getTotalLength() : 0;
    if (!(length > 0) || typeof path.animate !== "function") return [];
    const dash = `${length}`;
    const frames = [{ strokeDasharray: dash, strokeDashoffset: backwards ? 0 : length }, { strokeDasharray: dash, strokeDashoffset: backwards ? length : 0 }];
    const animation = path.animate(frames, { duration: ms, easing: STANDARD, fill: backwards ? "forwards" : "none", id: "bm:lines" });
    return [{ finished: Promise.resolve(animation.finished).then(() => undefined, () => undefined), finish: () => animation.finish?.(), cancel: () => animation.cancel?.() }];
  });
}

export interface LensMorph {
  /** Switch to `lens`, moving. Without motion (a phone, reduced motion) it just switches. */
  switchTo: (lens: SandboxLens) => void;
}

export function useLensMorph({ lens, onLens, getRoot }: { lens: SandboxLens; onLens: (lens: SandboxLens) => void; getRoot: () => HTMLElement | null }): LensMorph {
  const pending = useRef<{ to: SandboxLens; flights: Flight[]; crossfade: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  const runs = useRef<MotionRun[]>([]);
  const hidden = useRef<HTMLElement[]>([]);
  const onLensRef = useRef(onLens);
  onLensRef.current = onLens;

  const clear = useCallback(() => {
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    for (const run of runs.current) run.finish();
    runs.current = [];
    for (const element of hidden.current) element.style.visibility = "";
    hidden.current = [];
    document.querySelectorAll(`[data-testid="${LAYER}"]`).forEach((layer) => layer.remove());
    const root = getRoot();
    if (root) for (const element of root.querySelectorAll<HTMLElement>("*")) finishRunning(element);
  }, [getRoot]);
  useEffect(() => clear, [clear]);

  const later = (ms: number, run: () => void) => {
    timers.current.push(window.setTimeout(run, ms));
  };

  const switchTo = useCallback(
    (to: SandboxLens) => {
      const root = getRoot();
      // A switch while another runs ends it first.
      clear();
      if (!root || !motionOn() || to === lens) {
        pending.current = null;
        onLensRef.current(to);
        return;
      }
      if (to === "map") {
        const heads = headsIn(root);
        if (heads.length > MAP_MORPH_MAX || heads.length === 0) {
          pending.current = { to, flights: [], crossfade: true };
          onLensRef.current(to);
          return;
        }
        const flights = heads.map(({ key, element }) => ({ key, from: element.getBoundingClientRect(), html: copyOf(element) }));
        // 1. The tiles fold up behind their heads, all together.
        for (const { element } of heads) {
          const tiles = element.closest("[data-session-key]")?.querySelector<HTMLElement>('[data-testid="session-tiles"]');
          if (tiles) runs.current.push(liftOut([...tiles.children], { rise: FOLD_RISE, ms: MAP_FOLD }));
        }
        later(MAP_FOLD, () => {
          pending.current = { to, flights, crossfade: false };
          onLensRef.current(to);
        });
        return;
      }
      // Map to List: the lines retract, the boxes are remembered, then the list is drawn.
      const boxes = boxesIn(root);
      if (boxes.length > MAP_MORPH_MAX || boxes.length === 0) {
        pending.current = { to, flights: [], crossfade: true };
        onLensRef.current(to);
        return;
      }
      const flights = boxes.map(({ key, element }) => ({ key, from: element.getBoundingClientRect(), html: copyOf(element) }));
      runs.current.push(...drawLines(root, MAP_LINES_BACK, true));
      later(MAP_LINES_BACK, () => {
        pending.current = { to, flights, crossfade: false };
        onLensRef.current(to);
      });
    },
    [clear, getRoot, lens],
  );

  // The other view has been drawn: it is shown as a morph (or a crossfade), before it is painted.
  useLayoutEffect(() => {
    const work = pending.current;
    const root = getRoot();
    if (!work || !root || work.to !== lens) return;
    pending.current = null;
    const column = root.querySelector<HTMLElement>(lens === "map" ? '[data-testid="map-view"]' : '[data-testid="build-list"]');
    if (!column) return;
    if (work.crossfade) {
      runs.current.push(fadeIn([column], { ms: FAST }));
      return;
    }
    const targets = (lens === "map" ? boxesIn(root) : headsIn(root)).filter(({ key }) => work.flights.some((flight) => flight.key === key));
    const rects = new Map(targets.map(({ key, element }) => [key, element.getBoundingClientRect()]));
    if (targets.length === 0 || !targets.every(({ key }) => fits(rects.get(key) as DOMRect))) {
      runs.current.push(fadeIn([column], { ms: FAST }));
      return;
    }
    // The real view waits, unseen, while the copies fly; then it is shown.
    column.style.visibility = "hidden";
    hidden.current.push(column);
    const layer = document.createElement("div");
    layer.setAttribute("data-testid", LAYER);
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "fixed", inset: "0", pointerEvents: "none", zIndex: "90" });
    document.body.appendChild(layer);
    const flying: MotionRun[] = [];
    for (const flight of work.flights) {
      const to = rects.get(flight.key);
      if (!to) continue;
      // Going to the map, the head's words fade out as the box's fade in; coming back, the box's fade out as the head's fade in.
      flying.push(fly(layer, flight, to, "out"));
      const other = targets.find(({ key }) => key === flight.key);
      if (other) flying.push(fly(layer, { key: flight.key, from: flight.from, html: copyOf(other.element) }, to, "in"));
    }
    runs.current.push(...flying);
    later(MAP_MORPH, () => {
      layer.remove();
      column.style.visibility = "";
      hidden.current = hidden.current.filter((element) => element !== column);
      if (lens === "map") {
        runs.current.push(...drawLines(column, MAP_LINES, false));
        runs.current.push(fadeIn([...column.querySelectorAll('[data-testid="map-part-label"], [data-testid="map-stage-label"], [data-testid="map-strip"], [data-testid="map-divider"]')], { ms: MAP_LINES }));
      } else {
        const sessions = [...column.querySelectorAll<HTMLElement>('[data-testid="session-tiles"]')];
        for (const container of sessions) runs.current.push(dropIn([...container.children], { stagger: UNFOLD_STAGGER, cap: UNFOLD_STAGGERED, from: FOLD_RISE }));
      }
    });
  }, [lens, getRoot]);

  return { switchTo };
}
