import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxMapProps } from "@/dev/fixtures/sandbox";
import { layoutMap } from "@/lib/build/mapLayout";

import { boxName, BuildMap, columnDate, DIMMED, type BuildMapProps } from "./BuildMap";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function map(over: Partial<BuildMapProps> = {}) {
  const props: BuildMapProps = { ...sandboxMapProps("bakery"), selectedId: null, onSelect: vi.fn(), onClear: vi.fn(), onConnect: vi.fn(), onOpenPrompt: vi.fn(), ...over };
  render(<BuildMap {...props} />);
  return props;
}

const opacity = (id: string) => screen.getByTestId(`map-box-${id}`).style.opacity;

describe("the boxes", () => {
  it("are real buttons named 'Prompt n, title, k inputs', in lane then column order", () => {
    map();
    const boxes = screen.getAllByRole("button").filter((el) => el.getAttribute("data-testid")?.startsWith("map-box-"));
    expect(boxes.map((el) => el.getAttribute("data-testid"))[0]).toBe("map-box-p1");
    expect(screen.getByRole("button", { name: "Prompt 3, Fix the mobile layout, 2 inputs" })).toBeTruthy();
    expect(boxName({ kind: "step", stepKind: "prompt", number: "2", title: "Prompt 2", inputs: [] })).toBe("Prompt 2, Prompt 2, 0 inputs");
  });

  it("draws a dashed Files and tools lane, the result with the evidence border, and a suggested input", () => {
    map();
    expect(screen.getAllByTestId("map-lane").some((lane) => lane.getAttribute("data-dashed") === "true")).toBe(true);
    expect(screen.getByTestId("map-box-r1").getAttribute("data-evidence")).toBe("true");
    expect(screen.getByText("1 suggested")).toBeTruthy();
    expect(screen.getAllByTestId("map-wire").some((wire) => wire.getAttribute("data-suggested") === "true")).toBe(true);
  });

  it("names the columns by their dates", () => {
    expect(columnDate("2026-03-04")).toBe("4 MAR");
    map();
    expect(screen.getAllByTestId("map-column-date").map((el) => el.textContent)).toContain("3 MAR");
  });
});

describe("selecting", () => {
  it("selects on a click and opens the full prompt on a double-click and on Enter", () => {
    const props = map();
    const box = screen.getByTestId("map-box-p2");
    fireEvent.click(box);
    expect(props.onSelect).toHaveBeenCalledWith("p2");
    fireEvent.doubleClick(box);
    expect(props.onOpenPrompt).toHaveBeenLastCalledWith("p2");
    fireEvent.keyDown(box, { key: "Enter" });
    expect(props.onOpenPrompt).toHaveBeenCalledTimes(2);
  });

  it("leaves exactly the selected box and its joined boxes at full strength, and the rest at 0.42", () => {
    map({ selectedId: "p2" });
    const layout = layoutMap(sandboxMapProps("bakery").steps, sandboxMapProps("bakery").groups, [{ id: "f1", name: "menu.pdf" }], [{ id: "t1", name: "Gmail" }], []);
    const joined = new Set(layout.wires.filter((wire) => wire.from === "p2" || wire.to === "p2").flatMap((wire) => [wire.from, wire.to]));
    joined.add("p2");
    for (const id of ["p1", "p2", "p3", "p4", "a5", "r1", "f1", "t1"]) {
      expect(opacity(id)).toBe(joined.has(id) ? "1" : String(DIMMED));
    }
    expect(screen.getAllByTestId("map-wire").filter((wire) => wire.getAttribute("data-strong") === "true").length).toBeGreaterThan(0);
  });

  it("dims nothing with no selection, and Esc clears a selection", () => {
    const props = map({ selectedId: "p2" });
    fireEvent.keyDown(screen.getByTestId("map-box-p2"), { key: "Escape" });
    expect(props.onClear).toHaveBeenCalled();
    cleanup();
    map();
    expect(opacity("p1")).toBe("1");
  });
});

describe("connecting", () => {
  // jsdom has no PointerEvent: a MouseEvent of the pointer type carries the coordinates React reads.
  const pointer = (el: Element, type: string, x: number, y: number) => fireEvent(el, new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  const drag = (from: string, to: string, steps = sandboxMapProps("bakery")) => {
    const layout = layoutMap(steps.steps, steps.groups, steps.files, steps.tools, steps.results, steps.suggestions);
    const a = layout.boxes.find((box) => box.id === from)!;
    const b = layout.boxes.find((box) => box.id === to)!;
    const dot = screen.getByTestId(`map-dot-${from}`);
    pointer(dot, "pointerdown", a.x + a.w, a.y + 14);
    pointer(dot, "pointermove", b.x + 20, b.y + 20);
    const line = screen.queryByTestId("map-drag-line");
    pointer(dot, "pointerup", b.x + 20, b.y + 20);
    return line;
  };

  it("draws a line that follows the pointer, and a drop on a later step adds the input", () => {
    const props = map();
    const line = drag("p2", "p4");
    expect(line).toBeTruthy();
    expect(props.onConnect).toHaveBeenCalledWith("p4", { kind: "output", node_id: "p2" });
    expect(screen.queryByTestId("map-drag-line")).toBeNull();
  });

  it("snaps back on a drop the rules refuse, and says why", async () => {
    const props = map();
    drag("p4", "p2");
    expect(props.onConnect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByRole("status").some((el) => /repeats until a condition/.test(el.textContent ?? ""))).toBe(true));
  });

  it("refuses an input already listed", async () => {
    const props = map();
    drag("p1", "p2");
    expect(props.onConnect).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getAllByRole("status").some((el) => /already listed/.test(el.textContent ?? ""))).toBe(true));
  });

  it("does nothing when a box itself is dragged", () => {
    const props = map();
    const box = screen.getByTestId("map-box-p2");
    pointer(box, "pointerdown", 10, 10);
    pointer(box, "pointermove", 300, 300);
    pointer(box, "pointerup", 300, 300);
    expect(props.onConnect).not.toHaveBeenCalled();
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
