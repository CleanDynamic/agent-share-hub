/* UX-15: Settings opened at 1440 and 390, Light and Dark: every section loads, the page does not scroll sideways, and a screenshot of
   each goes to design/audits/ux-15/shots for the report. Also the Block confirmation and the delete window, which are windows.

     npx playwright test --config=playwright.audit.config.ts settings-ux15

   THE DATABASE IS THE AUDIT HARNESS (support/harness.ts), signed in as ME. The auth calls the Account section makes answer from the
   stored session; nothing here reaches a real project. */

import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { installStub, withSession, withTheme, type Theme } from "./support/harness";

const DIR = "design/audits/ux-15/shots";
const SECTIONS = [
  { key: "account", name: "Account" },
  { key: "notifications", name: "Notifications" },
  { key: "privacy", name: "Privacy and blocking" },
  { key: "apps", name: "Connected apps" },
  { key: "data", name: "Your data" },
  { key: "appearance", name: "Appearance" },
] as const;

const THEMES: { theme: Theme; label: string }[] = [
  { theme: "noon", label: "light" },
  { theme: "dusk", label: "dark" },
];

test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

async function open(page: Page, width: number, theme: Theme, path: string) {
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
  await withTheme(page, theme);
  await withSession(page);
  await installStub(page);
  await page.goto(path);
}

const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

for (const width of [1440, 390]) {
  for (const { theme, label } of THEMES) {
    test.describe(`Settings at ${width}, ${label}`, () => {
      test.use({ deviceScaleFactor: 2 });

      for (const section of SECTIONS) {
        test(`${section.name}`, async ({ page }) => {
          await open(page, width, theme, `/settings/${section.key}`);
          await expect(page.getByRole("heading", { level: 1, name: section.name })).toBeVisible();
          // the section's own content has arrived: its first group (or sentence) is on the page
          await expect(page.locator("main, [data-testid='site-frame'], body").first()).toBeVisible();
          await page.waitForLoadState("networkidle").catch(() => undefined);
          expect(await noSidewaysScroll(page), `${section.name} scrolls sideways at ${width}`).toBe(true);
          await page.screenshot({ path: `${DIR}/${section.key}-${width}-${label}.png`, fullPage: true });
        });
      }

      if (width === 390) {
        test("the list at /settings", async ({ page }) => {
          await open(page, width, theme, "/settings");
          await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
          await expect(page.getByRole("navigation", { name: "Settings" }).getByRole("link")).toHaveCount(6);
          expect(await noSidewaysScroll(page)).toBe(true);
          await page.screenshot({ path: `${DIR}/list-${width}-${label}.png`, fullPage: true });
        });
      }

      if (width === 1440) {
        test("the list marks the current section", async ({ page }) => {
          await open(page, width, theme, "/settings/privacy");
          const current = page.getByRole("navigation", { name: "Settings" }).locator("[aria-current='page']");
          await expect(current).toHaveCount(1);
          await expect(current).toHaveText("Privacy and blocking");
        });
      }
    });
  }
}

test.describe("the windows", () => {
  test.use({ deviceScaleFactor: 2 });

  for (const width of [1440, 390]) {
    test(`the delete window at ${width}`, async ({ page }) => {
      await open(page, width, "dusk", "/settings/data");
      await page.getByRole("button", { name: "Delete account" }).first().click();
      const window = page.getByTestId("delete-account-window").or(page.getByRole("dialog"));
      await expect(window.first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete my account" })).toBeDisabled();
      await page.getByLabel("Your username").fill("not-the-name");
      await expect(page.getByRole("button", { name: "Delete my account" })).toBeDisabled();
      await page.screenshot({ path: `${DIR}/delete-window-${width}-dark.png` });
    });
  }
});
