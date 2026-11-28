/* MS-07 — the shaping tools in the editor (`03-shaping-tools.png`): Split, Merge, Shared edge, Span, Even out and Match.

   Each tool shows its result before it applies (the editor's `preview`, which the canvas draws at 60% over the layout),
   checks the build's order on it (`editor.check`), and changes the map only through `editor.apply`, so each is one undo
   step. A tool that would be refused says why first: its button is marked unavailable, with the reason as its title and
   description, and pressing it shows and announces the reason. The sums are in `mapShaping.ts`.

   SPLIT. The bar's Split menu (or S): Side by side or Top and bottom. The cut shows as a dashed line, dragged with the
   pointer or stepped with the arrows, snapping to the grid and to other edges; Enter or a click splits, Escape cancels.

   EDGES. Every shared edge has a hit area over its gutter, for the pointer only (hidden from screen readers; the keyboard
   way is Ctrl or Cmd and the arrows, said in every box's description). Hovering shows the edge as a 2px line; dragging
   moves it with a readout of both widths. Alt drags one box's edge where that leaves no gap, else says so and moves the
   shared edge. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { geometryOf, MAP_GRID, type MapGeometry, type SharedEdge } from "@/lib/build/mapGeometry";
import { boxes, nodeById, type MapLayout, type MapSplit, type TreeResult } from "@/lib/build/mapLayout";
import type { OrderFacts } from "@/lib/build/mapOrder";
import { t } from "@/lib/theme/tokens";

import { CUT, EDGE, EDGE_LINE, FLOATING_RULE, GUIDE, READOUT } from "./canvasRecipes";
import { MenuContent } from "./ComposeMenu";
import {
  altAllowed,
  edgeAt,
  edgeChain,
  evenOutOf,
  keyEdge,
  MAP_SHAPING_COPY,
  matchOf,
  mergeOf,
  moveEdges,
  sameTree,
  snapEdge,
  spanOf,
  splitAt,
  splitShort,
  stepCut,
  type ResizeKey,
  type SplitAt,
} from "./mapShaping";
import { menuItem, menuSurface } from "./refinedStyles";
import type { MapEditor } from "./useMapEditor";

const { gutter: GUTTER } = MAP_GRID;
/** A press that moves less than this is a click. */
const CLICK_PX = 3;

export interface ShapingInput {
  editor: MapEditor;
  facts: OrderFacts;
  /** "Box · S2": what the bar and the sentences call a box. */
  nameOf: (id: string) => string;
  /** "Session 2" for a box's session, or null for a text box. */
  sessionOf: (boxId: string) => string | null;
  /** A pointer's place on the canvas, in canvas px. */
  toCanvas: (clientX: number, clientY: number) => { x: number; y: number };
  /** A canvas point where a refusal by the pointer is shown. */
  pointerAt: (x: number, y: number) => { x: number; y: number };
  /** Focus a box once it is drawn. */
  focusBox: (id: string) => void;
  /** The composer's live region. */
  announce: (message: string) => void;
}

interface Splitting {
  box: string;
  dir: MapSplit["dir"];
  at: SplitAt;
  /** A press on the box: where, and whether it has moved enough to be a drag. */
  press: { x: number; y: number; moved: boolean } | null;
}

interface Dragging {
  edge: SharedEdge;
  edges: SharedEdge[];
  start: number;
  base: MapLayout;
  geometry: MapGeometry;
  result: TreeResult | null;
  guide: SplitAt["guide"];
  pointer: { x: number; y: number };
  /** Alt was held where only the shared edge can move: said once, at the start. */
  fellBack: boolean;
  refused: string | null;
}

export interface Shaping {
  /** The keys the tools take, before the editor's own; true when one was used. */
  onKey: (event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }, oneBox: string | null) => boolean;
  splitting: boolean;
  splitMenu: boolean;
  setSplitMenu: (open: boolean) => void;
  /** The lines in empty new halves, for the canvas. */
  hints: Readonly<Record<string, string>>;
  /** The preview's geometry, for the canvas. */
  previewGeometry: MapGeometry | null;
  /** The floating bar's tools for the selection. */
  bar: ReactNode;
  /** Edges, the cut, guides and readouts, drawn over the canvas in canvas px. */
  layer: ReactNode;
}

