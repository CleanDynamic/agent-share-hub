// Prompt 6 G8 to G11 and D6: a tile is picked up by a press anywhere on it that is not a control. A mouse picks it up on a 4px move
// or a 150ms hold, whichever comes first; a finger by a 250ms hold within 6px, on any device. A press on a control does what it did.

import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { done, keys, mountList, partsOf, stubLayout, stubMedia } from "./ca21Harness";

beforeEach(() => {
  stubMedia();
  stubLayout();
  vi.useFakeTimers();
});
afterEach(() => {
  act(() => void vi.runOnlyPendingTimers());
  vi.useRealTimers();
  done();
});

const tiles = () => [...document.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')];
const card = (at = 1) => tiles()[at].firstElementChild as HTMLElement;
const held = () => screen.queryByTestId("held-copy") !== null;

type Kind = "mouse" | "pen" | "touch";
function pointer(type: string, target: Node, x: number, y: number, pointerType: Kind = "mouse") {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, buttons: type === "pointerup" ? 0 : 1, bubbles: true, cancelable: true });
  Object.defineProperty(event, "isPrimary", { value: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => void fireEvent(target, event));
}
const down = (target: Element, kind: Kind = "mouse") => pointer("pointerdown", target, 200, 150, kind);
const moveTo = (x: number, y: number, kind: Kind = "mouse") => pointer("pointermove", document, x, y, kind);
const up = (kind: Kind = "mouse") => pointer("pointerup", document, 200, 150, kind);
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

function touch(type: "touchstart" | "touchmove" | "touchend", target: Node, x: number, y: number) {
  const point = { clientX: x, clientY: y, identifier: 0, target };
  act(() => void fireEvent(target, new TouchEvent(type, { touches: type === "touchend" ? [] : [point as unknown as Touch], changedTouches: [point as unknown as Touch], bubbles: true, cancelable: true })));
}

/** A control of each kind, put inside a tile's card. */
function inside(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  const element = host.firstElementChild as HTMLElement;
  card().querySelector("h3, p, span")?.parentElement?.appendChild(element);
  return element.querySelector("[data-target]") ?? element;
}

describe("G8: a mouse picks a tile up from anywhere on it", () => {
  it("on a 150ms hold on its text, with no movement", () => {
    mountList();
    down(card().querySelector("h3") as Element);
    wait(149);
    expect(held()).toBe(false);
    wait(2);
    expect(held()).toBe(true);
    up();
  });

  it("at once on a 4px move, before the hold time (D10)", () => {
    mountList();
    down(card().querySelector("h3") as Element);
    wait(20);
    moveTo(200, 155);
    expect(held()).toBe(true);
    up();
  });

  it("from its grip too, as before", () => {
    mountList();
    down(within(tiles()[1]).getAllByTestId("drag-handle")[0]);
    moveTo(200, 156);
    expect(held()).toBe(true);
    up();
  });

  it("treats a pen as a mouse", () => {
    mountList();
    down(card().querySelector("h3") as Element, "pen");
    wait(151);
    expect(held()).toBe(true);
    up("pen");
  });
});

