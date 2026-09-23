// Tier 3 — EX-P17, /connect: how to add the buildgallery connector to each AI
// tool.
//
// WHAT FAILS SILENTLY HERE, AND SO WHAT IS ASSERTED. A setup page is only as
// good as the strings a creator carries away from it. A command with one
// character wrong, an address copied from a stale build, or a Copy button that
// puts something other than what it shows on the clipboard all look perfect on
// screen and fail in somebody else's product, where nothing points back here.
// So the address and the command are compared whole — on screen, on the
// clipboard, and in public/ai.txt, which carries the same address for crawlers.
//
// THE PANELS START CLOSED, and "closed" is asserted as the thing a screen
// reader hears — `aria-expanded="false"` and no region in the accessibility
// tree — as well as the thing a sighted visitor sees, which is the command not
// being on screen. A panel that looked shut while its region stayed exposed
// would read as four sets of steps at once to exactly the people who can least
// afford to wade through them.
//
// OUTSIDE THE FRAME, proved with a positive control. Both the desktop rail and
// the phone's bottom bar are `<nav aria-label="Primary">`, so "no Primary
// navigation" is the frame's absence at every width — but only if the selector
// can see the frame at all, which /import (inside it) checks first. Without
// that, a renamed landmark would turn the negative assertion vacuous.
//
// NO AUTH, NO SEEDED DATA, NO BACKEND. The page reads nothing, so there is
// nothing to stub. SELECTORS ARE ROLE AND ACCESSIBLE NAME, no `.ns-*` and no
// Tailwind utility. ALL THREE WIDTHS the theme names for overflow, set per test
// inside the desktop project, because the `mobile` project matches tier 1 only.

import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [
  { name: "desktop", width: 1400, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const CONNECTOR_URL = "https://zybdotagjwektucfdkri.supabase.co/functions/v1/mcp";
const CLAUDE_CODE_COMMAND = `claude mcp add --transport http buildgallery ${CONNECTOR_URL}`;

const PANELS = ["Claude (web and desktop)", "Claude Code", "ChatGPT", "Cursor"] as const;

const SENTENCES = [
  "put this conversation on buildgallery",
  "what drafts do I have on buildgallery?",
  "add this conversation to my [title] draft",
  "did my last upload arrive?",
] as const;

/** True when anything on the page reaches past the viewport horizontally. */
const overflowsX = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );

const toggle = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });

/** A panel's steps, as the accessibility tree exposes them — only when open. */
const steps = (page: Page, name: string) =>
  page.getByRole("region", { name, exact: true });

