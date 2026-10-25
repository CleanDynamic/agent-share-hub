/* CA-27: the build page with 300 tiles in 20 sessions over 3 parts ("ca27"), in a real browser.

     PW_CHROMIUM_PATH=<chrome> npm run audit -- composer-ca27

   P2 truncation: with the long strings at 390, 768 and 1440 nothing runs past the page, a title is one line with its full text in
   the tooltip, a preview is two lines, and the ⋯ button stands in the same place on every tile.
   P3 large builds: the measures (first render, scrolling, pick-up, find) are in scripts/ca27-measure.mjs; here, that drag, Find and
   Go to it still reach tiles that are not drawn, and nothing visible changes.
   P4 tablets: the columns at 768, 900, 1024 and 1152, the Details panel, a long press to drag, a swipe to scroll, the title row. */

import { expect, test, type Page } from "@playwright/test";

const url = (width: number, extra = "", tiles = 300) => `/dev/kit/pages/sandbox?build=ca27&tiles=${tiles}&bar=hide&fit=content&theme=dusk${width <= 390 ? "&viewport=mobile" : "&window=1"}${extra}`;

async function open(page: Page, width: number, extra = "", tiles = 300) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url(width, extra, tiles));
  await page.locator('[data-testid="build-list"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

for (const width of [390, 768, 1440]) {
  test.describe(`P2 truncation · ${width}`, () => {
    test("no horizontal overflow anywhere", async ({ page }) => {
      await open(page, width);
      const over = await page.evaluate(() => {
        const doc = document.documentElement;
        const edge = doc.clientWidth;
        const out = [...document.querySelectorAll<HTMLElement>("body *")]
          .filter((el) => !el.closest("[data-radix-popper-content-wrapper], [data-test-overlay]"))
          .filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 0 && box.height > 0 && (box.right > edge + 1 || box.left < -1);
          })
          .slice(0, 8)
          .map((el) => `${el.tagName}[${el.getAttribute("data-testid") ?? ""}] ${Math.round(el.getBoundingClientRect().left)}..${Math.round(el.getBoundingClientRect().right)}`);
        return { scroll: doc.scrollWidth, client: doc.clientWidth, out };
      });
      expect(over.scroll).toBeLessThanOrEqual(over.client);
      expect(over.out).toEqual([]);
    });

    test("the ⋯ button stands in the same place on every tile", async ({ page }) => {
      await open(page, width);
      const xs = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="step-card"]')].map((card) => Math.round(card.querySelector<HTMLElement>('button[aria-label$=" options"]')?.getBoundingClientRect().right ?? -1) - Math.round(card.getBoundingClientRect().right)));
      expect(xs.length).toBeGreaterThan(100);
      expect(new Set(xs).size).toBe(1);
    });

    test("titles are one line with their full text in the tooltip; previews are two lines", async ({ page }) => {
      await open(page, width, width === 768 ? "" : "&select=c27-3");
      // Details: beside the build at 1440; a panel over it at 768 (opened by a click on the tile); a sheet on a phone.
      if (width === 768) await page.locator('[data-node-id="c27-3"]').click();
      if (width === 390) await page.getByRole("button", { name: "Details" }).click();
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const norm = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, "");
        const oneLine = (el: HTMLElement) => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight || "0") + 2 || el.getBoundingClientRect().height <= 30;
        const bad: string[] = [];
        const check = (selector: string, within: ParentNode = document) => {
          const found = [...within.querySelectorAll<HTMLElement>(selector)];
          for (const el of found) {
            if (norm(el.getAttribute("title")) !== norm(el.textContent)) bad.push(`${selector}: title ≠ text "${el.textContent?.slice(0, 40)}"`);
            if (!oneLine(el)) bad.push(`${selector}: ${Math.round(el.getBoundingClientRect().height)} high`);
            if (getComputedStyle(el).textOverflow !== "ellipsis") bad.push(`${selector}: no ellipsis`);
          }
          return found.length;
        };
        // The maker's own heads are fields: the value is cut with an ellipsis and the tooltip holds all of it.
        const fields = (selector: string) => {
          const found = [...document.querySelectorAll<HTMLInputElement>(selector)];
          for (const el of found) {
            if (el.value && el.title !== el.value) bad.push(`${selector}: title ≠ value`);
            if (getComputedStyle(el).textOverflow !== "ellipsis") bad.push(`${selector}: no ellipsis`);
            if (el.getBoundingClientRect().right > el.closest<HTMLElement>('[data-testid="session-head"], [data-testid="workstream-group"]')!.getBoundingClientRect().right + 7) bad.push(`${selector}: past its head`);
          }
          return found.length;
        };
        const counts = {
          sessions: fields('[data-testid="session-title"]'),
          parts: fields('[data-testid="workstream-name"]'),
          details: check('[data-testid="details-head"] h3'),
          heading: check('[data-testid="sandbox-heading"]'),
        };
        // A tile's title: the h3 of a card with a title of its own.
        const tileTitles = [...document.querySelectorAll<HTMLElement>('[data-testid="step-card"] h3')];
        for (const el of tileTitles) {
          if (!el.getAttribute("title")) bad.push("a tile title without a tooltip");
          if (!oneLine(el)) bad.push(`a tile title ${Math.round(el.getBoundingClientRect().height)} high`);
        }
        const previews = [...document.querySelectorAll<HTMLElement>('[data-testid="step-card"][data-kind="prompt"] > p')];
        for (const p of previews) {
          const line = parseFloat(getComputedStyle(p).lineHeight);
          if (getComputedStyle(p).webkitLineClamp !== "2") bad.push("a preview without the clamp");
          if (p.getBoundingClientRect().height > 2 * line + 1) bad.push(`a preview ${Math.round(p.getBoundingClientRect().height)} high`);
        }
        return { bad: [...new Set(bad)], counts, tiles: tileTitles.length, previews: previews.length };
      });
      expect(r.bad).toEqual([]);
      expect(r.counts.sessions).toBeGreaterThan(5);
      expect(r.counts.parts).toBeGreaterThan(0);
      expect(r.counts.details).toBe(1);
      expect(r.counts.heading).toBe(1);
      expect(r.tiles).toBeGreaterThan(100);
      expect(r.previews).toBeGreaterThan(100);
    });

    test("a session head keeps its number, app and date and its ⋯ button whole; the title gives way", async ({ page }) => {
      await open(page, width);
      const r = await page.evaluate(() => {
        const heads = [...document.querySelectorAll<HTMLElement>('[data-testid="session-head"]')];
        return heads.map((head) => {
          const box = head.getBoundingClientRect();
          const more = head.querySelector<HTMLElement>('button[aria-label$=" options"]')?.getBoundingClientRect();
          const name = [...head.querySelectorAll<HTMLElement>("span")].find((el) => /^Session \d+ ·$/.test(el.textContent ?? ""))?.getBoundingClientRect();
          return { w: Math.round(box.width), h: Math.round(box.height), moreInside: more ? more.right <= box.right + 1 && more.width >= 26 : true, nameW: name ? Math.round(name.width) : 0 };
        });
      });
      expect(r.length).toBe(20);
      expect(r.every((head) => head.moreInside)).toBe(true);
      expect(r.every((head) => head.nameW >= 50)).toBe(true);
      // A computer's head stays one row; a phone's wraps its title under the mark, but never past two rows.
      expect(Math.max(...r.map((head) => head.h))).toBeLessThanOrEqual(width <= 390 ? 112 : 48);
    });
  });
}

