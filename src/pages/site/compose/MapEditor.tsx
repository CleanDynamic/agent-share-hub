/* MS-06 — the map editor: the shell every tool plugs into (`11-editor.png`).

   COLUMNS. "On the map" (252), 16, then the canvas column: the toolbar, the notice when the build has changed under the map,
   and the canvas in its scrolling well with the floating bar over the selection. Under 1024 wide the first column folds into
   a toolbar button that opens it in the composer's sheet. Its heading is "On the map", not the boards' "Sources": the
   composer's own Sources stays on screen beside the Map tab as its rail (README Decision 13).

   STATE is `useMapEditor`, made by the page (`useMapEditorFor`) so the steps and the selection outlive a switch to the List.
   Every change goes through `editor.apply`; this prompt's one action of its own is removing a box. MS-07 to MS-12 add their
   buttons to the floating bar (in groups, a rule between) and to the toolbar's groups.

   KEYS act only while the focus is in the canvas column, so the List's keep working: Tab moves through boxes in reading
   order, the arrows move between a box's tiles, Enter enters a box and Escape leaves it, then clears the selection; Delete
   removes the selected box; Ctrl or Cmd Z and Shift Z undo and redo the map. The List's own keys are stopped here (they would
   act on the List's tiles, whose cards the map draws). */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { flashOutline } from "@/components/post/RefLinks";
import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { BottomSheet } from "@/components/shell/BottomSheet";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { groupKey, groupOfStep, stepTitle, type SessionGroup, type Step } from "@/lib/build/graph";
import { sessionsMetaOf } from "@/lib/build/making";
import { fitsOf } from "@/lib/build/mapGeometry";
import { boxes, boxOfTile, nodeById, placedTiles, placeTile, removeBox, unplaceTile, type MapBox, type MapLayout, type MapSide } from "@/lib/build/mapLayout";
import { orderFacts, tileOptionsOf } from "@/lib/build/mapOrder";
import { forStorage, fromStorage, startFromBuild } from "@/lib/build/mapStart";
import { sessionMapFor, type MapPieceLike } from "@/lib/build/sessionMap";
import { shortcutOf } from "@/lib/build/shortcuts";
import { refTo } from "@/lib/build/thread";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { hoverFill } from "@/lib/theme/refinedControl";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, textStep } from "@/lib/theme/type";

import { useAnnounce } from "./BuildAnnouncer";
import type { ListResult } from "./buildListModel";
import {
  EDITOR,
  EDITOR_CANVAS_COLUMN,
  EDITOR_COLUMNS,
  EDITOR_SCROLL,
  EDITOR_SOURCES,
  FLOATING_BAR,
  FLOATING_BAR_STYLE,
  FLOATING_NAME,
  REFUSAL,
  TOOLBAR,
  TOOLBAR_GROUP,
  ZOOM,
} from "./canvasRecipes";
import { MenuContent } from "./ComposeMenu";
import { MemberLabel } from "./groupLabels";
import { CANVAS_TOP, MapCanvas } from "./MapCanvas";
import { iconButtonSide, RecipeButton } from "./modalRecipes";
import { ToolMark } from "./refinedPieces";
import { bareButton, ellipsis, menuItem, menuSurface, text, tnum } from "./refinedStyles";
import { DangerButton, SmallWindow } from "./removePieces";
import { overlayOpen, takesKeys } from "./useBuildSelection";
import { useMapEditor, type MapEditor as MapEditorState } from "./useMapEditor";

