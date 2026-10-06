import { describe, expect, it } from "vitest";

import { isActivityPath, PRIMARY_LINKS, SITE_NAV, sectionForPath } from "./siteNav";

describe("PRIMARY_LINKS", () => {
  // The header's links, in order. A change here is a change to the navigation's
  // budget (hicks-law), so it shows up as a diff in this snapshot.
  it("is the header's list: Library and Drafts are signed-in only", () => {
    expect(PRIMARY_LINKS).toEqual([
      { key: "home", label: "Home", href: "/" },
      { key: "gallery", label: "Gallery", href: "/gallery" },
      { key: "bounties", label: "Bounties", href: "/bounties" },
      { key: "library", label: "Library", href: "/library", authOnly: true },
      { key: "drafts", label: "Drafts", href: "/drafts", authOnly: true },
    ]);
  });

  it("agrees with SITE_NAV", () => {
    expect(PRIMARY_LINKS.map((link) => link.href)).toEqual([
      SITE_NAV.home,
      SITE_NAV.gallery,
      SITE_NAV.bounties,
      SITE_NAV.library,
      SITE_NAV.drafts,
    ]);
  });
});

describe("sectionForPath", () => {
  it.each([
    ["/", "home"],
    ["/gallery", "gallery"],
    ["/b2/invoice-triage", "gallery"],
    ["/b2/invoice-triage/lineage", "gallery"],
    ["/rebuild/invoice-triage", "gallery"],
    ["/bounties", "bounties"],
    ["/bounties/solvers", "bounties"],
    ["/library", "library"],
    ["/drafts", "drafts"],
    ["/drafts/posts", "drafts"],
    ["/compose/new", "drafts"],
    ["/compose/abc", "drafts"],
    ["/import", null],
    ["/notifications", null],
    ["/profile/maya", null],
  ])("%s → %s", (path, section) => {
    expect(sectionForPath(path)).toBe(section);
  });

  it("knows the Activity page", () => {
    expect(isActivityPath("/notifications")).toBe(true);
    expect(isActivityPath("/gallery")).toBe(false);
  });
});
