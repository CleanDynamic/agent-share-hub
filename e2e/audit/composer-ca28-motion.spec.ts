/* CA-28 P6: the Optional section's motion on Add a tool, paused at three moments, and the frame's centre held through it.

     PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-ca28-motion

   Written to design/audits/composer/ca-28/motion/tool-<opening|closing>-<ms>-dusk-1440.png. The animations are paused and set to a time,
   so the shots do not depend on how long a screenshot takes. */

import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/ca-28/motion";

const open = async (page: Page, theme = "dusk") => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1400 });
  await page.goto(`/dev/kit/pages/sandbox?build=ca28&theme=${theme}&window=tool`);
  await page.locator('[role="dialog"]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
};

const centre = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[role="dialog"]') as HTMLElement;
    const box = frame.getBoundingClientRect();
    return (box.top + box.bottom) / 2;
  });

/** The middle of what the clip leaves showing, from the frame's computed clip-path. */
const shownCentre = (page: Page) =>
  page.evaluate(() => {
    const frame = document.querySelector('[role="dialog"]') as HTMLElement;
    const box = frame.getBoundingClientRect();
    // The computed value is the shortest form: "370px -96px" (top and bottom, then the sides), or four values.
    const values = (/inset\(([^)]*?)(?:\s+round[^)]*)?\)/.exec(getComputedStyle(frame).clipPath)?.[1] ?? "0px").trim().split(/\s+/).map(parseFloat);
    const top = values[0];
    const bottom = values.length >= 3 ? values[2] : values[0];
    return { centre: (box.top + top + (box.bottom - bottom)) / 2, cut: top };
  });

const pauseAt = (page: Page, ms: number) =>
  page.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
  }, ms);

/** Presses the toggle from inside the page and, once React has drawn, pauses what it started at `ms`, in the same task: no frame is missed. */
const pressAndPause = (page: Page, ms: number) =>
  page.evaluate(async (time) => {
    (document.querySelector('[data-testid="optional-toggle"]') as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
  }, ms);

test("composer/ca-28/motion/opening: three moments, the centre held", async ({ page }) => {
  await open(page);
  const before = await centre(page);
  await pressAndPause(page, 0);
  const first = await shownCentre(page);
  expect(first.cut).toBeGreaterThan(0);
  expect(Math.abs(first.centre - before)).toBeLessThan(1);
  for (const ms of [60, 150, 300]) {
    await pauseAt(page, ms);
    const now = await shownCentre(page);
    expect(Math.abs(now.centre - before), `centre at ${ms} ms`).toBeLessThan(1);
    await page.screenshot({ path: `${OUT}/tool-opening-${ms}-dusk-1440.png` });
  }
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await page.waitForTimeout(100);
  expect(Math.abs((await centre(page)) - before)).toBeLessThan(1);
});

test("composer/ca-28/motion/closing: the lift, then the frame", async ({ page }) => {
  await open(page);
  const toggle = page.getByTestId("optional-toggle");
  await toggle.click();
  await page.waitForTimeout(1200);
  const before = await centre(page);
  await pressAndPause(page, 100);
  await page.screenshot({ path: `${OUT}/tool-closing-100-dusk-1440.png` });
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await page.waitForTimeout(60);
  await pauseAt(page, 100);
  await page.screenshot({ path: `${OUT}/tool-closing-frame-100-dusk-1440.png` });
  await page.evaluate(() => document.getAnimations().forEach((animation) => animation.finish()));
  await page.waitForTimeout(400);
  expect(Math.abs((await centre(page)) - before)).toBeLessThan(1);
  expect(await toggle.getAttribute("aria-expanded")).toBe("false");
});

test("composer/ca-28/motion/reduced: opens at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await page.getByTestId("optional-toggle").click();
  expect(await page.evaluate(() => document.getAnimations().filter((animation) => String(animation.id).startsWith("bm:")).length)).toBe(0);
  expect(await page.getByTestId("optional-field").count()).toBeGreaterThan(0);
});
