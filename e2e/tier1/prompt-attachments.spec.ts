// Tier 1: a Prompt tile records one message as it was sent.
//
// Three screenshots and a markdown file attached to one prompt, the text "Prompt example.", Opus 5.5 at Medium effort, published:
// the composer draws one Prompt tile with the four attachments inside it, and the build page draws one message, the attachments
// above the text, in order, then the meta line. The backend is the same stateful fake the post-thread spec uses.

import { expect, test, type Page } from "@playwright/test";

import { fakeThreadBackend, PNG, type ThreadBackend } from "./support/postThreadBackend";

const TEXT = "Prompt example.";
const FILES = [
  { name: "screenshot-1.png", mimeType: "image/png", buffer: PNG },
  { name: "screenshot-2.png", mimeType: "image/png", buffer: PNG },
  { name: "screenshot-3.png", mimeType: "image/png", buffer: PNG },
  { name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Notes\n\nPricing is per seat.\n") },
];

const box = (page: Page) => page.getByRole("textbox", { name: "Add a prompt" }).first();

/**
 * Publish asks first: the checklist lists the pictures attached to prompts, to check before anyone else sees them. The rest of the
 * checklist (a cover, a title, a description) is the post-thread spec's to drive; here the fake's build is marked published as
 * Confirm would, so the build page reads what the composer wrote.
 */
async function publish(page: Page, backend: ThreadBackend) {
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  // The checklist window on a computer, the ready sheet on a phone.
  const checklist = page.getByTestId("publish-checklist").or(page.getByTestId("ready-sheet"));
  const pictures = checklist.getByTestId("checklist-section-pictures");
  await expect(pictures).toBeVisible();
  await expect(pictures.getByRole("button", { name: /^Open screenshot-/ })).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(checklist).toBeHidden();
  Object.assign(backend.build() ?? {}, { status: "published", title: "One message", published_at: "2026-11-27T10:00:00.000Z" });
}

test("one prompt with four attachments is one tile in the composer and one message on the build page", async ({ page }) => {
  const backend = await fakeThreadBackend(page);
  await page.goto("/compose/new");
  await page.getByRole("button", { name: /New empty session/ }).click();
  await page.getByRole("button", { name: /^Select a tool, Prompt tool/ }).click();
  await page.getByRole("option", { name: "Claude", exact: true }).click();
  await page.getByRole("button", { name: /Model|model/ }).first().click();
  // A menu on a computer, a sheet of options on a phone.
  await page.getByRole("menuitemradio", { name: "Opus 5.5" }).or(page.getByRole("dialog", { name: "Model" }).getByRole("option", { name: "Opus 5.5" })).click();
  await box(page).fill(TEXT);
  // The Add beside the prompt box (the composer has other Add buttons).
  await box(page).locator("xpath=ancestor::*[.//button[normalize-space()='Add']][1]").getByRole("button", { name: "Add", exact: true }).click();

  const tile = page.getByTestId("step-card").first();
  await expect(tile).toBeVisible();
  await tile.dblclick();
  const window = page.getByTestId("full-prompt-window");
  await expect(window).toBeVisible();

  await window.getByTestId("attach-input").setInputFiles(FILES);
  const items = window.getByTestId("attached-item");
  await expect(items).toHaveCount(4);
  expect(await items.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")))).toEqual(FILES.map((file) => file.name));

  // Medium effort (the model was chosen on the prompt box).
  const toggle = window.getByTestId("optional-toggle");
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  await window.getByRole("radiogroup", { name: "Reasoning effort" }).getByRole("radio", { name: "Medium" }).click();
  await window.getByTestId("prompt-close").click();
  // A phone opens the tile's Details sheet as the window closes; it covers the List.
  const details = page.getByRole("dialog", { name: "Details" });
  await details.waitFor({ state: "visible", timeout: 3000 }).then(
    () => details.getByRole("button", { name: "Close Details" }).click(),
    () => undefined,
  );

  // One Prompt tile, its attachments inside it; no File tiles of their own.
  await expect(page.getByTestId("step-card")).toHaveCount(1);
  await expect(tile.getByTestId("attachment-strip").getByRole("listitem")).toHaveCount(4);
  await expect(tile.getByText("Uses")).toHaveCount(0);

  await publish(page, backend);
  await page.goto(`/b2/${backend.build()?.slug}`);
  const message = page.getByTestId("step-card").first();
  await expect(page.getByTestId("step-card")).toHaveCount(1);
  const strip = message.getByTestId("attachment-strip");
  await expect(strip.getByRole("button", { name: /^Open / })).toHaveText(["", "", "", /notes\.md/]);
  await expect(strip.getByRole("button", { name: /^Open / }).first()).toHaveAttribute("aria-label", "Open screenshot-1.png");
  const order = await message.locator('[data-testid="attachment-strip"], [data-testid="step-text"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
  expect(order).toEqual(["attachment-strip", "step-text"]);
  await expect(message.getByTestId("step-text")).toHaveText(TEXT);
  await expect(message.getByTestId("message-meta")).toHaveText("Opus 5.5 · Medium effort");
});
