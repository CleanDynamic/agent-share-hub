/* UI-P68 — the Build panel's Map: the same build as the List, laid out by rule.

   `layoutMap` (src/lib/build/mapLayout.ts) decides where everything goes; this
   file draws it and handles the pointer. Nothing here moves a box: boxes place
   themselves (CONCEPT §2.8), so the only drag is from an output dot to another
   box, which connects them.

   SELECTING. A click selects (Details shows it); every box and wire not joined
   directly to the selection drops to opacity 0.42 and the joined wires go
   strong. Esc clears. Double-click or Enter opens the full prompt window.

   CONNECTING. Dragging from a box's output dot to a step calls `onConnect`
   with the input to add. A drop `inputRefusal` (DATA §3) says no to snaps
   back, with the reason read out through a live region. The keyboard way is
   Details › Add an input.

   AGENTS AND TEAMS (UI-P69). An agent's or a team's box spans two columns and
   has "Open" on its header; Open, double-click or Enter shows what is inside it
   in place of the map (`OpenedMap`, drawn from `layoutOpened`): the dashed
   frame, the files and tools along its bottom, and everything outside it that
   it uses or goes into, dimmed, on the right. One level is open at a time; Esc
   goes up one.

   HAND-WRITTEN SVG, no dependency (RULES §3): one layer of wires under the
   boxes, and one overlay for the line that follows the pointer. The boxes are
   real buttons, in lane order then column order, which is the focus order.

   THE REFINED LOOK (UI-P91, `refined/{dusk,noon}/build-map.html`). Under `useLook() === "refined"` the same map is
   drawn in a well with the dot grid; lanes are radius 6 on a hairline, led by the session tool's real mark; boxes are
   raised objects (`mapArtwork.ts`) with 6x6 squares for inputs and outputs; wires are 1.2px with no arrowhead; what
   is not joined to the selection takes `--dim-filter`, never an opacity. Only the look branches: `layoutMap` places
   everything exactly as before, so the squares sit on the same wire ends.

   THE MAKER'S PARTS (UI-P94, `refined/{dusk,noon}/composer-map.html`). The composer's Map adds to UI-P91's recipes:
   input rows 20 high (2 apart, so each square stays on its wire end's 22 pitch), the state line 18 (10.5 `--label`),
   the text 36 (11 `--text2`, two lines), the foot 20; the legend's samples are 1px `--text2`. The result box has no
   evidence border in the refined look: its head says "Result" in `--evidence` 10.5/500 before the title. */

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import { LiveRegion, useAnnouncer } from "@/components/brand/LiveRegion";
import { ModelMark } from "@/components/brand/ModelMark";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { inputRefusal, runsLabel, stepTitle, type SessionGroup, type Step, type Use } from "@/lib/build/graph";
import { joinedTo, layoutMap, layoutOpened, MAP_SIZES, type MapBox, type MapPiece, type MapResult, type MapSuggestion, type MapWire } from "@/lib/build/mapLayout";
import { CONTROL } from "@/lib/theme/refinedControl";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { MAP_ARTWORK, type MapRoom } from "./mapArtwork";
import { ToolMark } from "./refinedPieces";

export const MAP_COPY = {
  key: "click to select · double-click to read all of it · drag from a dot to connect",
  rows: "Rows by session, left to right by date",
  openAgent: "Open shows what is inside the agent",
  openTeam: "Open shows what is inside the team",
  stacked: "stacked box = runs several at once",
  openedRows: "Left to right by order · boxes outside the frame are part of the build, not the team",
  outside: "Outside",
  bandCaption: "files and tools",
} as const;

/** What the joined boxes keep and the rest drop to (UI-P68). */
export const DIMMED = 0.42;

