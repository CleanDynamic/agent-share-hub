/* CA-21 P2: the skeleton behind the build while something is held.

   One layer, positioned in the build column under the components (`z-index` below them, `pointer-events: none`), drawn from
   `skeletonOf` (pure, `sortLayout.ts`): a socket behind every component of the held kind, a lane round each container, the rail
   with its ticks and numbers, and the place the held thing would land. It never changes a component's own style. It exists only
   while something is held (and while it fades out after the drop), and fades in over `SKELETON_IN`.

   Where a box moves because things slid, it slides too (a translate, and a scale for a lane): `animateFrom`, `FAST`, `STANDARD`. */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { LANE_OPEN_MS, SKELETON_IN, SKELETON_OUT, SOCKETS_AFTER_MS, SOCKETS_IN_MS } from "@/lib/build/buildMotion";
import { EMPTY_PLACE_HEIGHT, type Lane, type Rail, type Rect, type Skeleton, type Socket, type Target } from "@/lib/build/sortLayout";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { fade, prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { mono } from "@/lib/theme/type";

import { animateFrom } from "./flip";
import { text } from "./refinedStyles";

const place = (rect: Rect): CSSProperties => ({ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, boxSizing: "border-box" });

/** A box of the layer: where it stands, and a slide from where it stood when that changes. */
function Box({ id, rect, style, children, testId, onMount }: { id: string; rect: Rect; style: CSSProperties; children?: ReactNode; testId: string; onMount?: (element: HTMLDivElement) => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const was = useRef<Rect | null>(null);
  useLayoutEffect(() => {
    if (ref.current && onMount) onMount(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => {
    const before = was.current;
    was.current = rect;
    if (before && ref.current) animateFrom(ref.current, { x: before.x, y: before.y, w: before.w, h: before.h }, { x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  }, [rect.x, rect.y, rect.w, rect.h]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} data-testid={testId} data-skeleton-id={id} style={{ ...place(rect), ...style }}>
      {children}
    </div>
  );
}

/** A thin dashed edge round a place, on the well. */
const socketStyle = (radius: number, edge: string): CSSProperties => ({ border: `1px dashed ${edge}`, borderRadius: radius, background: t.well });

/** A socket that fades in with a new session's lane: 80 ms after it starts to open, over 160. */
const fadeSocket = (element: HTMLElement) => {
  if (prefersReducedMotion() || typeof element.animate !== "function") return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SOCKETS_IN_MS, delay: SOCKETS_AFTER_MS, easing: STANDARD, fill: "backwards" });
};

/** A lane that opens: from nothing to its height, over 200 ms (a scale from its top; nothing else of it changes). */
const openLane = (element: HTMLElement) => {
  if (prefersReducedMotion() || typeof element.animate !== "function") return;
  element.animate([{ transform: "scaleY(0)", transformOrigin: "0 0" }, { transform: "none", transformOrigin: "0 0" }], { duration: LANE_OPEN_MS, easing: STANDARD, fill: "backwards" });
};

function SocketBox({ socket, fadeIn }: { socket: Socket; fadeIn: boolean }) {
  return <Box id={socket.id} rect={socket.rect} testId="skeleton-socket" onMount={fadeIn ? fadeSocket : undefined} style={socketStyle(socket.radius, t.skeletonEdge)} />;
}

function LaneBox({ lane, dusk, opens }: { lane: Lane; dusk: boolean; opens: boolean }) {
  if (!lane.outline) return null;
  return <Box id={lane.id} rect={lane.rect} testId="skeleton-lane" onMount={opens ? openLane : undefined} style={{ border: `1px solid ${t.hairlineModule}`, borderRadius: lane.radius, background: tokenAlpha("text", dusk ? 0.012 : 0.015) }} />;
}

/** "Lands here", then, 8 apart, the place: "Session 2 · 2 of 3". Over its own start, a plain socket. */
function TargetBox({ target }: { target: Target }) {
  return (
    <Box id={target.id} rect={target.rect} testId="skeleton-target" style={{ ...socketStyle(target.radius, t.skeletonTarget), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {target.words ? (
        <>
          <span style={text(12.5, 400, t.text2)}>{target.words.lead}</span>
          <span style={text(12.5, 500, t.text)}>{target.words.place}</span>
        </>
      ) : null}
    </Box>
  );
}

const NUMBER: CSSProperties = { ...mono(11), color: t.label, position: "absolute", transform: "translate(-100%, -50%)", whiteSpace: "nowrap", lineHeight: 1 };

function RailBox({ rail }: { rail: Rail }) {
  return (
    <div data-testid="skeleton-rail" data-container={rail.container} style={{ position: "absolute", left: 0, top: 0 }}>
      <div style={{ position: "absolute", left: rail.x, top: rail.top, width: 1, height: Math.max(0, rail.bottom - rail.top), background: t.windowBorder }} />
      {rail.ticks.map((tick) => (
        <div key={tick.id} data-testid="skeleton-tick" data-n={tick.n} style={{ position: "absolute", left: 0, top: 0 }}>
          <div style={{ position: "absolute", left: tick.tickFrom, top: tick.y, width: tick.tickTo - tick.tickFrom, height: 1, background: t.segOnBorder }} />
          <span data-testid="skeleton-number" style={{ ...NUMBER, left: tick.numberRight, top: tick.y }}>
            {tick.n}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The layer. `shown` fades it in; false fades it out (it stays mounted until the page takes it away). */
export function SkeletonLayer({ skeleton, shown, fadeIn, opening }: { skeleton: Skeleton; shown: boolean; fadeIn?: ReadonlySet<string>; opening?: ReadonlySet<string> }) {
  const dusk = useResolvedTheme() === "dusk";
  const held = skeleton.target?.id;
  // It comes in from nothing: mounted see-through, then shown, so the fade has somewhere to start from.
  const [entered, setEntered] = useState(prefersReducedMotion());
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      data-testid="skeleton-layer"
      data-kind={skeleton.kind}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none", opacity: shown && entered ? 1 : 0, transition: fade(shown ? SKELETON_IN : SKELETON_OUT) }}
    >
      {skeleton.lanes.map((lane) => (
        <LaneBox key={`lane:${lane.id}`} lane={lane} dusk={dusk} opens={Boolean(opening?.has(lane.id))} />
      ))}
      {skeleton.sockets
        .filter((socket) => socket.id !== held)
        .map((socket) => (
          <SocketBox key={`socket:${socket.id}`} socket={socket} fadeIn={Boolean(fadeIn?.has(socket.id))} />
        ))}
      {skeleton.target ? <TargetBox target={skeleton.target} /> : null}
      {skeleton.rails.map((rail) => (
        <RailBox key={`rail:${rail.container}`} rail={rail} />
      ))}
    </div>
  );
}

/** CA-21 P2: an empty session or part, while something is held: one place 44 tall, styled as the target, in place of "No tiles yet". */
export function EmptyPlace({ words }: { words: string }) {
  return (
    <div data-testid="skeleton-empty" style={{ ...socketStyle(12, t.skeletonTarget), height: EMPTY_PLACE_HEIGHT, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={text(12.5, 400, t.text2)}>{words}</span>
    </div>
  );
}