/** A tool's result after the order check, and the sentence it says when applied. */
interface Tool {
  key: string;
  label: string;
  result: TreeResult;
  sentence: string;
  testId: string;
}

export function useShaping({ editor, facts, nameOf, sessionOf, toCanvas, pointerAt, focusBox, announce }: ShapingInput): Shaping {
  const { layout, selected, geometry, measure, setPreview, check } = editor;
  const [splitting, setSplitting] = useState<Splitting | null>(null);
  const [splitMenu, setSplitMenu] = useState(false);
  const [hints, setHints] = useState<Record<string, string>>({});
  const [hovered, setHovered] = useState<SharedEdge[] | null>(null);
  const [dragging, setDragging] = useState<Dragging | null>(null);

  const previewGeometry = useMemo(() => (editor.preview && measure ? geometryOf(editor.preview, measure) : null), [editor.preview, measure]);

  /* A new selection ends what the last one started: a split, a preview. */
  const selectionKey = selected.join("|");
  const lastSelection = useRef(selectionKey);
  useEffect(() => {
    if (lastSelection.current === selectionKey) return;
    lastSelection.current = selectionKey;
    setSplitting(null);
    setPreview(null);
  }, [selectionKey, setPreview]);

  /* ── Split ── */
  const showCut = useCallback(
    (box: string, dir: MapSplit["dir"], cut: number, press: Splitting["press"] = null) => {
      if (!geometry || !measure) return;
      const at = splitAt(layout, geometry, measure, box, dir, cut);
      const result = check(at.result);
      setSplitting({ box, dir, at: { ...at, result }, press });
      setPreview(result.ok ? result.layout : null);
    },
    [geometry, measure, layout, check, setPreview],
  );
  const startSplit = useCallback(
    (box: string, dir: MapSplit["dir"]) => {
      setSplitMenu(false);
      const rect = geometry?.nodes[box];
      if (!geometry || !rect) return;
      const short = dir === "across" ? splitShort(geometry, box) : null;
      if (short !== null) return editor.refuse(MAP_SHAPING_COPY.needsRoom(short));
      showCut(box, dir, dir === "across" ? rect.x + (rect.width - GUTTER) / 2 : rect.y + rect.height / 2);
      announce(MAP_SHAPING_COPY.splitting);
    },
    [geometry, editor, showCut, announce],
  );
  const cancelSplit = useCallback(() => {
    setSplitting(null);
    setPreview(null);
    announce(MAP_SHAPING_COPY.splitCancelled);
  }, [setPreview, announce]);
  const confirmSplit = useCallback(() => {
    if (!splitting) return;
    const { box, dir, at } = splitting;
    const before = new Set(boxes(layout).map((each) => each.id));
    const session = sessionOf(box);
    setSplitting(null);
    if (!editor.apply(at.result, MAP_SHAPING_COPY.splitDone(nameOf(box), dir))) return setPreview(null);
    if (!at.result.ok) return;
    const fresh = boxes(at.result.layout).find((each) => !before.has(each.id));
    if (!fresh) return;
    if (session) setHints((was) => ({ ...was, [fresh.id]: MAP_SHAPING_COPY.dropHere(session) }));
    editor.select(fresh.id);
    focusBox(fresh.id);
  }, [splitting, layout, sessionOf, editor, nameOf, setPreview, focusBox]);

  /* ── edges ── */
  const resizeByKey = useCallback(
    (box: string, key: ResizeKey) => {
      if (!geometry) return;
      const found = keyEdge(layout, geometry, box, key);
      if (!found) return editor.refuse(MAP_SHAPING_COPY.cantMove);
      const result = moveEdges(layout, geometry, [found.edge], found.by);
      if (result.ok && sameTree(result.layout, layout)) return editor.refuse(MAP_SHAPING_COPY.cantMove);
      editor.apply(result, MAP_SHAPING_COPY.resized(nameOf(box)));
    },
    [geometry, layout, editor, nameOf],
  );

  const onKey: Shaping["onKey"] = (event, oneBox) => {
    if (splitting) {
      const across = splitting.dir === "across";
      if (event.key === "Enter") return confirmSplit(), true;
      if (event.key === "Escape") return cancelSplit(), true;
      const step = across ? { ArrowRight: true, ArrowLeft: false } : { ArrowDown: true, ArrowUp: false };
      if (event.key in step && geometry) {
        showCut(splitting.box, splitting.dir, stepCut(geometry, splitting.dir, splitting.at.cut, step[event.key as keyof typeof step] as boolean));
        return true;
      }
      return false;
    }
    if (!oneBox) return false;
    const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
    if (plain && !event.shiftKey && event.key.toLowerCase() === "s") {
      setSplitMenu(true);
      return true;
    }
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      resizeByKey(oneBox, event.key as ResizeKey);
      return true;
    }
    return false;
  };

  const edgePress = (edge: SharedEdge, event: ReactPointerEvent<HTMLElement>) => {
    if (!geometry || event.button > 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pointer = toCanvas(event.clientX, event.clientY);
    const alt = event.altKey && altAllowed(layout, geometry, edge);
    const fellBack = event.altKey && !alt;
    if (fellBack) announce(MAP_SHAPING_COPY.altFallback);
    const edges = alt ? [edge] : edgeChain(geometry, edge);
    setDragging({ edge, edges, start: edge.axis === "width" ? pointer.x : pointer.y, base: layout, geometry, result: null, guide: null, pointer, fellBack, refused: null });
    setHovered(edges);
  };
  const edgeMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragging) return;
    const pointer = toCanvas(event.clientX, event.clientY);
    const along = dragging.edge.axis === "width" ? pointer.x : pointer.y;
    const from = edgeAt(dragging.edge);
    const snapped = snapEdge(dragging.base, dragging.geometry, dragging.edges, from + along - dragging.start);
    const result = check(moveEdges(dragging.base, dragging.geometry, dragging.edges, snapped.at - from));
    let refused = dragging.refused;
    if ("layout" in result) {
      setPreview(result.layout);
      refused = null;
    } else if (result.reason !== refused) {
      refused = result.reason;
      const at = pointerAt(pointer.x, pointer.y);
      editor.refuse(result.reason, { pointer: at });
    }
    setDragging({ ...dragging, result: result.ok ? result : dragging.result, guide: snapped.guide, pointer, refused });
  };
  const edgeRelease = () => {
    if (!dragging) return;
    const { result, edge, base } = dragging;
    setDragging(null);
    setHovered(null);
    if (!result || !result.ok || sameTree(result.layout, base)) return setPreview(null);
    const after = measure ? geometryOf(result.layout, measure) : dragging.geometry;
    editor.apply(result, edgeSentence(after, base, edge));
  };
  const edgeSentence = (after: MapGeometry, base: MapLayout, edge: SharedEdge) => {
    const split = nodeById(base, edge.splitId) as MapSplit | null;
    const kids = split ? split.children : [];
    const px = (id: string | undefined) => Math.round(id && after.nodes[id] ? (edge.axis === "width" ? after.nodes[id].width : after.nodes[id].height) : 0);
    return edge.axis === "width" ? MAP_SHAPING_COPY.edgeMoved(px(kids[edge.index]?.id), px(kids[edge.index + 1]?.id)) : MAP_SHAPING_COPY.heightSet(px(kids[edge.index]?.id));
  };

  /* ── the bar's tools ── */
  const tools = useMemo<{ one: Tool[]; many: Tool[] }>(() => {
    const one: Tool[] = [];
    const many: Tool[] = [];
    if (!geometry || !measure || selected.length === 0 || !selected.every((id) => nodeById(layout, id)?.kind === "box")) return { one, many };
    if (selected.length === 1) {
      const box = selected[0];
      one.push({ key: "span", label: MAP_SHAPING_COPY.span, result: check(spanOf(layout, box)), sentence: MAP_SHAPING_COPY.spanned(nameOf(box)), testId: "map-span" });
      const even = evenOutOf(layout, selected);
      if (even) one.push({ key: "even", label: MAP_SHAPING_COPY.evenOut, result: check(even), sentence: MAP_SHAPING_COPY.evened, testId: "map-even-out" });
      return { one, many };
    }
    if (selected.length === 2) {
      const merged = check(mergeOf(layout, facts, selected[0], selected[1]));
      // The merged box keeps the id of the first of the two in the tree.
      const kept = (merged.ok && selected.find((id) => nodeById(merged.layout, id))) || selected[0];
      many.push({ key: "merge", label: MAP_SHAPING_COPY.merge, result: merged, sentence: MAP_SHAPING_COPY.merged(nameOf(kept)), testId: "map-merge" });
    }
    const even = evenOutOf(layout, selected);
    if (even) many.push({ key: "even", label: MAP_SHAPING_COPY.evenOut, result: check(even), sentence: MAP_SHAPING_COPY.evened, testId: "map-even-out" });
    for (const axis of ["width", "height"] as const) {
      many.push({
        key: `match-${axis}`,
        label: axis === "width" ? MAP_SHAPING_COPY.matchWidth : MAP_SHAPING_COPY.matchHeight,
        result: check(matchOf(layout, measure, selected, axis, nameOf)),
        sentence: MAP_SHAPING_COPY.matched(axis),
        testId: `map-match-${axis}`,
      });
    }
    return { one, many };
  }, [geometry, measure, selected, layout, check, nameOf, facts]);

  const oneBox = selected.length === 1 && nodeById(layout, selected[0])?.kind === "box" ? selected[0] : null;
  const toolButton = (tool: Tool) => (
    <ToolButton
      key={tool.key}
      tool={tool}
      onPreview={(on) => setPreview(on && tool.result.ok ? tool.result.layout : null)}
      onPress={() => ("reason" in tool.result ? editor.refuse(tool.result.reason) : editor.apply(tool.result, tool.sentence))}
    />
  );
  const bar =
    oneBox || tools.many.length ? (
      <>
        {oneBox ? (
          <Menu.Root modal={false} open={splitMenu} onOpenChange={setSplitMenu}>
            <Menu.Trigger asChild>
              <Button variant="ghost" size={28} fontSize={13} data-testid="map-split" aria-pressed={splitting ? true : undefined} style={BAR_BUTTON}>
                {MAP_SHAPING_COPY.split}
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <MenuContent align="end" sideOffset={4} style={menuSurface(180)}>
                <Menu.Item data-testid="map-split-across" onSelect={() => startSplit(oneBox, "across")} style={menuItem(true, false)}>
                  {MAP_SHAPING_COPY.sideBySide}
                </Menu.Item>
                <Menu.Item data-testid="map-split-down" onSelect={() => startSplit(oneBox, "down")} style={menuItem(true, false)}>
                  {MAP_SHAPING_COPY.topAndBottom}
                </Menu.Item>
              </MenuContent>
            </Menu.Portal>
          </Menu.Root>
        ) : null}
        {tools.one.map(toolButton)}
        {tools.many.map(toolButton)}
        <span aria-hidden="true" style={FLOATING_RULE} />
      </>
    ) : null;

  /* ── the layer over the canvas ── */
  const shownEdges = dragging?.edges ?? hovered;
  const layer = geometry ? (
    <div aria-hidden="true" data-testid="map-shaping-layer" style={{ position: "absolute", left: 0, top: 0, width: geometry.width, height: geometry.height, pointerEvents: "none" }}>
      {splitting ? null : (
        <>
          {geometry.edges.map((edge) => (
            <span
              key={`${edge.axis}-${edge.splitId}-${edge.index}`}
              data-testid="map-edge"
              data-axis={edge.axis}
              data-split={edge.splitId}
              data-index={edge.index}
              onPointerEnter={() => (dragging ? undefined : setHovered(edgeChain(geometry, edge)))}
              onPointerLeave={() => (dragging ? undefined : setHovered(null))}
              onPointerDown={(event) => edgePress(edge, event)}
              onPointerMove={edgeMove}
              onPointerUp={edgeRelease}
              onPointerCancel={() => {
                setDragging(null);
                setPreview(null);
              }}
              style={hitArea(edge)}
            />
          ))}
          {shownEdges?.map((edge) => {
            const drawn = (previewGeometry && dragging ? previewGeometry.edges.find((each) => each.axis === edge.axis && each.splitId === edge.splitId && each.index === edge.index) : null) ?? edge;
            return <span key={`line-${edge.axis}-${edge.splitId}-${edge.index}`} data-testid="map-edge-line" style={edgeLine(drawn)} />;
          })}
          {dragging ? <Readout dragging={dragging} preview={previewGeometry} /> : null}
          {dragging?.guide ? <Guide guide={dragging.guide} /> : null}
        </>
      )}
      {splitting ? <SplitLayer splitting={splitting} geometry={geometry} preview={previewGeometry} toCanvas={toCanvas} onCut={showCut} onConfirm={confirmSplit} setSplitting={setSplitting} /> : null}
    </div>
  ) : null;

  return { onKey, splitting: splitting !== null, splitMenu, setSplitMenu, hints, previewGeometry, bar, layer };
}

