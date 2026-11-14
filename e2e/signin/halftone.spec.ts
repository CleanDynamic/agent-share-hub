// G17 to G20: the halftone layer around the sign-in dialog. RUN AGAINST MOCKS (e2e/signin/support.ts).
import { expect, test, type Page } from "@playwright/test";

import { stub } from "./support";

/** Count the animation frames the dots engine asks for: calls to requestAnimationFrame whose stack goes through it. */
async function countEngineFrames(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __engineFrames: number };
    w.__engineFrames = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      if (/\/src\/lib\/dots\/engine\.ts|\/assets\/engine-/.test(new Error().stack ?? "")) w.__engineFrames += 1;
      return original(callback);
    };
  });
}
const engineFrames = (page: Page) => page.evaluate(() => (window as unknown as { __engineFrames: number }).__engineFrames);

const layer = (page: Page) => page.getByTestId("signin-halftone");

async function openOver(page: Page) {
  await page.goto("/builds");
  await page.waitForLoadState("networkidle");
  await page.getByRole("banner").getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("signin-dialog").waitFor();
}

/** The largest alpha drawn inside the dialog's rectangle shrunk by `inset` on every side. */
const alphaInside = (page: Page, inset: number) =>
  page.evaluate((inset) => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="signin-halftone"]')!;
    const dialog = document.querySelector<HTMLElement>('[data-testid="signin-dialog"]')!;
    const ratio = canvas.width / canvas.clientWidth;
    const left = Math.ceil((dialog.offsetLeft + inset) * ratio);
    const top = Math.ceil((dialog.offsetTop + inset) * ratio);
    const width = Math.floor((dialog.offsetWidth - 2 * inset) * ratio);
    const height = Math.floor((dialog.offsetHeight - 2 * inset) * ratio);
    const data = canvas.getContext("2d")!.getImageData(left, top, width, height).data;
    let max = 0;
    for (let i = 3; i < data.length; i += 4) max = Math.max(max, data[i]);
    return max;
  }, inset);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page);
  await countEngineFrames(page);
});

test("G17: no canvas and no frames while closed; while open a fixed, full, inert layer between scrim and dialog", async ({ page }) => {
  await page.goto("/builds");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await expect(layer(page)).toHaveCount(0);
  expect(await engineFrames(page)).toBe(0);

  await page.getByRole("banner").getByRole("button", { name: "Sign in" }).click();
  await expect(layer(page)).toHaveCount(1);
  const info = await layer(page).evaluate((canvas) => {
    const style = getComputedStyle(canvas);
    const r = canvas.getBoundingClientRect();
    canvas.focus();
    const z = (id: string) => Number(getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!).zIndex);
    return {
      rect: [r.x, r.y, r.width, r.height],
      position: style.position,
      pointerEvents: style.pointerEvents,
      focused: document.activeElement === canvas,
      tabbable: canvas.tabIndex >= 0,
      hidden: canvas.getAttribute("aria-hidden"),
      z: [z("signin-scrim"), Number(style.zIndex), z("signin-dialog")],
    };
  });
  expect(info).toEqual({ rect: [0, 0, 1440, 900], position: "fixed", pointerEvents: "none", focused: false, tabbable: false, hidden: "true", z: [50, 51, 52] });
  await expect.poll(() => engineFrames(page)).toBeGreaterThan(10);
});

test("G18: no dot is drawn more than 6px inside the dialog", async ({ page }) => {
  await openOver(page);
  // A dot whose centre is 6px inside, at its largest there (the moat holds it to 0.3 of full), reaches 1.02px further.
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    expect(await alphaInside(page, 6 + 1.03)).toBe(0);
  }
  // And it does draw right up to the edge.
  expect(await alphaInside(page, -12)).toBeGreaterThan(0);
});

test("G19: after close the layer winds down, then the canvas goes once back > 520 (about 1.86s) and the frames stop", async ({ page }) => {
  await openOver(page);
  await page.waitForTimeout(2500);
  const closed = await page.evaluate(() => performance.now());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1200);
  await expect(layer(page)).toHaveCount(1);
  await expect(layer(page)).toHaveCount(0, { timeout: 3000 });
  const gone = await page.evaluate(() => performance.now());
  expect(gone - closed).toBeGreaterThan(520 / 280 * 1000 - 100);
  const frames = await engineFrames(page);
  await page.waitForTimeout(500);
  expect(await engineFrames(page)).toBe(frames);
});

test("G20: under reduced motion one still frame is drawn, and nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openOver(page);
  await expect(layer(page)).toHaveCount(1);
  const snapshot = () => layer(page).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await page.waitForTimeout(300);
  const first = await snapshot();
  await page.mouse.move(200, 300);
  await page.mouse.move(260, 340);
  await page.waitForTimeout(1000);
  expect(await snapshot()).toBe(first);
  expect(first.length).toBeGreaterThan(5000);
  expect(await engineFrames(page)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(layer(page)).toHaveCount(0, { timeout: 500 });
});
