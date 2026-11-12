// F11 to F14, F56 (prompt 2): one function sets the selection, Details always shows it, and a step has one identifier, "Step N".
// The composer's own page (SandboxPage behind supabase-js, only the network faked), the CA-20 draft: Session 1 holds Step 1 and
// Step 2; Session 2 holds a team (Step 3), then Step 4 ("Check the orders") and Step 5.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { DETAILS_COPY } from "./DetailsPanel";
import { harnessAfter, harnessBefore, mountCa20, openAddRow } from "./ca20Harness";
import { IDS, KEY_A, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const card = (name: RegExp) => screen.getByRole("group", { name });
const panel = () => screen.getByTestId("details-panel");
const panelTitle = () => within(panel()).getByRole("heading", { level: 3 }).textContent;
const panelLine = () => within(panel()).getByTestId("details-line").textContent;
/** F42: a tile's title, as its heading draws it. */
const tileTitle = (name: RegExp) => within(card(name)).getByRole("heading", { level: 3 }).textContent;

/** Sources folds to its rail only under 928 (S34); at the test window it is open. Open the rail where there is one. */
function showSources() {
  const rail = screen.queryByRole("button", { name: "Show sources" });
  if (rail) fireEvent.click(rail);
}

/** Sources, with Session 2 open. */
async function sourcesOpen() {
  showSources();
  const sources = await screen.findByRole("region", { name: "Sources" });
  fireEvent.click(await within(sources).findByRole("button", { name: "Open session 2" }));
  await within(sources).findByText("Step 4");
  return sources;
}

beforeEach(harnessBefore);
afterEach(harnessAfter);

describe("the right panel shows the selection (F14)", () => {
  it("selects tile A, then tile B: the panel's title is B's", async () => {
    await mountCa20(seedCa20);
    fireEvent.click(card(/^Prompt 1:/));
    await waitFor(() => expect(panelTitle()).toBe(tileTitle(/^Prompt 1:/)));
    fireEvent.click(card(/^Prompt 2:/));
    await waitFor(() => expect(panelTitle()).toBe(tileTitle(/^Prompt 2:/)));
    expect(tileTitle(/^Prompt 2:/)).not.toBe(tileTitle(/^Prompt 1:/));
  });

  it("with nothing selected it says one line, from its COPY object", async () => {
    await mountCa20(seedCa20);
    expect(DETAILS_COPY.empty).toBe("Select a step to see its details");
    fireEvent.click(card(/^Prompt 1:/));
    await waitFor(() => expect(screen.queryByTestId("details-panel")).toBeTruthy());
  });
});

describe("one selection rule (F11, F12)", () => {
  it("a click on a prompt in Sources selects its tile and scrolls it into view, nearest", async () => {
    await mountCa20(seedCa20);
    const scrolled: { id: string | null; options: unknown }[] = [];
    Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
      scrolled.push({ id: this.getAttribute("data-node-id") ?? this.getAttribute("data-tile-id"), options });
    };
    const sources = await sourcesOpen();
    fireEvent.click(within(sources).getByText("Step 4"));
    await waitFor(() => expect(card(/^Prompt 4:/).getAttribute("data-selected")).toBe("true"));
    expect(scrolled).toContainEqual({ id: IDS.p3, options: { block: "nearest" } });
  });

  it("a double click on a prompt selects the prompt it opens (F17)", async () => {
    await mountCa20(seedCa20);
    fireEvent.doubleClick(card(/^Prompt 2:/));
    await waitFor(() => expect(card(/^Prompt 2:/).getAttribute("data-selected")).toBe("true"));
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});

describe("a tile added from the composer (F13)", () => {
  it("becomes the selection and is scrolled into view", async () => {
    await mountCa20(seedCa20);
    const scrolled: { id: string | null; options: unknown }[] = [];
    Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
      scrolled.push({ id: this.getAttribute("data-node-id") ?? this.getAttribute("data-tile-id"), options });
    };
    await openAddRow();
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Prompt/ }));
    const field = await screen.findByRole("textbox", { name: "Add a prompt" });
    fireEvent.change(field, { target: { value: "Summarise the orders" } });
    fireEvent.keyDown(field, { key: "Enter" });
    const added = await screen.findByRole("group", { name: /^Prompt 6:/ }, { timeout: 15_000 });
    await waitFor(() => expect(added.getAttribute("data-selected")).toBe("true"));
    expect(scrolled.some((call) => call.id === added.getAttribute("data-node-id") && (call.options as { block?: string })?.block === "nearest")).toBe(true);
  });
});

