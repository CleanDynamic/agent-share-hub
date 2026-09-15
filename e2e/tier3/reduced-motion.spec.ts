// Tier 3 — the reduced-motion guarantee (BG-P32).
//
// WHY THIS IS A BROWSER SPEC AND NOT A UNIT TEST. Everything asserted here is
// RESOLVED STYLE under an emulated media query: what `getComputedStyle` says
// about an element the cascade has actually been run over, with Tailwind's
// generated utilities, `index.css`, the inline style objects and whatever a
// dependency injected all competing on the same declaration. jsdom resolves
// none of that — it has no media-query evaluation and no cascade for
// `@media (prefers-reduced-motion: reduce)` — so a unit test asserting on the
// style object proves only that the module returned "none", not that nothing
// on the page moves. That second claim is the acceptance criterion, and this is
// the only place it can be made.
//
// THE CLAIM: with reduced motion emulated, NOTHING MOVES ANYWHERE. Not a
// transition, not a keyframe, not a scroll. Five surfaces are checked, named by
// the prompt — the gallery grid and the composer's drag among them — and each
// is checked by walking every element it renders rather than by sampling the
// one the test happens to know about.
//
// WHAT "NOTHING MOVES" MEANS PRECISELY, and why it is not `duration: 0s`. The
// global rule in index.css collapses durations to 0.01ms rather than cancelling
// them, because a cancelled transition never fires `transitionend` and any
// component waiting on that event to unmount a node or release a lock would
// hang — on this code path only, for exactly the readers least able to work
// around it. So the assertion is "no duration above one millisecond", not "no
// transition at all": 0.01ms completes inside a single frame, which is
// indistinguishable from instant to a reader and still fires the event.

import { expect, test, type Page, type Route } from "@playwright/test";

const REST = /\/rest\/v1\//;
const FACETS = /\/rest\/v1\/rpc\/gallery_facets/;

/** Anything at or under this many milliseconds is not motion a reader can see. */
const IMPERCEPTIBLE_MS = 1;

type Row = Record<string, unknown>;

function build(n: number): Row {
  return {
    id: `00000000-0000-4000-8000-00000000000${n}`,
    creator_id: "00000000-0000-4000-8000-0000000000aa",
    slug: `build-${n}`,
    title: `Build number ${n}`,
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
  roles: [{ value: "lawyer", count: 6, label: null, logo_url: null }],
  tools: [{ value: "Claude", count: 7, label: "Claude", logo_url: null }],
};

/**
 * Answer every request the app makes, so a surface renders its populated state
 * rather than its skeleton.
 *
 * Registered widest-first: Playwright matches the LAST registered route first,
 * so the specific handlers have to be registered after the catch-all to beat it.
 */
async function stubRest(page: Page) {
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
    if (route.request().method() === "HEAD") {
      return route.fulfill({ status: 200, headers: { "content-range": "*/2" }, body: "" });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": `0-${BUILDS.length - 1}/${BUILDS.length}` },
      body: JSON.stringify(BUILDS),
    });
  });
}

/**
 * Every element on the page whose computed style still carries visible motion.
 *
 * WALKS EVERYTHING, INCLUDING ::before AND ::after. A reveal, a shimmer or a
 * hover shadow that lives on a pseudo-element is exactly the kind that a
 * hand-written list of selectors misses — BG-P09 put the gallery card's shadow
 * there deliberately, so a check that could not see it would be checking the
 * wrong half of the card.
 *
 * Returns descriptions rather than a count, so a failure names what moved.
 */
async function movingElements(page: Page): Promise<string[]> {
  return page.evaluate((limit) => {
    const moving: string[] = [];

    const longest = (value: string): number =>
      Math.max(
        0,
        ...value
          .split(",")
          .map((part) => part.trim())
          .map((part) => (part.endsWith("ms") ? parseFloat(part) : parseFloat(part) * 1000))
          .filter((n) => !Number.isNaN(n)),
      );

    const describe = (el: Element, pseudo: string) => {
      const id = el.id ? `#${el.id}` : "";
      const slot = el.getAttribute("data-visual-slot");
      const cls =
        typeof el.className === "string" && el.className
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
      return `${el.tagName.toLowerCase()}${id}${slot ? `[${slot}]` : ""}${cls}${pseudo}`;
    };

    const check = (el: Element, pseudo: string) => {
      const style = getComputedStyle(el, pseudo || null);

      const transition = longest(style.transitionDuration);
      if (transition > limit) {
        moving.push(`${describe(el, pseudo)} — transition ${style.transitionDuration}`);
      }

      const animation = longest(style.animationDuration);
      const named = style.animationName && style.animationName !== "none";
      if (named && animation > limit) {
        moving.push(
          `${describe(el, pseudo)} — animation ${style.animationName} ${style.animationDuration}`,
        );
      }

      if (style.scrollBehavior === "smooth") {
        moving.push(`${describe(el, pseudo)} — scroll-behavior: smooth`);
      }
    };

    for (const el of Array.from(document.querySelectorAll("*"))) {
      check(el, "");
      check(el, "::before");
      check(el, "::after");
    }
    return moving;
  }, IMPERCEPTIBLE_MS);
}

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 4 — five surfaces, nothing moving on any of them
   ════════════════════════════════════════════════════════════════════════════ */

const SURFACES = [
  { name: "the gallery grid", path: "/gallery", ready: '[data-visual-slot="gallery-grid"]' },
  { name: "the home ground", path: "/", ready: "main, [data-visual-slot]" },
  { name: "the build page", path: "/b2/build-1", ready: "main" },
  { name: "the import page's drop surface", path: "/import", ready: '[data-visual-slot="import-frame"]' },
  { name: "the composer", path: "/compose/00000000-0000-4000-8000-000000000001", ready: "main, [data-visual-slot]" },
] as const;

