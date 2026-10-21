// CA-12 — the composer's sessions, mounted for real (SandboxPage behind supabase-js, only the network faked).
// Part 3: a new post already has Session 1, and the prompt box is Prompt 1 of it.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend, tableRows } from "@/lib/build/__audit__/fakeSupabase";
import { sessionsMetaOf } from "@/lib/build/making";

import { SandboxPage } from "./SandboxPage";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000003";

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = () => undefined;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  stubWidth(1280);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(path: string) {
  startAuditBackend({ schema: REPO_SCHEMA });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  render(
    <MemoryRouter initialEntries={[path]}>
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
}

const field = () => screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });

describe("CA-12 P3 · Session 1", () => {
  it("a new post shows Session 1 with no app chosen above the prompt box, and says neither 'Unknown tool' nor 'typed here'", async () => {
    mount("/compose/new");
    await field();
    expect(screen.getByRole("separator", { name: "Session 1 · No app chosen" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pick an app for session 1" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Unknown tool|typed here/i);
  });

  it("the first prompt makes the draft with Session 1 in it, and goes into that session", async () => {
    mount("/compose/new");
    const box = await field();
    fireEvent.change(box, { target: { value: "Plan the launch email" } });
    fireEvent.keyDown(box, { key: "Enter" });

    await waitFor(() => expect(tableRows("build_nodes").length).toBe(1), { timeout: 10_000 });
    const build = tableRows("builds").find((row) => row.title === "Untitled build" && row.status === "draft" && !String(row.id).startsWith("0d0d"));
    expect(build).toBeTruthy();
    const keys = Object.keys(sessionsMetaOf(build?.making));
    expect(keys).toHaveLength(1);
    expect(tableRows("build_nodes")[0].payload).toMatchObject({ text: "Plan the launch email", session: keys[0] });
    expect(tableRows("build_sessions").filter((row) => row.build_id === build?.id)).toEqual([expect.objectContaining({ session_key: keys[0], position: 0 })]);
  });

  it("an old draft with no sessions is left as it was: no Session 1 appears until something is added", async () => {
    mount(`/compose/${DRAFT}`);
    await field();
    expect(screen.queryByRole("separator", { name: /^Session 1/ })).toBeNull();
    expect(tableRows("build_sessions").filter((row) => row.build_id === DRAFT)).toEqual([]);
  });
});
