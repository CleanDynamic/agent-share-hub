// Tier 1: UX-01 P9, no blank screen on the way to sign in.
//
// Sign in is a dialog over the page now (G5): while its chunk loads (held back here) the page the person was on stays on
// screen, and the dialog arrives over it. And hovering or focusing the header's Sign in opens the chunk before the press.

import { expect, test } from "@playwright/test";

import { fakeBoundaries } from "../tier3/support/fakeBackend";

const CHUNK = /\/src\/pages\/site\/signin\/SignInDialog\.tsx|\/assets\/SignInDialog-[^/]+\.js/;

test("with the chunk held back, the page stays on screen, and the dialog arrives over it", async ({ page }) => {
  await fakeBoundaries(page, { signedIn: false });
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(CHUNK, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/login", { waitUntil: "commit" });
  await expect(page).toHaveURL(/\/\?signin=login$/);
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByTestId("signin-dialog")).toHaveCount(0);

  release();
  await expect(page.getByTestId("signin-dialog")).toBeVisible();
  // The page is still there under the dialog (hidden from assistive technology while the dialog is modal).
  await expect(page.locator("header").first()).toBeAttached();
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
