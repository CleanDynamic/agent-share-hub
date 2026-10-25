/* CA-28 P0 and P6: every window with optional fields, at 1440, in Dusk and Noon, closed as it opens and open with every field.

     SHOTS=before PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-ca28-shots     (before Part 1: every row opened one by one)
     SHOTS=after  PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-ca28-shots     (the Optional toggle pressed once)

   Written to design/audits/composer/ca-28/<before|after>/<window>-<closed|open>-<theme>-1440.png */

import { mkdirSync } from "node:fs";

import { test } from "@playwright/test";

const WHICH = process.env.SHOTS === "after" ? "after" : "before";
const OUT = `design/audits/composer/ca-28/${WHICH}`;
const WINDOWS = ["agent", "check", "code", "dataset", "decision", "manual", "repo", "result", "system-prompt", "tool", "prompt", "session", "edit-tool", "edit-check", "edit-agent"];

for (const theme of ["dusk", "noon"]) {
  for (const window of WINDOWS) {
    test(`composer/ca-28/${WHICH}/${window}/${theme}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width: 1440, height: 1400 });
      await page.goto(`/dev/kit/pages/sandbox?build=ca28&theme=${theme}&window=${window}`);
      await page.locator('[role="dialog"]').first().waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${window}-closed-${theme}-1440.png` });
      const toggle = page.getByTestId("optional-toggle");
      if (await toggle.count()) {
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      } else {
        const rows = page.locator('[data-testid="optional-field"] > button[aria-expanded="false"]');
        for (let left = await rows.count(); left > 0; left = await rows.count()) await rows.first().click();
      }
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${window}-open-${theme}-1440.png` });
    });
  }
}
