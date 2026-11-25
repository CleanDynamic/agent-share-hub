// Mobile 29 audit, the pages behind a session: Activity, Your progress, Admin and Rebuild, signed in as Maya through the
// stub (a seeded session; every request answered locally), at 390 and 360 in dark and light. Each route is screenshotted
// and checked for what prompt 28 puts on it, with no sideways scroll and an h1.
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-signed-in-29 --project=desktop

import { expect, test, type Page } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

const THEMES = ["dusk", "noon"] as const;

async function open(page: Page, path: string, theme: string, width: number, admin = false) {
  await installPhoneStub(page, { signedIn: { admin } });
  await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
  await page.setViewportSize({ width, height: 844 });
  await page.goto(path);
}

async function common(page: Page) {
  await page.waitForSelector("h1", { state: "attached", timeout: 10_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const theme of THEMES) {
  for (const width of [390, 360]) {
    test(`activity at ${width}, ${theme}: the top bar names it, and an empty list is the drop on still water`, async ({ page }) => {
      await open(page, "/notifications", theme, width);
      await expect(page.getByText("All caught up.")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("phone-empty-water")).toBeVisible();
      await common(page);
      await page.screenshot({ path: `e2e/phone/shots/29-signed-in-activity-${width}-${theme}.png` });
    });

    test(`progress at ${width}, ${theme}: the Level module, then each build with its Views`, async ({ page }) => {
      await open(page, "/analytics", theme, width);
      const level = page.getByTestId("progress-level");
      await expect(level.getByRole("heading", { level: 2, name: /^Level \d+$/ })).toBeVisible({ timeout: 10_000 });
      await expect(level.getByTestId("progress-level-line")).toContainText("1,240 XP");
      await expect(level.getByRole("progressbar")).toBeVisible();
      const card = page.getByTestId("build-stats-row").first();
      await expect(card).toBeVisible();
      await expect(card.locator("dt").first()).toHaveText("Views");
      await expect(card.locator("dd").first()).toHaveText("1,530");
      await expect(page.getByRole("heading", { level: 1, name: "Your progress" })).toHaveClass(/sr-only/);
      await common(page);
      await page.screenshot({ path: `e2e/phone/shots/29-signed-in-progress-${width}-${theme}.png`, fullPage: true });
    });

    test(`admin at ${width}, ${theme}: the six tabs, a report as a module, and its detail pushed`, async ({ page }) => {
      await open(page, "/admin", theme, width, true);
      const tabs = page.getByRole("tablist", { name: "Admin sections" });
      await expect(tabs).toBeVisible({ timeout: 10_000 });
      await expect(tabs.getByRole("tab")).toHaveCount(6);
      const report = page.getByTestId("report-row").first();
      await expect(report).toBeVisible();
      await expect(report.getByRole("button", { name: "Hide" })).toBeVisible();
      await expect(report.getByRole("button", { name: "Dismiss" })).toBeVisible();
      for (const control of await report.getByRole("button").all()) expect((await control.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      await common(page);
      await page.screenshot({ path: `e2e/phone/shots/29-signed-in-admin-${width}-${theme}.png` });
      await report.locator("p").first().click();
      await expect(page.getByTestId("admin-detail-page")).toBeVisible();
      /* The push enters from the right in BASE (200ms); shoot it once it has arrived. */
      await page.waitForTimeout(400);
      await page.screenshot({ path: `e2e/phone/shots/29-signed-in-admin-detail-${width}-${theme}.png` });
      await page.getByTestId("push-back").click();
      await expect(page.getByTestId("admin-detail-page")).toHaveCount(0);
    });

    test(`rebuild at ${width}, ${theme}: the source, the credit, what changed, readiness and the pinned footer`, async ({ page }) => {
      await open(page, "/rebuild/b-invoice", theme, width);
      await expect(page.getByText("Rebuilt from", { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("rebuild-source-title")).toHaveText("Invoice chaser");
      await expect(page.getByRole("heading", { level: 2, name: "The credit it will carry" })).toBeVisible();
      await expect(page.getByTestId("readiness-panel")).toBeVisible();
      const footer = page.locator("[data-phone-footer]");
      await expect(footer).toBeVisible();
      const box = await footer.boundingBox();
      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
      for (const button of await footer.locator('[data-ui="big-button"]').all()) expect((await button.boundingBox())?.height).toBe(48);
      /* The dock is hidden on Rebuild: the footer takes the bottom edge. */
      expect(await page.locator("nav[aria-label='Primary']").count()).toBe(0);
      await common(page);
      await page.screenshot({ path: `e2e/phone/shots/29-signed-in-rebuild-${width}-${theme}.png` });
      /* Publish while not ready takes the reader to what is missing. */
      if ((await page.getByTestId("rebuild-publish").getAttribute("aria-disabled")) === "true") {
        /* aria-disabled, not disabled: Playwright will not press it unless told to, but a finger can, and should be answered. */
        await page.getByTestId("rebuild-publish").click({ force: true });
        await expect(page.getByTestId("readiness-panel")).toBeInViewport();
      }
    });
  }
}

test.describe("a build's views (mobile 28 D)", () => {
  const viewCalls = (page: Page) => {
    const bodies: Record<string, unknown>[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rest/v1/rpc/record_build_view")) bodies.push(JSON.parse(request.postData() ?? "{}"));
    });
    return bodies;
  };

  test("a signed-out visit asks nothing, and nothing is stored in the browser for counting", async ({ page }) => {
    await installPhoneStub(page);
    const bodies = viewCalls(page);
    await page.goto("/b2/b-invoice");
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached({ timeout: 10_000 });
    await page.waitForTimeout(2000);
    expect(bodies).toHaveLength(0);
    const keys = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
    expect(keys.filter((key) => /visitor|view/i.test(key))).toEqual([]);
  });

  test("a signed-in reader's reload in the same page load is one ask", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    const bodies = viewCalls(page);
    await page.goto("/b2/b-invoice");
    await expect.poll(() => bodies.length, { timeout: 10_000 }).toBe(1);
    await page.getByRole("heading", { level: 1 }).waitFor({ state: "attached" });
    await page.waitForTimeout(1500);
    expect(bodies).toHaveLength(1);
  });

  test("the maker's own build is not counted", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    const bodies = viewCalls(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/b2/b-calls");
    await page.waitForTimeout(3000);
    expect(bodies).toHaveLength(0);
  });

  test("someone else's build, signed in, asks once with no visitor id", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    const bodies = viewCalls(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/b2/b-invoice");
    await expect.poll(() => bodies.length, { timeout: 10_000 }).toBe(1);
    expect(bodies[0]).toEqual({ p_build: "b-invoice" });
  });
});
