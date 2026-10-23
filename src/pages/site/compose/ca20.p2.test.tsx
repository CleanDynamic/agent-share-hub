// CA-20 P2 — one way to remove anything, on the CA-20 draft (ca20Fixture.ts) mounted for real.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { REMOVE_COPY, SESSION_WINDOW_COPY } from "@/lib/build/componentMenus";
import { sessionsMetaOf } from "@/lib/build/making";
import { referenceGroupsOf } from "@/lib/build/referenceGroups";

import { draftRow, harnessAfter, harnessBefore, mountCa20, nodeRow, positions, sessionsOf } from "./ca20Harness";
import { GROUP_ID, IDS, KEY_A, KEY_B, KEY_C, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });
beforeEach(harnessBefore);
afterEach(harnessAfter);

const ids = () => positions().map((row) => row.id as string);
const shape = () => positions().map((row) => [row.id, row.parent_id, row.position]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
const openMenu = async (name: string | RegExp) => {
  fireEvent.keyDown(await screen.findByRole("button", { name }), { key: "Enter" });
  await screen.findAllByRole("menuitem");
};
const choose = async (name: string | RegExp) => fireEvent.click(await screen.findByRole("menuitem", { name }));
const undo = async () => fireEvent.click(await screen.findByTestId("notice-undo"));
const sessionKeys = () =>
  sessionsOf()
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => row.session_key);
const said = (sentence: string) => screen.findByText(sentence, undefined, { timeout: 15_000 });

describe("the notice's sentences", () => {
  it("says what was removed in the words the prompt gives", () => {
    expect(REMOVE_COPY.tile("Prompt 3")).toBe("Removed Prompt 3");
    expect(REMOVE_COPY.tile("Team 11", { count: 3, what: "agents" })).toBe("Removed Team 11 and its 3 agents");
    expect(REMOVE_COPY.tile("Prompt 3", { count: 1, what: "tiles" })).toBe("Removed Prompt 3 and its 1 tile");
    expect(REMOVE_COPY.session(2, 3)).toBe("Removed Session 2 and its 3 tiles");
    expect(REMOVE_COPY.session(2, 0)).toBe("Removed Session 2");
    expect(REMOVE_COPY.sessionKept(2, 1)).toBe("Removed Session 2. Its tiles moved to Session 1");
    expect(REMOVE_COPY.part("Part B", "Part A")).toBe("Removed Part B. Its sessions joined Part A");
    expect(REMOVE_COPY.file("orders.csv")).toBe("Removed orders.csv");
    expect(REMOVE_COPY.several(2, 4)).toBe("Removed 2 sessions and 4 tiles");
    expect(SESSION_WINDOW_COPY.title(2)).toBe("Remove Session 2?");
    expect(SESSION_WINDOW_COPY.body(3)).toBe("It has 3 tiles.");
    expect(SESSION_WINDOW_COPY.titleMany(2, 1)).toBe("Remove 2 sessions and 1 tile?");
    expect(SESSION_WINDOW_COPY.bodyMany(5)).toBe("They have 5 tiles between them.");
  });
});

