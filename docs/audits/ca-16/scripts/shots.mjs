// CA-16: screenshots of the Classification Card and the Gallery at 1280 and 390, on the dev compare page.
//   npx vite --port 5199 --host 127.0.0.1 &
//   node docs/audits/ca-16/scripts/shots.mjs docs/audits/ca-16/screenshots
// The dev page (`/dev/kit/pages/classification`) holds sample data: nothing is read from or written to a database.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const SITE = process.env.CA16_SITE ?? "http://127.0.0.1:5199";
const CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const SIZES = {
  1280: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
  390: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

const out = process.argv[2] ?? "docs/audits/ca-16/screenshots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });

async function open(width, part, theme = "noon") {
  const context = await browser.newContext(SIZES[width]);
  const page = await context.newPage();
  const phone = width === 390;
  await page.goto(`${SITE}/dev/kit/pages/classification?part=${part}&theme=${theme}&viewport=${phone ? "mobile" : "desktop"}`, { waitUntil: "networkidle" });
  await page.waitForSelector(part === "card" ? '[data-testid="sandbox-card"]' : '[data-testid="gallery-view"]', { timeout: 20000 });
  return { context, page };
}

const shot = (page, name, options = {}) => page.screenshot({ path: path.join(out, name), ...options });

for (const width of [1280, 390]) {
  const phone = width === 390;
  for (const theme of ["noon", "dusk"]) {
    const tag = `${width}-${theme}`;

    // 1. the Classification Card, closed
    {
      const { context, page } = await open(width, "card", theme);
      await page.waitForTimeout(300);
      await shot(page, `1-card-closed-${tag}.png`);

      // 2. Field open and typing
      await page.getByRole("button", { name: "Field", exact: true }).click();
      await page.getByRole("combobox", { name: "Field" }).click();
      await page.getByRole("combobox", { name: "Field" }).fill("retr");
      await page.waitForTimeout(200);
      await shot(page, `2-card-field-typing-${tag}.png`);
      await page.getByRole("combobox", { name: "Field" }).fill("");
      await page.getByRole("button", { name: "Field", exact: true }).click();

      // 3. Read from your build, open, with a gap question
      await page.getByRole("button", { name: "Read from your build", exact: true }).click();
      await page.waitForTimeout(200);
      await page.getByRole("region", { name: "Questions" }).first().scrollIntoViewIfNeeded();
      await shot(page, `3-card-read-from-build-${tag}.png`);
      await context.close();
    }

    // 4. the Gallery with filters open, and 5. a gallery card
    {
      const { context, page } = await open(width, "gallery", theme);
      await page.waitForTimeout(300);
      await page.getByRole("button", { name: phone ? "Filters" : "Filters", exact: true }).first().click();
      await page.waitForTimeout(300);
      if (!phone) {
        await page.getByRole("button", { name: "Show what is under AI and machine learning" }).click().catch(() => undefined);
      }
      await page.waitForTimeout(200);
      await shot(page, `4-gallery-filters-${tag}.png`, { fullPage: !phone });
      await context.close();
    }
    {
      const { context, page } = await open(width, "gallery", theme);
      await page.waitForTimeout(400);
      const card = page.locator("[data-feed-post]").first();
      await card.scrollIntoViewIfNeeded();
      await card.screenshot({ path: path.join(out, `5-gallery-card-${tag}.png`) });
      await context.close();
    }
  }
}
await browser.close();
console.log("done");
