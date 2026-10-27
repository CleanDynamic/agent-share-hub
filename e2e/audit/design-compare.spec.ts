/* UI-P01, refined by UI-P77 and UI-P99 — the verbatim check.
 *
 * "Does the app look exactly like the mockup?" is only answerable by looking
 * at both at the same size. For every board in `design/reference/index.json`
 * (the refined boards: 1440 wide, no browser strip, no mobile) and in
 * `design/reference/vision/index.json` (SV-02: the vision boards, Dusk) this opens the
 * reference HTML straight off disk, opens the matching dev page, screenshots
 * both at the same size and diffs them. Playwright's report then shows expected
 * (the reference), actual (the app) and the difference.
 *
 *   npm run audit:design                                  every board
 *   npm run audit:design -- --grep "refined/noon/home"    one board
 *   DESIGN_MAX_DIFF=0.02 npm run audit:design             tighter than 0.04
 *
 * TEST TITLES ARE `<kind>/<theme>/<page>` so `--grep` selects a board
 * (`refined/dusk/home`, `vision/dusk/home`).
 *
 * THE HEADER IS HIDDEN IN EVERY VISION COMPARISON, in the board and in the app. The live header is `SiteHeader`, not
 * the one a board draws (series README, "The boards"), so its ink is taken out of both images and what is compared is
 * the page under it. It is hidden, not removed, so the boxes keep their size and nothing below moves.
 *
 * THE REFERENCE IS THE EXPECTED IMAGE, AND IT IS WRITTEN FRESH EVERY RUN. There
 * is no committed baseline to drift: the reference screenshot is written to
 * `testInfo.snapshotPath(name)` and the app's screenshot is compared against
 * it. That is why this needs no diffing dependency. Do not pass
 * `--update-snapshots`: it would make the app its own reference.
 *
 * A BOARD WITH NO DEV PAGE IS SKIPPED (foundations, components, model-marks),
 * and so is one whose dev page says `data-design-ready="false"`.
 *
 * The current-look boards are in `design/reference/archive/` and are no longer
 * compared (UI-P99).
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
  kind: "refined" | "vision";
  theme: "noon" | "dusk";
  page: string;
  width: number;
  height: number;
  title: string;
  /** The dev page that draws the same page. Absent for foundations, components and model-marks. */
  devPage?: string;
}

const DESIGN_DIR = path.join(REPO_ROOT, "design");
const readIndex = (...parts: string[]): Board[] => JSON.parse(fs.readFileSync(path.join(DESIGN_DIR, ...parts), "utf8"));
/* 24 boards, 1440 wide, no browser strip, no mobile. */
const BOARDS: Board[] = [...readIndex("reference", "index.json"), ...readIndex("reference", "vision", "index.json")];

/** What a refined board needs done to the dev page to show the same state. The dev pages already take `?lens`, `?build` and `?open`; the rest is clicked after load, so no source outside the dev pages changes. */
interface RefinedState {
  query: string;
  actions?: (page: Page) => Promise<void>;
}
const REFINED_STATE: Record<string, RefinedState> = {
  /* UI-P91: the board is the bare surface (`part=steps`), with Map chosen and step 4 open. */
  "build-map": {
    query: "&part=steps",
    actions: async (p) => {
      await p.getByRole("button", { name: "Map", exact: true }).click();
      await p.getByRole("button", { name: /^Prompt 4, / }).click();
      /* The click scrolled the box into view; the board shows the well at rest. */
      await p.getByTestId("build-map").evaluate((well) => well.scrollTo(0, 0));
      await p.evaluate(() => document.fonts.ready);
    },
  },
  /* UI-P93: the board is the bakery, prompt 3 selected (the fixture's own selection). */
  "composer-list": { query: "&build=bakery" },
  "composer-map": {
    query: "&build=bakery&lens=map",
    actions: async (p) => void (await p.getByRole("button", { name: /^Prompt 3\b/ }).click()),
  },
  "prompt-window": { query: "&build=bakery&open=1" },
  "composer-card": { query: "", actions: async (p) => void (await p.getByRole("button", { name: "Card" }).first().click()) },
};

/** The header, by what each side calls it: the board's `<header>` and the app's `SiteHeader`. */
const HIDE_HEADER = "header, [data-ui='site-header'] { visibility: hidden !important; }";

/** Share of pixels allowed to differ. */
const MAX_DIFF = (() => {
  const raw = process.env.DESIGN_MAX_DIFF;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0.04;
})();

const referenceUrl = (board: Board) => pathToFileURL(path.join(DESIGN_DIR, board.file)).href;

/** Open the reference HTML and wait for its fonts, so text is measured in Geist and not a fallback. */
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

  if (!board.devPage) {
    // foundations, components, model-marks: sections of /dev/kit/components.
    test.skip(`${title} (no dev page: compared through /dev/kit/components)`, () => {});
    continue;
  }
  test(title, async ({ browser }, testInfo) => {
    const area = { x: 0, y: 0, width: board.width, height: board.height };
    const state = REFINED_STATE[board.page] ?? { query: "" };
    const appUrl = `${board.devPage}?theme=${board.theme}&viewport=desktop${state.query}`;

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
        console.log(`  skipped ${title}: no view yet`);
        test.skip(true, `${title}: no view yet (${appUrl} reports data-design-ready="${ready}")`);
      }
      if (board.kind === "vision") await appPage.addStyleTag({ content: HIDE_HEADER });
      await state.actions?.(appPage);
      appShot = await appPage.screenshot({ fullPage: true, clip: area });
    } finally {
      await appContext.close();
    }

    // No browser strip: a board is the page from its top edge.
    const refContext = await browser.newContext({
      viewport: { width: board.width, height: board.height },
      deviceScaleFactor: 1,
    });
    const refPage = await refContext.newPage();
    let refShot: Buffer;
    try {
      await openReference(refPage, board);
      if (board.kind === "vision") await refPage.addStyleTag({ content: HIDE_HEADER });
      refShot = await refPage.screenshot({ clip: area });
    } finally {
      await refContext.close();
    }

    const name = `${slug(title)}.png`;
    fs.mkdirSync(path.dirname(testInfo.snapshotPath(name)), { recursive: true });
    fs.writeFileSync(testInfo.snapshotPath(name), refShot);
    expect.soft(appShot).toMatchSnapshot(name, { maxDiffPixelRatio: MAX_DIFF });
  });
}
