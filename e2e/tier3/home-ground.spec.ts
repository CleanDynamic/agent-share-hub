// Tier 3 — one ground, one surface, and the settled home feed (BG-P18b).
//
// WHY A BROWSER SPEC. Every claim here is a RESOLVED value: what colour an
// element actually paints after the cascade has run, how wide a card actually
// renders, whether two hairlines actually reach the bottom of the window. jsdom
// resolves no custom property and lays nothing out, so the vitest half of this
// prompt (`flat-shell.wide.test.ts`) asserts the stylesheet's text and this
// asserts what a browser does with it. Neither is the other's substitute.
//
// THE DEFECT THIS FILE EXISTS FOR. With Exhibition selected, `/` rendered three
// light panels on a dark, dotted field: `BlobBackground` painted the page
// #25252F under a 20px dot grid in BOTH themes, and the frame above it was on
// the new tokens. That is not a light theme with a bug, it is two themes on one
// screen — which the theme's first rule forbids outright. A regression would be
// silent: nothing throws when a page grows a second ground.
//
// Selectors are the testids and data attributes the components already emit.
// Nothing here selects on a class except the frame's own `.fs-*` elements,
// which ARE the measurement contract this file is checking.

import { expect, test, type Page, type Route } from "@playwright/test";

const RPC = /\/rest\/v1\/rpc\/get_build_feed/;
const REST = /\/rest\/v1\//;

const THEMES = ["exhibition", "dusk"] as const;

/** What each theme's `--bg` resolves to, as a browser reports it. */
const GROUND: Record<(typeof THEMES)[number], string> = {
  exhibition: "rgb(228, 230, 232)",
  dusk: "rgb(31, 27, 43)",
};

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* private window — the default theme is fine for a measurement */
    }
  }, theme);
}

/**
 * Answer every Supabase read with an empty list.
 *
 * Registered FIRST, because Playwright matches the last registered route first
 * and the feed stub below has to beat it.
 */
async function stubRestEmpty(page: Page) {
  await page.route(REST, (route: Route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
}

const EPOCH = Date.parse("2026-08-20T12:00:00.000Z");

/** Three build rows, which is all this file needs: it measures the gaps. */
function threeBuilds() {
  return [0, 1, 2].map((n) => ({
    item_kind: "build",
    item_at: new Date(EPOCH - n * 60_000).toISOString(),
    build_id: `00000000-0000-4000-8000-00000000000${n + 1}`,
    slug: `a-build-${n}`,
    title: `A build ${n}`,
    outcome: "Does a thing, and says how well it did it.",
    shape: "other",
    cover_media_id: null,
    creator_id: "00000000-0000-4000-8000-0000000000aa",
    creator_username: "amara",
    creator_display: "Amara Osei",
    creator_avatar: null,
    reproduction_count: 2,
    rebuild_count: 0,
    parent_build_id: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    rebuild_note: null,
    repro_note: null,
    repro_model: null,
    repro_user_username: null,
    status: "published",
    made_for: [],
    last_confirmed_at: null,
    last_confirmed_model: null,
    cover_bucket: null,
    cover_path: null,
    cover_kind: null,
    cover_poster_path: null,
    repro_worked: null,
    bounty_id: null,
    bounty_reward_gbp: null,
    bounty_gap_title: null,
  }));
}

async function stubFeed(page: Page, rows: unknown[]) {
  await page.route(RPC, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows),
    }),
  );
}

/**
 * Open a route with every read stubbed.
 *
 * ORDER MATTERS AND IS THE OPPOSITE OF THE OBVIOUS ONE: Playwright matches the
 * LAST registered route first, and `REST` also matches `/rest/v1/rpc/…`, so the
 * catch-all has to be registered BEFORE the feed stub or the feed comes back
 * empty and every card assertion counts zero.
 */
async function open(
  page: Page,
  path: string,
  theme = "exhibition",
  opts: { feed?: unknown[]; width?: number } = {},
) {
  await withTheme(page, theme);
  await page.setViewportSize({ width: opts.width ?? 1440, height: 900 });
  await stubRestEmpty(page);
  if (opts.feed) await stubFeed(page, opts.feed);
  await page.goto(path);
  await page.locator(".fs-frame").waitFor();
}

