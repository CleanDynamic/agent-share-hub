/* SV-04 P6: scroll. Played on the built bundle by `npm run audit:pages`, on the audit database, at 1440 x 700 so Builds
   has room to scroll. */

import { expect, test, type Page } from "@playwright/test";

import { installFrameTools, readFrames, resetFrames } from "./support/frames";
import { BUILD_SLUG } from "./support/harness";
import { stage, type Span } from "./support/pageStage";

const BASE_URL = process.env.PERF_BASE_URL ?? "";
const ready = (page: Page, mark: string) =>
  page.waitForFunction((name) => document.documentElement.getAttribute("data-page-ready") === name, mark, { timeout: 30_000 });

async function open(page: Page, path: string, mark: string) {
  const spans: Span[] = [];
  await page.setViewportSize({ width: 1440, height: 700 });
  await stage(page, { auth: true }, spans);
  await installFrameTools(page);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "commit" });
  await ready(page, mark);
}

test.describe("SV-04 P6: scroll", () => {
  test("Builds, scrolled, then a build, then Back: the build opens at the top, and Builds is where it was in its first frame", async ({ page }) => {
    await open(page, "/builds", "builds");
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(300);
    const left = await page.evaluate(() => Math.round(window.scrollY));
    expect(left).toBeGreaterThan(100);

    await resetFrames(page, "builds", "build");
    await page.locator("#main").locator('a[href^="/b2/"]').first().click();
    await ready(page, "build");
    let log = await readFrames(page);
    const opened = log.frames.filter((frame) => frame.t > log.lastClick && frame.kind !== "old");
    expect(opened.length).toBeGreaterThan(0);
    expect(opened[0].scrollY, "the build's first frame").toBeLessThanOrEqual(4);

    await page.waitForTimeout(300);
    await resetFrames(page, "build", "builds");
    await page.goBack({ waitUntil: "commit" });
    await ready(page, "builds");
    await page.waitForTimeout(200);
    log = await readFrames(page);
    const back = log.frames.filter((frame) => frame.t > log.lastPop && frame.kind === "ready");
    expect(back.length).toBeGreaterThan(0);
    expect(Math.abs(back[0].scrollY - left), "Builds' first frame after Back").toBeLessThanOrEqual(4);
  });

  test("an address with a #hash opens at its target", async ({ page }) => {
    await open(page, `/b2/${BUILD_SLUG}#build-tabpanel`, "build");
    await page.waitForTimeout(400);
    const at = await page.evaluate(() => {
      const target = document.getElementById("build-tabpanel");
      return target ? { top: target.getBoundingClientRect().top, margin: parseFloat(getComputedStyle(target).scrollMarginTop) || 0 } : null;
    });
    const y = await page.evaluate(() => window.scrollY);
    expect(at).not.toBeNull();
    expect(y).toBeGreaterThan(0);
    // The target's top lands at its own scroll-margin-top (the phone's panel keeps 72 clear of the header).
    expect(Math.abs(at!.top - at!.margin)).toBeLessThanOrEqual(4);
  });
});
