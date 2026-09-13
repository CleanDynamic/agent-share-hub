// Tier 3 — the repainted home feed (BG-P18).
//
// WHAT IS HERE AND WHY IT IS A BROWSER SPEC. Everything this file asserts is
// resolved layout or a scroll position: whether the tab row pushes the frame's
// centre column out at 768, whether the page scrolls sideways at four widths in
// two themes, and — the one the prompt cares most about — whether a card that
// grows when a thread unfolds moves the cards above it. jsdom has no layout
// engine and no scroller, so none of it is testable anywhere else. The unit
// tests in `BuildFeedItems.test.tsx` cover what the feed asks the card FOR;
// this covers what a browser then does with it.
//
// THE UNFOLD IS MEASURED AT /dev/kit AND NOT IN THE FEED, and that is a
// statement about the data layer rather than a convenience. `get_build_feed`
// returns one cover row per build with `post_position` null, so `postEntriesOf`
// reports no entries and every card in the Builds tab takes its documented
// fallback to the fixed slot — there is no thread in the feed to unfold yet,
// and BG-P18 is not allowed to widen that query. /dev/kit renders the same
// component in the same `layout="feed"` with a four-entry post, inside the same
// frame and the same scroll container, which is every part of the claim that
// can be checked today. The Builds tab is checked for the other half: that a
// list of forty items of unequal height neither clips nor moves under a reader.
//
// Selectors are the testids and the data attributes the components already
// emit. Nothing here selects on a class: see the selector rules in the e2e
// skill.

import { expect, test, type Page, type Route } from "@playwright/test";

const RPC = /\/rest\/v1\/rpc\/get_build_feed/;
const REST = /\/rest\/v1\//;

/** The prompt's four widths. */
const WIDTHS = [1400, 1024, 768, 390];
const THEMES = ["exhibition", "dusk"] as const;

/** How long the card's one animated moment takes, plus room to settle. */
const UNFOLD_SETTLE = 700;

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
const at = (minutesBack: number) =>
  new Date(EPOCH - minutesBack * 60_000).toISOString();

type Row = Record<string, unknown>;

/** One feed row with every column get_build_feed returns. */
function row(overrides: Row): Row {
  return {
    item_kind: "build",
    item_at: at(1),
    build_id: "00000000-0000-4000-8000-000000000001",
    slug: "a-build",
    title: "A build",
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
    ...overrides,
  };
}

/**
 * Twenty rows of deliberately unequal height: a reproduction strip is one line
 * on a recess, a bounty is a strip above a card, a build is a card. A list that
 * only ever held one shape would not exercise the thing being checked.
 */
function page1(): Row[] {
  const rows: Row[] = [
    row({
      item_kind: "repro_note",
      item_at: at(1),
      slug: "inbox-triage-agent",
      title: "Inbox triage agent",
      repro_note: "Ran it on a 300-message inbox. Held up, but the labels needed a nudge.",
      repro_model: "sonnet-4.5",
      repro_user_username: "rae",
      repro_worked: true,
    }),
    row({
      item_kind: "rebuild",
      item_at: at(2),
      build_id: "00000000-0000-4000-8000-000000000011",
      slug: "inbox-triage-for-legal",
      title: "Inbox triage, for legal",
      parent_build_id: "00000000-0000-4000-8000-000000000010",
      source_title_at_fork: "Inbox triage agent",
      source_handle_at_fork: "amara",
      rebuild_note: "Swapped the classifier prompt and added a privilege check.",
    }),
    row({
      item_kind: "bounty",
      item_at: at(3),
      build_id: "00000000-0000-4000-8000-000000000012",
      slug: "retry-loop",
      title: "Retry loop that gives up politely",
      bounty_id: "bo1",
      bounty_reward_gbp: 120,
      bounty_gap_title: "The retry prompt",
    }),
  ];
  while (rows.length < 20) {
    const n = rows.length;
    rows.push(
      row({
        item_at: at(10 + n),
        build_id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
        slug: `filler-${n}`,
        title: `Filler build ${n}`,
      }),
    );
  }
  return rows;
}

