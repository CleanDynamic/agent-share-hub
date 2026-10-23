// CA-20 P4 — the title row: Undo, Redo and the build's menu, and Clear the build.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { CLEAR_COPY, clearList } from "@/lib/build/componentMenus";
import { referenceGroupsOf } from "@/lib/build/referenceGroups";

import { describedBy, draftRow, harnessAfter, harnessBefore, mount, mountCa20, nodeRow, positions, sessionsOf } from "./ca20Harness";
import { GROUP_ID, IDS, KEY_A, KEY_B, KEY_C, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });
beforeEach(harnessBefore);
afterEach(harnessAfter);

const ids = () => positions().map((row) => row.id as string);
const sessionKeys = () =>
  sessionsOf()
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => row.session_key);
const undoButton = () => screen.getByTestId("title-undo");
const redoButton = () => screen.getByTestId("title-redo");
const openOptions = async () => {
  fireEvent.keyDown(screen.getByRole("button", { name: "Build options" }), { key: "Enter" });
  await screen.findAllByRole("menuitem");
};

describe("the lists of counts", () => {
  it("leaves out what is zero", () => {
    expect(clearList({ parts: 2, sessions: 6, tiles: 18, files: 3 })).toBe("2 parts, 6 sessions, 18 tiles and 3 files");
    expect(clearList({ parts: 0, sessions: 1, tiles: 18, files: 0 })).toBe("1 session and 18 tiles");
    expect(clearList({ parts: 0, sessions: 0, tiles: 0, files: 1 })).toBe("1 file");
    expect(CLEAR_COPY.body({ parts: 0, sessions: 3, tiles: 8, files: 1 })).toBe("Removes 3 sessions, 8 tiles and 1 file, with their colours, groups and links. The title, the post's words and the Classification Card stay.");
  });
});

describe("Undo and Redo", () => {
  it("sit just left of Classification Card, with Build options, and are greyed with their reason while there is nothing to do", async () => {
    await mountCa20(seedCa20);
    const row = screen.getByTestId("sandbox-tabrow");
    const buttons = within(row).getAllByRole("button").map((button) => button.getAttribute("data-testid") || button.getAttribute("aria-label"));
    expect(buttons.slice(buttons.indexOf("title-undo"), buttons.indexOf("title-undo") + 4)).toEqual(["title-undo", "title-redo", "build-options", "Classification Card"]);
    expect((undoButton() as HTMLButtonElement).disabled).toBe(true);
    expect(undoButton().getAttribute("title")).toBe("Nothing to undo");
    expect(describedBy(undoButton())).toBe("Nothing to undo");
    expect((redoButton() as HTMLButtonElement).disabled).toBe(true);
    expect(redoButton().getAttribute("title")).toBe("Nothing to redo");
  });

  it("name the step in their tooltips, take it back and put it again", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove tile" }));
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
    await waitFor(() => expect((undoButton() as HTMLButtonElement).disabled).toBe(false));
    expect(undoButton().getAttribute("title")).toBe("Undo: Removed Prompt 2");
    expect(undoButton().getAttribute("aria-label")).toBe("Undo: Removed Prompt 2");
    fireEvent.click(undoButton());
    await waitFor(() => expect(ids()).toContain(IDS.p2), { timeout: 15_000 });
    await waitFor(() => expect(redoButton().getAttribute("title")).toBe("Redo: Removed Prompt 2"));
    expect((undoButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(redoButton());
    await waitFor(() => expect(ids()).not.toContain(IDS.p2), { timeout: 15_000 });
  });

  it("take back a move to a session, which has no notice, in the same way", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 1 options" }), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Move to session…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Session 3/ }));
    await waitFor(() => expect((nodeRow(IDS.p1)?.payload as { session?: string }).session).toBe(KEY_C), { timeout: 15_000 });
    expect(screen.queryByTestId("notice-undo")).toBeNull();
    await waitFor(() => expect(undoButton().getAttribute("title")).toBe("Undo: Moved tile 1 to Session 3"));
    fireEvent.click(undoButton());
    await waitFor(() => expect((nodeRow(IDS.p1)?.payload as { session?: string }).session).toBe(KEY_A), { timeout: 15_000 });
    expect(positions().filter((row) => row.parent_id === null)[0].id).toBe(IDS.p1);
  });
});

describe("Build options", () => {
  it("holds Clear the build… in the danger text colour, after a rule", async () => {
    await mountCa20(seedCa20);
    await openOptions();
    const items = screen.getAllByRole("menuitem");
    expect(items.at(-1)?.textContent).toBe("Clear the build…");
    expect(items.at(-1)?.getAttribute("data-tone")).toBe("danger");
    expect(document.querySelector('[role="separator"]')).toBeTruthy();
  });

  it("greys Clear the build… with its reason while the build is empty", async () => {
    mount("/compose/new");
    await screen.findByTestId("build-options");
    await openOptions();
    const item = screen.getByRole("menuitem", { name: "Clear the build…" });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(describedBy(item)).toBe("The build is empty");
  });
});

describe("Clear the build", () => {
  it("asks first, in a 420 window: Cancel leaves everything", async () => {
    await mountCa20(seedCa20);
    const before = ids();
    await openOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear the build…" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Clear the build?")).toBeTruthy();
    expect(within(dialog).getByText("Removes 3 sessions, 8 tiles and 1 file, with their colours, groups and links. The title, the post's words and the Classification Card stay.")).toBeTruthy();
    expect(within(dialog).getAllByRole("button").map((button) => button.textContent)).toEqual(["Cancel", "Clear the build"]);
    expect(within(dialog).getByRole("button", { name: "Clear the build" }).getAttribute("data-tone")).toBe("danger");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(ids()).toEqual(before);
  });

  it("is one step: everything goes, the title and the post's words stay, and one Undo brings back the ids, sessions, group and links", async () => {
    await mountCa20(seedCa20);
    const before = JSON.stringify(positions().map((row) => [row.id, row.parent_id, row.position, row.payload]).sort());
    const title = draftRow()?.title;
    await openOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear the build…" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Clear the build" }));
    await waitFor(() => expect(ids()).toEqual([]), { timeout: 20_000 });
    expect(sessionKeys()).toEqual([]);
    expect(referenceGroupsOf(draftRow()?.making)).toEqual([]);
    expect(draftRow()?.title).toBe(title);
    // The words stay; the links to what is gone are plain words.
    await waitFor(() => expect(JSON.stringify(draftRow()?.post_doc)).not.toContain("node:"), { timeout: 15_000 });
    expect(JSON.stringify(draftRow()?.post_doc)).toContain("the login");
    expect(await screen.findByText("Cleared the build")).toBeTruthy();
    fireEvent.click(await screen.findByTestId("notice-undo"));
    await waitFor(() => expect(ids()).toHaveLength(9), { timeout: 20_000 });
    expect(JSON.stringify(positions().map((row) => [row.id, row.parent_id, row.position, row.payload]).sort())).toBe(before);
    expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]);
    await waitFor(() => expect(referenceGroupsOf(draftRow()?.making).map((group) => group.id)).toEqual([GROUP_ID]), { timeout: 15_000 });
    await waitFor(() => expect(JSON.stringify(draftRow()?.post_doc)).toContain(`node:${IDS.team}`), { timeout: 15_000 });
    expect(JSON.stringify(draftRow()?.post_doc)).toContain(`node:${IDS.p1}`);
    // And it can be done again from the title row.
    await waitFor(() => expect((redoButton() as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(redoButton());
    await waitFor(() => expect(ids()).toEqual([]), { timeout: 20_000 });
  });
});
