/* UX-02 P3 Stage A: the composer's one drag context, around both Sources and the List.

   The List's drag was a `DndContext` inside `NestList`, so nothing outside the List (Sources) could be picked up and dropped on it.
   This lifts the context, and the held copy's `DragOverlay`, to the page: `SandboxPage` puts `ComposeDnd` round Sources and the
   List, and the List hands it its drag state (`useBuildSorting`) through `useComposeDndHost`. The sensors, `noCollisions`,
   `keepToStart`, the cursor, the held copy and the overlay's `dropAnimation` are `NestList`'s, unchanged, shared from `listNest.tsx`.

   A List drawn with no `ComposeDnd` round it (its own tests, a dev page) keeps its own context in `NestList`, as before. */

import { DndContext, DragOverlay, type DragEndEvent, type DragMoveEvent, type DragStartEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { useRef, useState, type ReactNode } from "react";

import { ComposeDndContext, DRAG_ACCESSIBILITY, dropAnimationOf, HeldCopy, keepToStartOf, noCollisions, useDragSensors, useGrabbingCursor, type DndHost } from "./listNest";
import type { Sorting } from "./useBuildSorting";

/** What of the List's drag the page's overlay draws: re-drawn only when one of these changes. */
type Shown = Pick<Sorting, "overlay" | "holding" | "initial" | "keyboardAt">;
const sameShown = (a: Shown | null, b: Shown) => Boolean(a) && a?.overlay === b.overlay && a?.holding === b.holding && a?.initial === b.initial && a?.keyboardAt === b.keyboardAt;

export function ComposeDnd({ phone, children }: { phone: boolean; children: ReactNode }) {
  const sorting = useRef<Sorting | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  /* dnd-kit always draws its own (silent) live region and instructions. Before, a List with nothing to drag had no context and so
     none; they stay out of the document until something registers a drag, so the page keeps one live region of its own (CA-26 P4). */
  const [registered, setRegistered] = useState(false);
  const [aside] = useState(() => (typeof document === "undefined" ? undefined : document.createElement("div")));
  const [host] = useState<DndHost>(() => ({
    register: (next) => {
      sorting.current = next;
      setRegistered(Boolean(next));
      if (!next) return setShown(null);
      const view: Shown = { overlay: next.overlay, holding: next.holding, initial: next.initial, keyboardAt: next.keyboardAt };
      setShown((current) => (sameShown(current, view) ? current : view));
    },
  }));
  const coordinateGetter: KeyboardCoordinateGetter = (event, args) => sorting.current?.coordinateGetter(event, args) ?? undefined;
  const sensors = useDragSensors(phone, coordinateGetter);
  const holding = Boolean(shown?.holding);
  useGrabbingCursor(holding);
  return (
    <ComposeDndContext.Provider value={host}>
      <DndContext
        sensors={sensors}
        collisionDetection={noCollisions}
        onDragStart={(event: DragStartEvent) => sorting.current?.onDragStart(event)}
        onDragMove={(event: DragMoveEvent) => sorting.current?.onDragMove(event)}
        onDragCancel={() => sorting.current?.onDragCancel()}
        onDragEnd={(event: DragEndEvent) => sorting.current?.onDragEnd(event)}
        accessibility={{ ...DRAG_ACCESSIBILITY, container: registered ? undefined : aside }}
      >
        {children}
        <DragOverlay modifiers={holding ? [keepToStartOf(shown?.initial ?? null, shown?.keyboardAt ?? null)] : undefined} dropAnimation={dropAnimationOf(true)}>
          {shown?.overlay ? <HeldCopy overlay={shown.overlay} /> : null}
        </DragOverlay>
      </DndContext>
    </ComposeDndContext.Provider>
  );
}

