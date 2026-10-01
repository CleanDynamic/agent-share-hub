/* UI-P01 — the verbatim check.
 *
 * "Does the app look exactly like the mockup?" is only answerable by looking
 * at both at the same size. For every board in `design/reference/index.json`
 * this opens the reference HTML straight off disk, opens the matching dev page,
 * screenshots both at the same size and diffs them. Playwright's report then
 * shows expected (the reference), actual (the app) and the difference.
 *
 *   npm run audit:design                                  every board
 *   npm run audit:design -- --grep "desktop/noon/home"    one board
 *   npm run audit:design -- --grep "components"           the catalogue
 *   DESIGN_MAX_DIFF=0.02 npm run audit:design             tighter than 0.04
 *
 * TEST TITLES ARE `<kind>/<theme>/<page>` so `--grep` selects a board.
 *
 * THE REFERENCE IS THE EXPECTED IMAGE, AND IT IS WRITTEN FRESH EVERY RUN. There
 * is no committed baseline to drift: the reference screenshot is written to
 * `testInfo.snapshotPath(name)` and the app's screenshot is compared against
 * it. That is why this needs no diffing dependency. Do not pass
 * `--update-snapshots`: it would make the app its own reference.
 *
 * THE 84px BROWSER STRIP. Every desktop board begins with a drawn browser
 * (tab and address bar, `data-ui="browser-frame-PRESENTATION-ONLY-do-not-build"`).
 * It is not part of the product, so the reference is clipped below it: the
 * region compared is width x (height - 84), and the app is shot from its own
 * top edge at that size, because the app has no strip to skip. Mobile boards
 * have no strip.
 *
 * A PAGE THAT IS NOT BUILT YET IS SKIPPED, NOT FAILED. The dev page says so with
 * `data-design-ready="false"`. The component catalogue is different: it exists
 * from UI-P01 and starts empty, so the pair runs, asserts the page rendered in
 * the requested theme, and compares every `[data-catalogue]` section present on
 * both sides (none, until UI-P06).
 *
 * SOFT ASSERTIONS. One board over the threshold must not hide the next, so a
 * miss is recorded and the sweep continues.
 */

import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "./support/harness";

interface Board {
  file: string;
  kind: "desktop" | "mobile" | "brand" | "components";
  theme: "noon" | "dusk";
  page: string;
  width: number;
  height: number;
  title: string;
}

const DESIGN_DIR = path.join(REPO_ROOT, "design");
const BOARDS: Board[] = JSON.parse(fs.readFileSync(path.join(DESIGN_DIR, "reference", "index.json"), "utf8"));

/** The drawn browser across the top of a desktop board. Not product. */
const BROWSER_STRIP = 84;

/** Share of pixels allowed to differ. */
const MAX_DIFF = (() => {
  const raw = process.env.DESIGN_MAX_DIFF;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.04;
})();

const referenceUrl = (board: Board) => pathToFileURL(path.join(DESIGN_DIR, board.file)).href;

/** Open the reference HTML and wait for its fonts, so text is measured in Sentient and not a fallback. */
async function openReference(page: Page, board: Board) {
  await page.goto(referenceUrl(board), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
}

/** Open a dev page and wait for fonts and for the network to go quiet. */
async function openApp(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

for (const board of BOARDS) {
  const title = `${board.kind}/${board.theme}/${board.page}`;

  if (board.kind === "desktop" || board.kind === "mobile") {
    test(title, async ({ browser }, testInfo) => {
      const stripped = board.kind === "desktop" ? BROWSER_STRIP : 0;
      const area = { x: 0, y: 0, width: board.width, height: board.height - stripped };
      const appUrl = `/dev/kit/pages/${board.page}?theme=${board.theme}&viewport=${board.kind}`;

      // The app first: if the page is not built there is nothing to compare, and
      // the reference screenshot would be wasted work.
      const appContext = await browser.newContext({
        viewport: { width: area.width, height: area.height },
        deviceScaleFactor: 1,
        baseURL: testInfo.project.use.baseURL,
      });
      const appPage = await appContext.newPage();
      let appShot: Buffer;
      try {
        await openApp(appPage, appUrl);
        const ready = await appPage.locator("[data-design-ready]").first().getAttribute("data-design-ready");
        if (ready !== "true") {
          console.log(`  skipped ${title}: not built yet`);
          test.skip(true, `${title}: not built yet (${appUrl} reports data-design-ready="${ready}")`);
        }
        appShot = await appPage.screenshot({ fullPage: true, clip: area });
      } finally {
        await appContext.close();
      }

      const refContext = await browser.newContext({
        viewport: { width: board.width, height: board.height },
        deviceScaleFactor: 1,
      });
      const refPage = await refContext.newPage();
      let refShot: Buffer;
      try {
        await openReference(refPage, board);
        refShot = await refPage.screenshot({
          clip: { x: 0, y: stripped, width: area.width, height: area.height },
        });
      } finally {
        await refContext.close();
      }

      const name = `${slug(title)}.png`;
      fs.mkdirSync(path.dirname(testInfo.snapshotPath(name)), { recursive: true });
      fs.writeFileSync(testInfo.snapshotPath(name), refShot);
      expect.soft(appShot).toMatchSnapshot(name, { maxDiffPixelRatio: MAX_DIFF });
    });
  } else if (board.kind === "components") {
    test(title, async ({ browser }, testInfo) => {
      const appUrl = `/dev/kit/components?theme=${board.theme}`;
      const viewport = { width: board.width, height: 900 };
      const baseURL = testInfo.project.use.baseURL;

      const appContext = await browser.newContext({ viewport, deviceScaleFactor: 1, baseURL });
      const refContext = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      try {
        const appPage = await appContext.newPage();
        const refPage = await refContext.newPage();
        await openApp(appPage, appUrl);
        await openReference(refPage, board);

        // The page itself must be there and in the requested room, built or not.
        await expect(appPage.locator("html")).toHaveAttribute("data-theme", board.theme);
        await expect(appPage.locator('[data-design-page="components"]')).toBeVisible();

        const names = async (p: Page) =>
          p.locator("[data-catalogue]").evaluateAll((els) => els.map((el) => el.getAttribute("data-catalogue") ?? ""));
        const inApp = new Set(await names(appPage));
        const shared = (await names(refPage)).filter((n) => inApp.has(n));

        if (shared.length === 0) {
          testInfo.annotations.push({ type: "note", description: "no catalogue sections built yet" });
        }

        for (const section of shared) {
          const refEl = refPage.locator(`[data-catalogue="${section}"]`).first();
          const appEl = appPage.locator(`[data-catalogue="${section}"]`).first();
          const refShot = await refEl.screenshot();
          const appShot = await appEl.screenshot();
          const name = `${slug(title)}-${slug(section)}.png`;
          fs.mkdirSync(path.dirname(testInfo.snapshotPath(name)), { recursive: true });
          fs.writeFileSync(testInfo.snapshotPath(name), refShot);
          expect.soft(appShot).toMatchSnapshot(name, { maxDiffPixelRatio: MAX_DIFF });
        }
      } finally {
        await appContext.close();
        await refContext.close();
      }
    });
  } else {
    // The brand board (identity, palette, grammar) is a presentation sheet with
    // no dev page of its own: its parts are the Identity section of the catalogue.
    test.skip(`${title} (no dev page: compared through the Identity section of the catalogue)`, () => {});
  }
}
