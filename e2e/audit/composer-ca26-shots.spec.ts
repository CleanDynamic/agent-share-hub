/* CA-26 P6: the screens of the accessibility pass, written to design/audits/composer/ca-26/, and the proof that nothing at rest moved.

   - skip-link-focused: Tab once on the build page; "Skip to build" shows at the top left of the composer box, with the ring.
   - focus-on-tile: Enter on it; focus lands on the build list's current item, ringed, and an arrow moves it on.
   - focus-back-on-options: a window opened from a ⋯ menu is closed with Escape, and focus is back on the ⋯ button.
   - at rest: the page, with nothing focused, against the shots taken before Part 1 (design/audits/composer/ca-26/before/),
     byte for byte, in both rooms at 1440 and 390, with a tile selected and without. The shots are taken by this same spec
     (`AT_REST_RECORD=1 E2E_BASE_URL=<a checkout from before Part 1>`), so the browser is the same on both sides.
   - axe: with `AXE_SRC=/path/to/axe.min.js` set, axe-core runs on the page in both rooms and the list of what is left is written
     beside the screens (the repository does not depend on axe; the audit is run with a copy on the side).

     npm run audit -- composer-ca26-shots */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/ca-26";
const THEMES = ["dusk", "noon"] as const;
const url = (theme: string, view: string, mobile: boolean, build = "ca22") => `/dev/kit/pages/sandbox?theme=${theme}&build=${build}&bar=0&${view}${mobile ? "&viewport=mobile" : ""}`;

async function open(page: Page, theme: string, view: string, mobile = false, build = "ca22") {
  mkdirSync(OUT, { recursive: true });
  await page.goto(url(theme, view, mobile, build));
  await page.locator('section[aria-label="Build"]').waitFor();
  await page.waitForTimeout(1500);
}

for (const theme of THEMES) {
  test.describe(`${theme} · 1440`, () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("the skip link, focused", async ({ page }) => {
      await open(page, theme, "select=c22-p2");
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Skip to build" });
      await expect(skip).toBeFocused();
      const box = await skip.boundingBox();
      expect(box?.height).toBe(32);
      await page.screenshot({ path: `${OUT}/skip-link-focused-${theme}-1440.png`, clip: { x: 0, y: 0, width: 720, height: 220 } });
    });

    test("focus on a tile", async ({ page }) => {
      await open(page, theme, "select=c22-p2");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");
      const focused = page.locator('[data-testid="build-list"] :focus');
      await expect(focused).toHaveCount(1);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      const tile = page.locator('[data-testid="step-card"]:focus');
      if (await tile.count()) await tile.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/focus-on-tile-${theme}-1440.png` });
    });

    test("focus back on the ⋯ button after its window closes", async ({ page }) => {
      await open(page, theme, "show=published", false, "ca25");
      const options = page.getByRole("button", { name: "Published build options" });
      await options.click();
      await page.getByTestId("published-copy-link").waitFor();
      await page.getByRole("menuitem", { name: /Unpublish/ }).click();
      await page.getByRole("alertdialog").or(page.getByRole("dialog")).first().waitFor();
      await page.keyboard.press("Escape");
      await expect(options).toBeFocused();
      await page.screenshot({ path: `${OUT}/focus-back-on-options-${theme}-1440.png`, clip: { x: 720, y: 0, width: 720, height: 220 } });
    });
  });
}

/** The page with nothing focused and nothing selected by the pointer, as it is at rest. */
for (const theme of THEMES) {
  for (const [size, viewport, mobile] of [
    ["desktop", { width: 1440, height: 900 }, false],
    ["phone", { width: 390, height: 844 }, true],
  ] as const) {
    for (const [view, name] of [["select=c22-p2", "selected"], ["select=", "none"]] as const) {
      test(`at rest, unchanged: ${theme} ${size} ${name}`, async ({ browser }) => {
        const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
        const page = await context.newPage();
        await open(page, theme, view, mobile);
        const before = `${OUT}/before/${theme}-${size}-${name}.png`;
        const now = await page.screenshot();
        if (process.env.AT_REST_RECORD) {
          // Run once against the page as it was (E2E_BASE_URL at a checkout from before Part 1) to take the shots to hold it to.
          mkdirSync(`${OUT}/before`, { recursive: true });
          writeFileSync(before, now);
          await context.close();
          return;
        }
        test.skip(!existsSync(before), "no shot from before Part 1");
        if (!now.equals(readFileSync(before))) writeFileSync(`${OUT}/at-rest-now-${theme}-${size}-${name}.png`, now);
        expect(now.equals(readFileSync(before)), "the page at rest is the page from before Part 1, byte for byte").toBe(true);
        await context.close();
      });
    }
  }
}

test("axe: what is left", async ({ browser }) => {
  test.skip(!process.env.AXE_SRC, "set AXE_SRC to a copy of axe.min.js");
  const source = readFileSync(process.env.AXE_SRC as string, "utf8");
  const left: Record<string, unknown> = {};
  for (const theme of THEMES) {
    for (const [size, viewport, mobile] of [
      ["desktop", { width: 1440, height: 900 }, false],
      ["phone", { width: 390, height: 844 }, true],
    ] as const) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await open(page, theme, "select=c22-p2", mobile);
      await page.evaluate(source);
      left[`${theme}-${size}`] = await page.evaluate(async () => {
        const result = await (window as unknown as { axe: { run: (root: Document) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document);
        return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(" ")) }));
      });
      await context.close();
    }
  }
  writeFileSync(`${OUT}/axe-left.json`, JSON.stringify(left, null, 2));
  expect(Object.values(left).flat()).toEqual([]);
});
