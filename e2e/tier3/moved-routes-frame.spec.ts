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
// around it, is it wide, did the right rail go the way the route table says,
// and is the back link gone. Three near-identical files would drift apart.
//
// IT NEEDS NO AUTH AND NO SEEDED DATA, which is deliberate and is what makes it
// runnable anywhere. Every claim here is about the FRAME around the page, and
// the frame renders before the page's queries resolve — a /b2/:slug for a slug
// that does not exist still renders the rails, which is exactly the assertion.
// A spec that needed a seeded build to prove the left rail exists would go red
// when nobody seeded the database, and a red suite that means "nobody seeded
// the database" trains a maintainer to ignore red.
//
// SELECTORS. The right rail is `<aside aria-label="Explore">` and the layout
// mode is the `data-layout` attribute FlatShell puts on its root — both are
// role/attribute selectors, per the e2e skill. The left rail is matched on
// `.fs-left` because at mobile widths MobileBottomNav also renders a
// `<nav aria-label="Primary">`, so the accessible name alone cannot tell the
// desktop rail from the phone bar. `.fs-*` are FlatShell's own frame classes,
// not the `.ns-*` classes the skill forbids, and BG-P14's tier-1 spec already
// measures the frame through them.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["exhibition", "dusk"] as const;

/**
 * The widths BG-P15's acceptance names, plus 1280.
 *
 * 1280 is not decoration: it is the width at which a wide route that asked for
 * the right rail gives it back (`.fs-wide .fs-right` in flat-shell.css), so the
 * build page's rail is asserted present above it and absent below.
 */
const DESKTOP_WIDE = 1400;
const RAIL_CUTOFF = 1280;
const SWEEP = [390, 768, 1024, 1400];

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
 * Every route BG-P15 moved, with the rail answer its entry in WIDE_ROUTES
 * chose and why.
 *
 * `path` is a real URL in each case. The build page's slug need not exist: see
 * the note above on why this file asserts the frame and not the page.
 */
const MOVED = [
  {
    name: "the gallery",
    path: "/gallery",
    rightRail: false,
    /** The grid wants the rail's 300px for another column of builds. */
    why: "suppressed — the grid takes the width",
  },
  {
    name: "the build page",
    path: "/b2/does-not-need-to-exist",
    rightRail: true,
    /** A reader who has finished a build record is ready to be offered another. */
    why: "shown — Explore answers the question a finished build raises",
  },
  {
    name: "the import page",
    path: "/import",
    rightRail: false,
    /** One path through one task; the rail's job is to offer somewhere else. */
    why: "suppressed — a focused task",
  },
] as const;

for (const route of MOVED) {
  test.describe(`BG-P15 — ${route.name} inside the frame`, () => {
    test(`renders the application frame in wide mode (${route.why})`, async ({ page }) => {
      await page.setViewportSize({ width: DESKTOP_WIDE, height: 900 });
      await page.goto(route.path);

      // The left rail — the thing these routes did not have before.
      await expect(page.locator(".fs-left")).toBeVisible();
      // ...carrying the wordmark that the deleted back link stood in for.
      await expect(page.locator(".fs-logo")).toHaveText("buildgallery");

      // Wide, and from the route table rather than from the page.
      await expect(page.locator("[data-layout]")).toHaveAttribute("data-layout", "wide");

      const rail = page.getByRole("complementary", { name: "Explore" });
      if (route.rightRail) {
        await expect(rail).toBeVisible();
      } else {
        await expect(rail).toHaveCount(0);
      }
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
      await expect(page.getByRole("complementary", { name: "Explore" })).toHaveCount(0);
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    });
  });
}

test.describe("BG-P15 — the build page's rail, at the width it is traded away", () => {
  /**
   * The one route that asked for the rail is also the one that can lose it: a
   * rail plus a reading column leaves neither enough room below 1280, so
   * flat-shell.css takes it back there. Asserted from both sides because a rule
   * that fired at every width would look identical at 1400.
   */
  test("shows above 1280 and is given back below it", async ({ page }) => {
    const rail = page.getByRole("complementary", { name: "Explore" });

    await page.setViewportSize({ width: RAIL_CUTOFF + 120, height: 900 });
    await page.goto("/b2/does-not-need-to-exist");
    await expect(rail).toBeVisible();

    await page.setViewportSize({ width: RAIL_CUTOFF - 40, height: 900 });
    await expect(rail).toBeHidden();
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
    // The facet panel stayed a sibling under the header rather than moving
    // into PageHeader's actions slot — see the note in Gallery.tsx.
    await expect(page.locator('[data-visual-slot="gallery-filters"]')).toBeVisible();
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
    // name in the intake heading rather than on the "Reading" status word:
    // the word appears twice once the intake mounts — as the step label and
    // again inside its sentence — and the name proves more anyway, that THIS
    // file reached the intake rather than that some state was entered.
    await page.getByTestId("import-file-input").setInputFiles({
      name: "valid.neoscale.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# A build\n\nOutcome: it works.\n"),
    });
    await expect(
      page.getByRole("heading", { name: "valid.neoscale.md", level: 1 })
    ).toBeVisible();
  });
});
