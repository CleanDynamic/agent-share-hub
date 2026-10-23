/* CA-04 P2 — dragging tiles in the List: one tile into another (sent with it, at the same time, in the same message),
   onto a gap (its own step there) or onto another session's head (into that session).

   `@dnd-kit/core` with its pointer, touch and keyboard sensors. The `grip` handle at a tile's left is the only drag
   start (18 by 22, 44 high on a phone, where a long press starts the drag); the rest of the tile keeps its click and
   double-click. While dragging, a tile that can take the one held gets the selected fill and a `--text2` edge; one that
   can't doesn't change. Between top-level tiles a 2px `--text2` line shows where it would land as its own step.

   Nothing here writes. `NestList` hands a drop to the List's handlers, which say what happened in one polite line. */

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { bareButton, chipStyle } from "./refinedStyles";

/** Where a held tile is dropped. */
export type NestTarget = { kind: "tile"; id: string } | { kind: "gap"; index: number } | { kind: "session"; key: string } | { kind: "workstream"; key: string };

interface NestState {
  /** The tile being held, or null. */
  active: string | null;
  /** The target under the pointer, as a droppable id. */
  over: string | null;
  canTake: (id: string, parentId: string) => boolean;
  phone: boolean;
}

const NestContext = createContext<NestState | null>(null);

/** CA-14 P4: a session's own drag. Its draggable id starts with this, so a tile's id (a node id) can never match it. */
export const SESSION_DRAG = "sdrag:";
export const isSessionDrag = (id: string | null | undefined): boolean => Boolean(id?.startsWith(SESSION_DRAG));
/** CA-17 P2: a part's own drag. Its draggable id starts with this. */
export const WORKSTREAM_DRAG = "wdrag:";
export const isWorkstreamDrag = (id: string | null | undefined): boolean => Boolean(id?.startsWith(WORKSTREAM_DRAG));
const tileTarget = (id: string) => `tile:${id}`;
const gapTarget = (index: number) => `gap:${index}`;
const sessionTarget = (key: string) => `session:${key}`;
const workstreamTarget = (key: string) => `workstream:${key}`;

function targetOf(droppable: string): NestTarget | null {
  const [kind, ...rest] = droppable.split(":");
  const value = rest.join(":");
  if (kind === "tile" && value) return { kind: "tile", id: value };
  if (kind === "gap" && /^\d+$/.test(value)) return { kind: "gap", index: Number(value) };
  if (kind === "session" && value) return { kind: "session", key: value };
  if (kind === "workstream" && value) return { kind: "workstream", key: value };
  return null;
}

/** The innermost target under the pointer: a tile inside a tile wins over the tile around it. */
const innermost: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const hits = within.length > 0 ? within : rectIntersection(args);
  const area = (id: string | number) => {
    const rect = args.droppableRects.get(id);
    return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY;
  };
  return [...hits].sort((a, b) => area(a.id) - area(b.id));
};