/** The resolved value of one CSS property on one element. */
const prop = (page: Page, selector: string, name: string) =>
  page
    .locator(selector)
    .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), name);

/* ────────────────────────────────────────────────────────────────────────────
   1. One ground
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("one ground", () => {
  for (const theme of THEMES) {
    test(`paints exactly one colour behind the frame on ${theme}`, async ({ page }) => {
      await open(page, "/", theme);

      // The token itself, which everything below is measured against.
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
        ),
      ).toBe(theme === "exhibition" ? "#E4E6E8" : "#1F1B2B");

      for (const sel of ["html", "body", "#root"]) {
        expect([sel, await prop(page, sel, "background-color")]).toEqual([sel, GROUND[theme]]);
      }

      // And the frame itself paints nothing at all.
      for (const sel of [".fs-root", ".fs-frame", ".fs-left", ".fs-right", ".fs-centre"]) {
        expect([sel, await prop(page, sel, "background-color")]).toEqual([sel, "rgba(0, 0, 0, 0)"]);
      }
    });

    test(`has no background image anywhere on ${theme}`, async ({ page }) => {
      await open(page, "/", theme);
      // BlobBackground's dot grid was a radial-gradient at `background-size:
      // 20px 20px` on a fixed inset-0 div. One element carrying one image is
      // all it took to put a pattern under the whole application.
      const withImages = await page.evaluate(() =>
        [document.documentElement, document.body, ...document.querySelectorAll("body *")]
          .filter((el) => getComputedStyle(el).backgroundImage !== "none")
          .map((el) => el.tagName + "." + String((el as HTMLElement).className).slice(0, 40)),
      );
      expect(withImages).toEqual([]);
    });
  }

  test("blurs exactly one surface with no cards loaded", async ({ page }) => {
    await open(page, "/", "exhibition");
    /* The theme's budget is about twenty blurred surfaces a page, and the rule
       that matters more is that a full-height fixed panel is never one. With an
       empty feed on a desktop viewport the only blurred surface on this route
       is the tab bar, which is a 52px sticky strip — the case the spec allows.
       Both rails and all three frame elements are flat. */
    const blurred = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => {
          const cs = getComputedStyle(el);
          const v = cs.backdropFilter || (cs as unknown as Record<string, string>).webkitBackdropFilter;
          return Boolean(v) && v !== "none";
        })
        .map((el) => el.getAttribute("data-testid") ?? el.tagName),
    );
    expect(blurred).toEqual(["feed-tabs"]);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2. One surface: three columns, two hairlines
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("the three columns read as one surface", () => {
  test("separates them with two hairlines and nothing else", async ({ page }) => {
    await open(page, "/", "exhibition");

    const line = (
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--line").trim(),
      )
    ).toLowerCase();
    expect(line).toBe("#c6cbd1");

    const centre = await page.locator(".fs-centre").evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        width: el.getBoundingClientRect().width,
        content: el.clientWidth - 32,
        padding: cs.paddingLeft + " " + cs.paddingRight,
        left: cs.borderLeftWidth + " " + cs.borderLeftColor,
        right: cs.borderRightWidth + " " + cs.borderRightColor,
        radius: cs.borderRadius,
      };
    });
    expect(centre.width).toBe(634);
    expect(centre.content).toBe(600);
    expect(centre.padding).toBe("16px 16px");
    expect(centre.left).toBe("1px rgb(198, 203, 209)");
    expect(centre.right).toBe("1px rgb(198, 203, 209)");
    expect(centre.radius).toBe("0px");

    // Neither rail carries one, and nothing sits between the columns.
    for (const sel of [".fs-left", ".fs-right"]) {
      expect([sel, await prop(page, sel, "border-top-width")]).toEqual([sel, "0px"]);
      expect([sel, await prop(page, sel, "border-radius")]).toEqual([sel, "0px"]);
      expect([sel, await prop(page, sel, "box-shadow")]).toEqual([sel, "none"]);
    }
    expect(await prop(page, ".fs-frame", "gap")).toBe("0px");

    const edges = await page.evaluate(() => {
      const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
      return {
        leftToCentre: Math.round(r(".fs-centre").left - r(".fs-left").right),
        centreToRight: Math.round(r(".fs-right").left - r(".fs-centre").right),
      };
    });
    expect(edges).toEqual({ leftToCentre: 0, centreToRight: 0 });
  });

  test("runs the hairlines to the bottom of the window with an empty feed", async ({ page }) => {
    await open(page, "/", "exhibition");
    await expect(page.getByTestId("feed-empty")).toBeVisible();

    // THE DEFECT THIS CATCHES. The centre used to end at the bottom of its
    // content, which on an empty tab left most of the window with no stage in
    // it at all.
    const { centreBottom, viewport } = await page.evaluate(() => ({
      centreBottom: document.querySelector(".fs-centre")!.getBoundingClientRect().bottom,
      viewport: window.innerHeight,
    }));
    expect(centreBottom).toBeGreaterThanOrEqual(viewport - 1);
  });

  test("holds both rails at the top of the window as sticky, full-height", async ({ page }) => {
    await open(page, "/", "exhibition");
    for (const sel of [".fs-left", ".fs-right"]) {
      expect([sel, await prop(page, sel, "position")]).toEqual([sel, "sticky"]);
      const height = await page.locator(sel).evaluate((el) => el.getBoundingClientRect().height);
      expect([sel, height]).toEqual([sel, 900]);
    }
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3. The tab bar
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("the tab bar", () => {
  test("is a 52px sticky strip at the top of the column", async ({ page }) => {
    await open(page, "/", "exhibition");
    const bar = page.getByTestId("feed-tabs");
    const box = await bar.evaluate((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        height: r.height,
        width: r.width,
        top: Math.round(r.top),
        position: cs.position,
        offset: cs.top,
        z: cs.zIndex,
        radius: cs.borderRadius,
        borderBottom: cs.borderBottomWidth,
      };
    });
    expect(box.height).toBe(52);
    expect(box.width).toBe(600);
    expect(box.top).toBe(0);
    expect(box.position).toBe("sticky");
    expect(box.offset).toBe("0px");
    expect(box.z).toBe("2");
    expect(box.radius).toBe("0px");
    expect(box.borderBottom).toBe("1px");
  });

  test("marks the current tab with a bar and no chip", async ({ page }) => {
    await open(page, "/?tab=recent", "exhibition");
    const current = page.getByTestId("feed-tab-recent");
    await expect(current).toHaveAttribute("data-state", "active");

    /* BG-P18 gave the current tab a --glass fill at --r-chip, which made one
       tab read as a button and the other five as text. The mark is a 32px
       --action bar under the label now, and the tab itself paints nothing. */
    const paint = await current.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, border: cs.borderTopWidth, radius: cs.borderRadius };
    });
    expect(paint).toEqual({ bg: "rgba(0, 0, 0, 0)", border: "0px", radius: "0px" });

    const indicator = current.getByTestId("feed-active-mark");
    await expect(indicator).toHaveCount(1);
    const mark = await indicator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const parent = el.parentElement!.getBoundingClientRect();
      return {
        width: r.width,
        height: r.height,
        colour: getComputedStyle(el).backgroundColor,
        // Centred under the label, and sitting on the strip's bottom edge.
        offCentre: Math.round(r.left + r.width / 2 - (parent.left + parent.width / 2)),
        offBottom: Math.round(parent.bottom - r.bottom),
      };
    });
    expect(mark).toEqual({
      width: 32,
      height: 2,
      colour: "rgb(158, 75, 44)",
      offCentre: 0,
      offBottom: 0,
    });

    // No other tab carries one.
    await expect(page.getByTestId("feed-active-mark")).toHaveCount(1);
  });

  test("divides six tabs equally across the column", async ({ page }) => {
    await open(page, "/", "exhibition");
    const widths = await page
      .getByTestId(/^feed-tab-/)
      .evaluateAll((nodes) => nodes.map((n) => Math.round(n.getBoundingClientRect().width)));
    expect(widths).toEqual([100, 100, 100, 100, 100, 100]);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   4. The card column
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("the card column", () => {
  test("puts 600px cards 16px apart, 16px below the bar", async ({ page }) => {
    await open(page, "/?tab=builds", "exhibition", { feed: threeBuilds() });

    const cards = page.locator('[data-visual-slot="gallery-card"]');
    await expect(cards).toHaveCount(3);

    const measured = await cards.evaluateAll((nodes) =>
      nodes.map((n) => n.getBoundingClientRect()).map((r) => ({
        width: Math.round(r.width),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
      })),
    );

    // 600 exactly — the one measurement the column's 634 exists to produce.
    for (const card of measured) expect(card.width).toBe(600);

    /* 16 between them, and the 16 is a collapsed margin rather than a flex gap:
       five of the six tabs render legacy cards carrying their own 10–12px
       bottom margin inside shared components, and a gap would have ADDED to
       those and given a column of 26 and 28. */
    for (let i = 1; i < measured.length; i += 1) {
      expect([i, measured[i].top - measured[i - 1].bottom]).toEqual([i, 16]);
    }

    const barBottom = await page
      .getByTestId("feed-tabs")
      .evaluate((el) => el.getBoundingClientRect().bottom);
    expect(Math.round(measured[0].top - barBottom)).toBe(16);
  });

  test("ends the column with 64px of ground under the last card", async ({ page }) => {
    await open(page, "/?tab=builds", "exhibition", { feed: threeBuilds() });
    await expect(page.locator('[data-visual-slot="gallery-card"]')).toHaveCount(3);

    /* MEASURED FROM THE LAST ROW, NOT THE LAST CARD. The Builds tab ends with
       a sentinel and an end-of-feed note under its cards, and both are part of
       the column — the 64 is the ground between whatever the column ends with
       and the fold, which is what stops the last thing in the feed sitting flush
       against the viewport edge. It is declared as 48 of padding plus the last
       row's own collapsed 16. */
    const tail = await page.evaluate(() => {
      const list = document.querySelector('[data-visual-slot="feed-column"]')!;
      const last = list.lastElementChild!.getBoundingClientRect();
      return Math.round(list.getBoundingClientRect().bottom - last.bottom);
    });
    expect(tail).toBe(64);
  });

  test("shows card skeletons while the first page is in flight, never a word", async ({ page }) => {
    await stubRestEmpty(page);
    // Hold the feed open so the loading state is the one on screen.
    await page.route(RPC, () => {});
    await withTheme(page, "exhibition");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?tab=builds");

    await expect(page.getByTestId("feed-builds-skeleton")).toBeVisible();
    await expect(
      page.locator('[data-visual-slot="gallery-card-skeleton"][data-card-layout="feed"]').first(),
    ).toBeVisible();
    await expect(page.locator(".fs-centre")).not.toContainText("Loading");
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   5. The empty state
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("the empty state", () => {
  test("is one line of display type, centred, with no disc and no icon", async ({ page }) => {
    await open(page, "/", "exhibition");
    const notice = page.getByTestId("feed-empty");
    await expect(notice).toBeVisible();

    const title = notice.locator("h2");
    const type = await title.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { size: parseFloat(cs.fontSize), family: cs.fontFamily };
    });
    // The display face is legal from 20px up; the shipped version was 22 and
    // this is 26, which is the only line on an otherwise empty screen.
    expect(type.size).toBeGreaterThanOrEqual(20);
    expect(type.family).toContain("Bodoni Moda");

    // No circle, and no glyph: --r-full belongs to spinners and avatars.
    const discs = await notice.evaluate(
      (root) =>
        [...root.querySelectorAll("*")].filter((el) => {
          const radius = getComputedStyle(el).borderRadius;
          return radius.includes("999") || radius.includes("50%");
        }).length,
    );
    expect(discs).toBe(0);
    await expect(notice.locator("svg")).toHaveCount(0);
  });

  test("fills the window under the tab bar", async ({ page }) => {
    await open(page, "/", "exhibition");
    const box = await page
      .getByTestId("feed-empty")
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), height: Math.round(r.height), vh: window.innerHeight };
      });
    // 52 of tab bar plus the column's 16px gap under it.
    expect(box.top).toBe(68);
    expect(box.height).toBe(box.vh - 68);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   6. The two rails
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("the left rail", () => {
  test("runs wordmark, nav, spacer, account block, theme control", async ({ page }) => {
    await open(page, "/", "exhibition");
    const order = await page.evaluate(() => {
      const rail = document.querySelector(".fs-left")!;
      const y = (s: string) => {
        const el = rail.querySelector(s) ?? rail.querySelector("[role='radiogroup']");
        return el ? Math.round(el.getBoundingClientRect().top) : -1;
      };
      return {
        logo: y(".fs-logo"),
        nav: y(".fs-nav-list"),
        account: y(".fs-user-section"),
        theme: Math.round(
          rail.querySelector("[role='radiogroup']")!.getBoundingClientRect().top,
        ),
        bottom: Math.round(rail.getBoundingClientRect().bottom),
      };
    });
    expect(order.logo).toBeLessThan(order.nav);
    expect(order.nav).toBeLessThan(order.account);
    expect(order.account).toBeLessThan(order.theme);
    // Pinned to the foot of the rail, inside its 24px bottom padding.
    expect(order.bottom - order.theme).toBeLessThanOrEqual(60);
  });

  test("aligns the wordmark with the nav icons", async ({ page }) => {
    await open(page, "/", "exhibition");
    const edges = await page.evaluate(() => ({
      logo: Math.round(document.querySelector(".fs-logo")!.getBoundingClientRect().left),
      icon: Math.round(document.querySelector(".fs-nav-icon")!.getBoundingClientRect().left),
      logoText: Math.round(
        document.querySelector(".fs-logo")!.getBoundingClientRect().left +
          parseFloat(getComputedStyle(document.querySelector(".fs-logo")!).paddingLeft),
      ),
    }));
    expect(edges.logoText).toBe(edges.icon);
  });

  test("offers the primary above the secondary, both at 40", async ({ page }) => {
    await open(page, "/", "exhibition");
    const buttons = await page
      .locator(".fs-auth-btn")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          label: n.textContent?.trim(),
          height: Math.round(n.getBoundingClientRect().height),
        })),
      );
    expect(buttons.map((b) => b.label)).toEqual(["Join free", "Sign in"]);
    expect(buttons.map((b) => b.height)).toEqual([40, 40]);
  });
});

