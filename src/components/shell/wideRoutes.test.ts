import { describe, expect, it } from "vitest";
import { WIDE_ROUTES, layoutForRoute, matchWideRoute } from "./wideRoutes";

/* ────────────────────────────────────────────────
   BG-P14 — the wide-layout route table.

   The table is the whole opt-in mechanism, so these tests are about the
   mechanism and not about which routes use it.

   BG-P15 — MEMBERSHIP IS NOW ASSERTED BOTH WAYS. BG-P14's assertion was that
   the table is empty, which was its way of saying "no shipping page changed
   layout in that prompt". The equivalent guard now the table is populated is
   the pair below: the three routes this prompt moved are wide, and every
   OTHER route is still standard —
   including the four compose surfaces BG-P16 owns, which keep reduced chrome
   deliberately and must not be swept in by a pattern that is too broad.

   RC-P06 — NO ROUTE HAS A RIGHT RAIL, so the table no longer carries a rail
   decision per route, and the dev page's second path, which existed to show
   the rail, is gone.
──────────────────────────────────────────────── */

describe("WIDE_ROUTES", () => {
  /* RC-P12 added /bounties and RC-P13 /bounties/solvers (CONTRACT §3.4:
     rewritten, not deleted). */
  it("holds the three routes BG-P15 moved and the two bounties boards, and nothing else", () => {
    expect(WIDE_ROUTES).toEqual([
      { pattern: "/gallery" },
      { pattern: "/b2/*" },
      { pattern: "/import" },
      { pattern: "/bounties" },
      { pattern: "/bounties/solvers" },
    ]);
  });

  it("makes the moved routes and the two bounties boards wide", () => {
    for (const path of ["/gallery", "/import", "/b2/some-build", "/bounties", "/bounties/solvers"]) {
      expect([path, layoutForRoute(path)]).toEqual([path, "wide"]);
    }
  });

  /* Both bounties entries are exact, so an address under the board that no
     prompt has made wide stays standard rather than being swept in. */
  it("does not widen an address under /bounties that is not in the table", () => {
    expect(matchWideRoute("/bounties/solvers/extra")).toBeNull();
    expect(matchWideRoute("/bounties/new")).toBeNull();
  });

  /* Rewritten, not deleted: this used to assert the rail on the build page
     only. RC-P06 took the rail off every route, so each entry is its pattern
     and nothing more — a rail option coming back would fail here. */
  it("offers no right rail on any wide route", () => {
    expect(matchWideRoute("/b2/some-build")).toEqual({ pattern: "/b2/*" });
    expect(matchWideRoute("/gallery")).toEqual({ pattern: "/gallery" });
    expect(matchWideRoute("/import")).toEqual({ pattern: "/import" });
  });

  it("leaves every other route standard", () => {
    for (const path of [
      "/", "/browse", "/discover", "/library", "/drafts", "/messages",
      "/notifications", "/profile", "/analytics", "/upload", "/upload/blueprint",
      "/dev/kit",
      /* BG-P16's four. Reduced chrome is deliberate on these — if a prompt
         ever makes one wide it will be that one, not a widened pattern here. */
      "/compose/new", "/compose/some-build-id", "/rebuild/some-slug",
      "/convert/some-content-id",
    ]) {
      expect([path, layoutForRoute(path)]).toEqual([path, "standard"]);
    }
  });

  it("does not match a path that merely starts with a moved route's name", () => {
    /* "/gallery" is exact, so a future "/galleries" route is not swept in;
       "/b2/*" is a prefix and must not match "/b20". */
    expect(matchWideRoute("/galleries")).toBeNull();
    expect(matchWideRoute("/importer")).toBeNull();
    expect(matchWideRoute("/b20/x")).toBeNull();
  });

  it("matches the build page at its bare prefix and below it", () => {
    expect(matchWideRoute("/b2")?.pattern).toBe("/b2/*");
    expect(matchWideRoute("/b2/a-slug")?.pattern).toBe("/b2/*");
  });

  it("does not reach the lineage page, which is under /b/ and stays standard", () => {
    /* `/b/:slug/lineage` is the only route whose path could be mistaken for
       one of the build page's. It is a DIFFERENT prefix — /b/, not /b2/ — and
       it is already inside the frame in standard mode, which is where it
       belongs: it is one column of ancestry, not a grid. */
    expect(layoutForRoute("/b/a-slug/lineage")).toBe("standard");
  });
});

describe("matchWideRoute", () => {
  /* The dev entry exists only under import.meta.env.DEV, which vitest sets.
     RC-P06 deleted its second path, /dev/wide/rail, with the rail it showed. */
  it("matches the dev demo route, and no longer the path that showed the rail", () => {
    expect(matchWideRoute("/dev/wide")).toEqual({ pattern: "/dev/wide" });
    expect(layoutForRoute("/dev/wide")).toBe("wide");
    expect(matchWideRoute("/dev/wide/rail")).toBeNull();
    expect(layoutForRoute("/dev/wide/rail")).toBe("standard");
  });

  it("returns null for an unlisted path", () => {
    expect(matchWideRoute("/dev/wideish")).toBeNull();
    expect(matchWideRoute("/dev")).toBeNull();
    expect(matchWideRoute("/")).toBeNull();
  });

  it("is exact by default — a longer path does not match a bare pattern", () => {
    /* "/dev/wide" must not swallow a longer path by prefix. */
    expect(matchWideRoute("/dev/wide/anything")).toBeNull();
    expect(matchWideRoute("/gallery/anything")).toBeNull();
  });
});
