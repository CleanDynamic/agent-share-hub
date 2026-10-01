// Tier 3 — BG-P15, the three routes that moved inside the application frame.
//
// WHAT CHANGED, AND SO WHAT THIS FILE GUARDS. /gallery, /b2/:slug and /import
// used to render as sibling routes OUTSIDE `<Route element={<Layout />}>`. They
// had no left rail, no right rail, no wordmark and no mobile chrome; each one
// carried its own full-bleed frame and a "← buildgallery" text link that stood
// in for the whole application. BG-P15 moved all three inside and listed them
// in src/components/shell/wideRoutes.ts, so they render in the frame's wide
// mode. This file is the regression that says they are still in there.
//
// WHY THERE WAS NOTHING TO UPDATE. BG-P15's brief says these specs "will assert
// against the old bespoke headers and back links". They did not exist: e2e/
// held tier3/ and fixtures/ only, with no gallery, build-page or import spec,
// and the four tier-3 specs that do visit /b2/:slug only navigate to it and
// follow `a[href^="/b2/"]` links — not one of them touches a bespoke header or
// a back link, so not one of them needed changing. This file is new, and it is
// the coverage that sentence assumed was already here.
//
// ONE FILE, THREE ROUTES, because the thing under test is ONE change and the
// assertions are the same four questions asked three times: is the frame
// around it, is it wide, is there no right rail (RC-P06 removed it from every
// route), and is the back link gone. Three near-identical files would drift
// apart.
//
// IT NEEDS NO AUTH AND NO SEEDED DATA, which is deliberate and is what makes it
// runnable anywhere. RC-P06 added the empty fake backend below: the spec used
// to leave its requests to whatever project .env names, and CONTRACT §7 says a
// tier-3 spec never points at the live project. Every claim here is about the FRAME around the page, and
// the frame renders before the page's queries resolve — a /b2/:slug for a slug
// that does not exist still renders the rails, which is exactly the assertion.
// A spec that needed a seeded build to prove the left rail exists would go red
// when nobody seeded the database, and a red suite that means "nobody seeded
// the database" trains a maintainer to ignore red.
//
// SELECTORS. Any right-hand slot is an `<aside>`, the `complementary` role —
// since RC-P06 only the legacy editor's workspace on /upload/blueprint renders
// one — and the layout mode is the `data-layout` attribute FlatShell puts on
// its root — both are role/attribute selectors, per the e2e skill. The left rail is matched on
// `.fs-left` because at mobile widths MobileBottomNav also renders a
// `<nav aria-label="Primary">`, so the accessible name alone cannot tell the
// desktop rail from the phone bar. `.fs-*` are FlatShell's own frame classes,
// not the `.ns-*` classes the skill forbids, and BG-P14's tier-1 spec already
// measures the frame through them.

import { expect, test, type Page, type Route } from "@playwright/test";

const THEMES = ["noon", "dusk"] as const;

/** The widths BG-P15's acceptance names. */
const DESKTOP_WIDE = 1400;
const SWEEP = [390, 768, 1024, 1400];

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

/** An empty, signed-out backend, as in e2e/audit/rc-baseline.spec.ts. */
async function stubBackend(page: Page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.route(/\/rest\/v1\//, (route) => {
    const headers = { "content-range": "*/0", "access-control-expose-headers": "content-range" };
    if (route.request().method() === "HEAD") return route.fulfill({ status: 200, headers, body: "" });
    return route.fulfill({
      status: 200,
      contentType: wantsObject(route) ? "application/vnd.pgrst.object+json" : "application/json",
      headers,
      body: wantsObject(route) ? "null" : "[]",
    });
  });
  await page.route(/\/auth\/v1\//, (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ msg: "no session" }) }),
  );
  await page.route(/\/storage\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route(/\/functions\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* deliberately silent: no broker is contacted */
  });
}

test.beforeEach(async ({ page }) => {
  await stubBackend(page);
});

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* private window — the default theme is a fine ground for a structural assertion */
    }
  }, theme);
}

/** True when anything on the page reaches past the viewport horizontally. */
const overflowsX = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );

/**
 * Every route BG-P15 moved.
 *
 * `path` is a real URL in each case. The build page's slug need not exist: see
 * the note above on why this file asserts the frame and not the page.
 *
 * RC-P06 took the right rail off all three, including the build page, which
 * was the one that had asked for it; the per-route rail answer is gone.
 */
const MOVED = [
  { name: "the gallery", path: "/gallery" },
  { name: "the build page", path: "/b2/does-not-need-to-exist" },
  { name: "the import page", path: "/import" },
] as const;