export interface BuildMapProps {
  /**
   * UI-P74: "reader" is the build page's Map. It draws no suggested input and no dot to drag from, has
   * no legend of counts, and says "Step {n} open" in place of the maker's selected line. Default "maker".
   */
  mode?: "maker" | "reader";
  steps: readonly Step[];
  groups: readonly SessionGroup[];
  files: readonly MapPiece[];
  tools: readonly MapPiece[];
  results: readonly MapResult[];
  suggestions: readonly MapSuggestion[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
  /** Double-click or Enter on a prompt. */
  onOpenPrompt?: (id: string) => void;
  /** A drag from one box's output dot ended on a step that takes it: add `use` to that step. */
  onConnect: (toId: string, use: Use) => void;
  /** UI-P69: the agent or team opened in place of the map, with the steps it sits among. Absent: the map. */
  opened?: Step | null;
  /** "Open", double-click or Enter on an agent or a team. */
  onOpenContainer?: (id: string) => void;
  /** Esc: up one level. */
  onBack?: () => void;
  /** A box outside the opened frame was clicked: back to the build with it selected. */
  onLeave?: (id: string) => void;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "3 MAR". */
export function columnDate(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** The accessible name of a box: "Prompt 3, Fix the layout, 2 inputs". */
export function boxName(box: Pick<MapBox, "kind" | "stepKind" | "number" | "title" | "inputs"> & { tool?: string | null }): string {
  if (box.kind === "file") return `File, ${box.title}`;
  if (box.kind === "tool") return `Tool, ${box.title}`;
  const count = box.inputs.length;
  const inputs = `${count} ${count === 1 ? "input" : "inputs"}`;
  if (box.kind === "result") return `Result, ${box.title}, ${inputs}`;
  const word = box.stepKind === "agent" ? "Agent" : box.stepKind === "team" ? "Team" : box.stepKind === "manual" ? "Manual step" : "Prompt";
  const runsIn = box.stepKind === "agent" && box.tool ? `, runs in ${box.tool}` : "";
  return `${word} ${box.number}, ${box.title}${runsIn}, ${inputs}`;
}

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

/* ── the refined look's pieces (UI-P91) ── */

/** A 6x6 square, radius 1: an input on a box's left edge, an output on its right. On the path it is solid `--text`. */
const SQUARE = 6;

function squarePaint(on: boolean, suggested = false): CSSProperties {
  return {
    width: SQUARE,
    height: SQUARE,
    borderRadius: 1,
    boxSizing: "border-box",
    ...(on && !suggested ? { background: t.text } : { background: t.well, border: `1px ${suggested ? "dashed" : "solid"} ${on ? t.text : t.label}` }),
  };
}

const geist = (size: number, weight: 400 | 500, color: string): CSSProperties => ({ fontFamily: FIGTREE, fontSize: size, fontWeight: weight, lineHeight: "normal", color });

/** Geist Mono 10.5 `--label`: a step's number, its only id on the box. */
const refinedNumber: CSSProperties = { fontFamily: DM_MONO, fontSize: 10.5, lineHeight: "normal", color: t.label, flexShrink: 0, fontVariantNumeric: "tabular-nums" };

const DIM: CSSProperties = { filter: t.dimFilter };

/** The well the map sits in: padding 16, the dot grid at 16px, radius 6. */
const refinedWell: CSSProperties = {
  overflow: "auto",
  maxHeight: "70dvh",
  padding: 16,
  boxSizing: "border-box",
  borderRadius: 6,
  border: `1px solid ${t.wellBorder}`,
  boxShadow: t.wellShadow,
  background: `radial-gradient(${t.dotGrid} 1px, transparent 1px) 0 0 / 16px 16px, ${t.well}`,
  backgroundAttachment: "local",
};

/** A box's paint in the refined look: the room's artwork, or the tile for work done by hand; the selected recipe over it. */
function refinedBoxPaint(room: MapRoom, manual: boolean, selected: boolean, target: boolean): CSSProperties {
  const art = MAP_ARTWORK[room];
  const rest: CSSProperties = manual ? { background: t.tile, border: `1px solid ${t.tileBorder}`, boxShadow: "none" } : art.box;
  if (!selected && !target) return rest;
  /* The whole border, not its colour: a longhand over the shorthand would be left stale when the box is let go. */
  return { ...rest, border: `1px solid ${t.selectedEdge}`, boxShadow: art.selectedShadow ?? t.selectedRing };
}

/* ── a box ── */

interface BoxViewProps {
  box: MapBox;
  selected: boolean;
  dimmed: boolean;
  onPath: boolean;
  target: boolean;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
  /** Double-click or Enter on an agent or a team opens what is inside it. */
  onOpenContainer?: (id: string) => void;
  /** UI-P74: the read-only map says how many inputs a box has, and nothing about suggesting or accepting. */
  reader?: boolean;
  /** UI-P91: the room whose artwork a refined box is painted with. */
  room?: MapRoom;
}

const isContainerBox = (box: Pick<MapBox, "kind" | "stepKind">): boolean => box.kind === "step" && (box.stepKind === "agent" || box.stepKind === "team");

/** UI-P91: the same box in the refined look. Same button, name, handlers and words; only the paint and type differ. */
const RefinedBoxView = memo(function RefinedBoxView({ box, selected, dimmed, onPath, target, onSelect, onOpen, onOpenContainer, reader, room = "dusk" }: BoxViewProps) {
  const container = isContainerBox(box);
  const openable = box.kind === "step" && (container ? Boolean(onOpenContainer) : box.stepKind === "prompt" && onOpen);
  const open = () => (container ? onOpenContainer?.(box.id) : onOpen?.(box.id));
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" && openable) {
      event.preventDefault();
      onSelect(box.id);
      open();
    }
  };
  const big = container && box.contents !== null;
  const piece = box.kind === "file" || box.kind === "tool";
  const manual = box.kind === "step" && box.stepKind === "manual";
  /* The reader's rows are 18 high, 4 apart; the maker's (UI-P94) 20 high, 2 apart. Both keep the 22 pitch `layoutMap`
     puts each wire end on, from 1 under the head. */
  const row = reader ? 18 : 20;
  const inputRows = (
    <span style={{ display: "flex", flexDirection: "column", gap: MAP_SIZES.row - row, paddingTop: 1, flexShrink: 0 }}>
      {box.inputs.map((input, at) => (
        <span key={input.key} style={{ position: "relative", height: row, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 12px", ...geist(11, 400, onPath ? t.text : t.text2) }}>
          <span
            aria-hidden="true"
            data-testid={`map-input-${box.id}-${at}`}
            style={{ position: "absolute", left: -4, top: (row - SQUARE) / 2, ...squarePaint(onPath, input.suggested) }}
          />
          <span style={ellipsis}>{input.label}</span>
        </span>
      ))}
    </span>
  );
  return (
    <button
      type="button"
      data-testid={`map-box-${box.id}`}
      data-kind={box.kind}
      aria-label={boxName(box)}
      aria-pressed={selected}
      onClick={() => onSelect(box.id)}
      onDoubleClick={openable ? open : undefined}
      onKeyDown={onKeyDown}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        boxSizing: "border-box",
        padding: piece ? "0 12px" : 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: piece ? "center" : undefined,
        gap: piece ? 2 : 0,
        textAlign: "left",
        borderRadius: 6,
        ...refinedBoxPaint(room, manual, selected, target),
        color: t.text,
        cursor: "pointer",
        overflow: "hidden",
        ...(dimmed ? DIM : null),
        outline: "none",
      }}
    >
      {piece ? (
        <>
          <span style={{ ...geist(10.5, 400, t.label), lineHeight: "14px" }}>{box.kind === "file" ? "File" : "Tool"}</span>
          <span style={{ ...geist(12, 500, t.text), lineHeight: "16px", ...ellipsis }}>{box.title}</span>
        </>
      ) : big ? (
        <>
          <span style={{ height: MAP_SIZES.head, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 12px", ...geist(10.5, 500, t.label) }}>
            {box.stepKind === "team" ? "Team" : "Agent"} {box.number}
            {box.stepKind === "agent" && box.tool ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 6, minWidth: 0 }}>
                <ToolMark tool={box.tool} size={14} />
                <span style={{ ...ellipsis, fontWeight: 400 }}>{box.tool}</span>
              </span>
            ) : null}
          </span>
          {/* The named inputs down the left, the title, counts and how it runs beside them. */}
          <span style={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
            <span style={{ width: "46%", flexShrink: 0 }}>{inputRows}</span>
            <span style={{ flexGrow: 1, minWidth: 0, boxSizing: "border-box", padding: "4px 12px 8px 4px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
              <span style={{ ...geist(13.5, 500, box.defaultTitle ? t.text2 : t.text), ...ellipsis }}>{box.title}</span>
              <span style={{ ...geist(11, 400, t.text2), ...ellipsis }}>{box.contents || "nothing inside yet"}</span>
              <span style={{ ...geist(11.5, 400, t.text2), ...ellipsis }}>{box.runs}</span>
            </span>
          </span>
        </>
      ) : (
        <>
          <span style={{ height: MAP_SIZES.head, flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "0 12px", minWidth: 0 }}>
            {box.kind === "result" ? (
              /* UI-P94: no evidence border; the word says what it is. */
              <span data-testid="map-result-label" style={{ ...geist(10.5, 500, t.evidence), flexShrink: 0 }}>
                Result
              </span>
            ) : manual || (!box.defaultTitle && box.number) ? (
              <span style={refinedNumber}>{box.number}</span>
            ) : null}
            {manual ? (
              <span data-testid="manual-header" style={{ ...geist(10.5, 400, t.label), ...ellipsis }}>By hand{box.tool ? ` · ${box.tool}` : ""}</span>
            ) : (
              <span style={{ ...geist(12, 500, box.defaultTitle ? t.text2 : t.text), ...ellipsis }}>{box.title}</span>
            )}
            {box.stack ? <span style={{ ...geist(10.5, 400, t.label), marginLeft: "auto", flexShrink: 0 }}>× {box.stack}</span> : null}
          </span>
          {box.inputs.length > 0 ? inputRows : null}
          {reader ? (
            <>
              {/* The reader's box says its inputs in its name alone, as the board draws it. */}
              {box.text ? <span style={{ marginTop: 4, padding: "0 12px", flexShrink: 0, ...geist(11, 400, t.text2), ...ellipsis }}>{box.text}</span> : null}
              {box.kind === "step" && !manual ? (
                <span style={{ marginTop: 4, padding: "0 12px 8px", flexShrink: 0, ...geist(10.5, 400, t.label), fontVariantNumeric: "tabular-nums" }}>{box.words} words</span>
              ) : null}
            </>
          ) : (
            <>
              {/* UI-P94: the maker's accepted and suggested count, 18 high. */}
              {box.inputs.length > 0 ? (
                <span style={{ height: 18, flexShrink: 0, padding: "0 12px", display: "flex", alignItems: "center", ...geist(10.5, 400, t.label) }}>
                  {box.suggested > 0 ? `${box.suggested} suggested` : `${box.accepted} of ${box.accepted} inputs accepted`}
                </span>
              ) : null}
              {/* The text, two lines in 36; it gives up a pixel or two when the box `layoutMap` sized is shorter. */}
              <span
                style={{
                  flex: "0 1 36px",
                  minHeight: 0,
                  padding: "0 12px",
                  boxSizing: "border-box",
                  ...geist(11, 400, t.text2),
                  lineHeight: 1.5,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflowWrap: "anywhere",
                }}
              >
                {box.text}
              </span>
              <span style={{ height: 20, flexShrink: 0, padding: "0 12px", display: "flex", alignItems: "center", ...geist(10.5, 400, t.label), fontVariantNumeric: "tabular-nums" }}>
                {box.kind === "step" && !manual ? `${box.words} words` : ""}
              </span>
            </>
          )}
        </>
      )}
    </button>
  );
});

/* ── the wires ── */

function Wires({ wires, joined, selecting }: { wires: readonly MapWire[]; joined: ReadonlySet<string>; selecting: boolean }) {
  return (
    <>
      {wires.map((wire) => {
        const strong = joined.has(wire.id);
        const dim = selecting && !strong;
        /* 1.2px, no arrowhead: the line runs on to the input's square (the arrow's length `layoutMap` leaves). On the
           path `--text` at 70%, the rest `--label` at 45%; suggested dashed 4 4. */
        return (
          <g key={wire.id}>
            {wire.label && wire.labelX !== undefined && wire.labelY !== undefined ? (
              <text data-testid="map-wire-label" x={wire.labelX} y={wire.labelY} textAnchor="middle" style={{ fontFamily: FIGTREE, fontSize: 10.5, fill: t.label, ...(dim ? DIM : null) }}>
                {wire.label}
              </text>
            ) : null}
            <path
              data-testid="map-wire"
              data-strong={strong ? "true" : undefined}
              data-suggested={wire.suggested ? "true" : undefined}
              d={`${wire.d} h ${MAP_SIZES.arrow}`}
              fill="none"
              strokeWidth={1.2}
              strokeDasharray={wire.suggested ? "4 4" : undefined}
              style={{ stroke: strong ? t.text : t.label, strokeOpacity: strong ? 0.7 : 0.45 }}
            />
          </g>
        );
      })}
    </>
  );
}

/* ── an opened agent or team (UI-P69, V5-TeamMap) ── */

interface OpenedMapProps {
  container: Step;
  steps: readonly Step[];
  files: readonly MapPiece[];
  tools: readonly MapPiece[];
  results: readonly MapResult[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenContainer?: (id: string) => void;
  onBack?: () => void;
  onLeave?: (id: string) => void;
}

const flat = (list: readonly Step[]): Step[] => list.flatMap((step) => [step, ...flat(step.children)]);

function OpenedMap({ container, steps, files, tools, results, selectedId, onSelect, onOpenContainer, onBack, onLeave }: OpenedMapProps) {
  const layout = useMemo(() => layoutOpened(container, steps, files, tools, results), [container, steps, files, tools, results]);
  const room = useResolvedTheme();
  const uid = useId().replace(/:/g, "");
  const marker = `arrow-${uid}`;
  const markerStrong = `arrow-strong-${uid}`;
  const word = container.kind === "team" ? "team" : "agent";
  const outsideIds = useMemo(() => new Set(layout.outside.map((box) => box.id)), [layout]);
  const joined = useMemo(() => joinedTo(layout, selectedId), [layout, selectedId]);
  // Only a box in the frame dims the rest: what is selected outside it (or in another level) is not drawn here.
  const drawn = useMemo(() => new Set([...layout.boxes, ...layout.band].map((box) => box.id)), [layout]);
  const selecting = selectedId !== null && drawn.has(selectedId);
  const stacked = layout.boxes.some((box) => box.stack);
  const selectedStep = selectedId ? flat(container.children).find((step) => step.id === selectedId) : undefined;
  const selectedTitle = selectedStep ? stepTitle(selectedStep) : null;
  const ordered = useMemo(() => [...layout.boxes, ...layout.band, ...layout.outside], [layout]);
  /** Only an agent inside an opened team opens further: one level shows at a time. */
  const insideAgents = useMemo(() => new Set(container.kind === "team" ? container.children.filter((child) => child.kind === "agent").map((child) => child.id) : []), [container]);

  // The box that was opened is gone, so focus moves here: Esc is heard from this level.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => root.current?.focus({ preventScroll: true }), [container.id]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onBack?.();
    }
  };

  /** A box outside the frame is part of the build, not the team: clicking it goes back to the build. */
  const select = (id: string) => (outsideIds.has(id) ? onLeave?.(id) : onSelect(id));
  const sample: CSSProperties = { display: "inline-block", width: 24, height: 0, borderTop: `${1.2}px solid ${t.label}`, verticalAlign: "middle" };
  const caption: CSSProperties = geist(12, 400, t.text2);
  const count: CSSProperties = { fontVariantNumeric: "tabular-nums" };
  /* The frame's captions: an eyebrow in the refined look, Geist 10.5/500 `--label` .06em. */
  const eyebrow = (): CSSProperties => ({ ...geist(10.5, 500, t.label), textTransform: "uppercase", letterSpacing: "0.06em" });
  const Box = RefinedBoxView;

  return (
    <div ref={root} tabIndex={-1} onKeyDown={onKeyDown} data-testid="opened-map" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, outline: "none" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, ...caption }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={sample} />
            goes into <span style={count}>{layout.wires.length}</span>
          </span>
          {stacked ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden="true"
                style={
                  { width: 14, height: 10, borderRadius: 2, border: `1px solid ${t.label}`, boxShadow: `3px 3px 0 -1px ${t.surface}, 3px 3px 0 0 ${t.label}` }
                }
              />
              {MAP_COPY.stacked}
            </span>
          ) : null}
        </span>
        <span style={geist(12, 400, t.label)}>
          inside {word} {container.number} · Esc goes back to the build
        </span>
      </div>

      <div
        role="group"
        aria-label={`Inside ${word} ${container.number}`}
        data-testid="build-map"
        style={
          refinedWell
        }
      >
        <div style={{ position: "relative", width: layout.width, height: layout.height }}>
          <div
            data-testid="opened-frame"
            style={{ position: "absolute", left: layout.frame.x, top: layout.frame.y, width: layout.frame.w, height: layout.frame.h, boxSizing: "border-box", borderRadius: 8, border: `${1}px dashed ${t.line}` }}
          >
            <div style={{ position: "absolute", left: 16, top: 8, right: 16, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ ...eyebrow(), ...ellipsis }}>
                Inside {word} {container.number} · {stepTitle(container)}
              </span>
              <span
                style={
                  { height: 20, padding: "0 6px", boxSizing: "border-box", borderRadius: 4, display: "inline-flex", alignItems: "center", background: t.tagFill, ...geist(11.5, 400, t.onTag), whiteSpace: "nowrap" }
                }
              >
                {runsLabel(container.runs)}
              </span>
            </div>
            {layout.band.length > 0 ? (
              <span style={{ position: "absolute", left: 16, top: layout.bandY - layout.frame.y + 2, ...eyebrow() }}>{MAP_COPY.bandCaption}</span>
            ) : null}
          </div>
          {layout.outside.length > 0 ? (
            <span style={{ position: "absolute", left: layout.outside[0].x, top: layout.frame.y + 8, ...eyebrow() }}>{MAP_COPY.outside}</span>
          ) : null}

          <svg width={layout.width} height={layout.height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
            <defs>
              <marker id={marker} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" style={{ fill: t.text2 }} />
              </marker>
              <marker id={markerStrong} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" style={{ fill: t.text }} />
              </marker>
            </defs>
            <Wires wires={layout.wires} joined={joined.wires} selecting={selecting} />
          </svg>

          {layout.boxes
            .filter((box) => box.stack)
            .map((box) =>
              [2, 1].map((copy) => (
                <div
                  key={`${box.id}-copy-${copy}`}
                  data-testid="stack-copy"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: box.x + copy * MAP_SIZES.stackOffset,
                    top: box.y + copy * MAP_SIZES.stackOffset,
                    width: box.w,
                    height: box.h,
                    boxSizing: "border-box",
                    ...{ borderRadius: 6, ...MAP_ARTWORK[room].box },
                  }}
                />
              )),
            )}

