// CA-12 — the composer's sessions, mounted for real (SandboxPage behind supabase-js, only the network faked).
// Part 3: a new post already has Session 1, and the prompt box is Prompt 1 of it.
// Parts 4 and 5: sessions leave Add; "+ Add a session" lists every finished session; adding one makes every prompt a tile.

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

describe("CA-12 P3 · Session 1", () => {
  it("a new post shows Session 1 with no app chosen above the prompt box, and says neither 'Unknown tool' nor 'typed here'", async () => {
    mount("/compose/new");
    await field();
    expect(screen.getByRole("group", { name: "Session 1 · No app chosen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick an app for session 1" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Unknown tool|typed here/i);
  });

  it("the first prompt makes the draft with Session 1 in it, and goes into that session", async () => {
    mount("/compose/new");
    const box = await field();
    fireEvent.change(box, { target: { value: "Plan the launch email" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(tableRows("build_nodes").length).toBe(1), { timeout: 10_000 });
    const build = tableRows("builds").find((row) => row.title === "Untitled build" && row.status === "draft" && !String(row.id).startsWith("0d0d"));
    expect(build).toBeTruthy();
    const keys = Object.keys(sessionsMetaOf(build?.making));
    expect(keys).toHaveLength(1);
    expect(tableRows("build_nodes")[0].payload).toMatchObject({ text: "Plan the launch email", session: keys[0] });
    expect(tableRows("build_sessions").filter((row) => row.build_id === build?.id)).toEqual([expect.objectContaining({ session_key: keys[0], position: 0 })]);
  });

  it("an old draft with no sessions is left as it was: no Session 1 appears until something is added", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    expect(screen.queryByRole("group", { name: /^Session 1/ })).toBeNull();
    expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toEqual([]);
  });
});

const LONG = "0e0e0e0e-0000-4000-8000-000000000003";
const WAITING = "0e0e0e0e-0000-4000-8000-000000000001";
const IN_DRAFT_1 = "0e0e0e0e-0000-4000-8000-000000000002";

/** "Add a session", then "Add from your connected chats": the list. */
async function openRow() {
  fireEvent.click(await screen.findByTestId("add-session-row", undefined, { timeout: 10_000 }));
  fireEvent.click(await screen.findByRole("button", { name: /Add from your connected chats/ }));
  return screen.findByTestId("add-session-picker");
}

describe("CA-12 P4 · sessions leave Add; + Add a session", () => {
  it("the Add menu has no session items", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.keyDown(await screen.findByTestId("sandbox-add"), { key: "Enter" });
    const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent ?? "");
    expect(items).toHaveLength(9);
    expect(items.join(" ")).not.toMatch(/session/i);
  });

  it("the row lists every finished session, the expired one and the one in another draft included, with where each is", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    const picker = within(await openRow());
    const rows = picker.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
      "Claude Code, A waiting session., 9 Oct · 1 prompt",
      "Claude, A session in a draft., 8 Oct · 1 prompt, In 1 draft",
      "Claude Code, Prompt 1 of the long session., 1 Oct · 66 prompts",
    ]);
    expect(document.body.textContent).not.toMatch(/expired/i);
  });

  it("filters by app, date or first prompt", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    const picker = within(await openRow());
    fireEvent.change(picker.getByRole("searchbox", { name: "Search your sessions" }), { target: { value: "waiting" } });
    expect(picker.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(picker.getByRole("searchbox", { name: "Search your sessions" }), { target: { value: "zzz" } });
    expect(picker.getByText("No session matches.")).toBeTruthy();
  });

  it("says Adding… on the row at once on a new post whose draft is being made", async () => {
    mount("/compose/new", { delays: [{ method: "POST", path: /^\/rest\/v1\/builds(\?|$)/, delayMs: 1500 }] });
    await field();
    const picker = within(await openRow());
    fireEvent.click(picker.getAllByRole("listitem")[0]);
    expect((await screen.findByTestId("add-session-row")).textContent).toBe("Adding…");
  });

  it("a draft that cannot be made says so once", async () => {
    const said = vi.spyOn(toast, "error");
    mount("/compose/new", { faults: [{ method: "POST", path: /^\/rest\/v1\/builds(\?|$)/, answer: PG.rlsInsert("builds") }] });
    await field();
    fireEvent.click(within(await openRow()).getAllByRole("listitem")[0]);
    await waitFor(() => expect(said).toHaveBeenCalled(), { timeout: 5_000 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(said.mock.calls.map(([line]) => line)).toEqual(["Couldn't start your draft. Try again."]);
  });
});

