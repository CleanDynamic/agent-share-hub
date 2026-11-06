/* UX-03: the before and after screenshot pairs for the report, at 1440 wide in Dusk and at 390 wide.

     UX03_STAGE=after  npx playwright test --config=playwright.audit.config.ts ux03-shots
     UX03_STAGE=before E2E_PORT=<main's dev server port> npx playwright test --config=playwright.audit.config.ts ux03-shots

   "Before" points this spec at a dev server running main, so both are made by one harness. Home, the feed and the build page are
   seeded through PT-09's backend (e2e/tier1/support/postThreadBackend.ts); the composer through UX-02's (support/ux02.ts), whose
   Session 3 is empty. A shot whose control does not exist on a stage is taken of what that stage draws in its place. */

import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { ME } from "./support/harness";
import { open as openComposer } from "./support/ux02";
import { BUILD_ID, fakeThreadBackend } from "../tier1/support/postThreadBackend";

const STAGE = process.env.UX03_STAGE ?? "after";
const DIR = `design/audits/ux-03/${STAGE}`;
const SLUG = "weekend-bakery-site-k3f9x1";
const NOW = new Date(Date.now() - 3 * 3600_000).toISOString();
const MEDIA_ID = "0e0e0e0e-0000-4000-8000-000000000001";
const node = (id: string, position: number, type: string, payload: Record<string, unknown>, title: string | null = null) => ({ id, build_id: BUILD_ID, parent_id: null, position, type, title, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: NOW });
const NODES = [
  node("0d1d1d1d-0000-4000-8000-000000000001", 0, "prompt", { text: "Build me an ordering site for a small bakery, with a menu and a basket." }),
  node("0d1d1d1d-0000-4000-8000-000000000002", 1, "prompt", { text: "Add a pickup time to each order." }),
  node("0d1d1d1d-0000-4000-8000-000000000003", 2, "document", { title: "menu.csv", step: true, url: "https://example.test/menu.csv" }, "menu.csv"),
];

const post = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Weekend bakery site" }] },
    { type: "paragraph", content: [{ type: "text", text: "I built a bakery ordering site over a weekend, one prompt at a time." }] },
    { type: "postBreak" },
    { type: "paragraph", content: [{ type: "text", text: "Then the first orders came in." }] },
  ],
};

const build = (thread: boolean) => ({
  id: BUILD_ID, creator_id: ME.id, slug: SLUG, title: "Weekend bakery site", outcome: "An ordering site for a small bakery.", shape: "other", status: "published",
  made_for: [], made_with: ["Claude Code"], completeness: 80, reproduction_count: 0, cover_media_id: null, parent_build_id: null, root_build_id: null,
  created_at: NOW, updated_at: NOW, published_at: NOW, post_doc: thread ? post : null,
});

const feedRow = {
  item_kind: "build", item_at: NOW, build_id: BUILD_ID, slug: SLUG, title: "Weekend bakery site", outcome: "An ordering site for a small bakery.", shape: "other", cover_media_id: null,
  creator_id: ME.id, creator_username: ME.username, creator_display: ME.display_name, creator_avatar: null, reproduction_count: 0, rebuild_count: 0,
  parent_build_id: null, source_title_at_fork: null, source_handle_at_fork: null, rebuild_note: null, repro_note: null, repro_model: null,
  repro_user_username: null, status: "published", made_for: [], last_confirmed_at: null, last_confirmed_model: null, cover_bucket: null,
  cover_path: null, cover_kind: null, cover_poster_path: null, repro_worked: null,
};

async function site(page: Page, width: number, thread: boolean) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("bg-theme", "dusk");
    } catch {
      /* drawn without */
    }
  });
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
  await fakeThreadBackend(page, { build: build(thread) });
  await page.route(/\/rest\/v1\/rpc\/get_build_feed/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([feedRow]) }));
  await page.route(/\/rest\/v1\/build_nodes/, (route) =>
    route.request().method() === "GET" && !decodeURIComponent(route.request().url()).includes("position=is.null")
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(NODES) })
      : route.fallback(),
  );
}

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });

test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

for (const width of [1440, 390]) {
  test.describe(`UX-03 shots at ${width} (${STAGE})`, () => {
    test.use({ deviceScaleFactor: 2 });

    test(`${width}: Home, its feed post and its room (P1, P6, P8)`, async ({ page }) => {
      await site(page, width, true);
      await page.goto("/");
      await expect(page.locator("[data-feed-post]").first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      await shot(page, `${width}-home`);
    });

    test(`${width}: the build page with no cover, and its steps (P2, P3)`, async ({ page }) => {
      await site(page, width, false);
      await page.goto(`/b2/${SLUG}`);
      await expect(page.getByTestId("build-steps-panel")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(800);
      await shot(page, `${width}-build`);
      await page.getByTestId("build-steps").scrollIntoViewIfNeeded();
      await page.getByTestId("build-steps").screenshot({ path: `${DIR}/${width}-build-steps.png` });
    });

    test(`${width}: the sign-in page (P8, P10)`, async ({ page }) => {
      await page.addInitScript(() => window.localStorage.setItem("bg-theme", "dusk"));
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.route(/\/(rest|auth|functions|storage)\/v1\//, (route) =>
        route.request().method() === "HEAD"
          ? route.fulfill({ status: 200, headers: { "content-range": "*/0" }, body: "" })
          : route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
      );
      await page.goto("/login");
      await page.waitForTimeout(1500);
      await shot(page, `${width}-signin`);
    });
  });
}

test.describe(`UX-03 composer shots (${STAGE})`, () => {
  test.use({ deviceScaleFactor: 2 });

  test("1440: the Publish checklist with an empty session (P3)", async ({ page }) => {
    await openComposer(page, 1440);
    await page.getByRole("button", { name: "Publish", exact: true }).click();
    await page.waitForTimeout(600);
    await shot(page, "1440-publish-checklist");
  });

  test("1440: the Classification window's closed rows (P5)", async ({ page }) => {
    await openComposer(page, 1440);
    await page.getByRole("button", { name: "Classification", exact: true }).first().click();
    await expect(page.getByTestId("sandbox-card")).toBeVisible();
    await page.waitForTimeout(800);
    await shot(page, "1440-classification");
  });

  test("390: the Publish checklist on a phone (P3)", async ({ page }) => {
    await openComposer(page, 390, [], 844);
    const publish = page.getByRole("button", { name: "Publish", exact: true });
    if ((await publish.count()) === 0) return;
    await publish.first().click();
    await page.waitForTimeout(600);
    await shot(page, "390-publish-checklist");
  });
});
