// SV-03 P2: opening New build and leaving writes no row. The draft is made at the first real content (a session, a file,
// a title, words in the post), through ensureBuild, and not before.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, requests, startAuditBackend, tableRows } from "@/lib/build/__audit__/fakeSupabase";

import { SandboxPage } from "./SandboxPage";

beforeEach(() => {
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? 1280 >= Number(min[1]) : max ? 1280 <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SV-03 P2 · New build makes no draft until there is something in it", () => {
  it("opening it, waiting, and leaving writes no row to builds, build_nodes or build_sessions", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    const before = tableRows("builds").length;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
    const view = render(
      <MemoryRouter initialEntries={["/compose/new"]}>
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
    await screen.findByTestId("empty-build", undefined, { timeout: 10_000 });
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const writes = requests().filter((request) => request.method !== "GET" && request.method !== "HEAD" && /\/rest\/v1\/(builds|build_nodes|build_sessions|build_events)/.test(request.path));
    expect(writes.map((request) => `${request.method} ${request.path}`)).toEqual([]);
    expect(tableRows("builds")).toHaveLength(before);
  }, 30_000);
});
