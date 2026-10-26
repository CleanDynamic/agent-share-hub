/* SV-05 P0 and P9: the composer's cases this prompt changes, from the dev pages.

     SHOTS=before PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-sv05-shots     (Part 0: 1440, Dusk)
     SHOTS=after  PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-sv05-shots     (Part 9: 1440 and 390, Dusk and Noon,
                                                                                    and Part 9's moments at 1440 in Dusk)

   Written to design/audits/composer/sv-05/<before|after>/<case>-<theme>-<width>.png */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

const WHICH = process.env.SHOTS === "after" ? "after" : "before";
const OUT = `design/audits/composer/sv-05/${WHICH}`;
const THEMES = WHICH === "after" ? ["dusk", "noon"] : ["dusk"];
const WIDTHS = WHICH === "after" ? [1440, 390] : [1440];

interface Case {
  name: string;
  path: (theme: string) => string;
  /** What to do once the page is drawn, before the shot. */
  then?: (page: Page) => Promise<void>;
}

const CASES: Case[] = [
  // Two parts (CA-21's "Moving"): the second holds sessions, one of them with no tiles.
  { name: "parts", path: (theme) => `/dev/kit/pages/sandbox?build=ca21&theme=${theme}` },
  // An import in progress, its sockets holding building blocks.
  { name: "import", path: (theme) => `/dev/kit/pages/sandbox?build=ca24&show=import&theme=${theme}` },
  // The fox poster: a post with one empty block, and Sources with its CLAUDE.md suggestion.
  { name: "post-and-sources", path: (theme) => `/dev/kit/pages/sandbox?theme=${theme}` },
  // The Classification window.
  {
    name: "classification",
    path: (theme) => `/dev/kit/pages/sandbox?theme=${theme}`,
    then: async (page) => {
      await page.getByRole("button", { name: "Classification" }).first().click();
      await page.locator('[role="dialog"]').first().waitFor();
    },
  },
];

/** Session 3 moved up, by its own menu, `times` times; `pause` ms after the last press, the shot. */
const moveUp = (times: number, pause: number) => async (page: Page) => {
  for (let at = 0; at < times; at += 1) {
    const number = 3 - at;
    await page.getByRole("button", { name: `Session ${number} options` }).first().click();
    await page.getByRole("menuitem", { name: /^Move up/ }).click();
    if (at < times - 1) await page.waitForTimeout(900);
  }
  await page.waitForTimeout(pause);
};

/* Part 9's own moments, at 1440 in Dusk: an import paused while its sockets hold blocks, and Session 3 moved to the top,
   mid-slide and after. */
const MOMENTS: Case[] =
  WHICH === "after"
    ? [
        {
          name: "import-blocks",
          path: (theme) => `/dev/kit/pages/sandbox?build=ca24&show=import&theme=${theme}`,
          then: async (page) => {
            // The first socket still waiting: six of the eighteen prompts are in.
            await page.getByTestId("arriving-place").nth(6).scrollIntoViewIfNeeded();
            await page.evaluate(() => window.scrollBy(0, 200));
          },
        },
        { name: "move-mid", path: (theme) => `/dev/kit/pages/sandbox?build=ca22&bar=0&theme=${theme}`, then: moveUp(2, 90) },
        { name: "move-after", path: (theme) => `/dev/kit/pages/sandbox?build=ca22&bar=0&theme=${theme}`, then: moveUp(2, 1200) },
      ]
    : [];

for (const entry of MOMENTS) {
  test(`composer/sv-05/${WHICH}/${entry.name}/dusk/1440`, async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(entry.path("dusk"));
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => document.querySelectorAll("[data-testid]").length > 20, null, { timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    if (entry.then) await entry.then(page);
    await page.screenshot({ path: `${OUT}/${entry.name}-dusk-1440.png` });
  });
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    for (const entry of CASES) {
      test(`composer/sv-05/${WHICH}/${entry.name}/${theme}/${width}`, async ({ page }) => {
        mkdirSync(OUT, { recursive: true });
        await page.setViewportSize({ width, height: 1100 });
        await page.goto(entry.path(theme));
        // The dev server compiles a page on its first visit: wait until the composer is drawn.
        await page.waitForLoadState("networkidle");
        await page.waitForFunction(() => document.querySelectorAll("[data-testid]").length > 20, null, { timeout: 60_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        if (entry.then) await entry.then(page);
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/${entry.name}-${theme}-${width}.png` });
      });
    }
  }
}
