// CA-20 P6 - Recently removed: everything removed during this visit, each with Restore.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { agoLine } from "@/lib/build/removedLog";
import { sessionsMetaOf } from "@/lib/build/making";

import { draftRow, harnessAfter, harnessBefore, mountCa20, nodeRow, positions, sessionsOf } from "./ca20Harness";
import { IDS, KEY_A, KEY_B, KEY_C, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

describe("how long ago", () => {
  const now = 1_000_000_000;
  it("says it in the words the list uses", () => {
    expect(agoLine(now, now)).toBe("Just now");
    expect(agoLine(now - 30_000, now)).toBe("Just now");
    expect(agoLine(now - 4 * 60_000, now)).toBe("4 min ago");
    expect(agoLine(now - 2 * 3_600_000, now)).toBe("2 h ago");
    expect(agoLine(now - 3 * 86_400_000, now)).toBe("3 days ago");
  });
});

describe("Recently removed", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  const ids = () => positions().map((row) => row.id as string);
  const tileOrder = () => positions().filter((row) => row.parent_id === null && (row.payload as { session?: string }).session).map((row) => row.id);
  const sessionKeys = () =>
    sessionsOf()
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((row) => row.session_key);
  const removeTile = async (name: string | RegExp) => {
    fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove tile" }));
  };
  const openList = async () => {
    fireEvent.keyDown(screen.getByTestId("build-options"), { key: "Enter" });
    fireEvent.click(await screen.findByTestId("build-options-removed"));
    return screen.findByTestId("recently-removed-window");
  };
  const rows = () => screen.queryAllByTestId("removed-row");
  /* CA-22: a removed tile lifts out of the page for 200 ms before the rest closes up and renumbers; what comes next waits for that. */
  const lifted = (id: string) => waitFor(() => expect(document.querySelector(`[data-skel-id="${id}"]`)).toBeNull(), { timeout: 15_000 });

  it("shows how many are in the build's menu, and the empty window says nothing was removed", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByTestId("build-options"), { key: "Enter" });
    const item = await screen.findByTestId("build-options-removed");
    expect(item.textContent).toBe("Recently removed…");
    fireEvent.click(item);
    const window_ = await screen.findByTestId("recently-removed-window");
    expect(within(window_).getByText("Recently removed")).toBeTruthy();
    expect(within(window_).getByText("Kept until you leave this page")).toBeTruthy();
    expect(within(window_).getByTestId("removed-empty").textContent).toBe("Nothing removed during this visit.");
    expect(within(window_).getByText("After you leave this page, removed things are gone")).toBeTruthy();
    expect(within(window_).getByRole("button", { name: "Done" })).toBeTruthy();
  });

  it("lists each removal, newest first, with its badge, name, what it held, how long ago and Restore", async () => {
    await mountCa20(seedCa20);
    await removeTile("Prompt 2 options");
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    await lifted(IDS.p2);
    await removeTile(/^Team \d+ options/);
    await waitFor(() => expect(ids()).not.toContain(IDS.team), { timeout: 15_000 });
    fireEvent.keyDown(screen.getByTestId("build-options"), { key: "Enter" });
    const item = await screen.findByTestId("build-options-removed");
    expect(item.textContent).toBe("Recently removed…2");
    fireEvent.click(item);
    const window_ = await screen.findByTestId("recently-removed-window");
    const list = within(window_).getAllByTestId("removed-row");
    expect(list.map((row) => row.textContent)).toEqual(["2Team 2 · 3 agentsJust nowRestore", "2Prompt 2Just nowRestore"]);
  });

  it("Restore puts a tile back in its old place, with the same id, as a step of its own", async () => {
    await mountCa20(seedCa20);
    const before = JSON.stringify(nodeRow(IDS.p3));
    await removeTile("Prompt 4 options");
    await waitFor(() => expect(ids()).not.toContain(IDS.p3), { timeout: 15_000 });
    const window_ = await openList();
    fireEvent.click(within(window_).getByRole("button", { name: "Restore Prompt 4" }));
    await waitFor(() => expect(ids()).toContain(IDS.p3), { timeout: 15_000 });
    expect(tileOrder()).toEqual([IDS.p1, IDS.p2, IDS.team, IDS.p3, IDS.p4]);
    // The row comes back as it was. The seed leaves out contributor_id (SV-16), whose default is null, and updated_at
    // (SV-19) is the database's own stamp of the write, so it is not compared.
    const { updated_at: _stamp, ...restored } = nodeRow(IDS.p3) ?? {};
    expect(restored).toEqual({ contributor_id: null, ...JSON.parse(before) });
    // The file it makes comes back too, and into the tile that uses it.
    expect(nodeRow(IDS.file)?.payload).toMatchObject({ title: "orders.csv", made_by: IDS.p3 });
    expect(JSON.stringify(nodeRow(IDS.p4)?.payload)).toContain(IDS.file);
    // Gone from the list; a step, so Undo takes it away again.
    await waitFor(() => expect(rows()).toHaveLength(0));
    await waitFor(() => expect(screen.getByTestId("title-undo").getAttribute("title")?.replace(/ \([^)]*\)$/, "")).toBe("Undo: Restored Prompt 4"), { timeout: 15_000 });
    expect(await screen.findByText("Restored Prompt 4")).toBeTruthy();
  });

  it("Restore puts a tile at the end of its session when its old place has gone", async () => {
    await mountCa20(seedCa20);
    await removeTile("Prompt 4 options");
    await waitFor(() => expect(ids()).not.toContain(IDS.p3), { timeout: 15_000 });
    await lifted(IDS.p3);
    // Prompt 4 is now the last of Session 2: it goes to Session 1, so the old place is inside Session 1's tiles.
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 4 options" }), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Move to session…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Session 1/ }));
    await waitFor(() => expect((nodeRow(IDS.p4)?.payload as { session?: string }).session).toBe(KEY_A), { timeout: 15_000 });
    fireEvent.click(screen.getByTestId("build-options"), { key: "Enter" });
    const window_ = await openList();
    fireEvent.click(within(window_).getByRole("button", { name: "Restore Prompt 4" }));
    await waitFor(() => expect(ids()).toContain(IDS.p3), { timeout: 15_000 });
    // After the team, the last tile of Session 2.
    expect(tileOrder()).toEqual([IDS.p1, IDS.p2, IDS.p4, IDS.team, IDS.p3]);
    expect((nodeRow(IDS.p3)?.payload as { session?: string }).session).toBe(KEY_B);
  });

  it("Restore brings the session back with a tile whose session was removed since", async () => {
    await mountCa20(seedCa20);
    await removeTile("Prompt 4 options");
    await waitFor(() => expect(ids()).not.toContain(IDS.p3), { timeout: 15_000 });
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove session" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove all" }));
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_A, KEY_C]), { timeout: 15_000 });
    const window_ = await openList();
    expect(within(window_).getAllByTestId("removed-row").map((row) => row.textContent)).toEqual(["S2Session 2 · 2 tilesJust nowRestore", "4Prompt 4Just nowRestore"]);
    // Only the tile: its session comes with it, the session's other tiles stay removed.
    fireEvent.click(within(window_).getByRole("button", { name: "Restore Prompt 4" }));
    await waitFor(() => expect(ids()).toContain(IDS.p3), { timeout: 15_000 });
    expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]);
    expect(sessionsMetaOf(draftRow()?.making)[KEY_B]?.title).toBe("Support");
    expect(ids()).not.toContain(IDS.team);
    expect(tileOrder()).toEqual([IDS.p1, IDS.p2, IDS.p3]);
  });

  it("Clearing the build is one row, and Restore brings the whole build back", async () => {
    await mountCa20(seedCa20);
    const before = JSON.stringify(positions().map((row) => [row.id, row.parent_id, row.position, row.payload]).sort());
    fireEvent.keyDown(screen.getByTestId("build-options"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Clear the build…" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Clear the build" }));
    await waitFor(() => expect(ids()).toEqual([]), { timeout: 20_000 });
    const window_ = await openList();
    expect(within(window_).getAllByTestId("removed-row").map((row) => row.textContent)).toEqual(["The whole build · 3 sessions, 8 tiles, 1 fileJust nowRestore"]);
    fireEvent.click(within(window_).getByRole("button", { name: "Restore The whole build" }));
    await waitFor(() => expect(ids()).toHaveLength(9), { timeout: 20_000 });
    expect(JSON.stringify(positions().map((row) => [row.id, row.parent_id, row.position, row.payload]).sort())).toBe(before);
    expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]);
  });

  it("an entry is not listed while its removal is undone, and is again once it is redone", async () => {
    await mountCa20(seedCa20);
    await removeTile("Prompt 2 options");
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    fireEvent.click(await screen.findByTestId("notice-undo"));
    await waitFor(() => expect(ids()).toContain(IDS.p2), { timeout: 15_000 });
    const window_ = await openList();
    await waitFor(() => expect(within(window_).queryAllByTestId("removed-row")).toHaveLength(0));
    fireEvent.click(within(window_).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByTestId("recently-removed-window")).toBeNull());
    fireEvent.click(screen.getByTestId("title-redo"));
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    const again = await openList();
    expect(within(again).getAllByTestId("removed-row")).toHaveLength(1);
  });

  it("is gone after a reload: the list is held for the visit and nothing is written for it", async () => {
    await mountCa20(seedCa20);
    await removeTile("Prompt 2 options");
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    cleanup();
    // The page again, as after a reload: the draft as it was saved, with nothing listed.
    const { mount } = await import("./ca20Harness");
    const { DRAFT } = await import("./ca20Harness");
    mount(`/compose/${DRAFT}`, { keep: true });
    await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 15_000 });
    const window_ = await openList();
    expect(within(window_).getByTestId("removed-empty")).toBeTruthy();
  });
});
