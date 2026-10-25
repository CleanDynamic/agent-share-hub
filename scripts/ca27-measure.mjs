// CA-27 P3: a build of 300 tiles in 20 sessions over 3 parts ("ca27") at 1440: how long it takes to draw, to scroll, to pick a tile up and to find.
//
//   node scripts/ca27-measure.mjs [base url] [label]
//
//   first render   the build is cleared, then put back: the time from the press to the paint after every tile has its place in the page
//                  (and, in a windowed build, the cards near the view are drawn)
//                  (the data is in memory, so this is the draw, not a fetch); and from navigation to the first paint with all of them
//   scroll         a scroll of 2400 px a second for three seconds: frames, the frame rate, and frames longer than 20 ms
//   pick-up        a press on a tile's grip and a move past the distance: the time to the held copy being in the page
//   find           a word typed in Find: the time from the settled search (120 ms after the typing) to the count in the page (resultsMs),
//                  and to the next paint after it (paintedMs, which holds up to a frame of waiting)
//
// Targets: first render under 300 ms, 60 frames a second, pick-up under 16 ms, Find's results under 50 ms. Software rendering in a
// container is slower than a GPU: the numbers say whether the work is light, not what a laptop does. Chrome's own counters (script,
// layout and style time) are read through the DevTools protocol for the first render.

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const LABEL = process.argv[3] ?? "run";
const TILES = Number(process.env.TILES ?? 300);
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const out = { label: LABEL, tiles: TILES };

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send("Performance.enable");
const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));

const started = Date.now();
await page.goto(`${BASE}/dev/kit/pages/sandbox?build=ca27&tiles=${TILES}&bar=hide&fit=content&theme=dusk&window=1${process.env.EXTRA ?? ""}`, { waitUntil: "load" });
// Every tile has its box in the page; a windowed build draws only the cards near the view.
const placed = (n) => document.querySelectorAll('[data-skel-kind="tile"]').length >= n * 0.9 && document.querySelectorAll('[data-testid="step-card"]').length >= 6;
await page.waitForFunction(placed, TILES, { timeout: 120000 });
out.loadToCardsMs = Date.now() - started;
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);

// ── first render: clear, then put back ──
await page.evaluate(() => document.querySelector('[data-testid="act-clear"]').click());
await page.waitForFunction(() => document.querySelectorAll('[data-skel-kind="tile"]').length === 0);
await page.waitForTimeout(800);
const before = await metrics();
out.firstRenderMs = await page.evaluate(
  (n) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      document.querySelector('[data-testid="act-undo"]').click();
      const poll = () => {
        if (document.querySelectorAll('[data-skel-kind="tile"]').length >= n * 0.9 && document.querySelectorAll('[data-testid="step-card"]').length >= 6) requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
        else requestAnimationFrame(poll);
      };
      poll();
    }),
  TILES,
);
const after = await metrics();
out.chrome = { scriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1000), layoutMs: Math.round((after.LayoutDuration - before.LayoutDuration) * 1000), styleMs: Math.round((after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000), layouts: after.LayoutCount - before.LayoutCount };
await page.waitForTimeout(1500);

// ── scroll ──
out.scroll = await page.evaluate(
  () =>
    new Promise((resolve) => {
      window.scrollTo(0, 0);
      const frames = [];
      let last = performance.now();
      const began = last;
      const tick = (now) => {
        frames.push(now - last);
        last = now;
        window.scrollBy(0, 40);
        if (now - began < 3000) requestAnimationFrame(tick);
        else {
          const sorted = [...frames].sort((a, b) => a - b);
          resolve({ frames: frames.length, fps: Math.round((frames.length / (now - began)) * 10000) / 10, over20ms: frames.filter((f) => f > 20).length, p95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10, worstMs: Math.round(sorted.at(-1)), scrolledTo: Math.round(window.scrollY) });
        }
      };
      requestAnimationFrame(tick);
    }),
);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);

// ── pick-up ──
const pick = [];
for (const id of ["c27-3", "c27-8", "c27-12"]) {
  const tile = page.locator(`[data-skel-kind="tile"][data-skel-id="${id}"]`);
  await tile.scrollIntoViewIfNeeded();
  await tile.hover();
  const grip = await tile.locator('[data-testid="drag-handle"]').first().boundingBox();
  await page.evaluate(() => {
    window.__moved = 0;
    window.__held = 0;
    window.addEventListener("pointermove", () => (window.__moved ||= performance.now()), { capture: true, once: false });
    new MutationObserver(() => {
      if (!window.__held && document.querySelector('[data-testid="held-copy"]')) window.__held = performance.now();
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.mouse.move(grip.x + 9, grip.y + 11);
  await page.mouse.down();
  await page.evaluate(() => (window.__moved = 0));
  await page.mouse.move(grip.x + 16, grip.y + 30, { steps: 2 });
  await page.waitForFunction(() => window.__held > 0, null, { timeout: 5000 }).catch(() => undefined);
  pick.push(await page.evaluate(() => (window.__held && window.__moved ? Math.round((window.__held - window.__moved) * 10) / 10 : null)));
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(600);
}
out.pickUpMs = pick;

// ── find ──
await page.evaluate(() => window.scrollTo(0, 0));
await page.keyboard.press("/");
await page.getByTestId("find-input").waitFor();
const finds = [];
for (const word of ["sourdough", "weekend rota", "cinnamon", "qq"]) {
  finds.push(
    await page.evaluate(
      (word) =>
        new Promise((resolve) => {
          const input = document.querySelector('[data-testid="find-input"]');
          const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          set.call(input, "");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          setTimeout(() => {
            const count = () => document.querySelector('[data-testid="find-count"]')?.textContent ?? "";
            const typed = performance.now();
            let inPage = 0;
            // The count in the page, and then the paint after it.
            new MutationObserver((_, watch) => {
              if (!inPage && count()) {
                inPage = performance.now();
                watch.disconnect();
                requestAnimationFrame(() => resolve({ word, count: count(), resultsMs: Math.round((inPage - typed - 120) * 10) / 10, paintedMs: Math.round((performance.now() - typed - 120) * 10) / 10 }));
              }
            }).observe(document.body, { childList: true, subtree: true, characterData: true });
            set.call(input, word);
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }, 400);
        }),
      word,
    ),
  );
  await page.waitForTimeout(500);
}
out.findMs = finds;
console.log(JSON.stringify(out, null, 2));
await browser.close();
