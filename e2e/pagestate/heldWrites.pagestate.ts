// G22: type, end the session, sign in, reload, and the words are there; and the same with the connection lost instead. Every unsaved edit is in the write guard's offline store
// (bg:pending:{buildId}) before the editor says anything about the session; once signed in again, the held write goes out and
// the server has it. Faked network with state (network.ts, statefulServer). Run: npx playwright test -c
// playwright.pagestate.config.ts heldWrites

import { expect, test, type Page } from "@playwright/test";

import { installStateful, signIn, statefulServer, type StatefulServer } from "./network";

const BUILD = "00000000-0000-4000-8000-0000000000f1";
const TYPED = "Words typed as the session ended.";

async function openAndType(page: Page, server: StatefulServer) {
  await installStateful(page, server);
  await signIn(page);
  await page.goto(`/compose/${BUILD}`);
  const words = page.locator("[data-testid='post-words'] [contenteditable='true']").first();
  await words.waitFor({ timeout: 20_000 });
  await words.click();
  await page.keyboard.type(TYPED);
}

const held = (page: Page) => page.evaluate((key) => window.localStorage.getItem(key) ?? "", `bg:pending:${BUILD}`);

async function backAndReload(page: Page, server: StatefulServer) {
  server.mode = "live";
  await signIn(page);
  await page.reload();
  await expect.poll(() => server.writes.some((w) => (w.body ?? "").includes(TYPED)), { timeout: 20_000 }).toBe(true);
  await expect(page.locator("[data-testid='post-words']").first()).toContainText(TYPED, { timeout: 20_000 });
  await expect.poll(async () => page.evaluate((key) => window.localStorage.getItem(key), `bg:pending:${BUILD}`), { timeout: 10_000 }).toBeNull();
}

test("type, end the session, sign in, reload: the words are there", async ({ page }) => {
  test.setTimeout(90_000);
  const server = statefulServer(BUILD);
  await openAndType(page, server);
  // The session ends while the words are still in their 800 ms pause.
  server.mode = "refused";
  await expect.poll(() => held(page), { timeout: 20_000 }).toContain("Words typed as the session ended");
  expect(server.writes.filter((w) => (w.body ?? "").includes(TYPED))).toHaveLength(0);
  // Signing in again: a new session in place, and the page loaded again.
  await backAndReload(page, server);
});

test("type, lose the connection, reload once it is back: the words are there", async ({ page }) => {
  test.setTimeout(90_000);
  const server = statefulServer(BUILD);
  await openAndType(page, server);
  // Every request now goes unanswered, before the 800 ms pause is over.
  server.mode = "down";
  await expect.poll(() => held(page), { timeout: 20_000 }).toContain("Words typed as the session ended");
  expect(server.writes.filter((w) => (w.body ?? "").includes(TYPED))).toHaveLength(0);
  await backAndReload(page, server);
});
