/* MS-05 — the map canvas, drawn for the maker (the composer's Sessions view) and for readers (the build page). Read only:
   MS-06 adds editing through `selected` and `onSelect`.

   1. MEASURE. Every tile is the List's own card (`StepTile`, README Decision 14), so heights come from the card as drawn: a
      hidden layer renders each tile once at its slot's width, and each box's head at its width, and `geometryOf` reads
      those heights. Widths never depend on heights, so one pass settles it; the layer is read in a layout effect, before
      the browser paints, and the canvas stays hidden until every size it uses is measured, so nothing jumps. A
      `ResizeObserver` on the layer catches later changes (fonts arriving).
   2. DRAW. Frames for regions, boxes with their heads, tiles in their slots, notes with leader lines, then one SVG on top
      for the build's lines (`routeLines`, MS-04) and two-way arrows.
   3. READ. The canvas is a list of boxes in reading order (`readingOrder`, MS-03), each a group named by its title and
      session, holding its tiles as list items. Lines, frames and outlines are hidden from screen readers; each tile's
      description says what it uses and what uses it, from the lines' sentences.
   4. PAINT. The canvas's tokens are re-declared from the theme whose ink reads on its background (`canvasScope`), so the
      canvas looks the same in either theme. */

import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from "react";

import { groupKey, groupOfStep, type SessionGroup, type Step } from "@/lib/build/graph";
import { MAP_GRID, MAP_WIDTH, geometryOf, type MapGeometry, type Measure } from "@/lib/build/mapGeometry";
import { boxes, type MapBox, type MapEnd, type MapLayout, type MapNode, type MapRegion, type MapTilePart } from "@/lib/build/mapLayout";
import { hiddenCount, mapLinks, routeLines, type MapLine, type MapRoute } from "@/lib/build/mapLines";
import { isLevel, readingOrder } from "@/lib/build/mapOrder";
import { sessionsMetaOf } from "@/lib/build/making";
import { sessionMapFor, type MapPieceLike } from "@/lib/build/sessionMap";
import { workstreamMark } from "@/lib/build/workstreams";

import type { ListResult } from "./buildListModel";
import {
  BOX,
  BOX_EXPLANATION,
  BOX_TAB,
  BOX_TITLE,
  BOX_TITLE_SIDE,
  FRAME,
  FRAME_TAB,
  LINES,
  REMOVED_HEIGHT,
  REMOVED_SLOT,
  backgroundOf,
  boxStyle,
  canvasScope,
  dotGrid,
  inkFor,
} from "./canvasRecipes";
import { StepTile } from "./StepTile";

/** Every string the canvas says. */
export const MAP_CANVAS_COPY = {
  canvas: "The map",
  removed: "Removed from the build",
  session: (number: number) => `Session ${number}`,
  sessionTab: (number: number) => `S${number}`,
  textBox: "Text",
  result: "Result",
  hidden: (count: number) => (count === 1 ? "1 link is hidden on this map." : `${count} links are hidden on this map.`),
};

export interface MapCanvasProps {
  layout: MapLayout;
  steps: Step[];
  groups: SessionGroup[];
  files: MapPieceLike[];
  making: unknown;
  /** The build's Results: not steps, so given beside them (`ListResult`). */
  results?: ListResult[];
  mode: "maker" | "reader";
  /** MS-06 uses these. */
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  /** A tile clicked in reader mode: the build page opens its Full prompt window. */
  onOpenTile?: (id: string) => void;
}

/** Sizes before anything is measured (and in a test DOM, which measures nothing). */
const ESTIMATE = { tile: 120, title: 20, explanation: 18 } as const;
const NOTE_WIDTH = 200;
/** A drawn frame's name tab reaches this far below the frame's top edge, and as far above it. */
const FRAME_HEAD = 8;
const FRAME_TAB_ROOM = 10;

const tileKey = (id: string, width: number, parts: readonly MapTilePart[]) => `${id}|${Math.round(width)}|${parts.join(",")}`;
const headKey = (id: string, width: number) => `${id}|${Math.round(width)}`;
const partsOf = (box: MapBox, tile: string): MapTilePart[] => box.show[tile] ?? ["text"];

interface Request { key: string; width: number }
interface TileRequest extends Request { id: string; parts: MapTilePart[] }
interface HeadRequest extends Request { box: MapBox }

