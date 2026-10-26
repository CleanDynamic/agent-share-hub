/* SV-05 P5: the post's grip, measured on the dev page (`npm run audit -- composer-sv05-boxes`): hidden while the post has
   one block, shown on hover once it has two, and its box keeps 4 clear of the avatar.

   P6's file suggestion is checked in SourcesPanel.test.tsx: no dev page draws a session whose app reads a project file. */

import { expect, test, type Page } from "@playwright/test";

const SANDBOX = "/dev/kit/pages/sandbox?theme=dusk";

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(SANDBOX);
  await page.waitForFunction(() => document.querySelectorAll("[data-testid]").length > 20, null, { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
}

test("SV-05 P5 · the grip: none on one block, beside two, clear of the avatar", async ({ page }) => {
  await open(page, 1440);
  const words = page.getByTestId("post-words");
  const editor = words.locator(".ProseMirror").first();
  await editor.click();
  // The fox poster's post starts with one empty block.
  expect(await editor.evaluate((element) => element.children.length)).toBe(1);
  await editor.hover();
  await expect(page.locator("[data-block-handle]")).toHaveCount(0);

  await page.keyboard.type("A first line");
  await page.keyboard.press("Enter");
  await page.keyboard.type("A second line");
  await editor.locator(":scope > *").first().hover();
  const grip = page.locator("[data-block-handle]");
  await expect(grip).toHaveCount(1);
  const box = (await grip.boundingBox())!;
  const avatar = (await page.locator("[data-rail-avatar]").first().boundingBox())!;
  const clear = box.x - (avatar.x + avatar.width);
  expect(clear, `the grip stands ${clear}px from the avatar`).toBeGreaterThanOrEqual(4);
});
