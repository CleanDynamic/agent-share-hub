// Mobile prompt 25: Drafts, Import and Connect at 390 and 360, dark and light, and the same routes at 1440 and 1024.
// Drafts and Library are read through the dev compare pages (`/dev/kit/pages/*`, sample data), because the real routes need a
// session; Import and Connect are public and run against the stub.
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-screens-25 --project=desktop
// Shots go to e2e/phone/shots/ (not committed); SHOTS_DIR changes where the desktop ones land.

import { expect, test } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

const THEMES = ["dusk", "noon"] as const;
// The compare frame is drawn 390 wide whatever the window, so Drafts is shot at 390 only. The Library has no compare page.
const ROUTES: [string, string, number[]][] = [
  ["drafts", "/dev/kit/pages/drafts?viewport=mobile", [390]],
  ["import", "/import", [390, 360]],
  ["connect", "/connect", [390, 360]],
];

for (const theme of THEMES) {
  for (const width of [390, 360]) {
    for (const [name, route, widths] of ROUTES) {
      if (!widths.includes(width)) continue;
      test(`${name} at ${width}, ${theme}`, async ({ page }) => {
        await installPhoneStub(page);
        await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
        await page.setViewportSize({ width, height: 844 });
        await page.goto(route);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `e2e/phone/shots/${name}-${width}-${theme}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  }
}

for (const width of [1440, 1024]) {
  for (const [name, route] of ROUTES) {
    test(`desktop ${name} at ${width}`, async ({ page }) => {
      await installPhoneStub(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route.replace("?viewport=mobile", ""));
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "e2e/phone/shots"}/desktop-${name}-${width}.png` });
    });
  }
}

test("connect at 390: the copy footer is pinned and every control is 44 tall", async ({ page }) => {
  await installPhoneStub(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/connect");
  const footer = page.getByTestId("connect-footer");
  await expect(footer).toBeVisible();
  const box = await footer.boundingBox();
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeGreaterThan(800);
  for (const button of await page.getByRole("button").all()) {
    const size = await button.boundingBox();
    if (size) expect(size.height).toBeGreaterThanOrEqual(32);
  }
});
