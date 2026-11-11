// Tier 1: the Builds filters series (BF-00 on). One file for the series' end to end tests; each BF prompt adds its own.
//
// It opens the page the way builds-site-frame.spec.ts does (same imports, same projects), so it needs no auth. That spec
// settles for the loading state because nothing answers the page's reads; this one answers every read with no rows, so
// the page leaves loading and draws its table. Nothing here asserts anything about the filter rail yet.

import { expect, test, type Page } from "@playwright/test";

/** Every REST and RPC read returns no rows, with a zero total, so the page settles with an empty table. */
async function answerWithNoRows(page: Page) {
  await page.route(/\/rest\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "*/0" }, body: "[]" }),
  );
}

async function open(page: Page, path = "/builds") {
  await answerWithNoRows(page);
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("bg-theme", "noon");
    } catch {
      /* private window: the default theme is a fine fallback */
    }
  });
  await page.goto(path);
  await expect(page.getByTestId("site-frame")).toBeVisible();
}

test.describe("/builds filters", () => {
  test("builds: the page opens with its table", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("builds-page")).toBeVisible();
    await expect(page.getByTestId("builds-table")).toBeVisible();
    const views = page.getByRole("navigation", { name: "View" });
    await expect(views.getByRole("link")).toHaveCount(3);
    for (const name of ["Table", "Maps", "Classification"]) await expect(views.getByRole("link", { name })).toBeVisible();
  });

  // BF-03 P1 (D1): one head on every view, so the switch stays under the pointer.
  test("the view switch does not move between Table, Maps and Classification", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await open(page);
    await expect(page.getByTestId("builds-table")).toBeVisible();
    const views = page.getByRole("navigation", { name: "View" });
    const table = await views.boundingBox();
    await views.getByRole("link", { name: "Maps" }).click();
    await expect(page.getByTestId("builds-maps")).toBeVisible();
    const maps = await views.boundingBox();
    await views.getByRole("link", { name: "Classification" }).click();
    await expect(page.getByTestId("builds-classification")).toBeVisible();
    const classification = await views.boundingBox();
    for (const box of [maps, classification]) {
      expect(Math.abs(box!.y - table!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.x - table!.x)).toBeLessThanOrEqual(1);
    }
  });
});
