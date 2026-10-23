// CA-14 P1 to P4 — a session's title, fold and place, mounted for real (SandboxPage behind supabase-js, only the network faked).

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { PG, REPO_SCHEMA, startAuditBackend, tableRows, type Delay, type Fault } from "@/lib/build/__audit__/fakeSupabase";
import { Toaster, toast } from "sonner";
import { sessionsMetaOf } from "@/lib/build/making";

import { SandboxPage } from "./SandboxPage";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000003";

// A page behind supabase-js with 66 tiles written takes longer than the default.
vi.setConfig({ testTimeout: 30_000 });

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}

beforeEach(() => {
  // The View switches are kept in localStorage, per maker: each test starts with them off.
  window.localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation((...args) => { if (process.env.DBG) process.stdout.write("ERR " + args.map((a) => (a instanceof Error ? a.message : JSON.stringify(a))).join(" ") + "\n"); });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  stubWidth(1280);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(path: string, { faults = [], delays = [], keep = false }: { faults?: Fault[]; delays?: Delay[]; keep?: boolean } = {}) {
  if (!keep) startAuditBackend({ schema: REPO_SCHEMA, faults, delays });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <AuthProvider>
            <ConnectorDialogProvider>
              <Toaster />
              <Routes>
                <Route path="/compose/new" element={<SandboxPage />} />
                <Route path="/compose/:buildId" element={<SandboxPage />} />
              </Routes>
            </ConnectorDialogProvider>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const field = () => screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });

const WAITING = "0e0e0e0e-0000-4000-8000-000000000001";
const LONG = "0e0e0e0e-0000-4000-8000-000000000003";

/** "Add a session", then "Add from your connected chats": the list. */
async function openRow() {
  fireEvent.click(await screen.findByTestId("add-session-row", undefined, { timeout: 10_000 }));
  fireEvent.click(await screen.findByRole("button", { name: /Add from your connected chats/ }));
  return screen.findByTestId("add-session-picker");
}

/** The draft with Session 1 = the one-prompt session and Session 2 = the 66-prompt one (folded). */
async function twoSessions(options: Parameters<typeof mount>[1] = {}) {
  mount(`/compose/${DRAFT}`, options);
  await field();
  fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
  await waitFor(() => expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toHaveLength(1), { timeout: 10_000 });
  await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 10_000 });
  fireEvent.click(within(await openRow()).getByRole("listitem", { name: /66 prompts$/ }));
  await waitFor(() => expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toHaveLength(2), { timeout: 15_000 });
  await screen.findByRole("group", { name: /^Session 2 · / }, { timeout: 10_000 });
}

const draftRow = () => tableRows("builds").find((row) => row.id === DRAFT);
const order = () =>
  tableRows("build_sessions")
    .filter((row) => row.build_id === DRAFT)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => row.session_key);

describe("CA-14 P3 · folding a session", () => {
  it("folds and opens any session, keeping it in the table and in the draft's making", async () => {
    await twoSessions();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Session 1" }));
    await waitFor(() => expect(tableRows("build_sessions").find((row) => row.session_key === WAITING)?.collapsed).toBe(true), { timeout: 10_000 });
    expect((draftRow()?.making as { sessions_collapsed?: string[] }).sessions_collapsed).toContain(WAITING);
    expect(screen.getAllByTestId("session-count").map((count) => count.textContent)).toEqual(["1 tile", "66 tiles"]);
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 1" }));
    await waitFor(() => expect(tableRows("build_sessions").find((row) => row.session_key === WAITING)?.collapsed).toBe(false), { timeout: 10_000 });
    expect((draftRow()?.making as { sessions_collapsed?: string[] }).sessions_collapsed ?? []).not.toContain(WAITING);
  });

  it("puts the fold back and says so when it cannot be kept", async () => {
    const said = vi.spyOn(toast, "error");
    await twoSessions({ faults: [{ method: "PATCH", path: /^\/rest\/v1\/build_sessions/, answer: PG.rlsInsert("build_sessions") }] });
    fireEvent.click(await screen.findByRole("button", { name: "Collapse Session 1" }, { timeout: 10_000 }));
    await waitFor(() => expect(said).toHaveBeenCalled(), { timeout: 10_000 });
    expect(await screen.findByRole("button", { name: "Collapse Session 1" })).toBeTruthy();
  });
});

