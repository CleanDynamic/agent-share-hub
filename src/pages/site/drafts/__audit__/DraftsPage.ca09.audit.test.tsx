// CA-09 Part 4 — the Drafts page, mounted for real, with the live schema as it is tonight (types.ts at cc6cc8c: the
// 13 October tables plus builds.post_doc and profiles.colour_swatches, which is CA-08's REPO_SCHEMA), against a
// statement timeout and against each of its three reads failing alone.
//
// DraftsPage as shipped, App's QueryClient defaults (App.tsx:178-182). Only the network is fake
// (src/lib/build/__audit__/fakeSupabase.ts, copied from CA-08). The timings (8 s per refused read, two reads) are
// measured in the browser by docs/audits/ca-09/scripts/drafts.mjs.
//
// CA-10 FLIPPED THE EXPECTATIONS to the fixed behaviour: each panel has its own status, so a failing sessions read
// leaves the drafts on screen and says so in the Sessions panel only, with its code, and every failure is logged.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { isPermissionError } from "@/lib/errors/permission";
import { REPO_SCHEMA, requests, startAuditBackend, type Fault, type FaultAnswer } from "@/lib/build/__audit__/fakeSupabase";

import { DraftsPage } from "../DraftsPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** App.tsx's defaults, word for word. */
const appQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: (count, error) => count < 1 && !isPermissionError(error), staleTime: 30_000 } } });

/** What PostgREST answers when Postgres cancels a statement at statement_timeout (the authenticated role's 8 s). */
const TIMEOUT: FaultAnswer = { status: 500, body: { code: "57014", details: null, hint: null, message: "canceling statement due to statement timeout" } };

/** The two reads, by their requests (CA-12: one session library read; builds.ts:245-260). CA-12 removed the separate read of sessions already in a build. */
const WAITING = /^\/rest\/v1\/import_sessions\?.*status=in\.\(parsed,claimed,expired\)(&|$)/;
const DRAFTS = /^\/rest\/v1\/builds\?select=id,title,updated_at,session_count/;

function mount(faults: Fault[] = []) {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  startAuditBackend({ schema: REPO_SCHEMA, faults });
  render(
    <QueryClientProvider client={appQueryClient()}>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/drafts"]}>
          <AuthProvider>
            <ConnectorDialogProvider>
              <DraftsPage />
            </ConnectorDialogProvider>
          </AuthProvider>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
  return logged;
}

const appLines = (logged: ReturnType<typeof vi.spyOn>) => logged.mock.calls.filter(([first]) => typeof first === "string" && first.startsWith("[")).map(([first]) => String(first));
const sent = (pattern: RegExp) => requests().filter((r) => pattern.test(r.path)).map((r) => `${r.status}${r.code ? " " + r.code : ""}`);

const bothPanelsFailed = async () => {
  await waitFor(() => expect(screen.getAllByText("That didn't load.")).toHaveLength(2), { timeout: 20_000 });
  expect(screen.queryByText("Draft 1")).toBeNull();
};

/** Only the Sessions panel failed: the drafts are on screen. */
const sessionsPanelFailed = async () => {
  await waitFor(() => expect(screen.getAllByText("That didn't load.")).toHaveLength(1), { timeout: 20_000 });
  expect(screen.getByRole("status", { name: "Sessions" })).toBeTruthy();
  expect(screen.getByText("Draft 1")).toBeTruthy();
};

describe("CA-09 · the Drafts page on tonight's schema", () => {
  it("control: with post_doc and colour_swatches live, the fifteen drafts and the waiting session load", async () => {
    const logged = mount();
    expect(await screen.findByText("Draft 1")).toBeTruthy();
    expect(screen.getByText("Draft 15")).toBeTruthy();
    expect(screen.queryByText("That didn't load.")).toBeNull();
    expect(sent(DRAFTS)).toEqual(["200"]);
    expect(appLines(logged)).toEqual([]);
  });

  it("the waiting-sessions read times out (57014): only the Sessions panel says 'That didn't load.', the drafts show, and it is logged with its code", async () => {
    const logged = mount([{ method: "GET", path: WAITING, answer: TIMEOUT }]);
    await sessionsPanelFailed();
    expect(sent(DRAFTS)).toEqual(["200"]);
    // 57014 is not a permission error, so App's one retry sends it again: two 8 s statements on the live database.
    expect(sent(WAITING)).toEqual(["500 57014", "500 57014"]);
    expect(appLines(logged)).toEqual(["[Drafts] sessions read failed 57014 listLibrarySessions failed: canceling statement due to statement timeout"]);
  });

  it("the drafts read times out (57014): only the drafts panel fails, the sessions show", async () => {
    mount([{ method: "GET", path: DRAFTS, answer: TIMEOUT }]);
    await waitFor(() => expect(screen.getAllByText("That didn't load.")).toHaveLength(1), { timeout: 20_000 });
    expect(screen.getByRole("status", { name: "Continue editing" })).toBeTruthy();
    expect(screen.getByText("A waiting session.")).toBeTruthy();
    expect(sent(DRAFTS)).toEqual(["500 57014", "500 57014"]);
    expect(sent(WAITING)[0]).toBe("200");
  });

  it("both reads time out: both panels fail", async () => {
    mount([
      { method: "GET", path: WAITING, answer: TIMEOUT },
      { method: "GET", path: DRAFTS, answer: TIMEOUT },
    ]);
    await bothPanelsFailed();
  });

  it("the waiting read times out once, then answers: the drafts show at once, the sessions after App's retry", async () => {
    mount([{ method: "GET", path: WAITING, answer: TIMEOUT, times: 1 }]);
    expect(await screen.findByText("Draft 1", undefined, { timeout: 5_000 })).toBeTruthy();
    expect(await screen.findByText("A waiting session.", undefined, { timeout: 5_000 })).toBeTruthy();
    expect(sent(WAITING)).toEqual(["500 57014", "200"]);
  });
});
