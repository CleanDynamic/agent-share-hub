// Tier 1, UX-03 P9: Show more opens at once.
//
// THE BACKEND IS PT-09's (support/postThreadBackend.ts), seeded with one published build whose thread is two posts: a heading,
// words and a picture, then a second post behind Show more. Nothing reaches the network.

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

test.describe("UX-03 P9: Show more opens at once", () => {
  test("the rest of the thread is fetched on intent, so the press shows no Loading", async ({ page, isMobile }) => {
    const { item } = await openFeed(page);
    // The thread's media is slow to arrive, so a fetch that starts on the press shows Loading for a while.
    await page.route(/\/rest\/v1\/build_media.*post_position/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.fallback();
    });
    const toggle = item.getByRole("button", { name: /Show more/ });
    const fetched = page.waitForResponse((response) => /\/rest\/v1\/build_media/.test(response.url()) && decodeURIComponent(response.url()).includes("post_position"));
    // A fine pointer hovers it; a phone has no hover, so keyboard focus is the intent there.
    if (isMobile) await toggle.focus();
    else await toggle.hover();
    await fetched;
    await page.waitForTimeout(300);
    await item.evaluate((article) => {
      (window as unknown as { sawLoading: boolean }).sawLoading = false;
      new MutationObserver(() => {
        if (article.textContent?.includes("Loading…")) (window as unknown as { sawLoading: boolean }).sawLoading = true;
      }).observe(article, { subtree: true, childList: true, characterData: true });
    });
    await toggle.click();
    await expect(item).toHaveAttribute("data-open", "");
    expect(await page.evaluate(() => (window as unknown as { sawLoading: boolean }).sawLoading)).toBe(false);
  });
});
