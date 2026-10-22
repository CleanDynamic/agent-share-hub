// CA-14: screenshots of the composer's Build area at 1280 and 430, in both themes, on the stand-in.
//   node docs/audits/ca-14/scripts/shots.mjs <out-dir> <build-id> [steps...]
// Without steps it takes the "before" set: the draft as it opens, and the "Add a session" popover.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SITE, CHROMIUM, STORAGE_KEY, session } from "../../ca-09/scripts/lib.mjs";

export const SIZES = { desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, phone: { viewport: { width: 430, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };

export async function openDraft(browser, size, theme, buildId, route = `/compose/${buildId}`) {
  const context = await browser.newContext({ ...SIZES[size], ignoreHTTPSErrors: true });
  const value = JSON.stringify(await session());
  await context.addInitScript(([key, v, th]) => {
    try {
      localStorage.setItem(key, v);
      localStorage.setItem("bg-theme", th);
    } catch {}
  }, [STORAGE_KEY, value, theme]);
  const page = await context.newPage();
  await page.goto(`${SITE}${route}`, { waitUntil: "networkidle" });
  await page.waitForSelector(route.startsWith("/b2/") ? "main" : '[data-testid="build-list"]', { timeout: 20000 });
  return { context, page };
}

export async function launch() {
  return chromium.launch({ executablePath: CHROMIUM, args: ["--ignore-certificate-errors"] });
}

if (process.argv[1].endsWith("shots.mjs")) {
  const [out, buildId] = process.argv.slice(2);
  mkdirSync(out, { recursive: true });
  const browser = await launch();
  for (const size of ["desktop", "phone"]) {
    for (const theme of ["noon", "dusk"]) {
      const { context, page } = await openDraft(browser, size, theme, buildId);
      const name = `${size}-${theme}`;
      await page.screenshot({ path: path.join(out, `draft-three-sessions-${name}.png`), fullPage: true });
      await page.getByTestId("add-session-row").scrollIntoViewIfNeeded();
      await page.getByTestId("add-session-row").click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(out, `add-a-session-${name}.png`) });
      await context.close();
    }
  }
  await browser.close();
}
