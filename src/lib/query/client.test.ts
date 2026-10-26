import { describe, expect, it } from "vitest";

import { GC_MS, LIST_STALE_MS, QUERY_DEFAULTS, SLOW_STALE_MS } from "./client";

describe("how long fetched data is kept", () => {
  it("is kept 30 minutes, fresh for a minute as a list and five as facets, counts and node types", () => {
    expect(GC_MS).toBe(30 * 60_000);
    expect(LIST_STALE_MS).toBe(60_000);
    expect(SLOW_STALE_MS).toBe(5 * 60_000);
    expect(QUERY_DEFAULTS).toEqual({ gcTime: GC_MS, staleTime: LIST_STALE_MS });
  });
});
