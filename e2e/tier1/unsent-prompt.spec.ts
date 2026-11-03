// Tier 1: UX-01 P1, text left in the prompt box is never lost.
//
// Typed text survives a reload, is listed as a required item when Publish is pressed (with both of its links working), and is
// named in the window that asks before leaving. The backend is the same stateful fake the post-thread spec uses.

import { expect, test, type Page } from "@playwright/test";

import { fakeThreadBackend } from "./support/postThreadBackend";

/** An empty build offers "New empty session"; the session it starts has the prompt box. */
const toBuild = async (page: Page) => {
  await page.getByRole("button", { name: /New empty session/ }).click();
  await expect(box(page)).toBeVisible();
};

const box = (page: Page) => page.getByRole("textbox", { name: "Add a prompt" }).first();
const unsentCount = (page: Page) => page.evaluate(() => Object.keys(sessionStorage).filter((key) => key.startsWith("ux-unsent:") && sessionStorage.getItem(key)).length);

const TEXT = "Build me an ordering site for a small bakery.";

test("unsent text comes back after a reload, blocks Publish with two working links, and is named when leaving", async ({ page }) => {
  await fakeThreadBackend(page);
  await page.goto("/compose/new");
  await toBuild(page);

  await box(page).fill(TEXT);
  await expect.poll(() => unsentCount(page)).toBeGreaterThan(0);
  await page.reload();
  await expect(box(page)).toHaveValue(TEXT);

  // Publish: the checklist shows it as required.
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  const checklist = page.getByTestId("publish-checklist");
  await expect(checklist.getByText("Unsent prompt in Session 1")).toBeVisible();
  await expect(checklist.getByText(TEXT.slice(0, 80))).toBeVisible();
  await expect(checklist.getByTestId("checklist-publish")).toBeDisabled();

  // Discard clears the box, and the stored copy.
  await checklist.getByRole("button", { name: /^Discard/ }).click();
  await expect.poll(() => unsentCount(page)).toBe(0);
});

test("Add as step tile sends the unsent prompt as a tile and clears the box", async ({ page }) => {
  await fakeThreadBackend(page);
  await page.goto("/compose/new");
  await toBuild(page);
  await box(page).fill(TEXT);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByTestId("publish-checklist").getByRole("button", { name: /^Add as step tile/ }).click();
  await expect(page.getByTestId("publish-checklist")).toBeHidden();
  await expect(page.getByText(TEXT).first()).toBeVisible();
  await expect.poll(() => unsentCount(page)).toBe(0);
});

test("leaving with unsent text asks, and the window names the session", async ({ page }) => {
  await fakeThreadBackend(page);
  await page.goto("/compose/new");
  await toBuild(page);
  await box(page).fill(TEXT);
  await page.getByRole("link", { name: /buildgallery|home/i }).first().click();
  const leave = page.getByTestId("leave-window");
  await expect(leave).toBeVisible();
  await expect(leave.getByText("Unsent prompt in Session 1")).toBeVisible();
});
