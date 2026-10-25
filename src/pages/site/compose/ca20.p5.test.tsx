// CA-20 P5 - one undo for the whole build: the history as plain rules, and every kind of step on the CA-20 draft.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { Toaster } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { PG } from "@/lib/build/__audit__/fakeSupabase";
import {
  EMPTY_BUILD_HISTORY,
  HISTORY_LIMIT,
  afterRedone,
  afterUndone,
  canRedoStep,
  canUndoStep,
  groupSteps,
  nextRedo,
  nextUndo,
  recordStep,
  type BuildHistory,
  type BuildStep,
} from "@/lib/build/buildHistory";
import { sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";
import { handlerSentence } from "@/lib/build/stepSentences";

import { draftRow, harnessAfter, harnessBefore, mountCa20, nodeRow, positions, sessionsOf } from "./ca20Harness";
import { IDS, KEY_A, KEY_B, KEY_C, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const step = (sentence: string, log: string[] = []): BuildStep => ({ sentence, undo: () => void log.push(`undo ${sentence}`), redo: () => void log.push(`redo ${sentence}`) });

describe("the history, as plain rules", () => {
  it("is empty to begin with", () => {
    expect(canUndoStep(EMPTY_BUILD_HISTORY)).toBe(false);
    expect(canRedoStep(EMPTY_BUILD_HISTORY)).toBe(false);
    expect(nextUndo(EMPTY_BUILD_HISTORY)).toBeNull();
  });

  it("takes the newest step first, and a new step clears what was waiting to be redone", () => {
    let history: BuildHistory = recordStep(recordStep(EMPTY_BUILD_HISTORY, step("one")), step("two"));
    expect(nextUndo(history)).toBe("two");
    history = afterUndone(history);
    expect(nextUndo(history)).toBe("one");
    expect(nextRedo(history)).toBe("two");
    history = afterRedone(history);
    expect(nextRedo(history)).toBeNull();
    history = recordStep(afterUndone(history), step("three"));
    expect(canRedoStep(history)).toBe(false);
    expect(history.done.map((entry) => entry.sentence)).toEqual(["one", "three"]);
  });

  it("keeps up to 50 steps, dropping the oldest", () => {
    let history: BuildHistory = EMPTY_BUILD_HISTORY;
    for (let n = 1; n <= HISTORY_LIMIT + 5; n += 1) history = recordStep(history, step(`step ${n}`));
    expect(history.done).toHaveLength(HISTORY_LIMIT);
    expect(history.done[0].sentence).toBe("step 6");
    expect(nextUndo(history)).toBe(`step ${HISTORY_LIMIT + 5}`);
    // Undone steps are held to 50 too.
    for (let n = 0; n < HISTORY_LIMIT; n += 1) history = afterUndone(history);
    expect(history.undone).toHaveLength(HISTORY_LIMIT);
  });

  it("undoes a group last to first and redoes it first to last", async () => {
    const log: string[] = [];
    const group = groupSteps("Removed Prompt 3", [step("links", log), step("rows", log)]);
    await group.undo();
    await group.redo();
    expect(log).toEqual(["undo rows", "undo links", "redo links", "redo rows"]);
  });

  it("names a change after the handler and what it was made to", () => {
    expect(handlerSentence("onRename", "Prompt 3")).toBe("Renamed Prompt 3");
    expect(handlerSentence("onAddUse", "Code 4")).toBe("Added an input to Code 4");
    expect(handlerSentence("onFields", "Session 2")).toBe("Changed Session 2");
  });
});

describe("on the page", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  const ids = () => positions().map((row) => row.id as string);
  const undoButton = () => screen.getByTestId("title-undo");
  const redoButton = () => screen.getByTestId("title-redo");
  const top = () => positions().filter((row) => row.parent_id === null).map((row) => row.id);
  const sessionKeys = () =>
    sessionsOf()
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((row) => row.session_key);
  const waitUndo = (sentence: string) => waitFor(() => expect(undoButton().getAttribute("title")?.replace(/ \([^)]*\)$/, "")).toBe(`Undo: ${sentence}`), { timeout: 15_000 });

  it("adding a tile is a step: Undo takes it away and Redo puts the same tile back", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getAllByTestId("add-to-session")[0], { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Prompt/ }));
    const box = (await screen.findByRole("textbox", { name: "Add a prompt" })) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "A third prompt for the first session" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(ids()).toHaveLength(10), { timeout: 15_000 });
    await waitUndo("Added a prompt");
    const added = positions().find((row) => (row.payload as { text?: string }).text === "A third prompt for the first session")?.id as string;
    fireEvent.click(undoButton());
    await waitFor(() => expect(ids()).toHaveLength(9), { timeout: 15_000 });
    expect(ids()).not.toContain(added);
    fireEvent.click(redoButton());
    await waitFor(() => expect(ids()).toContain(added), { timeout: 15_000 });
    expect(nodeRow(added)?.payload).toMatchObject({ text: "A third prompt for the first session", session: KEY_A });
  });

  it("moving a tile is a step", async () => {
    await mountCa20(seedCa20);
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move up" }));
    await waitFor(() => expect(top().slice(0, 2)).toEqual([IDS.p2, IDS.p1]), { timeout: 15_000 });
    await waitUndo("Moved Prompt 2 up");
    fireEvent.click(undoButton());
    await waitFor(() => expect(top().slice(0, 2)).toEqual([IDS.p1, IDS.p2]), { timeout: 15_000 });
    fireEvent.click(redoButton());
    await waitFor(() => expect(top().slice(0, 2)).toEqual([IDS.p2, IDS.p1]), { timeout: 15_000 });
  });

  it("a session's title, once committed, and moving a session are steps", async () => {
    await mountCa20(seedCa20);
    const title = screen.getByRole("textbox", { name: "Title of Session 1" }) as HTMLInputElement;
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: "Login" } });
    fireEvent.keyDown(title, { key: "Enter" });
    fireEvent.blur(title);
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[KEY_A]?.title).toBe("Login"), { timeout: 15_000 });
    await waitUndo("Changed the title of Session 1");
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move down" }));
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_B, KEY_A, KEY_C]), { timeout: 15_000 });
    await waitUndo("Moved Session 1 down");
    // In order: the move first, then the title.
    fireEvent.click(undoButton());
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_A, KEY_B, KEY_C]), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[KEY_A]?.title).toBe("Login");
    await waitUndo("Changed the title of Session 1");
    fireEvent.click(undoButton());
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[KEY_A]?.title).toBeUndefined(), { timeout: 15_000 });
    // And forwards again.
    fireEvent.click(redoButton());
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[KEY_A]?.title).toBe("Login"), { timeout: 15_000 });
    fireEvent.click(redoButton());
    await waitFor(() => expect(sessionKeys()).toEqual([KEY_B, KEY_A, KEY_C]), { timeout: 15_000 });
  });

  it("adding a part is a step", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(await screen.findByTestId("add-part-row"));
    await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making).length).toBeGreaterThan(0), { timeout: 15_000 });
    await waitUndo("Added a part");
    fireEvent.click(undoButton());
    await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making)).toHaveLength(0), { timeout: 15_000 });
  });

  it("mixed steps undo in the order they were made, and redo the other way", async () => {
    await mountCa20(seedCa20);
    // 1. Move Prompt 2 up (it is Prompt 1 now, and the login prompt is Prompt 2). 2. Remove the login prompt.
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move up" }));
    await waitFor(() => expect(top().slice(0, 2)).toEqual([IDS.p2, IDS.p1]), { timeout: 15_000 });
    await waitUndo("Moved Prompt 2 up");
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove tile" }));
    await waitFor(() => expect(ids()).not.toContain(IDS.p1), { timeout: 15_000 });
    await waitUndo("Removed Prompt 2");
    fireEvent.click(undoButton());
    await waitFor(() => expect(ids()).toContain(IDS.p1), { timeout: 15_000 });
    expect(top().slice(0, 2)).toEqual([IDS.p2, IDS.p1]);
    await waitUndo("Moved Prompt 2 up");
    fireEvent.click(undoButton());
    await waitFor(() => expect(top().slice(0, 2)).toEqual([IDS.p1, IDS.p2]), { timeout: 15_000 });
    fireEvent.click(redoButton());
    await waitFor(() => expect(top().slice(0, 2)).toEqual([IDS.p2, IDS.p1]), { timeout: 15_000 });
    await waitFor(() => expect(redoButton().getAttribute("title")?.replace(/ \([^)]*\)$/, "")).toBe("Redo: Removed Prompt 2"), { timeout: 15_000 });
    fireEvent.click(redoButton());
    await waitFor(() => expect(ids()).not.toContain(IDS.p1), { timeout: 15_000 });
  });

  it("the old 10-second toast is gone: moving a tile to a session says nothing but the title row's Undo", async () => {
    await mountCa20(seedCa20, {});
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 1 options" }), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Move to session…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Session 2/ }));
    await waitFor(() => expect((nodeRow(IDS.p1)?.payload as { session?: string }).session).toBe(KEY_B), { timeout: 15_000 });
    await waitUndo("Moved tile 1 to Session 2");
    expect(screen.queryByTestId("notice-undo")).toBeNull();
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
  });
});