/** Every string the editor says. */
export const MAP_EDITOR_UI_COPY = {
  heading: "On the map",
  placed: (placed: number, of: number) => `${placed} of ${of} placed`,
  placedRow: "placed",
  removed: "Removed from the build",
  remove: "Remove",
  rowMenu: (name: string) => `More for ${name}`,
  placeOnMap: "Place on map",
  placedSentence: (name: string) => `${name} placed on the map.`,
  removedTile: (name: string) => `${name} taken off the map.`,
  session: (number: number) => `Session ${number}`,
  sessionTab: (number: number) => `S${number}`,
  box: "Box",
  boxName: (session: number | null) => (session === null ? "Box" : `Box · S${session}`),
  boxes: (count: number) => `${count} boxes`,
  tileName: (number: string | null) => (number ? `Tile ${number}` : "Result"),
  bar: (name: string) => `${name} tools`,
  removeBox: "Remove",
  removeTitle: (name: string) => `Remove ${name}?`,
  removeBody: (tiles: number) => `Its ${tiles === 1 ? "tile goes" : `${tiles} tiles go`} back to the list on the left, unplaced. Nothing leaves the build.`,
  cancel: "Cancel",
  boxRemoved: (name: string, tiles: number) => (tiles === 0 ? `${name} removed.` : `${name} removed. ${tiles === 1 ? "1 tile is" : `${tiles} tiles are`} unplaced.`),
  toolbar: "Map tools",
  select: "Select",
  numbers: "Numbers",
  numbersBuild: "Build",
  numbersSession: "Session",
  numbersPart: "Part",
  numbered: (scheme: string) => `Numbers by ${scheme.toLowerCase()}.`,
  zoomOut: "Zoom out",
  zoomIn: "Zoom in",
  zoom: (percent: number) => `Zoom ${percent}%`,
  fit: "Fit",
  problems: (first: string, more: number) => (more === 0 ? `The build changed: ${first}` : `The build changed: ${first} And ${more} more.`),
  fix: "Fix",
};

/* ── the editor's state, made where it outlives the tab ── */

export interface MapBuild {
  steps: Step[];
  groups: SessionGroup[];
  files: MapPieceLike[];
  making: unknown;
  results?: ListResult[];
}

export interface MapEditorForInput extends MapBuild {
  /** `mapLayoutOf(making)`: the stored layout, or null. */
  stored: MapLayout | null;
  /** Write a layout: `setMapLayout`, in the build's write queue. */
  save: (layout: MapLayout) => Promise<unknown>;
  onSaveError?: (cause: unknown, retry: () => void) => void;
}

const NO_RESULTS: ListResult[] = [];

/** The same value as last render while it is equal in JSON: a layout worked out again is not a change. */
function useSame<T>(value: T): T {
  const held = useRef<{ value: T; json: string } | null>(null);
  const json = JSON.stringify(value);
  if (!held.current || held.current.json !== json) held.current = { value, json };
  return held.current.value;
}

/** The editor's state for a build: the plain arrangement, the order facts, legacy keys kept out of what is written. */
export function useMapEditorFor({ stored, steps, groups, files, making, results = NO_RESULTS, save, onSaveError }: MapEditorForInput): MapEditorState {
  const announce = useAnnounce();
  const plain = useSame(useMemo(() => startFromBuild(steps, groups, making, results), [steps, groups, making, results]));
  const read = useSame(useMemo(() => (stored ? fromStorage(stored, steps, groups) : null), [stored, steps, groups]));
  const facts = useMemo(() => orderFacts(steps, groups, files, results), [steps, groups, files, results]);
  const latest = useRef({ steps, groups, save });
  latest.current = { steps, groups, save };
  const write = useCallback((layout: MapLayout) => latest.current.save(forStorage(layout, latest.current.steps, latest.current.groups)), []);
  return useMapEditor({ stored: read, plain, save: write, announce, onSaveError, facts });
}

/* ── names ── */

interface Names {
  /** A session's number by its key. */
  sessionNumber: (key: string) => number | null;
  /** The session key of a top-level tile or Result. */
  sessionOf: (tile: string) => string | null;
  exists: (tile: string) => boolean;
  tileNumber: (tile: string) => string | null;
  tileTitle: (tile: string) => string;
}

function useNames({ steps, groups, results = NO_RESULTS }: MapBuild): Names {
  return useMemo(() => {
    const step = new Map(steps.map((each) => [each.id, each]));
    const result = new Map(results.map((each) => [each.id, each]));
    const session = new Map<string, string>();
    for (const each of steps) {
      const group = groupOfStep(groups, each);
      if (group && !group.implicit) session.set(each.id, groupKey(group));
    }
    for (const each of results) {
      const from = steps.find((candidate) => candidate.number === each.from);
      const key = from ? session.get(from.id) : undefined;
      if (key) session.set(each.id, key);
    }
    const numbers = new Map(groups.map((group) => [groupKey(group), group.number]));
    return {
      sessionNumber: (key) => numbers.get(key) ?? null,
      sessionOf: (tile) => session.get(tile) ?? null,
      exists: (tile) => step.has(tile) || result.has(tile),
      tileNumber: (tile) => step.get(tile)?.number ?? null,
      tileTitle: (tile) => {
        const found = step.get(tile);
        return found ? stepTitle(found) : (result.get(tile)?.title ?? MAP_EDITOR_UI_COPY.removed);
      },
    };
  }, [steps, groups, results]);
}

