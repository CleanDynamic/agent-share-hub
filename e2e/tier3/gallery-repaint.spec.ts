// Tier 3 — the repainted gallery (BG-P19).
//
// WHY THIS IS A BROWSER SPEC AND NOT A UNIT TEST. Everything asserted here is
// RESOLVED LAYOUT: how many columns `.fs-grid` actually produces inside a wide
// frame at four widths, what the gutter between them computes to, whether the
// page scrolls sideways, whether two cards in one row come out the same height,
// and whether the facet band collapses before it can eat the first screen.
// jsdom has no layout engine, so none of it is testable anywhere else.
//
// WHAT IS DELIBERATELY NOT HERE. The facet logic, the shortfall line's audience
// rules, the four states and the stagger's once-only behaviour are all
// assertions about what the component decides rather than about what a browser
// does with it, and they are covered by 25 unit tests in
// src/pages/Gallery.test.tsx. Duplicating them here would buy a slower copy.
// The one piece of the stagger that IS here is its end state: a card left at
// opacity 0 because an observer never fired is invisible content, and only a
// real IntersectionObserver can prove that did not happen.
//
// THE COLUMN COUNT IS READ OFF `grid-template-columns` rather than counted from
// bounding boxes. `auto-fill` resolves to a real track list, so the computed
// value names the columns directly — and a box-based count would be reporting
// where the cards happen to have landed, which is the same number by a route
// that also passes when the grid has one track and the cards wrapped.
//
// Selectors are the data attributes the page emits and the roles the kit
// renders. Nothing here selects on a class except `.fs-grid`, which is the
// frame's own grid container and the actual subject of half these assertions.

import { expect, test, type Page, type Route } from "@playwright/test";

const REST = /\/rest\/v1\//;
const FACETS = /\/rest\/v1\/rpc\/gallery_facets/;

/** The prompt's four widths. 1100 and 700 are the ones acceptance 1 names. */
const WIDTHS = [1400, 1100, 1024, 700] as const;

/** What each width must produce, and why. */
const COLUMNS: Record<number, number> = {
  1400: 3,
  1100: 2,
  1024: 2,
  700: 1,
};

const THEMES = ["exhibition", "dusk"] as const;

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* private window — the default theme is a fine ground for a measurement */
    }
  }, theme);
}

/** True when anything on the page reaches past the viewport horizontally. */
const overflowsX = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

/* ── The stubbed gallery ─────────────────────────────────────────────────────
   Nine builds, no media and no nodes, which is all a layout measurement needs:
   the card renders every branch down to the outcome set large, and a card with
   a picture is a card of the same width. Titles of three different lengths, so
   a row's cards would come out at three different heights if the media slot
   were not fixed — which is the uniform-grid claim.
   ────────────────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

function build(n: number): Row {
  const titles = [
    "Inbox triage agent",
    "A build whose title is long enough to wrap onto a second and very nearly a third line",
    "Short one",
  ];
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    creator_id: "00000000-0000-4000-8000-0000000000aa",
    slug: `build-${n}`,
    title: titles[n % titles.length],
    outcome: "Does a thing, and says how well it did it.",
    shape: "other",
    status: "published",
    made_for: ["lawyer"],
    made_with: ["Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 92,
    reproduction_count: n,
    last_confirmed_at: "2026-09-01T00:00:00.000Z",
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: "2026-08-01T00:00:00.000Z",
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    build_nodes: [],
    build_media: [],
    bounties: [],
  };
}

const BUILDS = Array.from({ length: 9 }, (_, n) => build(n));

const FACET_PAYLOAD = {
  roles: [
    { value: "lawyer", count: 6, label: null, logo_url: null },
    { value: "designer", count: 2, label: null, logo_url: null },
    { value: "researcher", count: 1, label: null, logo_url: null },
  ],
  tools: [
    { value: "Claude", count: 7, label: "Claude", logo_url: null },
    { value: "n8n", count: 2, label: "n8n", logo_url: null },
  ],
};

/**
 * Answer the page's three requests, and everything else with an empty list.
 *
 * Registered widest-first, because Playwright matches the LAST registered route
 * first and the two specific handlers have to beat the catch-all.
 */
