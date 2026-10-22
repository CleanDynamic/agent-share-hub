// CA-16 P5 and P9: the derived values follow the tiles while the composer is open, a build with nothing placed or without
// the columns writes nothing, and Save writes the maker's choices with the latest derived values.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Build, NodeTree } from "@/lib/build/types";
import { computeFacets } from "@/lib/classify/facets";
import { resetClassificationColumns } from "@/lib/classify/storage";

const updateBuild = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/build/builds", () => ({ updateBuild: (...args: unknown[]) => updateBuild(...args) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => maybeSingle() }) }) }) },
}));

import { DERIVED_WRITE_MS, useClassificationCard } from "./useClassificationCard";

const node = (type: string, payload: Record<string, unknown>, n: number): NodeTree =>
  ({ id: `n${n}`, build_id: "b1", type, title: null, payload, position: n, parent_id: null, source_ref: null, is_gap: false, created_at: "2026-10-22T00:00:00Z", children: [] }) as unknown as NodeTree;

const TREE = [node("prompt", { text: "Write a poem" }, 1)];
const BUILD = { id: "b1", making: null, repo_url: null, live_url: null, cost_monthly: null, cost_setup: null } as unknown as Build;

function setup(over: { tree?: NodeTree[]; owner?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(
    (props: { tree: NodeTree[] }) => useClassificationCard({ buildId: "b1", build: BUILD, tree: props.tree, title: "T", description: "", owner: over.owner ?? true, ensureBuild: () => Promise.resolve("b1") }),
    { wrapper, initialProps: { tree: over.tree ?? TREE } },
  );
}

beforeEach(() => {
  resetClassificationColumns();
  updateBuild.mockReset().mockResolvedValue({});
  maybeSingle.mockReset().mockResolvedValue({ data: { classification: {}, facets: [] }, error: null });
});
afterEach(() => vi.useRealTimers());

describe("useClassificationCard", () => {
  it("reads what is stored, and the derived values and questions from the tiles, at once", async () => {
    const { result } = setup();
    expect(result.current.derived.technique).toBeUndefined();
    expect(result.current.derived.role?.values).toEqual(["made-with-ai"]);
    expect(result.current.derived.built).toBeUndefined();
    await waitFor(() => expect(result.current.live).toBe(true));
    expect(result.current.stored.declared.field).toEqual([]);
  });

  it("writes the derived values and facets once they have settled, and not before", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.live).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(updateBuild).not.toHaveBeenCalled();
    await waitFor(() => expect(updateBuild).toHaveBeenCalledTimes(1), { timeout: DERIVED_WRITE_MS + 1500 });
    const [id, patch] = updateBuild.mock.calls[0] as [string, { classification: { derived: Record<string, { values: string[] }>; declared: unknown }; facets: string[] }];
    expect(id).toBe("b1");
    expect(patch.classification.derived.role.values).toEqual(["made-with-ai"]);
    expect(patch.facets).toEqual(computeFacets(patch.classification as never));
    expect(patch.facets).toContain("role:made-with-ai");
    // never the maker's own choices: only what was stored there already
    expect(patch.classification.declared).toEqual({ field: [], task: [], setting: [], data: [], age: null, stack: [] });
  });

  it("writes nothing for a build with nothing placed, for a reader, or before the columns exist", async () => {
    vi.useFakeTimers();
    const empty = setup({ tree: [] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DERIVED_WRITE_MS + 100);
    });
    expect(updateBuild).not.toHaveBeenCalled();
    empty.unmount();

    const reader = setup({ owner: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DERIVED_WRITE_MS + 100);
    });
    expect(updateBuild).not.toHaveBeenCalled();
    reader.unmount();

    maybeSingle.mockResolvedValue({ data: null, error: { code: "42703", message: "column does not exist" } });
    const missing = setup();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DERIVED_WRITE_MS + 100);
    });
    expect(updateBuild).not.toHaveBeenCalled();
    expect(missing.result.current.live).toBe(false);
  });

  it("follows the tiles: a new tile writes the new derived values, and an unchanged build writes once", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.live).toBe(true));
    await waitFor(() => expect(updateBuild).toHaveBeenCalledTimes(1), { timeout: DERIVED_WRITE_MS + 1500 });
    await new Promise((resolve) => setTimeout(resolve, DERIVED_WRITE_MS + 300));
    expect(updateBuild).toHaveBeenCalledTimes(1);
    rerender({ tree: [...TREE, node("code", { source: "print(1)", language: "python" }, 2)] });
    await waitFor(() => expect(updateBuild).toHaveBeenCalledTimes(2), { timeout: DERIVED_WRITE_MS + 1500 });
    const patch = updateBuild.mock.calls[1][1] as { classification: { derived: Record<string, { values: string[] }> } };
    expect(patch.classification.derived.built.values).toContain("script-or-tool");
  }, 15_000);
});
