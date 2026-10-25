import { describe, expect, it } from "vitest";

import { SITE_NAV } from "@/components/shell/siteNav";

import { matchRoute, ROUTE_TABLE } from "./routeTable";

describe("the route table", () => {
  it("has an entry for every nav page, keyed by its SITE_NAV key, and each holds a load, a prefetch and a Placeholder", () => {
    for (const key of ["home", "gallery", "bounties", "library", "drafts"] as const) {
      const entry = ROUTE_TABLE[key];
      expect(entry, key).toBeDefined();
      expect(entry.key).toBe(key);
      expect(typeof entry.load, `${key} load`).toBe("function");
      expect(typeof entry.prefetch, `${key} prefetch`).toBe("function");
      expect(typeof entry.Placeholder, `${key} Placeholder`).toBe("function");
    }
  });

  it("answers the addresses SITE_NAV holds, so a rename of a value changes only the value", () => {
    expect(matchRoute(SITE_NAV.gallery)?.entry.key).toBe("gallery");
    expect(matchRoute(SITE_NAV.bounties)?.entry.key).toBe("bounties");
    expect(matchRoute(SITE_NAV.library)?.entry.key).toBe("library");
    expect(matchRoute(SITE_NAV.drafts)?.entry.key).toBe("drafts");
    expect(matchRoute(SITE_NAV.home)?.entry.key).toBe("home");
  });

  it("reads the parameters an address carries, and nothing for an address it does not hold", () => {
    expect(matchRoute("/compose/abc")).toMatchObject({ entry: { key: "create" }, params: { buildId: "abc" } });
    expect(matchRoute("/b2/some-build")).toMatchObject({ entry: { key: "build" }, params: { slug: "some-build" } });
    expect(matchRoute("/profile/maren")).toMatchObject({ entry: { key: "profile" }, params: { handle: "maren" } });
    expect(matchRoute("/about")).toBeNull();
  });
});
