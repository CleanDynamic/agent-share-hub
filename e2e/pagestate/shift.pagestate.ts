// G12: the skeleton-to-state swap keeps the region's box, so nothing below it moves by more than 1px. A page-level failed or
// not-found state does not keep the skeleton's height: there the footer may move up, but it never sits above the bottom of the
// window, and the title and the breadcrumb do not move at all.
//
// Measured with the browser's layout-shift entries, which name every element that moved and its box before and after. The
// page is loaded under "never answered" (skeleton, then the failed state at the time limit) and "empty" (skeleton, then
// the empty or not-found state); every shift from the first skeleton on is collected, and the largest vertical move of any
// element is the figure. Run: npx playwright test -c playwright.pagestate.config.ts shift. Readings land in
// test-results/pagestate-shift.

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { installCondition, signIn, type Condition } from "./network";

const OUT = path.resolve("test-results/pagestate-shift");
const PAGES = [
  { name: "Home", path: "/" },
  { name: "Builds", path: "/builds" },
  { name: "Library", path: "/library" },
  { name: "Build", path: "/b2/pagestate-missing" },
];
const CONDITIONS: { condition: Condition; wait: number }[] = [
  { condition: "empty", wait: 4_000 },
  { condition: "never", wait: 13_000 },
];

interface Moved {
  at: number;
  node: string;
  dy: number;
  from: number;
  to: number;
  /** In the page's h1 or its breadcrumb: may not move at all. */
  title: boolean;
  /** The site footer: may move up after a page-level state, never above the window's bottom. */
  footer: boolean;
  /**
   * EXEMPT: Home's room. Still open, Most run and Where next are hidden when empty (UX-03 P6, kept deliberately), and they
   * are the last things in the room; nothing but the footer sits below them (Your published builds is drawn only when all
   * three are hidden, in their place). A list that hides moves only the hideable lists after it.
   */
  room: boolean;
}

for (const page of PAGES) {
  for (const { condition, wait } of CONDITIONS) {
    test(`shift ${page.name} ${condition}`, async ({ page: browser }) => {
      test.setTimeout(wait + 30_000);
      await browser.addInitScript(() => {
        const moved: Moved[] = [];
        (window as unknown as { __moved: Moved[] }).__moved = moved;
        const describe = (node: Node | null): string => {
          if (!node || !(node instanceof Element)) return "?";
          const id = node.getAttribute("data-testid") ?? node.getAttribute("data-ui") ?? node.getAttribute("aria-label") ?? "";
          return `${node.tagName.toLowerCase()}${id ? `[${id}]` : ""}{${(node as HTMLElement).outerHTML.slice(0, 140).replace(/\s+/g, " ")}}`;
        };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as unknown as { startTime: number; sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] }[]) {
            for (const source of entry.sources ?? []) {
              const element = source.node instanceof Element ? source.node : null;
              moved.push({
                at: Math.round(entry.startTime),
                node: describe(source.node),
                dy: Math.round(source.currentRect.y - source.previousRect.y),
                from: Math.round(source.previousRect.y),
                to: Math.round(source.currentRect.y),
                title: Boolean(element?.closest("h1, [data-testid='breadcrumb']")),
                footer: Boolean(element?.closest("[data-slot='footer'], footer")),
                room: Boolean(element?.closest("aside[aria-label='The room']")),
              });
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      });
      await installCondition(browser, condition);
      await signIn(browser);
      await browser.goto(page.path, { waitUntil: "commit" });
      await browser.waitForTimeout(wait);
      const moved = await browser.evaluate(() => (window as unknown as { __moved: Moved[] }).__moved);
      /* Before the first skeleton is on screen the page is still being drawn for the first time; a move then is not a swap. */
      const firstPaint = await browser.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0);
      const swaps = moved.filter((m) => m.at > firstPaint + 100);
      const regions = swaps.filter((m) => !m.title && !m.footer && !(page.name === "Home" && m.room));
      const largest = regions.reduce((max, m) => Math.max(max, Math.abs(m.dy)), 0);
      const titleMoves = swaps.filter((m) => m.title && m.dy !== 0);
      const footerGap = await browser.evaluate(() => {
        const footer = document.querySelector("[data-slot='footer']") ?? document.querySelector("footer");
        return footer ? Math.round(window.innerHeight - footer.getBoundingClientRect().bottom) : null;
      });
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `${page.name.toLowerCase()}__${condition}.json`), JSON.stringify({ page: page.name, condition, largest, titleMoves, footerGap, swaps: swaps.slice(0, 20) }, null, 2));
      console.log(
        `SHIFT ${page.name} / ${condition}: regions ${largest}px · title and breadcrumb ${titleMoves.length ? titleMoves.map((m) => `${m.node.slice(0, 40)} ${m.from}→${m.to}`).join(", ") : "still"} · footer bottom ${footerGap === null ? "?" : footerGap > 0 ? `${footerGap}px ABOVE the window's bottom` : "at or below the window's bottom"}${regions.length ? ` · ${regions.slice(0, 4).map((m) => `${m.node.slice(0, 60)} ${m.from}→${m.to}`).join(" | ")}` : ""}`,
      );
      expect.soft(largest, "nothing below a region moves by more than 1px").toBeLessThanOrEqual(1);
      expect.soft(titleMoves, "the title and the breadcrumb do not move").toEqual([]);
      expect.soft(footerGap === null || footerGap <= 0, "the footer never sits above the bottom of the window").toBe(true);
    });
  }
}
