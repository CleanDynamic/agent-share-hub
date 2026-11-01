/* SV-29 P9: the screens this prompt adds, from the dev pages, at 1440 and 390, in Dusk and Noon.

     PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run audit -- composer-sv29-shots

   Written to design/audits/composer/sv-29/<case>-<theme>-<width>.png */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/sv-29";
const PC = "/dev/kit/pages/sandbox?build=pipeline-product-categories";
const SB = "/dev/kit/pages/sandbox?build=pipeline-support-bot-evals";

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
  // The Decision window: label set, candidates, selection, adaptation, known limits.
  { name: "decision-window", path: `${PC}&window=edit&for=pc-d1`, dialog: true, then: optionalAt("Label set") },
  { name: "decision-window-limits", path: `${PC}&window=edit&for=pc-d1`, dialog: true, then: optionalAt("Known limits") },
  // The Retrieval window.
  { name: "retrieval-window", path: `${PC}&window=retrieval`, dialog: true, then: openOptional },
  { name: "retrieval-window-edit", path: `${PC}&window=edit&for=pc-r1`, dialog: true, then: optionalAt("Recall@k") },
  // The List with the pipeline's tiles, and the Details of the Decision (with its ceiling).
  { name: "list-product-categories", path: PC },
  { name: "decision-tile", path: `${PC}&select=pc-d1` },
  // The comparison's window fields.
  { name: "comparison-window", path: `${PC}&window=edit&for=pc-k1`, dialog: true, then: optionalAt("Approaches") },
  // The Check's Eval harness section.
  { name: "eval-test-set", path: `${SB}&window=edit&for=sb-k1`, dialog: true, then: optionalAt("Test set") },
  { name: "eval-cases", path: `${SB}&window=edit&for=sb-k1`, dialog: true, then: optionalAt("Test cases") },
  { name: "eval-failure-types", path: `${SB}&window=edit&for=sb-k1`, dialog: true, then: optionalAt("Failure types") },
  { name: "eval-graders", path: `${SB}&window=edit&for=sb-k1`, dialog: true, then: optionalAt("Graders") },
  { name: "eval-run-history", path: `${SB}&window=edit&for=sb-k1`, dialog: true, then: async (page) => (await openOptional(page), await scrollTo(page, "Runs")) },
  { name: "eval-ci-gate", path: `${SB}&window=edit&for=sb-k1`, dialog: true, then: optionalAt("CI gate") },
  // Costs per item: the Decision's Details, and its tile line.
  { name: "costs-per-item", path: `${PC}&select=pc-d1`, then: scrollTestId("tile-cost") },
  // The pipeline row on the Architecture map.
  { name: "map-pipeline", path: `${PC}&lens=map` },
  { name: "map-pipeline-support-bot", path: `${SB}&lens=map` },
  // The build page, for both fixtures: the comparison's table and chart, the decision, the eval harness.
  { name: "build-page-product-categories", path: "/dev/kit/pages/build-steps?build=pipeline-product-categories" },
  { name: "build-page-comparison", path: "/dev/kit/pages/build-steps?build=pipeline-product-categories", then: scrollTestId("comparison") },
  { name: "build-page-eval-harness", path: "/dev/kit/pages/build-steps?build=pipeline-support-bot-evals", then: scrollTestId("eval-harness") },
];

for (const theme of ["dusk", "noon"]) {
  for (const width of [1440, 390]) {
    for (const entry of CASES) {
      test(`composer/sv-29/${entry.name}/${theme}/${width}`, async ({ page }) => {
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
