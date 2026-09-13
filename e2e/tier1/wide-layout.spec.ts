// Tier 1 — BG-P14, the frame's two layout modes, measured.
//
// WHY THIS IS A BROWSER SPEC AND NOT A UNIT TEST. Everything asserted here is
// resolved layout: a frame's rendered width, a grid's column count, whether
// anything pokes past the viewport. jsdom has no layout engine, so the vitest
// side of this prompt asserts the stylesheet's text and this asserts what a
// browser does with it. Neither is the other's substitute.
//
// IT NEEDS NO AUTH AND NO DATA. /dev/wide is a dev-only route rendering twelve
// placeholders, so the whole file runs against a bare dev server. That is also
// why the wide mode is verified here rather than on a real route: BG-P14 moves
// no route, and BG-P15 does.
//
// THE FIVE WIDTHS come from the prompt's overflow sweep: 390 (phone), 768 and
// 1024 (the frame's two existing breakpoints, from below and above), 1400
// (a laptop, and where the three-across grid is claimed) and 1920 (past the
// 1600px cap). Both themes, because a theme switch that changed a measurement
// would be a bug in the switch.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["exhibition", "dusk"] as const;
const SWEEP = [390, 768, 1024, 1400, 1920];

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem("bg-theme", t);
    } catch {
      /* private window — the default theme is a fine fallback for a measurement */
    }
  }, theme);
}

const width = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => el.getBoundingClientRect().width);

/** The number of tracks the grid actually resolved to. */
const columns = (page: Page) =>
  page
    .locator(".fs-grid")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length);

/**
 * True when anything on the page reaches past the viewport in either direction.
 *
 * BG-P18b ADDED THE SCROLLER EXEMPTION, and it is a correction rather than a
 * loosening. The element sweep asks "does this box stick out of the window",
 * which is the right question for a box in normal flow and the wrong one for a
 * box inside a horizontal scroller: the feed's tab bar is a `.scrollbar-hide`
 * strip whose later tabs are DELIBERATELY past the right edge below 768 — that
 * is what makes it a scroller — and the page does not move because of them. An
 * element inside a scrolling ancestor is clipped by it, so the document check
 * on the first line is the one that can see it, and it stays.
 */
const overflows = (page: Page) =>
  page.evaluate(() => {
    if (document.documentElement.scrollWidth > window.innerWidth + 1) return true;
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const x = getComputedStyle(p).overflowX;
        if (x === "auto" || x === "scroll" || x === "hidden") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("body *")].some((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      if (r.right <= window.innerWidth + 1 && r.left >= -1) return false;
      return !inScroller(el);
    });
  });

async function open(page: Page, path: string, viewport: number, theme = "exhibition") {
  await withTheme(page, theme);
  await page.setViewportSize({ width: viewport, height: 900 });
  await page.goto(path);
  await page.locator(".fs-frame").waitFor();
}

/* BG-P18b. The reading column is 634 and not 600, and the frame's 24px padding
   and gap are 0. 634 is 1 + 16 + 600 + 16 + 1 under `box-sizing: border-box` —
   a hairline and 16px of padding on each side of the 600 a CARD is specified
   at, where the old 600 column plus the home wrapper's own 16px inset rendered
   568px cards. The frame, the two rails and the breakpoints are as they were,
   and those are the numbers this file has always been for. */
test.describe("standard mode is the frame", () => {
  test("keeps 1200 / 240 / 300, with a 634 reading column", async ({ page }) => {
    await open(page, "/", 1400);
    expect(await page.locator(".fs-root.fs-wide").count()).toBe(0);
    expect(await width(page, ".fs-frame")).toBe(1200);
    expect(await width(page, ".fs-left")).toBe(240);
    expect(await width(page, ".fs-centre")).toBe(634);
    expect(await width(page, ".fs-right")).toBe(300);
  });

  test("puts a card at exactly 600 inside that column", async ({ page }) => {
    await open(page, "/", 1400);
    // The column's content box, which is what every item in the feed fills.
    const content = await page
      .locator(".fs-centre")
      .evaluate((el) => el.clientWidth - 32);
    expect(content).toBe(600);
    expect(await width(page, '[data-testid="feed-tabs"]')).toBe(600);
  });

  test("does not widen past 1200 however wide the window gets", async ({ page }) => {
    await open(page, "/", 1920);
    expect(await width(page, ".fs-frame")).toBe(1200);
    expect(await width(page, ".fs-centre")).toBe(634);
  });

  /* 1024 is the one these exist for. All three columns render from 1024 up and
     1174 does not fit; with the centre pinned the row overflowed and
     `justify-content: center` put the left rail at x = -82, measured before
     this change. The centre gives way instead. One test per width rather than a
     loop in one test: `/` is a real route against a real backend, and seven
     navigations do not fit in one test's budget. */
  for (const viewport of [390, 768, 1024, 1200, 1280, 1440, 1920]) {
    test(`does not overflow at ${viewport}px`, async ({ page }) => {
      await open(page, "/", viewport);
      expect(await overflows(page)).toBe(false);
    });
  }
});

