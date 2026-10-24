// CA-25 P3: unpublish through the build's own update, behind supabase-js with only the network faked (CA-08's fakeSupabase).

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { AuthProvider } from "@/contexts/AuthContext";
import { PG, REPO_SCHEMA, requests, startAuditBackend, tableRows, type Fault } from "@/lib/build/__audit__/fakeSupabase";
import { unpublishFailure } from "@/lib/build/publishChecklist";

import { useComposeBuild } from "./useComposeBuild";

const BUILD = "0d0d0d0d-0000-4000-8000-000000000001";
const PATCHES = /^\/rest\/v1\/builds\?/;
const patches = () => requests().filter((r) => r.method === "PATCH" && PATCHES.test(r.path));
const PUBLISHED_AT = "2026-10-01T09:00:00.000Z";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function open(faults: Fault[] = []) {
  startAuditBackend({
    schema: REPO_SCHEMA,
    faults,
    seed: (rows) => {
      const row = rows.builds.find((entry) => entry.id === BUILD);
      if (row) Object.assign(row, { status: "published", published_at: PUBLISHED_AT });
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
  const hook = renderHook(() => useComposeBuild(BUILD), { wrapper });
  await waitFor(() => expect(hook.result.current.isOwner).toBe(true), { timeout: 10_000 });
  return hook;
}

describe("useComposeBuild · unpublish", () => {
  it("sets the build back to a draft with no published date, in one write", async () => {
    const hook = await open();
    expect(hook.result.current.build?.status).toBe("published");
    await act(async () => {
      await hook.result.current.unpublish();
    });
    expect(patches()).toHaveLength(1);
    const stored = tableRows("builds").find((row) => row.id === BUILD);
    expect(stored?.status).toBe("draft");
    expect(stored?.published_at).toBeNull();
    expect(hook.result.current.build?.status).toBe("draft");
    expect(hook.result.current.build?.published_at).toBeNull();
  });

  it("carries an unsaved edit in the same write", async () => {
    const hook = await open();
    act(() => hook.result.current.patchBuild({ title: "Pantry" }));
    await act(async () => {
      await hook.result.current.unpublish();
    });
    expect(patches()).toHaveLength(1);
    expect(tableRows("builds").find((row) => row.id === BUILD)).toMatchObject({ title: "Pantry", status: "draft", published_at: null });
  });

  it("throws a refusal as it is, leaves the build published and works around nothing", async () => {
    const hook = await open([{ method: "PATCH", path: PATCHES, answer: PG.rlsInsert("builds") }]);
    let caught: unknown;
    await act(async () => {
      await hook.result.current.unpublish().catch((cause: unknown) => {
        caught = cause;
      });
    });
    expect(unpublishFailure(caught)).toBe("refused");
    expect(patches()).toHaveLength(1);
    const stored = tableRows("builds").find((row) => row.id === BUILD);
    expect(stored?.status).toBe("published");
    expect(stored?.published_at).toBe(PUBLISHED_AT);
    expect(hook.result.current.build?.status).toBe("published");
  });
});