describe("CA-12 P5 · adding a session", () => {
  it("on a new post, a 66-prompt session replaces the empty Session 1: 66 tiles in it, folded to its head", async () => {
    mount("/compose/new");
    await field();
    const picker = within(await openRow());
    fireEvent.click(picker.getByRole("listitem", { name: /66 prompts$/ }));

    await waitFor(() => expect(tableRows("build_nodes").length).toBe(66), { timeout: 15_000 });
    const build = tableRows("builds").find((row) => !String(row.id).startsWith("0d0d") && row.status === "draft");
    // Session 1 (made with the draft) is gone; the added session is the only one, marked, at position 0, and collapsed.
    expect(Object.keys(sessionsMetaOf(build?.making))).toEqual([LONG]);
    expect(tableRows("build_sessions").filter((row) => row.build_id === build?.id)).toEqual([
      expect.objectContaining({ session_key: LONG, import_id: LONG, position: 0, collapsed: true }),
    ]);
    const nodes = tableRows("build_nodes").filter((row) => row.build_id === build?.id);
    expect(nodes.map((row) => row.position)).toEqual(Array.from({ length: 66 }, (_, at) => at + 1));
    expect(nodes[0]).toMatchObject({ type: "prompt", payload: { text: "Prompt 1 of the long session." }, source_ref: { import_session_id: LONG, index: 1 } });
    // The import itself is not used up.
    expect(tableRows("import_sessions").find((row) => row.id === LONG)).toMatchObject({ status: "expired", build_id: null });

    // The page (CA-14 P3): a long session starts folded: its head with the count before the date, and nothing under it.
    expect(await screen.findByRole("button", { name: "Expand Session 1" }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.queryAllByTestId("step-card")).toHaveLength(0);
    expect(screen.getByTestId("session-count").textContent).toBe("66 tiles");
  });

  it("opening it draws every tile and keeps it open", async () => {
    mount("/compose/new");
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: /66 prompts$/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Expand Session 1" }, { timeout: 15_000 }));
    expect(await screen.findByRole("button", { name: "Collapse Session 1" })).toBeTruthy();
    expect(screen.getAllByTestId("step-card")).toHaveLength(66);
    // Open, the count is not drawn.
    expect(screen.queryByTestId("session-count")).toBeNull();
    await waitFor(() => expect(tableRows("build_sessions").find((row) => row.session_key === LONG)?.collapsed).toBe(false));
  });

  it("on a draft with a session, the added one is the next: Session 2, position 1, and the first is untouched", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    // Give the draft a first session to be before it: draft 3 has none, so add the waiting one, then the long one.
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await waitFor(() => expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toHaveLength(1), { timeout: 10_000 });
    await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 10_000 });
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: /66 prompts$/ }));
    await waitFor(() => expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toHaveLength(2), { timeout: 15_000 });
    expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT).map((row) => [row.session_key, row.position]).sort((a, b) => Number(a[1]) - Number(b[1]))).toEqual([
      [WAITING, 0],
      [LONG, 1],
    ]);
    expect(await screen.findByRole("group", { name: /^Session 2 · / })).toBeTruthy();
    expect(tableRows("build_nodes").filter((row) => row.build_id === DRAFT)).toHaveLength(67);
  });

  it("a session already in this draft shows In this draft and cannot be added again", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 10_000 });
    const again = within(await openRow()).getByRole("listitem", { name: /In this draft$/ }) as HTMLButtonElement;
    expect(again.disabled).toBe(true);
  });

  it("the same session in a second draft: each draft has its own tiles, and the import is untouched", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: /66 prompts$/ }));
    await waitFor(() => expect(tableRows("build_nodes").filter((row) => row.build_id === DRAFT)).toHaveLength(66), { timeout: 15_000 });
    cleanup();
    mount("/compose/0d0d0d0d-0000-4000-8000-000000000004", { keep: true });
    await field();
    const row = within(await openRow()).getByRole("listitem", { name: /66 prompts, In 1 draft$/ });
    fireEvent.click(row);
    await waitFor(() => expect(tableRows("build_nodes").filter((node) => node.build_id === "0d0d0d0d-0000-4000-8000-000000000004")).toHaveLength(66), { timeout: 15_000 });
    expect(tableRows("build_nodes").filter((node) => node.build_id === DRAFT)).toHaveLength(66);
  });

  it("Start a new session on a new post uses the empty Session 1: still one session, none added", async () => {
    mount("/compose/new");
    await field();
    fireEvent.click(await screen.findByTestId("add-session-row", undefined, { timeout: 10_000 }));
    fireEvent.click(await screen.findByRole("button", { name: /Start a new session/ }));
    await waitFor(() => expect(tableRows("builds").some((row) => !String(row.id).startsWith("0d0d") && row.status === "draft")).toBe(true), { timeout: 15_000 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(tableRows("build_sessions").filter((row) => !String(row.build_id).startsWith("0d0d"))).toHaveLength(1);
    expect(screen.getAllByTestId("session-head")).toHaveLength(1);
  });

  it("Start a new session adds an empty Session 2 at once: No app chosen, No tiles yet, kept in the table and the draft", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
    await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 10_000 });
    fireEvent.click(await screen.findByTestId("add-session-row"));
    fireEvent.click(await screen.findByRole("button", { name: /Start a new session/ }));
    expect(await screen.findByRole("group", { name: "Session 2 · No app chosen" }, { timeout: 10_000 })).toBeTruthy();
    expect(screen.getByText("No tiles yet")).toBeTruthy();
    await waitFor(() => expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toHaveLength(2), { timeout: 10_000 });
    const making = tableRows("builds").find((row) => row.id === DRAFT)?.making as { session_order?: string[] };
    expect(making.session_order).toHaveLength(2);
    expect(document.querySelector('[data-session-key][data-lit="true"]')).toBeTruthy();
  });

  it("works before the table is live: with no build_sessions the new session is kept in the draft alone", async () => {
    mount(`/compose/${DRAFT}`, { faults: [{ path: /^\/rest\/v1\/build_sessions/, answer: PG.missingTable("build_sessions") }] });
    await field();
    fireEvent.click(await screen.findByTestId("add-session-row", undefined, { timeout: 10_000 }));
    fireEvent.click(await screen.findByRole("button", { name: /Start a new session/ }));
    expect(await screen.findByRole("group", { name: "Session 1 · No app chosen" }, { timeout: 10_000 })).toBeTruthy();
    // An empty draft shows Session 1's prompt box open, as Prompt 1 of it.
    expect(await field()).toBeTruthy();
    expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toEqual([]);
  });
});