test.describe("wide mode", () => {
  test("opens the frame to 1600px above a 1600px viewport", async ({ page }) => {
    await open(page, "/dev/wide", 1920);
    expect(await page.locator(".fs-root.fs-wide").count()).toBe(1);
    expect(await width(page, ".fs-frame")).toBe(1600);
    /* The centre took what the left rail and the gaps left, rather than 600. */
    expect(await width(page, ".fs-left")).toBe(240);
    expect(await width(page, ".fs-centre")).toBeGreaterThan(1200);
  });

  test("holds the left rail at 240px", async ({ page }) => {
    for (const viewport of [1024, 1400, 1920]) {
      await open(page, "/dev/wide", viewport);
      expect([viewport, await width(page, ".fs-left")]).toEqual([viewport, 240]);
    }
  });

  test("reflows the grid: three across at 1400, two at 1100, one at 700", async ({ page }) => {
    await open(page, "/dev/wide", 1400);
    expect(await columns(page)).toBe(3);
    await open(page, "/dev/wide", 1100);
    expect(await columns(page)).toBe(2);
    await open(page, "/dev/wide", 700);
    expect(await columns(page)).toBe(1);
  });

  test("opens the gutter from the md step to the lg step at 1280", async ({ page }) => {
    await open(page, "/dev/wide", 1279);
    expect(await page.locator(".fs-grid").evaluate((el) => getComputedStyle(el).gap)).toBe("24px");
    await open(page, "/dev/wide", 1280);
    expect(await page.locator(".fs-grid").evaluate((el) => getComputedStyle(el).gap)).toBe("40px");
  });
});

test.describe("the right rail is the route's decision", () => {
  test("is absent by default, and present when the route asked", async ({ page }) => {
    await open(page, "/dev/wide", 1400);
    expect(await page.locator(".fs-right").count()).toBe(0);

    await open(page, "/dev/wide/rail", 1400);
    await expect(page.locator(".fs-right")).toBeVisible();
    expect(await width(page, ".fs-right")).toBe(300);
  });

  test("costs the grid a column rather than overflowing the frame", async ({ page }) => {
    await open(page, "/dev/wide", 1400);
    const without = await columns(page);
    await open(page, "/dev/wide/rail", 1400);
    const with_ = await columns(page);
    expect(with_).toBeLessThan(without);
    expect(await overflows(page)).toBe(false);
  });

  test("gives the rail back below 1280, where a rail plus a grid fits neither", async ({ page }) => {
    await open(page, "/dev/wide/rail", 1279);
    await expect(page.locator(".fs-right")).toBeHidden();
    await open(page, "/dev/wide/rail", 1280);
    await expect(page.locator(".fs-right")).toBeVisible();
  });

  test("toggling it from the page reflows without overflow", async ({ page }) => {
    await open(page, "/dev/wide", 1400);
    await page.getByRole("link", { name: "Right rail: off" }).click();
    await expect(page.locator(".fs-right")).toBeVisible();
    expect(await overflows(page)).toBe(false);

    await page.getByRole("link", { name: "Right rail: on" }).click();
    await expect(page.locator(".fs-right")).toHaveCount(0);
    expect(await overflows(page)).toBe(false);
  });
});

test.describe("no horizontal overflow", () => {
  for (const theme of THEMES) {
    for (const viewport of SWEEP) {
      test(`wide mode at ${viewport}px on ${theme}`, async ({ page }) => {
        await open(page, "/dev/wide", viewport, theme);
        expect(await overflows(page)).toBe(false);
      });
    }
  }
});

test.describe("below 768 the two modes are identical", () => {
  test("wide gets the same frame a standard phone gets", async ({ page }) => {
    await open(page, "/", 390);
    const standard = {
      frame: await width(page, ".fs-frame"),
      centre: await width(page, ".fs-centre"),
    };

    await open(page, "/dev/wide", 390);
    expect(await width(page, ".fs-frame")).toBe(standard.frame);
    expect(await width(page, ".fs-centre")).toBe(standard.centre);
    /* No rails in either mode, and the grid is one column. */
    expect(await page.locator(".fs-left, .fs-right").count()).toBe(0);
    expect(await columns(page)).toBe(1);
  });
});
