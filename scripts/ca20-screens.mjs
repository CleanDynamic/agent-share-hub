// CA-20 P9: the screens of "Removing, undo, new actions and shortcuts" into design/audits/composer/ca-20/, on the References fixture.
//
//   node scripts/ca20-screens.mjs [base url]   (default http://127.0.0.1:5173, a running `npx vite`)
//
// Every state in Dusk and Noon, at 1440 (desktop) and 390 (a phone). PW_CHROMIUM_PATH points at a Chromium when
// Playwright's own is not installed. A state a phone cannot reach the same way (a hover card) is desktop only.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://127.0.0.1:5173";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "audits", "composer", "ca-20");
mkdirSync(OUT, { recursive: true });

const url = (theme, phone, extra = "") => `${BASE}/dev/kit/pages/sandbox?build=references&fit=content&swatches=filled&theme=${theme}&viewport=${phone ? "mobile" : "desktop"}${extra}`;
const wait = (page, ms = 400) => page.waitForTimeout(ms);

/** Highlights `words` in the post's editor. */
async function select(page, words) {
  await page.evaluate((text) => {
    const root = document.querySelector('[contenteditable="true"]');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.textContent.indexOf(text);
      if (at < 0) continue;
      root.focus();
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + text.length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
  }, words);
  await wait(page, 300);
}

/** Opens a menu (or presses a button) from the keyboard: Radix menus open on Enter whatever the pointer is. */
async function press(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.focus();
  await page.keyboard.press("Enter");
  await wait(page, 300);
}

/** Opens a component's colour picker: its colour button on a computer, "Colour…" in its menu on a phone. */
async function openPicker(page, phone, name, tile) {
  if (!phone) {
    const button = page.getByRole("button", { name: new RegExp(`^Colour for ${name}`) }).first();
    await button.scrollIntoViewIfNeeded();
    await button.click();
  } else {
    // A menu trigger opens from the keyboard the same on every pointer.
    await press(page, page.getByRole("button", { name: `${tile} options` }).first());
    await page.getByRole("menuitem", { name: "Colour…" }).click();
  }
  await wait(page, 500);
}

const tileMenu = async (page, phone) => {
  await press(page, page.getByRole("button", { name: /^Prompt \d+ options$/ }).first());
};

const STATES = {
  "title-row": async () => undefined,
  "build-options": async (page) => {
    await press(page, page.getByTestId("build-options"));
  },
  "tile-menu": async (page, phone) => tileMenu(page, phone),
  "after-remove": async (page, phone) => {
    await tileMenu(page, phone);
    await page.getByRole("menuitem", { name: "Remove tile" }).click();
  },
  "clear-build": async (page) => {
    await press(page, page.getByTestId("build-options"));
    await page.getByTestId("build-options-clear").click();
  },
  "recently-removed": async (page, phone) => {
    await tileMenu(page, phone);
    await page.getByRole("menuitem", { name: "Remove tile" }).click();
    await wait(page, 600);
    await press(page, page.getByTestId("build-options"));
    await page.getByTestId("build-options-removed").click();
  },
  "shortcuts-window": async (page, phone) => {
    if (phone) return false;
    await page.keyboard.press("?");
  },
  "selection-bar": async (page, phone) => {
    const cards = page.locator("[data-node-id]");
    await cards.nth(0).click({ modifiers: ["Control"] });
    await cards.nth(1).click({ modifiers: ["Control"] });
  },
};

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
const made = [];
const skipped = [];
for (const [name, state] of Object.entries(STATES)) {
  for (const theme of ["dusk", "noon"]) {
    for (const phone of [false, true]) {
      const width = phone ? 390 : 1440;
      const page = await browser.newPage({ viewport: { width, height: phone ? 844 : 1000 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
      const run = typeof state === "function" ? state : state.run;
      const extra = typeof state === "function" ? "" : (state.extra ?? "");
      await page.goto(url(theme, phone, extra), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await wait(page, 1200);
      let result;
      try {
        result = run ? await run(page, phone) : undefined;
      } catch (error) {
        skipped.push(`${name}-${theme}-${width}: ${String(error).split("\n")[0]}`);
        await page.close();
        continue;
      }
      if (result === false) {
        skipped.push(`${name}-${theme}-${width}: not on a phone`);
        await page.close();
        continue;
      }
      await wait(page, 500);
      const file = path.join(OUT, `${name}-${theme}-${width}.png`);
      await page.screenshot({ path: file });
      made.push(path.basename(file));
      await page.close();
    }
  }
}
await browser.close();
console.log(JSON.stringify({ made: made.length, skipped }, null, 1));
