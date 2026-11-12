/* BF-13 (C6): dragging a column head to a new place. No library, the pattern of the filter drag SV-24 built (BF-07 removed it).

   THE POINTER LIVES IN A REF (`rerender-use-ref-transient-values`): a move writes the pointer's place into the ref and asks for
   one animation frame, and the frame writes two styles, the dragged head's `transform` and the drop line's `left`. Every head's
   place is read once, when the drag begins (`js-batch-dom-css`), so a frame reads nothing. React renders nothing while the
   pointer moves; the order changes once, on drop, through `onDrop`.

   A press is a drag only past DRAG_SLOP: under it the press is a click and the head sorts. The pointer is captured only once the
   drag begins, so a plain press keeps its click on the head's button; after a drag the click that follows is swallowed, so the
   head does not sort. Pointer cancel and Escape put everything back and change nothing. Under reduced motion nothing here
   animates anyway: the head follows the pointer and is put back at once on drop. */

import { useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";

import { t } from "@/lib/theme/tokens";

/** Further than this and a press is a drag. */
export const DRAG_SLOP = 4;

export interface HeadDrag {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

interface Head {
  id: string;
  left: number;
  right: number;
  centre: number;
}

interface Active {
  id: string;
  el: HTMLElement;
  pointerId: number;
  startX: number;
  x: number;
  dragging: boolean;
  /** The other heads, left to right, measured once. */
  others: Head[];
  own: Head;
  line: HTMLElement | null;
  frame: number;
}

const frameOf = (callback: () => void): number => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(callback) : (setTimeout(callback, 16) as unknown as number));
const cancelFrame = (frame: number) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(frame) : clearTimeout(frame));

/** A press that may start a drag: the primary button of a mouse, or any touch or pen contact. */
const isPrimary = (event: PointerEvent<HTMLElement>) => event.pointerType !== "mouse" || event.button === 0;

/** Where among the other heads a head whose centre is at `x` lands: how many of them it is past. */
export function dropIndexAt(others: readonly { centre: number }[], x: number): number {
  return others.filter((head) => head.centre < x).length;
}

/**
 * Drag handlers for the heads in `row`, each a `th` with `data-column="<id>"`. `onDrop` gets the dragged head's id and its new
 * index among the drawn heads.
 */
export function useColumnDrag(row: RefObject<HTMLTableRowElement | null>, onDrop?: (id: string, index: number) => void): ((id: string) => HeadDrag) | undefined {
  const active = useRef<Active | null>(null);
  /** Set when a drag ends, so the click the browser sends after it does not sort. */
  const swallow = useRef(false);
  if (!onDrop) return undefined;

  const gapX = (drag: Active, index: number) => (index === 0 ? drag.others[0]?.left ?? drag.own.left : drag.others[index - 1].right);

  const paint = () => {
    const drag = active.current;
    if (!drag) return;
    drag.frame = 0;
    const dx = drag.x - drag.startX;
    drag.el.style.transform = `translateX(${dx}px)`;
    if (drag.line) {
      const box = drag.line.offsetParent?.getBoundingClientRect();
      const scroll = (drag.line.offsetParent as HTMLElement | null)?.scrollLeft ?? 0;
      drag.line.style.left = `${gapX(drag, dropIndexAt(drag.others, drag.own.centre + dx)) - (box?.left ?? 0) + scroll - 1}px`;
    }
  };

  const clear = () => {
    const drag = active.current;
    active.current = null;
    window.removeEventListener("keydown", onEscape);
    if (!drag) return null;
    if (drag.frame) cancelFrame(drag.frame);
    drag.el.style.transform = "";
    drag.el.style.position = "";
    drag.el.style.zIndex = "";
    drag.line?.remove();
    if (drag.dragging) drag.el.releasePointerCapture?.(drag.pointerId);
    return drag;
  };

  function onEscape(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    const drag = clear();
    if (drag?.dragging) swallow.current = true;
  }

  const begin = (drag: Active) => {
    drag.dragging = true;
    drag.el.setPointerCapture?.(drag.pointerId);
    drag.el.style.position = "relative";
    drag.el.style.zIndex = "2";
    /* The line sits in the table's scroll region, as tall as the head row. */
    const region = row.current?.closest<HTMLElement>('[role="region"]');
    if (region && row.current) {
      const line = document.createElement("span");
      line.setAttribute("aria-hidden", "true");
      Object.assign(line.style, { position: "absolute", top: "0", width: "2px", height: `${row.current.getBoundingClientRect().height}px`, background: t.text, pointerEvents: "none", zIndex: "3" });
      region.appendChild(line);
      drag.line = line;
    }
    window.addEventListener("keydown", onEscape);
  };

  return (id) => ({
    onPointerDown: (event) => {
      swallow.current = false;
      if (!isPrimary(event) || !row.current) return;
      const heads = Array.from(row.current.querySelectorAll<HTMLElement>("th[data-column]"));
      const el = heads.find((head) => head.dataset.column === id);
      if (!el) return;
      /* All the reads, once. */
      const boxes: Head[] = heads.map((head) => {
        const box = head.getBoundingClientRect();
        return { id: head.dataset.column as string, left: box.left, right: box.right, centre: box.left + box.width / 2 };
      });
      const own = boxes.find((box) => box.id === id)!;
      active.current = { id, el, pointerId: event.pointerId, startX: event.clientX, x: event.clientX, dragging: false, others: boxes.filter((box) => box.id !== id), own, line: null, frame: 0 };
    },
    onPointerMove: (event) => {
      const drag = active.current;
      if (!drag) return;
      drag.x = event.clientX;
      if (!drag.dragging) {
        if (Math.abs(drag.x - drag.startX) <= DRAG_SLOP) return;
        begin(drag);
      }
      if (!drag.frame) drag.frame = frameOf(paint);
    },
    onPointerUp: () => {
      const drag = clear();
      if (!drag?.dragging) return;
      swallow.current = true;
      onDrop(drag.id, dropIndexAt(drag.others, drag.own.centre + drag.x - drag.startX));
    },
    onPointerCancel: () => {
      clear();
    },
    onClickCapture: (event) => {
      if (!swallow.current) return;
      swallow.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  });
}
