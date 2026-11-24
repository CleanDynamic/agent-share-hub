// Tier 1: a build post's thread opens and closes in place, on Home and on the build page.
//
// THE BACKEND IS PT-09's (support/postThreadBackend.ts), seeded with one published build whose thread is three posts: a heading,
// words and a picture, then two more behind "Show more · 2 more posts". Nothing reaches the network.

import { expect, test, type Page } from "@playwright/test";

import { ME } from "../audit/support/harness";
import { BUILD_ID, fakeThreadBackend } from "./support/postThreadBackend";

const SLUG = "weekend-bakery-site-k3f9x1";
const NOW = new Date(Date.now() - 3 * 3600_000).toISOString();
const MEDIA_ID = "0e0e0e0e-0000-4000-8000-000000000001";
const WORDS = "I built a bakery ordering site over a weekend, one prompt at a time.";

const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Weekend bakery site" }] },
    { type: "paragraph", content: [{ type: "text", text: WORDS }] },
    { type: "postMediaGrid", content: [{ type: "postMedia", attrs: { mediaId: MEDIA_ID, width: 100, w: 1600, h: 900, alt: "The order page", crop: null, aspect: null, zoom: null, warn: [], caption: "" } }] },
    { type: "postBreak" },
    { type: "paragraph", content: [{ type: "text", text: "Then the first orders came in." }] },
    { type: "postBreak" },
    { type: "paragraph", content: [{ type: "text", text: "By Friday it ran itself." }] },
  ],
};

const build = {
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
  cover_media_id: MEDIA_ID,
  parent_build_id: null,
  root_build_id: null,
  created_at: NOW,
  updated_at: NOW,
  published_at: NOW,
  post_doc: doc,
};

const media = [
  { id: MEDIA_ID, build_id: BUILD_ID, node_id: null, bucket: "build-media", path: `${BUILD_ID}/order.png`, kind: "image", mime_type: "image/png", width: 1600, height: 900, poster_path: null, duration: null, post_position: 0, post_text: null, created_at: NOW },
];

const feedRow = {
  item_kind: "build", item_at: NOW, build_id: BUILD_ID, slug: SLUG, title: build.title, outcome: build.outcome, shape: "other", cover_media_id: MEDIA_ID,
  creator_id: ME.id, creator_username: ME.username, creator_display: ME.display_name, creator_avatar: null, reproduction_count: 0, rebuild_count: 0,
  parent_build_id: null, source_title_at_fork: null, source_handle_at_fork: null, rebuild_note: null, repro_note: null, repro_model: null,
  repro_user_username: null, status: "published", made_for: [], last_confirmed_at: null, last_confirmed_model: null, cover_bucket: "build-media",
  cover_path: media[0].path, cover_kind: "image", cover_poster_path: null, repro_worked: null,
};

async function openFeed(page: Page) {
  const backend = await fakeThreadBackend(page, { build, media });
  // Home's Everyone feed is one RPC row per item; the build itself is then read by id, which the backend answers.
  await page.route(/\/rest\/v1\/rpc\/get_build_feed/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([feedRow]) }),
  );
  await page.goto("/");
  const item = page.locator("[data-feed-post]").first();
  await expect(item).toBeVisible();
  return { backend, item };
}


test.describe("a build post's thread opens in place", () => {
  test("Home: Show more · 2 more posts opens the thread with no author row, one build line, and Show less closes it", async ({ page }) => {
    const { item } = await openFeed(page);
    const toggle = item.getByRole("button", { name: "Show more · 2 more posts" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(item.locator("[data-post-region]")).toHaveAttribute("data-post-region", "closed");

    await toggle.click();
    const less = item.getByRole("button", { name: "Show less" });
    await expect(less).toHaveAttribute("aria-expanded", "true");
    await expect(item.getByText("Then the first orders came in.")).toBeVisible();
    await expect(item.getByText("By Friday it ran itself.")).toBeVisible();
    // Focus is on the first revealed post.
    await expect(item.locator("[data-post='2']")).toBeFocused();

    // The maker is shown once; the build line once; the connector has a node on each following post.
    await expect(item.locator("[data-feed-author-row]")).toHaveCount(1);
    await expect(item.locator("[data-feed-build-line]")).toHaveCount(1);
    await expect(item.locator("[data-thread-node]")).toHaveCount(2);

    await less.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await expect(item.locator("[data-post-region]")).toHaveAttribute("data-post-region", "closed");
  });

  test("the build page: 1 of 3 posts · Show more opens the same way", async ({ page }) => {
    await fakeThreadBackend(page, { build, media });
    await page.goto(`/b2/${SLUG}`);
    const hero = page.getByTestId("build-hero");
    const toggle = hero.getByRole("button", { name: "1 of 3 posts · Show more" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(hero.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    await expect(hero.getByText("By Friday it ran itself.")).toBeVisible();
    await hero.getByRole("button", { name: "Show less" }).click();
    await expect(hero.locator("[data-post-region]")).toHaveAttribute("data-post-region", "closed");
  });
});
