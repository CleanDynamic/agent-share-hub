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
import { toast } from "sonner";
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

async function openRow() {
  fireEvent.click(await screen.findByTestId("add-session-row", undefined, { timeout: 10_000 }));
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