          {ordered.map((box) => (
            <Box
              key={box.id}
              room={room}
              box={box}
              selected={selectedId === box.id}
              dimmed={outsideIds.has(box.id) || (selecting && !joined.boxes.has(box.id))}
              onPath={selecting && joined.boxes.has(box.id)}
              target={false}
              onSelect={select}
              onOpenContainer={insideAgents.has(box.id) ? onOpenContainer : undefined}
            />
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, ...caption }}>
        <span>{MAP_COPY.openedRows}</span>
        <span>{selectedTitle ? `${selectedTitle} selected` : ""}</span>
      </div>
    </div>
  );
}

/* ── the map ── */

interface Drag {
  fromId: string;
  x1: number;
  y1: number;
  x: number;
  y: number;
  over: string | null;
}

/** The input a drag from `box`'s output dot offers: a step's output, or a file or a tool. */
const inputFrom = (box: MapBox): Use | null =>
  box.kind === "step" ? { kind: "output", node_id: box.id } : box.kind === "file" ? { kind: "file", node_id: box.id } : box.kind === "tool" ? { kind: "tool", node_id: box.id } : null;

export function BuildMap(props: BuildMapProps) {
  const { mode = "maker", steps, groups, files, tools, results, suggestions: asked, selectedId, onSelect, onClear, onOpenPrompt, onConnect, opened, onOpenContainer, onBack, onLeave } = props;
  const reader = mode === "reader";
  const room = useResolvedTheme();
  // Readers never see a suggestion: only the uses the maker accepted are published.
  const suggestions = useMemo(() => (reader ? [] : asked), [reader, asked]);
  const layout = useMemo(() => layoutMap(steps, groups, files, tools, results, suggestions), [steps, groups, files, tools, results, suggestions]);
  const joined = useMemo(() => joinedTo(layout, selectedId), [layout, selectedId]);
  const [said, say] = useAnnouncer();
  const [drag, setDrag] = useState<Drag | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, "");
  const marker = `arrow-${uid}`;
  const markerStrong = `arrow-strong-${uid}`;

  const ordered = useMemo(() => [...layout.boxes].sort((a, b) => a.lane - b.lane || a.column - b.column || a.y - b.y), [layout]);
  const byId = useMemo(() => new Map(layout.boxes.map((box) => [box.id, box])), [layout]);
  const selecting = Boolean(selectedId) && joined.boxes.size > 0;

  const accepted = layout.wires.filter((wire) => !wire.suggested).length;
  const suggested = layout.wires.length - accepted;
  const selected = selectedId ? byId.get(selectedId) : undefined;

  const point = (event: PointerEvent): { x: number; y: number } => {
    const rect = canvas.current?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };

  /** The step box under a point, other than the one being dragged from. */
  const boxAt = (x: number, y: number, except: string): MapBox | null =>
    layout.boxes.find((box) => box.id !== except && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) ?? null;

  const onDotDown = (box: MapBox) => (event: PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const at = point(event);
    setDrag({ fromId: box.id, x1: box.x + box.w, y1: box.y + MAP_SIZES.head / 2, x: at.x, y: at.y, over: null });
  };

  const onDotMove = (event: PointerEvent<HTMLSpanElement>) => {
    if (!drag) return;
    const at = point(event);
    const under = boxAt(at.x, at.y, drag.fromId);
    setDrag({ ...drag, x: at.x, y: at.y, over: under && under.kind === "step" ? under.id : null });
  };

  const finish = (event: PointerEvent<HTMLSpanElement>, drop: boolean) => {
    if (!drag) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const from = byId.get(drag.fromId);
    const at = point(event);
    const under = drop ? boxAt(at.x, at.y, drag.fromId) : null;
    setDrag(null);
    if (!drop || !from || !under) return;
    const use = inputFrom(from);
    if (!use) return;
    if (under.kind !== "step") {
      say("That cannot take an input here. Only a step can; use Add an input in Details.");
      return;
    }
    const current = under.inputs.filter((input) => !input.suggested).map((input) => input.use);
    const why = inputRefusal(under.id, current, use, steps);
    if (why) {
      say(why);
      return;
    }
    onConnect(under.id, use);
    say(`Added an input to ${boxName(under)}.`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && selectedId) {
      event.stopPropagation();
      onClear();
    }
  };

  const open = useCallback((id: string) => onOpenPrompt?.(id), [onOpenPrompt]);

  if (opened) {
    return (
      <OpenedMap
        container={opened}
        steps={steps}
        files={files}
        tools={tools}
        results={results}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpenContainer={onOpenContainer}
        onBack={onBack}
        onLeave={onLeave}
      />
    );
  }
  const hasContainer = steps.some((step) => step.kind === "agent" || step.kind === "team");
  const hasAgent = steps.some((step) => step.kind === "agent");

  /* UI-P94: the maker's legend draws its samples 1px `--text2`, as the composer's board does. */
  const sample: CSSProperties = { display: "inline-block", width: 24, height: 0, borderTop: `${1}px solid ${t.text2}`, verticalAlign: "middle" };
  const caption: CSSProperties = geist(12, 400, t.text2);
  const count: CSSProperties = { fontVariantNumeric: "tabular-nums" };
  const Box = RefinedBoxView;
  /** The session each lane is led by the real mark of (its tool's, else its model's), from the groups `layoutMap` made the first lanes from. */
  const laneMark = new Map(groups.map((group) => [group.sessionId ?? `typed-${group.number}`, group]));

  return (
    <div onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <LiveRegion message={said} />
      {reader ? null : (
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px 16px", ...caption }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={sample} />
            goes into <span style={count}>{accepted}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ ...sample, borderTopStyle: "dashed" }} />
            suggested <span style={count}>{suggested}</span>
          </span>
        </span>
        <span style={geist(12, 400, t.label)}>{MAP_COPY.key}</span>
      </div>
      )}

      <div
        role="group"
        aria-label="Map"
        data-testid="build-map"
        style={
          refinedWell
        }
      >
        <div ref={canvas} style={{ position: "relative", width: layout.width, height: layout.height }}>
          {layout.lanes.map((lane) =>
            <div
              key={lane.key}
              data-testid="map-lane"
              data-dashed={lane.dashed ? "true" : undefined}
              style={{
                position: "absolute",
                left: 0,
                top: lane.y,
                width: layout.width,
                height: lane.h,
                boxSizing: "border-box",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                borderRadius: 6,
                background: lane.dashed ? "transparent" : MAP_ARTWORK[room].lane,
                border: `1px ${lane.dashed ? `dashed ${t.line}` : `solid ${t.hairline}`}`,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6, maxWidth: MAP_SIZES.label - 16, minWidth: 0, ...geist(12, 500, t.text) }}>
                <ModelMark tool={laneMark.get(lane.key)?.tool} model={laneMark.get(lane.key)?.model} size={16} />
                <span style={ellipsis}>{lane.label}</span>
              </span>
              {lane.sub ? <span style={{ ...geist(11, 400, t.label), maxWidth: 100, lineHeight: "14px" }}>{lane.sub}</span> : null}
            </div>,
          )}
          {layout.columns.map((column) =>
            column.date ? (
              <span
                key={column.index}
                data-testid="map-column-date"
                style={{ position: "absolute", left: column.x, top: 0, ...(geist(10.5, 500, t.label)), textTransform: "uppercase", letterSpacing: "0.06em" }}
              >
                {columnDate(column.date)}
              </span>
            ) : null,
          )}

          <svg width={layout.width} height={layout.height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
            <defs>
              <marker id={marker} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" style={{ fill: t.text2 }} />
              </marker>
              <marker id={markerStrong} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M 0 0 L 6 3 L 0 6 z" style={{ fill: t.text }} />
              </marker>
            </defs>
            <Wires wires={layout.wires} joined={joined.wires} selecting={selecting} />
          </svg>

          {ordered.map((box) => (
            <Box
              key={box.id}
              room={room}
              box={box}
              selected={selectedId === box.id}
              dimmed={selecting && !joined.boxes.has(box.id)}
              onPath={selecting && joined.boxes.has(box.id)}
              target={drag?.over === box.id}
              onSelect={onSelect}
              onOpen={onOpenPrompt ? open : undefined}
              onOpenContainer={onOpenContainer}
              reader={reader}
            />
          ))}

          {onOpenContainer
            ? ordered
                .filter((box) => isContainerBox(box))
                .map((box) => (
                  <button
                    key={`open-${box.id}`}
                    type="button"
                    data-testid={`map-open-${box.id}`}
                    aria-label={`Open ${boxName(box).split(",")[0]}`}
                    onClick={() => {
                      onSelect(box.id);
                      onOpenContainer(box.id);
                    }}
                    style={
                      {
                        position: "absolute",
                        left: box.x + box.w - 54,
                        top: box.y + 3,
                        height: 22,
                        padding: "0 8px",
                        boxSizing: "border-box",
                        borderRadius: 6,
                        ...CONTROL,
                        ...geist(11.5, 500, t.text),
                        cursor: "pointer",
                        ...(selecting && !joined.boxes.has(box.id) ? DIM : null),
                      }
                    }
                  >
                    Open
                  </button>
                ))
            : null}

          {ordered
            .filter((box) => box.kind !== "result")
            .map((box) => (
              <span
                key={`dot-${box.id}`}
                data-testid={`map-dot-${box.id}`}
                aria-hidden="true"
                title={reader ? undefined : "Drag to connect"}
                onPointerDown={reader ? undefined : onDotDown(box)}
                onPointerMove={reader ? undefined : onDotMove}
                onPointerUp={reader ? undefined : (event) => finish(event, true)}
                onPointerCancel={reader ? undefined : (event) => finish(event, false)}
                style={
                  {
                    /* The output's square on the box's right edge, centred on the head as the wire leaves it. */
                    position: "absolute",
                    left: box.x + box.w - SQUARE / 2,
                    top: box.y + MAP_SIZES.head / 2 - SQUARE / 2,
                    ...squarePaint(selecting && joined.boxes.has(box.id)),
                    cursor: reader ? "default" : "crosshair",
                    pointerEvents: reader ? "none" : undefined,
                    touchAction: "none",
                    ...(selecting && !joined.boxes.has(box.id) ? DIM : null),
                  }
                }
              />
            ))}

          {drag ? (
            <svg width={layout.width} height={layout.height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
              <path
                data-testid="map-drag-line"
                d={`M ${drag.x1} ${drag.y1} C ${drag.x1 + 0.6 * (drag.x - drag.x1)} ${drag.y1}, ${drag.x - 0.6 * (drag.x - drag.x1)} ${drag.y}, ${drag.x} ${drag.y}`}
                fill="none"
                strokeWidth={1.2}
                strokeDasharray="4 4"
                style={{ stroke: t.text }}
              />
            </svg>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px 16px", ...caption }}>
        <span>
          {MAP_COPY.rows}
          {hasContainer && onOpenContainer ? (
            <>
              {" · "}
              <span>{hasAgent ? MAP_COPY.openAgent : MAP_COPY.openTeam}</span>
            </>
          ) : null}
        </span>
        <span>
          {reader
            ? `${selected && selected.kind === "step" ? `Step ${selected.number} open · ` : ""}what it doesn't touch is dimmed`
            : `${selected && selected.kind === "step" ? `${boxName(selected).split(",")[0]} selected · ` : selected ? `${selected.title} selected · ` : ""}what it doesn't touch is dimmed · Esc clears`}
        </span>
      </div>
    </div>
  );
}

export default BuildMap;
