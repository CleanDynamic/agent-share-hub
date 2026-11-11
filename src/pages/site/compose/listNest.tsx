/* CA-04 P2, CA-21 P3: dragging in the List: a tile, a session or a part, by the `grip` at its left.

   `@dnd-kit/core` with its pointer, touch and keyboard sensors; the `grip` handle is the only drag start (18 by 22, 44 high on a
   phone, where a long press starts the drag); the rest of a tile keeps its click and double-click. What is held is drawn in the
   `DragOverlay` as a copy of its own element at its own size, with a shadow and nothing else. Where it will land is not drawn on the
   tiles: the build slides to make room (`useBuildSorting`) and the skeleton behind it says where (`skeleton.tsx`). Held over
   the middle third of a tile that can take it for half a second, that tile becomes the target (the selected fill and a `--text2` edge).

   Nothing here writes. `useBuildSorting` hands a drop to the List's handlers, which say what happened in one polite line. */

import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useDraggable, useSensor, useSensors, type CollisionDetection, type KeyboardCoordinateGetter, type Modifier } from "@dnd-kit/core";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { SETTLE_MS } from "@/lib/build/buildMotion";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { prefersReducedMotion, STANDARD } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";

import { bareButton } from "./refinedStyles";
import { SESSION_DRAG, SOURCE_FILE_DRAG, SOURCE_SESSION_DRAG, WORKSTREAM_DRAG, type Held, type Sorting } from "./useBuildSorting";
import { size } from "@/lib/theme/space";
import { r } from "@/lib/theme/radius";

/** Where a held tile is dropped. */
export type NestTarget = { kind: "tile"; id: string } | { kind: "gap"; index: number } | { kind: "session"; key: string } | { kind: "workstream"; key: string };

interface NestState {
  /** The drag's id, or null. */
  active: string | null;
  held: Held | null;
  /** The tile that has become the target of the one held, or null. */
  send: string | null;
  phone: boolean;
}

const NestContext = createContext<NestState | null>(null);

/** CA-14 P4: a session's own drag. Its draggable id starts with this, so a tile's id (a node id) can never match it. */
export { SESSION_DRAG, WORKSTREAM_DRAG };
export const isSessionDrag = (id: string | null | undefined): boolean => Boolean(id?.startsWith(SESSION_DRAG));
/** CA-17 P2: a part's own drag. Its draggable id starts with this. */
export const isWorkstreamDrag = (id: string | null | undefined): boolean => Boolean(id?.startsWith(WORKSTREAM_DRAG));

/* ── the drag's pieces, shared by the List's own context and the page's (`ComposeDnd`, UX-02 P3) ── */

/** Nothing is "over" anything: the place is decided from the pointer and the page's own boxes (`useBuildSorting`). */
export const noCollisions: CollisionDetection = () => [];

/** The shadow a held copy carries, and nothing else is added to it: no scale, no turn, no fade. */
export function heldShadow(dusk: boolean): string {
  return dusk ? `0 0 0 1px ${t.segOnBorder}, 0 18px 40px color-mix(in srgb, black 55%, transparent)` : `0 0 0 1px ${t.segOnBorder}, 0 14px 32px color-mix(in srgb, black 18%, transparent)`;
}

/** The held copy: the element's own markup at its own size. A session or a part has no ground of its own, so it sits on a block. */
export function HeldCopy({ overlay }: { overlay: NonNullable<Sorting["overlay"]> }) {
  const dusk = useResolvedTheme() === "dusk";
  const shadow = heldShadow(dusk);
  const whole = overlay.type === "session" || overlay.type === "part";
  return (
    <div data-testid="held-copy" data-held={overlay.type} data-ground={whole ? "surface" : undefined} aria-hidden="true" style={{ width: overlay.w, fontSize: 13.5, cursor: "grabbing", pointerEvents: "none", position: "relative", ...(whole ? { backgroundColor: t.surface, borderRadius: 12, boxShadow: shadow } : { boxShadow: shadow, borderRadius: 12 }) }}>
      {whole ? <span aria-hidden="true" style={{ position: "absolute", inset: -6, borderRadius: 14, boxShadow: `0 0 0 1px ${t.segOnBorder}`, pointerEvents: "none" }} /> : null}
      {/* SV-01: raw HTML on purpose. `overlay.html` is `cloneHtml(element).outerHTML` in useBuildSorting.ts, the markup React already drew for a tile the reader is dragging; it is never user text. */}
      <div dangerouslySetInnerHTML={{ __html: overlay.html }} />
    </div>
  );
}