/** What a box's head says: its own title or the session's, the session's tab and harness, its explanation. */
interface BoxHead { title: string; tab?: string; side?: string; explanation?: string; name: string }

/** The layout a reader sees: tiles the build no longer has are left out (README Decision 6). */
function withoutRemoved(layout: MapLayout, exists: (id: string) => boolean): MapLayout {
  const strip = (node: MapNode): MapNode => {
    if (node.kind === "box") return node.tiles.every(exists) ? node : { ...node, tiles: node.tiles.filter(exists) };
    if (node.kind === "region") return { ...node, child: strip(node.child) };
    return { ...node, children: node.children.map(strip) };
  };
  return { ...layout, root: strip(layout.root) };
}

/** A session region drawn as a frame: one that holds more than its one box (a lone box carries the session's tab itself). */
const framed = (region: MapRegion) => "part" in region.of || region.child.kind !== "box";

export function MapCanvas({ layout: stored, steps, groups, files, making, results = [], mode, selected = null, onSelect, onOpenTile }: MapCanvasProps) {
  const reader = mode === "reader";
  const markerId = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement | null>(null);
  const layer = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(0);
  const [tileSizes, setTileSizes] = useState<ReadonlyMap<string, number>>(new Map());
  const [headSizes, setHeadSizes] = useState<ReadonlyMap<string, number>>(new Map());

  /* ── the build ── */
  const stepById = useMemo(() => new Map(steps.map((step) => [step.id, step])), [steps]);
  const resultById = useMemo(() => new Map(results.map((result) => [result.id, result])), [results]);
  const exists = useCallback((id: string) => stepById.has(id) || resultById.has(id), [stepById, resultById]);
  const model = useMemo(() => {
    const made = sessionMapFor({ groups, steps, files, making });
    // A session's title is the maker's (`sessions_meta`) when its group has none.
    const meta = sessionsMetaOf(making);
    return { ...made, sessions: made.sessions.map((session) => (session.title ? session : { ...session, title: meta[session.key]?.title || undefined })) };
  }, [groups, steps, files, making]);
  const sessionOfTile = useMemo(() => {
    const out = new Map<string, SessionGroup>();
    for (const step of steps) {
      const group = groupOfStep(groups, step);
      if (group) out.set(step.id, group);
    }
    for (const result of results) {
      const from = steps.find((step) => step.number === result.from);
      const group = from ? out.get(from.id) : undefined;
      if (group) out.set(result.id, group);
    }
    return out;
  }, [steps, groups, results]);

  /* ── the layout at the width it is drawn ── */
  useLayoutEffect(() => {
    if (!reader) return;
    const el = wrap.current;
    if (!el) return;
    const read = () => setRoom(el.clientWidth);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [reader]);
  const layout = useMemo(() => {
    const shown = reader ? withoutRemoved(stored, exists) : stored;
    // A reader's canvas takes the reader's width, never wider than the maker's; proportions scale it (phones are MS-13's).
    const width = reader && room > 0 ? Math.max(MAP_WIDTH.min, Math.min(stored.width, room)) : stored.width;
    return width === shown.width ? shown : { ...shown, width };
  }, [stored, reader, exists, room]);

  const headOf = useCallback(
    (box: MapBox): BoxHead => {
      const group = box.tiles.map((id) => sessionOfTile.get(id)).find(Boolean);
      const session = group ? model.sessions.find((entry) => entry.key === groupKey(group)) : undefined;
      const sessionTitle = session ? (session.title ?? MAP_CANVAS_COPY.session(session.number)) : undefined;
      const onlyResults = box.tiles.length > 0 && box.tiles.every((id) => resultById.has(id));
      const title = box.title || (onlyResults ? MAP_CANVAS_COPY.result : sessionTitle) || MAP_CANVAS_COPY.textBox;
      const name = [title, session && title !== MAP_CANVAS_COPY.session(session.number) ? MAP_CANVAS_COPY.session(session.number) : null].filter(Boolean).join(", ");
      return { title, tab: session ? MAP_CANVAS_COPY.sessionTab(session.number) : undefined, side: onlyResults ? undefined : (session?.app ?? undefined), explanation: box.explanation, name };
    },
    [sessionOfTile, model, resultById],
  );

  /* ── 1. measure ── */
  const measured = useMemo(() => {
    const tiles: TileRequest[] = [];
    const heads: HeadRequest[] = [];
    let missing = false;
    const measure: Measure = {
      tile: (id, width, parts) => {
        if (!exists(id)) return { height: REMOVED_HEIGHT, minWidth: MAP_GRID.minBoxPx };
        const key = tileKey(id, width, parts);
        tiles.push({ key, id, width, parts });
        const height = tileSizes.get(key);
        if (height === undefined) missing = true;
        return { height: height ?? ESTIMATE.tile, minWidth: MAP_GRID.minBoxPx };
      },
      chrome: (node, width) => {
        if (node.kind === "region") return { head: framed(node) ? FRAME_HEAD : 0, noteWidth: NOTE_WIDTH };
        const key = headKey(node.id, width);
        heads.push({ key, box: node, width });
        const height = headSizes.get(key);
        if (height === undefined) missing = true;
        return { head: height ?? ESTIMATE.title + (node.explanation ? ESTIMATE.explanation : 0) + BOX.headBelow, noteWidth: NOTE_WIDTH };
      },
    };
    const geometry = geometryOf(layout, measure);
    const unique = <T extends Request>(list: T[]) => [...new Map(list.map((item) => [item.key, item])).values()];
    return { geometry, tiles: unique(tiles), heads: unique(heads), missing };
  }, [layout, exists, tileSizes, headSizes]);
  const { geometry } = measured;

  const readLayer = useCallback(() => {
    const el = layer.current;
    if (!el) return;
    const read = (selector: string, sizes: ReadonlyMap<string, number>, extra: number, fallback: (key: string) => number) => {
      let next: Map<string, number> | null = null;
      el.querySelectorAll<HTMLElement>(selector).forEach((item) => {
        const key = item.dataset.measure as string;
        const height = item.offsetHeight > 0 ? item.offsetHeight + extra : fallback(key);
        if (sizes.get(key) !== height) (next ??= new Map(sizes)).set(key, height);
      });
      return next;
    };
    const nextTiles = read("[data-measure-tile]", tileSizes, 0, () => ESTIMATE.tile);
    const nextHeads = read("[data-measure-head]", headSizes, BOX.headBelow, (key) => {
      const box = measured.heads.find((head) => head.key === key)?.box;
      return ESTIMATE.title + (box?.explanation ? ESTIMATE.explanation : 0) + BOX.headBelow;
    });
    if (nextTiles) setTileSizes(nextTiles);
    if (nextHeads) setHeadSizes(nextHeads);
  }, [tileSizes, headSizes, measured.heads]);
  useLayoutEffect(readLayer, [readLayer, measured.tiles, measured.heads]);
  // The measuring layer's tiles are real cards: nothing in it may take focus or a click.
  useLayoutEffect(() => layer.current?.setAttribute("inert", ""), []);
  useLayoutEffect(() => {
    const el = layer.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => readLayer());
    el.querySelectorAll("[data-measure]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [readLayer, measured.tiles, measured.heads]);

  /* ── numbers (README Decision 11) ── */
  const badgeOf = useCallback(
    (id: string): string | undefined => {
      if (layout.numbers === "build" || !stepById.has(id)) return undefined;
      const group = sessionOfTile.get(id);
      if (!group) return undefined;
      const position = group.stepNumbers.indexOf((stepById.get(id) as Step).number) + 1;
      const session = `S${group.number}·${position}`;
      if (layout.numbers === "session") return session;
      const part = model.parts.find((entry) => entry.sessions.includes(groupKey(group)));
      return part ? `${workstreamMark(part.index, model.labels)}·${session}` : session;
    },
    [layout.numbers, stepById, sessionOfTile, model],
  );

  /* ── lines ── */
  const lines = useMemo<MapLine[]>(() => mapLinks(steps, files, layout, results), [steps, files, layout, results]);
  const routes = useMemo<MapRoute[]>(() => routeLines(geometry, lines, layout), [geometry, lines, layout]);
  const describe = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const line of lines) {
      for (const end of [line.from, line.to]) out.set(end, [...(out.get(end) ?? []), ...line.sentences]);
    }
    return out;
  }, [lines]);

  /* ── reading order ── */
  const order = useMemo(() => readingOrder(geometry), [geometry]);
  const allBoxes = useMemo(() => boxes(layout), [layout]);
  const boxOrder = useMemo(() => {
    const first = (box: MapBox) => Math.min(...box.tiles.map((id) => order.indexOf(id)).filter((at) => at >= 0), Number.POSITIVE_INFINITY);
    const rect = (box: MapBox) => geometry.nodes[box.id];
    return allBoxes
      .filter((box) => rect(box))
      .sort((a, b) => first(a) - first(b) || rect(a).y - rect(b).y || rect(a).x - rect(b).x);
  }, [allBoxes, order, geometry]);

  const ink = inkFor(layout.background);
  const scope = useMemo(() => canvasScope(layout.background), [layout.background]);
  const click = useCallback((id: string) => (reader ? onOpenTile?.(id) : onSelect?.(id)), [reader, onOpenTile, onSelect]);
  const hidden = hiddenCount(lines);

  return (
    // The top padding leaves room for a frame's name tab, which sits across the canvas's top edge when a frame starts there.
    <div ref={wrap} data-testid="map-canvas-wrap" style={{ position: "relative", minWidth: 0, paddingTop: FRAME_TAB_ROOM }}>
      <div
        data-testid="map-canvas"
        data-canvas-paint=""
        data-mode={mode}
        data-measuring={measured.missing ? "" : undefined}
        style={{
          ...scope,
          ...(layout.dotGrid ? dotGrid(ink.dots) : null),
          position: "relative",
          width: geometry.width,
          height: geometry.height,
          borderRadius: BOX.radius,
          visibility: measured.missing ? "hidden" : undefined,
        }}
      >
        <Frames layout={layout} geometry={geometry} model={model} ink={ink} />
        <ul aria-label={MAP_CANVAS_COPY.canvas} style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {boxOrder.map((box) => (
            <BoxItem
              key={box.id}
              box={box}
              head={headOf(box)}
              geometry={geometry}
              background={layout.background}
              reader={reader}
              exists={exists}
              stepById={stepById}
              resultById={resultById}
              steps={steps}
              order={order}
              describe={describe}
              badgeOf={badgeOf}
              selected={selected}
              onClick={click}
            />
          ))}
        </ul>
        <Lines geometry={geometry} layout={layout} routes={routes} ink={ink} markerId={markerId} />
        {reader && hidden > 0 ? <p style={VISUALLY_HIDDEN}>{MAP_CANVAS_COPY.hidden(hidden)}</p> : null}
      </div>
      <MeasuringLayer layerRef={layer} tiles={measured.tiles} heads={measured.heads} headOf={headOf} stepById={stepById} resultById={resultById} steps={steps} badgeOf={badgeOf} scope={scope} />
    </div>
  );
}

