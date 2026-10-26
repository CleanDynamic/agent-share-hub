// SV-07 P0: the screen recording, replayed on the real page (SandboxPage behind supabase-js, only the network faked). Writes are
// slow (100 to 800 ms) and come back out of order, and refetches of the build can answer with data older than the page holds. The
// List is sampled on every animation frame, and each sample is checked against the recording's faults: a key drawn twice, the
// empty Session 1 drawn beside another session, a layout that comes back with no maker action (A, B, A), and a session whose part
// or number changes with no maker action.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend, tableRows, type Delay, type Row } from "@/lib/build/__audit__/fakeSupabase";
import { sessionsMetaOf, storedWorkstreamsOf } from "@/lib/build/making";
import { Toaster } from "sonner";

import { SandboxPage } from "./SandboxPage";
import { FIRST_SESSION_KEY } from "./sourcesModel";

vi.setConfig({ testTimeout: 240_000 });

/** The chats the maker adds, one prompt each, besides the backend's own. */
const CHATS = ["Poster", "Menu", "Prices", "Hours", "Signs", "Flyer"].map((name, at) => ({ id: `0e0e0e0e-0000-4000-8000-0000000001${String(at).padStart(2, "0")}`, name }));

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

function stubWidth(px: number) {
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
function slowBackend(): Delay[] {
  const next = delays(7);
  const slow = (method: string, path: RegExp, stale = false): Delay => ({ method, path, stale, get delayMs() { return next(); } });
  return [
    slow("PATCH", /^\/rest\/v1\//),
    slow("POST", /^\/rest\/v1\/(?!rpc)/),
    slow("DELETE", /^\/rest\/v1\//),
    slow("GET", /^\/rest\/v1\/(builds|build_nodes|build_sessions)\?/, true),
  ];
}

function seed(rows: Record<string, Row[]>) {
  const template = rows.import_sessions[0];
  for (const chat of CHATS) {
    const proposal = JSON.parse(JSON.stringify(template.proposal)) as { events: { payload: { text: string }; source_ref: { session_id: string } }[]; summary: { session_id: string } };
    proposal.events[0].payload.text = `Make the ${chat.name.toLowerCase()} for the bakery.`;
    proposal.events[0].source_ref.session_id = chat.id;
    proposal.summary.session_id = chat.id;
    rows.import_sessions.push({ ...template, id: chat.id, client: "claude", status: "parsed", proposal, created_at: "2026-10-10T10:00:00Z" });
  }
}

const samples: Sample[] = [];
let actions = 0;
let action = "open";
let sampling = 0;

function startSampling() {
  const read = () => {
    samples.push({ at: performance.now(), actions, action, sessions: sampleList() });
    sampling = window.requestAnimationFrame(read);
  };
  sampling = window.requestAnimationFrame(read);
}

/** A maker action: what it is, so a change after it is the maker's. */
function maker(name: string, run: () => void) {
  actions += 1;
  action = name;
  act(() => run());
}

beforeEach(() => {
  window.localStorage.clear();
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation((...args) => { if (process.env.DBG) process.stdout.write("ERR " + args.map((a) => (a instanceof Error ? a.message : String(a))).join(" ").slice(0, 300) + "\n"); });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  stubWidth(1280);
  samples.length = 0;
  actions = 0;
  action = "open";
});
afterEach(() => {
  if (process.env.DBG) process.stdout.write(`LAST ${action} · ${JSON.stringify(sampleList())} · ${screen.queryAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent).filter(Boolean).slice(0, 80).join(" | ")}\n`);
  window.cancelAnimationFrame(sampling);
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount() {
  startAuditBackend({ schema: REPO_SCHEMA, delays: slowBackend(), seed });
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

const draft = () => tableRows("builds").find((row) => (row.making as { sessions_meta?: object } | null)?.sessions_meta && tableRows("build_nodes").some((node) => node.build_id === row.id));
const making = () => draft()?.making;
const partKeys = () => storedWorkstreamsOf(making()).map((part) => part.key);
/** `count` sessions are saved, none of them is still on its way, and the add rows can be used again. */
const settled = (count: number) =>
  waitFor(
    () => {
      expect(((making() as { session_order?: unknown[] } | undefined)?.session_order ?? []).length).toBe(count);
      expect(screen.queryByTestId("arriving-session")).toBeNull();
      for (const row of screen.queryAllByTestId("add-session-row")) expect((row as HTMLButtonElement).disabled).toBe(false);
    },
    { timeout: 30_000 },
  );

/** A chat by its name, from a picker that is open. */
async function pickChat(name: string) {
  const picker = await screen.findByTestId("add-session-picker", undefined, { timeout: 10_000 });
  const row = await waitFor(() => {
    const found = within(picker).getAllByRole("listitem").find((item) => (item.getAttribute("aria-label") ?? "").includes(name.toLowerCase()));
    if (!found) throw new Error(`no row for ${name}`);
    return found;
  }, { timeout: 10_000 });
  maker(`add ${name}`, () => fireEvent.click(row));
}

/** Add a session › Add to · `part` › Add from your connected chats › the chat. */
async function addChatTo(part: string, name: string) {
  if (!screen.queryByTestId("add-to-button")) fireEvent.click(screen.getByTestId("add-session-row"));
  const button = await screen.findByTestId("add-to-button");
  fireEvent.pointerDown(button, { button: 0, ctrlKey: false });
  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: new RegExp(part) }));
  fireEvent.click(screen.getByRole("button", { name: /Add from your connected chats/ }));
  await pickChat(name);
}

describe("SV-07 P0 · the recorded sequence", () => {
  it("is steady: no key twice, no placeholder beside a session, no A-B-A, nothing moved or renumbered unasked", async () => {
    mount();
    startSampling();
    // 1, 2: a new draft, and a one-prompt chat imported from the empty build panel.
    maker("open the chats", () => fireEvent.click(screen.getByTestId("empty-build-chats")));
    await pickChat(CHATS[0].name);
    await settled(1);
    await waitFor(() => expect(draft()).toBeTruthy(), { timeout: 30_000 });

    // 3: Add a part, twice.
    maker("Add a part", () => fireEvent.click(screen.getByTestId("add-part-row")));
    await waitFor(() => expect(partKeys()).toHaveLength(2), { timeout: 30_000 }).catch((e) => { if (process.env.DBG) process.stdout.write("MAKING " + JSON.stringify(tableRows("builds").map((b) => [b.id, b.making])) + "\n"); throw e; });
    maker("Add a part", () => fireEvent.click(screen.getByTestId("add-part-row")));
    await waitFor(() => expect(partKeys()).toHaveLength(3), { timeout: 30_000 });

    // 4: Add a session › Start a new session (it goes to the last part).
    maker("open Add a session", () => fireEvent.click(screen.getByTestId("add-session-row")));
    maker("Start a new session", () => fireEvent.click(screen.getByRole("button", { name: /Start a new session/ })));
    await settled(2);

    // 5: a library chat into Part 2.
    await addChatTo("Part 2", CHATS[1].name);
    await settled(3);

    // 6: Part 2 closed, and another chat added to it.
    maker("Collapse Part 2", () => fireEvent.click(screen.getByRole("button", { name: "Collapse Part 2" })));
    await addChatTo("Part 2", CHATS[2].name);
    await settled(4);

    // 7: a chat into Part 3, and another straight after.
    await addChatTo("Part 3", CHATS[3].name);
    // Straight after: as soon as the row can be used again, while the first one's saves may still be going.
    await waitFor(() => expect((screen.getByTestId("add-session-row") as HTMLButtonElement).disabled).toBe(false), { timeout: 30_000 });
    await addChatTo("Part 3", CHATS[4].name);
    await settled(6);

    // 8: the session list on, and a jump to a session in the closed Part 2.
    fireEvent.keyDown(screen.getByTestId("sandbox-view"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: /Session list/ }));
    const chips = await screen.findAllByRole("button", { name: /^\d+ / });
    maker("jump to Session 2", () => fireEvent.click(chips[1]));
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(faultsIn(samples)).toEqual([]);
    // Every session is saved in the part it was added to: Part 1 holds the import, Part 2 two chats, Part 3 the new session and two chats.
    const [first, second, third] = partKeys();
    const inPart = (part: string) => Object.values(sessionsMetaOf(making())).filter((meta) => meta.workstream === part).length;
    expect([inPart(first), inPart(second), inPart(third)]).toEqual([1, 2, 3]);
  });
});
