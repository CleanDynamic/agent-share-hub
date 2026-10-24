// CA-21 P8: the screens of moving on a skeleton grid, into design/audits/composer/ca-21/.
//
//   node scripts/ca21-screens.mjs [base url]   (default http://127.0.0.1:5173, a running `npx vite`)
//
// The "ca21" fixture (src/dev/fixtures/ca21.ts, shown by src/pages/dev/MovingDemo.tsx) at 1440 in Dusk and Noon, and at 390 on a phone.
// Every state is reached with a pointer, as a maker would. PW_CHROMIUM_PATH points at a Chromium when Playwright's own is not installed.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "audits", "composer", "ca-21");
mkdirSync(OUT, { recursive: true });

const url = (theme, phone) => `${BASE}/dev/kit/pages/sandbox?build=ca21&fit=content&theme=${theme}&viewport=${phone ? "mobile" : "desktop"}`;
const wait = (page, ms) => page.waitForTimeout(ms);
const tile = (page, id) => page.locator(`[data-skel-kind="tile"][data-skel-id="${id}"]`);

/** The grip of a tile, session or part, with the pointer on it. */
async function grab(page, locator, phone) {
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  const grip = locator.locator('[data-testid$="drag-handle"]').first();
  const box = await grip.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  if (phone) await wait(page, 320);
  await page.mouse.move(box.x + box.width / 2 + 3, box.y + box.height / 2 + 24, { steps: 4 });
  await wait(page, 250);
  return box;
}

/** The + on a session in Sources, then Part 2 in the menu it opens (the build has two parts). */
async function addFromSources(page) {
  await page.getByRole("button", { name: "Add session" }).first().click();
  await page.getByText("Part 2", { exact: true }).last().click();
}

const STATES = {
  "tile-picked-up": async (page, phone) => {
    await grab(page, tile(page, "c21-p2"), phone);
  },
  "tile-over-session-2": async (page, phone) => {
    const box = await grab(page, tile(page, "c21-p2"), phone);
    const target = await tile(page, "c21-tool").boundingBox();
    await page.mouse.move(box.x + 40, target.y + 6, { steps: 14 });
    await wait(page, 400);
  },
  "tile-just-dropped": async (page, phone) => {
    const box = await grab(page, tile(page, "c21-p2"), phone);
    const target = await tile(page, "c21-tool").boundingBox();
    await page.mouse.move(box.x + 40, target.y + 6, { steps: 14 });
    await wait(page, 300);
    await page.mouse.up();
    await wait(page, 120);
  },
  "session-over-empty-part": async (page, phone) => {
    const session = page.locator('[data-skel-kind="session"][data-skel-id$="a2"]');
    const box = await grab(page, session, phone);
    const empty = await page.locator('[data-testid="workstream-empty"]').boundingBox();
    await page.mouse.move(box.x + 40, empty.y + 8, { steps: 16 });
    await wait(page, 450);
  },
  "session-dropped-in-part-2": async (page, phone) => {
    const session = page.locator('[data-skel-kind="session"][data-skel-id$="a2"]');
    const box = await grab(page, session, phone);
    const empty = await page.locator('[data-testid="workstream-empty"]').boundingBox();
    await page.mouse.move(box.x + 40, empty.y + 8, { steps: 16 });
    await wait(page, 300);
    await page.mouse.up();
    await wait(page, 700);
  },
  "sending-together": async (page, phone) => {
    const box = await grab(page, tile(page, "c21-p1"), phone);
    const target = await tile(page, "c21-p3").boundingBox();
    await page.mouse.move(box.x + 60, target.y + target.height / 2, { steps: 12 });
    await wait(page, 750);
  },
  "adding-from-sources-lane-open": async (page, phone) => {
    if (phone) return false;
    await addFromSources(page);
    await wait(page, 330);
  },
  "adding-from-sources-head-landed": async (page, phone) => {
    if (phone) return false;
    await addFromSources(page);
    await wait(page, 1000);
  },
  "adding-from-sources-prompt-falling": async (page, phone) => {
    if (phone) return false;
    await addFromSources(page);
    await wait(page, 1780);
  },
  "adding-from-sources-finished": async (page, phone) => {
    if (phone) return false;
    await addFromSources(page);
    await wait(page, 4200);
  },
  "adding-from-menu-lane-open": async (page, phone) => {
    if (phone) return false;
    await page.getByTestId("add-session-row").click();
    await page.getByRole("button", { name: /Add from your connected chats/ }).click();
    await page.getByTestId("add-session-picker").getByRole("listitem").first().click();
    await wait(page, 330);
  },
  "adding-from-menu-finished": async (page, phone) => {
    if (phone) return false;
    await page.getByTestId("add-session-row").click();
    await page.getByRole("button", { name: /Add from your connected chats/ }).click();
    await page.getByTestId("add-session-picker").getByRole("listitem").first().click();
    await wait(page, 4200);
  },
};

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const made = [];
const skipped = [];
for (const [name, run] of Object.entries(STATES)) {
  for (const theme of ["dusk", "noon"]) {
    for (const phone of [false, true]) {
      if (phone && !["tile-picked-up", "tile-over-session-2"].includes(name)) continue;
      const width = phone ? 390 : 1440;
      const page = await browser.newPage({ viewport: { width, height: phone ? 2700 : 2400 }, deviceScaleFactor: 1, hasTouch: false });
      await page.goto(url(theme, phone), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await wait(page, 1200);
      try {
        const result = await run(page, phone);
        if (result === false) {
          await page.close();
          continue;
        }
      } catch (error) {
        skipped.push(`${name}-${theme}-${width}: ${String(error).split("\n")[0]}`);
        await page.close();
        continue;
      }
      await page.screenshot({ path: path.join(OUT, `${name}-${theme}-${width}.png`) });
      made.push(`${name}-${theme}-${width}`);
      await page.close();
    }
  }
}
await browser.close();
console.log(JSON.stringify({ made: made.length, skipped }, null, 1));