test.describe("the right rail", () => {
  test("carries no sign-in controls", async ({ page }) => {
    await open(page, "/", "exhibition");
    const rail = page.locator(".fs-right");
    await expect(rail).toBeVisible();
    // THE DUPLICATION THIS REMOVES. The identical pair is in the left rail, on
    // the same screen at every width this rail renders at.
    await expect(rail.getByText("Join free", { exact: true })).toHaveCount(0);
    await expect(rail.getByText("Sign in", { exact: true })).toHaveCount(0);
  });

  test("browses to somewhere, and has no Blogs row", async ({ page }) => {
    await open(page, "/", "exhibition");
    const rail = page.locator(".fs-right");
    // Blog was retired in the NS series; the row navigated to "/" regardless.
    await expect(rail.getByText("Blogs", { exact: true })).toHaveCount(0);
    await expect(rail.getByTestId("rail-browse-gallery")).toBeVisible();
    await expect(rail.getByTestId("rail-browse-bounties")).toBeVisible();

    await rail.getByTestId("rail-browse-gallery").click();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("shows shimmer rows for trending rather than the word Loading", async ({ page }) => {
    await withTheme(page, "exhibition");
    await page.setViewportSize({ width: 1440, height: 900 });
    // Hold every read open, so loading is the state on screen.
    await page.route(REST, () => {});
    await page.goto("/");
    await expect(page.getByTestId("rail-trending-skeleton")).toBeVisible();
    await expect(page.locator(".fs-right")).not.toContainText("Loading");
  });

  test("hides trending entirely when it comes back empty", async ({ page }) => {
    await open(page, "/", "exhibition");
    // A heading over a sentence saying there is nothing under it is two lines
    // spent saying less than no lines would.
    await expect(page.locator(".fs-right")).not.toContainText("Trending");
  });

  test("keeps everything inside the rail's 276px content width", async ({ page }) => {
    await open(page, "/", "exhibition");
    const over = await page.evaluate(() => {
      const rail = document.querySelector(".fs-right")!;
      const box = rail.getBoundingClientRect();
      const inner = box.width - 24;
      return [...rail.querySelectorAll("*")]
        .filter((el) => el.getBoundingClientRect().width > inner + 1)
        .map((el) => el.tagName);
    });
    expect(over).toEqual([]);
  });
});
