// Mobile prompt 27: the phone sign-in (the whole screen is the water, a card fixed to the bottom), onboarding, authorise an application,
// at 390 and 360, dark and light, and the sign-in at 1440 and 1024 to show the desktop dialog is unchanged.
// Settings is behind a session, so it is checked by its unit tests and the compare pages; the other routes here are public.
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-screens-27 --project=desktop
// Shots go to e2e/phone/shots/ (not committed); SHOTS_DIR changes where the desktop ones land.

import { expect, test } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

const THEMES = ["dusk", "noon"] as const;

for (const theme of THEMES) {
  for (const width of [390, 360]) {
    test(`sign in at ${width}, ${theme}: the water, the card, a hold and a tap`, async ({ page }) => {
      await installPhoneStub(page);
      await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/?signin=login");
      const card = page.locator("[data-occlude]");
      await expect(card).toBeVisible();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `e2e/phone/shots/signin-${width}-${theme}.png` });
      // The card sits on the bottom edge and every button in it is 48 tall (the pills and links grow their hit area to 44 in CSS).
      const box = await card.boundingBox();
      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
      for (const control of await card.locator('[data-ui="big-button"]').all()) {
        const size = await control.boundingBox();
        expect(size?.height).toBe(48);
      }
      // A finger held on the water makes a hollow; a quick tap splashes in code.
      const canvas = page.getByTestId("signin-water");
      await page.mouse.move(width * 0.5, 120);
      await page.mouse.down();
      await page.mouse.move(width * 0.3, 200, { steps: 8 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: `e2e/phone/shots/signin-hold-${width}-${theme}.png` });
      await page.mouse.up();
      await page.waitForTimeout(600);
      await page.mouse.click(width * 0.6, 150);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `e2e/phone/shots/signin-tap-${width}-${theme}.png` });
      await expect(canvas).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test(`sign in at 390, ${theme}: reduced motion draws one still frame`, async ({ page }) => {
    await installPhoneStub(page);
    await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?signin=login");
    await expect(page.locator("[data-occlude]")).toBeVisible();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `e2e/phone/shots/signin-still-390-${theme}.png` });
  });

  test(`sign up at 390, ${theme}`, async ({ page }) => {
    await installPhoneStub(page);
    await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/?signin=signup");
    await expect(page.locator("[data-occlude]")).toBeVisible();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `e2e/phone/shots/signup-390-${theme}.png` });
  });
}

for (const width of [1440, 1024]) {
  test(`desktop sign in at ${width}`, async ({ page }) => {
    await installPhoneStub(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?signin=login");
    await expect(page.getByRole("dialog", { name: "Sign in" })).toBeVisible();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "e2e/phone/shots"}/desktop-signin-${width}.png` });
    expect(await page.locator("[data-occlude]").count()).toBe(0);
  });
}
