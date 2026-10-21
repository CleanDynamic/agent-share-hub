// CA-10 Part 1 — the Drafts page, mounted for real behind supabase-js, with only the network faked (CA-08's fake,
// src/lib/build/__audit__/fakeSupabase.ts). Each panel has its own status: the drafts show the moment their read
// answers, whatever the sessions read is doing, and a failure says so in its own panel, with its code, and is logged
// as one line.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { isPermissionError } from "@/lib/errors/permission";
import { REPO_SCHEMA, requests, startAuditBackend, type Delay, type Fault, type FaultAnswer } from "@/lib/build/__audit__/fakeSupabase";

import { DraftsPage } from "./DraftsPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** App.tsx's defaults. */
const appQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: (count, error) => count < 1 && !isPermissionError(error), staleTime: 30_000 } } });

const TIMEOUT: FaultAnswer = { status: 500, body: { code: "57014", details: null, hint: null, message: "canceling statement due to statement timeout" } };

const WAITING = /^\/rest\/v1\/import_sessions\?.*status=in\.\(parsed,claimed,expired\)(&|$)/;
const DRAFTS = /^\/rest\/v1\/builds\?select=id,creator_id/;

function mount({ faults = [], delays = [] }: { faults?: Fault[]; delays?: Delay[] } = {}) {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  startAuditBackend({ schema: REPO_SCHEMA, faults, delays });
  render(
    <QueryClientProvider client={appQueryClient()}>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/drafts"]}>
          <ConnectorDialogProvider>
            <DraftsPage />
          </ConnectorDialogProvider>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
  return logged;
}

const lines = (logged: ReturnType<typeof vi.spyOn>) =>
  logged.mock.calls.map(([first]) => first).filter((first): first is string => typeof first === "string" && first.startsWith("[Drafts]"));
const sent = (pattern: RegExp) => requests().filter((r) => pattern.test(r.path)).length;
const panel = (name: string) => screen.getByRole("status", { name });

describe("CA-10 · the Drafts page, one status per panel", () => {
  it("shows the drafts while the sessions read is 6 s slow", async () => {
    mount({ delays: [{ method: "GET", path: WAITING, delayMs: 6_000 }] });
    expect(await screen.findByText("Draft 1", undefined, { timeout: 2_000 })).toBeTruthy();
    expect(screen.getByText("Loading your sessions")).toBeTruthy();
    expect(screen.queryByText("That didn't load.")).toBeNull();
  });

  it("shows the drafts while the sessions read fails with 57014; the error is in the Sessions panel only, with its code, logged once", async () => {
    const logged = mount({ faults: [{ method: "GET", path: WAITING, answer: TIMEOUT }] });
    expect(await screen.findByText("Draft 1")).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText("That didn't load.")).toHaveLength(1), { timeout: 5_000 });
    expect(within(panel("Sessions")).getByText("Code 57014")).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Continue editing" })).toBeNull();
    expect(screen.getByText("Draft 15")).toBeTruthy();
    expect(lines(logged)).toEqual(["[Drafts] sessions read failed 57014 listLibrarySessions failed: canceling statement due to statement timeout"]);
  });

  it("both panels failing: each says so, with its code", async () => {
    const logged = mount({ faults: [{ method: "GET", path: WAITING, answer: TIMEOUT }, { method: "GET", path: DRAFTS, answer: TIMEOUT }] });
    await waitFor(() => expect(screen.getAllByText("That didn't load.")).toHaveLength(2), { timeout: 5_000 });
    expect(within(panel("Continue editing")).getByText("Code 57014")).toBeTruthy();
    expect(within(panel("Sessions")).getByText("Code 57014")).toBeTruthy();
    const said = lines(logged);
    expect(said.filter((line) => line.startsWith("[Drafts] drafts read failed 57014 "))).toHaveLength(1);
    expect(said.filter((line) => line.startsWith("[Drafts] sessions read failed 57014 "))).toHaveLength(1);
  });

  it("the drafts read failing shows its code in its own panel, and the sessions still show", async () => {
    mount({ faults: [{ method: "GET", path: DRAFTS, answer: TIMEOUT }] });
    await waitFor(() => expect(within(panel("Continue editing")).getByText("Code 57014")).toBeTruthy(), { timeout: 5_000 });
    expect(screen.getAllByText("That didn't load.")).toHaveLength(1);
    expect(screen.getByText("A waiting session.")).toBeTruthy();
  });

  it("retrying one panel retries only that read", async () => {
    // The first read and App's one retry fail; Try again then answers.
    mount({ faults: [{ method: "GET", path: WAITING, answer: TIMEOUT, times: 2 }] });
    expect(await screen.findByText("Draft 1")).toBeTruthy();
    await waitFor(() => expect(panel("Sessions")).toBeTruthy(), { timeout: 5_000 });
    const drafts = sent(DRAFTS);
    const waiting = sent(WAITING);
    fireEvent.click(within(panel("Sessions")).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("A waiting session.")).toBeTruthy();
    expect(sent(WAITING)).toBe(waiting + 1);
    expect(sent(DRAFTS)).toBe(drafts);
    expect(screen.queryByText("That didn't load.")).toBeNull();
  });
});
