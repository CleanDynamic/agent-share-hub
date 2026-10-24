// CA-20 P8: the keyboard shortcuts of the build page.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { SHORTCUTS, SHORTCUT_GROUPS, shortcutLabel, shortcutOf } from "@/lib/build/shortcuts";

import { harnessAfter, harnessBefore, mountCa20, nodeRow, positions } from "./ca20Harness";
import { IDS, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const press = (key: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(document.body, { key, ...extra });

describe("the list", () => {
  const k = (key: string, extra: Partial<Record<"metaKey" | "ctrlKey" | "shiftKey" | "altKey", boolean>> = {}) => ({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...extra });
  it("names every key once, in the words of this computer", () => {
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
    expect(SHORTCUTS.every((s) => SHORTCUT_GROUPS.includes(s.group))).toBe(true);
    expect(shortcutLabel("undo", true)).toBe("⌘Z");
    expect(shortcutLabel("undo", false)).toBe("Ctrl+Z");
  });
  it("reads a key press as a shortcut", () => {
    expect(shortcutOf(k("z", { metaKey: true }), true)).toBe("undo");
    expect(shortcutOf(k("z", { metaKey: true, shiftKey: true }), true)).toBe("redo");
    expect(shortcutOf(k("y", { ctrlKey: true }), false)).toBe("redo");
    expect(shortcutOf(k("Delete"), false)).toBe("remove");
    expect(shortcutOf(k("ArrowUp", { altKey: true }), false)).toBe("moveUp");
    expect(shortcutOf(k("r", { ctrlKey: true }), false)).toBeNull();
    expect(shortcutOf(k("?", { shiftKey: true }), false)).toBe("help");
  });
});

describe("on the build page", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);
  const ids = () => positions().map((row) => row.id as string);

  it("? opens the window of every key, and Escape closes it", async () => {
    await mountCa20(seedCa20);
    press("?");
    const window_ = await screen.findByTestId("shortcuts-window");
    expect(within(window_).getAllByTestId("shortcut-row")).toHaveLength(SHORTCUTS.length);
    fireEvent.keyDown(window_, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("shortcuts-window")).toBeNull());
  });

  it("Build options has Keyboard shortcuts with the key at the right", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByTestId("build-options"), { key: "Enter" });
    const item = await screen.findByTestId("build-options-shortcuts");
    expect(item.textContent).toBe("Keyboard shortcuts?");
  });

  it("the title row's tooltips carry the keys once there is a step", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove tile" }));
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    await waitFor(() => expect(screen.getByTestId("title-undo").getAttribute("title")).toMatch(/^Undo: Removed Prompt 2 \((⌘Z|Ctrl\+Z)\)$/));
  });

  it("Ctrl Z undoes the last step, and Ctrl Y does it again", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove tile" }));
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    press("z", { ctrlKey: true });
    await waitFor(() => expect(ids()).toContain(IDS.p2), { timeout: 15_000 });
    press("y", { ctrlKey: true });
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
  });

  it("Ctrl S says Saved, and Ctrl D duplicates the chosen tile", async () => {
    await mountCa20(seedCa20);
    press("s", { ctrlKey: true });
    expect(await screen.findByText("Saved")).toBeTruthy();
    fireEvent.click(screen.getByText("Add the order form"));
    const before = ids().length;
    press("d", { ctrlKey: true });
    await waitFor(() => expect(ids().length).toBe(before + 1), { timeout: 15_000 });
  });

  it("Delete removes the chosen tile and leaves a field's keys alone", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(screen.getByText("Add the order form"));
    const field = document.createElement("input");
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: "Delete" });
    expect(nodeRow(IDS.p2)).toBeTruthy();
    field.remove();
    press("Delete");
    await waitFor(() => expect(nodeRow(IDS.p2)).toBeUndefined(), { timeout: 15_000 });
  });
});
