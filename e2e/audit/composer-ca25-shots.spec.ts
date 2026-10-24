/* CA-25 P4: screenshots of the Publish checklist, Confirm and a published build's menu and Unpublish window, Dusk and Noon, at
   1440 and 390, written to design/audits/composer/ca-25/.

     npm run audit -- composer-ca25-shots */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/ca-25";
const SIZES = [
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "390", width: 390, height: 844, mobile: true },
];

const url = (theme: string, show: string, mobile: boolean) => `/dev/kit/pages/sandbox?theme=${theme}&build=ca25&show=${show}&window=1${mobile ? "&viewport=mobile" : ""}`;

for (const theme of ["dusk", "noon"]) {
  for (const size of SIZES) {
    const open = async (page: Page, show: string) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(url(theme, show, size.mobile));
      await page.locator('section[aria-label="Build"]').waitFor();
    };
    const shot = async (page: Page, name: string) => {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${name}-${theme}-${size.name}.png` });
    };
    const publish = (page: Page) => page.getByRole("button", { name: "Publish", exact: true }).first();

    test(`composer/ca-25/${theme}/${size.name}/checklist-required-and-recommended`, async ({ page }) => {
      await open(page, "checklist-full");
      await publish(page).click();
      await page.getByTestId("publish-checklist").waitFor();
      await shot(page, "checklist-2-required-2-recommended");
    });

    test(`composer/ca-25/${theme}/${size.name}/checklist-recommended`, async ({ page }) => {
      await open(page, "checklist-recommended");
      await publish(page).click();
      await page.getByTestId("publish-checklist").waitFor();
      await shot(page, "checklist-recommended-only");
    });

    test(`composer/ca-25/${theme}/${size.name}/confirm`, async ({ page }) => {
      await open(page, "confirm");
      await publish(page).click();
      await page.getByTestId("publish-confirm").waitFor();
      await shot(page, "confirm");
    });

    test(`composer/ca-25/${theme}/${size.name}/published-menu`, async ({ page }) => {
      await open(page, "published");
      await page.getByRole("button", { name: "Published build options" }).click();
      await page.getByTestId("published-copy-link").waitFor();
      await shot(page, "published-menu");
    });

    test(`composer/ca-25/${theme}/${size.name}/unpublish`, async ({ page }) => {
      await open(page, "published");
      await page.getByRole("button", { name: "Published build options" }).click();
      await page.getByRole("menuitem", { name: "Unpublish…" }).click();
      await page.getByTestId("unpublish-window").waitFor();
      await shot(page, "unpublish-window");
    });
  }
}
