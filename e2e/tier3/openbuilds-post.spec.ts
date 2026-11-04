// UX-06, in a real browser: the post page. Opened from the feed; the Thread and the Wall switched with the address changing and
// nothing fading.
//
// The backend is the in-memory world in support/openbuildsWorld.ts (UX-05's), which now answers getPost.

import { expect, test } from "@playwright/test";

import { addReplies, installWorld, newWorld } from "./support/openbuildsWorld";

test("a post opens from the feed, and the Thread and the Wall switch in the address with no fade", async ({ page }) => {
  const world = newWorld();
  addReplies(world, "p1", [
    { id: "r1", body: "I split the rubric into its own step.", minutesAgo: 50, build: "b1" },
    { id: "r2", body: "Same here, it halves the time.", minutesAgo: 40, author: "me" },
    { id: "r3", parent: "r1", body: "Which model did you score with?", minutesAgo: 30, author: "me" },
  ]);
  await installWorld(page, world, { signedIn: false });
  await page.goto("/openbuilds");

  await page.getByRole("link", { name: "Post number 1" }).click();
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p1$/);
  await expect(page.getByRole("heading", { level: 1, name: "Post number 1" })).toBeVisible();
  await expect(page.getByText("I split the rubric into its own step.")).toBeVisible();
  await expect(page.getByRole("list", { name: /Replies to / }).getByText("Which model did you score with?")).toBeVisible();

  // Nothing is moving once the page has arrived.
  const moving = () =>
    page.evaluate(() => {
      const root = document.querySelector('[data-testid="openbuilds-post"]');
      return root ? root.getAnimations({ subtree: true }).length + (root.closest("main")?.getAnimations().length ?? 0) : -1;
    });
  await expect.poll(moving).toBe(0);

  await page.getByRole("button", { name: "Wall · 1 build" }).click();
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p1\?view=wall$/);
  await expect(page.getByRole("region", { name: "Wall" })).toBeAttached();
  expect(await moving()).toBe(0);

  await page.getByRole("button", { name: /^Thread · / }).click();
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p1$/);
  await expect(page.getByRole("region", { name: "Thread" })).toBeVisible();
  expect(await moving()).toBe(0);
});

test("the old address opens the same page", async ({ page }) => {
  const world = newWorld();
  await installWorld(page, world, { signedIn: false });
  await page.goto("/openbuilds/posts/p2");
  await expect(page).toHaveURL(/\/openbuilds\/topics\/p2$/);
  await expect(page.getByRole("heading", { level: 1, name: "Post number 2" })).toBeVisible();
});