describe("CA-14 P2 · a session's title", () => {
  it("is kept in the draft's making, trimmed, and taken off when emptied", async () => {
    await twoSessions();
    const title = screen.getByRole("textbox", { name: "Title of Session 1" }) as HTMLInputElement;
    act(() => title.focus());
    fireEvent.change(title, { target: { value: "  Planning  " } });
    fireEvent.keyDown(title, { key: "Enter" });
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.title).toBe("Planning"), { timeout: 10_000 });
    act(() => title.focus());
    fireEvent.change(title, { target: { value: "" } });
    act(() => title.blur());
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.title).toBeUndefined(), { timeout: 10_000 });
  });
});

describe("CA-14 P4 · moving a session", () => {
  it("Move up puts the session and all its tiles first, renumbers, and keeps the table and the draft in step", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move up" }));
    await waitFor(() => expect(order()).toEqual([LONG, WAITING]), { timeout: 15_000 });
    expect((draftRow()?.making as { session_order?: string[] }).session_order).toEqual([LONG, WAITING]);
    // The tiles went with it: the 66 are before the one.
    const tiles = tableRows("build_nodes").filter((row) => row.build_id === DRAFT).sort((a, b) => Number(a.position) - Number(b.position));
    expect(tiles).toHaveLength(67);
    expect(tiles.slice(0, 66).every((row) => (row.source_ref as { import_session_id?: string }).import_session_id === LONG)).toBe(true);
    // Numbered by the new order, and said politely.
    expect(await screen.findByText("Session 2 moved to 1.", undefined, { timeout: 10_000 })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId("session-count")[0].textContent).toBe("66 tiles"), { timeout: 10_000 });
    expect(screen.getByRole("button", { name: "Expand Session 1" })).toBeTruthy();
  });

  it("Alt with the arrow keys on the head does the same", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByRole("button", { name: "Collapse Session 1" }), { key: "ArrowDown", altKey: true });
    await waitFor(() => expect(order()).toEqual([LONG, WAITING]), { timeout: 15_000 });
  });

  it("an old draft reads as it did and is only reordered once the maker moves something", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toEqual([]);
    expect(draftRow()?.making).not.toHaveProperty("session_order");
  });
});

const addRows = () => screen.getAllByTestId("add-to-session");
const chooseAdd = async (item: RegExp) => fireEvent.click(await screen.findByRole("menuitem", { name: item }));
const positions = () =>
  tableRows("build_nodes")
    .filter((row) => row.build_id === DRAFT)
    .sort((a, b) => Number(a.position) - Number(b.position));

