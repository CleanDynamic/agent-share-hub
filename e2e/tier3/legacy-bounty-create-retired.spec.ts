// Tier 3 — the browser half of "legacy bounty creation is retired" (NS-P54).
//
// WHAT THIS FILE CARRIES, AND WHAT IT DELIBERATELY DOES NOT. NS-P54's first
// acceptance criterion has two halves: no route or affordance CREATES a
// `content_items` bounty, and every former entry lands on /compose/new with the
// notice. The write half is answered in full by
// src/lib/bounty-legacy/legacyBountyCreateRetired.test.tsx, which walks the
// /bounty/new form end to end as a signed-in creator and asserts that the
// client was never asked to insert. It lives there rather than here for the
// reason NS-P42's spec gave: /bounty/new is behind ProtectedRoute, this
// repository has no Playwright auth fixture — playwright.config.ts declares a
// `setup` project and no `.setup.ts` exists — and an anonymous browser spec
// asserting "no bounty was created" would pass just as happily with the flag
// flipped back to true. A vacuous green is worse than no test.
//
// What a browser CAN prove without an account, and what this file is for, is
// the half a unit test cannot: that the ROUTES AS SHIPPED — mounted in the real
// App.tsx, inside the real shell — carry the notice, name the replacement, and
// offer a way to it. This spec needs no seeded data and no credentials, so
// unlike the rest of tier 3 it runs by default.
//
// Selectors are roles and accessible names. Nothing here selects on a class:
// see the selector rules in the e2e skill.

import { expect, test } from "@playwright/test";

const BOUNTY_LINE = /Bounties are now part of publishing a build/;

test.describe("legacy bounty creation, retired", () => {
  // /upload/bounty with no ?id used to MINT a content_items bounty draft on
  // arrival and redirect to itself. Anonymous is the strongest form of this
  // assertion: the gate runs before the login redirect, so a visitor who is not
  // signed in meets the retirement rather than a sign-in wall for a form that
  // would refuse them at the other end.
  test("/upload/bounty offers the composer instead of minting a draft", async ({
    page,
  }) => {
    await page.goto("/upload/bounty");

    await expect(page.getByText("Previous publishing tool")).toBeVisible();
    await expect(page.getByText(BOUNTY_LINE)).toBeVisible();

    // It did not bootstrap: the redirect that used to follow the insert put the
    // new row's id in the URL.
    await expect(page).toHaveURL(/\/upload\/bounty$/);
    await expect(page.getByText("Preparing your bounty draft…")).toHaveCount(0);

    const cta = page.getByRole("link", { name: "Open the build workspace" }).first();
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/compose/new");
  });

  // The notice is a wrapper on the bounty routes only. The blueprint editor is
  // not retired — it still saves and publishes — and telling its creators about
  // a retirement that is not theirs would be noise.
  test("the bounty line does not leak onto the blueprint editor", async ({ page }) => {
    await page.goto("/upload/blueprint");

    await expect(page.getByText("Previous publishing tool")).toBeVisible();
    await expect(page.getByText(BOUNTY_LINE)).toHaveCount(0);
  });

  // /bounty/new keeps ProtectedRoute outermost, so the anonymous answer is the
  // login redirect it always was — the route was not turned into a 404, and the
  // notice does not render over a redirect.
  test("/bounty/new is still a registered route, not a 404", async ({ page }) => {
    await page.goto("/bounty/new");

    await expect(page.getByText("Page not found")).toHaveCount(0);
    await expect(page.getByText("404")).toHaveCount(0);
  });
});