const BAR_BUTTON: CSSProperties = { padding: "0 8px", color: t.text };

/** A bar button for a tool: unavailable, with its reason as title and description, when the tool would be refused. */
function ToolButton({ tool, onPreview, onPress }: { tool: Tool; onPreview: (on: boolean) => void; onPress: () => void }) {
  const refused = "reason" in tool.result ? tool.result.reason : null;
  const about = `${tool.testId}-why`;
  return (
    <>
      <Button
        variant="ghost"
        size={28}
        fontSize={13}
        data-testid={tool.testId}
        aria-disabled={refused ? true : undefined}
        aria-describedby={refused ? about : undefined}
        title={refused ?? undefined}
        onMouseEnter={() => onPreview(true)}
        onMouseLeave={() => onPreview(false)}
        onFocus={() => onPreview(true)}
        onBlur={() => onPreview(false)}
        onClick={onPress}
        style={{ ...BAR_BUTTON, ...(refused ? { opacity: 0.5, cursor: "not-allowed" } : null) }}
      >
        {tool.label}
      </Button>
      {refused ? (
        <span id={about} hidden>
          {refused}
        </span>
      ) : null}
    </>
  );
}

/* ── drawing ── */

/** An edge's hit area: its gutter, for the pointer only. */
function hitArea(edge: SharedEdge): CSSProperties {
  const box: CSSProperties =
    edge.axis === "width" ? { left: edge.x, top: edge.top, width: GUTTER, height: edge.bottom - edge.top, cursor: "col-resize" } : { left: edge.left, top: edge.y, width: edge.right - edge.left, height: GUTTER, cursor: "row-resize" };
  return { ...box, position: "absolute", pointerEvents: "auto", touchAction: "none" };
}