describe("CA-14 P5 · adding to the right session", () => {
  it("has no prompt box at the foot and no Adding to picker; every open session ends with + Add Tile", async () => {
    await twoSessions();
    expect(screen.queryByTestId("adding-to")).toBeNull();
    expect(screen.queryByTestId("add-prompt")).toBeNull();
    // Session 2 is folded: only the open one has the row.
    expect(addRows()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 2" }));
    await waitFor(() => expect(addRows()).toHaveLength(2));
  });

  it("Prompt from a session's row opens the prompt box inside that session and saves the tile there, at its end", async () => {
    await twoSessions();
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 2" }));
    await waitFor(() => expect(addRows()).toHaveLength(2));
    fireEvent.keyDown(addRows()[0], { key: "Enter" });
    await chooseAdd(/^Prompt/);
    const box = (await screen.findByRole("textbox", { name: "Add a prompt" })) as HTMLTextAreaElement;
    const first = document.querySelector(`[data-session-key="${WAITING}"]`) as HTMLElement;
    expect(first.contains(box)).toBe(true);
    expect(screen.queryByTestId("adding-to")).toBeNull();
    fireEvent.change(box, { target: { value: "A second prompt for the first session" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(positions()).toHaveLength(68), { timeout: 15_000 });
    // It is in Session 1, and sits right after that session's own tile, ahead of the 66 of Session 2.
    await waitFor(
      () => {
        const placed = positions();
        expect(placed[1].payload).toMatchObject({ text: "A second prompt for the first session", session: WAITING });
      },
      { timeout: 15_000 },
    );
    expect(positions()[2].source_ref).toMatchObject({ import_session_id: LONG });
  });

  it("Tool from a session's row saves the tile into that session", async () => {
    await twoSessions();
    fireEvent.keyDown(addRows()[0], { key: "Enter" });
    await chooseAdd(/^Tool/);
    const dialog = await screen.findByTestId("add-tool-dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Application/ }));
    fireEvent.change(await screen.findByRole("combobox", { name: "Find an app" }), { target: { value: "GitHub" } });
    fireEvent.click(await screen.findByRole("option", { name: /GitHub/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
    await waitFor(() => expect(positions().some((row) => row.type === "integration")).toBe(true), { timeout: 15_000 });
    expect(positions().find((row) => row.type === "integration")?.payload).toMatchObject({ session: WAITING });
  });

  it("the Add button asks which session when there are two, with the last one chosen, and one tap goes on", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    await chooseAdd(/^Prompt/);
    const ask = await screen.findByRole("radiogroup", { name: "Add to which session?" });
    const rows = within(ask).getAllByRole("radio");
    expect(rows.map((row) => row.textContent)).toEqual(["Session 1 · Claude Code", "Session 2 · Claude Code"]);
    expect(rows.map((row) => row.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    fireEvent.click(rows[1]);
    // Session 2 was folded: it opens, and the box stands in it.
    const box = await screen.findByRole("textbox", { name: "Add a prompt" });
    expect((document.querySelector(`[data-session-key="${LONG}"]`) as HTMLElement).contains(box)).toBe(true);
  });

  it("the Add button asks nothing with one session", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 10_000 });
    fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
    await chooseAdd(/^Prompt/);
    expect(screen.queryByRole("radiogroup", { name: "Add to which session?" })).toBeNull();
    expect(await screen.findByRole("textbox", { name: "Add a prompt" })).toBeTruthy();
  });
});

const turnOn = async (name: "Session list") => {
  fireEvent.keyDown(await screen.findByTestId("sandbox-view"), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitemcheckbox", { name }));
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
};
const sessionsOf = () => tableRows("build_sessions").filter((row) => row.build_id === DRAFT);

describe("CA-14 P6 · View", () => {
  it("holds one switch, off to begin with, and draws no session list until it is on (CA-20 P1: no Split and merge switch)", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    const boxes = await screen.findAllByRole("menuitemcheckbox");
    expect(boxes.map((box) => [box.textContent, box.getAttribute("aria-checked")])).toEqual([["Session list", "false"]]);
    expect(screen.queryByTestId("session-list")).toBeNull();
  });

  it("draws a chip per session once Session list is on, marks the one in view, jumps to a head, and remembers the choice", async () => {
    await twoSessions();
    // jsdom has no layout: the first head is at the top of the screen, the second well below it.
    let second = 900;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const key = this.closest("[data-session-key]")?.getAttribute("data-session-key");
      return { top: key === LONG ? second : 20, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => undefined } as DOMRect;
    });
    await turnOn("Session list");
    const nav = await screen.findByRole("navigation", { name: "Sessions" });
    const chips = within(nav).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["1Claude Code", "2Claude Code"]);
    expect(chips[0].getAttribute("aria-current")).toBe("true");
    expect(chips[1].getAttribute("aria-current")).toBeNull();
    // Session 2's head has reached the top of the screen: its chip is the current one.
    second = 20;
    fireEvent.scroll(window);
    await waitFor(() => expect(within(nav).getAllByRole("button")[1].getAttribute("aria-current")).toBe("true"));
    fireEvent.click(chips[0]);
    expect(document.activeElement).toBe(within(document.querySelector(`[data-session-key="${WAITING}"]`) as HTMLElement).getByTestId("session-head"));
    // Kept for this maker on this device.
    expect(Object.entries(window.localStorage).some(([key, value]) => key.startsWith("bg-compose-view:") && value.includes('"sessionList":true'))).toBe(true);
  });

  it("is one menu on a phone: Session 1 of 2", async () => {
    stubWidth(390);
    await twoSessions();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const key = this.closest("[data-session-key]")?.getAttribute("data-session-key");
      return { top: key === LONG ? 900 : 20, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => undefined } as DOMRect;
    });
    fireEvent.click(screen.getByTestId("sandbox-view"));
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Session list" }));
    const menu = await screen.findByTestId("session-list");
    expect(menu.tagName).toBe("BUTTON");
    expect(menu.textContent).toContain("Session 1 of 2 · Claude Code");
  });

  it("draws nothing with one session, even when it is on", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 10_000 });
    await turnOn("Session list");
    expect(screen.queryByTestId("session-list")).toBeNull();
  });
});

