/* SV-30 P10: the screens this prompt adds, from the dev pages, at 1440 and 390, in Dusk and Noon.

     PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run audit -- composer-sv30-shots

   Written to design/audits/composer/sv-30/<case>-<theme>-<width>.png */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/sv-30";
const LIST = "/dev/kit/pages/sandbox?build=sessions-sdlc";
const READER = "/dev/kit/pages/build-steps?build=sessions-sdlc";

interface Case {
  name: string;
  path: string;
  dialog?: boolean;
  then?: (page: Page) => Promise<void>;
}

const openOptional = async (page: Page) => {
  for (const toggle of await page.getByTestId("optional-toggle").all()) if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.waitForTimeout(500);
};
const scrollTo = async (page: Page, words: string) => {
  await page.getByText(words, { exact: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
};
const optionalAt = (words: string) => async (page: Page) => {
  await openOptional(page);
  await scrollTo(page, words);
};
const scrollTestId = (id: string) => async (page: Page) => {
  await page.getByTestId(id).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
};

const CASES: Case[] = [
  // The List: the session head and its facts line, the three prompts and their origins, the code tiles with their parts.
  { name: "session-head", path: LIST },
  { name: "prompt-origins", path: LIST, then: scrollTestId("prompt-origin") },
  { name: "code-parts", path: LIST, then: scrollTestId("code-part-line") },
  // The Check with its before and after measurement.
    { name: "check-window-evidence-kinds", path: `${LIST}&window=edit&for=sd-k1`, dialog: true, then: optionalAt("Evidence") },
  { name: "comparison-row-evidence", path: `${LIST}&window=edit&for=sd-k2`, dialog: true, then: optionalAt("Approaches") },
  // The Session window, every new field.
  { name: "session-window-model", path: `${LIST}&window=session&for=${"typed-sdlc-fixture-0001"}`, dialog: true, then: optionalAt("Model ID") },
  { name: "session-window-access", path: `${LIST}&window=session&for=${"typed-sdlc-fixture-0001"}`, dialog: true, then: optionalAt("Access") },
  { name: "session-window-outputs", path: `${LIST}&window=session&for=${"typed-sdlc-fixture-0001"}`, dialog: true, then: optionalAt("Output links") },
  { name: "session-window-review", path: `${LIST}&window=session&for=${"typed-sdlc-fixture-0001"}`, dialog: true, then: optionalAt("Human review") },
  // The build page, as a reader gets it.
  { name: "build-page", path: READER },
  { name: "build-page-outputs", path: READER, then: scrollTestId("outputs") },
  { name: "build-page-evidence", path: READER, then: async (page) => (await page.getByText("Stated, no artefact").count()) >= 0 && scrollTestId("reader-facts")(page) },
];

for (const theme of ["dusk", "noon"]) {
  for (const width of [1440, 390]) {
    for (const entry of CASES) {
      test(`composer/sv-30/${entry.name}/${theme}/${width}`, async ({ page }) => {
        mkdirSync(OUT, { recursive: true });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
        await page.goto(`${entry.path}${entry.path.includes("?") ? "&" : "?"}theme=${theme}&viewport=${width === 390 ? "mobile" : "desktop"}`);
        await page.waitForLoadState("networkidle");
        if (entry.dialog) await page.locator('[role="dialog"]').first().waitFor({ timeout: 60_000 });
        else await page.waitForFunction(() => document.querySelectorAll("[data-testid]").length > 5, null, { timeout: 60_000 });
        await page.evaluate(() => document.fonts.ready);
        if (entry.then) await entry.then(page);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${entry.name}-${theme}-${width}.png`, fullPage: !entry.dialog });
      });
    }
  }
}
