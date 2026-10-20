// Tier 3 — CA-06 P3: a link in the post brings its part to the middle of the window, outlines it and opens its
// window; Back to the post returns to the words. In the composer (List and Map) and on the build page.
//
// WHY /dev/kit. The composer needs a signed-in maker and a record they own; the dev pages draw the same components
// from "A post with links" (src/dev/fixtures/postLinks.ts) with no auth, and nothing is written.

import { expect, test, type Page } from "@playwright/test";

const COMPOSER = "/dev/kit/pages/sandbox?build=links&fit=content";
const READER = "/dev/kit/pages/build-steps?build=links";
const S2 = "session:typed-0b1c2d3e-0000-4000-8000-000000000002";

test.use({ viewport: { width: 1280, height: 800 } });

/**
 * How far the centre of what a link outlined is from the centre of the window, in px; 0 when the part is as near the
 * middle as the page lets it come (scrolled to its very end, for a part at the bottom).
 */
async function offCentre(page: Page): Promise<number> {
  const outlined = page.locator("[data-outlined]").first();
  await expect(outlined).toBeVisible();
  return outlined.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const off = Math.abs(box.top + box.height / 2 - window.innerHeight / 2);
    const below = box.top + box.height / 2 > window.innerHeight / 2;
    const atEnd = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1;
    return below && atEnd ? 0 : off;
  });
}

const link = (page: Page, where: "sandbox-post" | "build-posts", to: string) => page.locator(`[data-testid="${where}"] [data-ref="${to}"]`).first();

for (const lens of ["list", "map"] as const) {
  test.describe(`in the composer's ${lens === "list" ? "List" : "Map"}`, () => {
    for (const to of ["node:o-p2", "node:o-build", "node:o-k1", S2]) {
      test(`centres ${to} within 40px, outlines it and opens its window`, async ({ page }) => {
        await page.goto(`${COMPOSER}&lens=${lens}`);
        await link(page, "sandbox-post", to).click();
        // A smooth scroll takes a moment: wait until it is there.
        await expect.poll(() => offCentre(page)).toBeLessThanOrEqual(40);
        await expect(page.locator('[data-testid="part-window"], [data-testid="full-prompt-window"]')).toBeVisible();
        // The page itself never scrolls sideways.
        expect(await page.evaluate(() => window.scrollX)).toBe(0);
      });
    }
  });
}

test.describe("the windows a link opens", () => {
  test("a prompt opens the full prompt window, with Back to the post", async ({ page }) => {
    await page.goto(COMPOSER);
    await link(page, "sandbox-post", "node:o-p2").click();
    const win = page.getByTestId("full-prompt-window");
    await expect(win).toBeVisible();
    await expect(win.getByTestId("from-post")).toHaveText("Opened from the post · Back to the post");
  });

  test("code opens in a mono well with Copy code", async ({ page }) => {
    await page.goto(COMPOSER);
    await link(page, "sandbox-post", "node:o-c1").click();
    const win = page.getByTestId("part-window");
    await expect(win.getByRole("region", { name: "Code" })).toContainText("export function OrderForm()");
    await expect(win.getByRole("button", { name: "Copy code" })).toBeVisible();
  });

  test("a team's agent opens with its instructions and models", async ({ page }) => {
    await page.goto(COMPOSER);
    await link(page, "sandbox-post", "node:o-build").click();
    const win = page.getByTestId("part-window");
    await expect(win.getByRole("heading", { name: "Instructions" })).toBeVisible();
    await expect(win.getByRole("heading", { name: "Models" })).toBeVisible();
  });

  test("a check opens with its three answers and its runs", async ({ page }) => {
    await page.goto(COMPOSER);
    await link(page, "sandbox-post", "node:o-k1").click();
    const win = page.getByTestId("part-window");
    for (const label of ["What it tested", "What counts as passing", "When it failed", "Runs"]) await expect(win.getByRole("heading", { name: label })).toBeVisible();
  });

  test("a session opens the session window, whose rows go to its tiles", async ({ page }) => {
    await page.goto(COMPOSER);
    await link(page, "sandbox-post", S2).click();
    const win = page.getByTestId("part-window");
    await expect(win.getByRole("heading", { name: "Its tiles" })).toBeVisible();
    await win.getByTestId("part-row").first().click();
    await expect(page.getByTestId("part-window")).toHaveAttribute("data-part", "node:o-team");
  });
});

test.describe("Back to the post", () => {
  test("closes the window and gives the words focus, outlined", async ({ page }) => {
    await page.goto(COMPOSER);
    await link(page, "sandbox-post", "node:o-k1").click();
    await page.getByRole("button", { name: "Back to the post" }).click();
    await expect(page.getByTestId("part-window")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-ref"))).toBe("node:o-k1");
    await expect(link(page, "sandbox-post", "node:o-k1")).toHaveAttribute("data-outlined", "true");
  });

  test("closing another way leaves focus on the part, outlined again", async ({ page }) => {
    await page.goto(COMPOSER);
    await link(page, "sandbox-post", "node:o-k1").click();
    await page.getByTestId("part-window").getByRole("button", { name: "Done" }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Check 5: Totals add up");
  });

  test("every part the post links to says so in the List, with its own way back", async ({ page }) => {
    await page.goto(COMPOSER);
    await expect(page.getByTestId("mentioned-line")).toHaveCount(6);
    await page.getByTestId("mentioned-line").last().getByRole("button", { name: "Back to the post" }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-ref"))).toBe("node:o-k1");
  });
});

test.describe("on the build page, for a reader", () => {
  test("centres the part, opens its window, and Back to the post returns to the words", async ({ page }) => {
    await page.goto(READER);
    await link(page, "build-posts", "node:o-k1").click();
    await expect(page).toHaveURL(/#node-o-k1$/);
    await expect(page.getByTestId("part-window")).toBeVisible();
    await page.getByRole("button", { name: "Back to the post" }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-ref"))).toBe("node:o-k1");
  });

  test("a session's address is #session-{key}", async ({ page }) => {
    await page.goto(READER);
    await link(page, "build-posts", S2).click();
    await expect(page).toHaveURL(/#session-typed-0b1c2d3e-0000-4000-8000-000000000002$/);
  });

  test("the hover card has Go to it, and no Change or Remove", async ({ page }) => {
    await page.goto(READER);
    await link(page, "build-posts", "node:o-p2").hover();
    const card = page.getByTestId("ref-card");
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Go to it" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Change" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Remove the link" })).toHaveCount(0);
  });

  test("a link to a part that is gone is plain words, not focusable", async ({ page }) => {
    await page.goto(READER);
    const gone = link(page, "build-posts", "node:o-gone");
    await expect(gone).toHaveAttribute("title", "This part is no longer in the build");
    await expect(gone).not.toHaveAttribute("tabindex", /.*/);
  });
});

test("the maker's hover card has Change and Remove the link", async ({ page }) => {
  await page.goto(COMPOSER);
  await link(page, "sandbox-post", "node:o-p2").hover();
  const card = page.getByTestId("ref-card");
  await expect(card.getByRole("button", { name: "Change" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Remove the link" })).toBeVisible();
});

test("with reduced motion the part is centred at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(COMPOSER);
  await link(page, "sandbox-post", "node:o-k1").click();
  const outlined = page.locator("[data-outlined]").first();
  await expect(outlined).toBeVisible();
  const off = await outlined.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return Math.abs(box.top + box.height / 2 - window.innerHeight / 2);
  });
  expect(off).toBeLessThanOrEqual(40);
});