/** Twenty more, so the loaded feed reaches the forty the prompt asks for. */
function page2(): Row[] {
  return Array.from({ length: 20 }, (_, n) =>
    row({
      item_at: at(200 + n),
      build_id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`,
      slug: `page-two-${n}`,
      title: `Page two build ${n}`,
    }),
  );
}

async function stubFeed(page: Page) {
  await page.route(RPC, async (route: Route) => {
    const body = (route.request().postDataJSON() ?? {}) as { before?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body.before ? page2() : page1()),
    });
  });
}

/** True when anything on the page reaches past the viewport in either direction. */
const pageOverflows = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

/**
 * Whatever is actually scrolling.
 *
 * A page rendered inside the frame scrolls `.fs-page-body`, which is its own
 * region; a page outside it scrolls the document. /dev/kit is the second and
 * Home is the first, and the unfold has to behave the same in both, so the
 * helpers resolve the container rather than assuming one.
 */
const SCROLLER = `(document.querySelector(".fs-page-body") ?? document.scrollingElement)`;

const scrollTop = (page: Page) =>
  page.evaluate(`${SCROLLER}.scrollTop`) as Promise<number>;

const setScrollTop = (page: Page, value: number) =>
  page.evaluate(`${SCROLLER}.scrollTop = ${value}`);

/* ────────────────────────────────────────────────────────────────────────────
   1. The tab bar
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("the feed's tab bar", () => {
  test("keeps six tabs in their order and marks the active one", async ({ page }) => {
    await stubRestEmpty(page);
    await stubFeed(page);
    await page.goto("/?tab=recent");

    const tabs = page.getByTestId(/^feed-tab-/);
    await expect(tabs).toHaveCount(6);
    expect(
      await tabs.evaluateAll((nodes) => nodes.map((n) => n.textContent?.trim())),
    ).toEqual(["Builds", "For You", "Following", "Trending", "Recent", "Bounties"]);

    // The active mark is BG-P07's `data-state`, which is what carries the
    // `--action` underline and the step up to full `--text`.
    await expect(page.getByTestId("feed-tab-recent")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("feed-tab-builds")).toHaveAttribute("data-state", "inactive");
  });

  test("scrolls sideways on a phone rather than squeezing, and hides its bar", async ({ page }) => {
    await stubRestEmpty(page);
    await stubFeed(page);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/?tab=recent");
    await expect(page.getByTestId("feed-tab-builds")).toBeVisible();

    const row = page.getByTestId("feed-tab-builds").locator("xpath=..");

    // The row has more content than room: that is what makes it a scroller
    // rather than six clipped labels.
    const { clientWidth, scrollWidth, scrollbar } = await row.evaluate((el) => ({
      clientWidth: el.clientWidth,
      scrollWidth: el.scrollWidth,
      // A hidden bar takes no space, which is the only part of
      // `.scrollbar-hide` a measurement can see.
      scrollbar: el.offsetHeight - el.clientHeight,
    }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    expect(scrollbar).toBe(0);

    // And the page itself does not scroll sideways because of it.
    expect(await pageOverflows(page)).toBe(false);

    // The last tab is reachable by scrolling the row, and answers a click.
    await page.getByTestId("feed-tab-bounties").scrollIntoViewIfNeeded();
    await page.getByTestId("feed-tab-bounties").click();
    await expect(page.getByTestId("feed-tab-bounties")).toHaveAttribute("data-state", "active");
  });

  test("does not push the frame's centre column past the rails at 768", async ({ page }) => {
    // THE REGRESSION THIS EXISTS FOR. `min-width: 0` removes a flex item's
    // automatic minimum but not the bar's own min-content, which is six nowrap
    // labels — so a larger label size pushed the centre column from 456 to 580
    // and shoved the left rail off the screen. `contain: inline-size` on the
    // scroller is the fix, and this is what would catch its removal.
    await stubRestEmpty(page);
    await stubFeed(page);
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/?tab=recent");
    await expect(page.getByTestId("feed-tab-builds")).toBeVisible();

    expect(await pageOverflows(page)).toBe(false);
    const railLeft = await page
      .locator(".fs-left")
      .evaluate((el) => el.getBoundingClientRect().left);
    expect(railLeft).toBeGreaterThanOrEqual(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   2. Both themes, four widths
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("the feed at four widths, in two themes", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`renders the Builds tab at ${width}px on ${theme}`, async ({ page }) => {
        await withTheme(page, theme);
        await stubRestEmpty(page);
        await stubFeed(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?tab=builds");

        await expect(page.getByTestId("feed-builds")).toBeVisible();
        await expect(page.getByTestId("feed-item-repro").first()).toBeVisible();
        await expect(page.getByTestId("feed-item-bounty").first()).toBeVisible();

        // The feed column never overflows its own scroll region, whatever the
        // frame around it is doing. `.fs-page-body` hides overflow-x, so the
        // measurement is the content's own width against the region's.
        const centreOverflow = await page
          .locator(".fs-page-body")
          .evaluate((el) => el.scrollWidth - el.clientWidth);
        expect(centreOverflow).toBeLessThanOrEqual(1);
      });
    }
  }

  test("does not scroll the page sideways at 390, 768 or 1400", async ({ page }) => {
    // 1024 IS LEFT OUT ON PURPOSE AND IS NOT THIS PROMPT'S. In standard mode the
    // frame is 24px of padding, a 240px rail, a 24px gap, a fixed 600px centre,
    // a 24px gap, a 300px rail and 24px of padding — 1236px, which does not fit
    // 1024 and did not before BG-P18 either. The test below pins that it is the
    // frame's arithmetic rather than the feed's.
    await stubRestEmpty(page);
    await stubFeed(page);
    for (const width of [390, 768, 1400]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/?tab=builds");
      await expect(page.getByTestId("feed-builds")).toBeVisible();
      expect(await pageOverflows(page), `overflow at ${width}px`).toBe(false);
    }
  });

  test("at 1024 the overflow is the frame's fixed rails, not the feed", async ({ page }) => {
    await stubRestEmpty(page);
    await stubFeed(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/?tab=builds");
    await expect(page.getByTestId("feed-builds")).toBeVisible();

    const boxes = await page.evaluate(() => {
      const width = (sel: string) =>
        document.querySelector(sel)?.getBoundingClientRect().width ?? 0;
      return { left: width(".fs-left"), centre: width(".fs-centre"), right: width(".fs-right") };
    });
    // Three fixed widths and two gaps and two paddings, all of them the frame's,
    // add up past the viewport on their own.
    expect(boxes.left).toBe(240);
    expect(boxes.centre).toBe(600);
    expect(boxes.right).toBe(300);
    expect(boxes.left + boxes.centre + boxes.right + 24 * 4).toBeGreaterThan(1024);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   3. The three states
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("a tab with nothing to show", () => {
  test("says so, and points at the gallery", async ({ page }) => {
    await stubRestEmpty(page);
    await page.route(RPC, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    );
    await page.goto("/?tab=builds");

    const empty = page.getByTestId("feed-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("Nothing here yet");
    await expect(empty).toContainText("The gallery has more.");
    await expect(page.getByRole("button", { name: "Open the gallery" })).toBeVisible();
  });

  test("names the failure and offers a retry when the query breaks", async ({ page }) => {
    await stubRestEmpty(page);
    let calls = 0;
    await page.route(RPC, (route) => {
      calls += 1;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "permission denied for table build_media" }),
      });
    });
    await page.goto("/?tab=builds");

    // react-query retries a failed read before giving up, so the state takes a
    // few seconds to appear. That is the library's default and not this feed's.
    const error = page.getByTestId("feed-error");
    await expect(error).toBeVisible({ timeout: 30_000 });
    await expect(error).toContainText("Builds could not be loaded");
    // The data layer's own words, not a stand-in for them.
    await expect(error).toContainText("permission denied for table build_media");

    const before = calls;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.poll(() => calls, { timeout: 30_000 }).toBeGreaterThan(before);
  });

  test("shows the card's own shape while the first page is in flight", async ({ page }) => {
    await stubRestEmpty(page);
    await page.route(RPC, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      await route.abort();
    });
    await page.goto("/?tab=builds");

    // The Builds tab draws GalleryCardSkeleton, so the placeholder is the shape
    // of the thing that is coming rather than a grey rectangle.
    await expect(page.getByTestId("feed-builds-skeleton")).toBeVisible();
    await expect(
      page.locator('[data-visual-slot="gallery-card-skeleton"][data-card-layout="feed"]').first(),
    ).toBeVisible();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   4. Forty items of unequal height
   ──────────────────────────────────────────────────────────────────────────── */

test("forty loaded items neither clip nor move under the reader", async ({ page }) => {
  await stubRestEmpty(page);
  await stubFeed(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/?tab=builds");
  await expect(page.getByTestId("feed-builds")).toBeVisible();

  const items = page.getByTestId(/^feed-item-(build|rebuild|repro|bounty)$/);
  await expect(items).toHaveCount(20);

  // The three kinds are three heights, which is the case a list of one shape
  // would not exercise.
  const heights = await items.evaluateAll((nodes) =>
    nodes.slice(0, 3).map((n) => Math.round(n.getBoundingClientRect().height)),
  );
  expect(new Set(heights).size).toBeGreaterThan(1);

  // NOTHING CLIPS. A wrapper carrying a fixed height or an `overflow: hidden`
  // would cut a card off, and that is exactly what a variable-height card in a
  // feed cannot survive.
  const clipped = await items.evaluateAll((nodes) =>
    nodes.filter((n) => {
      const style = getComputedStyle(n);
      return style.overflow !== "visible" || style.height === "0px";
    }).length,
  );
  expect(clipped).toBe(0);

  // The second page lands without moving what the reader is looking at.
  await page.getByTestId("feed-scroll-sentinel").scrollIntoViewIfNeeded();
  await expect(items).toHaveCount(40);

  const anchor = items.nth(5);
  await setScrollTop(page, 1200);
  await page.waitForTimeout(200);
  const before = await anchor.evaluate((el) => el.getBoundingClientRect().top);
  await page.waitForTimeout(800);
  const after = await anchor.evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
});

/* ────────────────────────────────────────────────────────────────────────────
   5. The unfold
   ──────────────────────────────────────────────────────────────────────────── */

test.describe("a thread card that unfolds in place", () => {
  /**
   * Click without letting the harness scroll first.
   *
   * `locator.click()` scrolls its target into view before pressing, which in
   * these four tests is the harness moving the page and then the test blaming
   * the card for it. Dispatching the click on the element measures the
   * component's own behaviour and nothing else. Keyboard activation goes
   * through the same handler, so nothing about the control is left uncovered.
   */
  const press = (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((el) => (el as HTMLElement).click());

  /** The kit page's feed-layout cards are the only ones with a post today. */
  const openKit = async (page: Page) => {
    await stubRestEmpty(page);
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/dev/kit");
    await expect(page.locator("[data-thread-control]").first()).toBeVisible();
  };

  test("grows once, and moves nothing above it", async ({ page }) => {
    await openKit(page);

    const control = page.locator("[data-thread-control]").first();
    const card = control.locator('xpath=ancestor::*[@data-visual-slot="gallery-card"][1]');
    await control.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const above = page.locator('[data-visual-slot="gallery-card"]').first();
    const beforeAbove = await above.evaluate((el) => el.getBoundingClientRect().top);
    const beforeHeight = await card.evaluate((el) => el.getBoundingClientRect().height);

    await press(control);
    await page.waitForTimeout(UNFOLD_SETTLE);

    const grown = await card.evaluate((el) => el.getBoundingClientRect().height);
    expect(grown).toBeGreaterThan(beforeHeight);

    // ONCE. A card that measured its content and corrected itself afterwards
    // would settle at a second height a beat later; this one's target is
    // arithmetic on stored dimensions, so it is final the moment it arrives.
    await page.waitForTimeout(1200);
    const settled = await card.evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs(settled - grown)).toBeLessThanOrEqual(1);

    // And the card above it has not moved a pixel.
    const afterAbove = await above.evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(afterAbove - beforeAbove)).toBeLessThanOrEqual(1);
  });

  test("collapses back to its own height, leaving the scroll where it was", async ({ page }) => {
    await openKit(page);

    const control = page.locator("[data-thread-control]").first();
    const card = control.locator('xpath=ancestor::*[@data-visual-slot="gallery-card"][1]');
    await control.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const collapsedHeight = await card.evaluate((el) => el.getBoundingClientRect().height);
    const scrollBefore = await scrollTop(page);

    await press(control);
    await page.waitForTimeout(UNFOLD_SETTLE);
    await press(control);
    await page.waitForTimeout(UNFOLD_SETTLE);

    const backTo = await card.evaluate((el) => el.getBoundingClientRect().height);
    expect(Math.abs(backTo - collapsedHeight)).toBeLessThanOrEqual(1);

    // Within a few pixels: the card's own collapse only scrolls when its top has
    // gone above the viewport, which it has not here.
    expect(Math.abs((await scrollTop(page)) - scrollBefore)).toBeLessThanOrEqual(4);
  });

  test("unfolding one card leaves every other card folded", async ({ page }) => {
    await openKit(page);

    const controls = page.locator("[data-thread-control]");
    expect(await controls.count()).toBeGreaterThan(1);

    await press(controls.first());
    await page.waitForTimeout(UNFOLD_SETTLE);

    const open = await page.locator('[data-thread-region="open"]').count();
    expect(open).toBe(1);
  });

  test("puts a card's top back on screen when it collapses from above the fold", async ({ page }) => {
    await openKit(page);

    const control = page.locator("[data-thread-control]").first();
    const card = control.locator('xpath=ancestor::*[@data-visual-slot="gallery-card"][1]');
    await control.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    await press(control);
    await page.waitForTimeout(UNFOLD_SETTLE);

    // Scroll until the card's top is off the top of the scroll region, which is
    // the case a collapse would otherwise drop the reader into the middle of.
    await setScrollTop(page, (await scrollTop(page)) + 500);
    await page.waitForTimeout(200);
    expect(await card.evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(0);

    await press(control);
    await page.waitForTimeout(1400);

    expect(await card.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(-2);
  });
});
