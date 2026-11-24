/* CA-17 P4 — the build page's map of sessions: the same column and panel the composer draws (`SessionMap`,
   `SessionMapPanel`), read-only. A reader's head has Fit to screen and nothing else (no direction switch, no Map options);
   the maker's direction is the one drawn (vertical below 768 wide); the panel has no "Open in the build".

   It is loaded on demand when a reader chooses Map, as `StepsList` always did. Whether the reader is offered the Map at all
   is the maker's choice (`readerSeesMap`, CA-17 P6). */

import { useMemo, useRef, useState, type PointerEvent } from "react";

import { PANEL_RADIUS } from "@/components/shell/chromeSize";
import { t } from "@/lib/theme/tokens";

import { readerMapDirection } from "@/lib/build/making";
import { joinedSessions, sessionMapFor, type SessionMapModel } from "@/lib/build/sessionMap";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";
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

/** The phone's session boxes: 130 wide Cards (radius 10) in stage rows, 16 apart across and 40 apart down. */
export const PHONE_BOX = { w: 130, h: 64, gapX: 16, gapY: 40, pad: 16 } as const;

function phoneLayout(model: SessionMapModel) {
  const rows = new Map<number, string[]>();
  for (const session of model.sessions) {
    const stage = model.stages.stageOf[session.key] ?? 1;
    rows.set(stage, [...(rows.get(stage) ?? []), session.key]);
  }
  const ordered = [...rows.entries()].sort(([a], [b]) => a - b);
  const pos = new Map<string, { x: number; y: number }>();
  let width = 0;
  ordered.forEach(([, keys], row) => {
    keys.forEach((key, col) => {
      pos.set(key, { x: PHONE_BOX.pad + col * (PHONE_BOX.w + PHONE_BOX.gapX), y: PHONE_BOX.pad + row * (PHONE_BOX.h + PHONE_BOX.gapY) });
    });
    width = Math.max(width, PHONE_BOX.pad * 2 + keys.length * PHONE_BOX.w + (keys.length - 1) * PHONE_BOX.gapX);
  });
  return { pos, width, height: PHONE_BOX.pad * 2 + ordered.length * PHONE_BOX.h + Math.max(ordered.length - 1, 0) * PHONE_BOX.gapY };
}

/** Read only: tap a session to see what joins it (its neighbours and the lines to them stay; the rest dim). */
function PhoneMap({ model, selected, onSelect, zoom }: { model: SessionMapModel; selected: string | null; onSelect: (key: string | null) => void; zoom: number }) {
  const layout = useMemo(() => phoneLayout(model), [model]);
  const joined = joinedSessions(model, selected);
  const on = (key: string) => !selected || key === selected || joined.has(key);
  const centre = (key: string, edge: "top" | "bottom") => {
    const at = layout.pos.get(key);
    return at ? { x: at.x + PHONE_BOX.w / 2, y: at.y + (edge === "bottom" ? PHONE_BOX.h : 0) } : null;
  };
  return (
    <div style={{ width: layout.width * zoom, height: layout.height * zoom }}>
      <div style={{ position: "relative", width: layout.width, height: layout.height, transform: zoom === 1 ? undefined : `scale(${zoom})`, transformOrigin: "0 0" }}>
        <svg width={layout.width} height={layout.height} aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          {model.links.map((link) => {
            const a = centre(link.from, "bottom");
            const b = centre(link.session, "top");
            if (!a || !b) return null;
            const hot = selected !== null && (link.from === selected || link.session === selected);
            const mid = (a.y + b.y) / 2;
            return <path key={link.id} d={`M${a.x} ${a.y}C${a.x} ${mid} ${b.x} ${mid} ${b.x} ${b.y}`} fill="none" stroke={hot ? t.text : t.label} strokeWidth={hot ? 2 : 1.5} opacity={!selected || hot ? 1 : 0.4} />;
          })}
        </svg>
        {model.sessions.map((session) => {
          const at = layout.pos.get(session.key);
          if (!at) return null;
          const chosen = session.key === selected;
          return (
            <button
              key={session.key}
              type="button"
              data-testid="phone-map-session"
              aria-pressed={chosen}
              onClick={() => onSelect(chosen ? null : session.key)}
              style={{
                position: "absolute",
                left: at.x,
                top: at.y,
                width: PHONE_BOX.w,
                height: PHONE_BOX.h,
                boxSizing: "border-box",
                padding: "8px 12px",
                border: 0,
                borderRadius: 10,
                background: t.module,
                boxShadow: chosen ? `inset 0 0 0 1px ${t.selectedEdge}` : undefined,
                opacity: on(session.key) ? 1 : 0.5,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 2,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: FIGTREE,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{`Session ${session.number}`}</span>
              {session.title ?? session.app ? <span style={{ fontSize: 13, fontWeight: 600, lineHeight: "16px", color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title ?? session.app}</span> : null}
              <span style={{ fontFamily: DM_MONO, fontSize: 13, lineHeight: "16px", color: t.label }}>{`${session.tiles} ${session.tiles === 1 ? "step" : "steps"}`}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
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
          <PhoneMap model={model} selected={shown} onSelect={setSelected} zoom={pinch.zoom} />
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
