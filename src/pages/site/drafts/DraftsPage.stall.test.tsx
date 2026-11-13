// D4: the Drafts page with a read that never answers. After the stall time the panel's skeleton gives way to its error
// line and Retry; the other panel is untouched. The stall time is shortened here so the test does not wait 10 s.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);
vi.mock("@/components/shell/useStalled", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/shell/useStalled")>();
  return { ...actual, useStalled: (waiting: boolean) => actual.useStalled(waiting, 300) };
});

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend } from "@/lib/build/__audit__/fakeSupabase";

import { DraftsPage } from "./DraftsPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const DRAFTS = /^\/rest\/v1\/builds\?select=id,title,updated_at,session_count/;

describe("D4 · the Drafts page when a read never answers", () => {
  it("shows the drafts panel's error and Retry in place of its rows, and keeps the sessions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    startAuditBackend({ schema: REPO_SCHEMA, delays: [{ method: "GET", path: DRAFTS, delayMs: 600_000 }] });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
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
    const panel = await screen.findByRole("status", { name: "Continue editing" }, { timeout: 3_000 });
    expect(within(panel).getByText("That didn't load.")).toBeTruthy();
    expect(screen.getByText("A waiting session.")).toBeTruthy();
    fireEvent.click(within(panel).getByRole("button", { name: /try again|retry/i }));
    await waitFor(() => expect(screen.queryByRole("status", { name: "Continue editing" })).toBeNull());
    expect(screen.getByText("Loading your drafts")).toBeTruthy();
  });
});
