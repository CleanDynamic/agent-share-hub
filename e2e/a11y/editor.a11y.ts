// G19: the build editor, end to end, with the keyboard alone: add a session, add tiles, edit a tile's text, open and close its
// options, reorder it with the keyboard drag, nest it and unnest it, publish. Nothing is clicked and nothing is focused by
// script: every move is a key press (Tab, Shift+Tab, the arrows, Enter, Space, Escape, typing). The network is fakeDb.ts's
// in-memory stand-in; nothing reaches the live project.

import { expect, test, type Page } from "@playwright/test";

import { signIn } from "../pagestate/network";
import { installFakeDb } from "./fakeDb";
import { settle } from "./harness";

/** What has focus: its tag, role and name, as one line a test can match. */
const where = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const labelled = (el as HTMLInputElement | null)?.labels?.[0]?.textContent?.trim();
    const name = el?.getAttribute("aria-label") ?? labelled ?? el?.textContent?.trim().slice(0, 60) ?? "";
    return `${el?.tagName ?? "none"} [${el?.getAttribute("role") ?? ""}] "${name}"`;
  });

/** Press Tab (or Shift+Tab) until focus matches, as a keyboard user would. */
async function tabTo(page: Page, match: RegExp, back = false, max = 80): Promise<string> {
  for (let press = 0; press < max; press++) {
    const now = await where(page);
    if (match.test(now)) return now;
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
  }
  throw new Error(`Tab never reached ${match}; focus is on ${await where(page)}`);
}

/** Press a key until focus matches (the arrows inside the build list). */
async function pressTo(page: Page, key: string, match: RegExp, max = 12): Promise<string> {
  for (let press = 0; press < max; press++) {
    const now = await where(page);
    if (match.test(now)) return now;
    await page.keyboard.press(key);
  }
  throw new Error(`${key} never reached ${match}; focus is on ${await where(page)}`);
}

const WORDS = ["Rename the photos by the date taken", "Check the dates are right"];
/** The tiles' words in order (a tile's heading can carry more after its words, so it is matched on how it starts). */
const tileTitles = (page: Page) =>
  page
    .locator('[role="group"][aria-label^="Prompt"]')
    .evaluateAll((els) => els.map((el) => el.querySelector("h3")?.textContent ?? ""))
    .then((titles) => titles.map((title) => WORDS.find((words) => title.startsWith(words)) ?? title));