for (const viewport of WIDTHS) {
  test.describe(`EX-P17 — /connect (${viewport.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test("renders outside the frame with every tool's panel closed", async ({ page }) => {
      // The positive control: inside the frame, the selector finds it.
      await page.goto("/import");
      await expect(page.getByRole("navigation", { name: "Primary" })).not.toHaveCount(0);

      await page.goto("/connect");
      await expect(
        page.getByRole("heading", { level: 1, name: "Connect your AI tool to buildgallery" })
      ).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "buildgallery", exact: true })).toHaveAttribute(
        "href",
        "/"
      );

      for (const name of PANELS) {
        await expect(toggle(page, name)).toBeVisible();
        await expect(toggle(page, name)).toHaveAttribute("aria-expanded", "false");
        await expect(steps(page, name)).toHaveCount(0);
      }
      await expect(page.getByText(CLAUDE_CODE_COMMAND)).toBeHidden();

      expect(await overflowsX(page)).toBe(false);
    });

    test("each panel opens to that tool's own steps, and closes again", async ({ page }) => {
      await page.goto("/connect");

      await toggle(page, "Claude (web and desktop)").click();
      await expect(toggle(page, "Claude (web and desktop)")).toHaveAttribute(
        "aria-expanded",
        "true"
      );
      const claude = steps(page, "Claude (web and desktop)");
      await expect(claude).toBeVisible();
      await expect(claude.getByText("Add custom connector")).toBeVisible();
      await expect(claude.getByText(CONNECTOR_URL, { exact: true })).toBeVisible();
      await expect(claude.getByText("consent page", { exact: false })).toBeVisible();
      await expect(
        claude.getByText("an owner has to add the connector", { exact: false })
      ).toBeVisible();
      const anthropic = claude.getByRole("link", { name: "Anthropic's guide to custom connectors" });
      await expect(anthropic).toHaveAttribute(
        "href",
        "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"
      );
      await expect(anthropic).toHaveAttribute("target", "_blank");

      await toggle(page, "Claude Code").click();
      const claudeCode = steps(page, "Claude Code");
      // The command whole, character for character — the one line on the page
      // that has to be exactly right to work at all.
      await expect(claudeCode.getByText(CLAUDE_CODE_COMMAND, { exact: true })).toBeVisible();
      await expect(claudeCode.getByText("/mcp", { exact: true })).toBeVisible();

      await toggle(page, "ChatGPT").click();
      const chatgpt = steps(page, "ChatGPT");
      await expect(chatgpt.getByText("Developer Mode", { exact: false }).first()).toBeVisible();
      await expect(chatgpt.getByText(CONNECTOR_URL, { exact: true })).toBeVisible();
      await expect(
        chatgpt.getByRole("link", { name: "OpenAI's guide to Developer Mode and MCP apps" })
      ).toHaveAttribute(
        "href",
        "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt"
      );

      await toggle(page, "Cursor").click();
      const cursor = steps(page, "Cursor");
      await expect(cursor.getByText("MCP settings", { exact: false })).toBeVisible();
      await expect(cursor.getByText(CONNECTOR_URL, { exact: true })).toBeVisible();
      await expect(
        cursor.getByRole("link", { name: "Cursor's MCP documentation" })
      ).toHaveAttribute("href", "https://cursor.com/docs/mcp");

      // Four panels open at once is the widest this page gets; the long command
      // must wrap inside its well rather than push the page sideways.
      expect(await overflowsX(page)).toBe(false);

      await toggle(page, "Claude (web and desktop)").click();
      await expect(toggle(page, "Claude (web and desktop)")).toHaveAttribute(
        "aria-expanded",
        "false"
      );
      await expect(steps(page, "Claude (web and desktop)")).toHaveCount(0);
    });

    test("shows the four sentences to copy and the plain paragraph under them", async ({
      page,
    }) => {
      await page.goto("/connect");

      for (const sentence of SENTENCES) {
        await expect(page.getByText(`“${sentence}”`, { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: `Copy “${sentence}”` })).toBeVisible();
      }

      // Every clause the brief names, each a promise the code keeps.
      const paragraph = page.getByText("When you ask, your AI tool sends the whole conversation", {
        exact: false,
      });
      await expect(paragraph).toBeVisible();
      for (const clause of [
        "the whole conversation to buildgallery, word for word",
        "looks like an API key or other secret is removed before it is saved for you to review",
        "Nothing is published unless you publish it",
        "cannot change or delete anything you have already made",
        "waits on your upload page for seven days",
        "relies on your AI tool reproducing the conversation faithfully",
        "exporting the chat as a file",
      ]) {
        await expect(paragraph).toContainText(clause);
      }
      await expect(paragraph.getByRole("link", { name: "upload page" })).toHaveAttribute(
        "href",
        "/compose/new"
      );

      expect(await overflowsX(page)).toBe(false);
    });
  });
}

test.describe("EX-P17 — /connect copies exactly what it shows", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  const clipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

  test("Copy puts the command, the address and a sentence on the clipboard unchanged", async ({
    page,
  }) => {
    await page.goto("/connect");

    await toggle(page, "Claude Code").click();
    const claudeCode = steps(page, "Claude Code");
    await claudeCode.getByRole("button", { name: "Copy the Claude Code command" }).click();
    await expect(claudeCode.getByRole("status")).toHaveText("Copied");
    expect(await clipboard(page)).toBe(CLAUDE_CODE_COMMAND);

    await toggle(page, "Cursor").click();
    const cursor = steps(page, "Cursor");
    await cursor.getByRole("button", { name: "Copy the connector address" }).click();
    await expect(cursor.getByRole("status")).toHaveText("Copied");
    expect(await clipboard(page)).toBe(CONNECTOR_URL);

    const sentence = SENTENCES[2];
    await page.getByRole("button", { name: `Copy “${sentence}”` }).click();
    await expect(
      page.getByRole("listitem").filter({ hasText: sentence }).getByRole("status")
    ).toHaveText("Copied");
    // The sentence itself, without the quotation marks the page sets it in.
    expect(await clipboard(page)).toBe(sentence);
  });
});

test("ai.txt names the connector's address and lets every crawler read /connect", async ({
  request,
}) => {
  const response = await request.get("/ai.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();

  expect(body).toContain(CONNECTOR_URL);
  expect(body).toContain("Setup instructions for each AI tool: /connect");

  // One Allow line per crawler block, so no bot is left out of the page.
  const agents = body.match(/^User-agent: .+$/gm) ?? [];
  const allows = body.match(/^Allow: \/connect$/gm) ?? [];
  expect(agents.length).toBeGreaterThan(0);
  expect(allows).toHaveLength(agents.length);
});