/** An edge drawn as a 2px line along the middle of its gutter. */
function edgeLine(edge: SharedEdge): CSSProperties {
  const middle = GUTTER / 2 - EDGE.line / 2;
  const at: CSSProperties =
    edge.axis === "width" ? { left: edge.x + middle, top: edge.top, width: EDGE.line, height: edge.bottom - edge.top } : { left: edge.left, top: edge.y + middle, width: edge.right - edge.left, height: EDGE.line };
  return { ...at, position: "absolute", background: EDGE_LINE, pointerEvents: "none" };
}

function Guide({ guide }: { guide: NonNullable<SplitAt["guide"]> }) {
  const style: CSSProperties = "x" in guide ? { left: guide.x, top: guide.from, width: 1, height: guide.to - guide.from } : { left: guide.from, top: guide.y, width: guide.to - guide.from, height: 1 };
  return <span data-testid="map-snap-guide" style={{ ...GUIDE, ...style }} />;
}

/** Both widths (or the height) as the edge moves, by the pointer; and the Alt fallback, said once. */
function Readout({ dragging, preview }: { dragging: Dragging; preview: MapGeometry | null }) {
  const geometry = preview ?? dragging.geometry;
  const split = nodeById(dragging.base, dragging.edge.splitId) as MapSplit | null;
  const kids = split?.children ?? [];
  const px = (id: string | undefined, axis: "width" | "height") => Math.round(id && geometry.nodes[id] ? geometry.nodes[id][axis] : 0);
  const words =
    dragging.edge.axis === "width" ? MAP_SHAPING_COPY.widths(px(kids[dragging.edge.index]?.id, "width"), px(kids[dragging.edge.index + 1]?.id, "width")) : MAP_SHAPING_COPY.height(px(kids[dragging.edge.index]?.id, "height"));
  return (
    <span data-testid="map-edge-readout" style={{ ...READOUT, left: dragging.pointer.x + 12, top: dragging.pointer.y - 30 }}>
      {words}
      {dragging.fellBack ? <span style={{ display: "block", fontFamily: "inherit", color: t.text2 }}>{MAP_SHAPING_COPY.altFallback}</span> : null}
    </span>
  );
}

