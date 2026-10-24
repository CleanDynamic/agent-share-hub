// CA-23 P5: the saving, offline and two-tab states, in Dusk and Noon at 1440 and 390.
//
//   node scripts/ca23-screens.mjs [base url] [out dir]   (default http://127.0.0.1:5173, a running `npx vite`)
//
// Writes design/audits/composer/ca-23/<state>-<theme>-<width>.png from /dev/kit/pages/sandbox?build=ca23&show=<state>.
// PW_CHROMIUM_PATH points at a Chromium when Playwright's own is not installed.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = process.argv[3] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "audits", "composer", "ca-23");
mkdirSync(OUT, { recursive: true });

const STATES = [
  "status-saving",
  "status-saved",
  "status-saved-min",
  "status-saved-clock",
  "status-offline",
  "status-offline-one",
  "status-error",
  "status-published",
  "offline-strip",
  "other-tab-strip",
  "both-strips",
  "reconnected",
  "leave",
  "clash-tile",
  "clash-fields",
  "clash-session",
  "clash-post",
];

const url = (state, theme, phone) => `${BASE}/dev/kit/pages/sandbox?build=ca23&show=${state}&fit=content&theme=${theme}&viewport=${phone ? "mobile" : "desktop"}`;

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const theme of ["dusk", "noon"]) {
  for (const phone of [false, true]) {
    const width = phone ? 390 : 1440;
    for (const state of STATES) {
      const page = await browser.newPage({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone, reducedMotion: "reduce" });
      await page.goto(url(state, theme, phone), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      // The page is lazy: wait for the status line, and for the window or notice where there is one.
      await page.waitForSelector('[data-testid="sandbox-status"]', { timeout: 30_000 });
      if (state === "leave") await page.waitForSelector('[data-testid="leave-window"]');
      if (state.startsWith("clash-")) await page.waitForSelector('[data-testid="clash-window"]');
      if (state === "reconnected") await page.waitForSelector('[data-testid="reference-notice"]');
      // "saving…" is held back 300 ms; give every state a moment to settle.
      await page.waitForTimeout(900);
      // The windows and the notice are on top of the page: the viewport is what is seen. The rest are the page.
      const onTop = /^(leave|clash-|reconnected)/.test(state);
      await page.screenshot({ path: path.join(OUT, `${state}-${theme}-${width}.png`), fullPage: !onTop });
      await page.close();
    }
  }
}
await browser.close();
console.log("done", OUT);
