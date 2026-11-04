// Tier 1, UX-03 P2: the build page reads top to bottom: the title block, then the steps, then the classification.
//
// THE BACKEND IS PT-09's (support/postThreadBackend.ts), seeded with one published build and one prompt, with no cover or with
// one. Nothing reaches the network.

import { expect, test, type Page } from "@playwright/test";

import { ME } from "../audit/support/harness";
import { BUILD_ID, fakeThreadBackend } from "./support/postThreadBackend";

const SLUG = "weekend-bakery-site-k3f9x1";
const NOW = new Date(Date.now() - 3 * 3600_000).toISOString();
const MEDIA_ID = "0e0e0e0e-0000-4000-8000-000000000002";

const build = (cover: boolean) => ({
  id: BUILD_ID,
  creator_id: ME.id,
  slug: SLUG,
  title: "Weekend bakery site",
  outcome: "An ordering site for a small bakery.",
  shape: "other",
  status: "published",
  made_for: [],
  made_with: ["Claude Code"],
  completeness: 80,
  reproduction_count: 0,
  cover_media_id: cover ? MEDIA_ID : null,
  parent_build_id: null,
  root_build_id: null,
  created_at: NOW,
  updated_at: NOW,
  published_at: NOW,
  post_doc: null,
});

const media = [
  { id: MEDIA_ID, build_id: BUILD_ID, node_id: null, bucket: "build-media", path: `${BUILD_ID}/cover.png`, kind: "image", mime_type: "image/png", width: 1600, height: 900, poster_path: null, duration: null, post_position: null, post_text: null, created_at: NOW },
];

async function openBuild(page: Page, cover: boolean) {
  await fakeThreadBackend(page, { build: build(cover), media: cover ? media : [] });
  // One prompt, so the page has steps.
  await page.route(/\/rest\/v1\/build_nodes/, (route) =>
    route.request().method() === "GET" && !decodeURIComponent(route.request().url()).includes("position=is.null")
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ id: "0d1d1d1d-0000-4000-8000-000000000001", build_id: BUILD_ID, parent_id: null, position: 0, type: "prompt", title: null, note: null, payload: { text: "Build me an ordering site for a small bakery." }, source_ref: null, event_id: null, is_gap: false, created_at: NOW }]),
        })
      : route.fallback(),
  );
  await page.goto(`/b2/${SLUG}`);
  await expect(page.getByTestId("build-hero")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("build-steps-panel")).toBeVisible();
}

test.describe("UX-03 P2: the build page reads top to bottom", () => {
  test("a build with no cover has no picture area, and its steps sit right under the title block", async ({ page, isMobile }) => {
    await openBuild(page, false);
    const hero = page.getByTestId("build-hero");
    await expect(hero).toHaveAttribute("data-pictured", "false");
    await expect(hero.getByTestId("build-hero-picture")).toHaveCount(0);
    if (isMobile) {
      // A phone's order: the title block, the reproduction's action and state, then the steps.
      const order = await page.evaluate(() => ["build-hero", "build-proof", "build-steps-panel"].map((id) => document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().top ?? -1));
      expect(order[0]).toBeLessThan(order[1]);
      expect(order[1]).toBeLessThan(order[2]);
      return;
    }
    const title = await hero.boundingBox();
    const steps = await page.getByTestId("build-steps-panel").boundingBox();
    if (!title || !steps) throw new Error("The title block or the steps are not on the page.");
    expect(steps.y - (title.y + title.height)).toBeGreaterThanOrEqual(0);
    expect(steps.y - (title.y + title.height)).toBeLessThanOrEqual(32);
  });

  test("a build with a cover shows its picture", async ({ page }) => {
    await openBuild(page, true);
    const hero = page.getByTestId("build-hero");
    await expect(hero).toHaveAttribute("data-pictured", "true");
    await expect(hero.getByTestId("build-hero-picture")).toBeVisible();
  });
});
