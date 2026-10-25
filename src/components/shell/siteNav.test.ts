import { describe, expect, it } from "vitest";

import { isActivityPath, isBuildsPath, PRIMARY_LINKS, SITE_NAV, sectionForPath } from "./siteNav";

describe("PRIMARY_LINKS", () => {
  // The header's links, in order. A change here is a change to the navigation's
  // budget (hicks-law), so it shows up as a diff in this snapshot.
  it("is the header's list: Library and Drafts are signed-in only", () => {
    expect(PRIMARY_LINKS).toEqual([
      { key: "home", label: "Home", href: "/" },
      { key: "gallery", label: "Builds", href: "/builds" },
      { key: "bounties", label: "OpenBuilds", href: "/openbuilds" },
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
    ["/builds", "gallery"],
    ["/gallery", "gallery"],
    ["/b2/invoice-triage", "gallery"],
    ["/b2/invoice-triage/lineage", "gallery"],
    ["/rebuild/invoice-triage", "gallery"],
    ["/openbuilds", "bounties"],
    ["/openbuilds/solvers", "bounties"],
    ["/openbuilds/abc/solve", "bounties"],
    ["/bounties", "bounties"],
    ["/bounties/solvers", "bounties"],
    ["/bounties/abc/solve", "bounties"],
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
    expect(isActivityPath("/builds")).toBe(false);
  });

  it("knows the Builds page by its new and its old address", () => {
    expect(isBuildsPath("/builds")).toBe(true);
    expect(isBuildsPath("/gallery")).toBe(true);
    expect(isBuildsPath("/builds/x")).toBe(false);
  });
});
