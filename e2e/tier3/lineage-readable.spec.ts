// Tier 3 — the browser half of "remix creation is retired" (NS-P43).
//
// WHAT THIS FILE CARRIES. NS-P43 froze createRemix and hid the one affordance
// that reached it, on the promise that every lineage already recorded keeps
// rendering. The function half is proved in src/lib/retiredSurfaces.test.tsx,
// which also renders the lineage page against stubbed rows. What only a browser
// can add is that /b/:slug/lineage is still SERVED — routed, mounted and drawn
// against the real database — for a post whose derivation was recorded before
// the freeze.
//
// WHAT IT DELIBERATELY DOES NOT CARRY, for the reason NS-P42 set out in
// reblog-retired.spec.ts: "no Remix button on the content page" is vacuous
// anonymously. RemixLineageRow only ever offered that button to a signed-in
// viewer who is not the author, this repository has no Playwright auth fixture
// (playwright.config.ts declares a `setup` project and no `.setup.ts` exists),
// so an anonymous run would find no button whatever the flag said and would
// pass just as happily with the freeze reverted. That assertion belongs to the
// component spec, where the viewer can be signed in for the price of a mock.
//
// WHY IT SKIPS BY DEFAULT. It needs a post that actually has a lineage row —
// seeded data, not something a spec can conjure — so it is gated on
// E2E_LINEAGE_SLUG. Until one is pointed at, it skips rather than fails: a red
// suite meaning "nobody seeded a fixture" trains a maintainer to ignore red.
//
// Selectors are roles and accessible names. Nothing here selects on a class:
// see the selector rules in the e2e skill.

import { expect, test } from "@playwright/test";

/** A post slug that has a lineage — the segment after /b/, or a full path. */
const LINEAGE_SLUG = process.env.E2E_LINEAGE_SLUG ?? "";

const NEEDS_SLUG =
  "Set E2E_LINEAGE_SLUG to a post with a post_lineage row, e.g. a remix created before NS-P43.";

test.describe("a lineage recorded before the freeze", () => {
  test.skip(!LINEAGE_SLUG, NEEDS_SLUG);

  const path = LINEAGE_SLUG.startsWith("/")
    ? LINEAGE_SLUG
    : `/b/${LINEAGE_SLUG}/lineage`;

  // ACCEPTANCE 2 — the lineage page renders exactly as before. The tree is the
  // page's body, so if a row drew, the slug resolved and the RPC answered.
  test("still renders as a tree at its own URL", async ({ page }) => {
    await page.goto(path);

    await expect(page.getByText("No lineage data for this post yet.")).toHaveCount(0);
    // Every row credits its author with a handle; at least one must be drawn.
    await expect(page.getByText(/^@/).first()).toBeVisible();
  });

  // Quiet retirement, as in NS-P42: nothing stands where the affordance was.
  test("carries no remix affordance, and no notice that one was removed", async ({
    page,
  }) => {
    await page.goto(path);

    await expect(
      page.getByRole("button", { name: "Remix — build on this" })
    ).toHaveCount(0);
    await expect(
      page.getByText(/remix(ing)? (is|has been) (retired|disabled|removed)/i)
    ).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp("/lineage$"));
  });
});