/** The sensors: a touch screen of any width picks up by a press of 250 ms on the grip (CA-27 P4); a mouse after 4 px; the keys. */
export function useDragSensors(phone: boolean, coordinateGetter: KeyboardCoordinateGetter) {
  /* CA-27 P4: a touch screen of any width (a tablet's too) picks a tile up by a press of 250 ms on its grip, so one finger anywhere else scrolls. */
  const coarse = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const press = phone || coarse ? { delay: 250, tolerance: 6 } : { distance: 4 };
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: press }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );
}

/** The held thing's own element moves as the page slides, so the copy keeps to where it was picked up, plus the pointer's travel. */
export function keepToStartOf(initial: Sorting["initial"], at: Sorting["keyboardAt"]): Modifier {
  return ({ transform, activeNodeRect }) => (at ? { ...transform, x: at.x, y: at.y } : initial && activeNodeRect ? { ...transform, x: transform.x - (activeNodeRect.left - initial.left), y: transform.y - (activeNodeRect.top - initial.top) } : transform);
}

/** While something is held, the page's cursor is the grab. */
export function useGrabbingCursor(holding: boolean) {
  useEffect(() => {
    if (!holding) return;
    const before = document.body.style.cursor;
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.cursor = before;
    };
  }, [holding]);
}

export const DRAG_ACCESSIBILITY = {
  // The line under the build is the polite announcement (`sorting.said`): these say nothing of their own.
  announcements: { onDragStart: () => "", onDragOver: () => "", onDragEnd: () => "", onDragCancel: () => "" },
  screenReaderInstructions: { draggable: "Press Space to pick up the step, the arrow keys to move it, and Space again to drop it. Escape puts it back." },
};

export interface DndHost {
  /** The List hands its drag state to the page, every render. */
  register: (sorting: Sorting | null) => void;
}

export const ComposeDndContext = createContext<DndHost | null>(null);

/** Whether the List is inside the page's drag context (it then owns none of its own). */
export const useComposeDnd = (): DndHost | null => useContext(ComposeDndContext);

/** The List's part: hand `sorting` to the page's context, every render, and take it back when the List goes. */
export function useComposeDndHost(host: DndHost | null, sorting: Sorting): void {
  useLayoutEffect(() => {
    host?.register(sorting);
  });
  useEffect(() => () => host?.register(null), [host]);
}

/** The held copy's way back to its place: `SETTLE_MS` on `STANDARD`; none under reduced motion, or when `settles` is false. */
export const dropAnimationOf = (settles: boolean) => (prefersReducedMotion() || !settles ? null : { duration: SETTLE_MS, easing: STANDARD });

/**
 * The drag around the List. Its state is `useBuildSorting`'s; this is the `DndContext` (sensors, the held copy in the
 * `DragOverlay`) and the context the tiles and heads read.
 */
export function NestList({ phone, sorting, children }: { phone: boolean; sorting: Sorting; children: ReactNode }) {
  /* UX-02 P3: inside the composer the drag context is the page's (`ComposeDnd`, round Sources and the List); the List hands it its state. */
  const shared = useComposeDnd();
  const state: NestState = { active: sorting.held ? (sorting.held.type === "session" ? `${SESSION_DRAG}${sorting.held.id}` : sorting.held.type === "part" ? `${WORKSTREAM_DRAG}${sorting.held.id}` : sorting.held.id) : null, held: sorting.held, send: sorting.send, phone };
  if (shared) return <NestContext.Provider value={state}>{children}</NestContext.Provider>;
  return (
    <NestContext.Provider value={state}>
      <OwnDnd phone={phone} sorting={sorting}>
        {children}
      </OwnDnd>
    </NestContext.Provider>
  );
}

/** A List with no `ComposeDnd` round it (its own tests, a dev page) keeps its own context, as before. */
function OwnDnd({ phone, sorting, children }: { phone: boolean; sorting: Sorting; children: ReactNode }) {
  const sensors = useDragSensors(phone, sorting.coordinateGetter);
  useGrabbingCursor(sorting.holding);
  return (
    <DndContext sensors={sensors} collisionDetection={noCollisions} onDragStart={sorting.onDragStart} onDragMove={sorting.onDragMove} onDragCancel={sorting.onDragCancel} onDragEnd={sorting.onDragEnd} accessibility={DRAG_ACCESSIBILITY}>
      {children}
      <DragOverlay modifiers={sorting.holding ? [keepToStartOf(sorting.initial, sorting.keyboardAt)] : undefined} dropAnimation={dropAnimationOf(true)}>{sorting.overlay ? <HeldCopy overlay={sorting.overlay} /> : null}</DragOverlay>
    </DndContext>
  );
}

/**
 * A tile's part in the drag: the ref its card takes (it is a place to drop), the handle's props, and whether the tile
 * held can go into it right now. Outside a `NestList`, nothing: no handle and no drop.
 */
