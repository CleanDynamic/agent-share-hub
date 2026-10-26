/* SV-04 P3: one fade, on the compositor. Played on the built bundle by `npm run audit:pages`, on the audit database.

   Home, then Builds from the nav once its code is in (the idle loader brings it). The frame tools (support/frames.ts)
   read every frame of the change: the header's box, and the page area's opacity in the view transition, old and new. */

import { expect, test, type Page } from "@playwright/test";

import { installFrameTools, readFrames, resetFrames, type FrameLog } from "./support/frames";
import { stage, type Span } from "./support/pageStage";

const BASE_URL = process.env.PERF_BASE_URL ?? "";

async function open(page: Page) {
  const spans: Span[] = [];
  await stage(page, { auth: true }, spans);
  await installFrameTools(page);
  await page.goto(`${BASE_URL}/`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.documentElement.getAttribute("data-page-ready") === "home");
  // The idle loader brings Builds' code; then its first reads, so the change is the fade alone.
  await page.waitForTimeout(2_500);
}

async function change(page: Page): Promise<FrameLog> {
  await resetFrames(page, "home", "builds");
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: /^Builds/ }).click();
  await page.waitForFunction(() => document.documentElement.getAttribute("data-page-ready") === "builds");
  await page.waitForTimeout(400);
  return readFrames(page);
}

/** Frames from the click, until the new page is ready and no fade is running. */
const during = (log: FrameLog) => log.frames.filter((frame) => frame.t >= log.lastClick);

/** The frame after the old page's last is the new page (its loading state or its content): nothing in between. */
function expectOneFrame(frames: FrameLog["frames"]) {
  const lastOld = frames.findLastIndex((frame) => frame.kind === "old");
  expect(lastOld).toBeGreaterThan(-1);
  expect(["placeholder", "ready"]).toContain(frames[lastOld + 1]?.kind);
  expect(frames.some((frame) => frame.kind === "ready")).toBe(true);
}

test.describe("SV-04 P3: the page fade", () => {
  test("the header's box does not move in any frame of a page change, and only the page area fades", async ({ page }) => {
    await open(page);
    const frameAnimations: string[] = [];
    await page.exposeFunction("noteAnimation", (name: string) => frameAnimations.push(name));
    await page.evaluate(() => {
      const look = () => {
        for (const animation of document.getAnimations()) {
          const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement ?? "";
          if (pseudo.startsWith("::view-transition")) (window as unknown as { noteAnimation: (name: string) => void }).noteAnimation(pseudo);
        }
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    });
    const log = await change(page);
    const frames = during(log);
    const top = frames[0].header;
    expect(top).not.toBeNull();
    for (const frame of frames) {
      expect(frame.headerSame, "the header is the same element").toBe(true);
      expect(frame.header?.y).toBeCloseTo(top!.y, 0);
      expect(frame.header?.x).toBeCloseTo(top!.x, 0);
      expect(frame.header?.height).toBeCloseTo(top!.height, 0);
    }
    expect(new Set(frameAnimations)).toEqual(new Set(["::view-transition-old(page)", "::view-transition-new(page)"]));
  });

  test("the page area's opacity runs from the old page to the new in about 150 ms", async ({ page }) => {
    await open(page);
    const log = await change(page);
    const fading = during(log).filter((frame) => frame.fade !== null);
    expect(fading.length, "frames with a view transition running").toBeGreaterThan(3);
    const first = fading[0].fade!;
    const last = fading.at(-1)!.fade!;
    expect(first[0]).toBeGreaterThan(0.5);
    expect(first[1]).toBeLessThan(0.5);
    expect(last[0]).toBeLessThan(0.3);
    expect(last[1]).toBeGreaterThan(0.7);
    const span = fading.at(-1)!.t - fading[0].t;
    expect(span).toBeGreaterThan(90);
    expect(span).toBeLessThan(220);
    // Old and new move together: as one goes down the other comes up.
    for (const frame of fading) expect(frame.fade![0] + frame.fade![1]).toBeGreaterThan(0.6);
  });

  test("under reduced motion the page changes in one frame, with no fade", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    const log = await change(page);
    const frames = during(log);
    expect(frames.filter((frame) => frame.fade !== null)).toEqual([]);
    expectOneFrame(frames);
  });

  test("a browser without startViewTransition changes page at once", async ({ page }) => {
    await page.addInitScript(() => {
      delete (Document.prototype as unknown as { startViewTransition?: unknown }).startViewTransition;
    });
    await open(page);
    expect(await page.evaluate(() => "startViewTransition" in document)).toBe(false);
    const log = await change(page);
    const frames = during(log);
    expect(frames.filter((frame) => frame.fade !== null)).toEqual([]);
    expectOneFrame(frames);
  });
});
