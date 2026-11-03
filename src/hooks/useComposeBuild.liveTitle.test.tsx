// UX-01 P2: a build that is live keeps its title. The composer's header write refuses an empty one, or the draft's own
// "Untitled build", while the build is published or in the Gallery; a draft's title may still be emptied.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, requests, startAuditBackend } from "@/lib/build/__audit__/fakeSupabase";
import { hasTitle, LIVE_NEEDS_TITLE, refusesLiveTitle } from "@/lib/build/publish";

import { SAVE_DEBOUNCE_MS, useComposeBuild } from "./useComposeBuild";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000001";
const patches = () => requests().filter((r) => r.method === "PATCH" && /^\/rest\/v1\/builds\?/.test(r.path));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function open(status: "draft" | "published" | "gallery") {
  startAuditBackend({
    schema: REPO_SCHEMA,
    seed: (rows) => {
      const row = rows.builds.find((entry) => entry.id === DRAFT);
      if (row) Object.assign(row, { status, title: "Pantry", published_at: status === "draft" ? null : "2026-10-01T00:00:00.000Z" });
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  const hook = renderHook(() => useComposeBuild(DRAFT), { wrapper });
  await waitFor(() => expect(hook.result.current.isOwner).toBe(true), { timeout: 10_000 });
  return hook;
}

const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, SAVE_DEBOUNCE_MS + 400)));

describe("UX-01 P2 · a live build always has a title", () => {
  it("the rule: live and no title (or the draft's own) is refused; a draft is not", () => {
    expect(LIVE_NEEDS_TITLE).toBe("A published build needs a title.");
    for (const status of ["published", "gallery"]) {
      expect(refusesLiveTitle(status, "")).toBe(true);
      expect(refusesLiveTitle(status, "  ")).toBe(true);
      expect(refusesLiveTitle(status, "Untitled build")).toBe(true);
      expect(refusesLiveTitle(status, null)).toBe(true);
      expect(refusesLiveTitle(status, "Pantry")).toBe(false);
    }
    expect(refusesLiveTitle("draft", "")).toBe(false);
    expect(hasTitle("Untitled build")).toBe(false);
  });

  it.each(["published", "gallery"] as const)("a %s build: an empty title and 'Untitled build' send nothing, a real one is saved", async (status) => {
    const hook = await open(status);
    act(() => hook.result.current.patchBuild({ title: "" }));
    act(() => hook.result.current.patchBuild({ title: "Untitled build" }));
    await settle();
    expect(patches()).toEqual([]);
    expect(hook.result.current.build?.title).toBe("Pantry");
    act(() => hook.result.current.patchBuild({ title: "Pantry v2" }));
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 3_000 });
    expect(hook.result.current.build?.title).toBe("Pantry v2");
  });

  it("a draft's title may be emptied", async () => {
    const hook = await open("draft");
    act(() => hook.result.current.patchBuild({ title: "Untitled build" }));
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 3_000 });
  });

  it("an empty title is dropped but the rest of the patch still goes", async () => {
    const hook = await open("published");
    act(() => hook.result.current.patchBuild({ title: "", outcome: "A pantry app" }));
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 3_000 });
    expect(hook.result.current.build?.title).toBe("Pantry");
    expect(hook.result.current.build?.outcome).toBe("A pantry app");
  });
});
