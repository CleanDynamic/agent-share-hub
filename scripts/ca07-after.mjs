// CA-07 P9: the after screenshots, from the demo page, at 1280 and 390 in both themes.
// Usage: node scripts/ca07-after.mjs <outdir>   (BASE defaults to the dev server on 5173)
import { chromium } from "playwright";

const out = process.argv[2] ?? "docs/ca-07/after";
const base = process.env.BASE ?? "http://127.0.0.1:5173";
const demo = (only) => `/dev/kit/pages/post-thread?only=${only}`;
const panel = (page, id, width) => page.locator(`[data-demo="${id}-${width < 768 ? 362 : 628}"]`).first();

const SHOTS = [
  ["composer-three", demo("composer"), async (page, width) => {
    const words = panel(page, "composer", width).locator('[contenteditable="true"] p').nth(1);
    await words.click();
  }],
  ["crop-wide", demo("composer"), async (page, width) => {
    await panel(page, "composer", width).locator("[data-edit-pill]").first().click();
    await page.getByRole("button", { name: "Wide", exact: true }).click();
  }],
  ["alt-tab", demo("composer"), async (page, width) => {
    await panel(page, "composer", width).locator("[data-edit-pill]").first().click();
    await page.getByRole("tab", { name: "ALT" }).click();
    await page.getByRole("textbox", { name: "Description" }).fill("The homepage on launch day: the shop front, the day's loaves and the order button.");
  }],
  ["warning-tab", demo("composer"), async (page, width) => {
    await panel(page, "composer", width).locator("[data-edit-pill]").first().click();
    await page.getByRole("tab", { name: "Content warning" }).click();
    await page.getByLabel("Sensitive").check();
  }],
  ["failed-upload", demo("uploading"), null],
  ["phone-strip", demo("strip"), null],
  ["old-post-in-composer", demo("old-composer"), null],
  ["build-page-thread", demo("thread"), null],
  ["viewer-2-of-4", demo("four"), async (page, width) => {
    await panel(page, "four", width).locator("[data-open-viewer]").nth(1).click();
  }],
  ["alt-sheet", demo("alt"), async (page, width) => {
    await panel(page, "alt", width).getByRole("button", { name: "Image description" }).first().click();
  }],
  ["warning-cover", demo("warning"), null],
  ["gallery-card", demo("card"), null],
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [name, path, act] of SHOTS) {
  for (const theme of ["noon", "dusk"]) {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${base}${path}&theme=${theme}${width < 768 ? "&viewport=mobile" : ""}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      try {
        if (act) await act(page, width);
      } catch (error) {
        console.error(`${name} ${theme} ${width}: ${error.message.split("\n")[0]}`);
      }
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${out}/after-${name}-${theme}-${width}.png`, fullPage: !/viewer|sheet|tab|crop/.test(name) });
      await page.close();
    }
  }
}
await browser.close();
