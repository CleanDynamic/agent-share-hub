// G22: type, end the session, sign in, reload, and the text is there. Every unsaved edit is in the write guard's offline store
// (bg:pending:{buildId}) before the editor says anything about the session; once signed in again, the held write goes out and
// the server has it. Faked network with state (network.ts, statefulServer). Run: npx playwright test -c
// playwright.pagestate.config.ts heldWrites

import { expect, test } from "@playwright/test";

import { installStateful, signIn, statefulServer } from "./network";

const BUILD = "00000000-0000-4000-8000-0000000000f1";
const TYPED = "Words typed as the session ended.";

test("type, end the session, sign in, reload: the text is there", async ({ page }) => {
  /* KNOWN FAILURE, reported and waiting for a decision: the post's save (saveThread) sends the pictures call
     (set_build_post_media) and only once it has answered sends the PATCH that carries the words. With the session refused
     the pictures call is held and never answered, so the PATCH is never made and the words are not in the store; offline has
     the same gap. Passing needs a change to that write path (send both together, or skip the pictures call when the pictures
     have not changed). Remove this line once it is made. */
  test.fail(true, "saveThread chains its PATCH behind a held call: the words never reach the store");
  test.setTimeout(90_000);
  const server = statefulServer(BUILD);
  await installStateful(page, server);
  await signIn(page);
  await page.goto(`/compose/${BUILD}`);
  const words = page.locator("[data-testid='post-words'] [contenteditable='true']").first();
  await words.waitFor({ timeout: 20_000 });

  // The session ends while the words are still in their 800 ms pause.
  await words.click();
  await page.keyboard.type(TYPED);
  server.mode = "refused";

  // The refusal is heard (the post's own save, or any other read), confirmed, and the session cleared on this device.
  await expect
    .poll(async () => page.evaluate((key) => window.localStorage.getItem(key) ?? "", `bg:pending:${BUILD}`), { timeout: 20_000 })
    .toContain("Words typed as the session ended");
  expect(server.writes.filter((w) => (w.body ?? "").includes(TYPED))).toHaveLength(0);

  // Signing in again, here by putting a new session in place and loading the page again.
  server.mode = "live";
  await signIn(page);
  await page.reload();
  await expect.poll(() => server.writes.some((w) => (w.body ?? "").includes(TYPED)), { timeout: 20_000 }).toBe(true);
  await expect(page.locator("[data-testid='post-words']").first()).toContainText(TYPED, { timeout: 20_000 });
  await expect.poll(async () => page.evaluate((key) => window.localStorage.getItem(key), `bg:pending:${BUILD}`), { timeout: 10_000 }).toBeNull();
});
