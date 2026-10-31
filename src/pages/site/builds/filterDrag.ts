/* SV-24 P2: dragging a filter by its grip, and resizing a checklist by its handle. No library.

   THE POINTER LIVES IN A REF (`rerender-use-ref-transient-values`): a move writes the pointer's place into the ref and asks for
   one animation frame, and the frame writes ONE style, the dragged filter's `transform`. Every position is read once, when the drag
   begins (`js-batch-dom-css`: all reads before any write), so a frame reads nothing. React renders nothing while the pointer
   moves; the order changes once, on drop, and at once.

   Only the dragged filter moves, with a transform, and the others do not animate. A grip that is let go without having moved is a
   click, and the caller opens the grip's menu (Move up, Move down), which is also how a filter is moved without a pointer.

   The handlers are React's on the grip itself (pointer events do not scroll the page; the grip has `touch-action: none` so a
   touch drag is not taken for a scroll). The grip captures the pointer so the drag goes on outside it. */

import { useRef, type PointerEvent, type RefObject } from "react";

import { HEIGHT_MAX, HEIGHT_MIN, clampHeight, dropIndex } from "@/lib/build/buildsLayout";

/** Further than this and a press is a drag. */
export const DRAG_SLOP = 4;

export interface GripDrag {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  /** True when the press was a click: it never moved. */
  onPointerUp: (event: PointerEvent<HTMLElement>) => boolean;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

interface Active {
  id: string;
  el: HTMLElement;
  startY: number;
  y: number;
  centres: { id: string; centre: number }[];
  frame: number;
}

const frameOf = (callback: () => void): number => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : (setTimeout(callback, 16) as unknown as number));
const cancelFrame = (frame: number) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(frame) : clearTimeout(frame));

/** A press that starts a drag: the primary button of a mouse, or any touch or pen contact. */
const isPrimary = (event: PointerEvent<HTMLElement>) => event.pointerType !== "mouse" || event.button === 0;

/**
 * Drag handlers for the filters inside `container`, each wrapped in an element with `data-filter-slot="<id>"`. `onDrop` gets the
 * dragged filter's id and the place it was dropped at among the filters drawn open.
 */
export function useFilterDrag(container: RefObject<HTMLElement | null>, onDrop?: (id: string, index: number) => void): ((id: string) => GripDrag) | undefined {
  const active = useRef<Active | null>(null);
  if (!onDrop) return undefined;

  const paint = () => {
    const drag = active.current;
    if (!drag) return;
    drag.frame = 0;
    const dy = drag.y - drag.startY;
    if (Math.abs(dy) > DRAG_SLOP) drag.el.style.transform = `translateY(${dy}px)`;
  };

  const finish = (event: PointerEvent<HTMLElement>) => {
    const drag = active.current;
    if (!drag) return null;
    if (drag.frame) cancelFrame(drag.frame);
    active.current = null;
    drag.el.style.transform = "";
    drag.el.style.position = "";
    drag.el.style.zIndex = "";
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    return drag;
  };

  return (id) => ({
    onPointerDown: (event) => {
      if (!isPrimary(event) || !container.current) return;
      /* Stops the grip's menu opening on the press: it opens on release, if the press was a click. */
      event.preventDefault();
      const slots = Array.from(container.current.querySelectorAll<HTMLElement>("[data-filter-slot]"));
      const el = slots.find((slot) => slot.dataset.filterSlot === id);
      if (!el) return;
      /* All the reads, once. */
      const centres = slots.map((slot) => {
        const box = slot.getBoundingClientRect();
        return { id: slot.dataset.filterSlot as string, centre: box.top + box.height / 2 };
      });
      el.style.position = "relative";
      el.style.zIndex = "1";
      active.current = { id, el, startY: event.clientY, y: event.clientY, centres, frame: 0 };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      const drag = active.current;
      if (!drag) return;
      drag.y = event.clientY;
      if (!drag.frame) drag.frame = frameOf(paint);
    },
    onPointerUp: (event) => {
      const drag = finish(event);
      if (!drag) return false;
      const dy = drag.y - drag.startY;
      if (Math.abs(dy) <= DRAG_SLOP) return true;
      const own = drag.centres.find((entry) => entry.id === drag.id)?.centre ?? 0;
      onDrop(drag.id, dropIndex(drag.centres, drag.id, own + dy));
      return false;
    },
    onPointerCancel: (event) => {
      finish(event);
    },
  });
}

/* ── a checklist's height ── */

export interface ResizeDrag {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
}

/**
 * Resize handlers for one list: the height at the start is read once, a move writes the list's `max-height` once a frame, and the
 * height is reported once, on release. The list is the element the handle sits under.
 */
export function useListResize(list: RefObject<HTMLElement | null>, onResize: (px: number) => void): ResizeDrag {
  const active = useRef<{ startY: number; y: number; startHeight: number; frame: number } | null>(null);

  const paint = () => {
    const drag = active.current;
    if (!drag || !list.current) return;
    drag.frame = 0;
    list.current.style.maxHeight = `${clampHeight(drag.startHeight + drag.y - drag.startY)}px`;
  };

  const stop = (event: PointerEvent<HTMLElement>, report: boolean) => {
    const drag = active.current;
    if (!drag) return;
    if (drag.frame) cancelFrame(drag.frame);
    active.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (report) onResize(clampHeight(drag.startHeight + drag.y - drag.startY));
    else if (list.current) list.current.style.maxHeight = "";
  };

  return {
    onPointerDown: (event) => {
      if (!isPrimary(event) || !list.current) return;
      event.preventDefault();
      active.current = { startY: event.clientY, y: event.clientY, startHeight: list.current.getBoundingClientRect().height, frame: 0 };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      const drag = active.current;
      if (!drag) return;
      drag.y = event.clientY;
      if (!drag.frame) drag.frame = frameOf(paint);
    },
    onPointerUp: (event) => stop(event, true),
    onPointerCancel: (event) => stop(event, false),
  };
}

/** What a key does to a height: arrows by one step, Page Up and Down by four, Home the shortest, End the tallest. */
export function heightAfterKey(key: string, height: number, step: number): number | null {
  switch (key) {
    case "ArrowDown":
      return clampHeight(height + step);
    case "ArrowUp":
      return clampHeight(height - step);
    case "PageDown":
      return clampHeight(height + step * 4);
    case "PageUp":
      return clampHeight(height - step * 4);
    case "Home":
      return HEIGHT_MIN;
    case "End":
      return HEIGHT_MAX;
    default:
      return null;
  }
}
