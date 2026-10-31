/* SV-04 P4: the composer shares the frame. Played on the built bundle by `npm run audit:pages`, on the audit database. */

import { expect, test, type Page } from "@playwright/test";

import { SV_DRAFT_ID } from "./fixtures/svPages";
import { installFrameTools, measureChange, readFrames, resetFrames } from "./support/frames";
import { stage, type Span } from "./support/pageStage";

const BASE_URL = process.env.PERF_BASE_URL ?? "";
const ready = (page: Page, mark: string) =>
  page.waitForFunction((name) => document.documentElement.getAttribute("data-page-ready") === name, mark, { timeout: 30_000 });

async function openDrafts(page: Page) {
  const spans: Span[] = [];
  await stage(page, { auth: true }, spans);
  await installFrameTools(page);
  await page.goto(`${BASE_URL}/drafts`, { waitUntil: "commit" });
  await ready(page, "drafts");
}

test.describe("SV-04 P4: the composer in the one frame", () => {
  test("Drafts to a draft and Back keep the header: the same element, the same data-frame-id", async ({ page }) => {
    await openDrafts(page);
    const id = await page.locator('[data-slot="header"]').getAttribute("data-frame-id");
    expect(id).toBeTruthy();
    await resetFrames(page, "drafts", "composer");
    await page.locator("#main").locator(`a[href="/compose/${SV_DRAFT_ID}"]`).first().click();
    await ready(page, "composer");
    let log = await readFrames(page);
    expect(measureChange(log, log.lastClick).headerKept).toBe(true);
    expect(await page.locator('[data-slot="header"]').getAttribute("data-frame-id")).toBe(id);
    await resetFrames(page, "composer", "drafts");
    await page.goBack();
    await ready(page, "drafts");
    log = await readFrames(page);
    expect(measureChange(log, log.lastPop).headerKept).toBe(true);
    expect(await page.locator('[data-slot="header"]').getAttribute("data-frame-id")).toBe(id);
  });

  test("opening a draft by its address: the frame and the composer skeleton from the first frame, never a blank window", async ({ page }) => {
    const spans: Span[] = [];
    await stage(page, { auth: true }, spans);
    await installFrameTools(page);
    await page.goto(`${BASE_URL}/compose/${SV_DRAFT_ID}`, { waitUntil: "commit" });
    await ready(page, "composer");
    const log = await readFrames(page);
    // From the first frame the app has drawn anything: the header is there and the page area is never empty.
    const drawn = log.frames.findIndex((frame) => frame.headerId !== "gone");
    expect(drawn).toBeGreaterThan(-1);
    const after = log.frames.slice(drawn).filter((frame) => frame.kind !== "ready");
    expect(after.filter((frame) => frame.kind === "empty")).toEqual([]);
    // One placeholder shape at most (the composer's skeleton); its content may draw a frame or two before its ready mark.
    expect(new Set(after.filter((frame) => frame.kind === "placeholder").map((frame) => frame.sig)).size, "one placeholder, the composer skeleton").toBeLessThanOrEqual(1);
  });

  test("New build shows the composer skeleton in its full shape, then the page: never blocks in one corner", async ({ page }) => {
    // From Home, where the session library Sources lists has not been read yet (Drafts reads it).
    const spans: Span[] = [];
    await stage(page, { auth: true }, spans);
    await page.goto(`${BASE_URL}/`, { waitUntil: "commit" });
    await ready(page, "home");
    await page.waitForTimeout(2_500);
    await page.evaluate(() => {
      (window as unknown as { __corner: number }).__corner = 0;
      const look = () => {
        const skeleton = document.querySelector('[data-testid="compose-skeleton"]');
        const blocks = document.querySelectorAll('#main [data-ui="skeleton"]').length;
        if (!skeleton && blocks > 0 && location.pathname.startsWith("/compose")) (window as unknown as { __corner: number }).__corner += 1;
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    await page.getByRole("button", { name: "New build", exact: true }).click();
    await ready(page, "composer");
    await page.waitForFunction(() => !document.querySelector('[data-testid="compose-skeleton"]'));
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as unknown as { __corner: number }).__corner)).toBe(0);
  });
});
