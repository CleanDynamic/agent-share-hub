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
import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";

import { bareButton, chipStyle } from "./refinedStyles";

/** Where a held tile is dropped. */
export type NestTarget = { kind: "tile"; id: string } | { kind: "gap"; index: number } | { kind: "session"; key: string };

interface NestState {
  /** The tile being held, or null. */
  active: string | null;
  /** The target under the pointer, as a droppable id. */
  over: string | null;
  canTake: (id: string, parentId: string) => boolean;
  phone: boolean;
}

const NestContext = createContext<NestState | null>(null);

const tileTarget = (id: string) => `tile:${id}`;
const gapTarget = (index: number) => `gap:${index}`;
const sessionTarget = (key: string) => `session:${key}`;

function targetOf(droppable: string): NestTarget | null {
  const [kind, ...rest] = droppable.split(":");
  const value = rest.join(":");
  if (kind === "tile" && value) return { kind: "tile", id: value };
  if (kind === "gap" && /^\d+$/.test(value)) return { kind: "gap", index: Number(value) };
  if (kind === "session" && value) return { kind: "session", key: value };
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
  children,
}: {
  phone: boolean;
  canTake: (id: string, parentId: string) => boolean;
  label: (id: string) => string;
  onDrop: (id: string, target: NestTarget) => void;
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
          if (target.kind === "tile" && (target.id === id || !canTake(id, target.id))) return;
          onDrop(id, target);
        }}
        accessibility={{
          announcements: {
            onDragStart: ({ active: held }) => `Picked up ${label(String(held.id))}.`,
            onDragOver: ({ over: under }) => (under ? `Over ${describe(String(under.id), label)}.` : "Not over a place to drop."),
            onDragEnd: ({ over: under }) => (under ? `Dropped on ${describe(String(under.id), label)}.` : "Put back where it was."),
            onDragCancel: () => "Put back where it was.",
          },
          screenReaderInstructions: { draggable: "Press Space to pick up the tile, the arrow keys to move it, and Space again to drop it. Escape puts it back." },
        }}
      >
        {children}
        <DragOverlay dropAnimation={null}>{active ? <span style={{ ...chipStyle, boxShadow: t.shadowFloat }}>{label(active)}</span> : null}</DragOverlay>
      </DndContext>
    </NestContext.Provider>
  );
}

function describe(droppable: string, label: (id: string) => string): string {
  const target = targetOf(droppable);
  if (!target) return "a place to drop";
  if (target.kind === "tile") return label(target.id);
  if (target.kind === "gap") return `the place before step ${target.index + 1}`;
  return "that session";
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

/** The `grip` at a tile's left: the only place a drag starts. 18 by 22; 44 high on a phone. */
export function DragHandle({ label, nest }: { label: string; nest: ReturnType<typeof useNestTile> }) {
  const state = useContext(NestContext);
  const { state: interactive, handlers } = useInteractive<HTMLButtonElement>();
  if (!nest.on) return null;
  const { attributes, listeners, setActivator } = nest.handle;
  return (
    <button
      type="button"
      ref={setActivator}
      data-testid="drag-handle"
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
  return { setRef: drop.setNodeRef, takes: Boolean(state?.active) && state?.over === sessionTarget(key) };
}
