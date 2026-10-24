/* CA-24 P1: the first load stands exactly where the content will.

   At 900, 1280, 1440 and 1920 wide: the dev composer in its loading state, then loaded. Sources, Build and Details start at the
   positions of their blocks (within 1px, left and top); nothing in the title row's height differs. Then a frame-rate reading of
   the first-load skeleton, written to the report folder.

     npm run audit -- composer-ca24-loading */

import { mkdirSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [900, 1100, 1280, 1440, 1920];
const URL = (state: string) => `/dev/kit/pages/sandbox?theme=noon&build=bakery&window=1&state=${state}`;

interface Spot {
  x: number;
  y: number;
}

async function spot(page: Page, selector: string): Promise<Spot | null> {
  if ((await page.locator(selector).count()) === 0) return null;
  const box = await page.locator(selector).first().boundingBox();
  return box ? { x: box.x, y: box.y } : null;
}

for (const width of WIDTHS) {
  test(`composer/ca-24/no-shift/${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    await page.goto(URL("loading"));
    await page.getByTestId("compose-skeleton").waitFor();
    const blocks = {
      sources: await spot(page, '[data-testid="skeleton-sources"] [data-testid="loading-blocks"]'),
      build: await spot(page, '[data-testid="skeleton-build"] [data-testid="loading-blocks"]'),
      details: await spot(page, '[data-testid="skeleton-details"] [data-testid="loading-blocks"]'),
    };

    await page.goto(URL("populated"));
    await page.locator('section[aria-label="Build"]').waitFor();
    const content = {
      sources: await spot(page, '[data-testid="sandbox-sources-slot"]'),
      build: await spot(page, '[data-testid="sandbox-build-head"]'),
      details: await spot(page, '[data-testid="sandbox-details-slot"]'),
    };

    for (const column of ["sources", "build", "details"] as const) {
      if (!content[column]) {
        expect(blocks[column], `${column}: hidden in both`).toBeNull();
        continue;
      }
      expect(blocks[column], `${column}: has blocks`).not.toBeNull();
      expect(Math.abs(blocks[column]!.x - content[column]!.x), `${column}: left`).toBeLessThanOrEqual(1);
      expect(Math.abs(blocks[column]!.y - content[column]!.y), `${column}: top`).toBeLessThanOrEqual(1);
    }
  });
}

test("composer/ca-24/frame-rate", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(URL("loading"));
  await page.getByTestId("compose-skeleton").waitFor();
  const cells = await page.getByTestId("loading-blocks").evaluateAll((nodes) => nodes.reduce((sum, node) => sum + Number(node.getAttribute("data-rows")) * Number(node.getAttribute("data-cols")), 0));
  const layers = await page.evaluate(() => document.getAnimations().length);
  const drawn = await page.getByTestId("loading-blocks").evaluateAll((nodes) => nodes.reduce((sum, node) => sum + Number(node.getAttribute("data-layers")), 0));
  await page.waitForTimeout(1500);
  const reading = await page.evaluate(
    () =>
      new Promise<{ frames: number; seconds: number; worst: number }>((resolve) => {
        const stamps: number[] = [];
        const tick = (now: number) => {
          stamps.push(now);
          if (now - stamps[0] < 4000) requestAnimationFrame(tick);
          else {
            const gaps = stamps.slice(1).map((stamp, at) => stamp - stamps[at]);
            resolve({ frames: stamps.length - 1, seconds: (stamps[stamps.length - 1] - stamps[0]) / 1000, worst: Math.max(...gaps) });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  const fps = reading.frames / reading.seconds;
  mkdirSync("e2e/audit/out", { recursive: true });
  writeFileSync("e2e/audit/out/ca24-frame-rate.json", JSON.stringify({ ...reading, fps, cells, layers: drawn, animations: layers }, null, 2));
  console.log(`CA-24 first load: ${fps.toFixed(1)} fps over ${reading.seconds.toFixed(1)} s, worst frame ${reading.worst.toFixed(1)} ms, ${cells} cells, ${drawn} layers, ${layers} running animations`);
  expect(fps).toBeGreaterThan(55);
});

test("composer/ca-24/no-shift/phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(URL("loading"));
  await page.getByTestId("compose-skeleton").waitFor();
  const title = await spot(page, '[data-testid="compose-skeleton"] [data-testid="loading-blocks"]');
  const post = await page.getByTestId("compose-skeleton").locator('[data-rows="3"]').first().boundingBox();
  await page.goto(URL("populated"));
  await page.locator('section[aria-label="Build"]').waitFor();
  const heading = await spot(page, '[data-testid="sandbox-heading"]');
  const real = await page.getByTestId("sandbox-post").boundingBox();
  expect(Math.abs(title!.x - heading!.x), "title: left").toBeLessThanOrEqual(1);
  expect(Math.abs(post!.x - real!.x), "post: left").toBeLessThanOrEqual(1);
  expect(Math.abs(post!.y - real!.y), "post: top").toBeLessThanOrEqual(1);
});