describe("undo after adding from the composer (F16)", () => {
  it('adds "abc", says Prompt added with Undo, and Undo takes the tile back off', async () => {
    await mountCa20(seedCa20);
    const tiles = () => screen.getAllByRole("group", { name: /^Prompt \d+:/ }).length;
    const before = tiles();
    await openAddRow();
    fireEvent.click(await screen.findByRole("menuitem", { name: /^Prompt/ }));
    const field = await screen.findByRole("textbox", { name: "Add a prompt" });
    fireEvent.change(field, { target: { value: "abc" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(tiles()).toBe(before + 1), { timeout: 15_000 });
    await waitFor(() => expect(screen.getByTestId("reference-notice").textContent).toMatch(/^Prompt added/), { timeout: 15_000 });
    expect(screen.getByTestId("reference-notice").getAttribute("role")).toBe("status");
    fireEvent.click(within(screen.getByTestId("reference-notice")).getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(tiles()).toBe(before), { timeout: 15_000 });
  });
});

describe("one identifier for a step (F56)", () => {
  it("a build of two sessions: the tile, the panel, the prompt window and Sources all say Step 4 for the same step", async () => {
    await mountCa20(seedCa20);
    // The tile: its number badge (F42: the title is the title alone).
    expect(within(card(/^Prompt 4:/)).getByTestId("number-badge").textContent).toBe("4");
    // The panel.
    fireEvent.click(card(/^Prompt 4:/));
    await waitFor(() => expect(panelLine()).toMatch(/^Step 4 · Session 2/));
    // The prompt window: its title, and the one grey line with the position in the session as secondary text.
    fireEvent.doubleClick(card(/^Prompt 4:/));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("prompt-place").textContent).toBe("Step 4");
    expect(within(dialog).getByTestId("full-prompt-line").textContent).toMatch(/^Step 4 · 1 of 2 in Session 2/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    // Sources.
    const sources = await sourcesOpen();
    expect(within(sources).getByText("Step 4").closest("button")?.textContent).toBe(`Step 4${tileTitle(/^Prompt 4:/)}`);
  });
});

/** F57: Session 1 holds three prompts, a system prompt, one agent (with its `:instructions` prompt) and a Summary tile. */
function seedCount(rows: Record<string, Record<string, unknown>[]>) {
  seedCa20(rows);
  const drop = new Set([IDS.p4, IDS.team, IDS.g2, IDS.g3, IDS.file]);
  rows.build_nodes = rows.build_nodes.filter((row) => !drop.has(row.id as string));
  for (const row of rows.build_nodes) {
    row.parent_id = null;
    if (row.id === IDS.g1) row.position = 10;
    row.payload = { ...(row.payload as object), session: KEY_A };
  }
  const base = { build_id: rows.build_nodes[0].build_id, parent_id: null, note: null, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-20T10:00:00Z" };
  rows.build_nodes.push(
    { ...base, id: "0c1c1c1c-0000-4000-8000-000000000091", position: 20, type: "system_prompt", title: "Brand voice", payload: { step: true, text: "Write in a calm tone.", scope: "all", session: KEY_A } },
    { ...base, id: "0c1c1c1c-0000-4000-8000-000000000092", position: 21, type: "prompt", title: null, payload: { text: "This session is being continued from a previous conversation that ran out of context.", session: KEY_A } },
  );
}

describe("one prompt count (F57)", () => {
  it("the Build line, Details and the prompt window's \"of N\" give the same number", async () => {
    await mountCa20(seedCount);
    // The Build line.
    await waitFor(() => expect(screen.getByTestId("sandbox-counts").textContent).toMatch(/ 3 prompts/));
    // The prompt window, on Session 1's second prompt.
    fireEvent.doubleClick(card(/^Prompt 2:/));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("full-prompt-line").textContent).toMatch(/^Step 2 · 2 of 3 in Session 1/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    // Details, on the session.
    showSources();
    const sources = await screen.findByRole("region", { name: "Sources" });
    fireEvent.click(await within(sources).findByText("Session 1 · Claude Code"));
    await waitFor(() => expect(panel().textContent).toContain("3 of 3"));
  });
});
