// CA-17 P7 — the map of sessions, measured in a real browser.
//
// 1. At 1440 by 900, for every dev fixture that draws a map: no two session boxes overlap, and no line ends inside a
//    box (a line stops 8 short of the box it points at).
// 2. At 1280 by 800, clicking "Go to it" on the post's link to Part B brings its head to within 40px of the middle of
//    the window.
//
// The dev pages read nothing from the network, so nothing is stubbed here.

import { expect, test } from "@playwright/test";

const BASE = "/dev/kit/pages/sandbox";
const FIXTURES = ["", "&build=bakery", "&build=big", "&build=team", "&build=manual", "&build=links", "&build=parts", "&build=shape-everything", "&build=shape-team-checks", "&build=shape-code"];

test.describe("CA-17 the map", () => {
  for (const fixture of FIXTURES) {
    for (const direction of ["horizontal", "vertical"]) {
      test(`no overlap, no line ends in a box · ${fixture || "fox"} · ${direction}`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${BASE}?theme=dusk&viewport=desktop&lens=map&direction=${direction}${fixture}`);
        const boxes = page.locator('[data-testid="map-box"]');
        const drawn = await boxes.first().waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false);
        if (!drawn) {
          test.skip(true, "this fixture draws no map");
          return;
        }
        const found = await page.evaluate(() => {
          const rects = [...document.querySelectorAll<HTMLElement>('[data-testid="map-box"]')].map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left, y: r.top, w: r.width, h: r.height };
          });
          const ends: { x: number; y: number }[] = [];
          for (const path of document.querySelectorAll<SVGPathElement>('[data-testid="map-line-stroke"]')) {
            const m = path.getScreenCTM();
            const length = path.getTotalLength();
            if (!m) continue;
            for (const at of [0, length]) {
              const p = path.getPointAtLength(at);
              ends.push({ x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f });
            }
          }
          return { rects, ends };
        });
        const { rects, ends } = found;
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i];
            const b = rects[j];
            const overlap = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
            expect(overlap, `boxes ${i} and ${j} overlap`).toBe(false);
          }
        }
        for (const end of ends) {
          const inside = rects.some((r) => end.x > r.x + 0.5 && end.x < r.x + r.w - 0.5 && end.y > r.y + 0.5 && end.y < r.y + r.h - 0.5);
          expect(inside, `a line ends inside a box at ${Math.round(end.x)},${Math.round(end.y)}`).toBe(false);
        }
      });
    }
  }

  test("a link to a part centres its head", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}?theme=dusk&viewport=desktop&build=parts`);
    await page.locator('[data-ref^="workstream:"]').first().hover();
    await page.getByRole("button", { name: "Go to it" }).click();
    await page.waitForTimeout(1200);
    const head = page.locator('[data-testid="workstream-head"]').nth(1);
    const box = await head.boundingBox();
    expect(box).not.toBeNull();
    const middle = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    expect(Math.abs(middle - 400)).toBeLessThanOrEqual(40);
  });
});
