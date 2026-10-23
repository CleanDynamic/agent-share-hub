// CA-20: the composer mounted for real (SandboxPage behind supabase-js, only the network faked), shared by the CA-20 test files.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend, tableRows, type Delay, type Fault } from "@/lib/build/__audit__/fakeSupabase";
import { Toaster } from "sonner";

import { SandboxPage } from "./SandboxPage";

export const DRAFT = "0d0d0d0d-0000-4000-8000-000000000003";
export const WAITING = "0e0e0e0e-0000-4000-8000-000000000001";
export const LONG = "0e0e0e0e-0000-4000-8000-000000000003";

export function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}

/** Call from beforeEach. */
export function harnessBefore() {
  window.localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (process.env.DBG) process.stdout.write("ERR " + args.map((a) => (a instanceof Error ? a.message : JSON.stringify(a))).join(" ") + "\n");
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  stubWidth(1280);
}

/** Call from afterEach. */
export function harnessAfter() {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

export function mount(path: string, { faults = [], delays = [], keep = false, seed }: { faults?: Fault[]; delays?: Delay[]; keep?: boolean; seed?: (rows: Record<string, Record<string, unknown>[]>) => void } = {}) {
  if (!keep) startAuditBackend({ schema: REPO_SCHEMA, faults, delays, seed });
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

export const field = () => screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });

/** "Add a session", then "Add from your connected chats": the list. */
export async function openRow() {
  fireEvent.click(await screen.findByTestId("add-session-row", undefined, { timeout: 10_000 }));
  fireEvent.click(await screen.findByRole("button", { name: /Add from your connected chats/ }));
  return screen.findByTestId("add-session-picker");
}

/** The draft with Session 1 = the one-prompt session only. */
export async function oneSession(options: Parameters<typeof mount>[1] = {}) {
  mount(`/compose/${DRAFT}`, options);
  await field();
  fireEvent.click(within(await openRow()).getByRole("listitem", { name: / 1 prompt$/ }));
  await waitFor(() => expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toHaveLength(1), { timeout: 10_000 });
  await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 10_000 });
}

/** The draft with Session 1 = the one-prompt session and Session 2 = the 66-prompt one (folded). */
export async function twoSessions(options: Parameters<typeof mount>[1] = {}) {
  await oneSession(options);
  fireEvent.click(within(await openRow()).getByRole("listitem", { name: /66 prompts$/ }));
  await waitFor(() => expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toHaveLength(2), { timeout: 15_000 });
  await screen.findByRole("group", { name: /^Session 2 · / }, { timeout: 10_000 });
}

export const draftRow = () => tableRows("builds").find((row) => row.id === DRAFT);
export const sessionsOf = () => tableRows("build_sessions").filter((row) => row.build_id === DRAFT);
export const order = () =>
  sessionsOf()
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => row.session_key);
export const positions = () =>
  tableRows("build_nodes")
    .filter((row) => row.build_id === DRAFT)
    .sort((a, b) => Number(a.position) - Number(b.position));

/** The text a control is described by (`aria-describedby`). */
export const describedBy = (element: HTMLElement): string =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();

/** The CA-20 draft (see ca20Fixture.ts), mounted and loaded. */
export async function mountCa20(seed: (rows: Record<string, Record<string, unknown>[]>) => void, options: Parameters<typeof mount>[1] & { wide?: boolean } = {}) {
  // `wide`: a window wide enough for Sources to stand beside the build (a click on a tile then opens Details beside it, which jsdom's layout cannot measure).
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: options.wide ? 1600 : 1024 });
  mount(`/compose/${DRAFT}`, { ...options, seed });
  await screen.findByRole("group", { name: /^Session 1 · / }, { timeout: 15_000 });
}

/** A node's row, as the table holds it now. */
export const nodeRow = (id: string) => tableRows("build_nodes").find((row) => row.id === id);