for (const route of MOVED) {
  test.describe(`BG-P15 — ${route.name} inside the frame`, () => {
    test("renders the application frame in wide mode, with no right rail", async ({ page }) => {
      await page.setViewportSize({ width: DESKTOP_WIDE, height: 900 });
      await page.goto(route.path);

      // The left rail — the thing these routes did not have before.
      await expect(page.locator(".fs-left")).toBeVisible();
      // ...carrying the wordmark that the deleted back link stood in for.
      await expect(page.locator(".fs-logo")).toHaveText("buildgallery");

      // Wide, and from the route table rather than from the page.
      await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", "wide");

      // RC-P06: no right-hand slot on any of them.
      await expect(page.getByRole("complementary")).toHaveCount(0);
    });

    test("has no '← buildgallery' back link left on it", async ({ page }) => {
      await page.setViewportSize({ width: DESKTOP_WIDE, height: 900 });
      await page.goto(route.path);
      await expect(page.locator(".fs-left")).toBeVisible();

      // The exact string the three deleted headers used. Matched anywhere on
      // the page, not just in a header, so a link that merely moved is caught.
      await expect(page.getByText("← buildgallery")).toHaveCount(0);
    });

    for (const theme of THEMES) {
      test(`does not overflow horizontally in ${theme}`, async ({ page }) => {
        await withTheme(page, theme);
        for (const width of SWEEP) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(route.path);
          await expect(page.locator("[data-layout]")).toBeVisible();
          expect(
            await overflowsX(page),
            `${route.path} overflows at ${width}px in ${theme}`
          ).toBe(false);
        }
      });
    }

    test("keeps the frame but drops the rails at phone width", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route.path);

      // Below 768 the rails are gone and the mobile chrome is mounted — which
      // these three routes are getting for the first time.
      await expect(page.locator(".fs-left")).toBeHidden();
      await expect(page.getByRole("complementary")).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    });
  });
}

test.describe("BG-P15 — the build page's rail, at the width it used to be traded away", () => {
  /**
   * The build page was the one route that asked for the rail, and the one that
   * gave it back below 1280. RC-P06 removed it, so this is rewritten to assert
   * it on both sides of that old cut-off: absent at either width.
   */
  test("has no right rail above 1280 or below it", async ({ page }) => {
    const rail = page.getByRole("complementary");

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.goto("/b2/does-not-need-to-exist");
    await expect(page.locator(".fs-left")).toBeVisible();
    await expect(rail).toHaveCount(0);

    await page.setViewportSize({ width: 1240, height: 900 });
    await expect(rail).toHaveCount(0);
  });
});

test.describe("BG-P15 — the moved pages' own content survived the move", () => {
  /**
   * The move was supposed to take each page's outer frame and nothing else.
   * One assertion per page that the content underneath is still there, so a
   * future edit to the wrapper cannot quietly take the page with it.
   */
  test("the gallery still leads with its PageHeader and its filters", async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDE, height: 900 });
    await page.goto("/gallery");

    await expect(page.getByRole("heading", { name: "Builds worth running", level: 1 })).toBeVisible();
    await expect(page.getByText("GALLERY", { exact: true })).toBeVisible();
    /* The facets stayed a sibling under the header rather than moving into
       PageHeader's actions slot — see the note in Gallery.tsx.

       BG-P19 RENAMED THE SLOT from `gallery-filters` to `gallery-facets` and
       took the panel away with it: the filters are a band on the page's ground
       now, not a glass card. The CLAIM this test makes is unchanged and is
       still the one BG-P15 cared about — the facets are under the header, on
       the page, not in the header's corner — so the selector moves and the
       assertion does not. */
    await expect(page.locator('[data-visual-slot="gallery-facets"]')).toBeVisible();
  });

  test("the import page still leads with its heading and its drop target", async ({ page }) => {
    await page.setViewportSize({ width: DESKTOP_WIDE, height: 900 });
    await page.goto("/import");

    await expect(
      page.getByRole("heading", { name: "Post a build without writing it up.", level: 1 })
    ).toBeVisible();
    await expect(page.getByTestId("import-drop")).toBeVisible();
  });

  test("the import page's drop target is usable at 390px with the bottom bar up", async ({ page }) => {
    // BG-P15's acceptance asks for exactly this: the bottom nav is new on this
    // route, and a drop target underneath it would be a regression nobody sees
    // until they try to publish from a phone.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/import");

    const drop = page.getByTestId("import-drop");
    await drop.scrollIntoViewIfNeeded();
    await expect(drop).toBeVisible();

    // Not merely visible — nothing is painted over its centre.
    const covered = await drop.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !(el.contains(top) || top?.contains(el));
    });
    expect(covered, "the mobile bottom bar is covering the drop target").toBe(false);

    // And the input behind it still takes a file. Asserted on the file's own
    // name rather than on the "Reading" status word: the word appears twice
    // once the intake mounts — as the step label and again inside its
    // sentence — and the name proves more anyway, that THIS file reached the
    // intake rather than that some state was entered.
    //
    // RC-P06: on the name wherever the intake shows it, not on the reading
    // state's heading. That heading lasts only while the node-type registry is
    // loading; this file is not a Build File, so once the registry answers the
    // intake refuses it, in an alert that names it. The assertion used to pass
    // because the live backend it reached never answered in time; against the
    // fake backend above it answers at once.
    await page.getByTestId("import-file-input").setInputFiles({
      name: "valid.neoscale.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# A build\n\nOutcome: it works.\n"),
    });
    await expect(page.getByText("valid.neoscale.md", { exact: true })).toBeVisible();
  });
});