/** What the floating bar calls the selection: "Box · S2", "3 boxes", "Tile 5". */
function selectionName(layout: MapLayout, selected: readonly string[], names: Names): string {
  if (selected.length > 1) return MAP_EDITOR_UI_COPY.boxes(selected.length);
  const id = selected[0];
  const node = nodeById(layout, id);
  if (node?.kind === "box") {
    const key = node.tiles.map(names.sessionOf).find(Boolean);
    return MAP_EDITOR_UI_COPY.boxName(key ? names.sessionNumber(key) : null);
  }
  return MAP_EDITOR_UI_COPY.tileName(names.tileNumber(id));
}

/* ── the editor ── */

export interface MapEditorProps extends MapBuild {
  editor: MapEditorState;
}

export function MapEditor({ editor, ...build }: MapEditorProps) {
  const { steps, groups, files, making, results = NO_RESULTS } = build;
  const names = useNames(build);
  const wide = useMinWidth(EDITOR.foldBelow);
  const [sheet, setSheet] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [confirming, setConfirming] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const column = useRef<HTMLDivElement | null>(null);
  const facts = useMemo(() => orderFacts(steps, groups, files, results), [steps, groups, files, results]);
  const { layout, selected, geometry } = editor;

  /* ── actions ── */
  const boxEl = (id: string) => scroller.current?.querySelector<HTMLElement>(`[data-box-id="${id}"]`) ?? null;
  const reveal = (el: HTMLElement | null) => {
    if (!el) return;
    el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    flashOutline(el);
  };
  const doRemove = (id: string) => {
    const box = nodeById(layout, id);
    if (box?.kind !== "box") return;
    const name = selectionName(layout, [id], names);
    if (editor.apply(removeBox(layout, id, { fits: fitsOf }), MAP_EDITOR_UI_COPY.boxRemoved(name, box.tiles.length))) column.current?.focus();
  };
  const askRemove = (id: string) => {
    const box = nodeById(layout, id);
    if (box?.kind !== "box") return;
    if (box.tiles.length > 0) setConfirming(id);
    else doRemove(id);
  };
  const oneBox = selected.length === 1 && nodeById(layout, selected[0])?.kind === "box" ? selected[0] : null;

  /**
   * "Place on map": a new box beside the last box of its session (to the right, else below), or at the end of its part. The
   * first place that keeps the build's order wins; when none does, the last refusal is shown.
   */
  const place = (tile: string) => {
    const options = tileOptionsOf(facts);
    const session = names.sessionOf(tile);
    const all = boxes(layout);
    const own = session ? all.filter((box) => box.tiles.some((id) => names.sessionOf(id) === session)) : [];
    const sentence = MAP_EDITOR_UI_COPY.placedSentence(MAP_EDITOR_UI_COPY.tileName(names.tileNumber(tile)));
    const tries: { id: string; side: MapSide }[] = [];
    if (own.length) {
      const last = own[own.length - 1];
      tries.push({ id: last.id, side: "right" }, { id: last.id, side: "bottom" });
    } else {
      const part = sessionPart(build, session);
      const region = part ? findPartRegion(layout, part) : null;
      const inPart = region ? boxes({ root: region }) : [];
      const last = inPart[inPart.length - 1] ?? all[all.length - 1];
      // A new box at the end of the part: beside its last box when that keeps the order, else below it.
      if (last) tries.push({ id: last.id, side: "right" }, { id: last.id, side: "bottom" });
    }
    const results = tries.map((beside) => editor.check(placeTile(layout, tile, null, { ...options, beside })));
    const chosen = results.find((result) => "layout" in result) ?? results[results.length - 1];
    if (chosen && editor.apply(chosen, sentence)) editor.select(tile);
  };
  const takeOff = (tile: string) => editor.apply(unplaceTile(layout, tile), MAP_EDITOR_UI_COPY.removedTile(MAP_EDITOR_UI_COPY.tileName(names.tileNumber(tile))));

  /* ── keys ── */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || takesKeys(event.target) || overlayOpen()) return;
    const target = event.target as HTMLElement;
    const which = shortcutOf(event.nativeEvent);
    const done = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (which === "undo") return done(), editor.undo();
    if (which === "redo") return done(), editor.redo();
    const inBar = Boolean(target.closest('[role="toolbar"], [role="radiogroup"], [role="menu"]'));
    const tileEl = target.closest<HTMLElement>('[data-testid="map-tile"]');
    const box = target.closest<HTMLElement>("[data-box-id]");
    const tilesOf = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[data-testid="map-tile"]')];
    const focusTile = (el: HTMLElement | undefined) => {
      if (!el) return;
      el.focus();
      editor.select(el.dataset.tileId as string);
    };
    if (event.key === "Escape") {
      if (tileEl && box) {
        box.focus();
        editor.select(box.dataset.boxId as string);
        return done();
      }
      if (selected.length > 0 || editor.refusal) {
        editor.select(null);
        return done();
      }
      return;
    }
    if (event.key === "Enter" && box && target === box) return done(), focusTile(tilesOf(box)[0]);
    if (tileEl && box && !inBar && (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowLeft")) {
      const list = tilesOf(box);
      const at = list.indexOf(tileEl);
      const step = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      focusTile(list[Math.min(Math.max(at + step, 0), list.length - 1)]);
      return done();
    }
    if (which === "remove" && !inBar) {
      if (oneBox) askRemove(oneBox);
      return done();
    }
    // The List's own keys would act on the List's tiles, whose cards the map draws: here they do nothing.
    if (which && which !== "help" && which !== "find" && which !== "save" && !inBar) event.preventDefault();
  };

  /* ── the canvas, at its zoom, with the bar over the selection ── */
  const selectedRect = useMemo(() => {
    if (!geometry || selected.length === 0) return null;
    const rects = selected.map((id) => geometry.nodes[id] ?? geometry.tiles[id]).filter(Boolean);
    if (!rects.length) return null;
    const x = Math.min(...rects.map((rect) => rect.x));
    const y = Math.min(...rects.map((rect) => rect.y));
    return { x, y, right: Math.max(...rects.map((rect) => rect.x + rect.width)), bottom: Math.max(...rects.map((rect) => rect.y + rect.height)) };
  }, [geometry, selected]);
  const drawnWidth = geometry?.width ?? layout.width;
  const drawnHeight = geometry ? geometry.height + CANVAS_TOP : undefined;
  const fit = () => {
    const room = scroller.current?.clientWidth ?? 0;
    if (room > 0) setZoom(clampZoom(room / drawnWidth));
  };
  const setNumbers = (numbers: MapLayout["numbers"]) => {
    if (numbers === layout.numbers) return;
    const label = numbers === "build" ? MAP_EDITOR_UI_COPY.numbersBuild : numbers === "session" ? MAP_EDITOR_UI_COPY.numbersSession : MAP_EDITOR_UI_COPY.numbersPart;
    editor.apply({ ok: true, layout: { ...layout, numbers }, changed: [] }, MAP_EDITOR_UI_COPY.numbered(label));
  };

  const sources = <MapSources build={build} names={names} editor={editor} onPlace={place} onTakeOff={takeOff} onReveal={(id) => reveal(boxEl(id))} />;
  const problems = editor.problems;

  return (
    <div data-testid="map-editor" style={EDITOR_COLUMNS}>
      {wide ? (
        <section aria-labelledby="map-sources-heading" data-testid="map-sources" style={EDITOR_SOURCES}>
          {sources}
        </section>
      ) : null}
      <div ref={column} data-testid="map-canvas-column" tabIndex={-1} onKeyDown={onKeyDown} style={{ ...EDITOR_CANVAS_COLUMN, outline: "none" }}>
        <div role="toolbar" aria-label={MAP_EDITOR_UI_COPY.toolbar} data-testid="map-toolbar" style={{ ...TOOLBAR, justifyContent: "space-between" }}>
          <div style={TOOLBAR_GROUP} data-toolbar-group="tools">
            {wide ? null : (
              <ToolbarButton testId="map-sources-button" expanded={sheet} onClick={() => setSheet(true)}>
                {MAP_EDITOR_UI_COPY.heading}
              </ToolbarButton>
            )}
            <ToolbarButton testId="map-tool-select" pressed onClick={() => editor.setPreview(null)}>
              {MAP_EDITOR_UI_COPY.select}
            </ToolbarButton>
          </div>
          <div style={TOOLBAR_GROUP} data-toolbar-group="view">
            <span aria-hidden="true" style={{ ...text(textStep.meta, 400, t.text2), marginRight: 4 }}>
              {MAP_EDITOR_UI_COPY.numbers}
            </span>
            <Segmented
              label={MAP_EDITOR_UI_COPY.numbers}
              size={28}
              fontSize={textStep.meta}
              compact
              value={layout.numbers}
              onChange={setNumbers}
              items={[
                { value: "build", label: MAP_EDITOR_UI_COPY.numbersBuild },
                { value: "session", label: MAP_EDITOR_UI_COPY.numbersSession },
                { value: "part", label: MAP_EDITOR_UI_COPY.numbersPart },
              ]}
            />
            <ToolbarButton testId="map-zoom-out" label={MAP_EDITOR_UI_COPY.zoomOut} disabled={zoom <= ZOOM.min + 0.001} onClick={() => setZoom((was) => clampZoom(was - ZOOM.step))}>
              −
            </ToolbarButton>
            <span data-testid="map-zoom" aria-live="off" aria-label={MAP_EDITOR_UI_COPY.zoom(Math.round(zoom * 100))} style={{ ...text(textStep.meta, 400, t.text2), fontFamily: DM_MONO, ...tnum, minWidth: 40, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <ToolbarButton testId="map-zoom-in" label={MAP_EDITOR_UI_COPY.zoomIn} disabled={zoom >= ZOOM.max - 0.001} onClick={() => setZoom((was) => clampZoom(was + ZOOM.step))}>
              +
            </ToolbarButton>
            <ToolbarButton testId="map-fit" onClick={fit}>
              {MAP_EDITOR_UI_COPY.fit}
            </ToolbarButton>
          </div>
        </div>
        {problems.length > 0 ? (
          <div data-testid="map-problems" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <p style={{ ...text(textStep.meta, 400, t.text), ...ellipsis, margin: 0, flex: "1 1 0" }}>{MAP_EDITOR_UI_COPY.problems(problems[0].sentence, problems.length - 1)}</p>
            <RecipeButton small data-testid="map-fix" onClick={editor.fix}>
              {MAP_EDITOR_UI_COPY.fix}
            </RecipeButton>
          </div>
        ) : null}
        <div ref={scroller} data-testid="map-scroll" style={EDITOR_SCROLL}>
          <div style={{ position: "relative", width: drawnWidth * zoom, height: drawnHeight === undefined ? undefined : drawnHeight * zoom }}>
            <div style={{ width: drawnWidth, transform: zoom === 1 ? undefined : `scale(${zoom})`, transformOrigin: "0 0" }}>
              <MapCanvas layout={editor.shown} steps={steps} groups={groups} files={files} making={making} results={results} mode="maker" selected={selected} onSelect={editor.select} onGeometry={editor.setGeometry} />
            </div>
            {selectedRect ? (
              <FloatingBar
                rect={selectedRect}
                zoom={zoom}
                width={drawnWidth * zoom}
                name={selectionName(layout, selected, names)}
                refusal={editor.refusal && editor.refusal.at === "selection" ? editor.refusal.reason : null}
                onRemove={oneBox ? () => askRemove(oneBox) : undefined}
              />
            ) : null}
            {editor.refusal && (editor.refusal.at !== "selection" || !selectedRect) ? (
              <p
                role="presentation"
                data-testid="map-refusal"
                style={{ ...REFUSAL, position: "absolute", ...(editor.refusal.at === "selection" ? { left: 0, top: 0 } : { left: editor.refusal.at.pointer.x + 12, top: editor.refusal.at.pointer.y + 12 }), background: t.window, padding: "2px 6px", borderRadius: 6 }}
              >
                {editor.refusal.reason}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      {wide ? null : (
        <BottomSheet open={sheet} onOpenChange={setSheet} title={MAP_EDITOR_UI_COPY.heading} hideTitle>
          <div data-testid="map-sources" style={{ ...EDITOR_SOURCES, width: "auto", flex: "1 1 auto", padding: 16 }}>
            {sources}
          </div>
        </BottomSheet>
      )}
      <RemoveBoxWindow
        name={confirming ? selectionName(layout, [confirming], names) : ""}
        tiles={confirming ? ((nodeById(layout, confirming) as MapBox | null)?.tiles.length ?? 0) : 0}
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onRemove={() => {
          const id = confirming;
          setConfirming(null);
          if (id) doRemove(id);
        }}
      />
    </div>
  );
}

const clampZoom = (zoom: number) => Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, zoom)) * 100) / 100;

