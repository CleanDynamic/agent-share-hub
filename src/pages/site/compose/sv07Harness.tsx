// SV-07: the composer on a new post, behind supabase-js with only the network faked (`fakeSupabase.ts`), and the List sampled on
// every animation frame. The test that uses it mocks `@/integrations/supabase/client` with the fake's `clientModule`.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, vi } from "vitest";
import { Toaster } from "sonner";

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend, tableRows, type Delay, type Row } from "@/lib/build/__audit__/fakeSupabase";
import { storedWorkstreamsOf } from "@/lib/build/making";

import { SandboxPage } from "./SandboxPage";
import { FIRST_SESSION_KEY } from "./sourcesModel";

/** The chats the maker adds, one prompt each, besides the backend's own. */
export const CHATS = ["Poster", "Menu", "Prices", "Hours", "Signs", "Flyer"].map((name, at) => ({ id: `0e0e0e0e-0000-4000-8000-0000000001${String(at).padStart(2, "0")}`, name }));

/** One sample of the List: every session drawn, in order, with its part and number. */
export interface Sample {
  at: number;
  /** The maker actions before this sample. */
  actions: number;
  /** What the last maker action was. */
  action: string;
  sessions: { key: string; part: string; number: number | null }[];
}

/** The sessions the List draws now. A held copy that is hidden is not drawn. */
export function sampleList(): Sample["sessions"] {
  const root = document.querySelector('[data-testid="build-list"]') ?? document.body;
  return [...root.querySelectorAll<HTMLElement>('[data-skel-kind="session"]')]
    .filter((element) => element.style.visibility !== "hidden" && !element.closest('[aria-hidden="true"]'))
    .map((element) => {
      const name = element.getAttribute("data-skel-name") ?? element.querySelector('[role="group"][aria-label^="Session "]')?.getAttribute("aria-label") ?? "";
      const number = /Session (\d+)/.exec(name);
      return { key: element.getAttribute("data-skel-id") ?? "", part: element.getAttribute("data-skel-container") ?? "", number: number ? Number(number[1]) : null };
    });
}

/** Every fault the recording showed, in the samples. Empty when the replay is steady. */
export function faultsIn(samples: readonly Sample[]): string[] {
  const faults = new Set<string>();
  const layout = (sample: Sample) => sample.sessions.map((session) => `${session.key}@${session.part}`).join(",");
  let seen: string[] = [];
  for (let at = 0; at < samples.length; at += 1) {
    const sample = samples[at];
    const keys = sample.sessions.map((session) => session.key);
    if (new Set(keys).size !== keys.length) faults.add(`a key drawn twice (after "${sample.action}")`);
    if (keys.includes(FIRST_SESSION_KEY) && keys.length > 1) faults.add(`the placeholder drawn next to another session (after "${sample.action}")`);
    const before = samples[at - 1];
    if (!before || before.actions !== sample.actions) {
      seen = [layout(sample)];
      continue;
    }
    const now = layout(sample);
    if (now !== seen[seen.length - 1]) {
      if (seen.includes(now)) faults.add(`a layout that came back with no maker action (after "${sample.action}")`);
      seen.push(now);
    }
    for (const session of sample.sessions) {
      const was = before.sessions.find((candidate) => candidate.key === session.key);
      if (!was) continue;
      // Adding the first part puts every session into it: that one change is the maker's.
      if (was.part !== session.part && !(sample.action === "Add a part" && was.part === "")) faults.add(`a session's part changed with no maker action (after "${sample.action}")`);
      if (was.number !== null && session.number !== null && was.number !== session.number) faults.add(`a number changed with no maker action (after "${sample.action}")`);
    }
  }
  return [...faults];
}

export function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}

/** A small, fixed sequence of numbers, so the replay's delays are the same every run. */
function delays(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return 100 + (state % 700);
  };
}

