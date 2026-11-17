// G20: what a sortable list says while a row is dragged, in the editor's words: names and places, never ids.

import { describe, expect, it } from "vitest";

import { dragWords } from "./dragWords";

const items = [
  { id: "k1", name: "Hero" },
  { id: "k2", name: "Pricing" },
  { id: "k3", name: "Footer" },
];
const words = dragWords("component", items.map((item) => item.id), (id) => items.find((item) => item.id === id)?.name ?? "");
const at = (id: string) => ({ id }) as never;

describe("dragWords", () => {
  it("says the pick-up, each place, the drop and the cancel", () => {
    expect(words.announcements.onDragStart({ active: at("k1") } as never)).toBe("Picked up Hero. 1 of 3.");
    expect(words.announcements.onDragOver({ active: at("k1"), over: at("k3") } as never)).toBe("Over 3 of 3.");
    expect(words.announcements.onDragOver({ active: at("k1"), over: at("k1") } as never)).toBeUndefined();
    expect(words.announcements.onDragEnd({ active: at("k1"), over: at("k2") } as never)).toBe("Moved Hero to 2 of 3.");
    expect(words.announcements.onDragEnd({ active: at("k1"), over: at("k1") } as never)).toBe("Put Hero back, 1 of 3.");
    expect(words.announcements.onDragCancel({ active: at("k1"), over: null } as never)).toBe("Put Hero back, 1 of 3.");
    expect(words.screenReaderInstructions.draggable).toBe("Press Space to pick up the component, the arrow keys to move it, and Space again to drop it. Escape puts it back.");
  });
});