/** The drag around the List. `label` names a tile in the floating chip; `onDrop` gets the tile and where it went. */
export function NestList({
  phone,
  canTake,
  label,
  onDrop,
  onDropSession,
  sessionLabel,
  onDropOnWorkstream,
  onDropWorkstream,
  workstreamLabel,
  children,
}: {
  phone: boolean;
  canTake: (id: string, parentId: string) => boolean;
  label: (id: string) => string;
  onDrop: (id: string, target: NestTarget) => void;
  /** CA-14 P4: a session's head dropped on another's: move the first before (or after) the second. */
  onDropSession?: (key: string, over: string) => void;
  /** CA-14 P4: names a session for the drag's announcements and its floating chip. */
  sessionLabel?: (key: string) => string;
  /** CA-17 P2: a session's head dropped on a part's head: it goes to the end of that part. */
  onDropOnWorkstream?: (sessionKey: string, workstreamKey: string) => void;
  /** CA-17 P2: a part's head dropped on another's: it takes that part's place. */
  onDropWorkstream?: (workstreamKey: string, over: string) => void;
  /** CA-17 P2: names a part for the drag's announcements and its floating chip. */
  workstreamLabel?: (key: string) => string;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const press = phone ? { delay: 250, tolerance: 6 } : { distance: 4 };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: press }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const nameOf = (id: string) =>
    isSessionDrag(id) ? (sessionLabel?.(id.slice(SESSION_DRAG.length)) ?? "that session") : isWorkstreamDrag(id) ? (workstreamLabel?.(id.slice(WORKSTREAM_DRAG.length)) ?? "that part") : label(id);
  const end = () => {
    setActive(null);
    setOver(null);
  };
  return (
    <NestContext.Provider value={{ active, over, canTake, phone }}>
      <DndContext
        sensors={sensors}
        collisionDetection={innermost}
        onDragStart={(event: DragStartEvent) => setActive(String(event.active.id))}
        onDragOver={(event: DragOverEvent) => setOver(event.over ? String(event.over.id) : null)}
        onDragCancel={end}
        onDragEnd={(event: DragEndEvent) => {
          const id = String(event.active.id);
          const target = event.over ? targetOf(String(event.over.id)) : null;
          end();
          if (!target) return;
          if (isSessionDrag(id)) {
            const key = id.slice(SESSION_DRAG.length);
            if (target.kind === "session" && target.key !== key) onDropSession?.(key, target.key);
            else if (target.kind === "workstream") onDropOnWorkstream?.(key, target.key);
            return;
          }
          if (isWorkstreamDrag(id)) {
            const key = id.slice(WORKSTREAM_DRAG.length);
            if (target.kind === "workstream" && target.key !== key) onDropWorkstream?.(key, target.key);
            return;
          }
          if (target.kind === "workstream") return;
          if (target.kind === "tile" && (target.id === id || !canTake(id, target.id))) return;
          onDrop(id, target);
        }}
        accessibility={{
          announcements: {
            onDragStart: ({ active: held }) => `Picked up ${nameOf(String(held.id))}.`,
            onDragOver: ({ over: under }) => (under ? `Over ${describe(String(under.id), nameOf, sessionLabel, workstreamLabel)}.` : "Not over a place to drop."),
            onDragEnd: ({ over: under }) => (under ? `Dropped on ${describe(String(under.id), nameOf, sessionLabel, workstreamLabel)}.` : "Put back where it was."),
            onDragCancel: () => "Put back where it was.",
          },
          screenReaderInstructions: { draggable: "Press Space to pick up the tile, the arrow keys to move it, and Space again to drop it. Escape puts it back." },
        }}
      >
        {children}
        <DragOverlay dropAnimation={null}>{active ? <span style={{ ...chipStyle, boxShadow: t.shadowFloat }}>{nameOf(active)}</span> : null}</DragOverlay>
      </DndContext>
    </NestContext.Provider>
  );
}

function describe(droppable: string, label: (id: string) => string, sessionLabel?: (key: string) => string, workstreamLabel?: (key: string) => string): string {
  const target = targetOf(droppable);
  if (!target) return "a place to drop";
  if (target.kind === "workstream") return workstreamLabel?.(target.key) ?? "that part";
  if (target.kind === "tile") return label(target.id);
  if (target.kind === "gap") return `the place before step ${target.index + 1}`;
  return sessionLabel?.(target.key) ?? "that session";
}

/**
 * A tile's part in the drag: the ref its card takes (it is a place to drop), the handle's props, and whether the tile
 * held can go into it right now. Outside a `NestList`, nothing: no handle and no drop.
 */
export function useNestTile(id: string) {
  const state = useContext(NestContext);
  const disabled = !state;
  const drag = useDraggable({ id, disabled });
  const drop = useDroppable({ id: tileTarget(id), disabled });
  const takes = Boolean(state?.active && state.active !== id && state.over === tileTarget(id) && state.canTake(state.active, id));
  return {
    on: !disabled,
    setRef: (element: HTMLElement | null) => {
      drag.setNodeRef(element);
      drop.setNodeRef(element);
    },
    handle: { attributes: drag.attributes, listeners: drag.listeners, setActivator: drag.setActivatorNodeRef },
    takes,
    held: drag.isDragging,
  };
}

/** A tile under a held tile that can take it: the selected fill, and its edge in `--text2`. */
export const TAKES: CSSProperties = { background: t.selectedFill, borderColor: t.text2 };

/**
 * CA-15 P10: whether the tile around `ref` is hovered or holds focus (keyboard or pointer). On a phone, which has no hover, always
 * true. Used for what a tile shows only when it is near: its drag handle and "Send with the step above". It changes
 * what is drawn at once, with no fade.
 */
export function useTileNear(ref: RefObject<HTMLElement | null>, phone: boolean): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const tile = ref.current?.closest<HTMLElement>('[role="group"], [data-testid="sent-with-tile"]');
    if (!tile || phone) return;
    const on = () => setNear(true);
    const off = (event: Event) => {
      if (event.type === "focusout" && tile.contains((event as FocusEvent).relatedTarget as Node | null)) return;
      setNear(false);
    };
    tile.addEventListener("pointerenter", on);
    tile.addEventListener("pointerleave", off);
    tile.addEventListener("focusin", on);
    tile.addEventListener("focusout", off);
    return () => {
      tile.removeEventListener("pointerenter", on);
      tile.removeEventListener("pointerleave", off);
      tile.removeEventListener("focusin", on);
      tile.removeEventListener("focusout", off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, ref.current]);
  return phone || near;
}

