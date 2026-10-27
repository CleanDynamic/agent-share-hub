// CA-16 P6: classification_facets and the per-card classification read, against a stand-in client.

import { beforeEach, describe, expect, it, vi } from "vitest";

let rpcAnswer: { data: unknown; error: unknown };
let rowsAnswer: { data: unknown; error: unknown };
const rpc = vi.fn();
const inFn = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => {
      rpc(...args);
      return Promise.resolve(rpcAnswer);
    },
    from: () => ({ select: () => ({ in: (...args: unknown[]) => { inFn(...args); return Promise.resolve(rowsAnswer); } }) }),
  },
}));

import { GALLERY_THRESHOLD, getClassificationFacets, NO_CLASSIFICATION_FACETS } from "@/lib/build/gallery";

beforeEach(() => {
  rpc.mockClear();
  inFn.mockClear();
});

describe("getClassificationFacets", () => {
  it("calls classification_facets with the gallery's thresholds and reads [{ value, count }]", async () => {
    rpcAnswer = { data: [{ value: "field:ai-ml", count: 3 }, { value: "skill:no-coding", count: 0 }, { value: 4, count: 1 }], error: null };
    await expect(getClassificationFacets()).resolves.toEqual({ live: true, counts: { "field:ai-ml": 3 } });
    expect(rpc).toHaveBeenCalledWith("classification_facets", { thresholds: GALLERY_THRESHOLD });
  });

  it("is live with no counts when no build is classified yet", async () => {
    rpcAnswer = { data: [], error: null };
    await expect(getClassificationFacets()).resolves.toEqual({ live: true, counts: {} });
  });

  it("says not live, and never throws, while the function does not exist", async () => {
    rpcAnswer = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    await expect(getClassificationFacets()).resolves.toEqual(NO_CLASSIFICATION_FACETS);
    rpcAnswer = { data: { not: "an array" }, error: null };
    await expect(getClassificationFacets()).resolves.toEqual(NO_CLASSIFICATION_FACETS);
  });
});
