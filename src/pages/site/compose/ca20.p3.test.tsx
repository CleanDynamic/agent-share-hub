// CA-20 P3 — selecting several tiles and sessions, and acting on them together (the CA-20 draft, mounted for real).

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { allTiles, barShown, extended, inOrder, kindsIn, orderOf, tilesOfSession, toggled, type Chosen, type Drawn } from "@/lib/build/buildSelection";

import { harnessAfter, harnessBefore, mountCa20, nodeRow, positions, sessionsOf, stubWidth } from "./ca20Harness";
import { IDS, KEY_A, KEY_B, KEY_C, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const drawn: Drawn = { sessions: [{ key: "a", tiles: ["1", "2"] }, { key: "b", tiles: ["3", "4"] }, { key: "c", tiles: [] }] };
const tile = (id: string): Chosen => ({ kind: "tile", id });
const session = (id: string): Chosen => ({ kind: "session", id });

describe("choosing, as plain rules", () => {
  const order = orderOf(drawn);
  it("orders a session's head before its tiles", () => {
    expect(order.map((entry) => `${entry.kind}:${entry.id}`)).toEqual(["session:a", "tile:1", "tile:2", "session:b", "tile:3", "tile:4", "session:c"]);
  });
  it("Cmd or Ctrl click adds one and takes it off again", () => {
    const one = toggled([], tile("1"));
    expect(one).toEqual([tile("1")]);
    expect(toggled(one, tile("3"))).toEqual([tile("1"), tile("3")]);
    expect(toggled(one, tile("1"))).toEqual([]);
  });
  it("Shift click adds the range from the one chosen last, in the order drawn", () => {
    expect(extended([tile("1")], order, tile("1"), tile("3")).map((entry) => entry.id)).toEqual(["1", "2", "b", "3"]);
    // Backwards works as forwards.
    expect(extended([tile("4")], order, tile("4"), tile("2")).map((entry) => entry.id).sort()).toEqual(["2", "3", "4", "b"].sort());
    // With nothing chosen before, it is the one clicked.
    expect(extended([], order, null, tile("2"))).toEqual([tile("2")]);
  });
  it("chooses every tile, or a session's tiles", () => {
    expect(allTiles(order).map((entry) => entry.id)).toEqual(["1", "2", "3", "4"]);
    expect(tilesOfSession(drawn, "b").map((entry) => entry.id)).toEqual(["3", "4"]);
    expect(tilesOfSession(drawn, "c")).toEqual([]);
  });
  it("puts the selection in drawn order and says what it holds", () => {
    const picked = inOrder([tile("4"), session("a"), tile("1")], order);
    expect(picked.map((entry) => entry.id)).toEqual(["a", "1", "4"]);
    expect(kindsIn(picked)).toEqual({ tiles: ["1", "4"], sessions: ["a"] });
  });
  it("opens the bar at two or more", () => {
    expect(barShown([tile("1")])).toBe(false);
    expect(barShown([tile("1"), tile("2")])).toBe(true);
  });
});

describe("on the page", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  const card = (n: number) => screen.getByRole("group", { name: new RegExp(`^Prompt ${n}:`) });
  const head = (n: number) => screen.getAllByTestId("session-head")[n - 1];
  const bar = () => screen.queryByTestId("selection-bar");
  const count = () => screen.getByTestId("selection-count").textContent;
  const ids = () => positions().map((row) => row.id as string);
  const keys = () =>
    sessionsOf()
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((row) => row.session_key);

  it("Cmd or Ctrl click adds a tile; a plain click still selects as it did and ends a selection", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(card(1), { metaKey: true });
    expect(bar()).toBeNull();
    fireEvent.click(card(2), { ctrlKey: true });
    expect(count()).toBe("2 selected");
    expect(card(1).getAttribute("data-selected")).toBe("true");
    expect(card(2).getAttribute("data-selected")).toBe("true");
    // Taking one off leaves one: no bar.
    fireEvent.click(card(2), { metaKey: true });
    expect(bar()).toBeNull();
    fireEvent.click(card(2), { metaKey: true });
    expect(bar()).not.toBeNull();
    fireEvent.click(card(4));
    expect(bar()).toBeNull();
    expect(card(1).getAttribute("data-selected")).toBeNull();
    expect(card(4).getAttribute("data-selected")).toBe("true");
  });

  it("Shift click chooses the range from the last one chosen, a session head included", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(card(1), { metaKey: true });
    fireEvent.click(card(4), { shiftKey: true });
    // Prompt 1, Prompt 2, Session 2's head, Team 3, Prompt 4.
    expect(count()).toBe("5 selected");
    expect(head(2).getAttribute("data-selected")).toBe("true");
  });

  it("Escape and Clear selection end it", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(card(1), { metaKey: true });
    fireEvent.click(card(2), { metaKey: true });
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(bar()).toBeNull();
    fireEvent.click(card(1), { metaKey: true });
    fireEvent.click(card(2), { metaKey: true });
    fireEvent.click(within(bar() as HTMLElement).getByRole("button", { name: "Clear selection" }));
    expect(bar()).toBeNull();
  });

  it("Cmd A chooses every tile, unless the keys belong to a field", async () => {
    await mountCa20(seedCa20);
    const typing = document.createElement("input");
    document.body.appendChild(typing);
    typing.focus();
    fireEvent.keyDown(typing, { key: "a", metaKey: true });
    expect(bar()).toBeNull();
    typing.remove();
    fireEvent.keyDown(document.body, { key: "a", metaKey: true });
    expect(count()).toBe("5 selected");
    // Ctrl A is the same key elsewhere.
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.keyDown(document.body, { key: "a", ctrlKey: true });
    expect(count()).toBe("5 selected");
  });

  it("Select all in this session, in the session's menu after Edit session…", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    const names = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
    expect(names.indexOf("Select all in this session")).toBeGreaterThan(names.indexOf("Edit session…"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Select all in this session" }));
    expect(count()).toBe("2 selected");
    expect(card(1).getAttribute("data-selected")).toBe("true");
    expect(card(2).getAttribute("data-selected")).toBe("true");
  });

  it("the bar holds Move to…, Remove and Clear selection for tiles, and no Group or Ungroup until Part 7 turns them on", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(card(1), { metaKey: true });
    fireEvent.click(card(2), { metaKey: true });
    const names = within(bar() as HTMLElement).getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label"));
    expect(names).toEqual(expect.arrayContaining(["Move to…", "Remove", "Clear selection"]));
    expect(within(bar() as HTMLElement).getByRole("button", { name: "Remove" }).getAttribute("data-testid")).toBe("selection-remove");
  });

  it("Move to… puts the chosen tiles at the end of the session picked, as one step", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(card(1), { metaKey: true });
    fireEvent.click(card(2), { metaKey: true });
    fireEvent.keyDown(within(bar() as HTMLElement).getByRole("button", { name: "Move to…" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Session 3/ }));
    await waitFor(() => expect((nodeRow(IDS.p1)?.payload as { session?: string }).session).toBe(KEY_C), { timeout: 15_000 });
    expect((nodeRow(IDS.p2)?.payload as { session?: string }).session).toBe(KEY_C);
  });

  it("removes several tiles as one step, with one notice and one Undo", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(card(1), { metaKey: true });
    fireEvent.click(card(2), { metaKey: true });
    fireEvent.click(within(bar() as HTMLElement).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(ids()).not.toContain(IDS.p1), { timeout: 15_000 });
    expect(ids()).not.toContain(IDS.p2);
    expect(await screen.findByText("Removed 2 tiles")).toBeTruthy();
    fireEvent.click(await screen.findByTestId("notice-undo"));
    await waitFor(() => expect(ids()).toEqual(expect.arrayContaining([IDS.p1, IDS.p2])), { timeout: 15_000 });
  });

  it("removing sessions asks once, worded for all of them, and is one step", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(head(1), { metaKey: true });
    fireEvent.click(head(3), { metaKey: true });
    expect(count()).toBe("2 selected");
    fireEvent.click(within(bar() as HTMLElement).getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove 2 sessions?")).toBeTruthy();
    expect(within(dialog).getByText("They have 2 tiles between them.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove all" }));
    await waitFor(() => expect(keys()).toEqual([KEY_B]), { timeout: 15_000 });
    expect(await screen.findByText("Removed 2 sessions and 2 tiles")).toBeTruthy();
    fireEvent.click(await screen.findByTestId("notice-undo"));
    await waitFor(() => expect(keys()).toEqual([KEY_A, KEY_B, KEY_C]), { timeout: 15_000 });
    expect(ids()).toEqual(expect.arrayContaining([IDS.p1, IDS.p2]));
  });

  it("a session and a tile outside it go together: Remove 1 session and 1 tile?", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(head(3), { metaKey: true });
    fireEvent.click(card(4), { metaKey: true });
    fireEvent.click(within(bar() as HTMLElement).getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove 1 session and 1 tile?")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove all" }));
    await waitFor(() => expect(keys()).toEqual([KEY_A, KEY_B]), { timeout: 15_000 });
    expect(ids()).not.toContain(IDS.p3);
    // Its made file went with it.
    expect(ids()).not.toContain(IDS.file);
  });

  it("on a phone a long press starts choosing, taps then add and take off, and the bar sits above the action bar", async () => {
    stubWidth(390);
    await mountCa20(seedCa20);
    const touch = (type: string, element: Element) => element.dispatchEvent(Object.assign(new Event(type, { bubbles: true, cancelable: true }), { pointerType: "touch", clientX: 5, clientY: 5 }));
    touch("pointerdown", card(1));
    await new Promise((resolve) => setTimeout(resolve, 650));
    touch("pointerup", card(1));
    // The click that ends the press is not a tap.
    fireEvent.click(card(1));
    expect(card(1).getAttribute("data-selected")).toBe("true");
    expect(bar()).toBeNull();
    // Now a tap adds.
    fireEvent.click(card(2));
    expect(count()).toBe("2 selected");
    expect((bar() as HTMLElement).getAttribute("data-phone")).toBe("true");
    // A press that moves is a scroll, not a press.
    fireEvent.click(within(bar() as HTMLElement).getByRole("button", { name: "Clear selection" }));
    touch("pointerdown", card(2));
    document.dispatchEvent(Object.assign(new Event("pointermove", { bubbles: true }), { pointerType: "touch", clientX: 80, clientY: 90 }));
    await new Promise((resolve) => setTimeout(resolve, 650));
    fireEvent.click(card(2));
    expect(card(2).getAttribute("data-selected")).toBe("true");
    expect(card(1).getAttribute("data-selected")).toBeNull();
  });
});
