// CA-22 P9: the build page in the middle of each of its moments, into design/audits/composer/ca-22/.
//
//   node scripts/ca22-screens.mjs [base url]   (default http://127.0.0.1:5173, a running `npx vite`)
//
// The "ca22" fixture (src/dev/fixtures/ca22.ts, shown by src/pages/dev/MotionDemo.tsx) at 1440 in Dusk. The page's clock is
// the test's: a button of the demo's bar is pressed, the clock runs for the time asked, and every animation then stops
// at the point it had reached (`document.getAnimations()`, each one's `currentTime`), so the picture is that moment.
// PW_CHROMIUM_PATH points at a Chromium when Playwright's own is not installed.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const ONLY = process.argv[3];
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "audits", "composer", "ca-22");
mkdirSync(OUT, { recursive: true });

// [name, [setup button, ...], button, ms after it]
const MOMENTS = [
  ["remove-a-tile", [], "remove-p2", 100],
  ["undo-the-removal", ["remove-p2"], "undo", 150],
  ["remove-a-session", [], "remove-session-2", 100],
  ["clear-the-build", [], "clear", 220],
  ["undo-clear-the-build", ["clear"], "undo", 260],
  ["merge-with-the-session-above", [], "merge-session-2", 320],
  ["add-a-tile", [], "add-tile", 200],
  ["duplicate", [], "duplicate-p2", 250],
  ["split-session-here", [], "split-p3", 250],
  ["add-a-part", [], "add-part", 200],
  ["undo-and-redo", ["duplicate-p2"], "undo", 150],
  ["move-to-part", [], "move-s2-to-part-2", 220],
  ["send-together", [], "nest-p3-in-p2", 220],
  ["fold", [], "fold-s1", 100],
  ["unfold", ["fold-s1"], "fold-s1", 100],
  ["convert", [], "convert-p3", 100],
  ["selection-bar", [], "pick-two", 100],
  ["details", ["select-p1"], "select-p3", 100],
  ["go-to-it", [], "go-to-p3", 700],
  ["list-to-map", [], "lens-map", 330],
];

const url = `${BASE}/dev/kit/pages/sandbox?build=ca22&bar=hide&fit=content&theme=dusk&viewport=desktop`;
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const [name, setup, button, ms] of MOMENTS) {
  if (ONLY && ONLY !== name) continue;
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      animation.__t0 = performance.now();
      return animation;
    };
  });
  await page.clock.install();
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  await page.clock.pauseAt(new Date(Date.now() + 5000));
  const press = (id) => page.evaluate((testid) => document.querySelector(`[data-testid="act-${testid}"]`).click(), id);
  for (const id of setup) {
    await press(id);
    await page.clock.runFor(2500);
  }
  await press(button);
  await page.clock.runFor(ms);
  await page.evaluate(() => {
    const now = performance.now();
    for (const animation of document.getAnimations()) {
      animation.pause();
      if (animation.__t0 !== undefined) animation.currentTime = Math.max(0, now - animation.__t0);
    }
  });
  await page.screenshot({ path: path.join(OUT, `${name}-dusk-1440.png`), fullPage: false });
  await page.close();
  console.log(name);
}
await browser.close();
