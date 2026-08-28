// Tier 3 — rebuild attribution on the public pages (NS-P40).
//
// Covers the three acceptance criteria that are visible to a reader:
//   1. the rebuild's page shows the banner, the note and a working expander
//   2. the source's page shows the Rebuilds tab, its row, and the two counts
//   3. a rebuild whose source is gone still credits it, from the snapshot
//
// WHAT THIS SPEC NEEDS, AND WHY IT ASKS FOR IT RATHER THAN MAKING IT. A
// published rebuild is a two-account, two-record fixture: a published source
// owned by one person, a published child owned by another, with the NS-P36
// snapshot columns frozen onto the child at fork time. Building that through
// the UI would be a fifteen-step test of the compose route wearing an
// attribution test's name, and building it through the database needs service
// credentials this repository does not carry. So the pair is seeded once —
// scripts/verify-rebuild.ts drives exactly this chain — and named here through
// the environment:
//
//   E2E_REBUILD_SLUG   the published rebuild's slug        (required)
//   E2E_SOURCE_SLUG    the build it was rebuilt from       (required)
//   E2E_ORPHAN_SLUG    a rebuild whose source was deleted  (optional)
//
// Without them the specs skip rather than fail: a red suite that means "nobody
// has seeded the dev project" trains a maintainer to ignore red.
//
// Selectors are the testids NS-P40 introduced — rebuild-banner, rebuilds-tab,
// rebuild-count, divergence-marker — and roles everywhere else. Nothing here
// selects on a class: see the selector rules in the e2e skill.

import { expect, test, type Page } from "@playwright/test";

const REBUILD_SLUG = process.env.E2E_REBUILD_SLUG ?? "";
const SOURCE_SLUG = process.env.E2E_SOURCE_SLUG ?? "";
/** A rebuild whose source has been deleted. Acceptance 3, when one exists. */
const ORPHAN_SLUG = process.env.E2E_ORPHAN_SLUG ?? "";

const NEEDS_PAIR =
  "Set E2E_REBUILD_SLUG and E2E_SOURCE_SLUG to a seeded published rebuild and its source.";

/** The build page renders its own frame, so this is what "loaded" means. */
async function openBuild(page: Page, slug: string) {
  await page.goto(`/b2/${slug}`);
  await expect(page.locator('[data-visual-slot="build-page-frame"]')).toBeVisible();
  await expect(page.getByText("No build at this address")).toHaveCount(0);
}

test.describe("a rebuild credits the build it came from", () => {
  test.skip(!REBUILD_SLUG || !SOURCE_SLUG, NEEDS_PAIR);

  // ACCEPTANCE 1
  test("shows the credit banner, the note, and what changed", async ({ page }) => {
    await openBuild(page, REBUILD_SLUG);

    const banner = page.getByTestId("rebuild-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Rebuilt from");

    // The source is live, so the credit is a way through to it.
    await expect(banner.getByRole("link").first()).toHaveAttribute(
      "href",
      new RegExp(`/b2/${SOURCE_SLUG}$`)
    );
    await expect(banner).not.toContainText("no longer available");

    // The diff is computed when it is asked for, and not before.
    await expect(page.getByTestId("rebuild-banner-changes")).toHaveCount(0);
    await page.getByTestId("rebuild-banner-expander").click();

    const changes = page.getByTestId("rebuild-banner-changes");
    await expect(changes).toBeVisible();
    // A rebuild cannot be published without changing something (NS-P37's
    // gate), so an empty list here is a failure of the gate, not of the diff.
    await expect(changes.locator("li")).not.toHaveCount(0);
  });

  // ACCEPTANCE 2
  test("puts the rebuild on its source's page, beside the reproduction count", async ({ page }) => {
    await openBuild(page, SOURCE_SLUG);

    const count = page.getByTestId("rebuild-count");
    await expect(count).toBeVisible();
    // Both are earned numbers and they are siblings in the same strip.
    await expect(page.getByTestId("reproduction-count")).toBeVisible();

    await count.click();

    const tab = page.getByTestId("rebuilds-tab");
    await expect(tab).toBeVisible();
    await expect(page.getByRole("tab", { name: /Rebuilds/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    // The row is the way to the rebuild.
    const row = tab.getByTestId("rebuild-row").first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(new RegExp("/b2/"));
    await expect(page.getByTestId("rebuild-banner")).toBeVisible();
  });

  // ACCEPTANCE 4
  test("marks the step a rebuild was taken at, on the source's scrubber", async ({ page }) => {
    await openBuild(page, SOURCE_SLUG);
    await page.getByRole("tab", { name: /Watch it get built/ }).click();

    const markers = page.getByTestId("divergence-marker");
    // A rebuild of a whole build names no moment and marks no step, so this is
    // only asserted where the seeded rebuild was taken from one.
    test.skip((await markers.count()) === 0, "The seeded rebuild names no event.");

    const marker = markers.first();
    await expect(marker).toHaveAttribute("aria-label", /rebuilt from here/);
    await marker.hover();
    await expect(page.getByTestId("divergence-names")).toContainText("rebuilt from here");

    await marker.click();
    await expect(page.getByTestId("rebuild-banner")).toBeVisible();
  });
});

// ACCEPTANCE 3
test.describe("a credit outlives its source", () => {
  test.skip(
    !ORPHAN_SLUG,
    "Set E2E_ORPHAN_SLUG to a rebuild whose source has been deleted (parent_build_id NULL)."
  );

  test("still names the source, from the frozen snapshot", async ({ page }) => {
    await openBuild(page, ORPHAN_SLUG);

    const banner = page.getByTestId("rebuild-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Rebuilt from");
    await expect(banner).toContainText("(no longer available)");

    // Nothing to link to, and nothing to diff against.
    await expect(banner.getByRole("link")).toHaveCount(0);
    await expect(page.getByTestId("rebuild-banner-expander")).toHaveCount(0);
  });
});
