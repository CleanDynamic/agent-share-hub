// G10: generate-ai-pdf's reblog path keeps one file per reblog and hands back the cached one while it is fresh,
// instead of making a new file on every call.

import { describe, expect, it } from "vitest";

import { freshReblogPdf, reblogPdfPath } from "../../../supabase/functions/generate-ai-pdf/reblogCache.ts";

const reblog = { id: "r-1", slug: "ada/my-reblog", updated_at: "2026-11-01T10:00:00Z" };

describe("the reblog PDF cache", () => {
  it("names one file per reblog, the same on every call", () => {
    expect(reblogPdfPath(reblog)).toBe("reblog/r-1/ada-my-reblog.pdf");
    expect(reblogPdfPath(reblog)).toBe(reblogPdfPath({ ...reblog }));
    expect(reblogPdfPath({ ...reblog, slug: null })).toBe("reblog/r-1/r-1.pdf");
  });

  it("takes the stored file when it is newer than the reblog and the original", () => {
    const stored = [{ name: "ada-my-reblog.pdf", updated_at: "2026-11-02T00:00:00Z" }];
    expect(freshReblogPdf(stored, reblog, "2026-10-01T00:00:00Z")).toBe(Date.parse("2026-11-02T00:00:00Z"));
  });

  it("makes a new one when the reblog or the original changed after it, or there is none", () => {
    const stored = [{ name: "ada-my-reblog.pdf", updated_at: "2026-11-01T09:00:00Z" }];
    expect(freshReblogPdf(stored, reblog, null)).toBeNull();
    const newer = [{ name: "ada-my-reblog.pdf", updated_at: "2026-11-02T00:00:00Z" }];
    expect(freshReblogPdf(newer, reblog, "2026-11-03T00:00:00Z")).toBeNull();
    expect(freshReblogPdf([], reblog, null)).toBeNull();
    expect(freshReblogPdf([{ name: "other.pdf", updated_at: "2026-12-01T00:00:00Z" }], reblog, null)).toBeNull();
  });
});
