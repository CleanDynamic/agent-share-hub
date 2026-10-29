// SV-21 P3 — opening a session or a part as a request, mounted for real (SandboxPage behind supabase-js, only the network faked): the marks land in `making`, and survive the other writes.

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
import { sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";
import { openTargetsOf } from "@/lib/build/openTargets";

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


const WAITING = "0e0e0e0e-0000-4000-8000-000000000001";
const LONG = "0e0e0e0e-0000-4000-8000-000000000003";

/** CA-24 P2: an empty build offers its first session in "Add your first session"; one with sessions has the Add a session row. Either opens the same list. */
async function openRow() {
  await waitFor(() => expect(screen.queryByTestId("add-session-row") ?? screen.queryByTestId("empty-build-chats")).toBeTruthy(), { timeout: 10_000 });
  const panel = screen.queryByTestId("empty-build-chats");
  if (panel) {
    fireEvent.click(panel);
    return screen.findByTestId("add-session-picker");
  }
  fireEvent.click(screen.getByTestId("add-session-row"));
  fireEvent.click(await screen.findByRole("button", { name: /Add from your connected chats/ }));
  return screen.findByTestId("add-session-picker");
}

/** The page has loaded: the Add button is there (an empty build has no prompt box until Add › Prompt). */
const field = () => screen.findByTestId("sandbox-add", undefined, { timeout: 10_000 });


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

describe("SV-21 · opening as a request", () => {
  it("the ghost row marks the part with the problem, shows it, and takes it back", async () => {
    await twoParts();
    const [first] = storedWorkstreamsOf(draftRow()?.making);
    fireEvent.click(await screen.findByRole("button", { name: "Ask for the next session in Part 1" }));
    const dialog = await screen.findByTestId("open-request-dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "What do you want?" }), { target: { value: "Add the onboarding session" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Open request" }));
    await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making)[0].open).toEqual({ problem: "Add the onboarding session" }), { timeout: 15_000 });
    expect(openTargetsOf(draftRow()?.making)).toEqual([{ size: "part", key: first.key, problem: "Add the onboarding session" }]);
    const row = (await screen.findAllByTestId("ask-next-session"))[0];
    await waitFor(() => expect(row.textContent).toContain("Asking for the next session: Add the onboarding session"), { timeout: 10_000 });
    fireEvent.click(within(row).getByRole("button", { name: "Take it back: Part 1" }));
    await waitFor(() => expect(storedWorkstreamsOf(draftRow()?.making)[0].open).toBeUndefined(), { timeout: 15_000 });
    expect(openTargetsOf(draftRow()?.making)).toEqual([]);
  });

  it("a session's menu marks the session; a title written after it keeps the mark", async () => {
    await twoSessions();
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Open as a request…" }));
    const dialog = await screen.findByTestId("open-request-dialog");
    fireEvent.change(within(dialog).getByRole("textbox", { name: "What do you want?" }), { target: { value: "Deploy the worker" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Open request" }));
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.open).toEqual({ problem: "Deploy the worker" }), { timeout: 15_000 });
    const head = await screen.findByRole("group", { name: /^Session 1 · / });
    expect(await within(head).findByTestId("session-open-request", undefined, { timeout: 10_000 })).toBeTruthy();
    const title = within(head).getByRole("textbox", { name: "Title of Session 1" });
    act(() => title.focus());
    fireEvent.change(title, { target: { value: "Worker" } });
    fireEvent.keyDown(title, { key: "Enter" });
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.title).toBe("Worker"), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.open).toEqual({ problem: "Deploy the worker" });
    // Taken back from the same menu.
    fireEvent.keyDown(screen.getByRole("button", { name: "Session 1 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Take the request back" }));
    await waitFor(() => expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.open).toBeUndefined(), { timeout: 15_000 });
    expect(sessionsMetaOf(draftRow()?.making)[WAITING]?.title).toBe("Worker");
  });
});
