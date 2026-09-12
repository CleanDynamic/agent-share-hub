import { describe, expect, it } from "vitest";
import { WIDE_ROUTES, layoutForRoute, matchWideRoute } from "./wideRoutes";

/* ────────────────────────────────────────────────
   BG-P14 — the wide-layout route table.

   The table is the whole opt-in mechanism, so these tests are about the
   mechanism and not about which routes use it.

   BG-P15 — MEMBERSHIP IS NOW ASSERTED BOTH WAYS. BG-P14's assertion was that
   the table is empty, which was its way of saying "no shipping page changed
   layout in that prompt". The equivalent guard now the table is populated is
   the pair below: the three routes this prompt moved are wide with the
   rail preference each one chose, and every OTHER route is still standard —
   including the four compose surfaces BG-P16 owns, which keep reduced chrome
   deliberately and must not be swept in by a pattern that is too broad.
──────────────────────────────────────────────── */

describe("WIDE_ROUTES", () => {
  it("holds the three routes BG-P15 moved, and their rail decisions", () => {
    expect(WIDE_ROUTES).toEqual([
      { pattern: "/gallery", rightRail: false },
      { pattern: "/b2/*", rightRail: true },
      { pattern: "/import", rightRail: false },
    ]);
  });

  it("makes the three moved routes wide", () => {
    for (const path of ["/gallery", "/import", "/b2/some-build"]) {
      expect([path, layoutForRoute(path)]).toEqual([path, "wide"]);
    }
  });

  it("shows the right rail on the build page only", () => {
    expect(matchWideRoute("/b2/some-build")?.rightRail).toBe(true);
    expect(matchWideRoute("/gallery")?.rightRail).toBe(false);
    expect(matchWideRoute("/import")?.rightRail).toBe(false);
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
