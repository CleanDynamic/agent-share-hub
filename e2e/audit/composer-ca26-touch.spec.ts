/* CA-26 P5: touch targets on the build page. On a coarse pointer every grip, ⋯ button, fold arrow, Undo, Redo, selection-bar
   button and window close button answers a touch 44 by 44, drawn at whatever size the design gives it (a transparent ::after,
   centred, from the UI-P38 rule). Measured on a phone and on a tablet (coarse, but wider than the phone chrome switches at).

     npm run audit -- composer-ca26-touch */

import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/ca-26";
const URL = (theme: string, mobile: boolean) => `/dev/kit/pages/sandbox?theme=${theme}&build=ca22&bar=hide&history=1&select=c22-p2${mobile ? "&viewport=mobile" : ""}`;

const TARGETS = {
  grip: '[data-testid="drag-handle"], [data-testid="session-drag-handle"], [data-testid="workstream-drag-handle"]',
  options: 'button[aria-label$=" options"]',
  fold: 'button[aria-label^="Collapse "], button[aria-label^="Expand "]',
  history: '[data-testid="title-undo"], [data-testid="title-redo"]',
  selection: '[data-testid="selection-bar"] button',
};

interface Hit {
  what: string;
  name: string;
  w: number;
  h: number;
  x: number;
  y: number;
}

/** The size of what answers a touch: the control or its centred ::after, whichever is larger, each way. */
async function measure(page: Page, selector: string, what: string): Promise<Hit[]> {
  return page.evaluate(
    ({ selector, what }) =>
      [...document.querySelectorAll<HTMLElement>(selector)]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== "hidden";
        })
        .map((el) => {
          const box = el.getBoundingClientRect();
          const after = getComputedStyle(el, "::after");
          const drawn = after.content !== "none" && after.content !== "normal" && after.position === "absolute";
          const w = Math.max(box.width, drawn ? parseFloat(after.width) : 0);
          const h = Math.max(box.height, drawn ? parseFloat(after.height) : 0);
          return { what, name: el.getAttribute("aria-label") ?? el.textContent?.trim() ?? "", w, h, x: box.left + box.width / 2 - w / 2, y: box.top + box.height / 2 - h / 2 };
        }),
    { selector, what },
  );
}

async function open(page: Page, theme: string, mobile: boolean) {
  await page.goto(URL(theme, mobile));
  await page.locator('section[aria-label="Build"]').waitFor();
  await page.waitForTimeout(500);
}

async function pickTwo(page: Page) {
  await page.evaluate(() => (document.querySelector('[data-testid="act-pick-two"]') as HTMLElement).click());
  await page.getByTestId("selection-bar").waitFor();
  await page.waitForTimeout(400);
}

/** A test-only overlay: every measured hit area outlined, over the page. */
async function outline(page: Page, hits: readonly Hit[]) {
  await page.evaluate((hits) => {
    for (const hit of hits) {
      const box = document.createElement("div");
      box.setAttribute("data-test-overlay", "");
      box.style.cssText = `position:fixed;left:${hit.x}px;top:${hit.y}px;width:${hit.w}px;height:${hit.h}px;border:1px dashed magenta;pointer-events:none;z-index:2147483647;box-sizing:border-box`;
      document.body.append(box);
    }
  }, hits);
}

for (const [name, viewport, mobile] of [
  ["phone", { width: 390, height: 844 }, true],
  ["tablet", { width: 1024, height: 768 }, false],
] as const) {
  test.describe(`touch targets · ${name}`, () => {
    test.use({ viewport, hasTouch: true, isMobile: name === "phone" });

    for (const theme of ["dusk", "noon"]) {
      test(`${theme}: every grip, ⋯ button, fold arrow, Undo, Redo and selection-bar button is 44 by 44 or more`, async ({ page }) => {
        await open(page, theme, mobile);
        expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
        await pickTwo(page);
        const hits: Hit[] = [];
        for (const [what, selector] of Object.entries(TARGETS)) hits.push(...(await measure(page, selector, what)));
        const seen = new Set(hits.map((hit) => hit.what));
        for (const what of Object.keys(TARGETS)) expect(seen.has(what), `${what} found on the page`).toBe(true);
        const short = hits.filter((hit) => hit.w < 44 - 0.5 || hit.h < 44 - 0.5);
        expect(short.map((hit) => `${hit.what} "${hit.name}" ${hit.w}x${hit.h}`)).toEqual([]);

        mkdirSync(OUT, { recursive: true });
        if (name === "phone") {
          await outline(page, hits);
          await page.screenshot({ path: `${OUT}/hit-areas-${theme}-phone.png` });
        }
      });

      test(`${theme}: the window close buttons are 44 by 44 or more`, async ({ page }) => {
        await open(page, theme, mobile);
        await page.getByRole("button", { name: "Classification Card" }).first().click();
        await page.getByRole("dialog").waitFor();
        const close = await measure(page, '[role="dialog"] button[aria-label^="Close"]', "close");
        expect(close.length).toBeGreaterThan(0);
        expect(close.filter((hit) => hit.w < 43.5 || hit.h < 43.5).map((hit) => `${hit.name} ${hit.w}x${hit.h}`)).toEqual([]);
      });
    }
  });
}

test("the rule is on pointer: coarse, not only on width: a fine pointer at phone width is still answered, a tablet is too", async () => {
  const css = (await import("node:fs")).readFileSync("src/index.css", "utf8");
  expect(css).toMatch(/@media \(max-width: 767px\), \(pointer: coarse\) \{\s*:where\(/);
});