describe("Save in a tile's window", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  it("is one step, however many things it changes, and Undo puts every one back", async () => {
    const MANUAL = "0c1c1c1c-0000-4000-8000-000000000050";
    await mountCa20((rows) => {
      seedCa20(rows);
      rows.build_nodes.push({ id: MANUAL, build_id: "0d0d0d0d-0000-4000-8000-000000000003", parent_id: null, position: 6, type: "manual_step", title: null, note: null, payload: { tool: "Figma", text: "Laid out the hero", session: KEY_B }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-20T10:00:00Z" });
    });
    fireEvent.doubleClick(screen.getByRole("group", { name: /^Manual step/ }));
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByLabelText("Title");
    fireEvent.change(title, { target: { value: "Hero layout" } });
    fireEvent.blur(title);
    fireEvent.change(within(dialog).getByLabelText("Line 1"), { target: { value: "Laid out the hero and the footer" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(nodeRow(MANUAL)?.title).toBe("Hero layout"), { timeout: 15_000 });
    await waitFor(() => expect((nodeRow(MANUAL)?.payload as { text?: string }).text).toBe("Laid out the hero and the footer"), { timeout: 15_000 });
    await waitFor(() => expect(screen.getByTestId("title-undo").getAttribute("title")).toMatch(/^Undo: Saved Manual step/), { timeout: 15_000 });
    fireEvent.click(screen.getByTestId("title-undo"));
    await waitFor(() => expect(nodeRow(MANUAL)?.title).toBeNull(), { timeout: 15_000 });
    expect((nodeRow(MANUAL)?.payload as { text?: string }).text).toBe("Laid out the hero");
    // One step: nothing else is left to undo.
    await waitFor(() => expect((screen.getByTestId("title-undo") as HTMLButtonElement).disabled).toBe(true));
  });
});

describe("a step whose undo fails", () => {
  beforeEach(harnessBefore);
  afterEach(harnessAfter);

  it("says so, stays in the history, and works when tried again", async () => {
    await mountCa20(seedCa20, { faults: [{ method: "POST", path: /build_nodes/, answer: PG.rlsInsert("build_nodes"), times: 1 }] });
    // The toast host, since the failure is said there.
    const { render } = await import("@testing-library/react");
    render(<Toaster />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove tile" }));
    await waitFor(() => expect(positions().map((row) => row.id)).not.toContain(IDS.p2), { timeout: 15_000 });
    await waitFor(() => expect((screen.getByTestId("title-undo") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("title-undo"));
    expect(await screen.findByText("Change not undone", undefined, { timeout: 15_000 })).toBeTruthy();
    // It is still there to undo, and nothing was put back.
    expect(positions().map((row) => row.id)).not.toContain(IDS.p2);
    expect((screen.getByTestId("title-undo") as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByTestId("title-redo") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("title-undo"));
    await waitFor(() => expect(positions().map((row) => row.id)).toContain(IDS.p2), { timeout: 15_000 });
    void within;
  });
});