/** The part a session is in (`making.workstreams`), by `sessionMapFor`. */
function sessionPart(build: MapBuild, session: string | null): string | null {
  if (!session) return null;
  const model = sessionMapFor({ groups: build.groups, steps: build.steps, files: build.files, making: build.making });
  return model.hasParts ? (model.parts.find((part) => part.sessions.includes(session))?.key ?? null) : null;
}

function findPartRegion(layout: MapLayout, part: string): MapLayout["root"] | null {
  const walk = (node: MapLayout["root"]): MapLayout["root"] | null => {
    if (node.kind === "box") return null;
    if (node.kind === "region") return "part" in node.of && node.of.part === part ? node : walk(node.child);
    for (const kid of node.children) {
      const found = walk(kid);
      if (found) return found;
    }
    return null;
  };
  return walk(layout.root);
}

/* ── the toolbar's buttons ── */

function ToolbarButton({ children, onClick, pressed, expanded, disabled, label, testId }: { children: ReactNode; onClick: () => void; pressed?: boolean; expanded?: boolean; disabled?: boolean; label?: string; testId?: string }) {
  return (
    <Button
      variant={pressed ? "secondary" : "ghost"}
      size={28}
      fontSize={textStep.meta as 12 | 13}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-label={label}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      style={{ padding: "0 10px" }}
    >
      {children}
    </Button>
  );
}

