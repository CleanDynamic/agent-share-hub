// CA-10 Part 4 — the composer's header save, behind supabase-js with only the network faked (CA-08's fakeSupabase).
// A save the database refuses stops after one try and says why; a network failure is tried again three times (after
// 1 s, 3 s and 9 s) and then stops; opening a draft writes nothing.

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { AuthProvider } from "@/contexts/AuthContext";
import { PG, REPO_SCHEMA, requests, startAuditBackend, type Fault } from "@/lib/build/__audit__/fakeSupabase";

import { SAVE_DEBOUNCE_MS, SAVE_RETRY_DELAYS_MS, useComposeBuild } from "./useComposeBuild";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000001";
const PATCHES = /^\/rest\/v1\/builds\?/;
const patches = () => requests().filter((r) => r.method === "PATCH" && PATCHES.test(r.path));

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A stored score the draft no longer has: what the old hook "corrected" with a PATCH on opening. */
const STALE = 77;

async function open(faults: Fault[] = []) {
  startAuditBackend({
    schema: REPO_SCHEMA,
    faults,
    seed: (rows) => {
      const draft = rows.builds.find((row) => row.id === DRAFT);
      if (draft) draft.completeness = STALE;
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

const lines = () => logged.mock.calls.map(([first]) => first).filter((first): first is string => typeof first === "string" && first.startsWith("[Compose]"));

describe("CA-10 · the header save", () => {
  it("opening a draft sends no PATCH, though its stored score is out of date", async () => {
    const hook = await open();
    expect(hook.result.current.build?.completeness).toBe(STALE);
    expect(hook.result.current.completeness?.score).not.toBe(STALE);
    await act(() => new Promise((resolve) => setTimeout(resolve, SAVE_DEBOUNCE_MS + 400)));
    expect(patches()).toEqual([]);
  });

  it("the score goes out with the maker's next real edit", async () => {
    const hook = await open();
    act(() => hook.result.current.patchBuild({ title: "Pantry" }));
    await waitFor(() => expect(patches()).toHaveLength(1), { timeout: 3_000 });
    await waitFor(() => expect(hook.result.current.lastSavedAt).not.toBeNull());
    expect(hook.result.current.build?.title).toBe("Pantry");
    expect(hook.result.current.build?.completeness).toBe(hook.result.current.completeness?.score);
  });

  it("23514 stops after one try, keeps the change, says why with the code, and logs it once", async () => {
    const hook = await open([{ method: "PATCH", path: PATCHES, answer: PG.check("builds", "builds_title_check") }]);
    act(() => hook.result.current.patchBuild({ title: "x".repeat(300) }));
    await waitFor(() => expect(hook.result.current.saveFailure).not.toBeNull(), { timeout: 3_000 });
    expect(hook.result.current.saveFailure).toEqual({ reason: "a value isn't allowed", code: "23514" });
    expect(hook.result.current.build?.title).toBe("x".repeat(300));
    // Nothing more is sent: not after the debounce, not after the longest retry.
    vi.useFakeTimers();
    await act(() => vi.advanceTimersByTimeAsync(SAVE_RETRY_DELAYS_MS.reduce((a, b) => a + b, 0) + 5_000));
    vi.useRealTimers();
    expect(patches()).toHaveLength(1);
    expect(lines().filter((line) => line.startsWith("[Compose] header save failed 23514 "))).toHaveLength(1);
  });

  it("Try again sends it again", async () => {
    const hook = await open([{ method: "PATCH", path: PATCHES, answer: PG.check("builds", "builds_title_check"), times: 1 }]);
    act(() => hook.result.current.patchBuild({ title: "Pantry" }));
    await waitFor(() => expect(hook.result.current.saveFailure).not.toBeNull(), { timeout: 3_000 });
    act(() => hook.result.current.retrySave());
    await waitFor(() => expect(hook.result.current.saveFailure).toBeNull(), { timeout: 3_000 });
    await waitFor(() => expect(patches().map((r) => r.status)).toEqual([400, 200]));
  });

  it("a network failure is tried again 3 times, after 1 s, 3 s and 9 s, then stops", async () => {
    const hook = await open([{ method: "PATCH", path: PATCHES, answer: "network" }]);
    vi.useFakeTimers();
    act(() => hook.result.current.patchBuild({ title: "Pantry" }));
    await act(() => vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50));
    expect(patches()).toHaveLength(1);
    expect(hook.result.current.saveFailure).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(SAVE_RETRY_DELAYS_MS[0]));
    expect(patches()).toHaveLength(2);
    await act(() => vi.advanceTimersByTimeAsync(SAVE_RETRY_DELAYS_MS[1]));
    expect(patches()).toHaveLength(3);
    await act(() => vi.advanceTimersByTimeAsync(SAVE_RETRY_DELAYS_MS[2]));
    expect(patches()).toHaveLength(4);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    vi.useRealTimers();
    expect(patches()).toHaveLength(4);
    expect(hook.result.current.saveFailure).toEqual({ reason: "no connection", code: undefined });
    expect(lines()).toHaveLength(1);
  });
});
