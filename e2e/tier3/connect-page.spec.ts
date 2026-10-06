// Tier 3 — UI-P45, /connect: the connector guide, in the frame and as a dialog.
//
// WHAT FAILS SILENTLY HERE, AND SO WHAT IS ASSERTED. A setup page is only as
// good as the strings a creator carries away from it. A command with one
// character wrong, or a Copy button that puts something other than what it
// shows on the clipboard, looks perfect on screen and fails in somebody else's
// product. So the address and the command are compared whole — on screen, on
// the (stubbed) clipboard, and in public/ai.txt.
//
// INSIDE THE FRAME, with a positive control: /import shows the Primary
// navigation, so its presence on /connect means something. NO AUTH, NO BACKEND:
// the page reads nothing. The clipboard is stubbed rather than granted, so the
// test needs no permission prompt and reads back exactly what the page wrote.
// SELECTORS ARE ROLE AND ACCESSIBLE NAME. All three widths the theme names for
// overflow are set per test inside the desktop project.

import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [
  { name: "desktop", width: 1400, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const CONNECTOR_URL = "https://zybdotagjwektucfdkri.supabase.co/functions/v1/mcp";
const CLAUDE_CODE_COMMAND = `claude mcp add --transport http buildgallery ${CONNECTOR_URL}`;

const SENTENCES = [
  "put this conversation on buildgallery",
  "what drafts do I have on buildgallery?",
  "add this conversation to my [title] draft",
  "did my last session arrive?",
] as const;

/** Replace the clipboard with one that remembers the last string written. */
const stubClipboard = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __copied: string | null };
    w.__copied = null;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          w.__copied = value;
        },
      },
    });
  });

const copied = (page: Page) => page.evaluate(() => (window as unknown as { __copied: string | null }).__copied);

const overflowsX = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);

const panelOverflows = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector("[data-ui=panel]");
    return !!panel && panel.scrollWidth > panel.clientWidth + 1;
  });

const stepper = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });

for (const viewport of WIDTHS) {
  test.describe(`UI-P45 — /connect (${viewport.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await stubClipboard(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test("renders inside the frame with the address on step 1", async ({ page }) => {
      await page.goto("/import");
      await expect(page.getByRole("navigation", { name: "Primary" })).not.toHaveCount(0);

      await page.goto("/connect");
      await expect(page.getByRole("heading", { level: 1, name: "Connect a tool" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary" })).not.toHaveCount(0);
      await expect(stepper(page, "01 Add the connector")).toHaveAttribute("aria-current", "step");
      await expect(page.getByText(CONNECTOR_URL, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
      expect(await overflowsX(page)).toBe(false);
      expect(await panelOverflows(page)).toBe(false);
    });

    test("Copy puts the address and the command on the clipboard unchanged", async ({ page }) => {
      await page.goto("/connect");

      await page.getByRole("button", { name: "Copy the connector address" }).click();
      await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
      expect(await copied(page)).toBe(CONNECTOR_URL);

      await page.getByRole("button", { name: "Claude Code", exact: true }).click();
      await expect(page.getByText(CLAUDE_CODE_COMMAND, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Copy the Claude Code command" }).click();
      expect(await copied(page)).toBe(CLAUDE_CODE_COMMAND);
    });

    test("the steps advance, step 2 copies a phrase, and Go to Drafts is the last step", async ({ page }) => {
      await page.goto("/connect");

      await next(page).click();
      await expect(stepper(page, "02 Send a session")).toHaveAttribute("aria-current", "step");
      for (const sentence of SENTENCES) {
        await expect(page.getByText(`“${sentence}”`, { exact: true })).toBeVisible();
      }
      await page.getByRole("button", { name: `Copy “${SENTENCES[2]}”` }).click();
      expect(await copied(page)).toBe(SENTENCES[2]);
      await expect(page.getByText("What gets sent.")).toBeVisible();
      // The panel clips what overflows it, so the page's own width proves nothing here.
      expect(await panelOverflows(page)).toBe(false);

      await next(page).click();
      await expect(stepper(page, "03 Use it in a build")).toHaveAttribute("aria-current", "step");
      await expect(page.getByRole("link", { name: "Import page" })).toHaveAttribute("href", "/import");
      await expect(next(page)).toHaveCount(0);
      expect(await panelOverflows(page)).toBe(false);

      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(stepper(page, "02 Send a session")).toHaveAttribute("aria-current", "step");
      await next(page).click();
      await page.getByRole("button", { name: "Go to Drafts", exact: true }).click();
      await expect(page).toHaveURL(/\/drafts$|\/login/);
      expect(await overflowsX(page)).toBe(false);
    });
  });
}

test.describe("UI-P45 — the footer opens the guide as a dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  test("opens, shows the address, closes on Escape and returns focus", async ({ page }) => {
    await page.goto("/gallery");
    const opener = page.getByRole("button", { name: "Connect a tool", exact: true });
    await opener.focus();
    await opener.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Send your sessions to buildgallery" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(CONNECTOR_URL, { exact: true })).toBeVisible();

    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "02 Send a session" })).toHaveAttribute("aria-current", "step");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
});

test("ai.txt names the connector's address and lets every crawler read /connect", async ({ request }) => {
  const response = await request.get("/ai.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();

  expect(body).toContain(CONNECTOR_URL);
  expect(body).toContain("Setup instructions for each AI tool: /connect");

  const agents = body.match(/^User-agent: .+$/gm) ?? [];
  const allows = body.match(/^Allow: \/connect$/gm) ?? [];
  expect(agents.length).toBeGreaterThan(0);
  expect(allows).toHaveLength(agents.length);
});
