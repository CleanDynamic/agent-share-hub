// G20: what a sortable list (dnd-kit) says while a row is dragged from the keyboard or the pointer, in the editor's words:
// "Picked up Hero. 1 of 3." on pick-up, "Over 2 of 3." at each place, "Moved Hero to 2 of 3." on the drop, "Put Hero back,
// 1 of 3." on a cancel. dnd-kit's own words name raw ids; these name the row and its place. Heard through dnd-kit's polite
// line, never drawn.

import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from "@dnd-kit/core";

export function dragWords(
  thing: string,
  order: readonly UniqueIdentifier[],
  nameOf: (id: UniqueIdentifier) => string,
): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } {
  const count = order.length;
  const place = (id: UniqueIdentifier) => `${order.indexOf(id) + 1} of ${count}`;
  const back = (id: UniqueIdentifier) => `Put ${nameOf(id)} back, ${place(id)}.`;
  return {
    announcements: {
      onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}. ${place(active.id)}.`,
      // Over its own place (straight after the pick-up, which said where it is) nothing more is said.
      onDragOver: ({ active, over }) => (!over ? "Not over a place." : over.id === active.id ? undefined : `Over ${place(over.id)}.`),
      onDragEnd: ({ active, over }) => (over && over.id !== active.id ? `Moved ${nameOf(active.id)} to ${place(over.id)}.` : back(active.id)),
      onDragCancel: ({ active }) => back(active.id),
    },
    screenReaderInstructions: { draggable: `Press Space to pick up the ${thing}, the arrow keys to move it, and Space again to drop it. Escape puts it back.` },
  };
}
