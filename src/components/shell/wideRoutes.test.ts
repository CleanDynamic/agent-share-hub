import { describe, expect, it } from "vitest";
import { WIDE_ROUTES, layoutForRoute, matchWideRoute } from "./wideRoutes";

/* ────────────────────────────────────────────────
   BG-P14 — the wide-layout route table.

   The table is the whole opt-in mechanism, so these tests are about the
   mechanism and not about which routes use it. The one assertion about
   membership is that it is EMPTY: this prompt builds the capability and moves
   no route, and a route that quietly became wide here would be a layout change
   to a shipping page with no other trace.
──────────────────────────────────────────────── */

describe("WIDE_ROUTES", () => {
  it("is empty — BG-P14 moves no route", () => {
    expect(WIDE_ROUTES).toEqual([]);
  });

  it("leaves every real route standard", () => {
    for (const path of [
      "/", "/browse", "/discover", "/library", "/drafts", "/messages",
      "/notifications", "/profile", "/analytics", "/upload", "/upload/blueprint",
      "/gallery", "/import", "/b2/some-build", "/compose/new", "/dev/kit",
    ]) {
      expect([path, layoutForRoute(path)]).toEqual([path, "standard"]);
    }
  });
});

describe("matchWideRoute", () => {
  /* The dev entries are the only populated rows there are, so they are what
     the matcher can be exercised against. They exist only under
     import.meta.env.DEV, which vitest sets. */
  it("matches the dev demo route and reads its rail preference", () => {
    expect(matchWideRoute("/dev/wide")).toEqual({ pattern: "/dev/wide", rightRail: false });
    expect(matchWideRoute("/dev/wide/rail")).toEqual({ pattern: "/dev/wide/rail", rightRail: true });
    expect(layoutForRoute("/dev/wide")).toBe("wide");
    expect(layoutForRoute("/dev/wide/rail")).toBe("wide");
  });

  it("returns null for an unlisted path", () => {
    expect(matchWideRoute("/dev/wideish")).toBeNull();
    expect(matchWideRoute("/dev")).toBeNull();
    expect(matchWideRoute("/")).toBeNull();
  });

  it("is exact by default — a longer path does not match a bare pattern", () => {
    /* "/dev/wide" must not swallow "/dev/wide/rail" by prefix, or the rail
       toggle would never turn the rail on. */
    expect(matchWideRoute("/dev/wide/rail")?.rightRail).toBe(true);
  });
});
