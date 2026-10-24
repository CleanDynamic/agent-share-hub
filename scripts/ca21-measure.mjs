// CA-21 P8: during a drag, every component not being moved keeps its height, the held copy is the size of its original, and the place is the size of the held copy.
//
//   node scripts/ca21-measure.mjs [base url]

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
let failed = 0;

const heights = (page) =>
  page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-skel-id]")].map((el) => [`${el.getAttribute("data-skel-kind")}:${el.getAttribute("data-skel-id")}`, Math.round(el.getBoundingClientRect().height)])));

async function run(theme, kind) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 2600 } });
  await page.goto(`${BASE}/dev/kit/pages/sandbox?build=ca21&fit=content&theme=${theme}&viewport=desktop`, { waitUntil: "load" });
  await page.waitForTimeout(1200);
  const held = kind === "tile" ? page.locator('[data-skel-kind="tile"][data-skel-id="c21-p2"]') : page.locator('[data-skel-kind="session"][data-skel-id$="a2"]');
  const before = await heights(page);
  const original = await held.boundingBox();
  await held.hover();
  const grip = await held.locator('[data-testid$="drag-handle"]').first().boundingBox();
  await page.mouse.move(grip.x + 9, grip.y + 11);
  await page.mouse.down();
  await page.mouse.move(grip.x + 12, grip.y + 40, { steps: 4 });
  const target = kind === "tile" ? await page.locator('[data-skel-id="c21-tool"]').boundingBox() : await page.locator('[data-testid="workstream-empty"]').boundingBox();
  const samples = [];
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(grip.x + 40, grip.y + 40 + ((target.y + 6 - grip.y - 40) * i) / steps);
    await page.waitForTimeout(40);
    samples.push(await heights(page));
  }
  await page.waitForTimeout(400);
  samples.push(await heights(page));
  const copy = await page.getByTestId("held-copy").boundingBox();
  const place = await page.getByTestId("skeleton-target").boundingBox();
  const own = await held.boundingBox();
  const id = kind === "tile" ? "tile:c21-p2" : null;
  const changed = new Set();
  for (const sample of samples) for (const [key, value] of Object.entries(sample)) if (before[key] !== undefined && Math.abs(before[key] - value) > 1) changed.add(key);
  // Containers (sessions, parts) may change height when what they hold changes; no tile may, and no session that holds neither end of the move.
  const bad = [...changed].filter((key) => (kind === "tile" ? key.startsWith("tile:") : key.startsWith("tile:") || key.startsWith("session:")));
  const sizeOk = kind === "tile" ? Math.abs(copy.width - original.width) <= 1 && Math.abs(copy.height - original.height) <= 1 : Math.abs(copy.width - original.width) <= 1;
  // The place is the held copy's size plus 4 either side.
  const placeOk = kind === "tile" ? Math.abs(place.height - 8 - copy.height) <= 2 : Math.abs(place.height - 8 - own.height) <= 3;
  console.log(JSON.stringify({ theme, kind, id, containersThatChanged: [...changed].filter((key) => !bad.includes(key)), tilesOrOtherComponentsThatChanged: bad, copy: [Math.round(copy.width), Math.round(copy.height)], original: [Math.round(original.width), Math.round(original.height)], place: [Math.round(place.width), Math.round(place.height)], sizeOk, placeOk }));
  if (bad.length > 0 || !sizeOk || !placeOk) failed += 1;
  await page.mouse.up();
  await page.close();
}

for (const theme of ["dusk", "noon"]) for (const kind of ["tile", "session"]) await run(theme, kind);
await browser.close();
process.exit(failed ? 1 : 0);
