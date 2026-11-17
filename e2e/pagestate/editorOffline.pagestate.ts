// G23 (as decided): the editor keeps its own offline strip and ConnectionBanner stays hidden there. This records what the editor
// shows under "aborted" (every request to the project fails with no answer) and checks the strip and what it reads when the
// browser says it is offline. The strip shows once the editor knows it is offline: a write that got no answer and was handed
// to its connection, or the browser saying so. Readings land in
// test-results/pagestate-offline. Run: npx playwright test -c playwright.pagestate.config.ts editorOffline

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { installCondition, signIn } from "./network";

const OUT = path.resolve("test-results/pagestate-offline");

async function record(name: string, reading: Record<string, unknown>) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(reading, null, 2));
  console.log(`OFFLINE ${name}: ${JSON.stringify(reading)}`);
}

const BANNER = "Connection issue";

test("aborted: what the editor shows when its requests fail with no answer, before and after typing", async ({ page }) => {
  test.setTimeout(60_000);
  await installCondition(page, "aborted");
  await signIn(page);
  await page.goto("/compose/new");
  const words = page.locator("[data-testid='post-words'] [contenteditable='true']").first();
  await words.waitFor({ timeout: 20_000 });
  const before = await page.getByTestId("offline-strip").count();
  await words.click();
  await page.keyboard.type("A first line, typed with no network.");
  // Long enough for the draft's first save to have been tried more than once.
  await page.waitForTimeout(8_000);
  const after = await page.getByTestId("offline-strip").count();
  const status = (await page.getByTestId("sandbox-status").first().textContent())?.trim() ?? "";
  const banner = await page.getByText(BANNER).count();
  await record("aborted-typed", { stripBeforeTyping: before, stripAfterTyping: after, saveStatus: status, connectionBanner: banner });
  /* FINDING (reported, not fixed): the strip does not appear here. A new build's first save (createBuild) fails with no
     answer and is tried again while the status reads "saving…"; that failure is not handed to the editor's connection
     (noteNetworkFailure), and changing it is the mutation's own error handling, which this work may not touch. */
  expect(before).toBe(0);
  expect(banner, "ConnectionBanner stays hidden in the editor").toBe(0);
});

test("the browser offline: the strip shows on load, before anything is typed", async ({ page, context }) => {
  test.setTimeout(60_000);
  await installCondition(page, "aborted");
  await signIn(page);
  await page.goto("/compose/new");
  await page.locator("[data-testid='post-words']").first().waitFor({ timeout: 20_000 });
  await context.setOffline(true);
  const strip = page.getByTestId("offline-strip");
  await expect(strip).toBeVisible({ timeout: 10_000 });
  const text = (await strip.textContent())?.trim() ?? "";
  const banner = await page.getByText(BANNER).count();
  await record("browser-offline", { strip: text, connectionBanner: banner });
  expect(text).toBe("Offline. Changes save when you reconnect.");
  expect(banner, "ConnectionBanner stays hidden in the editor").toBe(0);
  await context.setOffline(false);
});