async function stubGallery(page: Page, rows: Row[] = BUILDS) {
  await page.route(REST, (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.route(FACETS, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FACET_PAYLOAD),
    }),
  );

  await page.route(/\/rest\/v1\/builds/, (route: Route) => {
    // countOpenBountyBuilds asks with HEAD — the count only, no rows.
    if (route.request().method() === "HEAD") {
      return route.fulfill({
        status: 200,
        headers: { "content-range": "*/2" },
        body: "",
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(rows),
    });
  });
}

/** The grid's resolved track count and gutter. */
async function gridMetrics(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector('[data-visual-slot="gallery-grid"]');
    if (!grid) return null;
    const style = getComputedStyle(grid);
    return {
      columns: style.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      gap: Math.round(parseFloat(style.columnGap)),
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 1 — the grid, at four widths in two themes
   ════════════════════════════════════════════════════════════════════════════ */

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`BG-P19 — ${COLUMNS[width]} across at ${width} on ${theme}, with no sideways scroll`, async ({
      page,
    }) => {
      await withTheme(page, theme);
      await stubGallery(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/gallery");

      await expect(page.locator('[data-visual-slot="gallery-grid"]')).toBeVisible();

      const metrics = await gridMetrics(page);
      expect(metrics).not.toBeNull();
      expect(metrics!.columns).toBe(COLUMNS[width]);

      // The gutters are scale steps and nothing else: md (24) below 1280,
      // opening to lg (40) above.
      expect(metrics!.gap).toBe(width >= 1280 ? 40 : 24);

      expect(await overflowsX(page)).toBe(false);
    });
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   The uniform grid — the decision, measured
   ════════════════════════════════════════════════════════════════════════════ */

test("BG-P19 — every card in a row gets the same media slot", async ({ page }) => {
  await stubGallery(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/gallery");
  await expect(page.locator('[data-visual-slot="gallery-card"]').first()).toBeVisible();

  // The first row's three cards. Their titles are one, two and nearly three
  // lines long, which is what makes this worth measuring at all.
  const row = await page.evaluate(() => {
    const cards = Array.from(
      document.querySelectorAll('[data-visual-slot="gallery-card"]'),
    ).slice(0, 3);
    return cards.map((card) => {
      const title = card.querySelector('[data-card-part="title"]');
      return {
        top: Math.round(card.getBoundingClientRect().top),
        // Where the title starts IS where the media slot ends, so one number
        // measures the slot without reaching inside the card for it.
        titleTop: Math.round(title!.getBoundingClientRect().top),
        height: Math.round(card.getBoundingClientRect().height),
      };
    });
  });

  expect(row).toHaveLength(3);
  // Every card starts on one line...
  expect(new Set(row.map((card) => card.top)).size).toBe(1);
  // ...and every media block is the same height, which is the fixed slot and
  // the whole of the uniform-grid decision. A masonry gallery, or one passing
  // layout="feed" here, would give three different numbers.
  expect(new Set(row.map((card) => card.titleTop)).size).toBe(1);

  /* WHAT THIS DELIBERATELY DOES NOT ASSERT: identical card HEIGHTS. A card
     whose title wraps to two lines is one line taller than one whose title
     does not — 33px at the card title's line height — and closing that gap
     would take either `align-items: stretch` on `.fs-grid`, which is BG-P14's
     and is documented there as deliberate, or a height on GalleryCard, which
     this prompt may not touch. One line of title is not a ragged wall: the
     pictures line up, the plaques sit at one offset inside each card, and the
     row reads as a row. See the handoff note. */
  const spread = Math.max(...row.map((c) => c.height)) - Math.min(...row.map((c) => c.height));
  expect(spread).toBeLessThanOrEqual(40);
});

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 2 — the facet rail and its collapse
   ════════════════════════════════════════════════════════════════════════════ */

test("BG-P19 — the facet band is open at 1024 and the first card is above the fold", async ({
  page,
}) => {
  await stubGallery(page);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/gallery");

  const band = page.getByRole("region", { name: "Filters" });
  await expect(band).toBeVisible();
  await expect(page.getByTestId("gallery-filters-trigger")).toHaveCount(0);

  // The whole reason the band collapses one pixel lower: at this width it must
  // still leave the work on the first screen.
  const firstCardTop = await page
    .locator('[data-visual-slot="gallery-card"]')
    .first()
    .evaluate((card) => card.getBoundingClientRect().top);
  expect(firstCardTop).toBeLessThan(900);
});

test("BG-P19 — below 1024 the band is one control opening a sheet", async ({ page }) => {
  await stubGallery(page);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/gallery");

  // The three rows of chips are gone; one control stands in for them.
  await expect(page.getByTestId("facet-made-for-lawyer")).toHaveCount(0);
  const trigger = page.getByTestId("gallery-filters-trigger");
  await expect(trigger).toBeVisible();

  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible();
  // The same chips, inside it.
  await expect(sheet.getByTestId("facet-made-for-lawyer")).toBeVisible();
  await expect(sheet.getByTestId("facet-bounties-open")).toBeVisible();

  // Choosing inside the sheet narrows the grid and shows up as a removable
  // chip on the page behind it.
  await sheet.getByTestId("facet-made-for-lawyer").click();
  await expect(page.getByTestId("selected-facet-made-for-lawyer")).toBeVisible();

  expect(await overflowsX(page)).toBe(false);
});

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 3 — the stagger
   ════════════════════════════════════════════════════════════════════════════ */

test("BG-P19 — the stagger settles, leaving every card visible", async ({ page }) => {
  await stubGallery(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/gallery");

  const cells = page.locator('[data-visual-slot="gallery-grid-cell"]');
  await expect(cells.first()).toBeVisible();

  // Every cell in the first screen reveals, and none is left at opacity 0
  // because an observer never fired — which is the failure mode that makes a
  // reveal worse than no reveal at all.
  await expect(cells.first()).toHaveAttribute("data-revealed", "");

  /* POLLED RATHER THAN READ ONCE, because `data-revealed` marks the moment the
     transition STARTS: the attribute and the new style land in the same commit,
     and computed opacity at that instant is still 0. The claim is about where
     the reveal ends — 450ms plus up to 400ms of stagger — not about how fast
     it gets there. */
  await expect
    .poll(
      async () =>
        cells.evaluateAll((nodes) =>
          nodes.slice(0, 3).every((node) => Number(getComputedStyle(node).opacity) > 0.99),
        ),
      { timeout: 5_000 },
    )
    .toBe(true);
});

test("BG-P19 — under reduced motion nothing is hidden and nothing moves", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubGallery(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/gallery");

  const cell = page.locator('[data-visual-slot="gallery-grid-cell"]').first();
  await expect(cell).toBeVisible();

  // Not "revealed instantly" — never hidden. No inline style at all, so there
  // is no transition to run and no transform to undo.
  await expect(cell).toHaveAttribute("data-revealed", "");
  expect(await cell.evaluate((node) => node.getAttribute("style"))).toBeNull();
});

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 5 — the states, in a real browser at the narrow end
   ════════════════════════════════════════════════════════════════════════════ */

test("BG-P19 — the empty state fits a phone without scrolling sideways", async ({
  page,
}) => {
  await stubGallery(page, []);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery");

  await expect(page.getByTestId("gallery-empty")).toBeVisible();
  await expect(page.getByRole("link", { name: "Write one up" })).toBeVisible();
  expect(await overflowsX(page)).toBe(false);
});