/** The `grip` at a tile's left: the only place a drag starts. 18 by 22; 44 high on a phone. It is drawn while its tile is hovered or has focus, and on a phone. */
export function DragHandle({ label, nest, testId = "drag-handle" }: { label: string; nest: Pick<ReturnType<typeof useNestTile>, "on" | "handle" | "held">; testId?: string }) {
  const state = useContext(NestContext);
  const { state: interactive, handlers } = useInteractive<HTMLButtonElement>();
  const own = useRef<HTMLButtonElement | null>(null);
  const near = useTileNear(own, Boolean(state?.phone));
  const { attributes, listeners, setActivator } = nest.handle;
  const hold = useCallback(
    (element: HTMLButtonElement | null) => {
      own.current = element;
      setActivator(element);
    },
    [setActivator],
  );
  if (!nest.on) return null;
  return (
    <button
      type="button"
      ref={hold}
      data-testid={testId}
      {...attributes}
      {...listeners}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onMouseEnter={handlers.onMouseEnter}
      onMouseLeave={handlers.onMouseLeave}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={{
        ...bareButton,
        width: 18,
        height: state?.phone ? 44 : 22,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: t.label,
        borderRadius: 4,
        opacity: near || nest.held ? 1 : 0,
        cursor: nest.held ? "grabbing" : "grab",
        touchAction: "none",
        ...ring(interactive.focusVisible),
      }}
    >
      <Glyph name="grip" size={16} />
    </button>
  );
}

/**
 * A place between top-level tiles. It takes no room, so nothing moves while nobody drags: it lies over the gap above
 * the tile it stands with (or below the last one), inside that tile's wrapper. Held over it, a 2px `--text2` line
 * shows where the tile lands as its own step.
 */
export function NestGap({ index, edge = "top" }: { index: number; edge?: "top" | "bottom" }) {
  const state = useContext(NestContext);
  const drop = useDroppable({ id: gapTarget(index), disabled: !state });
  if (!state) return null;
  const shown = Boolean(state.active) && state.over === gapTarget(index);
  return (
    <div
      ref={drop.setNodeRef}
      data-testid={`nest-gap-${index}`}
      aria-hidden="true"
      style={{ position: "absolute", left: 0, right: 0, ...(edge === "top" ? { top: -12 } : { bottom: -12 }), height: 12, display: "flex", alignItems: "center", pointerEvents: "none" }}
    >
      {shown ? <div data-testid="nest-line" style={{ width: "100%", height: 2, background: t.text2 }} /> : null}
    </div>
  );
}

/** A session's head as a place to drop: a tile dropped on it goes into that session. */
export function useNestSession(key: string) {
  const state = useContext(NestContext);
  const drop = useDroppable({ id: sessionTarget(key), disabled: !state });
  const sessionHeld = isSessionDrag(state?.active);
  return { setRef: drop.setNodeRef, takes: Boolean(state?.active) && !sessionHeld && !isWorkstreamDrag(state?.active) && state?.over === sessionTarget(key), sessionHeld, overForSession: sessionHeld && state?.over === sessionTarget(key) && state?.active !== `${SESSION_DRAG}${key}` };
}

/** CA-14 P4: whether a session is being dragged. The List folds every session to its head while it is, and opens them after the drop. */
export function useSessionDragging(): boolean {
  return isSessionDrag(useContext(NestContext)?.active);
}

/** CA-14 P4: a session's head as something to drag. The `grip` in the head starts it, as a tile's does. */
export function useNestSessionDrag(key: string) {
  const state = useContext(NestContext);
  const drag = useDraggable({ id: `${SESSION_DRAG}${key}`, disabled: !state });
  return { on: Boolean(state), setRef: drag.setNodeRef, handle: { attributes: drag.attributes, listeners: drag.listeners, setActivator: drag.setActivatorNodeRef }, held: drag.isDragging, phone: Boolean(state?.phone) };
}

/** CA-17 P2: a part's head as a place to drop. A session dropped on it goes to the end of that part; a part dropped on it takes its place. */
export function useNestWorkstream(key: string) {
  const state = useContext(NestContext);
  const drop = useDroppable({ id: workstreamTarget(key), disabled: !state });
  const sessionHeld = isSessionDrag(state?.active);
  const partHeld = isWorkstreamDrag(state?.active);
  const over = state?.over === workstreamTarget(key);
  return {
    setRef: drop.setNodeRef,
    takes: sessionHeld && over,
    overForPart: partHeld && over && state?.active !== `${WORKSTREAM_DRAG}${key}`,
  };
}

/** CA-17 P2: a part's head as something to drag, by the `grip` in it. */
export function useNestWorkstreamDrag(key: string) {
  const state = useContext(NestContext);
  const drag = useDraggable({ id: `${WORKSTREAM_DRAG}${key}`, disabled: !state });
  return { on: Boolean(state), setRef: drag.setNodeRef, handle: { attributes: drag.attributes, listeners: drag.listeners, setActivator: drag.setActivatorNodeRef }, held: drag.isDragging, phone: Boolean(state?.phone) };
}
