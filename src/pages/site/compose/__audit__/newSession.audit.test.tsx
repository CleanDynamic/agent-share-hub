// CA-08 Part 3 — Add › New session on a new post, with the real SandboxPage, against each failure.
//
// Mounted as App.tsx mounts it: /compose with the children `new` and `:buildId` (App.tsx:527-530), the real
// AuthProvider, the app's QueryClient defaults (App.tsx:178-182) and sonner's real Toaster. Only the network is fake
// (src/lib/build/__audit__/fakeSupabase.ts), so `onNewSession` (SandboxPage.tsx:431-445) runs ensureBuild ->
// createBuild, setSessionMeta and refreshRecord exactly as shipped. Each test asserts what the maker sees today.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { CrumbTitleProvider } from "@/components/shell/useBreadcrumb";
import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { clearNodeTypeCache } from "@/lib/build/nodeTypes";
import { isPermissionError } from "@/lib/errors/permission";
import { LIVE_SCHEMA, MAKER_ID, PG, REPO_SCHEMA, requests, startAuditBackend, tableRows, type Fault, type Schema } from "@/lib/build/__audit__/fakeSupabase";

import SandboxPage from "../SandboxPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  clearNodeTypeCache();
});

/** App.tsx:178-182, word for word: one retry, none for a refusal. */
const appQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: (count, error) => count < 1 && !isPermissionError(error) } } });

let where = "";
function Where() {
  where = useLocation().pathname;
  return null;
}

function mount({ schema = REPO_SCHEMA, faults = [], signedIn = true, at = "/compose/new" }: { schema?: Schema; faults?: Fault[]; signedIn?: boolean; at?: string } = {}) {
  const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  startAuditBackend({ schema, faults, signedIn });
  render(
    <QueryClientProvider client={appQueryClient()}>
      <HelmetProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[at]}>
            <CrumbTitleProvider>
              <ConnectorDialogProvider>
                <Routes>
                  <Route
                    path="/compose"
                    element={
                      <>
                        <SandboxPage />
                        <Where />
                      </>
                    }
                  >
                    <Route path="new" element={null} />
                    <Route path=":buildId" element={null} />
                  </Route>
                </Routes>
              </ConnectorDialogProvider>
            </CrumbTitleProvider>
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </HelmetProvider>
    </QueryClientProvider>,
  );
  return logged;
}

/** Add › New session › Add, with the dialog's tool left at "Typed here" (null), as the maker would. */
async function addNewSession() {
  fireEvent.keyDown(await screen.findByTestId("sandbox-add"), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: /^New session/ }));
  const dialog = await screen.findByTestId("add-session-dialog");
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Add" }));
  });
}

/** The toasts sonner is showing, front first, as the maker sees them. */
function toasts(): { text: string; front: boolean }[] {
  return [...document.querySelectorAll<HTMLElement>("[data-sonner-toast]")]
    .map((toast) => ({ text: toast.textContent ?? "", front: toast.getAttribute("data-front") === "true", index: Number(toast.getAttribute("data-index")) }))
    .sort((a, b) => a.index - b.index)
    .map(({ text, front }) => ({ text, front }));
}

/** The app's own console lines ("[Compose] …", "[Sandbox] …"), each with its cause's message and code. */
function appLines(logged: ReturnType<typeof vi.spyOn>): string[] {
  return logged.mock.calls
    .filter(([first]) => typeof first === "string" && first.startsWith("["))
    .map(([first, cause]) => {
      const error = cause as { message?: string; cause?: { code?: string } } | undefined;
      return `${String(first)} | ${error?.message ?? ""} | ${error?.cause?.code ?? ""}`;
    });
}

const drafts = () => tableRows("builds").filter((row) => row.status === "draft" && row.creator_id === MAKER_ID).length;