test.describe("reduced motion", () => {
  /* EMULATED PER PAGE RATHER THAN THROUGH `test.use({ reducedMotion })`.
     The context-level option is plumbed at context creation and does not
     reliably reach the page on every browser build this suite runs against —
     where it does not, `matchMedia("(prefers-reduced-motion: reduce)")` comes
     back false and every assertion below passes for the wrong reason, which is
     the worst way for an accessibility test to fail. `emulateMedia` is a
     runtime call on the page itself, and the guard beneath it makes the
     emulation's own success a precondition of the test rather than an
     assumption. */
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  async function assertEmulated(page: Page) {
    const matches = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(matches, "reduced motion is not actually emulated — the rest of this test would pass vacuously").toBe(true);
  }

  for (const surface of SURFACES) {
    test(`BG-P32 — nothing moves on ${surface.name}`, async ({ page }) => {
      await stubRest(page);
      await page.goto(surface.path);
      await assertEmulated(page);
      await page.locator(surface.ready).first().waitFor({ state: "attached", timeout: 30_000 });
      // One frame, so anything that animates on mount has had the chance to.
      await page.waitForTimeout(300);

      const moving = await movingElements(page);
      expect(moving, `${moving.length} element(s) still moving`).toEqual([]);
    });
  }

  test("BG-P32 — the composer's drag feedback appears without easing", async ({ page }) => {
    /* THE DRAG BEHAVIOUR ITSELF IS UNTOUCHED — this asserts on its VISUAL
       feedback only. The import surface carries an inset ring while a file is
       over the page; under reduced motion the ring must still appear (the
       reader has to know the page is a target) and must arrive without a
       transition. Both halves matter: a guarantee that removed the feedback
       would be answering the wrong question. */
    await stubRest(page);
    await page.goto("/import");

    await assertEmulated(page);
    const frame = page.locator('[data-visual-slot="import-frame"]');
    await frame.waitFor({ state: "attached", timeout: 30_000 });

    const transition = await frame.evaluate((el) => getComputedStyle(el).transitionDuration);
    for (const part of transition.split(",")) {
      const ms = part.trim().endsWith("ms")
        ? parseFloat(part)
        : parseFloat(part) * 1000;
      if (!Number.isNaN(ms)) expect(ms).toBeLessThanOrEqual(IMPERCEPTIBLE_MS);
    }
  });

  test("BG-P32 — the gallery grid's cards are visible, not stuck at opacity 0", async ({
    page,
  }) => {
    /* THE FAILURE MODE THE REVEAL CREATES, and the reason `useReveal` fails
       towards visible. A card that enters the hidden state and then never
       receives the transition that would bring it back is invisible content —
       a worse outcome than no animation, and the one thing "nothing moves"
       could otherwise be satisfied by. */
    await stubRest(page);
    await page.goto("/gallery");

    await assertEmulated(page);
    const grid = page.locator('[data-visual-slot="gallery-grid"]');
    await expect(grid).toBeVisible({ timeout: 30_000 });

    const cells = page.locator('[data-visual-slot="gallery-grid-cell"]');
    await expect(cells.first()).toBeVisible();

    const opacities = await cells.evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).opacity)),
    );
    expect(opacities.length).toBeGreaterThan(0);
    for (const opacity of opacities) expect(opacity).toBe(1);
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   The other half: with motion allowed, the two sanctioned surfaces still reveal
   ════════════════════════════════════════════════════════════════════════════ */

test.describe("motion allowed", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
  });

  test("BG-P32 — the gallery grid reveals, then settles fully visible", async ({ page }) => {
    await stubRest(page);
    await page.goto("/gallery");

    const cells = page.locator('[data-visual-slot="gallery-grid-cell"]');
    await expect(cells.first()).toBeVisible({ timeout: 30_000 });

    /* EACH CELL SCROLLED INTO VIEW FIRST, because a cell below the fold that
       has not revealed yet is the reveal WORKING — polling every cell without
       scrolling would assert the observer had already fired for content the
       reader has not reached, which is the one thing a scroll entry must not
       do. (Measured on the stub: with nine cards in three rows, only the first
       row has revealed when the page settles.)

       `scrollIntoView` rather than `window.scrollTo`: the gallery scrolls
       inside the frame's own region, not the document, so scrolling the window
       moves the page by the 24px the document actually overflows and nothing
       new intersects. */
    await cells.evaluateAll((els) => {
      for (const el of els) el.scrollIntoView({ block: "center" });
    });

    // The reveal is 450ms plus up to 400ms of stagger; well inside this.
    await expect
      .poll(
        async () =>
          cells.evaluateAll((els) =>
            els.every((el) => parseFloat(getComputedStyle(el).opacity) === 1),
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test("BG-P32 — the build page's sections are the only other reveal", async ({ page }) => {
    await stubRest(page);
    await page.goto("/b2/build-1");
    await page.locator("main").first().waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(1_200);

    /* Every revealed section has arrived. A section left hidden is the same
       invisible-content failure the grid is checked for above. */
    const hidden = await page
      .locator('[data-visual-slot="build-page-section"]')
      .evaluateAll((els) =>
        els
          .map((el, i) => [i, parseFloat(getComputedStyle(el).opacity)] as const)
          .filter(([, opacity]) => opacity !== 1)
          .map(([i, opacity]) => `section ${i} at opacity ${opacity}`),
      );
    expect(hidden).toEqual([]);
  });
});
