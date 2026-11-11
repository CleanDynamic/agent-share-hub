// F11 to F14, F56 (prompt 2): one function sets the selection, Details always shows it, and a step has one identifier, "Step N".
// The composer's own page (SandboxPage behind supabase-js, only the network faked), the CA-20 draft: Session 1 holds Step 1 and
// Step 2; Session 2 holds a team (Step 3), then Step 4 ("Check the orders") and Step 5.

import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { DETAILS_COPY } from "./DetailsPanel";
import { harnessAfter, harnessBefore, mountCa20, openAddRow } from "./ca20Harness";
import { IDS, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 40_000 });

const card = (name: RegExp) => screen.getByRole("group", { name });
const panel = () => screen.getByTestId("details-panel");
const panelTitle = () => within(panel()).getByRole("heading", { level: 3 }).textContent;
const panelLine = () => within(panel()).getByTestId("details-line").textContent;

/** Sources, opened from its rail, with Session 2 open. */
async function sourcesOpen() {
  fireEvent.click(screen.getByRole("button", { name: "Show sources" }));
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
    await waitFor(() => expect(panelTitle()).toBe("Prompt 1"));
    fireEvent.click(card(/^Prompt 2:/));
    await waitFor(() => expect(panelTitle()).toBe("Prompt 2"));
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

  it('"Open prompt" selects the prompt it opens', async () => {
    await mountCa20(seedCa20);
    fireEvent.click(within(card(/^Prompt 2:/)).getByRole("button", { name: "Open prompt" }));
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

describe("one identifier for a step (F56)", () => {
  it("a build of two sessions: the tile, the panel, the prompt window and Sources all say Step 4 for the same step", async () => {
    await mountCa20(seedCa20);
    // The tile.
    expect(within(card(/^Prompt 4:/)).getByTestId("prompt-place").textContent).toBe("Step 4");
    // The panel.
    fireEvent.click(card(/^Prompt 4:/));
    await waitFor(() => expect(panelLine()).toMatch(/^Step 4 · Session 2/));
    // The prompt window: its title, and the one grey line with the position in the session as secondary text.
    fireEvent.click(within(card(/^Prompt 4:/)).getByRole("button", { name: "Open prompt" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByTestId("prompt-place").textContent).toBe("Step 4");
    expect(within(dialog).getByTestId("full-prompt-line").textContent).toMatch(/^Step 4 · 1 of 2 in Session 2/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    // Sources.
    const sources = await sourcesOpen();
    expect(within(sources).getByText("Step 4").closest("button")?.textContent).toBe("Step 4Prompt 4");
  });
});