test("G19: the build editor with the keyboard alone", async ({ page }) => {
  test.setTimeout(180_000);
  // The node-type registry the editor reads, as far as this run needs it.
  const db = await installFakeDb(page, {
    node_types: [
      { key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A", icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1, schema: { fields: [{ key: "text", label: "Text", type: "text" }] } },
      // The cover: a picture is a screenshot, a video a recording, both evidence (composeCover.coverNodeType).
      { key: "screenshot", label: "Screenshot", category: "evidence", colour: "#2EC4B6", icon: "Image", renderer: "evidence", copyable: false, is_active: true, sort: 1, schema: { fields: [] } },
      { key: "recording", label: "Recording", category: "evidence", colour: "#2EC4B6", icon: "Video", renderer: "evidence", copyable: false, is_active: true, sort: 2, schema: { fields: [] } },
      { key: "result", label: "Result", category: "evidence", colour: "#2EC4B6", icon: "CircleCheck", renderer: "evidence", copyable: false, is_active: true, sort: 3, schema: { fields: [] } },
    ],
  });
  await signIn(page);
  await page.goto("/compose/new", { waitUntil: "load" });
  await settle(page);
  await page.locator(".ProseMirror").waitFor();

  // A session.
  await tabTo(page, /"New empty session"/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: /^Session 1/ })).toBeVisible();

  // Two tiles, typed into the session's prompt box.
  for (const words of WORDS) {
    await tabTo(page, /"Add a prompt"/);
    // The box is drawn again after an Add: type once it holds focus and is empty, and check every word arrived.
    const box = page.getByRole("textbox", { name: "Add a prompt" });
    await expect(box).toBeFocused();
    await expect(box).toHaveValue("");
    await page.waitForTimeout(150);
    await page.keyboard.type(words);
    await expect(box).toHaveValue(words);
    // Add is a Tab stop once there are words to add.
    await expect(page.getByRole("region", { name: "Build", exact: true }).getByRole("button", { name: "Add", exact: true })).toBeEnabled();
    await tabTo(page, /BUTTON \[\] "Add"$/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 3, name: new RegExp(`^${words}`) })).toBeVisible();
  }
  expect(await tileTitles(page)).toEqual(["Rename the photos by the date taken", "Check the dates are right"]);

  // Into the build list (one Tab stop), to the second tile.
  await tabTo(page, /\[group\] "Prompt/, true);
  await pressTo(page, "ArrowDown", /\[group\] "Prompt 2/);

  // Edit its text: Enter opens its window; its title is typed; Escape closes it and gives focus back to the tile.
  await page.keyboard.press("Enter");
  const stepWindow = page.getByRole("dialog", { name: "Step 2" });
  await expect(stepWindow).toBeVisible();
  await tabTo(page, /"Title"/, true);
  await page.keyboard.type("Date check");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(stepWindow).toHaveCount(0);
  await expect.poll(() => where(page)).toMatch(/\[group\] "Prompt 2: Date check"/);

  // Its options: Enter opens the menu on its first item, Escape closes it onto the options button.
  await pressTo(page, "ArrowRight", /"Prompt 2 options"/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  expect(await where(page)).toMatch(/\[menuitem\]/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect(await where(page)).toMatch(/"Prompt 2 options"/);

  // Reorder with the keyboard drag: the grip, Space, ArrowUp, Space.
  await pressTo(page, "ArrowLeft", /"Move Prompt 2"/);
  await page.keyboard.press("Space");
  await expect(page.getByTestId("nest-said")).toHaveText(/^Picked up Prompt 2\./);
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("nest-said")).toHaveText(/^Moved Prompt 2 to 1 of 2/);
  // The second tile shows its new title now.
  await expect.poll(() => tileTitles(page)).toEqual(["Date check", "Rename the photos by the date taken"]);

  // Nest the second tile under the first: its "Attach to the step above".
  await tabTo(page, /\[group\] "Prompt/, true);
  await pressTo(page, "ArrowDown", /\[group\] "Prompt 2/);
  await pressTo(page, "ArrowRight", /"Attach to the step above"/);
  await page.keyboard.press("Enter");
  await expect.poll(() => where(page)).toMatch(/\[group\] "Prompt attached to prompt 1/);

  // Unnest it: its own "Make it its own step", reached with the arrows like its other controls.
  await pressTo(page, "ArrowRight", /"Make it its own step"/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("group", { name: /^Prompt 2:/ })).toBeVisible();
  await expect(page.getByRole("group", { name: /^Prompt attached/ })).toHaveCount(0);

  // Evidence (what the checklist calls the cover): a Result step, from the list's "Add step" menu, found by typing.
  await tabTo(page, /\[group\] "Prompt/, true);
  await pressTo(page, "ArrowDown", /"Add step"/, 20);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu", { name: "Add step" })).toBeVisible();
  await page.keyboard.type("Result");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  const resultWindow = page.getByRole("dialog").filter({ has: page.getByRole("textbox", { name: "URL" }) });
  await expect(resultWindow).toBeVisible();
  await tabTo(page, /"URL"/, false, 30);
  await page.keyboard.type("example.com/renamed-photos");
  await tabTo(page, /BUTTON \[\] "Add"$/, false, 30);
  await page.keyboard.press("Enter");
  await expect(resultWindow).toHaveCount(0);

  // Publish: its checklist names what is still needed; each "Add …" goes to its field, saved with the window's Save.
  for (const [name, words] of [["Add title", "Photo renamer"], ["Add description", "Renames photos by the date they were taken."]] as const) {
    await tabTo(page, /BUTTON \[\] "Publish"$/, true, 160);
    await page.keyboard.press("Enter");
    const checklist = page.getByRole("dialog", { name: "Publish checklist" });
    await expect(checklist).toBeVisible();
    await tabTo(page, new RegExp(`"${name}:`), false, 40);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Classification" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName ?? ""))).toBe(true);
    await page.keyboard.type(words);
    await tabTo(page, /BUTTON \[\] "Save"$/, false, 60);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  // Nothing required is left: Publish, then the editor's confirmation, by Tab and Enter.
  await tabTo(page, /BUTTON \[\] "Publish"$/, true, 160);
  await page.keyboard.press("Enter");
  for (let step = 0; step < 3 && (await page.getByRole("dialog").count()) > 0; step++) {
    await tabTo(page, /BUTTON \[\] "Publish"$/, false, 40);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  await expect.poll(() => db.writes.some((write) => write.table === "builds" && JSON.stringify(write.body).includes('"published"'))).toBe(true);
});
