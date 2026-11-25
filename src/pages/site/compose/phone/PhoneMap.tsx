/* Prompt 23: the Map on a phone, read only. The well fills the width (Panel, radius 12, a 16px dot grid); nodes are 150 wide
   on Card (radius 12, padding 8 10: the number box and the kind 13 Text 3, then the title 13/600); links are 2px. Pinch to
   zoom, drag to pan, tap a node to open its step; a zoom-in and a fit button (44, secondary) at the bottom right. Reordering
   happens only in List: dragging a node would fight panning on a 390 canvas.

   The well is moved with a transform only (nothing animates a layout property). Each node is a button, so a keyboard and a
   screen reader reach every step in the map's order. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { REF_KIND } from "@/lib/build/postRefs";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { clampZoom, fitScale, KIND_ICON, layoutPhoneMap, MAP_NODE, PHONE_EDITOR_COPY, type PhoneMapModel, type PlacedNode } from "./phoneEditorModel";

const WELL_HEIGHT = 420;
/** A move under this many px is a tap, not a pan. */
const TAP_SLOP = 8;

interface View {
  x: number;
  y: number;
  scale: number;
}

function Node({ node, selected, onOpen }: { node: PlacedNode; selected: boolean; onOpen: (id: string) => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  const kind = REF_KIND[node.kind] ?? "Step";
  return (
    <button
      type="button"
      data-map-node={node.id}
      aria-label={`${kind} ${node.number}: ${node.title}`}
      onClick={() => onOpen(node.id)}
      {...handlers}
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        boxSizing: "border-box",
        width: MAP_NODE.width,
        height: MAP_NODE.height,
        padding: "8px 10px",
        border: 0,
        borderRadius: 12,
        background: t.module,
        color: t.text,
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        cursor: "pointer",
        ...(selected ? { boxShadow: `0 0 0 2px ${t.brandAccent}` } : null),
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label, minWidth: 0 }}>
        <span style={{ fontFamily: DM_MONO, fontVariantNumeric: "tabular-nums", color: t.text2 }}>{node.number}</span>
        <MobileIcon name={KIND_ICON[node.kind]} size={14} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{kind}</span>
      </span>
      <span style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "18px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.title}</span>
    </button>
  );
}

function RoundButton({ label, icon, onClick }: { label: string; icon: "new" | "expand"; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{ width: 44, height: 44, padding: 0, border: 0, borderRadius: 22, background: t.control, color: t.text, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", ...ring(state.focusVisible) }}
    >
      <MobileIcon name={icon} size={20} />
    </button>
  );
}

export function PhoneMap({ model, selectedId, onOpen }: { model: PhoneMapModel; selectedId: string | null; onOpen: (id: string) => void }) {
  const placed = useMemo(() => layoutPhoneMap(model), [model]);
  const well = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ start: View; points: { x: number; y: number }[]; moved: boolean } | null>(null);
  /** The last gesture moved the map: the click it ends with is not a tap on a node. */
  const panned = useRef(false);

  const fit = useCallback(() => {
    const box = well.current?.getBoundingClientRect();
    if (!box) return;
    const scale = fitScale(placed, { width: box.width, height: box.height });
    setView({ scale, x: (box.width - placed.width * scale) / 2, y: Math.max(0, (box.height - placed.height * scale) / 2) });
  }, [placed]);

  useLayoutEffect(() => {
    fit();
  }, [fit]);

  /* Pinch zoom stays on the map: the page under it does not zoom. */
  useEffect(() => {
    const element = well.current;
    if (!element) return;
    const stop = (event: Event) => event.preventDefault();
    element.addEventListener("gesturestart", stop);
    return () => element.removeEventListener("gesturestart", stop);
  }, []);

  const begin = () => {
    gesture.current = { start: view, points: [...pointers.current.values()], moved: false };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    panned.current = false;
    begin();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const now = [...pointers.current.values()];
    const { start, points } = gesture.current;
    if (now.length >= 2 && points.length >= 2) {
      const span = (list: { x: number; y: number }[]) => Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y) || 1;
      const centre = (list: { x: number; y: number }[]) => ({ x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 });
      const box = well.current?.getBoundingClientRect();
      const origin = box ? { x: centre(points).x - box.left, y: centre(points).y - box.top } : { x: 0, y: 0 };
      const scale = clampZoom(start.scale * (span(now) / span(points)));
      const k = scale / start.scale;
      const shift = { x: centre(now).x - centre(points).x, y: centre(now).y - centre(points).y };
      gesture.current.moved = true;
      setView({ scale, x: origin.x - (origin.x - start.x) * k + shift.x, y: origin.y - (origin.y - start.y) * k + shift.y });
      return;
    }
    const first = points[0];
    if (!first) return;
    const dx = event.clientX - first.x;
    const dy = event.clientY - first.y;
    if (!gesture.current.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    gesture.current.moved = true;
    setView({ ...start, x: start.x + dx, y: start.y + dy });
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (gesture.current?.moved) panned.current = true;
    if (pointers.current.size > 0) begin();
    else gesture.current = null;
  };

  const zoomIn = () => {
    const box = well.current?.getBoundingClientRect();
    const origin = box ? { x: box.width / 2, y: box.height / 2 } : { x: 0, y: 0 };
    setView((current) => {
      const scale = clampZoom(current.scale * 1.4);
      const k = scale / current.scale;
      return { scale, x: origin.x - (origin.x - current.x) * k, y: origin.y - (origin.y - current.y) * k };
    });
  };

  const dots: CSSProperties = { backgroundImage: `radial-gradient(${t.line} 1px, transparent 1px)`, backgroundSize: "16px 16px" };

  return (
    <section aria-label={PHONE_EDITOR_COPY.map} data-testid="phone-map" style={{ padding: `0 ${PHONE_MARGIN}px`, display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        ref={well}
        data-testid="phone-map-well"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (!panned.current) return;
          panned.current = false;
          event.stopPropagation();
          event.preventDefault();
        }}
        style={{ position: "relative", height: WELL_HEIGHT, borderRadius: 12, overflow: "hidden", background: t.surface, touchAction: "none", ...dots }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: placed.width, height: placed.height, transformOrigin: "0 0", transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          <svg aria-hidden="true" width={placed.width} height={placed.height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {placed.links.map((link) => (
              <path key={`${link.from}-${link.to}`} d={link.d} fill="none" stroke={t.text2} strokeWidth={2} strokeLinecap="round" />
            ))}
          </svg>
          {placed.nodes.map((node) => (
            <Node key={node.id} node={node} selected={node.id === selectedId} onOpen={onOpen} />
          ))}
        </div>
        <div style={{ position: "absolute", right: 12, bottom: 12, display: "flex", gap: 8 }}>
          <RoundButton label={PHONE_EDITOR_COPY.zoomIn} icon="new" onClick={zoomIn} />
          <RoundButton label={PHONE_EDITOR_COPY.fit} icon="expand" onClick={fit} />
        </div>
      </div>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>{PHONE_EDITOR_COPY.mapHint}</p>
    </section>
  );
}

export default PhoneMap;