describe("CA-08 · Add › New session on /compose/new (SandboxPage, real)", () => {
  it("control, every migration applied: the draft is made, the address follows it, the session is saved, no toast", async () => {
    const logged = mount();
    await addNewSession();
    await waitFor(() => expect(where).toMatch(/^\/compose\/0c0c0c0c-/));
    await waitFor(() => expect(requests().some((r) => r.method === "PATCH" && r.status === 200)).toBe(true));
    expect(drafts()).toBe(16);
    const made = tableRows("builds").find((row) => `/compose/${String(row.id)}` === where);
    expect(Object.keys((made?.making as { sessions_meta?: object })?.sessions_meta ?? {})).toHaveLength(1);
    expect(toasts()).toEqual([]);
    expect(appLines(logged)).toEqual([]);
  });

  it("the live database without builds.post_doc: TWO toasts, the session one in front, and no draft", async () => {
    const logged = mount({ schema: LIVE_SCHEMA });
    await addNewSession();
    await waitFor(() => expect(toasts()).toHaveLength(2));
    expect(toasts()).toEqual([
      { text: "Couldn't make that session. Try again.", front: true },
      { text: "Couldn't start your draft. Try again.", front: false },
    ]);
    // The cause is kept in the console only, under two lines, the SQLSTATE in the cause's code.
    expect(appLines(logged)).toEqual([
      "[Compose] createBuild failed | createBuild failed: column builds.post_doc does not exist | 42703",
      "[Sandbox] session not made | createBuild failed: column builds.post_doc does not exist | 42703",
    ]);
    expect(where).toBe("/compose/new");
    expect(drafts()).toBe(15);
    // Every write the page sent (an RPC is a read here: gallery_facets, for the audience field).
    const write = requests().filter((r) => r.method !== "GET" && r.method !== "HEAD" && !r.path.startsWith("/rest/v1/rpc/"));
    expect(write.map((r) => `${r.method} ${r.path.split("?")[0]} ${r.status} ${r.code}`)).toEqual(["POST /rest/v1/builds 400 42703"]);
  });

  const sameAsCreate: { name: string; faults?: Fault[]; signedIn?: boolean; cause: string }[] = [
    { name: "42883, a function a builds policy calls is missing", faults: [{ path: /^\/rest\/v1\/builds/, answer: PG.missingFunction("public.is_admin(uuid)") }], cause: "createBuild failed: function public.is_admin(uuid) does not exist | 42883" },
    { name: "42501, the insert policy refuses", faults: [{ method: "POST", path: /^\/rest\/v1\/builds/, answer: PG.rlsInsert("builds") }], cause: 'createBuild failed: new row violates row-level security policy for table "builds" | 42501' },
    { name: "no session in the page (signed out under it)", signedIn: false, cause: "createBuild failed: no signed-in user | " },
    { name: "a network failure on the insert", faults: [{ method: "POST", path: /^\/rest\/v1\/builds/, answer: "network" }], cause: "createBuild failed: TypeError: Failed to fetch | " },
  ];
  for (const { name, faults, signedIn, cause } of sameAsCreate) {
    it(`${name}: the same two toasts, the session one in front, and no draft`, async () => {
      const logged = mount({ faults, signedIn });
      await addNewSession();
      await waitFor(() => expect(toasts()).toHaveLength(2));
      expect(toasts()[0]).toEqual({ text: "Couldn't make that session. Try again.", front: true });
      expect(toasts()[1].text).toBe("Couldn't start your draft. Try again.");
      expect(appLines(logged)).toEqual([`[Compose] createBuild failed | ${cause}`, `[Sandbox] session not made | ${cause}`]);
      expect(drafts()).toBe(15);
    });
  }

  it("23514 on the making write: ONE toast, and an empty draft is left behind (the build is made, the session is not)", async () => {
    const logged = mount({ faults: [{ method: "PATCH", path: /^\/rest\/v1\/builds/, answer: PG.check("builds", "builds_making_object_check") }] });
    await addNewSession();
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(toasts()).toEqual([{ text: "Couldn't make that session. Try again.", front: true }]);
    expect(appLines(logged)).toEqual(['[Sandbox] session not made | updateBuild failed: new row for relation "builds" violates check constraint "builds_making_object_check" | 23514']);
    expect(where).toMatch(/^\/compose\/0c0c0c0c-/);
    expect(drafts()).toBe(16);
  });

  it("zero rows updated: ONE toast, an empty draft left behind, PGRST116 in the console", async () => {
    const logged = mount({ faults: [{ method: "PATCH", path: /^\/rest\/v1\/builds/, answer: PG.zeroRows() }] });
    await addNewSession();
    await waitFor(() => expect(toasts()).toHaveLength(1));
    expect(appLines(logged)).toEqual(["[Sandbox] session not made | updateBuild failed: Cannot coerce the result to a single JSON object | PGRST116"]);
    expect(drafts()).toBe(16);
  });

  it("refreshRecord cannot throw: a failed re-read after the write shows no toast, and the session is saved but not drawn", async () => {
    // Every builds read after the insert fails; the insert and the PATCH succeed.
    const logged = mount({ faults: [{ method: "GET", path: /^\/rest\/v1\/builds\?select=id,creator_id/, answer: PG.missingFunction("public.is_admin(uuid)") }] });
    await addNewSession();
    await waitFor(() => expect(requests().some((r) => r.method === "PATCH" && r.status === 200)).toBe(true));
    await waitFor(() => expect(requests().filter((r) => r.method === "GET" && r.status === 404).length).toBeGreaterThan(0));
    expect(toasts()).toEqual([]);
    expect(appLines(logged)).toEqual([]);
    const made = tableRows("builds").find((row) => `/compose/${String(row.id)}` === where);
    expect(Object.keys((made?.making as { sessions_meta?: object })?.sessions_meta ?? {})).toHaveLength(1);
    // What the maker is left looking at: the record never loaded (after useComposeBuild's one retry), so the page says so.
    expect(await screen.findByText("This build didn't load.", {}, { timeout: 5_000 })).toBeTruthy();
  });
});

describe("CA-08 · an existing draft that loads but cannot be written (useComposeBuild's save)", () => {
  it(
    "a title edit that the database refuses is sent again every 800 ms, for as long as the page is open, and logged nowhere",
    async () => {
      const draft = "0d0d0d0d-0000-4000-8000-000000000001";
      const logged = mount({ at: `/compose/${draft}`, faults: [{ method: "PATCH", path: /^\/rest\/v1\/builds/, answer: PG.check("builds", "builds_making_object_check") }] });
      fireEvent.click((await screen.findAllByRole("button", { name: "Card" }))[0]);
      const title = await screen.findByPlaceholderText("Name your build");
      fireEvent.change(title, { target: { value: "A new title" } });
      const patches = () => requests().filter((r) => r.method === "PATCH" && r.path.startsWith("/rest/v1/builds")).length;
      await waitFor(() => expect(patches()).toBeGreaterThanOrEqual(3), { timeout: 6_000 });
      // The status line is the only sign: no toast, and the app writes no console line for it.
      expect(screen.getByTestId("sandbox-status").textContent).toContain("not saved");
      expect(toasts()).toEqual([]);
      expect(appLines(logged)).toEqual([]);
    },
    15_000,
  );
});
