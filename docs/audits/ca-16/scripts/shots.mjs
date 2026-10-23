// CA-16 and CA-16b: screenshots of the Classification Card and the Gallery at 1280, 1024 and 390, on the dev compare page.
//   npx vite --port 5199 --host 127.0.0.1 &
//   node docs/audits/ca-16/scripts/shots.mjs design/audits/gallery/ca-16b
// The dev page (`/dev/kit/pages/classification`) holds sample data: nothing is read from or written to a database.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SITE = process.env.CA16_SITE ?? "http://127.0.0.1:5199";
const CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const SIZES = {
  1280: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
  1024: { viewport: { width: 1024, height: 800 }, deviceScaleFactor: 1 },
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const out = process.argv[2] ?? "design/audits/gallery/ca-16b";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function open(width, part, theme = "noon") {
  const context = await browser.newContext(SIZES[width]);
  const page = await context.newPage();
  const phone = width === 390;
  await page.goto(`${SITE}/dev/kit/pages/classification?part=${part}&theme=${theme}&viewport=${phone ? "mobile" : "desktop"}`, { waitUntil: "networkidle" });
  await page.waitForSelector(part === "card" ? '[role="dialog"]' : '[data-testid="gallery-view"]', { timeout: 20000 });
  return { context, page };
}

const shot = (page, name, options = {}) => page.screenshot({ path: path.join(out, name), ...options });

const row = (page, name) => page.getByRole("button", { name: new RegExp(`^${name}`) }).first();

for (const width of [1280, 390]) {
  const phone = width === 390;
  for (const theme of ["noon", "dusk"]) {
    const tag = `${width}-${theme}`;
    const { context, page } = await open(width, "card", theme);
    await page.waitForTimeout(300);
    await shot(page, `1-card-closed-${tag}.png`);
    await row(page, "Field").click();
    await page.getByRole("combobox", { name: "Field" }).click();
    await page.getByRole("combobox", { name: "Field" }).fill("rerank");
    await page.waitForTimeout(200);
    await shot(page, `2-card-field-typing-${tag}.png`);
    await context.close();
  }
}

for (const width of [1280, 1024, 390]) {
  const phone = width === 390;
  for (const theme of ["noon", "dusk"]) {
    const { context, page } = await open(width, "gallery", theme);
    await page.waitForTimeout(500);
    await shot(page, `3-gallery-${width}-${theme}.png`, { fullPage: true });
    if (phone) {
      await page.getByRole("button", { name: "Filters", exact: true }).click();
      await page.waitForTimeout(300);
      await shot(page, `4-gallery-filters-sheet-${width}-${theme}.png`);
    }
    await context.close();
  }
}
await browser.close();
console.log("done");
