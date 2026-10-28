// SV-18 P2 and P3: Add › From Library on the CA-20 draft (the composer mounted for real, only the network faked).
//
// The reader's saved items are what `listSavedItems` and its neighbours answer; everything after Insert is the real writer.

import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

const touch = vi.fn(async () => undefined);
vi.mock("@/lib/library/savedItems", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/library/savedItems")>();
  const { savedFixtures } = await import("./sv18.fixtures");
  return {
    ...real,
    listSavedItems: vi.fn(async () => ({ items: savedFixtures(), next: null })),
    savedItemsUsedIn: vi.fn(async () => new Map([["si-prompt", 4]])),
    makerHandles: vi.fn(async () => new Map([["0a0a0a0a-0000-4000-8000-000000000009", "maya"]])),
    collectionSavedItemIds: vi.fn(async () => new Map([["col-1", ["si-prompt", "si-agent"]]])),
    touchSavedItems: (...args: unknown[]) => touch(...(args as [])),
  };
});
vi.mock("@/lib/library/builds", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/library/builds")>();
  return { ...real, listCollections: vi.fn(async () => [{ id: "col-1", ownerId: "me", name: "Sales prompts", isPrivate: true, itemCount: 2, lastUsedAt: "2026-10-20T00:00:00Z" }]) };
});

import { REPO_SCHEMA, startAuditBackend } from "@/lib/build/__audit__/fakeSupabase";

import { MotionChannel } from "./listMotion";
import { draftRow, harnessAfter, harnessBefore, mountCa20, nodeRow, positions } from "./ca20Harness";
import { IDS, seedCa20 } from "./ca20Fixture";

vi.setConfig({ testTimeout: 60_000 });

const SCHEMA = { ...REPO_SCHEMA, tables: { ...REPO_SCHEMA.tables, build_nodes: [...REPO_SCHEMA.tables.build_nodes, "contributor_id"] } };

async function open() {
  startAuditBackend({ schema: SCHEMA, seed: seedCa20 });
  await mountCa20(() => undefined, { keep: true });
}

const openAdd = () => fireEvent.keyDown(screen.getByTestId("sandbox-add"), { key: "Enter" });
async function openWindow() {
  openAdd();
  fireEvent.click(await screen.findByRole("menuitem", { name: /From Library/ }));
  // Three sessions: Add first asks which one; the session last added to is already chosen.
  const ask = await screen.findByRole("radiogroup", { name: "Add to which session?" }, { timeout: 5_000 }).catch(() => null);
  if (ask) fireEvent.click(within(ask).getAllByRole("radio").find((radio) => radio.getAttribute("aria-checked") === "true") ?? within(ask).getAllByRole("radio")[0]);
  return screen.findByRole("dialog", { name: "Add from Library" }, { timeout: 15_000 });
}
const rowsOf = (dialog: HTMLElement) => within(dialog).findAllByRole("radio");
const pick = async (dialog: HTMLElement, title: string) => {
  const radios = await rowsOf(dialog);
  const row = radios.find((radio) => within(radio).queryByText(title));
  expect(row, `a row named ${title}`).toBeTruthy();
  fireEvent.click(row as HTMLElement);
};
const tiles = () => positions().filter((row) => !String(row.type).includes("document"));

