/* UX-02: the before and after screenshot pairs for the report, at 1440 wide in Dusk and at 390 wide, on the same seeded draft.

     UX02_STAGE=after  npx playwright test --config=playwright.audit.config.ts composer-ux02-shots
     UX02_STAGE=before E2E_PORT=<main's dev server port> npx playwright test --config=... composer-ux02-shots

   "Before" points this spec at a dev server running main, so both are made by one harness. A shot whose control does not exist on a
   stage (the session row's grouped menu before, the header Add after) is taken of what that stage draws in its place. */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

import { IDS, KEY, open } from "./support/ux02";

const STAGE = process.env.UX02_STAGE ?? "after";
const DIR = `design/audits/composer/ux-02/${STAGE}`;

const shot = (page: Page, name: string) => page.screenshot({ path: `${DIR}/${name}.png` });
const session = (page: Page, key: string) => page.locator(`[data-session-key="${key}"]`);

test.beforeAll(() => mkdirSync(DIR, { recursive: true }));

test.describe(`UX-02 shots (${STAGE})`, () => {
  test.use({ deviceScaleFactor: 2 });

  test("1440: the List, Sources and Details", async ({ page }) => {
    await open(page, 1440);
    await page.waitForTimeout(600);
    await shot(page, "1440-composer");
    // P4: a session's title; P5: a tile's footer and menu; P10: a prompt's footer.
    await session(page, KEY.a).scrollIntoViewIfNeeded();
    await shot(page, "1440-session-1");
  });

  test("1440: the add menu (P6, P7)", async ({ page }) => {
    await open(page, 1440);
    const header = page.getByTestId("sandbox-add");
    if ((await header.count()) > 0) {
      await header.click();
      await page.waitForTimeout(300);
      await shot(page, "1440-add-menu-header");
      await page.keyboard.press("Escape");
    }
    const row = session(page, KEY.a).getByTestId("add-to-session");
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await page.waitForTimeout(300);
    await shot(page, "1440-add-menu-row");
  });

  test("1440: a source file's menu (P2) and Sources (P8)", async ({ page }) => {
    await open(page, 1440);
    await page.getByRole("button", { name: "brief.md options" }).click();
    await page.waitForTimeout(300);
    await shot(page, "1440-file-menu");
  });

  test("1440: Details for a session and a file (P9)", async ({ page }) => {
    await open(page, 1440);
    await session(page, KEY.a).getByTestId("session-head").click({ position: { x: 300, y: 20 } });
    await page.waitForTimeout(400);
    await shot(page, "1440-details-session");
    await page.getByRole("button", { name: "brief.md options" }).click();
    const openFile = page.getByRole("menuitem", { name: "Open file" });
    if ((await openFile.count()) > 0) await openFile.click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await shot(page, "1440-details-file");
  });

  test("1440: a tile held over the List (P3)", async ({ page }) => {
    await open(page, 1440);
    const grip = page.locator(`[data-source-drag="src-file:${IDS.source}"]`).getByTestId("source-drag-handle");
    if ((await grip.count()) === 0) return;
    await page.locator(`[data-source-drag="src-file:${IDS.source}"]`).hover();
    const from = await grip.boundingBox();
    const a = await page.locator(`[data-node-id="${IDS.p1}"]`).boundingBox();
    const b = await page.locator(`[data-node-id="${IDS.p2}"]`).boundingBox();
    if (!from || !a || !b) return;
    await page.mouse.move(from.x + 9, from.y + 11);
    await page.mouse.down();
    await page.mouse.move(a.x + 60, (a.y + a.height + b.y) / 2, { steps: 12 });
    await page.waitForTimeout(400);
    await shot(page, "1440-held-file");
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });

  test("390: the composer on a phone", async ({ page }) => {
    await open(page, 390, [], 844);
    await page.waitForTimeout(600);
    await shot(page, "390-composer");
    const row = session(page, KEY.a).getByTestId("add-to-session");
    if ((await row.count()) > 0) {
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.waitForTimeout(400);
      await shot(page, "390-add-sheet");
    }
  });
});
