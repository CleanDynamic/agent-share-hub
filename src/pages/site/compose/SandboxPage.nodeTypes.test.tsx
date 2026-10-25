// SV-03 P3: opening a draft asks for the node types once, with the record, and the page reads its six types from it.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);
vi.mock("@/lib/build/nodeTypes", async (original) => {
  const real = await original<typeof import("@/lib/build/nodeTypes")>();
  return { ...real, getNodeType: vi.fn(real.getNodeType), clearNodeTypeCache: real.clearNodeTypeCache };
});

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, requests, startAuditBackend } from "@/lib/build/__audit__/fakeSupabase";
import { clearNodeTypeCache, getNodeType } from "@/lib/build/nodeTypes";

import { SandboxPage } from "./SandboxPage";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000003";

beforeEach(() => {
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const matches = min ? 1280 >= Number(min[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
  clearNodeTypeCache();
  vi.mocked(getNodeType).mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("SV-03 P3 · node types on opening a draft", () => {
  it("reads them once, with the record, and makes no getNodeType read for the page's six", async () => {
    startAuditBackend({ schema: REPO_SCHEMA });
    render(
      <MemoryRouter initialEntries={[`/compose/${DRAFT}`]}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } })}>
          <HelmetProvider>
            <AuthProvider>
              <ConnectorDialogProvider>
                <Routes>
                  <Route path="/compose/:buildId" element={<SandboxPage />} />
                </Routes>
              </ConnectorDialogProvider>
            </AuthProvider>
          </HelmetProvider>
        </QueryClientProvider>
      </MemoryRouter>,
    );
    await screen.findByTestId("sandbox-add", undefined, { timeout: 10_000 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(getNodeType).not.toHaveBeenCalled();
    expect(requests().filter((request) => /\/rest\/v1\/node_types/.test(request.path))).toHaveLength(1);
  }, 30_000);
});
