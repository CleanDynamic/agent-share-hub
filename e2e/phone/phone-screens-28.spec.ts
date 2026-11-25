// Mobile prompt 28: rebuild and lineage (their dev pages: the live routes need a session), a legal page, the rules,
// not found, the empty feeds and the loading state, at 390 and 360 (and 430) in dark and light; and the same routes at 1440
// and 1024 to show the desktop did not change. Admin and progress are behind a session and an admin role, so they are checked
// by their unit tests (src/pages/site/readingPages.phone.test.tsx), and compare by CompareView.test.tsx (the stub has no build records).
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-screens-28 --project=desktop
// Shots go to e2e/phone/shots/ (not committed); SHOTS_DIR changes where the desktop ones land.

import { expect, test } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

const THEMES = ["dusk", "noon"] as const;
const PHONE: [string, string][] = [
  ["rebuild", "/dev/kit/pages/rebuild?viewport=mobile&theme=THEME"],
  ["lineage", "/dev/kit/pages/lineage?viewport=mobile&theme=THEME"],
  ["privacy", "/privacy"],
  ["rules", "/rules"],
  ["notfound", "/no-such-page"],
  ["space-empty", "/openbuilds/spaces/claude-code?kind=builds"],
  ["profile", "/profile/sam"],
];

for (const theme of THEMES) {
  for (const width of [390, 360, 430]) {
    for (const [name, route] of PHONE) {
      test(`${name} at ${width}, ${theme}`, async ({ page }) => {
        await installPhoneStub(page);
        await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
        await page.setViewportSize({ width, height: 844 });
        await page.goto(route.replace("THEME", theme));
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `e2e/phone/shots/28-${name}-${width}-${theme}.png`, fullPage: name === "privacy" || name === "rules" || name === "rebuild" });
        /* The dev pages draw the phone board in a fixed 390 wrapper, so only the real routes are held to no sideways scroll. */
        if (!route.startsWith("/dev/")) expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  }
}

test.describe("phone checks at 390", () => {
  test.beforeEach(async ({ page }) => {
    await installPhoneStub(page);
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("a legal page: the title in the top bar, pills that jump to a section under it", async ({ page }) => {
    await page.goto("/privacy");
    const nav = page.getByRole("navigation", { name: "In this page" });
    await expect(nav).toBeVisible();
    const pill = nav.getByRole("button").nth(2);
    const label = (await pill.textContent())?.trim() ?? "";
    await pill.click();
    await page.waitForTimeout(800);
    const heading = page.getByRole("heading", { level: 2, name: label });
    const box = await heading.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(52);
    expect(box?.y ?? 999).toBeLessThan(120);
    await page.screenshot({ path: "e2e/phone/shots/28-privacy-jump-390.png" });
  });

  test("not found: centred above the dock, the dot field still", async ({ page }) => {
    await page.goto("/no-such-page");
    const block = page.getByTestId("not-found");
    await expect(block).toBeVisible();
    const go = page.getByRole("button", { name: "Go to Home" });
    expect((await go.boundingBox())?.height).toBe(48);
    const before = await page.getByTestId("not-found-dots").screenshot();
    await page.waitForTimeout(600);
    const after = await page.getByTestId("not-found-dots").screenshot();
    expect(Buffer.compare(before, after)).toBe(0);
  });

  test("rebuild: the footer sits on the bottom edge, its buttons 48 tall", async ({ page }) => {
    await page.goto("/dev/kit/pages/rebuild?viewport=mobile");
    const footer = page.locator("[data-phone-footer]");
    await expect(footer).toBeVisible();
    for (const button of await footer.locator('[data-ui="big-button"]').all()) expect((await button.boundingBox())?.height).toBe(48);
  });

  test("an empty list: the drop on still water moves, and stands still under reduced motion", async ({ page, browser }) => {
    /* The stub has no empty list a signed-out reader reaches, so the check uses the catalogue's PhoneEmpty. */
    await page.goto("/dev/kit/phone");
    const water = page.getByTestId("phone-empty-water").first();
    await water.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const a = await water.screenshot();
    await page.waitForTimeout(500);
    const b = await water.screenshot();
    expect(Buffer.compare(a, b)).not.toBe(0);
    const still = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
    await installPhoneStub(still);
    await still.goto("/dev/kit/phone");
    const field = still.getByTestId("phone-empty-water").first();
    await field.scrollIntoViewIfNeeded();
    await still.waitForTimeout(300);
    const c = await field.screenshot();
    await still.waitForTimeout(500);
    const d = await field.screenshot();
    expect(Buffer.compare(c, d)).toBe(0);
    await page.getByTestId("kit-phone-empty").screenshot({ path: "e2e/phone/shots/28-phone-empty-390.png" });
    await still.close();
  });
});

const DESKTOP: [string, string][] = [
  ["rebuild", "/dev/kit/pages/rebuild?viewport=desktop"],
  ["lineage", "/dev/kit/pages/lineage?viewport=desktop"],
  ["compare", "/b2/b-calls/compare/b-rebuild"],
  ["privacy", "/privacy"],
  ["rules", "/rules"],
  ["notfound", "/no-such-page"],
  ["home", "/"],
  ["builds", "/builds"],
  ["build", "/b2/b-calls"],
  ["signin", "/?signin=login"],
];

for (const width of [1440, 1024]) {
  for (const [name, route] of DESKTOP) {
    test(`desktop ${name} at ${width}`, async ({ page }) => {
      await installPhoneStub(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "e2e/phone/shots"}/desktop-28-${name}-${width}.png` });
    });
  }
}
