// CA-19 P4 — the colour picker (board "References: the colour picker"): the colour code field, Saved with its circle and
// menu, Recent, Suggested, "Also used by", linked text (with and without, Find words, Select words), the group state,
// No colour and Escape.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FAVOURITES_MAX, RECENT_MAX, withRecent } from "@/lib/theme/colourWheel";

import { COLOUR_PICKER_COPY, ColourPicker, recentAfterDone, withSaved, type ColourPickerProps, type PickerReferences } from "./ColourPicker";
import { configureSwatchSaving } from "./useColourSwatches";

vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));

// jsdom has no DOMRect, which Radix's context menu asks for when it places itself at the pointer.
if (typeof globalThis.DOMRect === "undefined") {
  class Rect {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    get top() { return this.y; }
    get left() { return this.x; }
    get right() { return this.x + this.width; }
    get bottom() { return this.y + this.height; }
    toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    static fromRect(rect: { x?: number; y?: number; width?: number; height?: number } = {}) { return new Rect(rect.x, rect.y, rect.width, rect.height); }
  }
  vi.stubGlobal("DOMRect", Rect);
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined })) as never;
  configureSwatchSaving(null);
});
afterEach(cleanup);

function refs(over: Partial<PickerReferences> = {}): PickerReferences {
  return {
    alsoUsedBy: () => [],
    onGroupWith: vi.fn(),
    linked: null,
    findWords: () => [],
    onLinkFound: vi.fn(),
    onSelectWords: vi.fn(),
    onRemoveLink: vi.fn(),
    groups: [{ id: "rg-login", name: "Login flow", colour: "#7FB88A", count: 3 }],
    onMakeGroup: vi.fn(),
    onAddToGroup: vi.fn(),
    onOpenGroup: vi.fn(),
    onRemoveFromGroup: vi.fn(),
    ...over,
  };
}

function picker(over: Partial<ColourPickerProps> = {}) {
  const props: ColourPickerProps = {
    open: true,
    anchor: document.body,
    what: "Result 2 · Data model",
    initial: "#7FA7D9",
    swatches: { recent: [], favourites: [] },
    onSwatches: vi.fn(),
    onPreview: vi.fn(),
    onDone: vi.fn(),
    onCancel: vi.fn(),
    phone: false,
    history: { canUndo: true, canRedo: false, onUndo: vi.fn(), onRedo: vi.fn() },
    ...over,
  };
  render(<ColourPicker {...props} />);
  return props;
}

const field = () => screen.getByRole("textbox", { name: COLOUR_PICKER_COPY.hex }) as HTMLInputElement;

