/* SV-27 P0 and P14: the screens this prompt changes, from the dev pages, at 1440 and 390, in Dusk and Noon.

     SHOTS=before PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-sv27-shots     (Part 0)
     SHOTS=after  PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-sv27-shots     (Part 14)

   Written to design/audits/composer/sv-27/<before|after>/<case>-<theme>-<width>.png */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

const WHICH = process.env.SHOTS === "after" ? "after" : "before";
const OUT = `design/audits/composer/sv-27/${WHICH}`;

interface Case {
  name: string;
  path: (theme: string) => string;
  /** Wait for a dialog before the shot. */
  dialog?: boolean;
  then?: (page: Page) => Promise<void>;
}

const openOptional = async (page: Page) => {
  const toggle = page.getByTestId("optional-toggle");
  if ((await toggle.count()) && (await toggle.first().getAttribute("aria-expanded")) !== "true") await toggle.first().click();
  await page.waitForTimeout(600);
};

const CASES: Case[] = [
  // An agent tile's window: the Add window and the saved tile's Details window.
  { name: "agent-add", path: (theme) => `/dev/kit/pages/sandbox?build=ca28&window=agent&theme=${theme}`, dialog: true, then: openOptional },
  { name: "agent-edit", path: (theme) => `/dev/kit/pages/sandbox?build=ca28&window=edit-agent&theme=${theme}`, dialog: true, then: openOptional },
  // A team tile's window.
  { name: "team-edit", path: (theme) => `/dev/kit/pages/sandbox?build=ca28&window=edit-team&theme=${theme}`, dialog: true, then: openOptional },
  // The Session window (App and model, Date, Cost, Setup).
  { name: "session", path: (theme) => `/dev/kit/pages/sandbox?build=ca28&window=session&theme=${theme}`, dialog: true },
  // The composer with Sources (and the sessions' detail lines).
  { name: "sources", path: (theme) => `/dev/kit/pages/sandbox?theme=${theme}` },
  // The publish checklist, with the sessions that have no app.
  { name: "checklist", path: (theme) => `/dev/kit/pages/sandbox?build=ca25&show=checklist-full&theme=${theme}` },
  // The Map of sessions.
  { name: "map", path: (theme) => `/dev/kit/pages/sandbox?lens=map&theme=${theme}` },
  // An agent build's List, Details on the agent: the model's How it was run, the cost sections.
  { name: "agent-details", path: (theme) => `/dev/kit/pages/sandbox?build=shape-agent&theme=${theme}` },
  // The published build page of a build with a team and agents.
  { name: "build-page-team", path: (theme) => `/dev/kit/pages/build-steps?build=team&theme=${theme}` },
  { name: "build-page-everything", path: (theme) => `/dev/kit/pages/build-steps?build=everything&theme=${theme}` },
];

/* Part 14's own screens: the fixtures, once they exist. */
const AFTER: Case[] =
  WHICH === "after"
    ? [
        { name: "deployment-assistant", path: (theme) => `/dev/kit/pages/sandbox?build=deployment-assistant&theme=${theme}` },
        { name: "deployment-self-hosted", path: (theme) => `/dev/kit/pages/sandbox?build=deployment-self-hosted&theme=${theme}` },
        { name: "deployment-agent-team", path: (theme) => `/dev/kit/pages/sandbox?build=deployment-agent-team&theme=${theme}` },
      ]
    : [];

for (const theme of ["dusk", "noon"]) {
  for (const width of [1440, 390]) {
    for (const entry of [...CASES, ...AFTER]) {
      test(`composer/sv-27/${WHICH}/${entry.name}/${theme}/${width}`, async ({ page }) => {
        mkdirSync(OUT, { recursive: true });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
        await page.goto(`${entry.path(theme)}&viewport=${width === 390 ? "mobile" : "desktop"}`);
        await page.waitForLoadState("networkidle");
        if (entry.dialog) await page.locator('[role="dialog"]').first().waitFor({ timeout: 60_000 });
        else await page.waitForFunction(() => document.querySelectorAll("[data-testid]").length > 5, null, { timeout: 60_000 });
        await page.evaluate(() => document.fonts.ready);
        if (entry.then) await entry.then(page);
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${OUT}/${entry.name}-${theme}-${width}.png`, fullPage: !entry.dialog });
      });
    }
  }
}
