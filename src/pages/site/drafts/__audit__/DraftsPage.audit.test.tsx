// CA-08 Part 3 — the Drafts page, mounted for real, against each failure.
//
// DraftsPage as shipped, with the app's QueryClient defaults (App.tsx:178-182) and the provider SiteFrame mounts
// for it. Only the network is fake (src/lib/build/__audit__/fakeSupabase.ts). Each test asserts what the maker sees
// today, and where (if anywhere) the cause was written down.

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { isPermissionError } from "@/lib/errors/permission";
import { LIVE_SCHEMA, PG, REPO_SCHEMA, requests, startAuditBackend, without, type Fault, type Row, type Schema } from "@/lib/build/__audit__/fakeSupabase";

import { DraftsPage } from "../DraftsPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** App.tsx:178-182, word for word. */
const appQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: (count, error) => count < 1 && !isPermissionError(error) } } });

function mount(options: { schema?: Schema; faults?: Fault[]; signedIn?: boolean; seed?: (rows: Record<string, Row[]>) => void } = {}) {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  startAuditBackend(options);
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

/** Anything the app itself wrote to the console: its lines start "[". */
const appLines = (logged: ReturnType<typeof vi.spyOn>) => logged.mock.calls.filter(([first]) => typeof first === "string" && first.startsWith("[")).map(([first]) => String(first));

const failedTwice = async () => {
  // DraftsPage's status is one for the page (DraftsPage.tsx:118-119), so both panels say it.
  await waitFor(() => expect(screen.getAllByText("That didn't load.")).toHaveLength(2), { timeout: 30_000 });
  expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(2);
  expect(screen.queryByText("Draft 1")).toBeNull();
};

describe("CA-08 · the Drafts page (DraftsPage, real)", () => {
  it("control, every migration applied: fifteen drafts and the waiting session", async () => {
    const logged = mount({ schema: REPO_SCHEMA });
    expect(await screen.findByText("Draft 1")).toBeTruthy();
    expect(screen.getByText("Draft 15")).toBeTruthy();
    expect(screen.queryByText("That didn't load.")).toBeNull();
    expect(appLines(logged)).toEqual([]);
  });

  it("the live database without builds.post_doc: 'That didn't load.' in BOTH panels, and nothing in the console", async () => {
    const logged = mount({ schema: LIVE_SCHEMA });
    await failedTwice();
    // The Sessions read worked; the page still shows it as failed, because one status covers both.
    expect(requests().some((r) => r.path.startsWith("/rest/v1/import_sessions") && r.status === 200)).toBe(true);
    // The drafts read was sent twice (App.tsx's one retry), and both answers were 400 42703.
    const reads = requests().filter((r) => r.path.startsWith("/rest/v1/builds?select=id,creator_id"));
    expect(reads.map((r) => `${r.status} ${r.code}`)).toEqual(["400 42703", "400 42703"]);
    // Neither the page, ErrorState (given no error) nor TanStack Query v5 logs it: only the Network tab has it.
    expect(appLines(logged)).toEqual([]);
  });

  it("without session_count (the columns of 20261001280000): the same two failures", async () => {
    mount({ schema: without(REPO_SCHEMA, "builds", "session_count") });
    await failedTwice();
  });

  it("42883, a function the builds policy calls is missing: the same two failures", async () => {
    mount({ faults: [{ method: "GET", path: /^\/rest\/v1\/builds/, answer: PG.missingFunction("public.is_admin(uuid)") }] });
    await failedTwice();
  });

  it("only the Sessions read failing (import_sessions refused) still blanks the drafts that loaded", async () => {
    mount({ faults: [{ method: "GET", path: /^\/rest\/v1\/import_sessions/, answer: { status: 403, body: { code: "42501", details: null, hint: null, message: "permission denied for table import_sessions" } } }] });
    await failedTwice();
    expect(requests().some((r) => r.path.startsWith("/rest/v1/builds?select=id,creator_id") && r.status === 200)).toBe(true);
  });

  it("no session: the drafts read asks nothing and returns [], the Sessions read is refused for anon, the page says it did not load", async () => {
    mount({ signedIn: false });
    await failedTwice();
    expect(requests().some((r) => r.path.startsWith("/rest/v1/builds"))).toBe(false);
    // A refusal is not retried (App.tsx:180): one request.
    expect(requests().filter((r) => r.path.startsWith("/rest/v1/import_sessions?select=id,client") && r.path.includes("status=in.(parsed)")).map((r) => `${r.status} ${r.code}`)).toEqual(["401 42501"]);
  });

  it("drafts RLS will not show (another account's session in the tab): 'Nothing in progress.', said as if there were none", async () => {
    mount({ seed: (rows) => rows.builds.forEach((row) => void (row.creator_id = "0b0b0b0b-0000-4000-8000-0000000000ff")) });
    expect(await screen.findByText("Nothing in progress.")).toBeTruthy();
    expect(screen.queryByText("That didn't load.")).toBeNull();
  });

  it(
    "a lost network: postgrest-js retries the read three times and TanStack once more, so the skeleton stays about 15 s",
    async () => {
      const started = Date.now();
      mount({ faults: [{ method: "GET", path: /^\/rest\/v1\/builds/, answer: "network" }] });
      await failedTwice();
      expect(Date.now() - started).toBeGreaterThanOrEqual(14_000);
      expect(requests().filter((r) => r.path.startsWith("/rest/v1/builds")).length).toBe(8);
    },
    40_000,
  );
});