const VISUALLY_HIDDEN: CSSProperties = { position: "absolute", width: 1, height: 1, margin: -1, padding: 0, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 };

/* ── the hidden layer that measures ── */

function MeasuringLayer({
  layerRef,
  tiles,
  heads,
  headOf,
  stepById,
  resultById,
  steps,
  badgeOf,
  scope,
}: {
  layerRef: MutableRefObject<HTMLDivElement | null>;
  tiles: TileRequest[];
  heads: HeadRequest[];
  headOf: (box: MapBox) => BoxHead;
  stepById: ReadonlyMap<string, Step>;
  resultById: ReadonlyMap<string, ListResult>;
  steps: Step[];
  badgeOf: (id: string) => string | undefined;
  scope: CSSProperties;
}) {
  return (
    <div ref={layerRef} aria-hidden="true" data-canvas-paint="" data-testid="map-measure" style={{ ...scope, position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "hidden", visibility: "hidden", pointerEvents: "none" }}>
      {tiles.map((request) => {
        const step = stepById.get(request.id);
        const result = resultById.get(request.id);
        return (
          <div key={request.key} data-measure={request.key} data-measure-tile="" style={{ width: request.width, position: "absolute" }}>
            {step ? <StepTile tile={{ step }} steps={steps} show={request.parts} badge={badgeOf(step.id)} /> : result ? <StepTile tile={{ result }} steps={steps} /> : null}
          </div>
        );
      })}
      {heads.map((request) => (
        <div key={request.key} data-measure={request.key} data-measure-head="" style={{ width: request.width - 2 * BOX.padding, position: "absolute" }}>
          <HeadText head={headOf(request.box)} />
        </div>
      ))}
    </div>
  );
}

