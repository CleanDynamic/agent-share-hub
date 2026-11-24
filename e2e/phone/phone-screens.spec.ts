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

test.describe("keyboard and name links at 390", () => {
  test.beforeEach(async ({ page }) => {
    await installPhoneStub(page);
    // A visual viewport the test can shrink the way a soft keyboard does: `__keyboard(px)` covers that many pixels.
    await page.addInitScript(() => {
      const target = new EventTarget();
      const fake = Object.assign(target, { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, scale: 1 });
      Object.defineProperty(window, "visualViewport", { value: fake, configurable: true });
      (window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px) => {
        fake.height = window.innerHeight - px;
        target.dispatchEvent(new Event("resize"));
      };
    });
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("the reply bar rides above the keyboard and returns when it closes", async ({ page }) => {
    await page.goto("/openbuilds/topics/t-open");
    const bar = page.getByTestId("reply-box");
    await expect(bar).toBeVisible();
    const rest = await bar.boundingBox();
    expect(Math.round((rest?.y ?? 0) + (rest?.height ?? 0))).toBe(844);
    await page.evaluate(() => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(300));
    await expect.poll(async () => Math.round(((await bar.boundingBox())?.y ?? 0) + ((await bar.boundingBox())?.height ?? 0))).toBe(844 - 300);
    await page.evaluate(() => (window as unknown as { __keyboard: (px: number) => void }).__keyboard(0));
    await expect.poll(async () => Math.round(((await bar.boundingBox())?.y ?? 0) + ((await bar.boundingBox())?.height ?? 0))).toBe(844);
  });

  test("the last reply scrolls clear of the bar", async ({ page }) => {
    await page.goto("/openbuilds/topics/t-open");
    const last = page.getByTestId("reply").last();
    await expect(last).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(async () => {
        const bar = await page.getByTestId("reply-box").boundingBox();
        const box = await last.boundingBox();
        return (bar?.y ?? 0) - ((box?.y ?? 0) + (box?.height ?? 0));
      })
      .toBeGreaterThanOrEqual(0);
  });

  test("author names in topic cards and replies are links with a 44 tall hit area", async ({ page }) => {
    await page.goto("/openbuilds/topics/t-open");
    const names = page.getByTestId("phone-author-name");
    await expect(names.first()).toBeVisible();
    for (const box of await Promise.all((await names.all()).map((n) => n.boundingBox()))) expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
