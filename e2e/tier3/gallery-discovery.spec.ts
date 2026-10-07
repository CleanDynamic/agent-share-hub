// RC-P10, repointed by UI-P49 — the Gallery as the discovery home, in a real
// browser, at the desktop and the phone project.
//
// The feed's address, its query and its empty states. THE BACKEND IS FAKED
// (support/galleryFeedBackend.ts): what is asserted is what a reader sees and
// what the page asks the database for; nothing reaches the network.
//
// The lens tests are gone: UI-P49 removed the lens row (All · Proven · Rebuilt ·
// Unsolved) from the page, and an old lens link is now read and ignored.

import { expect, test } from "@playwright/test";

import { fakeFeedBackend } from "./support/galleryFeedBackend";

test("an old lens link is read and ignored: the address is tidied and the whole feed shows", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.goto("/gallery?lens=proven&with=Claude");

  await expect(page).toHaveURL(/\/gallery$/);
  await expect(page.getByTestId("gallery-feed").getByRole("heading", { level: 3 })).toHaveCount(4);
  await expect(page.getByRole("radiogroup", { name: "Lens" })).toHaveCount(0);
});

test("a sort is written to the address, asked of the database and read back", async ({ page }) => {
  const backend = await fakeFeedBackend(page);
  await page.goto("/gallery?sort=rebuilt");

  await expect(page.getByTestId("feed-count")).toHaveText("4 builds, most rebuilt first");
  await expect
    .poll(() => backend.buildRequests.some((request) => decodeURIComponent(request.url()).includes("order=rebuild_count.desc")))
    .toBe(true);
  await page.reload();
  await expect(page).toHaveURL(/\/gallery\?sort=rebuilt$/);
  await expect(page.getByTestId("feed-count")).toHaveText("4 builds, most rebuilt first");
});

test("/gallery?q=zzzz says nobody has hung a build for it yet, with one Clear filters", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.goto("/gallery?q=zzzz");

  await expect(page.getByText("Nobody has hung a build for “zzzz” yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(1);
});

test("an empty gallery says no builds match yet, and offers Bounties", async ({ page }) => {
  await fakeFeedBackend(page, []);
  await page.goto("/gallery");

  await expect(page.getByText("No builds match these filters yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ask for it on Bounties" })).toHaveCount(1);
});

test("/gallery?focus=search focuses the gallery's field and drops the parameter", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.goto("/gallery?focus=search");

  await expect(page.getByRole("searchbox", { name: "Search the gallery" })).toBeFocused();
  await expect(page).toHaveURL(/\/gallery$/);
});

test("at 390 the filter chips scroll in their own row and the page never scrolls sideways", async ({ page }) => {
  await fakeFeedBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery");

  const row = page.getByRole("group", { name: "Filter the gallery" });
  await expect(row.getByRole("button")).toHaveText(["Model · Any", "Made for · Anything", "Sort · Newest"]);
  const pageOverflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(pageOverflows).toBe(false);
});
