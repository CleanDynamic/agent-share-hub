// Tier 1: the build editor's tutorial.
//
// It opens by itself the first time a maker opens the editor, and is played: five steps, each a challenge on a small copy of the
// editor, answered press by press. It can be left at any step and does not come back by itself. "Tutorial" under Build options
// opens it again. An automated browser is never offered it (every other spec here opens the editor as a maker who has seen
// nothing, and relies on that), so the first-visit tests say they are not one.

import { expect, test, type Page } from "@playwright/test";

import { fakeThreadBackend } from "./support/postThreadBackend";

/** Open the editor as a person would: the browser does not say it is automated. */
const asAPerson = (page: Page) => page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));

const editor = (page: Page) => page.getByRole("button", { name: /New empty session/ });
const tutorial = (page: Page) => page.getByTestId("tutorial-window");
const stage = (page: Page) => page.getByTestId("tutorial-task");
const main = (page: Page) => page.getByTestId("tutorial-next");
const target = (page: Page, id: string) => page.locator(`[data-target="${id}"]`);
const progress = (page: Page) => page.getByTestId("tutorial-progress");

const open = async (page: Page) => {
  await fakeThreadBackend(page);
  await page.goto("/compose/new");
  await expect(editor(page)).toBeVisible();
};

/** Long enough for the tutorial to have opened if it was going to. */
const SETTLED = 1500;

/** The least a target may measure on a touch screen. */
const TOUCH = 44;

/** Each step's targets, in the order its goals ask for them. */
const GOALS = [["sources", "build", "details"], ["picture", "reference"], ["import", "add"], ["add", "tool", "move"], ["title", "publish"]];

test("a first visit opens the tutorial, and playing its five challenges ends in a clean run", async ({ page }, info) => {
  const phone = info.project.name === "mobile";
  await asAPerson(page);
  await open(page);

  await expect(tutorial(page)).toBeVisible();
  await expect(page.getByTestId("tutorial-count")).toHaveText("Tutorial · Step 1 of 5");
  await expect(progress(page)).toHaveText("0 of 5 done");
  await expect(main(page)).toHaveText("Skip step");

  const scenes = ["layout", "post", "sessions", "steps", "publish"];
  for (const [index, scene] of scenes.entries()) {
    await expect(tutorial(page)).toHaveAttribute("data-step", String(index + 1));
    await expect(stage(page)).toHaveAttribute("data-scene", scene);
    for (const id of GOALS[index]) {
      const box = await target(page, id).boundingBox();
      expect(box, `${scene}: ${id}`).not.toBeNull();
      if (phone) expect(Math.min(box!.width, box!.height), `${scene}: ${id} is big enough to press`).toBeGreaterThanOrEqual(TOUCH);
      if (id === "move" && !phone) {
        // On a computer the Tool step is dragged; the phone run presses its arrow.
        const tile = (await page.getByTestId("tutorial-drag").boundingBox())!;
        await page.mouse.move(tile.x + 80, tile.y + tile.height / 2);
        await page.mouse.down();
        await page.mouse.move(tile.x + 80, tile.y - tile.height / 2, { steps: 6 });
        await page.mouse.up();
      } else {
        await target(page, id).click();
      }
    }
    await expect(stage(page)).toHaveAttribute("data-cleared", "true");
    await expect(progress(page)).toHaveText(`${index + 1} of 5 done`);
    await expect(main(page)).toHaveText(index === scenes.length - 1 ? "Finish" : "Next");
    // The buttons stay inside the window, whatever the screen.
    const button = await main(page).boundingBox();
    expect(button && button.x >= 0 && button.x + button.width <= (page.viewportSize()?.width ?? 0)).toBe(true);
    await main(page).click();
  }

  await expect(tutorial(page)).toHaveAttribute("data-step", "complete");
  await expect(page.getByTestId("tutorial-title")).toHaveText("All five challenges done");
  await expect(page.getByTestId("tutorial-stat-challenges")).toHaveText("5 of 5");
  await expect(page.getByTestId("tutorial-stat-hints")).toHaveText("None");
  await expect(page.getByTestId("tutorial-clean")).toBeVisible();
  await expect(main(page)).toHaveText("Start building");
  await main(page).click();
  await expect(tutorial(page)).toBeHidden();

  // The editor is as it was (the challenges were played on a copy), and the tutorial stays away on the next visit.
  await expect(editor(page)).toBeVisible();
  await page.reload();
  await expect(editor(page)).toBeVisible();
  await page.waitForTimeout(SETTLED);
  await expect(tutorial(page)).toBeHidden();
});

