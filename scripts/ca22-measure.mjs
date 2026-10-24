// CA-22 P8: every sequence on a build of 300 tiles: what it animates, how soon it starts, and how long its frames take.
//
//   node scripts/ca22-measure.mjs [base url]
//
// The "ca22" fixture with `&tiles=300` (a long session of 300 prompts). For each button of the demo's bar: the properties of every
// animation it starts (only transform and opacity, bar the two the prompt allows: clip-path for a frame that opens, and
// stroke-dashoffset for lines that draw), the time from the press to the first animation, and the frames in the next 1.2 s.
// Software rendering in a container is slower than a GPU: the numbers say whether the work is light, not what a laptop does.

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const SEQUENCES = process.env.ONLY ? process.env.ONLY.split(",") : ["remove-p2", "clear", "add-tile", "duplicate-p2", "split-p3", "fold-s1", "collapse-all", "convert-p3", "pick-two", "select-p3", "lens-map", "move-s2-to-part-2", "nest-p3-in-p2", "go-to-p3"];
const ALLOWED = new Set(["transform", "opacity", "offset", "easing", "composite", "transformOrigin", "clipPath", "strokeDasharray", "strokeDashoffset", "computedOffset"]);

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
let failed = 0;
for (const name of SEQUENCES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.addInitScript(() => {
    window.__anims = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      window.__anims.push({ at: performance.now(), keys: Object.keys(args[0][0] ?? {}).concat(Object.keys(args[0][1] ?? {})) });
      return animation;
    };
  });
  await page.goto(`${BASE}/dev/kit/pages/sandbox?build=ca22&bar=hide&tiles=300&fit=content&theme=dusk&viewport=desktop`, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2500);
  const result = await page.evaluate(async (testid) => {
    window.__anims.length = 0;
    const frames = [];
    let last = performance.now();
    let go = true;
    const tick = (now) => {
      frames.push(now - last);
      last = now;
      if (go) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 100));
    frames.length = 0;
    const pressed = performance.now();
    document.querySelector(`[data-testid="act-${testid}"]`).click();
    await new Promise((r) => setTimeout(r, 1200));
    go = false;
    const first = window.__anims.length ? Math.min(...window.__anims.map((a) => a.at)) - pressed : null;
    const keys = [...new Set(window.__anims.flatMap((a) => a.keys))];
    const sorted = [...frames].sort((a, b) => a - b);
    return { animations: window.__anims.length, keys, startMs: first, frames: frames.length, p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0, worst: sorted.at(-1) ?? 0, slow: frames.filter((f) => f > 20).length };
  }, name);
  const bad = result.keys.filter((key) => !ALLOWED.has(key));
  if (bad.length > 0) failed += 1;
  console.log(JSON.stringify({ name, ...result, startMs: result.startMs === null ? null : Math.round(result.startMs * 10) / 10, p95: Math.round(result.p95 * 10) / 10, worst: Math.round(result.worst), notTransformOrOpacity: bad }));
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
