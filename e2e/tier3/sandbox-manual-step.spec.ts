// Tier 3 — a manual step in the composer sandbox (UI-P70, board D2 option B).
//
// WHY THIS IS A BROWSER SPEC. "On --cell with a 1px --text2 border" is resolved
// colour: jsdom cannot resolve a `var()`, so the unit tests under
// src/pages/site/compose cover what is decided (the lane, the numbering, the
// limits, the menu) and this covers what a browser paints, in both themes.
//
// WHY /dev/kit. The real composer needs a signed-in creator and a record they
// own; the dev page draws the same components from the sample build
// (`?build=manual`: prompt 1, prompt 2, a Figma step with a screenshot, and
// prompt 4 using its output), with no auth.

import { expect, test, type Page } from "@playwright/test";

const LIST = "/dev/kit/pages/sandbox?build=manual";
const MAP = `${LIST}&lens=map`;

/** What a token resolves to, read by painting a probe with it. */
async function resolved(page: Page, token: "--cell" | "--text2", property: "backgroundColor" | "borderTopColor") {
  return page.evaluate(
    ([name, prop]) => {
      const probe = document.createElement("div");
      if (prop === "backgroundColor") probe.style.background = `var(${name})`;
      else probe.style.border = `1px solid var(${name})`;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe)[prop as "backgroundColor"];
      probe.remove();
      return value;
    },
    [token, property] as const,
  );
}

for (const theme of ["noon", "dusk"] as const) {
  test.describe(`a manual step, ${theme}`, () => {
    test("is a card on --cell with a 1px --text2 border in the List, and different from a prompt's", async ({ page }) => {
      await page.goto(`${LIST}&theme=${theme}`);
      const card = page.getByRole("group", { name: /^Manual step 3:/ });
      await expect(card).toBeVisible();
      const paint = await card.evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, border: style.borderTopColor, width: style.borderTopWidth };
      });
      expect(paint.background).toBe(await resolved(page, "--cell", "backgroundColor"));
      expect(paint.border).toBe(await resolved(page, "--text2", "borderTopColor"));
      expect(paint.width).toBe("1px");
      const prompt = await page.getByRole("group", { name: /^Prompt 2:/ }).evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(prompt).not.toBe(paint.background);
      await expect(page.getByTestId("manual-eyebrow")).toHaveText("Manual step · Figma · added by maker");
      await expect(card.getByText("1 screenshot")).toBeVisible();
      await expect(card.getByTestId("manual-thumb")).toHaveCSS("width", "32px");
    });

    test("draws in the Map in a 'By hand' lane, like the other boxes", async ({ page }) => {
      await page.goto(`${MAP}&theme=${theme}`);
      const box = page.getByTestId("map-box-m3");
      await expect(box).toBeVisible();
      const paint = await box.evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, border: style.borderTopColor };
      });
      expect(paint.background).toBe(await resolved(page, "--cell", "backgroundColor"));
      expect(paint.border).toBe(await resolved(page, "--text2", "borderTopColor"));
      await expect(page.getByTestId("map-lane").filter({ hasText: "By hand" })).toHaveCount(1);
      await expect(page.getByTestId("manual-header")).toHaveText("By hand · Figma");
      // The same size as a prompt's box in the same map: a box like any other.
      const own = (await box.boundingBox())!;
      const other = (await page.getByTestId("map-box-p2").boundingBox())!;
      expect(Math.round(own.width)).toBe(Math.round(other.width));
    });
  });
}

test("a later step uses the manual step's output, shown as a named input and a wire", async ({ page }) => {
  await page.goto(MAP);
  await expect(page.getByTestId("map-box-p4")).toContainText("Output of 3");
  await expect(page.getByTestId("map-wire")).toHaveCount(3);
  // The manual step sits left of the prompt that uses it.
  const manual = (await page.getByTestId("map-box-m3").boundingBox())!;
  const prompt = (await page.getByTestId("map-box-p4").boundingBox())!;
  expect(manual.x + manual.width).toBeLessThan(prompt.x);
});
