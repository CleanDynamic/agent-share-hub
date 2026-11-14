// The sign-in dialog's layout (G1 to G4, G9, G14) on its dev kit page, both themes, at 1440 by 900.
import { expect, test, type Page } from "@playwright/test";

const THEMES = ["dusk", "noon"] as const;

async function open(page: Page, theme: string, extra = "") {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/dev/kit/pages/signin?theme=${theme}&viewport=desktop${extra}`);
  await page.getByTestId("signin-dialog").waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Measure the dialog where it rests, not mid-entrance (G11 slides it up 12px and scales it from 0.98).
  await page.waitForFunction(() => document.querySelector('[data-testid="signin-dialog"]')?.getAnimations().length === 0);
}

const rect = (page: Page, testId: string) =>
  page.getByTestId(testId).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom };
  });

for (const theme of THEMES) {
  test.describe(`sign-in dialog, ${theme}`, () => {
    test("G1: 840 by 540, centred, radius 16, columns 360 and 480", async ({ page }) => {
      await open(page, theme);
      const dialog = await rect(page, "signin-dialog");
      expect(dialog).toMatchObject({ x: 300, y: 180, w: 840, h: 540 });
      const radius = await page.getByTestId("signin-dialog").evaluate((el) => getComputedStyle(el).borderRadius);
      expect(radius).toBe("16px");
      expect((await rect(page, "signin-picture-column")).w).toBe(360);
      expect((await rect(page, "signin-form-column")).w).toBe(480);
    });

    test("G2: the picture, the lockup, the tagline and the address", async ({ page }) => {
      await open(page, theme);
      const img = page.getByTestId("signin-picture-column").locator("img");
      const info = await img.evaluate((el: HTMLImageElement) => {
        const r = el.getBoundingClientRect();
        return { src: new URL(el.src).pathname, w: r.width, h: r.height, x: r.x, y: r.y, fit: getComputedStyle(el).objectFit, loaded: el.naturalWidth > 0, alt: el.alt };
      });
      expect(info).toMatchObject({ src: theme === "dusk" ? "/brand/beaver-dark.png" : "/brand/beaver-light.png", w: 360, h: 300, x: 300, y: 180, fit: "cover", alt: "" });
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0)).toBe(true);
      const column = page.getByTestId("signin-picture-column");
      await expect(column.locator('[data-ui="lockup"]')).toContainText("OpenBuilds.ai");
      const tagline = page.getByTestId("signin-tagline");
      await expect(tagline).toHaveText("Publish, reproduce and fork AI-assisted workflows.");
      expect(await tagline.evaluate((el) => [getComputedStyle(el).fontSize, getComputedStyle(el).fontWeight, getComputedStyle(el).lineHeight])).toEqual(["22px", "500", "28px"]);
      const address = column.getByText("openbuilds.ai", { exact: true });
      expect(await address.evaluate((el) => [getComputedStyle(el).fontFamily.startsWith('"Geist Mono"'), getComputedStyle(el).fontSize])).toEqual([true, "11px"]);
    });

    test("G3: controls 432 by 32, gaps 4, 8, 16 or 24, primary 24 above the bottom", async ({ page }) => {
      await open(page, theme);
      const column = page.getByTestId("signin-view-body");
      const controls = await column.locator('button[data-ui="button"], [data-testid="auth-field-box"]').evaluateAll((els) =>
        els.map((el) => { const r = el.getBoundingClientRect(); return { w: r.width, h: r.height }; }),
      );
      expect(controls.length).toBeGreaterThanOrEqual(6);
      for (const c of controls) expect(c).toEqual({ w: 432, h: 32 });
      // The column's rows, top to bottom: each child of the body and of the form that has a height.
      const rows = await column.evaluate((body) => {
        const out: { top: number; bottom: number; spacer: boolean }[] = [];
        const walk = (el: Element) => {
          for (const child of Array.from(el.children)) {
            if (child.tagName === "FORM") { walk(child); continue; }
            const r = child.getBoundingClientRect();
            if (r.height === 0) continue;
            if (child.getAttribute("aria-hidden") === "true" && !child.children.length) continue; // fixed gaps
            out.push({ top: r.top, bottom: r.bottom, spacer: false });
          }
        };
        walk(body);
        return out;
      });
      const rowOne = await rect(page, "signin-row-one");
      const tops = [{ top: rowOne.y, bottom: rowOne.bottom, spacer: false }, ...rows];
      const gaps = tops.slice(1).map((row, i) => Math.round(row.top - tops[i].bottom));
      const flexible = gaps.pop();
      for (const gap of gaps) expect([4, 8, 16, 24]).toContain(gap);
      expect(flexible).toBeGreaterThanOrEqual(24);
      const dialog = await rect(page, "signin-dialog");
      const primary = await rect(page, "signin-view-body").then(() => page.locator('[data-variant="signin-primary"]').evaluate((el) => el.getBoundingClientRect().bottom));
      expect(Math.round(dialog.bottom - primary)).toBe(24);
    });

    test("G4: the green primary, hover is a colour change, the light link", async ({ page }) => {
      await open(page, theme);
      const primary = page.locator('[data-variant="signin-primary"]');
      const paint = () => primary.evaluate((el) => { const s = getComputedStyle(el); return [s.backgroundColor, s.color, s.opacity]; });
      const want = theme === "dusk" ? ["rgb(107, 226, 160)", "rgb(88, 186, 113)"] : ["rgb(119, 252, 73)", "rgb(94, 232, 50)"];
      expect(await paint()).toEqual([want[0], "rgb(0, 0, 0)", "1"]);
      await primary.hover();
      await expect.poll(paint).toEqual([want[1], "rgb(0, 0, 0)", "1"]);
      if (theme === "noon") {
        const link = page.getByRole("link", { name: "Forgot password?" });
        expect(await link.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(23, 48, 20)");
      }
    });

    test("G9: the error line moves nothing", async ({ page }) => {
      const tops = async () =>
        page.getByTestId("signin-view-body").evaluate((body) =>
          Array.from(body.querySelectorAll('[data-testid="auth-field-box"], [data-variant="signin-primary"]')).map((el) => el.getBoundingClientRect().top),
        );
      await open(page, theme);
      const without = await tops();
      await open(page, theme, "&error=1");
      await expect(page.getByText("Wrong email or password")).toBeVisible();
      expect(await tops()).toEqual(without);
    });

    test("G14: a labelled modal dialog that keeps focus, with a live error line", async ({ page }) => {
      await open(page, theme);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      const labelledBy = await dialog.getAttribute("aria-labelledby");
      expect(await page.locator(`[id="${labelledBy}"]`).textContent()).toBe("Publish, reproduce and fork AI-assisted workflows.");
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
      }
      await expect(dialog.locator('[data-testid="field-message"][aria-live="polite"]')).toHaveCount(2);
    });
  });
}