/** Split's cut over the box: dragged with the pointer, a click splits. */
function SplitLayer({
  splitting,
  geometry,
  preview,
  toCanvas,
  onCut,
  onConfirm,
  setSplitting,
}: {
  splitting: Splitting;
  geometry: MapGeometry;
  preview: MapGeometry | null;
  toCanvas: ShapingInput["toCanvas"];
  onCut: (box: string, dir: MapSplit["dir"], cut: number, press: Splitting["press"]) => void;
  onConfirm: () => void;
  setSplitting: (value: Splitting | null) => void;
}) {
  const rect = geometry.nodes[splitting.box];
  if (!rect) return null;
  const across = splitting.dir === "across";
  // The line sits in the middle of the gutter the split will open: where the preview puts the new half, else at the cut.
  const fresh = preview ? geometry.leaves.length < preview.leaves.length && preview.leaves.find((id) => !geometry.nodes[id]) : null;
  const next = fresh && preview ? preview.nodes[fresh] : null;
  const line = (next ? (across ? next.x : next.y) - GUTTER : splitting.at.cut) + GUTTER / 2;
  const cut: CSSProperties = across ? { ...CUT, left: line - 1, top: rect.y, height: rect.height, borderLeftWidth: 2 } : { ...CUT, left: rect.x, top: line - 1, width: rect.width, borderTopWidth: 2 };
  const along = (event: ReactPointerEvent) => {
    const point = toCanvas(event.clientX, event.clientY);
    return { point, value: (across ? point.x : point.y) - GUTTER / 2 };
  };
  return (
    <>
      <span
        data-testid="map-split-area"
        onPointerDown={(event) => {
          if (event.button > 0) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          const { point } = along(event);
          setSplitting({ ...splitting, press: { ...point, moved: false } });
        }}
        onPointerMove={(event) => {
          const press = splitting.press;
          if (!press) return;
          const { point, value } = along(event);
          const moved = press.moved || Math.hypot(point.x - press.x, point.y - press.y) >= CLICK_PX;
          if (moved) onCut(splitting.box, splitting.dir, value, { ...press, moved });
        }}
        onPointerUp={() => {
          const press = splitting.press;
          setSplitting({ ...splitting, press: null });
          if (press && !press.moved) onConfirm();
        }}
        style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.width, height: rect.height, pointerEvents: "auto", cursor: across ? "col-resize" : "row-resize", touchAction: "none" }}
      />
      <span data-testid="map-split-cut" data-cut={Math.round(line)} style={cut} />
      {splitting.at.guide ? <Guide guide={splitting.at.guide} /> : null}
    </>
  );
}
