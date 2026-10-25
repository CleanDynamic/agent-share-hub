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
      // 40 tiles: under the windowing, so every card is drawn to be measured.
      await open(page, width, "", 40);
      const xs = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="step-card"]')].map((card) => Math.round(card.querySelector<HTMLElement>('button[aria-label$=" options"]')?.getBoundingClientRect().right ?? -1) - Math.round(card.getBoundingClientRect().right)));
      expect(xs.length).toBeGreaterThan(30);
      expect(new Set(xs).size).toBe(1);
    });

    test("titles are one line with their full text in the tooltip; previews are two lines", async ({ page }) => {
      await open(page, width, width === 768 ? "" : "&select=c27-3", 40);
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
      expect(r.tiles).toBeGreaterThan(30);
      expect(r.previews).toBeGreaterThan(25);
    });

    test("a session head keeps its number, app and date and its ⋯ button whole; the title gives way", async ({ page }) => {
      await open(page, width, "", 40);
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
  await open(page, 1440, "", 40);
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

/* ── P3 large builds ── */

const drawn = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-skel-kind="tile"][data-drawn="true"]')].map((el) => el.dataset.skelId));
const boxes = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')].map((el) => ({ id: el.dataset.skelId, h: Math.round(el.getBoundingClientRect().height), drawn: el.dataset.drawn })));

test.describe("P3 large builds", () => {
  test("skipping a session's list off screen changes nothing to look at", async ({ page }) => {
    // 40 tiles stay under the windowing; the only difference between the two shots is `content-visibility`.
    await open(page, 1440, "&select=c27-2", 40);
    const shoot = async () => {
      const out: Buffer[] = [];
      for (const y of [0, 1100, 2300]) {
        await page.evaluate((y) => window.scrollTo(0, y), y);
        await page.waitForTimeout(500);
        out.push(await page.screenshot());
      }
      return out;
    };
    const lists = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="session-tiles"]')].map((el) => getComputedStyle(el).contentVisibility));
    expect(lists.filter((value) => value === "auto").length).toBeGreaterThan(10);
    const withSkipping = await shoot();
    await page.addStyleTag({ content: '[data-testid="session-tiles"] { content-visibility: visible !important; }' });
    await page.waitForTimeout(300);
    const without = await shoot();
    // Text sits on a sixty-fourth of a pixel here or there once a skipped list takes its measured height: no more than half of one per cent of the pixels may differ, and none by a line.
    for (let at = 0; at < withSkipping.length; at += 1) {
      const share = await page.evaluate(
        async ([a, b]) => {
          const load = async (data: string) => {
            const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const context = canvas.getContext("2d")!;
            context.drawImage(bitmap, 0, 0);
            return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
          };
          const [x, y] = [await load(a), await load(b)];
          let different = 0;
          for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) > 24 || Math.abs(x[i + 1] - y[i + 1]) > 24 || Math.abs(x[i + 2] - y[i + 2]) > 24) different += 1;
          return different / (x.length / 4);
        },
        [withSkipping[at].toString("base64"), without[at].toString("base64")],
      );
      expect(share, `shot ${at}`).toBeLessThan(0.005);
    }
  });

  test("a build of 300 draws only the tiles near the view, and every tile keeps a box", async ({ page }) => {
    await open(page, 1440);
    const all = await boxes(page);
    expect(all).toHaveLength(300);
    expect(all.every((box) => box.h >= 40)).toBe(true);
    const near = (await drawn(page)).length;
    expect(near).toBeGreaterThan(5);
    expect(near).toBeLessThan(90);
    // Cards are drawn only for those boxes.
    expect(await page.locator('[data-testid="step-card"]').count()).toBeLessThan(90);
  });

  test("scrolling through the build draws every tile in turn, and the page's height settles", async ({ page }) => {
    await open(page, 1440);
    const seen = new Set<string>();
    const top = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < top + 2000; y += 600) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(120);
      for (const id of await drawn(page)) seen.add(id as string);
    }
    expect(seen.size).toBe(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const settled = await page.evaluate(() => document.documentElement.scrollHeight);
    // Heights were estimated until each tile had been drawn: the page is within a tenth of what it measured at the start.
    expect(Math.abs(settled - top) / settled).toBeLessThan(0.1);
  });

  test("Find reaches a tile that is not drawn: it is drawn, ringed and in the middle of the view", async ({ page }) => {
    await open(page, 1440);
    expect(await drawn(page)).not.toContain("c27-244");
    await page.keyboard.press("/");
    await page.getByTestId("find-input").fill("sourdough");
    await expect(page.getByTestId("find-count")).toHaveText("1 of 5");
    for (let n = 0; n < 4; n += 1) await page.keyboard.press("Enter");
    await expect(page.getByTestId("find-count")).toHaveText("5 of 5");
    const card = page.locator('[data-node-id="c27-244"]');
    await card.waitFor();
    await page.waitForTimeout(800);
    const r = await card.evaluate((el) => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, ring: (el as HTMLElement).style.boxShadow, vh: innerHeight }));
    expect(r.ring).toContain("--selected-edge");
    expect(r.top).toBeGreaterThan(0);
    expect(r.bottom).toBeLessThan(r.vh);
    expect(Math.abs((r.top + r.bottom) / 2 - r.vh / 2)).toBeLessThan(r.vh * 0.2);
  });

  test("Go to it reaches a tile that is not drawn", async ({ page }) => {
    await open(page, 1440);
    expect(await drawn(page)).not.toContain("c27-244");
    await page.evaluate(() => (document.querySelector('[data-testid="act-go-to-far"]') as HTMLElement).click());
    const card = page.locator('[data-node-id="c27-244"]');
    await card.waitFor();
    await page.waitForTimeout(1200);
    const r = await card.evaluate((el) => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom, vh: innerHeight }));
    expect(r.top).toBeGreaterThan(-5);
    expect(r.bottom).toBeLessThan(r.vh + 5);
  });

  test("End goes to the last tile, drawn and focused, and Home back to the first; the arrows walk on past what is drawn", async ({ page }) => {
    await open(page, 1440);
    await page.locator('[data-node-id="c27-3"]').focus();
    await page.keyboard.press("End");
    const last = page.locator('[data-node-id="c27-300"]');
    await last.waitFor();
    await page.waitForTimeout(1800);
    expect(await last.evaluate((el) => el === document.activeElement || el.contains(document.activeElement))).toBe(true);
    expect(await last.evaluate((el) => el.getBoundingClientRect().top < innerHeight && el.getBoundingClientRect().bottom > 0)).toBe(true);
    await page.keyboard.press("Home");
    await page.waitForFunction(() => (document.activeElement as HTMLElement | null)?.dataset.nodeId === "c27-1", null, { timeout: 8000 });
    // Forty arrows down from the first tile: past the 16 that were drawn first and the screens after them.
    const focused = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.nodeId ?? "");
    await page.waitForTimeout(500);
    for (let n = 0; n < 40; n += 1) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(40);
    }
    const at = await focused();
    expect(at).toMatch(/^c27-\d+$/);
    expect(Number(at.slice(4))).toBeGreaterThan(25);
  });

  test("a drag picks up a tile and drops it on a tile far down that was not drawn", async ({ page }) => {
    await open(page, 1440);
    const before = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')].map((el) => el.dataset.skelId));
    const tile = page.locator('[data-skel-kind="tile"][data-skel-id="c27-3"]');
    await tile.hover();
    const grip = (await tile.locator('[data-testid="drag-handle"]').first().boundingBox())!;
    await page.mouse.move(grip.x + 9, grip.y + 11);
    await page.mouse.down();
    await page.mouse.move(grip.x + 16, grip.y + 30, { steps: 3 });
    await page.getByTestId("held-copy").waitFor();
    // The skeleton has every tile's place, drawn or not: the page is scrolled to the far tile and the pointer lands on it.
    const y = await page.evaluate(() => {
      const target = document.querySelector<HTMLElement>('[data-skel-kind="tile"][data-skel-id="c27-244"]')!;
      return target.getBoundingClientRect().top + scrollY;
    });
    await page.evaluate((y) => window.scrollTo(0, y - 300), y);
    await page.waitForTimeout(500);
    const far = (await page.locator('[data-skel-kind="tile"][data-skel-id="c27-244"]').boundingBox())!;
    await page.mouse.move(grip.x + 20, far.y + far.height * 0.75, { steps: 8 });
    await page.waitForTimeout(300);
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-skel-kind="tile"]')].map((el) => el.dataset.skelId));
    expect(after).toHaveLength(300);
    expect(after.indexOf("c27-3")).toBeGreaterThan(before.indexOf("c27-3") + 200);
    expect(Math.abs(after.indexOf("c27-3") - after.indexOf("c27-244"))).toBeLessThanOrEqual(2);
  });
});
