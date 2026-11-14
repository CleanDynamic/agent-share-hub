// Tier 1: the build editor's tutorial.
//
// It opens by itself the first time a maker opens the editor, steps through five examples, can be left at any step, and does not
// come back by itself. "Tutorial" under Build options opens it again. An automated browser is never offered it (every other spec
// here opens the editor as a maker who has seen nothing, and relies on that), so the first-visit tests say they are not one.

import { expect, test, type Page } from "@playwright/test";

import { fakeThreadBackend } from "./support/postThreadBackend";

/** Open the editor as a person would: the browser does not say it is automated. */
const asAPerson = (page: Page) => page.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));

const editor = (page: Page) => page.getByRole("button", { name: /New empty session/ });
const tutorial = (page: Page) => page.getByTestId("tutorial-window");
const next = (page: Page) => page.getByTestId("tutorial-next");

const open = async (page: Page) => {
  await fakeThreadBackend(page);
  await page.goto("/compose/new");
  await expect(editor(page)).toBeVisible();
};

/** Long enough for the tutorial to have opened if it was going to. */
const SETTLED = 1500;

test("a first visit opens the tutorial, which steps through five examples and does not come back", async ({ page }) => {
  await asAPerson(page);
  await open(page);

  await expect(tutorial(page)).toBeVisible();
  await expect(page.getByTestId("tutorial-count")).toHaveText("Tutorial · Step 1 of 5");
  const scenes = ["layout", "post", "sessions", "steps", "publish"];
  for (const [index, scene] of scenes.entries()) {
    await expect(tutorial(page)).toHaveAttribute("data-step", String(index + 1));
    await expect(page.getByTestId("tutorial-example")).toHaveAttribute("data-scene", scene);
    // The example and the buttons stay inside the window, whatever the screen.
    const box = await next(page).boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= (page.viewportSize()?.width ?? 0)).toBe(true);
    if (index < scenes.length - 1) await next(page).click();
  }
  await expect(next(page)).toHaveText("Start building");
  await next(page).click();
  await expect(tutorial(page)).toBeHidden();

  // The editor is as it was, and the tutorial stays away on the next visit.
  await expect(editor(page)).toBeVisible();
  await page.reload();
  await expect(editor(page)).toBeVisible();
  await page.waitForTimeout(SETTLED);
  await expect(tutorial(page)).toBeHidden();
});

test("the tutorial can be skipped part of the way through", async ({ page }) => {
  await asAPerson(page);
  await open(page);
  await expect(tutorial(page)).toBeVisible();
  await next(page).click();
  await next(page).click();
  await expect(tutorial(page)).toHaveAttribute("data-step", "3");
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
  for (let step = 1; step < 4; step++) await next(page).click();
  await expect(tutorial(page)).toHaveAttribute("data-step", "4");
  await page.keyboard.press("Escape");
  await expect(tutorial(page)).toBeHidden();
});

test("the example can be paused and played", async ({ page }) => {
  await asAPerson(page);
  await open(page);
  const example = page.getByRole("button", { name: "Pause the example" });
  await expect(example).toBeVisible();
  await example.click();
  await expect(page.getByRole("button", { name: "Play the example" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.getAnimations().filter((run) => run.effect?.getTiming().iterations === Infinity).every((run) => run.playState === "paused"))).toBe(true);
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
