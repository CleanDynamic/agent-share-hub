/* CA-17 P4 — the build page's map of sessions: the same column and panel the composer draws (`SessionMap`,
   `SessionMapPanel`), read-only. A reader's head has Fit to screen and nothing else (no direction switch, no Map options);
   the maker's direction is the one drawn (vertical below 768 wide); the panel has no "Open in the build".

   It is loaded on demand when a reader chooses Map, as `StepsList` always did. Whether the reader is offered the Map at all
   is the maker's choice (`readerSeesMap`, CA-17 P6). */

import { useMemo, useRef, useState, type PointerEvent } from "react";

import { PANEL_RADIUS } from "@/components/shell/chromeSize";
import { t } from "@/lib/theme/tokens";

import { readerMapDirection } from "@/lib/build/making";
import { sessionMapFor } from "@/lib/build/sessionMap";
import { BETWEEN, useMinWidth } from "@/components/shell/useMinWidth";
import { MAP_AND_PANEL, MAP_COLUMN, MAP_STACKED } from "@/pages/site/compose/mapRecipes";
import { SessionMapColumn } from "@/pages/site/compose/SessionMap";
import { SessionMapPanel } from "@/pages/site/compose/SessionMapPanel";

import type { BuildStepsView } from "./buildModel";

export interface ReaderMapProps {
  view: BuildStepsView;
  announce: (text: string) => void;
  /** Open the full prompt window on a step. */
  onRead: (id: string) => void;
  /** Where the map starts: a session selected (a link to it, or `#session-` in the address). */
  start?: { selected: string | null } | null;
  /** Prompt 22: on a phone the map is read only in a 420 tall well on Panel with the dot grid: drag to pan, pinch to zoom. */
  phone?: boolean;
}

/** The phone well's height, and how far a pinch may zoom out and in. */
export const PHONE_MAP_HEIGHT = 420;
export const PHONE_MAP_ZOOM = { min: 0.5, max: 2 } as const;

/** Two fingers apart or together scale the drawing (a transform, never a layout property); one finger pans, as a scroll box does. */
function usePinch() {
  const [zoom, setZoom] = useState(1);
  const points = useRef(new Map<number, { x: number; y: number }>());
  const from = useRef<{ distance: number; zoom: number } | null>(null);
  const distance = () => {
    const [a, b] = [...points.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.current.size === 2) from.current = { distance: distance(), zoom };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!points.current.has(event.pointerId)) return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = from.current;
    if (!start || start.distance === 0 || points.current.size < 2) return;
    const next = start.zoom * (distance() / start.distance);
    setZoom(Math.min(PHONE_MAP_ZOOM.max, Math.max(PHONE_MAP_ZOOM.min, next)));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    points.current.delete(event.pointerId);
    if (points.current.size < 2) from.current = null;
  };
  return { zoom, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } };
}

export default function ReaderMap({ view, start, phone = false }: ReaderMapProps) {
  const pinch = usePinch();
  const [selected, setSelected] = useState<string | null>(start?.selected ?? null);
  const steps = useMemo(() => view.steps.map((entry) => entry.step), [view.steps]);
  const model = useMemo(() => sessionMapFor({ groups: view.map.groups, steps, files: view.map.files, making: view.making ?? {} }), [view.map, steps, view.making]);
  const stacked = !useMinWidth(BETWEEN.stack);
  const shown = selected && model.sessions.some((session) => session.key === selected) ? selected : null;
  if (phone) {
    return (
      <div data-testid="reader-map" data-phone="" style={MAP_STACKED}>
        <div
          data-testid="reader-map-well"
          {...pinch.handlers}
          style={{
            height: PHONE_MAP_HEIGHT,
            overflow: "auto",
            borderRadius: PANEL_RADIUS,
            background: t.surface,
            backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`,
            backgroundSize: "16px 16px",
            touchAction: "pan-x pan-y",
            overscrollBehavior: "contain",
          }}
        >
          <div style={{ ...MAP_COLUMN, padding: 12, transform: pinch.zoom === 1 ? undefined : `scale(${pinch.zoom})`, transformOrigin: "0 0" }}>
            <SessionMapColumn model={model} direction={readerMapDirection(view.making)} selected={shown} onSelect={setSelected} />
          </div>
        </div>
        <SessionMapPanel model={model} selected={shown} stacked />
      </div>
    );
  }
  return (
    <div data-testid="reader-map" style={stacked ? MAP_STACKED : MAP_AND_PANEL}>
      <div style={MAP_COLUMN}>
        <SessionMapColumn model={model} direction={readerMapDirection(view.making)} selected={shown} onSelect={setSelected} />
      </div>
      <SessionMapPanel model={model} selected={shown} stacked={stacked} />
    </div>
  );
}