test("a wrong press brings a hint and a pointer, and loses nothing", async ({ page }) => {
  await asAPerson(page);
  await open(page);
  await expect(tutorial(page)).toBeVisible();
  await target(page, "sources").click();
  await target(page, "details").click();
  await expect(page.getByTestId("tutorial-hint")).toHaveText("It is the wide one in the middle.");
  await expect(page.getByTestId("tutorial-hint-ring")).toBeVisible();
  await expect(stage(page)).toHaveAttribute("data-done", "1");
  await target(page, "build").click();
  await expect(page.getByTestId("tutorial-hint")).toBeHidden();
  await expect(stage(page)).toHaveAttribute("data-done", "2");
});

test("a challenge can be skipped, and the summary says how many were done", async ({ page }) => {
  await asAPerson(page);
  await open(page);
  await expect(tutorial(page)).toBeVisible();
  for (const id of GOALS[0]) await target(page, id).click();
  await main(page).click();
  for (let step = 2; step <= 5; step++) {
    await expect(tutorial(page)).toHaveAttribute("data-step", String(step));
    await expect(main(page)).toHaveText("Skip step");
    await main(page).click();
  }
  await expect(page.getByTestId("tutorial-title")).toHaveText("1 of 5 challenges done");
  await expect(page.getByTestId("tutorial-clean")).toBeHidden();
});

test("the tutorial can be left in the middle of a challenge", async ({ page }) => {
  await asAPerson(page);
  await open(page);
  await expect(tutorial(page)).toBeVisible();
  await main(page).click();
  await main(page).click();
  await expect(tutorial(page)).toHaveAttribute("data-step", "3");
  await target(page, "import").click();
  await page.getByTestId("tutorial-skip").click();
  await expect(tutorial(page)).toBeHidden();

  // Nothing was made or changed: the editor takes the next press.
  await editor(page).click();
  await expect(page.getByRole("textbox", { name: "Add a prompt" }).first()).toBeVisible();
});

test("Escape closes the tutorial at any step", async ({ page }) => {
  await asAPerson(page);
  await open(page);
  await expect(tutorial(page)).toBeVisible();
  for (let step = 1; step < 4; step++) await main(page).click();
  await expect(tutorial(page)).toHaveAttribute("data-step", "4");
  await page.keyboard.press("Escape");
  await expect(tutorial(page)).toBeHidden();
});

test("Show me plays the step as an example that can be paused, and Try it comes back", async ({ page }) => {
  await asAPerson(page);
  await open(page);
  await expect(tutorial(page)).toBeVisible();
  await page.getByTestId("tutorial-watch").click();
  const example = page.getByRole("button", { name: "Pause the example" });
  await expect(example).toBeVisible();
  await example.click();
  await expect(page.getByRole("button", { name: "Play the example" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.getAnimations().filter((run) => run.effect?.getTiming().iterations === Infinity).every((run) => run.playState === "paused"))).toBe(true);
  await page.getByTestId("tutorial-watch").click();
  await expect(stage(page)).toHaveAttribute("data-done", "0");
});

test("the challenges can be played from the keyboard", async ({ page }, info) => {
  test.skip(info.project.name === "mobile", "a phone has no keyboard to play from");
  await asAPerson(page);
  await open(page);
  await expect(tutorial(page)).toBeVisible();
  for (const id of GOALS[0]) {
    await target(page, id).focus();
    await page.keyboard.press("Enter");
  }
  await expect(stage(page)).toHaveAttribute("data-cleared", "true");
  // Clearing a step puts focus on Next, so Enter carries on.
  await expect(main(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(tutorial(page)).toHaveAttribute("data-step", "2");
});

test("an automated browser is not offered the tutorial, and Build options opens it", async ({ page }) => {
  await open(page);
  await page.waitForTimeout(SETTLED);
  await expect(tutorial(page)).toBeHidden();

  await page.getByTestId("build-options").click();
  await page.getByTestId("build-options-tutorial").click();
  await expect(tutorial(page)).toBeVisible();
  await expect(tutorial(page)).toHaveAttribute("data-step", "1");
  await page.getByTestId("tutorial-skip").click();
  await expect(tutorial(page)).toBeHidden();
});