describe("the window", () => {
  it("heads itself Colour and the component, with the close square, and ends with Undo, Redo, No colour and Done", () => {
    picker({ references: refs() });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Colour")).toBeTruthy();
    expect(within(dialog).getByText("Result 2 · Data model")).toBeTruthy();
    const footer = screen.getByTestId("colour-picker-footer");
    expect(within(footer).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Undo", "Redo", "No colour", "Done"]);
    expect(within(footer).getByRole("button", { name: "Redo" })).toBeDisabled();
  });
});

describe("the colour code field", () => {
  it.each([
    ["7fa", "#77FFAA"],
    ["#7FA", "#77FFAA"],
    ["7fa7d9", "#7FA7D9"],
    ["#7fA7D9", "#7FA7D9"],
    ["  c9a86b ", "#C9A86B"],
  ])("takes %s and shows %s once applied on Enter", (typed, shown) => {
    const props = picker({ initial: null });
    fireEvent.change(field(), { target: { value: typed } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(field().value).toBe(shown);
    expect(props.onPreview).toHaveBeenLastCalledWith(shown, false);
  });

  it("applies when the field is left", () => {
    const props = picker({ initial: null });
    fireEvent.change(field(), { target: { value: "B79AD6" } });
    fireEvent.blur(field());
    expect(props.onPreview).toHaveBeenLastCalledWith("#B79AD6", false);
  });

  it("changes nothing for a wrong code, and says how to write one", () => {
    const props = picker();
    fireEvent.change(field(), { target: { value: "#12345" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(screen.getByRole("alert").textContent).toBe("Use a code like #7FA7D9");
    expect(props.onPreview).not.toHaveBeenCalled();
    expect(field()).toHaveAttribute("aria-invalid", "true");
  });
});

describe("the swatch rows", () => {
  it("labels three rows Saved, Recent and Suggested", () => {
    picker({ swatches: { recent: ["#D98C8C"], favourites: ["#C9A86B"] } });
    expect(screen.getAllByRole("group").map((group) => group.getAttribute("aria-label"))).toEqual(["Saved", "Recent", "Suggested", "History"]);
  });

  it("saves the colour shown, at most 24, and removes a saved one from its menu", async () => {
    const onSwatches = vi.fn();
    picker({ onSwatches, swatches: { recent: [], favourites: ["#C9A86B"] } });
    fireEvent.click(screen.getByRole("button", { name: COLOUR_PICKER_COPY.saveThis }));
    expect(onSwatches).toHaveBeenLastCalledWith({ recent: [], favourites: ["#C9A86B", "#7FA7D9"] });
    const full = Array.from({ length: FAVOURITES_MAX }, (_, i) => `#0000${String(i).padStart(2, "0")}`);
    expect(withSaved(full, "#ABCDEF")).toEqual(full);
    expect(withSaved(["#7FA7D9"], "#7fa7d9")).toEqual(["#7FA7D9"]);
    fireEvent.contextMenu(document.querySelector('[data-saved-swatch="#C9A86B"]') as HTMLElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: COLOUR_PICKER_COPY.removeSaved }));
    expect(onSwatches).toHaveBeenLastCalledWith({ recent: [], favourites: [] });
  });

  it("uses a saved colour from its menu", async () => {
    const props = picker({ swatches: { recent: [], favourites: ["#C9A86B"] } });
    fireEvent.contextMenu(document.querySelector('[data-saved-swatch="#C9A86B"]') as HTMLElement);
    fireEvent.click(await screen.findByRole("menuitem", { name: COLOUR_PICKER_COPY.useThis }));
    expect(props.onPreview).toHaveBeenLastCalledWith("#C9A86B", false);
  });

  it("keeps Recent newest first, with no repeats, at most 8, joining on Done", () => {
    expect(withRecent(["#111111", "#222222"], "#222222")).toEqual(["#222222", "#111111"]);
    const many = Array.from({ length: RECENT_MAX }, (_, i) => `#00000${i}`);
    expect(withRecent(many, "#ABCDEF")).toHaveLength(8);
    expect(recentAfterDone({ recent: ["#111111"], favourites: [] }, "#7fa7d9")).toEqual({ recent: ["#7FA7D9", "#111111"], favourites: [] });
    expect(recentAfterDone({ recent: ["#111111"], favourites: [] }, null)).toEqual({ recent: ["#111111"], favourites: [] });
  });

  it("suggests the six presets, the colour shown ringed", () => {
    picker();
    const row = screen.getByRole("group", { name: "Suggested" });
    expect(within(row).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(["#C9A86B", "#7FB88A", "#7FA7D9", "#B79AD6", "#D98C8C", "#8FBFB8"]);
    expect(within(row).getByRole("button", { name: "#7FA7D9" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says who else uses the colour, and makes a group of the two", () => {
    const onGroupWith = vi.fn();
    picker({ references: refs({ alsoUsedBy: (hex) => (hex === "#7FA7D9" ? [{ to: "node:lp", name: "Landing page" }] : []), onGroupWith }) });
    expect(screen.getByTestId("also-used-by").textContent).toContain("Also used by Landing page");
    fireEvent.click(within(screen.getByTestId("also-used-by")).getByRole("button", { name: "Make a group" }));
    expect(onGroupWith).toHaveBeenCalledWith("node:lp", "#7FA7D9");
    fireEvent.click(screen.getByRole("button", { name: "#D98C8C" }));
    expect(screen.queryByTestId("also-used-by")).toBeNull();
  });
});

describe("linked text and the group", () => {
  it("shows the component's linked text, 1 of 1, with a remove ×", () => {
    const onRemoveLink = vi.fn();
    picker({ references: refs({ linked: { words: "the data model", post: 1, colour: "#7FA7D9", number: "2" }, onRemoveLink }) });
    const panel = screen.getByTestId("picker-linked");
    expect(panel.textContent).toContain("Linked text · 1 of 1");
    expect(within(panel).getByTestId("picker-linked-words").textContent).toBe("the data model");
    expect(panel.textContent).toContain("Post 1");
    fireEvent.click(within(panel).getByRole("button", { name: "Remove the link" }));
    expect(onRemoveLink).toHaveBeenCalled();
  });

  it("finds words in the post without one, and links the exact stretch chosen", () => {
    const hit = { from: 9, to: 23, post: 1, before: "We drew ", match: "the data model", after: " first" };
    const onLinkFound = vi.fn();
    const onSelectWords = vi.fn();
    picker({ references: refs({ findWords: (query) => (query === "data" ? [hit] : []), onLinkFound, onSelectWords }) });
    const panel = screen.getByTestId("picker-linked");
    expect(panel.textContent).toContain("Linked text · 0 of 1");
    fireEvent.change(within(panel).getByRole("textbox", { name: COLOUR_PICKER_COPY.findWords }), { target: { value: "data" } });
    const row = within(panel).getByRole("button", { name: /the data model/ });
    expect(row.textContent).toContain("Post 1");
    expect(within(row).getByText("the data model").style.fontWeight).toBe("600");
    fireEvent.click(row);
    expect(onLinkFound).toHaveBeenCalledWith(hit);
    fireEvent.click(within(panel).getByRole("button", { name: COLOUR_PICKER_COPY.selectWords }));
    expect(onSelectWords).toHaveBeenCalled();
  });

  it("says a component is in no group, and makes one or adds to one", () => {
    const onMakeGroup = vi.fn();
    const onAddToGroup = vi.fn();
    picker({ references: refs({ onMakeGroup, onAddToGroup }) });
    const panel = screen.getByTestId("picker-group");
    expect(panel.textContent).toContain("Reference group · not in one");
    fireEvent.click(within(panel).getByRole("button", { name: "Make a group" }));
    expect(onMakeGroup).toHaveBeenCalledWith("#7FA7D9");
    fireEvent.click(within(panel).getByRole("button", { name: "Add to a group" }));
    fireEvent.click(within(panel).getByRole("button", { name: /Login flow/ }));
    expect(onAddToGroup).toHaveBeenCalledWith("rg-login");
  });

  it("opens a member in its group state", () => {
    const onOpenGroup = vi.fn();
    const onRemoveFromGroup = vi.fn();
    picker({ what: "Code 4 · Send the link", references: refs({ group: { id: "rg-login", name: "Login flow", colour: "#7FB88A", count: 3 }, onOpenGroup, onRemoveFromGroup }) });
    expect(screen.getByTestId("colour-picker").getAttribute("data-state")).toBe("group");
    expect(screen.queryByRole("slider", { name: COLOUR_PICKER_COPY.wheel })).toBeNull();
    const panel = screen.getByTestId("picker-in-group");
    expect(panel.textContent).toBe("Login flow · 3 components");
    expect(panel.querySelector("[data-group-bar]")).toBeTruthy();
    expect(screen.getByText("Its colour and its linked text belong to the group.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open group" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from group" }));
    expect(onOpenGroup).toHaveBeenCalledWith("rg-login");
    expect(onRemoveFromGroup).toHaveBeenCalled();
    expect(within(screen.getByTestId("colour-picker-footer")).getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual(["Undo", "Redo", "Done"]);
  });
});

describe("No colour and Escape", () => {
  it("takes the colour off with No colour, kept on Done", () => {
    const props = picker();
    fireEvent.click(screen.getByRole("button", { name: "No colour" }));
    expect(props.onPreview).toHaveBeenLastCalledWith(null, false);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onDone).toHaveBeenCalledWith(null, false);
  });

  it("puts back the colour it opened with on Escape", () => {
    const props = picker();
    fireEvent.click(screen.getByRole("button", { name: "#D98C8C" }));
    act(() => void fireEvent.keyDown(screen.getByRole("slider", { name: COLOUR_PICKER_COPY.wheel }), { key: "Escape" }));
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it("keeps a session's Also colour its tiles box under the rows", () => {
    picker({ session: true, references: refs() });
    expect(screen.getByRole("checkbox", { name: COLOUR_PICKER_COPY.alsoTiles })).toBeTruthy();
  });
});