describe("Add › From Library", () => {
  beforeEach(() => {
    harnessBefore();
    touch.mockClear();
  });
  afterEach(harnessAfter);

  it("is in the Add menu, enabled, with its one line", async () => {
    await open();
    openAdd();
    const item = await screen.findByRole("menuitem", { name: /From Library/ });
    expect(item.getAttribute("aria-disabled")).not.toBe("true");
    expect(item.textContent).toContain("Saved steps and sessions");
  });

  it("lists the saved steps and sessions that fit the session, and no request, filter set or collection", async () => {
    await open();
    const dialog = await openWindow();
    const titles = (await rowsOf(dialog)).map((row) => within(row).getAllByText(/./)[0].textContent);
    expect(titles).toEqual(["Summary on one prompt", "Research brief", "Inbox triage"]);
    expect(within(dialog).queryByText("A request")).toBeNull();
    // Used in, the maker, the model.
    expect(within(dialog).getByText(/Prompt · Call notes · @maya · .* · used in 4 builds/)).toBeTruthy();
  });

  it("inserts a saved prompt as one tile with its source, the maker credited, and Undo takes it away", async () => {
    await open();
    const expectSpy = vi.spyOn(MotionChannel.prototype, "expect");
    const before = tiles().length;
    const dialog = await openWindow();
    await pick(dialog, "Summary on one prompt");
    expect(within(dialog).getByText(/Copied as a new prompt with its source\. @maya is credited on the tile, and their step will show used in 5 builds\./)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(tiles()).toHaveLength(before + 1), { timeout: 20_000 });
    const added = tiles().find((row) => (row.source_ref as { saved_item_id?: string } | null)?.saved_item_id === "si-prompt");
    expect(added).toBeTruthy();
    expect(added).toMatchObject({ type: "prompt", parent_id: null, title: "Summary on one prompt", contributor_id: "0a0a0a0a-0000-4000-8000-000000000009" });
    expect(added?.source_ref).toEqual({ node_id: "src-prompt", build_id: "b-src", saved_item_id: "si-prompt" });
    expect(added?.payload).toMatchObject({ text: "Summarise the call.", model: "claude-opus-5-5" });
    // The animator was told first, with the new tile's key.
    const told = expectSpy.mock.calls.map(([label]) => label).find((label) => label.kind === "duplicate");
    expect(told?.keys).toEqual([added?.id]);
    expect(await screen.findByText("Added Summary on one prompt from Library")).toBeTruthy();
    expect(touch).toHaveBeenCalledWith(["si-prompt"]);
    // One undo step.
    fireEvent.click(screen.getByTestId("title-undo"));
    await waitFor(() => expect(tiles()).toHaveLength(before), { timeout: 20_000 });
    expect(nodeRow(added?.id as string)).toBeUndefined();
  });

  it("goes in the session the maker chose", async () => {
    await open();
    const dialog = await openWindow();
    await pick(dialog, "Summary on one prompt");
    fireEvent.click(within(dialog).getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(positions().some((row) => (row.source_ref as { saved_item_id?: string } | null)?.saved_item_id === "si-prompt")).toBe(true), { timeout: 20_000 });
    const added = positions().find((row) => (row.source_ref as { saved_item_id?: string } | null)?.saved_item_id === "si-prompt");
    // The draft's last session is Session 3 (empty): the tile joins the session the List was adding to.
    expect((added?.payload as { session?: string }).session).toBeTruthy();
    expect(draftRow()).toBeTruthy();
  });

  it("adds a saved session as a new session with its prompts, each naming the saved session", async () => {
    await open();
    const dialog = await openWindow();
    await pick(dialog, "Inbox triage");
    fireEvent.click(within(dialog).getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(positions().filter((row) => (row.source_ref as { saved_item_id?: string } | null)?.saved_item_id === "si-session")).toHaveLength(2), { timeout: 30_000 });
    const copies = positions().filter((row) => (row.source_ref as { saved_item_id?: string } | null)?.saved_item_id === "si-session");
    expect(copies.map((row) => (row.payload as { text: string }).text)).toEqual(["Sort my inbox.", "Draft replies."]);
    expect(copies[0].source_ref).toMatchObject({ import_session_id: "import-9" });
    const key = (copies[0].payload as { session: string }).session;
    expect(key.startsWith("typed-")).toBe(true);
    expect((draftRow()?.making as { sessions_meta: Record<string, { contributor_id?: string }> }).sessions_meta[key].contributor_id).toBe("0a0a0a0a-0000-4000-8000-000000000009");
  });

  it("Collections lists the collection with how many of its items fit, and inserts them in order", async () => {
    await open();
    const dialog = await openWindow();
    fireEvent.click(within(dialog).getByRole("tab", { name: /Collections/ }));
    const row = (await rowsOf(dialog)).find((radio) => within(radio).queryByText("Sales prompts"));
    expect(row).toBeTruthy();
    expect(within(row as HTMLElement).getByText("2 items fit here")).toBeTruthy();
    fireEvent.click(row as HTMLElement);
    fireEvent.click(within(dialog).getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(positions().filter((r) => ["si-prompt", "si-agent"].includes((r.source_ref as { saved_item_id?: string } | null)?.saved_item_id ?? "")).length).toBe(2), { timeout: 30_000 });
    const added = positions().filter((r) => ["si-prompt", "si-agent"].includes((r.source_ref as { saved_item_id?: string } | null)?.saved_item_id ?? ""));
    expect(added.map((r) => (r.source_ref as { saved_item_id: string }).saved_item_id)).toEqual(["si-prompt", "si-agent"]);
    expect(await screen.findByText("Added 2 items from Library")).toBeTruthy();
  });

  it("inside a team lists agents only", async () => {
    await open();
    fireEvent.click(await screen.findByRole("button", { name: "Show agents" }, { timeout: 15_000 }));
    const ghost = await screen.findByRole("button", { name: "Add an agent from Library" }, { timeout: 15_000 });
    fireEvent.click(ghost);
    const dialog = await screen.findByRole("dialog", { name: "Add from Library" }, { timeout: 15_000 });
    expect(within(dialog).getByText(/agents fit here/)).toBeTruthy();
    expect(within(dialog).getByText("Sessions don't fit inside a team")).toBeTruthy();
    const titles = (await rowsOf(dialog)).map((radio) => within(radio).getAllByText(/./)[0].textContent);
    expect(titles).toEqual(["Research brief"]);
    await pick(dialog, "Research brief");
    fireEvent.click(within(dialog).getByRole("button", { name: "Insert" }));
    await waitFor(() => expect(positions().some((row) => row.parent_id === IDS.team && (row.source_ref as { saved_item_id?: string } | null)?.saved_item_id === "si-agent")).toBe(true), { timeout: 20_000 });
  });

  it("Escape closes the window and puts nothing in", async () => {
    await open();
    const before = positions().length;
    const dialog = await openWindow();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add from Library" })).toBeNull());
    expect(positions()).toHaveLength(before);
  });
});
