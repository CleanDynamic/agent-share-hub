/* SV-04 P5: one placeholder per page. Played on the built bundle by `npm run audit:pages`, on the audit database.

   For each page, two loads:
     the route's Placeholder   the page's chunk is held back, so the frame's one boundary shows the route table's
                               Placeholder;
     the page's loading state  the chunk comes, every database read is held back, so the page draws its own loading state.
   The loading blocks (`[data-ui=skeleton]`, the composer's `loading-blocks`) in the page area are read in both, and must be
   the same blocks at the same boxes, within 2 px. A page prompt (SV-08 to SV-14) that redraws a page keeps this green. */

import { expect, test, type Page } from "@playwright/test";

import { SV_DRAFT_ID } from "./fixtures/svPages";
import { BUILD_SLUG } from "./support/harness";
import { stage, type Span } from "./support/pageStage";

const BASE_URL = process.env.PERF_BASE_URL ?? "";

interface Case {
  page: string;
  path: string;
  /** The page's chunk, by the start of its file name in dist/assets. */
  chunk: string;
}

/* Home and Profile are not here: their loading states are most of their views (Home's hero and wall, Profile's stats
   wall and tabs), and a light copy would put about 31 KB of script into every visitor's first download. They keep the
   list placeholder until SV-10 (Home) and a later prompt decide (sv-04-after.md). */
const CASES: Case[] = [
  { page: "Builds", path: "/builds", chunk: "GalleryPage" },
  { page: "OpenBuilds", path: "/openbuilds", chunk: "Bounties" },
  { page: "Library", path: "/library", chunk: "LibraryPage" },
  { page: "Drafts", path: "/drafts", chunk: "DraftsPage" },
  { page: "Build", path: `/b2/${BUILD_SLUG}`, chunk: "BuildPage" },
  { page: "Composer", path: `/compose/${SV_DRAFT_ID}`, chunk: "SandboxPage" },
];

type Box = [number, number, number, number];

async function blocks(page: Page): Promise<Box[]> {
  // Two quiet frames, so a block that was about to move has moved.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return page.evaluate(() =>
    [...document.querySelectorAll('#main [data-ui="skeleton"], #main [data-testid="loading-blocks"], #main [data-bg-animated]')]
      .filter((element) => !element.closest('[data-slot="breadcrumb"]') && !element.closest('[data-testid="compose-skeleton-ghost"]'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return [rect.x, rect.y + window.scrollY, rect.width, rect.height].map((value) => Math.round(value)) as [number, number, number, number];
      })
      // What is not drawn is not seen: a block with no size, or one under a hidden ancestor.
      .filter(([, , width, height]) => width > 0 && height > 0),
  );
}

const hold = () => new Promise<never>(() => undefined);

async function routePlaceholder(page: Page, target: Case): Promise<Box[]> {
  const spans: Span[] = [];
  await stage(page, { auth: true }, spans);
  await page.route(new RegExp(`/assets/${target.chunk}-[^/]+\\.js$`), () => hold());
  await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "commit" });
  await page.waitForFunction(() => document.querySelector('#main [data-ui="skeleton"], #main [data-testid="loading-blocks"], #main [data-bg-animated]') !== null, null, { timeout: 15_000 });
  await page.waitForTimeout(300);
  return blocks(page);
}

async function pageLoading(page: Page, target: Case): Promise<Box[]> {
  const spans: Span[] = [];
  await stage(page, { auth: true }, spans);
  // Registered last, so it runs first: every read waits for ever, the session aside.
  await page.route(/\/rest\/v1\//, () => hold());
  await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "commit" });
  await page.waitForResponse(new RegExp(`/assets/${target.chunk}-[^/]+\\.js$`), { timeout: 15_000 });
  await page.waitForTimeout(600);
  return blocks(page);
}

const near = (a: Box, b: Box) => a.every((value, index) => Math.abs(value - b[index]) <= 2);

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

for (const target of CASES) for (const viewport of VIEWPORTS) {
  test(`SV-04 P5: ${target.page} (${viewport.name}): the route's placeholder is the page's own loading state, within 2 px`, async ({ browser }) => {
    const one = await browser.newContext({ viewport });
    const two = await browser.newContext({ viewport });
    try {
      const placeholder = await routePlaceholder(await one.newPage(), target);
      const loading = await pageLoading(await two.newPage(), target);
      expect(placeholder.length, "the route's placeholder draws blocks").toBeGreaterThan(0);
      const unmatched = loading.filter((box, index) => !placeholder[index] || !near(box, placeholder[index]));
      expect({ count: placeholder.length, unmatched: unmatched.slice(0, 6) }, `route placeholder ${JSON.stringify(placeholder.slice(0, 6))}`).toEqual({ count: loading.length, unmatched: [] });
    } finally {
      await one.close();
      await two.close();
    }
  });
}
