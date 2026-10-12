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

   HAND-WRITTEN SVG, no dependency (RULES §3): one layer of wires under the
   boxes, and one overlay for the line that follows the pointer. The boxes are
   real buttons, in lane order then column order, which is the focus order. */

import { memo, useCallback, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

import { LiveRegion, useAnnouncer } from "@/components/brand/LiveRegion";
import { inputRefusal, type SessionGroup, type Step, type Use } from "@/lib/build/graph";
import { joinedTo, layoutMap, MAP_SIZES, type MapBox, type MapPiece, type MapResult, type MapSuggestion, type MapWire } from "@/lib/build/mapLayout";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

export const MAP_COPY = {
  key: "click to select · double-click to read all of it · drag from a dot to connect",
  rows: "Rows by session, left to right by date",
} as const;

/** What the joined boxes keep and the rest drop to (UI-P68). */
export const DIMMED = 0.42;

export interface BuildMapProps {
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
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "3 MAR". */
export function columnDate(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(at.getTime()) ? "" : `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** The accessible name of a box: "Prompt 3, Fix the layout, 2 inputs". */
export function boxName(box: Pick<MapBox, "kind" | "stepKind" | "number" | "title" | "inputs">): string {
  if (box.kind === "file") return `File, ${box.title}`;
  if (box.kind === "tool") return `Tool, ${box.title}`;
  const count = box.inputs.length;
  const inputs = `${count} ${count === 1 ? "input" : "inputs"}`;
  if (box.kind === "result") return `Result, ${box.title}, ${inputs}`;
  const word = box.stepKind === "agent" ? "Agent" : box.stepKind === "team" ? "Team" : box.stepKind === "manual" ? "Manual step" : "Prompt";
  return `${word} ${box.number}, ${box.title}, ${inputs}`;
}

const mono = (size: 10 | 10.5 | 11 | 11.5): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, color: t.text2 });

const ellipsis: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

const DOT = 9;

/* ── a box ── */

interface BoxViewProps {
  box: MapBox;
  selected: boolean;
  dimmed: boolean;
  onPath: boolean;
  target: boolean;
  onSelect: (id: string) => void;
  onOpen?: (id: string) => void;
}

const BoxView = memo(function BoxView({ box, selected, dimmed, onPath, target, onSelect, onOpen }: BoxViewProps) {
  const openable = box.kind === "step" && box.stepKind === "prompt" && onOpen;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" && openable) {
      event.preventDefault();
      onSelect(box.id);
      onOpen?.(box.id);
    }
  };
  const piece = box.kind === "file" || box.kind === "tool";
  return (
    <button
      type="button"
      data-testid={`map-box-${box.id}`}
      data-kind={box.kind}
      data-evidence={box.kind === "result" ? "true" : undefined}
      aria-label={boxName(box)}
      aria-pressed={selected}
      onClick={() => onSelect(box.id)}
      onDoubleClick={openable ? () => onOpen?.(box.id) : undefined}
      onKeyDown={onKeyDown}
      style={{
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        boxSizing: "border-box",
        padding: 0,
        display: "flex",
        flexDirection: "column",
        textAlign: "left",
        borderRadius: 12,
        border: `1px solid ${box.kind === "result" ? t.evidence : t.line}`,
        background: t.solid,
        color: t.text,
        cursor: "pointer",
        opacity: dimmed ? DIMMED : 1,
        boxShadow: selected ? `0 0 0 2px ${t.text}` : target ? `0 0 0 2px ${t.action}` : undefined,
        outline: "none",
      }}
    >
      {piece ? (
        <span style={{ padding: "6px 10px", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <span style={mono(10.5)}>{box.kind === "file" ? "File" : "Tool"}</span>
          <span style={{ fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 600, color: t.text, ...ellipsis }}>{box.title}</span>
        </span>
      ) : (
        <>
          <span style={{ height: MAP_SIZES.head, flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "0 10px", minWidth: 0 }}>
            {box.kind === "result" ? <span style={mono(10.5)}>Result</span> : !box.defaultTitle && box.number ? <span style={{ ...mono(10.5), color: t.text }}>{box.number}</span> : null}
            <span style={{ fontFamily: FIGTREE, fontSize: 12.5, fontWeight: box.defaultTitle ? 500 : 600, color: box.defaultTitle ? t.text2 : t.text, ...ellipsis }}>{box.title}</span>
          </span>
          {box.inputs.map((input, at) => (
            <span key={input.key} style={{ position: "relative", height: MAP_SIZES.row, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 10px 0 12px", ...mono(10.5), ...(input.suggested ? { fontStyle: "italic" } : null) }}>
              <span
                aria-hidden="true"
                data-testid={`map-input-${box.id}-${at}`}
                style={{
                  position: "absolute",
                  left: -DOT / 2 - 1,
                  top: (MAP_SIZES.row - DOT) / 2,
                  width: DOT,
                  height: DOT,
                  borderRadius: r.full,
                  boxSizing: "border-box",
                  border: `1.5px ${input.suggested ? "dashed" : "solid"} ${onPath ? t.text : t.text2}`,
                  background: onPath && !input.suggested ? t.text : t.solid,
                }}
              />
              <span style={ellipsis}>{input.label}</span>
            </span>
          ))}
          {box.inputs.length > 0 ? (
            <span style={{ height: MAP_SIZES.state, flexShrink: 0, padding: "0 10px", display: "flex", alignItems: "center", ...mono(10) }}>
              {box.suggested > 0 ? `${box.suggested} suggested` : `${box.accepted} of ${box.accepted} inputs accepted`}
            </span>
          ) : null}
          <span
            style={{
              height: MAP_SIZES.body,
              flexShrink: 0,
              padding: "0 10px",
              boxSizing: "border-box",
              fontFamily: FIGTREE,
              fontSize: 11.5,
              lineHeight: 1.45,
              color: t.text2,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflowWrap: "anywhere",
            }}
          >
            {box.text}
          </span>
          <span style={{ height: MAP_SIZES.foot, flexShrink: 0, padding: "0 10px", display: "flex", alignItems: "center", ...mono(10) }}>
            {box.kind === "step" ? `${box.words} words` : ""}
          </span>
        </>
      )}
    </button>
  );
});

/* ── the wires ── */

function Wires({ wires, joined, selecting, marker, markerStrong }: { wires: readonly MapWire[]; joined: ReadonlySet<string>; selecting: boolean; marker: string; markerStrong: string }) {
  return (
    <>
      {wires.map((wire) => {
        const strong = joined.has(wire.id);
        const dim = selecting && !strong;
        return (
          <path
            key={wire.id}
            data-testid="map-wire"
            data-strong={strong ? "true" : undefined}
            data-suggested={wire.suggested ? "true" : undefined}
            d={wire.d}
            fill="none"
            strokeWidth={strong ? 1.75 : 1.5}
            strokeDasharray={wire.suggested ? "4 4" : undefined}
            markerEnd={`url(#${strong ? markerStrong : marker})`}
            style={{ stroke: strong ? t.text : t.text2, opacity: dim ? DIMMED : 1 }}
          />
        );
      })}
    </>
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
  const { steps, groups, files, tools, results, suggestions, selectedId, onSelect, onClear, onOpenPrompt, onConnect } = props;
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

  const sample: CSSProperties = { display: "inline-block", width: 24, height: 0, borderTop: `1.5px solid ${t.text2}`, verticalAlign: "middle" };

  return (
    <div onKeyDown={onKeyDown} style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
      <LiveRegion message={said} />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={sample} />
            goes into <span style={mono(11)}>{accepted}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ ...sample, borderTopStyle: "dashed" }} />
            suggested <span style={mono(11)}>{suggested}</span>
          </span>
        </span>
        <span style={mono(11.5)}>{MAP_COPY.key}</span>
      </div>

      <div
        role="group"
        aria-label="Map"
        data-testid="build-map"
        style={{
          overflow: "auto",
          maxHeight: "70dvh",
          padding: 16,
          borderRadius: 12,
          border: `1px solid ${t.hairline}`,
          background: `radial-gradient(${t.hairline} 1px, transparent 1px) 0 0 / 16px 16px, ${t.cell}`,
          backgroundAttachment: "local",
        }}
      >
        <div ref={canvas} style={{ position: "relative", width: layout.width, height: layout.height }}>
          {layout.lanes.map((lane) => (
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
                borderRadius: 12,
                background: lane.dashed ? "transparent" : tokenAlpha("action", 0.08),
                border: lane.dashed ? `1px dashed ${t.line}` : undefined,
              }}
            >
              <div style={{ width: MAP_SIZES.label - 12, padding: "6px 0 0 12px", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontFamily: FIGTREE, fontSize: 12.5, fontWeight: 600, color: t.text, ...ellipsis }}>{lane.label}</span>
                {lane.sub ? <span style={{ ...mono(11), ...ellipsis }}>{lane.sub}</span> : null}
              </div>
            </div>
          ))}
          {layout.columns.map((column) =>
            column.date ? (
              <span key={column.index} data-testid="map-column-date" style={{ position: "absolute", left: column.x, top: 2, ...mono(10.5), textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
            <Wires wires={layout.wires} joined={joined.wires} selecting={selecting} marker={marker} markerStrong={markerStrong} />
          </svg>

          {ordered.map((box) => (
            <BoxView
              key={box.id}
              box={box}
              selected={selectedId === box.id}
              dimmed={selecting && !joined.boxes.has(box.id)}
              onPath={selecting && joined.boxes.has(box.id)}
              target={drag?.over === box.id}
              onSelect={onSelect}
              onOpen={onOpenPrompt ? open : undefined}
            />
          ))}

          {ordered
            .filter((box) => box.kind !== "result")
            .map((box) => (
              <span
                key={`dot-${box.id}`}
                data-testid={`map-dot-${box.id}`}
                aria-hidden="true"
                title="Drag to connect"
                onPointerDown={onDotDown(box)}
                onPointerMove={onDotMove}
                onPointerUp={(event) => finish(event, true)}
                onPointerCancel={(event) => finish(event, false)}
                style={{
                  position: "absolute",
                  left: box.x + box.w - DOT / 2,
                  top: box.y + MAP_SIZES.head / 2 - DOT / 2,
                  width: DOT,
                  height: DOT,
                  borderRadius: r.full,
                  boxSizing: "border-box",
                  border: `1.5px solid ${selecting && joined.boxes.has(box.id) ? t.text : t.text2}`,
                  background: selecting && joined.boxes.has(box.id) ? t.text : t.solid,
                  cursor: "crosshair",
                  touchAction: "none",
                  opacity: selecting && !joined.boxes.has(box.id) ? DIMMED : 1,
                }}
              />
            ))}

          {drag ? (
            <svg width={layout.width} height={layout.height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
              <path
                data-testid="map-drag-line"
                d={`M ${drag.x1} ${drag.y1} C ${drag.x1 + 0.6 * (drag.x - drag.x1)} ${drag.y1}, ${drag.x - 0.6 * (drag.x - drag.x1)} ${drag.y}, ${drag.x} ${drag.y}`}
                fill="none"
                strokeWidth={1.75}
                strokeDasharray="4 4"
                style={{ stroke: t.action }}
              />
            </svg>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontFamily: FIGTREE, fontSize: 12.5, color: t.text2 }}>
        <span>{MAP_COPY.rows}</span>
        <span>
          {selected && selected.kind === "step" ? `${boxName(selected).split(",")[0]} selected · ` : selected ? `${selected.title} selected · ` : ""}
          what it doesn't touch is dimmed · Esc clears
        </span>
      </div>
    </div>
  );
}

export default BuildMap;
