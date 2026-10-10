// A conversation the connector parks is listed as soon as a sessions panel
// opens: Drafts' "Sessions" and the composer's "Your sessions".
//
// WHY THIS NEEDS ITS OWN TEST. The connector's finish_import
// (supabase/functions/mcp) parks a conversation as an import_sessions row with
// status 'parsed', from another application: Claude, Claude Code, a terminal.
// Nothing tells this browser it happened, so a panel has to ask when it opens,
// when the reader comes back to the tab, and every so often while it is open.
// Both panels used to answer from one list cached for thirty seconds, so a
// session parked just after either page was read was missing from the next one
// opened, and from the open one until a reload.
//
// THE BACKEND IS FAKED (support/fakeBackend.ts). import_sessions answers the
// waiting list from the rows the test parks; parking one is what finish_import
// does.

import { expect, test, type Page } from "@playwright/test";
import { fakeBoundaries, json, uuid, type Row } from "./support/fakeBackend";

const FIRST_PROMPT = "Rename my holiday photos by the date they were taken";

/** The row finish_import leaves, as the list's select reads it: parsed, in no build. */
const parkedRow = (n: number): Row => ({
  id: uuid(300 + n),
  client: "claude-code",
  model: "claude-sonnet-5-5",
  target_build_id: null,
  build_id: null,
  status: "parsed",
  created_at: new Date().toISOString(),
  first_prompt: FIRST_PROMPT,
  user_turns: 3,
  assistant_turns: 3,
});

interface Connector {
  /** finish_import: the conversation is parked, waiting for the creator. */
  park: () => void;
  /** How many times the browser has read the waiting list. */
  reads: () => number;
}

async function fakeBackend(page: Page): Promise<Connector> {
  const rows: Row[] = [];
  let reads = 0;
  await fakeBoundaries(page);
  await page.route(/\/rest\/v1\/builds(\?|$)/, (route) => json(route, []));
  await page.route(/\/rest\/v1\/import_sessions/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("status=in.(parsed)")) {
      reads += 1;
      return json(route, rows.filter((row) => row.status === "parsed"));
    }
    if (url.includes("status=in.(parsed,claimed)")) return json(route, rows);
    return json(route, []);
  });
  return { park: () => void rows.push(parkedRow(rows.length + 1)), reads: () => reads };
}

const onPhone = (projectName: string) => projectName === "mobile";

/** The header's New build, or the phone dock's New: a client-side navigation, as the reader makes it. */
async function openNewBuild(page: Page, phone: boolean) {
  if (phone) await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "New" }).click();
  else await page.getByRole("button", { name: "New build" }).click();
  await expect(page).toHaveURL(/\/compose\/new$/);
}

/** The header's Drafts, or the phone's account sheet. */
async function openDrafts(page: Page, phone: boolean) {
  if (phone) {
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("dialog", { name: "Account" }).getByRole("link", { name: "Drafts" }).click();
  } else {
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Drafts" }).click();
  }
  await expect(page).toHaveURL(/\/drafts$/);
}

/** The reader comes back from the tool in another tab: the browser fires visibilitychange. */
const returnToTab = (page: Page) =>
  page.evaluate(() => document.dispatchEvent(new Event("visibilitychange", { bubbles: true })));

/** Marks this document, so a test can show the page was never reloaded. */
const markDocument = (page: Page) => page.evaluate(() => ((window as unknown as { __sameDocument: boolean }).__sameDocument = true));
const sameDocument = (page: Page) => page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument === true);

const waitingInComposer = (page: Page) => page.getByRole("region", { name: "Not in a build yet" }).getByTestId("waiting-session");
const waitingOnDrafts = (page: Page) => page.getByTestId("session-row");

test("a session parked after Drafts was read is listed as soon as a new build opens", async ({ page }, testInfo) => {
  const connector = await fakeBackend(page);
  await page.goto("/drafts");
  await expect(page.getByText("No new sessions.")).toBeVisible();

  connector.park();
  await openNewBuild(page, onPhone(testInfo.project.name));

  await expect(waitingInComposer(page)).toHaveCount(1);
  await expect(waitingInComposer(page)).toContainText(FIRST_PROMPT);
});

test("a session parked after a new build was opened is listed as soon as Drafts opens", async ({ page }, testInfo) => {
  const connector = await fakeBackend(page);
  await page.goto("/compose/new");
  await expect(page.getByTestId("compose-sessions")).toContainText("No sessions in this build yet.");
  await expect.poll(connector.reads).toBe(1);

  connector.park();
  await openDrafts(page, onPhone(testInfo.project.name));

  await expect(waitingOnDrafts(page)).toHaveCount(1);
  await expect(waitingOnDrafts(page)).toContainText(FIRST_PROMPT);
});

test("a session parked while Drafts is open is listed when the reader comes back to the tab", async ({ page }) => {
  const connector = await fakeBackend(page);
  await page.goto("/drafts");
  await expect(page.getByText("No new sessions.")).toBeVisible();
  await markDocument(page);

  connector.park();
  await returnToTab(page);

  // Well inside the open panel's own refresh interval, so only coming back can have asked.
  await expect(waitingOnDrafts(page)).toHaveCount(1, { timeout: 4_000 });
  expect(await sameDocument(page)).toBe(true);
});

test("a session parked while Drafts stays on screen is listed without a reload", async ({ page }) => {
  await page.clock.install();
  const connector = await fakeBackend(page);
  await page.goto("/drafts");
  await expect(page.getByText("No new sessions.")).toBeVisible();
  await markDocument(page);

  connector.park();
  // The tool ran in a window beside this one: no tab change, no navigation, only time.
  await page.clock.fastForward("00:20");

  await expect(waitingOnDrafts(page)).toHaveCount(1);
  expect(await sameDocument(page)).toBe(true);
});

test("a session parked while a new build stays on screen is listed without a reload", async ({ page }) => {
  await page.clock.install();
  const connector = await fakeBackend(page);
  await page.goto("/compose/new");
  await expect(page.getByTestId("compose-sessions")).toContainText("No sessions in this build yet.");
  await expect.poll(connector.reads).toBe(1);
  await markDocument(page);

  connector.park();
  await page.clock.fastForward("00:20");

  await expect(waitingInComposer(page)).toHaveCount(1);
  await expect(waitingInComposer(page)).toContainText(FIRST_PROMPT);
  expect(await sameDocument(page)).toBe(true);
});
