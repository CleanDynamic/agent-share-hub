// Tier 3 — RC-P06, the frame without the right rail.
//
// WHAT THIS GUARDS. The owner removed the right rail everywhere (CONTRACT
// §3.1). The frame is now the left nav and the 634px reading column, centred
// together as one pair — which is exactly how /notifications rendered before,
// because it was the one standard route that already had no rail. So the
// claim is measurable: on / the nav and the column sit where they sit on
// /notifications, to the pixel ⟦layout-grid › Responsive Behavior: Fixed⟧.
// At 1024 the nav is fully on screen and nothing scrolls sideways
// ⟦responsive-design⟧; on a phone there is no nav rail, and the magnifier that
// used to open the Explore drawer opens the Gallery's search. RC-P09c adds the
// one search field's placeholder, measured against the text floor in both
// rooms ⟦buildgallery-theme › The colour contract⟧.
//
// BOTH PROJECTS. The mobile project runs this file as well as tier 1
// (playwright.config.ts); each test says which project it belongs to.
//
// THE BACKEND IS FAKED, signed in, by the audit harness
// (e2e/audit/support/harness.ts): /notifications is a protected route, and the
// harness's seeded rows are the populated state the frame has to hold around.
// Nothing reaches the network.
//
// SELECTORS: the frame's two data-testids, the role and name of the search
// button and of the search field, and the address bar.

import { expect, test, type Page } from "@playwright/test";
import { installStub, withSession, withTheme } from "../audit/support/harness";

/** A cold dev server compiles each page on first visit. */
const READY_MS = 45_000;

async function openSignedIn(page: Page, path: string) {
  await withTheme(page, "noon");
  await withSession(page);
  await installStub(page);
  await page.goto(path);
  await page.getByTestId("frame-centre").waitFor({ timeout: READY_MS });
}

/** The x and width of a frame column, as the browser lays it out. */
const box = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), width: Math.round(r.width) };
  });

test.describe("desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Measured at desktop widths.");
  });

  test("puts the nav and a 634 column where /notifications puts them", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await openSignedIn(page, "/notifications");
    const reference = { left: await box(page, "frame-left"), centre: await box(page, "frame-centre") };

    await openSignedIn(page, "/");
    const home = { left: await box(page, "frame-left"), centre: await box(page, "frame-centre") };

    expect(home).toEqual(reference);
    expect(home.centre.width).toBe(634);
  });

  /* RC-P09c. The field's placeholder is its only visible label. It showed in
     the browser's grey, 1.75:1 on Noon's --recess, until this pass. */
  for (const theme of ["noon", "dusk"] as const) {
    test(`the search field's placeholder reads at the text floor in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await withTheme(page, theme);
      await withSession(page);
      await installStub(page);
      await page.goto("/");
      const field = page.getByRole("searchbox", { name: "Search builds" });
      await field.waitFor({ timeout: READY_MS });

      const ratio = await field.evaluate((el) => {
        const channels = (colour: string) => (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = (colour: string) => {
          const [r, g, b] = channels(colour).map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ink = luminance(getComputedStyle(el, "::placeholder").color);
        const ground = luminance(getComputedStyle(el).backgroundColor);
        return (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("keeps the nav on screen at 1024 without scrolling sideways", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await openSignedIn(page, "/");

    expect((await box(page, "frame-left")).x).toBeGreaterThanOrEqual(0);
    const scrollsSideways = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(scrollsSideways).toBe(false);
  });
});

test.describe("phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Measured on the phone project.");
  });

  test("shows no nav rail on /", async ({ page }) => {
    await openSignedIn(page, "/");
    await expect(page.getByTestId("frame-left")).not.toBeVisible();
  });

  /* RC-P10 rewrote this (CONTRACT §3.4): the button still goes to
     /gallery?focus=search, and the Gallery now acts on it, focusing its own
     field and dropping the parameter, so the reader lands on /gallery with the
     cursor in the search box. */
  test("the Search builds button opens the gallery with its search field focused", async ({ page }) => {
    await openSignedIn(page, "/");
    await page.getByRole("button", { name: "Search builds", exact: true }).click();
    await expect(page.getByRole("searchbox", { name: "Search the gallery" })).toBeFocused();
    await expect(page).toHaveURL(/\/gallery$/);
  });
});