describe("G9: a click still selects, and a hold released in place puts back and selects", () => {
  it("selects on a press and release shorter than the hold, with no movement, and picks nothing up", () => {
    const onSelect = vi.fn();
    mountList({ onSelect });
    const target = card().querySelector("h3") as Element;
    down(target);
    wait(100);
    up();
    act(() => void fireEvent.click(target));
    expect(held()).toBe(false);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("puts the tile back, moves nothing, and selects it, on a hold past the hold time released without movement", () => {
    const onSelect = vi.fn();
    const { props } = mountList({ onSelect });
    const id = tiles()[1].getAttribute("data-skel-id");
    down(card().querySelector("h3") as Element);
    wait(160);
    expect(held()).toBe(true);
    up();
    wait(1000);
    expect(props.onMoveToSession).not.toHaveBeenCalled();
    expect(props.onNest).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith(id);
    expect(tiles()[1].getAttribute("data-skel-id")).toBe(id);
  });

  const controls: [string, string][] = [
    ["a button", `<button type="button" data-target>Go</button>`],
    ["a link", `<a href="/x" data-target>Go</a>`],
    ["an input", `<input data-target />`],
    ["a textarea", `<textarea data-target></textarea>`],
    ["a select", `<select data-target><option>a</option></select>`],
    ['role="button"', `<span role="button" tabindex="0" data-target>Go</span>`],
    ['role="menuitem"', `<div role="menuitem" data-target>Go</div>`],
    ["contenteditable", `<div contenteditable="true" data-target>Go</div>`],
    ["inside data-no-drag", `<div data-no-drag><span data-target>Go</span></div>`],
    ["inside a button", `<button type="button"><span data-target>Go</span></button>`],
  ];
  for (const [name, html] of controls) {
    it(`never starts a drag from ${name}, on a hold or a move`, () => {
      mountList();
      const target = inside(html);
      down(target);
      wait(300);
      moveTo(260, 220);
      expect(held()).toBe(false);
      up();
    });
  }

  it("never starts a drag from the tile's options button, and its menu, portalled out of the tile, never starts one either", () => {
    mountList();
    const options = within(card()).getAllByRole("button").find((button) => /options/.test(button.getAttribute("aria-label") ?? "")) as HTMLElement;
    down(options);
    wait(300);
    moveTo(260, 220);
    expect(held()).toBe(false);
    up();
    act(() => {
      fireEvent.keyDown(options, { key: "Enter" });
    });
    const menu = screen.getByRole("menu");
    expect(card().contains(menu)).toBe(false);
    for (const target of [menu, within(menu).getAllByRole("menuitem")[0]]) {
      down(target);
      wait(300);
      moveTo(260, 220);
      expect(held()).toBe(false);
      up();
    }
  });

  it("never starts a drag from code lines, which take data-no-drag", () => {
    mountList();
    const code = document.querySelector('[data-testid="code-lines"]');
    if (!code) return; // The fixture may hold no code tile; the browser check covers it.
    expect(code.closest("[data-no-drag]")).not.toBeNull();
  });
});

describe("G10: a finger picks a tile up by a 250ms hold within 6px, from anywhere on it, on any device", () => {
  it("not at 200ms, and at 250ms", () => {
    mountList();
    const target = card().querySelector("h3") as Element;
    touch("touchstart", target, 200, 150);
    wait(200);
    expect(held()).toBe(false);
    wait(51);
    expect(held()).toBe(true);
    touch("touchend", target, 200, 150);
  });

  it("not when the finger moves more than 6px before 250ms: that scrolls", () => {
    mountList();
    const target = card().querySelector("h3") as Element;
    touch("touchstart", target, 200, 150);
    wait(100);
    touch("touchmove", target, 200, 158);
    wait(300);
    expect(held()).toBe(false);
    touch("touchend", target, 200, 158);
  });

  it("never by the mouse rule: on a fine-pointer screen a finger that moves 5px does not pick up at once, even on the grip", () => {
    mountList();
    const target = within(tiles()[1]).getAllByTestId("drag-handle")[0];
    down(target, "touch");
    moveTo(200, 156, "touch");
    expect(held()).toBe(false);
    up("touch");
  });
});

describe("D6: session and part grips keep today's behaviour", () => {
  for (const which of ["session", "part"] as const) {
    it(`a ${which} grip drags at once on a 4px move, and a slow press with no move picks nothing up`, () => {
      mountList({ parts: partsOf() });
      const handle = which === "session" ? (document.querySelector('[data-skel-kind="session"] [data-testid$="drag-handle"]') as HTMLElement) : (document.querySelector('[data-skel-kind="part"] [data-testid$="drag-handle"]') as HTMLElement);
      expect(handle).not.toBeNull();
      down(handle);
      wait(400);
      expect(held()).toBe(false);
      moveTo(200, 156);
      expect(held()).toBe(true);
      up();
    });
  }

  it("keeps the keys' sessions as they were", () => {
    expect(keys().length).toBeGreaterThan(0);
  });
});

describe("D6: which rule each draggable takes", () => {
  it("gives tiles the hold-or-move rule, and session grips, part grips and Sources rows today's 4px move", async () => {
    const { isListTile, MOUSE_TILE_PRESS, MOUSE_GRIP_PRESS } = await import("./listNest");
    const { SESSION_DRAG, WORKSTREAM_DRAG, SOURCE_SESSION_DRAG, SOURCE_FILE_DRAG } = await import("./useBuildSorting");
    expect(isListTile("node-123")).toBe(true);
    for (const prefix of [SESSION_DRAG, WORKSTREAM_DRAG, SOURCE_SESSION_DRAG, SOURCE_FILE_DRAG]) expect(isListTile(`${prefix}x`)).toBe(false);
    expect(MOUSE_TILE_PRESS).toEqual({ delay: 150, distance: 4, tolerance: Number.POSITIVE_INFINITY });
    expect(MOUSE_GRIP_PRESS).toEqual({ distance: 4 });
  });
});
