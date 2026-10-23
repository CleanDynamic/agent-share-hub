/* CA-18 P6 — screenshots of the composer with Details, Dusk and Noon, written to design/audits/composer/ca-18/.

     npm run audit -- composer-ca18-shots */

import { mkdirSync } from "node:fs";

import { test } from "@playwright/test";

const OUT = "design/audits/composer/ca-18";
const SHOTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 900 },
  // From 768 up to where Details fits beside the build it is a panel over the right: `select=3` opens it on tile 3.
  { name: "1100", width: 1100, height: 900, select: "3" },
  { name: "390-phone", width: 390, height: 844 },
];

for (const theme of ["dusk", "noon"]) {
  for (const shot of SHOTS) {
    test(`composer/ca-18/${theme}/${shot.name}`, async ({ page }) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width: shot.width, height: shot.height });
      await page.goto(`/dev/kit/pages/sandbox?theme=${theme}&build=bakery&details=prompt&window=1${shot.select ? `&select=${shot.select}` : ""}${shot.width < 768 ? "&viewport=mobile" : ""}`);
      await page.locator('section[aria-label="Build"]').waitFor();
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${theme}-${shot.name}.png` });
    });
  }
}