/** Every write takes 100 to 800 ms; reads of the build are answered with the data as it was when they were asked, later. */
export function slowBackend(): Delay[] {
  const next = delays(7);
  const slow = (method: string, path: RegExp, stale = false): Delay => ({ method, path, stale, get delayMs() { return next(); } });
  return [
    slow("PATCH", /^\/rest\/v1\//),
    slow("POST", /^\/rest\/v1\/(?!rpc)/),
    slow("DELETE", /^\/rest\/v1\//),
    slow("GET", /^\/rest\/v1\/(builds|build_nodes|build_sessions)\?/, true),
  ];
}

export function seed(rows: Record<string, Row[]>) {
  const template = rows.import_sessions[0];
  for (const chat of CHATS) {
    const proposal = JSON.parse(JSON.stringify(template.proposal)) as { events: { payload: { text: string }; source_ref: { session_id: string } }[]; summary: { session_id: string } };
    proposal.events[0].payload.text = `Make the ${chat.name.toLowerCase()} for the bakery.`;
    proposal.events[0].source_ref.session_id = chat.id;
    proposal.summary.session_id = chat.id;
    rows.import_sessions.push({ ...template, id: chat.id, client: "claude", status: "parsed", proposal, created_at: "2026-10-10T10:00:00Z" });
  }
}

export const samples: Sample[] = [];
let actions = 0;
let action = "open";
let sampling = 0;

export function startSampling() {
  const read = () => {
    samples.push({ at: performance.now(), actions, action, sessions: sampleList() });
    sampling = window.requestAnimationFrame(read);
  };
  sampling = window.requestAnimationFrame(read);
}

/** A maker action: what it is, so a change after it is the maker's. */
export function maker(name: string, run: () => void) {
  actions += 1;
  action = name;
  act(() => run());
}

/** Before each test: a wide window, the page's scrolls stubbed, nothing sampled yet. */
export function setUp() {
  window.localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation((...args) => {
    if (process.env.DBG) process.stdout.write(`ERR ${args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(" ").slice(0, 300)}\n`);
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  stubWidth(1280);
  samples.length = 0;
  actions = 0;
  action = "open";
}

/** After each test: sampling stops and the page goes. */
export function tearDown() {
  window.cancelAnimationFrame(sampling);
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
}

/** With DBG set, each layout the List drew, once, by the maker action it followed. */
export function printLayouts() {
  if (!process.env.DBG) return;
  const short = (key: string) => (key === FIRST_SESSION_KEY ? "FIRST" : key.slice(-4));
  const parts = new Map<string, string>();
  const partName = (key: string) => (key ? (parts.get(key) ?? (parts.set(key, `P${parts.size + 1}`), parts.get(key))) : "-");
  let last = "";
  for (const sample of samples) {
    const line = `${sample.actions}:${sample.action} | ${sample.sessions.map((session) => `${short(session.key)}@${partName(session.part)}#${session.number}`).join(" ")}`;
    if (line !== last) process.stdout.write(`LAYOUT ${Math.round(sample.at)} ${line}\n`);
    last = line;
  }
}

/** The composer on a new post, on the faked backend: slow writes and stale reads unless `delays` says otherwise. */
export function mount(delays: Delay[] = slowBackend()) {
  startAuditBackend({ schema: REPO_SCHEMA, delays, seed });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  render(
    <MemoryRouter initialEntries={["/compose/new"]}>
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

export const draft = () => tableRows("builds").find((row) => (row.making as { sessions_meta?: object } | null)?.sessions_meta && tableRows("build_nodes").some((node) => node.build_id === row.id));
export const making = () => draft()?.making;
export const partKeys = () => storedWorkstreamsOf(making()).map((part) => part.key);
/** `count` sessions are saved, none of them is still on its way, and the add rows can be used again. */
export const settled = (count: number) =>
  waitFor(
    () => {
      expect(((making() as { session_order?: unknown[] } | undefined)?.session_order ?? []).length).toBe(count);
      expect(screen.queryByTestId("arriving-session")).toBeNull();
      for (const row of screen.queryAllByTestId("add-session-row")) expect((row as HTMLButtonElement).disabled).toBe(false);
    },
    { timeout: 30_000 },
  );

/** A chat by its name, from a picker that is open. */
export async function pickChat(name: string) {
  const picker = await screen.findByTestId("add-session-picker", undefined, { timeout: 10_000 });
  const row = await waitFor(() => {
    const found = within(picker).getAllByRole("listitem").find((item) => (item.getAttribute("aria-label") ?? "").includes(name.toLowerCase()));
    if (!found) throw new Error(`no row for ${name}`);
    return found;
  }, { timeout: 10_000 });
  maker(`add ${name}`, () => fireEvent.click(row));
}

/** Add a session › Add to · `part` › Add from your connected chats › the chat. */
export async function addChatTo(part: string, name: string) {
  if (!screen.queryByTestId("add-to-button")) fireEvent.click(screen.getByTestId("add-session-row"));
  const button = await screen.findByTestId("add-to-button");
  fireEvent.pointerDown(button, { button: 0, ctrlKey: false });
  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(part) }));
  fireEvent.click(screen.getByRole("button", { name: /Add from your connected chats/ }));
  await pickChat(name);
}