test("Sources rows are one line with their full text in the tooltip (1440)", async ({ page }) => {
  await open(page, 1440);
  const bad = await page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-testid="sandbox-sources-slot"]');
    if (!panel) return ["no Sources"];
    const out: string[] = [];
    for (const el of panel.querySelectorAll<HTMLElement>("span")) {
      if (getComputedStyle(el).textOverflow !== "ellipsis") continue;
      if (el.scrollWidth > el.clientWidth && !el.getAttribute("title")) out.push(`cut but no tooltip: ${el.textContent?.slice(0, 40)}`);
      if (el.getBoundingClientRect().height > 24) out.push(`two lines: ${el.textContent?.slice(0, 40)}`);
    }
    return out;
  });
  expect(bad).toEqual([]);
});

test("the Classification Card's name is one line with the full title in its tooltip", async ({ page }) => {
  await open(page, 1440);
  await page.getByRole("button", { name: "Classification Card" }).first().click();
  const preview = page.getByTestId("card-preview");
  await preview.waitFor();
  const r = await preview.evaluate((el) => {
    const name = [...el.querySelectorAll<HTMLElement>("span[title]")][0];
    return { title: name?.getAttribute("title") ?? "", height: name?.getBoundingClientRect().height ?? 0, cut: name ? name.scrollWidth > name.clientWidth : false };
  });
  expect(r.title.length).toBeGreaterThan(40);
  expect(r.height).toBeLessThanOrEqual(24);
  expect(r.cut).toBe(true);
});
