/* CA-27 P5: the screens, written to design/audits/composer/ca-27/ in both rooms, and the proof that nothing at rest moved.

   - find-2-of-5-1440: Find open on the ca27 build, "sourdough", the second of five.
   - long-1440, long-390: the ca27 build's long titles and previews.
   - scrolled-1440: the ca27 build of 300, scrolled part of the way down.
   - tablet-1024-details: the build at 1024, a tile tapped, Details open as the panel.
   - at rest: the "ca22" and "ca25" builds at 1440 and 390, against shots taken from a checkout from before CA-27
     (`AT_REST_RECORD=1 E2E_BASE_URL=<that checkout's server>` writes them to design/audits/composer/ca-27/before/). The only change a
     computer's page may show is the Find in build button before View; a phone's page is byte for byte the same.

     npm run audit -- composer-ca27-shots */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/ca-27";
const BEFORE = `${OUT}/before`;
const THEMES = ["dusk", "noon"] as const;
const RECORD = process.env.AT_REST_RECORD === "1";

const url = (theme: string, build: string, query: string, mobile: boolean, window = false) => `/dev/kit/pages/sandbox?theme=${theme}&build=${build}&${query}${mobile ? "&viewport=mobile" : window ? "&window=1" : ""}`;

async function open(page: Page, theme: string, build: string, query: string, mobile = false, window = false) {
  mkdirSync(OUT, { recursive: true });
  await page.goto(url(theme, build, query, mobile, window));
  await page.locator('section[aria-label="Build"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
}

for (const theme of THEMES) {
  test.describe(`${theme} · screens`, () => {
    test.skip(RECORD, "recording the at-rest shots only");

    test("Find with 2 of 5, at 1440", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, theme, "ca27", "tiles=300&bar=0&fit=content");
      await page.keyboard.press("/");
      await page.getByTestId("find-input").fill("sourdough");
      await expect(page.getByTestId("find-count")).toHaveText("1 of 5");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("find-count")).toHaveText("2 of 5");
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/find-2-of-5-${theme}-1440.png` });
    });

    for (const [width, mobile] of [[1440, false], [390, true]] as const) {
      test(`long titles and previews, at ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page, theme, "ca27", "tiles=40&bar=0&fit=content&select=c27-3", mobile);
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({ path: `${OUT}/long-${theme}-${width}.png` });
      });
    }

    test("the ca27 build scrolled, at 1440", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, theme, "ca27", "tiles=300&bar=0&fit=content");
      await page.evaluate(() => scrollTo(0, 7000));
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/scrolled-${theme}-1440.png` });
    });

    test.describe("a tablet", () => {
      test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });
      test("at 1024 with Details open", async ({ page }) => {
        await open(page, theme, "ca27", "tiles=40&bar=0&fit=content", false, true);
        await page.locator('[data-node-id="c27-5"] p').first().tap();
        await page.getByTestId("details-overlay").waitFor();
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${OUT}/tablet-1024-details-${theme}.png` });
      });
    });
  });
}

/* ── at rest ── */

const RESTS = [
  ["ca22", "bar=0&select=c22-p2"],
  ["ca22", "bar=0"],
  ["ca25", "bar=0"],
] as const;

/** The pixels two shots differ in, and the box round them. */
async function differ(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([x, y]) => {
      const load = async (data: string) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return { data: context.getImageData(0, 0, bitmap.width, bitmap.height).data, w: bitmap.width, h: bitmap.height };
      };
      const [p, q] = [await load(x), await load(y)];
      if (p.w !== q.w || p.h !== q.h) return { size: false as const, count: -1, box: null };
      let left = p.w;
      let top = p.h;
      let right = -1;
      let bottom = -1;
      let count = 0;
      for (let at = 0; at < p.data.length; at += 4) {
        if (p.data[at] !== q.data[at] || p.data[at + 1] !== q.data[at + 1] || p.data[at + 2] !== q.data[at + 2]) {
          const px = (at / 4) % p.w;
          const py = Math.floor(at / 4 / p.w);
          left = Math.min(left, px);
          right = Math.max(right, px);
          top = Math.min(top, py);
          bottom = Math.max(bottom, py);
          count += 1;
        }
      }
      return { size: true as const, count, box: count ? { left, top, right, bottom } : null };
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

/** How many pixels differ outside every one of the boxes. */
async function outsideBoxes(page: Page, a: Buffer, b: Buffer, boxes: { left: number; top: number; right: number; bottom: number }[]) {
  return page.evaluate(
    async ([x, y, boxes]) => {
      const load = async (data: string) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return { data: context.getImageData(0, 0, bitmap.width, bitmap.height).data, w: bitmap.width };
      };
      const [p, q] = [await load(x as string), await load(y as string)];
      let count = 0;
      for (let at = 0; at < p.data.length; at += 4) {
        // Not a pixel whose colour is out by a level or two (the corner of a rounded box, drawn a shade differently by another build).
        if (Math.abs(p.data[at] - q.data[at]) + Math.abs(p.data[at + 1] - q.data[at + 1]) + Math.abs(p.data[at + 2] - q.data[at + 2]) <= 6) continue;
        const px = (at / 4) % p.w;
        const py = Math.floor(at / 4 / p.w);
        if (!(boxes as { left: number; top: number; right: number; bottom: number }[]).some((box) => px >= box.left && px <= box.right && py >= box.top && py <= box.bottom)) count += 1;
      }
      return count;
    },
    [a.toString("base64"), b.toString("base64"), boxes] as const,
  );
}

for (const theme of THEMES) {
  for (const [width, mobile] of [[1440, false], [390, true]] as const) {
    RESTS.forEach(([build, query], at) => {
      test(`at rest: ${build} ${query} · ${theme} · ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await open(page, theme, build, query, mobile);
        await page.mouse.move(2, 2);
        const shot = await page.screenshot();
        const name = `${build}-${at}-${theme}-${width}.png`;
        if (RECORD) {
          mkdirSync(BEFORE, { recursive: true });
          writeFileSync(`${BEFORE}/${name}`, shot);
          return;
        }
        test.skip(!existsSync(`${BEFORE}/${name}`), "no shot from before CA-27 to compare with");
        const before = readFileSync(`${BEFORE}/${name}`);
        const d = await differ(page, before, shot);
        expect(d.size).toBe(true);
        if (mobile) {
          // A phone's page has no Find button: byte for byte.
          expect(d.count).toBe(0);
          return;
        }
        // A computer's: the Find in build button before View is new, the hint line says "read all", and a Sources row whose name wrapped
        // before is one line with an ellipsis now (P2). Nothing else may differ.
        const allowed = await page.evaluate(() => {
          const box = (el: Element | null) => {
            const r = el?.getBoundingClientRect();
            return r ? { left: r.left - 2, top: r.top - 2, right: r.right + 2, bottom: r.bottom + 2 } : null;
          };
          const hint = [...document.querySelectorAll('[data-testid="build-list"] > p')][0] ?? null;
          // The Sources column: its slot's width, from its top to the foot of the window (what it holds may stand lower than its box).
          const sources = box(document.querySelector('[data-testid="sandbox-sources-slot"]'));
          if (sources) sources.bottom = window.innerHeight;
          return [box(document.querySelector('[data-testid="find-button"]')), box(hint), sources].filter(Boolean) as { left: number; top: number; right: number; bottom: number }[];
        });
        // (A build without a hint line has two.)
        expect(allowed.length).toBeGreaterThanOrEqual(2);
        const outside = await outsideBoxes(page, before, shot, allowed);
        expect(outside, "pixels that differ outside the Find button, the hint line and the Sources column").toBe(0);
      });
    });
  }
}
