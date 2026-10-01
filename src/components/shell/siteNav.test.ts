import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isActivityPath, SITE_NAV, sectionForPath } from "./siteNav";

describe("SITE_NAV", () => {
  it("uses only routes AppShell's allNavItems has", () => {
    const shell = readFileSync("src/components/AppShell.tsx", "utf8");
    for (const href of [SITE_NAV.home, SITE_NAV.gallery, SITE_NAV.bounties, SITE_NAV.library, SITE_NAV.create, SITE_NAV.activity]) {
      expect(shell).toContain(`route: "${href}"`);
    }
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
    ["/import", null],
    ["/compose/new", null],
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
