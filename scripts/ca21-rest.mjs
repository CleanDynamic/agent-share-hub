// CA-21 P0 and P8: the build page at rest, on the "ca21" fixture, in Dusk and Noon at 1440 and 390.
//
//   node scripts/ca21-rest.mjs <before|after> [base url]   (default http://127.0.0.1:5173, a running `npx vite`)
//
// Writes design/audits/composer/ca-21/<before|after>/rest-<theme>-<width>.png. PW_CHROMIUM_PATH points at a Chromium when
// Playwright's own is not installed.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const WHICH = process.argv[2] === "after" ? "after" : "before";
const BASE = process.argv[3] ?? "http://127.0.0.1:5173";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "audits", "composer", "ca-21", WHICH);
mkdirSync(OUT, { recursive: true });

const url = (theme, phone) => `${BASE}/dev/kit/pages/sandbox?build=ca21&fit=content&theme=${theme}&viewport=${phone ? "mobile" : "desktop"}`;

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const theme of ["dusk", "noon"]) {
  for (const phone of [false, true]) {
    const width = phone ? 390 : 1440;
    const page = await browser.newPage({ viewport: { width, height: phone ? 844 : 1000 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone, reducedMotion: "reduce" });
    await page.goto(url(theme, phone), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `rest-${theme}-${width}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log("done", OUT);
