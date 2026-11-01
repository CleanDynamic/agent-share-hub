/* SV-28 P9: the screens this prompt adds, from the dev pages, at 1440 and 390, in Dusk and Noon.

     PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run audit -- composer-sv28-shots

   Written to design/audits/composer/sv-28/<case>-<theme>-<width>.png */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/sv-28";
const COS = "/dev/kit/pages/sandbox?build=deployment-chief-of-staff";
const TEAM = "/dev/kit/pages/sandbox?build=deployment-agent-team";

interface Case {
  name: string;
  path: string;
  dialog?: boolean;
  then?: (page: Page) => Promise<void>;
}

const openOptional = async (page: Page) => {
  for (const toggle of await page.getByTestId("optional-toggle").all()) if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await page.waitForTimeout(400);
};
const scrollTo = async (page: Page, words: string) => {
  await page.getByText(words, { exact: true }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
};
const showAgents = async (page: Page) => {
  for (const button of await page.getByRole("button", { name: "Show agents" }).all()) await button.click();
  await page.waitForTimeout(300);
};
const openExample = async (page: Page) => {
  await page.getByRole("button", { name: /^Example run/ }).first().click();
  await page.waitForTimeout(300);
};
const openRows = async (page: Page, names: readonly string[]) => {
  await openOptional(page);
  for (const name of names) {
    const row = page.getByRole("button", { name: new RegExp(`^${name}`) }).first();
    if (await row.count()) await row.click().catch(() => undefined);
  }
  await page.waitForTimeout(300);
};

const CASES: Case[] = [
  // The team head with team instructions and linked mentions, the agents shown.
  { name: "team-head", path: COS, then: showAgents },
  // The team head with the workspace line and the example run open.
  { name: "team-workspace-example", path: TEAM, then: async (page) => (await showAgents(page), await openExample(page)) },
  // The agent window: Hands off to, Output rules, Follows.
  { name: "agent-window", path: `${COS}&window=edit&for=cs-a3`, dialog: true, then: async (page) => (await openOptional(page), await scrollTo(page, "Output rules")) },
  { name: "agent-window-handoffs", path: `${COS}&window=edit&for=cs-a0`, dialog: true, then: async (page) => (await openOptional(page), await scrollTo(page, "Hands off to")) },
  // The team window: Team instructions, workspace and example run.
  { name: "team-window", path: `${TEAM}&window=edit&for=at-t1`, dialog: true, then: async (page) => (await openOptional(page), await scrollTo(page, "Shared workspace")) },
  // A prompt with its job line, and the prompt window's job fields.
  { name: "job-line", path: COS, then: showAgents },
  { name: "prompt-job-fields", path: `${COS}&window=prompt&for=cs-a3p`, dialog: true, then: (page) => openRows(page, ["Deliverable"]) },
  // An Approval step and the step that waits for it; Add > Approval.
  { name: "approval-step", path: COS },
  { name: "approval-window", path: `${COS}&window=approval`, dialog: true },
  // The trust boundary in Details.
  { name: "trust-boundary-details", path: `${COS}&select=cs-a1` },
  // The architecture map with handoff and mention lines.
  { name: "map", path: `${TEAM}&lens=map` },
  { name: "map-chief-of-staff", path: `${COS}&lens=map` },
  // The setup prompt window, for each fixture and for each mapped harness.
  { name: "setup-assistant", path: "/dev/kit/pages/sandbox?build=deployment-assistant&window=setup&for=as-a1", dialog: true },
  { name: "setup-self-hosted", path: "/dev/kit/pages/sandbox?build=deployment-self-hosted&window=setup&for=sh-t1", dialog: true },
  { name: "setup-agent-team", path: `${TEAM}&window=setup&for=at-t1`, dialog: true },
  { name: "setup-chief-of-staff", path: `${COS}&window=setup&for=cs-t1`, dialog: true },
  ...["openclaw", "hermes-agent", "devin-desktop"].map((harness) => ({ name: `setup-chief-of-staff-${harness}`, path: `${COS}&window=setup&for=cs-t1&harness=${harness}`, dialog: true })),
  // The build page: Copy setup prompt beside each agent and team, and Before you copy's words in Details are above.
  { name: "build-page-copy-setup", path: "/dev/kit/pages/build-steps?build=chief-of-staff" },
];

for (const theme of ["dusk", "noon"]) {
  for (const width of [1440, 390]) {
    for (const entry of CASES) {
      test(`composer/sv-28/${entry.name}/${theme}/${width}`, async ({ page }) => {
        mkdirSync(OUT, { recursive: true });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
        await page.goto(`${entry.path}&theme=${theme}&viewport=${width === 390 ? "mobile" : "desktop"}`);
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