describe("a tile", () => {
  it("goes at once, with no window, and Undo brings it back with the same id, place and settings", async () => {
    await mountCa20(seedCa20);
    const before = shape();
    const row = { ...nodeRow(IDS.p2) };
    await openMenu("Prompt 2 options");
    const items = screen.getAllByRole("menuitem");
    expect(items.at(-1)?.textContent).toBe("Remove tile");
    expect(items.at(-1)?.getAttribute("data-tone")).toBe("danger");
    await choose("Remove tile");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    expect(await said("Removed Prompt 2")).toBeTruthy();
    await undo();
    await waitFor(() => expect(ids()).toContain(IDS.p2), { timeout: 15_000 });
    expect(shape()).toEqual(before);
    expect(nodeRow(IDS.p2)).toMatchObject({ id: row.id, parent_id: row.parent_id, position: row.position, payload: row.payload });
  });

  it("goes with what is nested in it, and a team comes back whole", async () => {
    await mountCa20(seedCa20);
    const before = shape();
    await openMenu(/^Team 3 options/);
    await choose("Remove tile");
    await waitFor(() => expect(ids()).not.toContain(IDS.team), { timeout: 15_000 });
    expect(ids()).not.toContain(IDS.g1);
    expect(ids()).not.toContain(IDS.g3);
    expect(await said("Removed Team 3 and its 3 agents")).toBeTruthy();
    await undo();
    await waitFor(() => expect(ids()).toContain(IDS.g3), { timeout: 15_000 });
    expect(shape()).toEqual(before);
    expect(nodeRow(IDS.g2)).toMatchObject({ parent_id: IDS.team, position: 1 });
  });

  it("takes the files its tiles make with it, out of the tiles that use them, and Undo puts them back into those tiles", async () => {
    await mountCa20(seedCa20);
    const before = shape();
    const used = JSON.stringify(nodeRow(IDS.p4)?.payload);
    // Prompt 4 makes orders.csv; Prompt 5 uses it.
    await openMenu("Prompt 4 options");
    await choose("Remove tile");
    await waitFor(() => expect(ids()).not.toContain(IDS.p3), { timeout: 15_000 });
    expect(ids()).not.toContain(IDS.file);
    expect(JSON.stringify(nodeRow(IDS.p4)?.payload)).not.toContain(IDS.file);
    await undo();
    await waitFor(() => expect(ids()).toContain(IDS.file), { timeout: 15_000 });
    expect(shape()).toEqual(before);
    expect(JSON.stringify(nodeRow(IDS.p4)?.payload)).toBe(used);
  });
});

describe("a file", () => {
  it("goes at once, out of the tiles that use it, and comes back into them", async () => {
    await mountCa20(seedCa20);
    const used = JSON.stringify(nodeRow(IDS.p4)?.payload);
    await openMenu("orders.csv options");
    expect(screen.getAllByRole("menuitem").at(-1)?.textContent).toBe("Remove file");
    await choose("Remove file");
    await waitFor(() => expect(ids()).not.toContain(IDS.file), { timeout: 15_000 });
    expect(JSON.stringify(nodeRow(IDS.p4)?.payload)).not.toContain(IDS.file);
    expect(await said("Removed orders.csv")).toBeTruthy();
    await undo();
    await waitFor(() => expect(ids()).toContain(IDS.file), { timeout: 15_000 });
    expect(JSON.stringify(nodeRow(IDS.p4)?.payload)).toBe(used);
    expect(nodeRow(IDS.file)?.payload).toMatchObject({ title: "orders.csv", made_by: IDS.p3 });
  });
});

