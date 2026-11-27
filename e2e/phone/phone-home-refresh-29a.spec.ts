// Mobile prompt 29a: Home's posts at X's proportions (390 phone and 1440 desktop), no new-posts pill on the phone, and the pull to
// refresh with the beaver: a drag past the arm point refreshes, the new post lands at the top, and the beaver rises back into the logo.
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-home-refresh-29a --project=desktop
// Shots go to e2e/phone/shots/ (not committed).

import { expect, test, type Page } from "@playwright/test";

import { installPhoneStub, NEW_BUILD } from "./support/phoneStub";

const THEMES = ["dusk", "noon"] as const;

/** A first visit long ago, so every fixture post is "new since you looked" (the desktop pill shows; the phone has none). */
const seenLongAgo = (page: Page, theme: string) =>
  page.addInitScript((value) => {
    window.localStorage.setItem("bg-theme", value);
    window.localStorage.setItem("bg-home-seen", String(Date.parse("2026-11-01T00:00:00Z")));
  }, theme);

async function drag(page: Page, from: { x: number; y: number }, to: number, shots?: (step: number) => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  const steps = 16;
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x, y: from.y + ((to - from.y) * step) / steps }] });
    await page.waitForTimeout(16);
    await shots?.(step);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

for (const theme of THEMES) {
  for (const width of [390, 360]) {
    test(`phone Home at ${width}, ${theme}: X's proportions, no pill`, async ({ page }) => {
      await installPhoneStub(page);
      await seenLongAgo(page, theme);
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      const post = page.locator("[data-feed-post]").first();
      await expect(post).toBeVisible();
      await expect(page.getByTestId("home-new-pill")).toHaveCount(0);
      await expect(page.getByTestId("home-new-pill-floating")).toHaveCount(0);
      await page.screenshot({ path: `e2e/phone/shots/home-29a-${width}-${theme}.png` });

      const avatar = await post.locator("[data-feed-author-column] [data-ui='avatar']").boundingBox();
      expect(avatar).toMatchObject({ x: 12, width: 48, height: 48 });
      const text = await post.locator("[data-feed-author-row]").boundingBox();
      expect(text?.x).toBe(68);
      // The actions: Comment at 0, Rebuild at 20.7%, Like at 42% of the text column, Save at its right edge.
      const column = width - 68 - 16;
      const icon = async (name: string) => (await post.locator(`[data-engagement-action='${name}'] [data-engagement-icon]`).boundingBox())!;
      expect(Math.round((await icon("comment")).x - 68)).toBe(0);
      expect(Math.abs((await icon("rebuild")).x - 68 - column * 0.207)).toBeLessThan(1.5);
      expect(Math.abs((await icon("like")).x - 68 - column * 0.42)).toBeLessThan(1.5);
      const save = await icon("save");
      expect(Math.abs(save.x + save.width - (width - 16))).toBeLessThan(1.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      // At rest the canvas is empty and the logo is shown.
      await expect(page.locator("[data-phone-logo] img")).toHaveCSS("opacity", "1");
    });
  }

  test(`phone Home at 390, ${theme}: the beaver refresh brings the new post to the top`, async ({ page }) => {
    await installPhoneStub(page, { newPostsOnRefetch: true });
    await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    // The atlas loads in an idle callback after the first paint.
    const atlas = page.waitForResponse((response) => response.url().includes("beaver-frames.webp"));
    await page.goto("/");
    await expect(page.locator("[data-feed-post]").first()).toBeVisible();
    await expect(page.getByText(NEW_BUILD.title)).toHaveCount(0);
    await atlas;
    await page.waitForTimeout(300);

    await drag(page, { x: 195, y: 160 }, 560, async (step) => {
      if (step === 6 || step === 16) await page.screenshot({ path: `e2e/phone/shots/home-29a-pull-${step}-${theme}.png` });
    });
    // Released past the arm point: the dive, then under while the refetch settles.
    await page.waitForTimeout(220);
    await page.screenshot({ path: `e2e/phone/shots/home-29a-dive-${theme}.png` });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `e2e/phone/shots/home-29a-under-${theme}.png` });
    await expect(page.getByTestId("ptr-live")).toHaveText(/new since you looked|up to date/, { timeout: 10_000 });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `e2e/phone/shots/home-29a-rise-${theme}.png` });

    // Back at rest: the feed closed, the logo shown, the new post first.
    await expect(page.locator("[data-phone-logo] img")).toHaveCSS("opacity", "1", { timeout: 3_000 });
    await expect(page.getByTestId("ptr-content")).toHaveAttribute("style", /^(?!.*translate)/);
    await expect(page.locator("[data-feed-post]").first()).toHaveAttribute("aria-label", NEW_BUILD.title);
    await page.screenshot({ path: `e2e/phone/shots/home-29a-return-${theme}.png` });
  });
}

test("phone Home: a drag while scrolled down just scrolls", async ({ page }) => {
  await installPhoneStub(page, { newPostsOnRefetch: true });
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto("/");
  await expect(page.locator("[data-feed-post]").first()).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(100);
  await drag(page, { x: 195, y: 160 }, 400);
  await page.waitForTimeout(500);
  await expect(page.getByTestId("ptr-live")).toHaveText("");
});

test("phone Home: with reduced motion there is no canvas", async ({ page }) => {
  await installPhoneStub(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-feed-post]").first()).toBeVisible();
  await expect(page.getByTestId("ptr-canvas")).toHaveCount(0);
});

for (const width of [1440, 1024]) {
  test(`desktop Home at ${width}: X's proportions, the pill kept`, async ({ page }) => {
    await installPhoneStub(page);
    await seenLongAgo(page, "dusk");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("home-new-pill")).toBeVisible();
    await page.getByTestId("home-new-pill").click();
    const post = page.locator("[data-feed-post]").first();
    await expect(post).toBeVisible();
    await page.screenshot({ path: `e2e/phone/shots/home-29a-desktop-${width}.png` });
    const item = (await page.getByTestId("home-feed-item").first().boundingBox())!;
    const avatar = (await post.locator("[data-feed-author-column] [data-ui='avatar']").boundingBox())!;
    expect(avatar.width).toBe(40);
    expect(Math.round(avatar.x - item.x)).toBe(16);
    const text = (await post.locator("[data-feed-author-row]").boundingBox())!;
    expect(Math.round(text.x - item.x)).toBe(64);
    await expect(page.getByTestId("ptr-canvas")).toHaveCount(0);
  });
}