export function useNestTile(id: string) {
  const state = useContext(NestContext);
  const disabled = !state;
  const drag = useDraggable({ id, disabled });
  const takes = Boolean(state?.send && state.send === id);
  return {
    on: !disabled,
    setRef: (element: HTMLElement | null) => {
      drag.setNodeRef(element);
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
  // CA-21: while something is held no tile shows what it shows when it is near, so none changes size under the pointer.
  const holding = Boolean(useContext(NestContext)?.active);
  useEffect(() => {
    const tile = ref.current?.closest<HTMLElement>('[role="group"], [data-testid="sent-with-tile"], [data-source-drag]');
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
  return phone || (near && !holding);
}

/** The `grip` at a tile's left: the only place a drag starts. 18 by 22; 44 high on a phone. It is drawn while its tile is hovered or has focus, and on a phone. */
export function DragHandle({ label, nest, testId = "drag-handle", phone }: { label: string; nest: Pick<ReturnType<typeof useNestTile>, "on" | "handle" | "held">; testId?: string; phone?: boolean }) {
  const nestState = useContext(NestContext);
  const state = phone === undefined ? nestState : { phone };
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
  /* F72: a tile that cannot move keeps the handle's 16 wide slot, so its badge and title stand on the same edges as every other tile's. */
  if (!nest.on) return <span aria-hidden="true" data-testid={`${testId}-slot`} style={{ width: size.icon, flexShrink: 0 }} />;
  return (
    <button
      type="button"
      ref={hold}
      data-testid={testId}
      data-hit=""
      {...attributes}
      {...listeners}
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
      onMouseEnter={handlers.onMouseEnter}
      onMouseLeave={handlers.onMouseLeave}
      onFocus={handlers.onFocus}
      onBlur={handlers.onBlur}
      style={{
        ...bareButton,
        width: state?.phone ? size.touch : size.icon,
        height: state?.phone ? size.touch : size.controlSmall,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: t.label,
        borderRadius: r.chip,
        opacity: near || nest.held ? 1 : 0,
        cursor: nest.held ? "grabbing" : "grab",
        touchAction: "none",
        ...ring(interactive.focusVisible),
      }}
    >
      <Glyph name="grip" size={size.icon} />
    </button>
  );
}

/**
 * UX-02 P3 Stage B: a row of Sources as something to drag onto the List, by the List's own grip. Its id starts with `src-session:` or
 * `src-file:`, so it never matches a node, a session or a part. Only inside the page's drag context (`ComposeDnd`). The keys do not
 * pick it up: a row is added from its `+` or its menu (see the report).
 */
export function useSourceDrag(source: "session" | "file", id: string) {
  const shared = useContext(ComposeDndContext);
  const dragId = `${source === "session" ? SOURCE_SESSION_DRAG : SOURCE_FILE_DRAG}${id}`;
  const drag = useDraggable({ id: dragId, data: { source, id }, disabled: !shared });
  const { onKeyDown: _keys, ...listeners } = (drag.listeners ?? {}) as Record<string, unknown>;
  return {
    on: Boolean(shared),
    dragId,
    handle: { attributes: { ...drag.attributes, tabIndex: -1 }, listeners: listeners as typeof drag.listeners, setActivator: drag.setActivatorNodeRef },
    setRef: drag.setNodeRef,
    held: drag.isDragging,
  };
}

/** A session's head: nothing draws on it while a tile is held (the place is the skeleton's), so it takes nothing and shows no line. */
export function useNestSession(_key: string) {
  return { setRef: (_element: HTMLElement | null) => undefined, takes: false, sessionHeld: false, overForSession: false };
}

/** CA-14 P4: a session's head as something to drag. The `grip` in the head starts it, as a tile's does. */
export function useNestSessionDrag(key: string) {
  const state = useContext(NestContext);
  const drag = useDraggable({ id: `${SESSION_DRAG}${key}`, disabled: !state });
  return { on: Boolean(state), setRef: drag.setNodeRef, handle: { attributes: drag.attributes, listeners: drag.listeners, setActivator: drag.setActivatorNodeRef }, held: drag.isDragging, phone: Boolean(state?.phone) };
}

/** A part's head: the same, nothing is drawn on it. */
export function useNestWorkstream(_key: string) {
  return { setRef: (_element: HTMLElement | null) => undefined, takes: false, overForPart: false };
}

/** CA-17 P2: a part's head as something to drag, by the `grip` in it. */
export function useNestWorkstreamDrag(key: string) {
  const state = useContext(NestContext);
  const drag = useDraggable({ id: `${WORKSTREAM_DRAG}${key}`, disabled: !state });
  return { on: Boolean(state), setRef: drag.setNodeRef, handle: { attributes: drag.attributes, listeners: drag.listeners, setActivator: drag.setActivatorNodeRef }, held: drag.isDragging, phone: Boolean(state?.phone) };
}
