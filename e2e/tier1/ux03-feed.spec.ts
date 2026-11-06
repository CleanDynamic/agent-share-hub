// Tier 1, UX-03 P1: a feed post opens its build.
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

const onBuild = (page: Page) => expect(page).toHaveURL(new RegExp(`/b2/${SLUG}`));

test.describe("UX-03 P1: a feed post opens its build", () => {
  test("its heading opens the build", async ({ page }) => {
    const { item } = await openFeed(page);
    await item.locator("[data-feed-post-body]").getByRole("link", { name: "Weekend bakery site" }).click();
    await onBuild(page);
  });

  test("its picture opens the build", async ({ page }) => {
    const { item } = await openFeed(page);
    await item.locator("[data-feed-post-body] img").first().click();
    await onBuild(page);
  });

  test("its words open the build", async ({ page }) => {
    const { item } = await openFeed(page);
    await item.getByText(WORDS).click();
    await onBuild(page);
  });

  test("selecting words and letting go does not open the build", async ({ page, isMobile }) => {
    const { item } = await openFeed(page);
    const words = item.getByText(WORDS);
    if (isMobile) {
      // A phone selects with a long press, which a test cannot make, and a real tap clears the selection before its click. So
      // the words are selected and the click is sent while the selection stands: the body must not open the build.
      await words.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      });
    } else {
      const box = await words.boundingBox();
      if (!box) throw new Error("The words are not on the page.");
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).not.toBe("");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/$/);
  });

  test("Show more, Like and the author keep their own presses", async ({ page }) => {
    const { item } = await openFeed(page);
    await item.getByRole("button", { name: /Show more/ }).click();
    await expect(item).toHaveAttribute("data-open", "");
    await expect(page).toHaveURL(/\/$/);
    await item.getByRole("button", { name: /^(Like|Unlike)/ }).click();
    await page.waitForTimeout(200);
    await expect(page).toHaveURL(/\/$/);
    await item.getByTestId("feed-author-name").click();
    await expect(page).toHaveURL(new RegExp(`/profile/${ME.username}`));
  });

  test("the post is one tab stop for the build", async ({ page }) => {
    const { item } = await openFeed(page);
    const stops = await item.evaluate((article, slug) => {
      const focusable = Array.from(article.querySelectorAll<HTMLElement>("a[href], button, [tabindex]"));
      return focusable.filter((el) => el.tabIndex >= 0 && !el.closest("[inert]") && el.getAttribute("href")?.endsWith(`/b2/${slug}`)).length;
    }, SLUG);
    expect(stops).toBe(1);
  });
});

test.describe("UX-03 P8: a count going from 0 to 1 moves nothing", () => {
  test("the engagement icons keep their places when a Like takes the count from 0 to 1", async ({ page }) => {
    const { item } = await openFeed(page);
    await page.route(/\/rest\/v1\/build_likes/, (route) =>
      route.request().method() === "POST" ? route.fulfill({ status: 201, contentType: "application/json", body: "[]" }) : route.fallback(),
    );
    const row = item.getByTestId("engagement-row");
    await expect(row).toBeVisible();
    const places = () => row.locator("[data-engagement-icon]").evaluateAll((icons) => icons.map((icon) => Math.round(icon.getBoundingClientRect().left)));
    // The action's name follows its state: like, then unlike.
    const like = row.locator('[data-engagement-action="like"], [data-engagement-action="unlike"]');
    await expect(like.locator("[data-engagement-count]")).toHaveText("");
    const before = await places();
    await like.click();
    await expect(like.locator("[data-engagement-count]")).toHaveText("1");
    expect(await places()).toEqual(before);
  });
});
