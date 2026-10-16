// PostOutline: the posts of the thread, down the left of the Post tab (PT-05).
//
// One row per post: its number and the first words of its first block. The post
// the caret is in is 500 in --text; the rest are 400 in --text2. A row takes the
// editor to its post. A row can be dragged to move that post, its whole run of
// blocks, to another place. Alt with the up or down arrow does the same from the
// keyboard (dnd-kit's own keyboard sensor starts on Enter and Space, which a row
// already uses to go to its post).

import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KeyboardEvent } from "react";

import { ring } from "@/lib/theme/controls";
import { prefersReducedMotion } from "@/lib/theme/motion";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

export interface OutlineEntry {
  index: number;
  /** The first words of the post, "" when it holds nothing yet. */
  lead: string;
}

export const OUTLINE_NOTE = "Post 1 shows in the Gallery. A post break starts the next post. Drag a post here to reorder.";

const idOf = (index: number) => `post-${index}`;

function Row({ entry, active, onGo, onMove, last }: { entry: OutlineEntry; active: boolean; onGo: (index: number) => void; onMove: (from: number, to: number) => void; last: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idOf(entry.index) });
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const to = entry.index + (event.key === "ArrowUp" ? -1 : 1);
    if (to >= 0 && to <= last) onMove(entry.index, to);
  };

  return (
    <li
      ref={setNodeRef}
      style={{
        listStyle: "none",
        transform: CSS.Transform.toString(transform),
        transition: prefersReducedMotion() ? undefined : transition,
        position: "relative",
        zIndex: isDragging ? 1 : undefined,
      }}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        {...handlers}
        aria-current={active ? "true" : undefined}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        onClick={() => onGo(entry.index)}
        onKeyDown={onKeyDown}
        style={{
          appearance: "none",
          boxSizing: "border-box",
          width: "100%",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          margin: 0,
          padding: "6px 0",
          border: 0,
          borderRadius: 6,
          background: isDragging ? t.well : "transparent",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: FIGTREE,
          fontSize: 13,
          lineHeight: 1.35,
          fontWeight: active ? 500 : 400,
          color: active ? t.text : state.hovered ? t.text : t.text2,
          touchAction: "manipulation",
          ...ring(state.focusVisible),
        }}
      >
        <span style={{ flexShrink: 0, minWidth: 16, fontVariantNumeric: "tabular-nums" }}>{entry.index + 1}</span>
        <span style={{ minWidth: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>
          {entry.lead || "Empty post"}
        </span>
      </button>
    </li>
  );
}

export function PostOutline({
  entries,
  active,
  onGo,
  onMove,
}: {
  entries: readonly OutlineEntry[];
  active: number;
  onGo: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return;
    const from = entries.findIndex((entry) => idOf(entry.index) === dragged.id);
    const to = entries.findIndex((entry) => idOf(entry.index) === over.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <nav aria-label="Posts" style={{ flex: "1 1 170px", maxWidth: 190, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13.5, fontWeight: 500, lineHeight: "normal", color: t.text }}>Posts</h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ screenReaderInstructions: { draggable: "Drag this post to move it. Alt with the up or down arrow moves it from the keyboard." } }}
      >
        <SortableContext items={entries.map((entry) => idOf(entry.index))} strategy={verticalListSortingStrategy}>
          <ol style={{ margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
            {entries.map((entry) => (
              <Row key={entry.index} entry={entry} active={entry.index === active} onGo={onGo} onMove={onMove} last={entries.length - 1} />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, lineHeight: "normal", color: t.text2 }}>{OUTLINE_NOTE}</p>
    </nav>
  );
}

export default PostOutline;
