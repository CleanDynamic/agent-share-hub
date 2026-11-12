/* BF-13 (C6): dragging a column head to a new place. No library, the pattern of SV-24's filter drag.

   THE POINTER LIVES IN A REF: a move writes the pointer's place into the ref and asks for one animation frame, and the frame
   writes two styles, the dragged head's `transform` and the drop line's `left`. Every head's place is read once, when the drag
   begins, so a frame reads nothing. React renders nothing while the pointer moves; the order changes once, on drop.

   A press that has not moved past the slop is a click and sorts as before. Past it the press is a drag: the pointer is captured
   (only then, so a plain click still lands on the head's button), and the click that ends the drag is swallowed. Escape or a
   cancelled pointer ends the drag with nothing changed. Under reduced motion nothing here animates anyway: the transform follows the
   pointer and is removed at once on drop. */

import { useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";

import { t } from "@/lib/theme/tokens";

/** Further than this and a press is a drag. */
export const DRAG_SLOP = 4;

export interface ColumnDragHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

interface Active {
  id: string;
  el: HTMLElement;
  pointerId: number;
  startX: number;
  x: number;
  dragging: boolean;
  /** The other movable heads' centres and edges, read once. */
  heads: { id: string; centre: number; left: number; right: number }[];
  /** The dragged head's centre when the drag began. */
  startCentre: number;
  top: number;
  height: number;
  line: HTMLElement | null;
  frame: number;
}

const frameOf = (callback: () => void): number => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : (setTimeout(callback, 16) as unknown as number));
const cancelFrame = (frame: number) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(frame) : clearTimeout(frame));

/** Where the dragged head would land: how many of the other movable heads are left of its centre, moved. */
const landing = (drag: Active): number => dropIndexOf(drag.heads, drag.startCentre + drag.x - drag.startX);

/** Pure: the place among `heads` (left to right, the dragged one left out) a centre at `x` falls at. */
export function dropIndexOf(heads: readonly { centre: number }[], x: number): number {
  return heads.filter((head) => head.centre < x).length;
}

/**
 * Drag handlers for the movable heads in `row`, each a `th` with `data-column="<id>"` and `data-movable`. `onDrop` gets the
 * dragged column's id and its place among the movable columns (counted without it).
 */
export function useColumnDrag(row: RefObject<HTMLTableRowElement | null>, onDrop: (id: string, index: number) => void): (id: string) => ColumnDragHandlers {
  const active = useRef<Active | null>(null);
  const swallowClick = useRef(false);

  const paint = () => {
    const drag = active.current;
    if (!drag) return;
    drag.frame = 0;
    const dx = drag.x - drag.startX;
    drag.el.style.transform = `translateX(${dx}px)`;
    if (drag.line) {
      const at = landing(drag);
      const gap = at === 0 ? (drag.heads[0]?.left ?? drag.startCentre) : at >= drag.heads.length ? (drag.heads.at(-1)?.right ?? drag.startCentre) : (drag.heads[at - 1].right + drag.heads[at].left) / 2;
      drag.line.style.left = `${gap - 1}px`;
    }
  };

  const end = (drop: boolean) => {
    const drag = active.current;
    if (!drag) return;
    if (drag.frame) cancelFrame(drag.frame);
    active.current = null;
    window.removeEventListener("keydown", onKey, true);
    const index = drop && drag.dragging ? landing(drag) : null;
    drag.el.style.transform = "";
    drag.el.style.position = "";
    drag.el.style.zIndex = "";
    drag.line?.remove();
    if (drag.el.hasPointerCapture?.(drag.pointerId)) drag.el.releasePointerCapture(drag.pointerId);
    if (index !== null) onDrop(drag.id, index);
  };

  function onKey(event: KeyboardEvent) {
    if (event.key !== "Escape" || !active.current) return;
    event.preventDefault();
    event.stopPropagation();
    swallowClick.current = active.current.dragging;
    end(false);
  }

  return (id) => ({
    onPointerDown: (event) => {
      if ((event.pointerType === "mouse" && event.button !== 0) || !row.current) return;
      const el = event.currentTarget;
      /* All the reads, once. */
      const heads = Array.from(row.current.querySelectorAll<HTMLElement>("th[data-movable]"))
        .filter((head) => head !== el)
        .map((head) => {
          const box = head.getBoundingClientRect();
          return { id: head.dataset.column ?? "", centre: box.left + box.width / 2, left: box.left, right: box.right };
        });
      const own = el.getBoundingClientRect();
      const table = row.current.closest("table")?.getBoundingClientRect();
      swallowClick.current = false;
      active.current = { id, el, pointerId: event.pointerId, startX: event.clientX, x: event.clientX, dragging: false, heads, top: own.top, height: table ? table.bottom - own.top : own.height, line: null, frame: 0, startCentre: own.left + own.width / 2 };
    },
    onPointerMove: (event) => {
      const drag = active.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      drag.x = event.clientX;
      if (!drag.dragging) {
        if (Math.abs(drag.x - drag.startX) <= DRAG_SLOP) return;
        drag.dragging = true;
        drag.el.setPointerCapture?.(drag.pointerId);
        drag.el.style.position = "relative";
        drag.el.style.zIndex = "2";
        /* The drop line: 2px of --text the height of the table, at the gap the head would land in. */
        const line = document.createElement("div");
        line.setAttribute("aria-hidden", "true");
        line.dataset.testid = "column-drop-line";
        Object.assign(line.style, { position: "fixed", top: `${drag.top}px`, height: `${drag.height}px`, width: "2px", background: t.text, pointerEvents: "none", zIndex: "3" });
        document.body.appendChild(line);
        drag.line = line;
        window.addEventListener("keydown", onKey, true);
      }
      if (!drag.frame) drag.frame = frameOf(paint);
    },
    onPointerUp: () => {
      const drag = active.current;
      if (!drag) return;
      swallowClick.current = drag.dragging;
      end(true);
    },
    onPointerCancel: () => end(false),
    /* The click that ends a drag would sort: it is swallowed. */
    onClickCapture: (event) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  });
}