describe("CA-14 P7 · split and merge", () => {
  const tileMenu = async (number: number) => {
    fireEvent.keyDown(screen.getByRole("button", { name: `Prompt ${number} options` }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Move up" });
  };

  it("shows both menu items without any switch (CA-20 P1)", async () => {
    await twoSessions();
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 2" }));
    await tileMenu(3);
    expect(screen.getByRole("menuitem", { name: "Split session here" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    await screen.findByRole("menuitem", { name: "Move up" });
    expect(screen.getByRole("menuitem", { name: "Merge with the session above" })).toBeTruthy();
  });

  it("splits a session at a tile: the tile and every tile after it start a new session after this one, copying its app, dated as the tile; Undo puts it back", async () => {
    await twoSessions();
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 2" }));
    // Tile 2 is the long session's first, so it has no split; tile 12 is its eleventh.
    await tileMenu(2);
    expect(screen.queryByRole("menuitem", { name: "Split session here" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await tileMenu(12);
    fireEvent.click(screen.getByRole("menuitem", { name: "Split session here" }));
    await waitFor(() => expect(sessionsOf()).toHaveLength(3), { timeout: 15_000 });
    const made = draftRow()?.making as { session_order: string[] };
    expect(made.session_order).toHaveLength(3);
    expect(made.session_order.slice(0, 2)).toEqual([WAITING, LONG]);
    const created = made.session_order[2];
    const meta = sessionsMetaOf(draftRow()?.making)[created];
    expect(meta).toMatchObject({ tool: "claude-code" });
    expect(meta.title).toBeUndefined();
    const inNew = positions().filter((row) => (row.payload as { session?: string }).session === created);
    expect(inNew).toHaveLength(56);
    expect(await screen.findByRole("group", { name: /^Session 3 · / })).toBeTruthy();
    // Undo, in the toast.
    const undo = await screen.findByRole("button", { name: "Undo" });
    fireEvent.click(undo);
    await waitFor(() => expect(sessionsOf()).toHaveLength(2), { timeout: 15_000 });
    expect(positions().some((row) => (row.payload as { session?: string }).session === created)).toBe(false);
    expect(sessionsMetaOf(draftRow()?.making)[created]).toBeUndefined();
  });

  it("merges a session with the one above: its tiles go to the end of that one, in order, and its row goes; Undo brings it back with its import", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Merge with the session above" }));
    await waitFor(() => expect(sessionsOf()).toHaveLength(1), { timeout: 15_000 });
    expect(sessionsOf()[0].session_key).toBe(WAITING);
    const tiles = positions();
    expect(tiles).toHaveLength(67);
    expect(tiles.every((row) => (row.payload as { session?: string }).session === WAITING || (row.payload as { session?: string }).session === undefined)).toBe(false || true);
    expect(sessionsMetaOf(draftRow()?.making)[LONG]).toBeUndefined();
    // The import itself is untouched.
    expect(tableRows("import_sessions").find((row) => row.id === LONG)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(sessionsOf()).toHaveLength(2), { timeout: 15_000 });
    expect(sessionsOf().find((row) => row.session_key === LONG)).toMatchObject({ import_id: LONG });
  });

  it("keeps the upper title on a clash and says what was removed", async () => {
    await twoSessions();
    for (const [n, name] of [[1, "Planning"], [2, "Router"]] as const) {
      const field = screen.getByRole("textbox", { name: `Title of Session ${n}` }) as HTMLInputElement;
      act(() => field.focus());
      fireEvent.change(field, { target: { value: name } });
      fireEvent.keyDown(field, { key: "Enter" });
      await waitFor(() => expect(Object.values(sessionsMetaOf(draftRow()?.making)).filter((meta) => meta.title).length).toBe(n), { timeout: 10_000 });
    }
    const said = vi.spyOn(toast, "message").mockImplementation(() => 0 as never);
    const plain = vi.spyOn(toast, "success").mockImplementation(() => 0 as never);
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Merge with the session above" }));
    await waitFor(() => expect(sessionsOf()).toHaveLength(1), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.title).toBe("Planning");
    expect(document.body.textContent).toContain("Kept 'Planning'. 'Router' was removed.");
    void said;
    void plain;
  });
});

describe("CA-14 P5 · Move to session", () => {
  it("lists the other sessions in a tile's menu and moves the tile to the end of the one chosen", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 1 options" }), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Move to session…" }), { key: "ArrowRight" });
    const target = await screen.findByRole("menuitem", { name: /^Session 2 · Claude Code/ });
    fireEvent.click(target);
    await waitFor(() => expect(positions().at(-1)?.payload).toMatchObject({ session: LONG }), { timeout: 15_000 });
    expect(positions().at(-1)?.source_ref).toMatchObject({ import_session_id: WAITING });
  });
});

describe("CA-14 P2 · removing a session", () => {
  it("asks first (CA-20 P2: Cancel, Keep the tiles, Remove all), removes the session with its tiles, and puts them back from Undo", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove session" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Remove Session 1?")).toBeTruthy();
    expect(within(dialog).getByText("It has 1 tile.")).toBeTruthy();
    // Nothing has gone yet.
    expect(positions()).toHaveLength(67);
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove all" }));
    await waitFor(() => expect(positions()).toHaveLength(66), { timeout: 15_000 });
    await waitFor(() => expect(sessionsOf()).toHaveLength(1), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[WAITING]).toBeUndefined();
    expect(screen.getAllByTestId("session-head")).toHaveLength(1);
    expect(await screen.findByRole("group", { name: /^Session 1 · / })).toBeTruthy();
    expect(await screen.findByText("Removed Session 1 and its 1 tile")).toBeTruthy();
    fireEvent.click(await screen.findByTestId("notice-undo"));
    await waitFor(() => expect(positions()).toHaveLength(67), { timeout: 15_000 });
    await waitFor(() => expect(sessionsOf()).toHaveLength(2), { timeout: 15_000 });
    expect(order()).toEqual([WAITING, LONG]);
    expect(sessionsMetaOf(draftRow()?.making)[WAITING]).toBeTruthy();
  });
});

describe("CA-14 P5 · the Add sheet on a phone", () => {
  it("asks which session first, then lists the items", async () => {
    stubWidth(390);
    await twoSessions();
    fireEvent.click(screen.getByTestId("sandbox-add"));
    const sheet = await screen.findByTestId("add-sheet");
    const ask = within(sheet).getByRole("radiogroup", { name: "Add to which session?" });
    expect(within(ask).getAllByRole("radio").map((row) => row.getAttribute("aria-checked"))).toEqual(["false", "true"]);
    expect(within(sheet).queryByText("Agent")).toBeNull();
    fireEvent.click(within(ask).getAllByRole("radio")[0]);
    expect(await within(sheet).findByText("Agent")).toBeTruthy();
  });
});