/* ── boxes ── */

function HeadText({ head }: { head: BoxHead }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: BOX.headGap, minWidth: 0 }}>
      <p style={{ ...BOX_TITLE, display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
        {head.tab ? (
          <span aria-hidden="true" style={BOX_TAB}>
            {head.tab}
          </span>
        ) : null}
        <span>{head.title}</span>
        {head.side ? <span style={BOX_TITLE_SIDE}>{head.side}</span> : null}
      </p>
      {head.explanation ? <p style={BOX_EXPLANATION}>{head.explanation}</p> : null}
    </div>
  );
}

function BoxItem({
  box,
  head,
  geometry,
  background,
  reader,
  exists,
  stepById,
  resultById,
  steps,
  order,
  describe,
  badgeOf,
  selected,
  onClick,
}: {
  box: MapBox;
  head: BoxHead;
  geometry: MapGeometry;
  background: string;
  reader: boolean;
  exists: (id: string) => boolean;
  stepById: ReadonlyMap<string, Step>;
  resultById: ReadonlyMap<string, ListResult>;
  steps: Step[];
  order: string[];
  describe: ReadonlyMap<string, string[]>;
  badgeOf: (id: string) => string | undefined;
  selected: string | null;
  onClick: (id: string) => void;
}) {
  const rect = geometry.nodes[box.id];
  const tiles = box.tiles.filter((id) => geometry.tiles[id] && (exists(id) || !reader)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return (
    <li
      data-testid="map-box"
      data-box-id={box.id}
      style={{
        ...boxStyle(box.style, background),
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        padding: BOX.padding,
        // MS-13 measures this: boxes far off screen skip their drawing, keeping their size.
        contentVisibility: "auto",
        containIntrinsicSize: `${rect.width}px ${rect.height}px`,
      }}
    >
      <section role="group" aria-label={head.name}>
        <HeadText head={head} />
        {tiles.length ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {tiles.map((id) => {
              const slot = geometry.tiles[id];
              const step = stepById.get(id);
              const result = resultById.get(id);
              const words = describe.get(id);
              const descriptionId = `map-tile-${box.id}-${id}`;
              return (
                <li
                  key={id}
                  data-testid="map-tile"
                  data-tile-id={id}
                  aria-describedby={words?.length ? descriptionId : undefined}
                  style={{ position: "absolute", left: slot.x - rect.x, top: slot.y - rect.y, width: slot.width, height: slot.height }}
                >
                  {step ? (
                    <StepTile tile={{ step }} steps={steps} show={partsOf(box, id)} badge={badgeOf(id)} selected={selected === id} onSelect={onClick} />
                  ) : result ? (
                    <StepTile tile={{ result }} steps={steps} selected={selected === id} onSelect={onClick} />
                  ) : (
                    <div data-testid="map-removed-tile" style={{ ...REMOVED_SLOT, height: slot.height }}>
                      {MAP_CANVAS_COPY.removed}
                    </div>
                  )}
                  {words?.length ? (
                    <span id={descriptionId} style={VISUALLY_HIDDEN}>
                      {words.join(". ")}.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
        {Object.entries(box.notes).map(([tile, note]) => {
          const at = geometry.notes[tile];
          if (!at) return null;
          return (
            <p key={tile} data-testid="map-note" style={{ ...BOX_EXPLANATION, position: "absolute", left: at.x - rect.x, top: at.y - rect.y, width: at.width, textAlign: at.side === "left" ? "right" : "left" }}>
              {note}
            </p>
          );
        })}
      </section>
    </li>
  );
}

/* ── frames and outlines ── */

function Frames({ layout, geometry, model, ink }: { layout: MapLayout; geometry: MapGeometry; model: ReturnType<typeof sessionMapFor>; ink: ReturnType<typeof inkFor> }) {
  const frames: ReactNode[] = [];
  const walk = (node: MapNode) => {
    if (node.kind === "box") return;
    if (node.kind === "split") return node.children.forEach(walk);
    const rect = geometry.nodes[node.id];
    if (rect && framed(node)) {
      const part = "part" in node.of;
      const name = node.title ?? (part ? model.parts.find((entry) => entry.key === (node.of as { part: string }).part)?.label : sessionName(model, (node.of as { session: string }).session)) ?? "";
      frames.push(
        <div
          key={node.id}
          data-testid={part ? "map-part-frame" : "map-session-frame"}
          style={{
            position: "absolute",
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            boxSizing: "border-box",
            border: `${FRAME.line}px ${part ? "dashed" : "solid"} ${part ? ink.frameQuiet : ink.frame}`,
            borderRadius: FRAME.radius,
            opacity: part ? FRAME.partOpacity : 1,
          }}
        >
          {name ? <span style={{ ...FRAME_TAB, left: FRAME.tabInset, color: ink.text, background: backgroundOf(layout.background) }}>{name}</span> : null}
        </div>,
      );
    }
    if (!node.collapsed) walk(node.child);
  };
  walk(layout.root);
  // Outlines: a session or part drawn round its loose boxes (MS-09 shapes them; here each box gets its own line).
  for (const key of layout.outlines) {
    for (const box of boxes(layout)) {
      const rect = geometry.nodes[box.id];
      const mine = box.tiles.some((id) => model.tiles[key]?.some((tile) => tile.id === id));
      if (!rect || !mine) continue;
      frames.push(
        <div key={`${key}-${box.id}`} data-testid="map-outline" style={{ position: "absolute", left: rect.x - 4, top: rect.y - 4, width: rect.width + 8, height: rect.height + 8, boxSizing: "border-box", border: `${FRAME.line}px dashed ${ink.frame}`, borderRadius: BOX.radius + 4 }} />,
      );
    }
  }
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {frames}
    </div>
  );
}

function sessionName(model: Pick<ReturnType<typeof sessionMapFor>, "sessions">, key: string): string | undefined {
  const session = model.sessions.find((entry) => entry.key === key);
  return session ? [MAP_CANVAS_COPY.sessionTab(session.number), session.title].filter(Boolean).join(" · ") : undefined;
}

/* ── lines and two-way arrows ── */

function Lines({ geometry, layout, routes, ink, markerId }: { geometry: MapGeometry; layout: MapLayout; routes: MapRoute[]; ink: ReturnType<typeof inkFor>; markerId: string }) {
  const rectOf = (end: MapEnd) => ("tile" in end ? geometry.tiles[end.tile] : geometry.nodes[end.box]);
  const arrow = LINES.arrow;
  return (
    <svg aria-hidden="true" width={geometry.width} height={geometry.height} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      <defs>
        <marker id={`${markerId}-head`} viewBox={`0 0 ${arrow} ${arrow}`} refX={arrow} refY={arrow / 2} markerWidth={arrow} markerHeight={arrow} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d={`M0 0L${arrow} ${arrow / 2}L0 ${arrow}z`} fill={ink.line} />
        </marker>
        <marker id={`${markerId}-two`} viewBox={`0 0 ${arrow} ${arrow}`} refX={arrow} refY={arrow / 2} markerWidth={arrow} markerHeight={arrow} markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d={`M0 0L${arrow} ${arrow / 2}L0 ${arrow}z`} fill={LINES.twoWayColour} />
        </marker>
      </defs>
      {routes.map((route) => (
        <polyline
          key={route.id}
          data-testid="map-line"
          data-line-id={route.id}
          points={route.points.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke={ink.line}
          strokeWidth={LINES.width}
          strokeDasharray={route.dashed ? LINES.dash : undefined}
          markerEnd={`url(#${markerId}-head)`}
        />
      ))}
      {layout.twoWay.map((pair, at) => {
        const a = rectOf(pair.a);
        const b = rectOf(pair.b);
        if (!a || !b || !isLevel(geometry, pair.a, pair.b)) return null;
        const [left, right] = a.x <= b.x ? [a, b] : [b, a];
        const y = (Math.max(left.y, right.y) + Math.min(left.y + left.height, right.y + right.height)) / 2;
        return (
          <line
            key={at}
            data-testid="map-two-way"
            x1={left.x + left.width}
            y1={y}
            x2={right.x}
            y2={y}
            stroke={LINES.twoWayColour}
            strokeWidth={LINES.twoWay}
            markerStart={`url(#${markerId}-two)`}
            markerEnd={`url(#${markerId}-two)`}
          />
        );
      })}
      {/* Notes' leader lines: from the note to the tile, level with its badge. */}
      {Object.values(geometry.notes).map((note) => {
        const x1 = note.side === "left" ? note.x + note.width : note.x;
        return <line key={`note-${note.tile}`} x1={x1} y1={note.leader.y} x2={note.leader.x} y2={note.leader.y} stroke={ink.frame} strokeWidth={1} />;
      })}
    </svg>
  );
}
