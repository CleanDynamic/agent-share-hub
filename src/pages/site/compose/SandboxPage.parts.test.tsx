// CA-17 P2 — parts, mounted for real (SandboxPage behind supabase-js, only the network faked): Add a part, moving sessions between parts, Same stage, Remove part, Label parts.

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
import { partLabelsOf, sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";

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


type Making = { session_order?: string[]; workstreams?: { key: string; name?: string }[]; part_labels?: string };
const making = () => (draftRow()?.making ?? {}) as Making;
const positions = () =>
  tableRows("build_nodes")
    .filter((row) => row.build_id === DRAFT)
    .sort((a, b) => Number(a.position) - Number(b.position));

/** Two sessions, then "Add a part": the sessions are in Part 1 (nothing is written on them) and Part 2 is empty. */
async function twoParts() {
  await twoSessions();
  fireEvent.click(await screen.findByTestId("add-part-row"));
  await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making)).toHaveLength(2), { timeout: 15_000 });
  await screen.findAllByTestId("workstream-head", undefined, { timeout: 10_000 });
}

describe("CA-17 P2 · Add a part", () => {
  it("a build with one part has no head and no outline; Add a part is under Add a session", async () => {
    await twoSessions();
    expect(screen.queryByTestId("workstream-head")).toBeNull();
    expect(screen.getByTestId("add-session-row").nextElementSibling).toBe(screen.getByTestId("add-part-row"));
    expect(draftRow()?.making).not.toHaveProperty("workstreams");
  });

  it("from one writes two parts, the sessions stay where they are, and the new part reads 'No sessions yet'", async () => {
    await twoParts();
    const [first, second] = storedWorkstreamsOf(draftRow()?.making);
    expect(first.key).not.toBe(second.key);
    const entries = sessionsMetaOf(draftRow()?.making);
    expect(entries[WAITING]?.workstream).toBeUndefined();
    expect(entries[LONG]?.workstream).toBeUndefined();
    const heads = screen.getAllByTestId("workstream-head");
    expect(heads.map((head) => within(head).getByTestId("workstream-count").textContent)).toEqual(["2 sessions", "0 sessions"]);
    expect(screen.getByTestId("workstream-empty").textContent).toContain("No sessions yet");
    expect(screen.getByRole("button", { name: "+ Add a session to this part" })).toBeTruthy();
  });

  it("from many adds one at the end, up to 26", async () => {
    await twoParts();
    fireEvent.click(screen.getByTestId("add-part-row"));
    await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making)).toHaveLength(3), { timeout: 15_000 });
    expect(await screen.findAllByTestId("workstream-head")).toHaveLength(3);
  });
});

describe("CA-17 P2 · moving a session between parts", () => {
  it("Move to part… puts the session at the end of that part, writes the one order and restacks the tiles", async () => {
    await twoParts();
    const [, second] = storedWorkstreamsOf(draftRow()?.making);
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Move to part…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Part 2" }));
    await waitFor(() => expect(order()).toEqual([LONG, WAITING]), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.workstream).toBe(second.key);
    expect(making().session_order).toEqual([LONG, WAITING]);
    // The 66 tiles of the other session now come first.
    const tiles = positions();
    expect(tiles.slice(0, 66).every((row) => (row.source_ref as { import_session_id?: string }).import_session_id === LONG)).toBe(true);
    expect((await screen.findAllByText("Session 2 is now in Part 2.", undefined, { timeout: 10_000 })).length).toBeGreaterThan(0);
    // Numbered by the new order: the session that was Session 2 is Session 1, in Part 1.
    await waitFor(() => expect(within(screen.getAllByTestId("workstream-group")[0]).getByRole("group", { name: /^Session 1 · / })).toBeTruthy(), { timeout: 10_000 });
  });

  it("a session dropped on a part's head goes to the end of that part", async () => {
    await twoParts();
    const [, second] = storedWorkstreamsOf(draftRow()?.making);
    // dnd-kit's pointer sensor is not driven here; the drop handler is the same one Move to part… calls.
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Move to part…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Part 2" }));
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[LONG]?.workstream).toBe(second.key), { timeout: 15_000 });
    expect(order()).toEqual([WAITING, LONG]);
  });

  it("Same stage as the session above is a checkable row, off for a part's first session", async () => {
    await twoParts();
    fireEvent.click(screen.getByRole("button", { name: "Expand Session 2" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    expect((await screen.findByRole("menuitemcheckbox", { name: "Same stage as the session above" })).getAttribute("aria-disabled")).toBe("true");
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Same stage as the session above" }));
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[LONG]?.withAbove).toBe(true), { timeout: 15_000 });
    expect(await screen.findByTestId("same-stage-line", undefined, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByTestId("same-stage-line").textContent).toBe("Same stage as Session 1");
  });
});

describe("CA-17 P2 · removing a part", () => {
  it("asks first, then its sessions join the part above and nothing is lost", async () => {
    await twoParts();
    const [first, second] = storedWorkstreamsOf(draftRow()?.making);
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 2 options" }), { key: "Enter" });
    fireEvent.keyDown(await screen.findByRole("menuitem", { name: "Move to part…" }), { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Part 2" }));
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[LONG]?.workstream).toBe(second.key), { timeout: 15_000 });
    fireEvent.keyDown(screen.getByRole("button", { name: "Part 2 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove part…" }));
    const dialog = await screen.findByTestId("remove-workstream-dialog");
    expect(within(dialog).getByText("Remove Part 2?")).toBeTruthy();
    expect(within(dialog).getByText("Its 1 session joins Part 1.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making).map((part) => part.key)).toEqual([first.key]), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[LONG]?.workstream).toBe(first.key);
    expect(order()).toEqual([WAITING, LONG]);
    expect(positions()).toHaveLength(67);
    await waitFor(() => expect(screen.queryByTestId("workstream-head")).toBeNull(), { timeout: 10_000 });
  });
});

describe("CA-17 P2 · Label parts", () => {
  it("is in the View menu with two parts, and switches the whole build between 1, 2, 3 and A, B, C", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    expect(screen.queryByTestId("label-parts")).toBeNull();
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.click(await screen.findByTestId("add-part-row"));
    await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making)).toHaveLength(2), { timeout: 15_000 });
    expect(partLabelsOf(draftRow()?.making)).toBe("numbers");
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    const group = await screen.findByTestId("label-parts");
    fireEvent.click(within(group).getByRole("button", { name: "A, B, C" }));
    await waitFor(() => expect(partLabelsOf(draftRow()?.making)).toBe("letters"), { timeout: 15_000 });
    expect(await screen.findByRole("button", { name: "Part B options" })).toBeTruthy();
  });
});