/* ── the floating bar ── */

function FloatingBar({ rect, zoom, width, name, refusal, onRemove }: { rect: { x: number; y: number; right: number; bottom: number }; zoom: number; width: number; name: string; refusal: string | null; onRemove?: () => void }) {
  const bar = useRef<HTMLDivElement | null>(null);
  const top = (rect.y + CANVAS_TOP) * zoom;
  const above = top - FLOATING_BAR.height - FLOATING_BAR.clear;
  const below = (rect.bottom + CANVAS_TOP) * zoom + FLOATING_BAR.clear;
  const placeAbove = above >= 0;
  // Its right edge on the selection's right edge, inside the column.
  const right = Math.max(0, width - rect.right * zoom);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    const buttons = [...(bar.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
    if (!buttons.length) return;
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (at + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus();
    event.preventDefault();
    event.stopPropagation();
  };
  const style: CSSProperties = { ...FLOATING_BAR_STYLE, right, top: placeAbove ? above : below };
  return (
    <>
      <div ref={bar} role="toolbar" aria-label={MAP_EDITOR_UI_COPY.bar(name)} data-testid="map-floating-bar" data-place={placeAbove ? "above" : "below"} onKeyDown={onKeyDown} style={style}>
        <span data-testid="map-floating-name" style={FLOATING_NAME}>
          {name}
        </span>
        {onRemove ? (
          <Button variant="ghost" size={28} fontSize={13} data-testid="map-remove-box" onClick={onRemove} style={{ padding: "0 8px", color: t.text }}>
            {MAP_EDITOR_UI_COPY.removeBox}
          </Button>
        ) : null}
      </div>
      {refusal ? (
        <p role="presentation" data-testid="map-refusal" style={{ ...REFUSAL, position: "absolute", zIndex: 2, right, top: (placeAbove ? above : below) + FLOATING_BAR.height + 4, background: t.window, padding: "2px 6px", borderRadius: 6 }}>
          {refusal}
        </p>
      ) : null}
    </>
  );
}

function RemoveBoxWindow({ name, tiles, open, onClose, onRemove }: { name: string; tiles: number; open: boolean; onClose: () => void; onRemove: () => void }) {
  return (
    <SmallWindow
      open={open}
      onClose={onClose}
      title={MAP_EDITOR_UI_COPY.removeTitle(name)}
      body={MAP_EDITOR_UI_COPY.removeBody(tiles)}
      testId="map-remove-box-window"
      buttons={
        <>
          <RecipeButton small onClick={onClose}>
            {MAP_EDITOR_UI_COPY.cancel}
          </RecipeButton>
          <DangerButton testId="map-remove-box-confirm" onClick={onRemove}>
            {MAP_EDITOR_UI_COPY.remove}
          </DangerButton>
        </>
      }
    />
  );
}

/* ── "On the map": the build's parts, sessions and tiles ── */

interface SourceRow {
  kind: "part" | "session" | "tile" | "removed";
  key: string;
  label: string;
  number?: string | null;
  app?: string | null;
  sessionNumber?: number;
}

function MapSources({ build, names, editor, onPlace, onTakeOff, onReveal }: { build: MapBuild; names: Names; editor: MapEditorState; onPlace: (tile: string) => void; onTakeOff: (tile: string) => void; onReveal: (boxId: string) => void }) {
  const { steps, groups, files, making, results = NO_RESULTS } = build;
  const { layout } = editor;
  const placed = useMemo(() => new Set(placedTiles(layout)), [layout]);
  const rows = useMemo<SourceRow[]>(() => {
    const model = sessionMapFor({ groups, steps, files, making });
    const meta = sessionsMetaOf(making);
    const out: SourceRow[] = [];
    const tilesOf = (session: string | null) => [...steps.map((step) => step.id), ...results.map((result) => result.id)].filter((id) => names.sessionOf(id) === session);
    const tileRow = (id: string): SourceRow => ({ kind: "tile", key: id, label: names.tileTitle(id), number: names.tileNumber(id) });
    out.push(...tilesOf(null).map(tileRow));
    for (const part of model.parts) {
      if (model.hasParts) out.push({ kind: "part", key: part.key, label: part.label });
      for (const key of part.sessions) {
        const session = model.sessions.find((each) => each.key === key);
        if (!session) continue;
        const title = session.title ?? (meta[key]?.title || undefined);
        out.push({ kind: "session", key, label: title ?? MAP_EDITOR_UI_COPY.session(session.number), app: session.app, sessionNumber: session.number });
        out.push(...tilesOf(key).map(tileRow));
      }
    }
    for (const id of placedTiles(layout)) if (!names.exists(id)) out.push({ kind: "removed", key: id, label: MAP_EDITOR_UI_COPY.removed });
    return out;
  }, [groups, steps, files, making, results, names, layout]);
  const total = steps.length + results.length;
  const count = [...placed].filter(names.exists).length;

  /** A session's or part's first box on the canvas. */
  const firstBox = (row: SourceRow): string | null => {
    const holds = (box: MapBox) => box.tiles.some((id) => (row.kind === "session" ? names.sessionOf(id) === row.key : sessionPart(build, names.sessionOf(id)) === row.key));
    return boxes(layout).find(holds)?.id ?? null;
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h3 id="map-sources-heading" style={{ ...text(textStep.body, 500, t.text), margin: 0 }}>
          {MAP_EDITOR_UI_COPY.heading}
        </h3>
        <span data-testid="map-sources-count" style={{ ...text(textStep.meta, 400, t.text2), ...tnum }}>
          {MAP_EDITOR_UI_COPY.placed(count, total)}
        </span>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {rows.map((row) => (
          <li key={`${row.kind}-${row.key}`} data-testid={`map-source-${row.kind}`} data-key={row.key}>
            {row.kind === "part" || row.kind === "session" ? (
              <GroupRow
                row={row}
                onClick={() => {
                  const box = firstBox(row);
                  if (box) onReveal(box);
                }}
              />
            ) : (
              <TileRow
                row={row}
                placed={placed.has(row.key)}
                selected={editor.selected.includes(row.key)}
                onSelect={() => {
                  if (!placed.has(row.key)) return;
                  editor.select(row.key);
                  const box = boxOfTile(layout, row.key);
                  if (box) onReveal(box.id);
                }}
                onPlace={() => onPlace(row.key)}
                onRemove={() => onTakeOff(row.key)}
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const ROW: CSSProperties = { ...bareButton, display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 32, padding: "4px 8px", borderRadius: r.control, textAlign: "left", minWidth: 0 };

/** A part or a session. Room is left at the right for Frame and Outline (MS-09). */
function GroupRow({ row, onClick }: { row: SourceRow; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const part = row.kind === "part";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: part ? 8 : 4 }}>
      <button type="button" onClick={onClick} {...handlers} style={{ ...ROW, ...(state.hovered ? { background: hoverFill() } : null), ...ring(state.focusVisible), flex: "1 1 0" }}>
        {part ? (
          <span style={{ ...text(textStep.meta, 500, t.text2), ...ellipsis, textTransform: "uppercase", letterSpacing: "0.04em" }}>{row.label}</span>
        ) : (
          <>
            <span style={{ ...text(textStep.meta, 400, t.text2), fontFamily: DM_MONO }}>{MAP_EDITOR_UI_COPY.sessionTab(row.sessionNumber as number)}</span>
            <ToolMark tool={row.app} size={16} />
            <span style={{ ...text(textStep.body, 500, t.text), ...ellipsis }}>{row.label}</span>
          </>
        )}
      </button>
      {part ? null : <MemberLabel to={refTo({ kind: "session", id: row.key })} />}
      {/* MS-09 adds Frame and Outline here. */}
      <span aria-hidden="true" data-testid="map-source-room" style={{ width: 0, flexShrink: 0 }} />
    </div>
  );
}

function TileRow({ row, placed, selected, onSelect, onPlace, onRemove }: { row: SourceRow; placed: boolean; selected: boolean; onSelect: () => void; onPlace: () => void; onRemove: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const removed = row.kind === "removed";
  const name = row.number ? `${row.number} ${row.label}` : row.label;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 8 }}>
      <button
        type="button"
        aria-pressed={placed && !removed ? selected : undefined}
        onClick={onSelect}
        {...handlers}
        style={{ ...ROW, ...(state.hovered && placed ? { background: hoverFill() } : null), ...(selected ? { background: t.control } : null), ...ring(state.focusVisible), flex: "1 1 0", cursor: placed ? "pointer" : "default" }}
      >
        <span style={{ ...text(textStep.meta, 400, t.text2), fontFamily: DM_MONO, ...tnum, width: 20, flexShrink: 0 }}>{row.number ?? ""}</span>
        <span style={{ ...text(textStep.body, 400, removed ? t.text2 : t.text), ...ellipsis, flex: "1 1 0" }}>{row.label}</span>
        {placed && !removed ? <span style={{ ...text(textStep.meta, 400, t.evidence), flexShrink: 0 }}>{MAP_EDITOR_UI_COPY.placedRow}</span> : null}
      </button>
      {removed ? (
        <RecipeButton small data-testid="map-source-remove" onClick={onRemove}>
          {MAP_EDITOR_UI_COPY.remove}
        </RecipeButton>
      ) : placed ? null : (
        <Menu.Root modal={false}>
          <Menu.Trigger asChild>
            <IconButton style={iconButtonSide()} icon={MoreHorizontal} glyph="more" label={MAP_EDITOR_UI_COPY.rowMenu(name)} size={26} data-testid="map-source-menu" />
          </Menu.Trigger>
          <Menu.Portal>
            <MenuContent align="end" sideOffset={4} style={menuSurface(200)}>
              <Menu.Item data-testid="map-place-on-map" onSelect={onPlace} style={menuItem(true, false)}>
                {MAP_EDITOR_UI_COPY.placeOnMap}
              </Menu.Item>
            </MenuContent>
          </Menu.Portal>
        </Menu.Root>
      )}
    </div>
  );
}