describe("a session", () => {
  it("with no tiles goes at once, and comes back with its settings", async () => {
    await mountCa20(seedCa20);
    const meta = sessionsMetaOf(draftRow()?.making)[KEY_C];
    await openMenu("Session 3 options");
    expect(screen.getAllByRole("menuitem").at(-1)?.textContent).toBe("Remove session");
    await choose("Remove session");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_A, KEY_B]), { timeout: 15_000 });
    expect(await said("Removed Session 3")).toBeTruthy();
    await undo();
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[KEY_C]).toEqual(meta);
    expect((draftRow()?.making as { session_order: string[] }).session_order).toEqual([KEY_A, KEY_B, KEY_C]);
  });

  it("with tiles asks first; Cancel leaves everything as it was", async () => {
    await mountCa20(seedCa20);
    const before = shape();
    await openMenu("Session 2 options");
    await choose("Remove session");
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove Session 2?")).toBeTruthy();
    expect(within(dialog).getByText("It has 3 tiles.")).toBeTruthy();
    expect(within(dialog).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Keep the tiles", "Remove all"]);
    expect(within(dialog).getByRole("button", { name: "Remove all" }).getAttribute("data-tone")).toBe("danger");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(shape()).toEqual(before);
    expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]);
  });

  it("Remove all takes the session with its tiles and files; Undo brings back the same ids, order and settings", async () => {
    await mountCa20(seedCa20);
    const before = shape();
    const meta = sessionsMetaOf(draftRow()?.making)[KEY_B];
    await openMenu("Session 2 options");
    await choose("Remove session");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove all" }));
    await waitFor(() => expect(ids()).toEqual([IDS.p1, IDS.p2]), { timeout: 15_000 });
    expect(sessionKeys()).toEqual([KEY_A, KEY_C]);
    expect(await said("Removed Session 2 and its 3 tiles")).toBeTruthy();
    await undo();
    await waitFor(() => expect(ids()).toHaveLength(9), { timeout: 15_000 });
    expect(shape()).toEqual(before);
    expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]);
    expect(sessionsMetaOf(draftRow()?.making)[KEY_B]).toEqual(meta);
  });

  it("Keep the tiles moves them to the end of the session above, then removes it", async () => {
    await mountCa20(seedCa20);
    await openMenu("Session 2 options");
    await choose("Remove session");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep the tiles" }));
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_A, KEY_C]), { timeout: 15_000 });
    // Nothing was removed: every tile is in Session 1 now, after its own.
    expect(ids()).toHaveLength(9);
    const tiles = [IDS.p1, IDS.p2, IDS.team, IDS.p3, IDS.p4];
    expect(tiles.every((id) => (nodeRow(id)?.payload as { session?: string }).session === KEY_A)).toBe(true);
    expect(positions().filter((row) => row.parent_id === null).map((row) => row.id)).toEqual([IDS.p1, IDS.p2, IDS.team, IDS.p3, IDS.p4, IDS.file]);
    expect(await said("Removed Session 2. Its tiles moved to Session 1")).toBeTruthy();
    await undo();
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]), { timeout: 15_000 });
    expect((nodeRow(IDS.p3)?.payload as { session?: string }).session).toBe(KEY_B);
  });

  it("Keep the tiles on the first session moves them to the start of the one below", async () => {
    await mountCa20(seedCa20);
    await openMenu("Session 1 options");
    await choose("Remove session");
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep the tiles" }));
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_B, KEY_C]), { timeout: 15_000 });
    expect(ids()).toHaveLength(9);
    const top = positions().filter((row) => row.parent_id === null);
    expect(top.map((row) => row.id)).toEqual([IDS.p1, IDS.p2, IDS.team, IDS.p3, IDS.p4, IDS.file]);
    expect([IDS.p1, IDS.p2, IDS.team, IDS.p3, IDS.p4].every((id) => (nodeRow(id)?.payload as { session?: string }).session === KEY_B)).toBe(true);
    expect(await said("Removed Session 1. Its tiles moved to Session 1")).toBeTruthy();
  });
});

describe("groups and the post's links", () => {
  const linked = () => JSON.stringify(draftRow()?.post_doc);

  it("a removed tile leaves its group (a group left with one ends), its words become plain, and Undo brings both back", async () => {
    await mountCa20(seedCa20);
    expect(linked()).toContain(`node:${IDS.p1}`);
    await openMenu("Prompt 1 options");
    await choose("Remove tile");
    await waitFor(() => expect(ids()).not.toContain(IDS.p1), { timeout: 15_000 });
    // The size rule: the group of two is down to one, so it ends and the one left keeps its colour.
    await waitFor(() => expect(referenceGroupsOf(draftRow()?.making)).toEqual([]), { timeout: 15_000 });
    await waitFor(() => expect(linked()).not.toContain(`node:${IDS.p1}`), { timeout: 15_000 });
    expect(linked()).toContain(`node:${IDS.team}`);
    expect((nodeRow(IDS.p3)?.payload as { colour?: string }).colour).toBe("#7FA7D9");
    // One step: the one Undo puts the tile, the group and the link back.
    await undo();
    await waitFor(() => expect(ids()).toContain(IDS.p1), { timeout: 15_000 });
    await waitFor(() => expect(referenceGroupsOf(draftRow()?.making).map((group) => [group.id, group.members])).toEqual([[GROUP_ID, [`node:${IDS.p1}`, `node:${IDS.p3}`]]]), { timeout: 15_000 });
    await waitFor(() => expect(linked()).toContain(`node:${IDS.p1}`), { timeout: 15_000 });
  });
});
