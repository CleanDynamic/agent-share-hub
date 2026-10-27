// SV-07 P8: no path publishes a build with no title. The hook every composer publishes through refuses one, and so does the
// standalone publish a rebuild goes through; a titled build publishes as before. Behind supabase-js with only the network faked.

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { AuthProvider } from "@/contexts/AuthContext";
import { REPO_SCHEMA, startAuditBackend, tableRows } from "@/lib/build/__audit__/fakeSupabase";
import { NO_TITLE, publishBuild } from "@/lib/build/publish";

import { useComposeBuild } from "./useComposeBuild";

const BUILD = "0d0d0d0d-0000-4000-8000-000000000001";
const stored = () => tableRows("builds").find((row) => row.id === BUILD);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A draft with a description and a prompt: everything Publish asks for but a title, which is "Untitled build" or `title`. */
function seed(title: string | null = "Untitled build") {
  startAuditBackend({
    schema: REPO_SCHEMA,
    seed: (rows) => {
      const row = rows.builds.find((entry) => entry.id === BUILD);
      if (row) Object.assign(row, { title, outcome: "A menu for the bakery", status: "draft", published_at: null });
      rows.build_nodes.push({ id: "0a0a0a0a-0000-4000-8000-0000000000e1", build_id: BUILD, parent_id: null, position: 0, type: "prompt", title: null, note: null, payload: { text: "Make the menu" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-20T10:00:00Z" });
    },
  });
}

async function open(title?: string | null) {
  seed(title);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
  const hook = renderHook(() => useComposeBuild(BUILD), { wrapper });
  await waitFor(() => expect(hook.result.current.isOwner).toBe(true), { timeout: 10_000 });
  return hook;
}

describe("SV-07 P8 · the composer's publish", () => {
  it.each([["Untitled build"], ["   "], [null]])("refuses a build titled %j, and writes nothing", async (title) => {
    const hook = await open(title);
    await act(async () => {
      await expect(hook.result.current.publish()).rejects.toThrow(NO_TITLE);
    });
    expect(stored()?.status).toBe("draft");
    expect(stored()?.published_at).toBeNull();
  });

  it("publishes once the maker has typed a title, in the same write", async () => {
    const hook = await open();
    act(() => hook.result.current.patchBuild({ title: "Bakery menu" }));
    await act(async () => {
      await hook.result.current.publish();
    });
    expect(stored()).toMatchObject({ title: "Bakery menu", status: "published" });
  });
});

describe("SV-07 P8 · the standalone publish (a rebuild's)", () => {
  it("refuses a build with no title, and publishes one with a title", async () => {
    seed();
    await expect(publishBuild({ id: BUILD, status: "draft", published_at: null })).rejects.toThrow(NO_TITLE);
    expect(stored()?.status).toBe("draft");
    seed("Bakery menu");
    await publishBuild({ id: BUILD, status: "draft", published_at: null });
    expect(stored()?.status).toBe("published");
  });
});
