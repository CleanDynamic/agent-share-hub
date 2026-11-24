// Prompt 21: the phone routes against the stub, screenshotted at 390, 360 and 430 in dark and light, and Home at 1440.
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone --project=desktop
// Shots go to e2e/phone/shots/ (not committed).

import { expect, test } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

const WIDTHS = [390, 360, 430];
const THEMES = ["dusk", "noon"] as const;
const ROUTES: [string, string][] = [
  ["home", "/"],
  ["openbuilds", "/openbuilds"],
  ["space", "/openbuilds/spaces/claude-code"],
  ["topic", "/openbuilds/topics/t-open"],
];

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const [name, route] of ROUTES) {
      test(`${name} at ${width}, ${theme}`, async ({ page }) => {
        const log = await installPhoneStub(page);
        await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
        await page.setViewportSize({ width, height: 844 });
        await page.goto(route);
        await page.waitForTimeout(3500);
        if (process.env.PHONE_LOG) console.log(name, JSON.stringify([...log.tables]), JSON.stringify([...log.urls].map(([k, v]) => [k, v.map((q) => q.length > 260 ? q.slice(-160) : q)])));
        await page.screenshot({ path: `e2e/phone/shots/${name}-${width}-${theme}.png` });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    }
  }
}

// The desktop must not have changed: the same routes at 1440 and 1024, written to SHOTS_DIR so a run on the commit before
// can be compared with a run after (SHOTS_DIR=e2e/phone/shots-before).
for (const width of [1440, 1024]) {
  for (const [name, route] of ROUTES) {
    test(`desktop ${name} at ${width}`, async ({ page }) => {
      await installPhoneStub(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "e2e/phone/shots"}/desktop-${name}-${width}.png` });
    });
  }
}

test.describe("phone checks at 390", () => {
  test.beforeEach(async ({ page }) => {
    await installPhoneStub(page);
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("a feed author name has a 44 tall hit area", async ({ page }) => {
    await page.goto("/");
    const name = page.getByTestId("feed-author-name").first();
    await expect(name).toBeVisible();
    const box = await name.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("a topic has its reply bar and no visible dock", async ({ page }) => {
    await page.goto("/openbuilds/topics/t-open");
    await expect(page.getByTestId("reply-box")).toBeVisible();
    await page.waitForTimeout(500);
    const dock = await page.getByTestId("dock").boundingBox();
    expect(dock === null || dock.y >= 844).toBe(true);
    await expect(page.getByRole("button", { name: "Attach work" })).toBeHidden();
  });

  test("search shows the busy spaces with the field empty", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search builds" })).toBeVisible();
    const busy = page.getByTestId("search-busy-spaces");
    await expect(busy).toBeVisible();
    await expect(busy.getByText("3 new posts this week")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search builds" }).fill("calls");
    await expect(busy).toBeHidden();
  });
});
