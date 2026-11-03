// Tier 1 — UX-01 P9, no blank screen on the way to sign in.
//
// While the sign-in chunk loads (throttled here), the page shows the form's outline in LoadingBlocks, sized like the card, not an
// empty page; the card then replaces it at once. And hovering or focusing the header's Sign in opens the chunk before the press.

import { expect, test } from "@playwright/test";

import { fakeBoundaries } from "../tier3/support/fakeBackend";

const CHUNK = /\/src\/pages\/site\/signin\/LoginPage\.tsx|\/assets\/LoginPage-[^/]+\.js/;

test("with the chunk held back, the outline shows and matches the card within 2 px", async ({ page }) => {
  await fakeBoundaries(page, { signedIn: false });
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(CHUNK, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/login", { waitUntil: "commit" });
  const outline = page.getByTestId("signin-fallback-card");
  await expect(outline).toBeVisible();
  const outlineBox = await outline.boundingBox();
  expect(outlineBox?.width).toBeGreaterThan(0);
  expect(await page.getByTestId("signin-fallback").evaluate((el) => el.children.length)).toBeGreaterThan(0);

  release();
  const card = page.getByTestId("signin-card");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("signin-fallback")).toHaveCount(0);
  const cardBox = await card.boundingBox();
  expect(Math.abs((outlineBox?.width ?? 0) - (cardBox?.width ?? 0))).toBeLessThanOrEqual(2);
  expect(Math.abs((outlineBox?.height ?? 0) - (cardBox?.height ?? 0))).toBeLessThanOrEqual(2);
});

test("hovering the header's Sign in opens the sign-in chunk before it is pressed", async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), "the phone header has no hover");
  await fakeBoundaries(page, { signedIn: false });
  const asked: string[] = [];
  page.on("request", (request) => CHUNK.test(request.url()) && asked.push(request.url()));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  expect(asked).toEqual([]);
  await page.getByRole("button", { name: "Sign in", exact: true }).hover();
  await expect.poll(() => asked.length).toBeGreaterThan(0);
});
