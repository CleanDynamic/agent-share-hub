// Tier 1 — UI-P29, the Build page's first screen in the site frame.
//
// TWO HALVES, BECAUSE ONE OF THEM NEEDS DATA. The live route needs no auth and
// no data: PostgREST is answered with an empty result here (as tier 2 stubs it),
// so the record read comes back with no build whatever network the suite runs
// on, and the visitor gets the frame, the breadcrumb, one h1 — "No build at this
// address." — and a page that does not move sideways. The populated first
// screen is driven on the dev compare page, which renders `BuildView` with the
// design kit's sample data: the action dock, the tabs, the anatomy's dialog and
// "show more", and the blur budget are checked there, where the data is known.
//
// RUNS WITH THE DEV OVERRIDE. `?frame=site` forces the new frame for the browser
// session (src/lib/shell/flags.ts); the `site_frame` row stays off. The compare
// page is dev-only, like the server this suite runs against.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["noon", "dusk"] as const;
const SWEEP = [390, 768, 1024, 1280, 1440];

const LIVE = "/b2/tier1-no-such-build?frame=site";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

async function withTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((choice) => {
    try {
      window.localStorage.setItem("bg-theme", choice);
    } catch {
      /* private window: the default theme is a fine fallback for a layout check */
    }
  }, theme);
}

async function openLive(page: Page, viewport?: number, theme: (typeof THEMES)[number] = "noon") {
  await withTheme(page, theme);
  // Every PostgREST read answers "no rows": the slug names no build.
  await page.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  if (viewport) await page.setViewportSize({ width: viewport, height: 900 });
  await page.goto(LIVE);
  await expect(page.getByTestId("site-frame")).toBeVisible();
}

/** The record read settles: here, on the notice for a slug that names no build. */
async function settled(page: Page) {
  await expect(page.getByTestId("build-notice")).toBeVisible();
}

/** The sample first screen, at the board that matches the project's viewport. */
async function openSample(page: Page, theme: (typeof THEMES)[number] = "noon") {
  const viewport = isPhone(page) ? "mobile" : "desktop";
  await page.goto(`/dev/kit/pages/build?theme=${theme}&viewport=${viewport}`);
  await expect(page.getByTestId("build-view")).toBeVisible();
}

test.describe("/b2/:slug in the site frame", () => {
  test("draws the frame's chrome and the Build page inside <main>", async ({ page }) => {
    await openLive(page);
    if (isPhone(page)) {
      await expect(page.getByTestId("mobile-header")).toBeVisible();
      await expect(page.getByTestId("dock")).toBeVisible();
    } else {
      await expect(page.getByTestId("site-header")).toBeVisible();
      await expect(page.getByTestId("breadcrumb")).toContainText(/^Home\s*\/\s*Gallery\s*\//);
    }
    await expect(
      page.locator("main#main").getByTestId("build-loading").or(page.locator("main#main").getByTestId("build-view")).or(
        page.locator("main#main").getByTestId("build-notice"),
      ),
    ).toBeVisible();
  });

  test("settles on one h1, and says there is no build at an address that names none", async ({ page }) => {
    await openLive(page);
    await settled(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "No build at this address." })).toBeVisible();
    await page.getByRole("button", { name: "See the gallery" }).click();
    await expect(page).toHaveURL(/\/gallery/);
  });
});

test.describe("the first screen, with the sample build", () => {
  test("offers the four actions, with Lineage as a link to the family", async ({ page }) => {
    await openSample(page);
    const dock = page.getByRole("group", { name: "Take this build" });
    for (const name of ["Copy for AI", "Download", "Rebuild"]) await expect(dock.getByRole("button", { name })).toBeVisible();
    await expect(dock.getByRole("link", { name: "Lineage" })).toHaveAttribute("href", "/b2/invoice-triage-agent/lineage");
    if (!isPhone(page)) await expect(page.getByTestId("build-hero").getByRole("group", { name: "Take this build" })).toBeVisible();
  });

  test("puts one primary in the proof panel, and the six details under it", async ({ page }) => {
    await openSample(page);
    await expect(page.getByRole("button", { name: "I ran this and it worked" })).toBeVisible();
    for (const label of ["Made for", "Made with", "Setup", "Monthly", "First result", "Needs"]) {
      await expect(page.getByTestId("build-proof").getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("names the sections: tabs in the viewer on a desktop, a sideways row of chips on a phone", async ({ page }) => {
    await openSample(page);
    const names = ["Anatomy", "Watch it get built", "Run it yourself", "Understand it", "Where it broke"];
    if (isPhone(page)) {
      const row = page.getByRole("group", { name: "Sections of this build" });
      for (const name of names) await expect(row.getByRole("button", { name })).toHaveCount(1);
      await expect(page.getByTestId("build-viewer").getByRole("tablist")).toHaveCount(0);
    } else {
      const tabs = page.getByTestId("build-viewer").getByRole("tab");
      await expect(tabs).toHaveText(names);
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    }
  });

  test("lists the anatomy: in full on a desktop with the whole tree a press away, six parts then the rest on a phone", async ({ page }) => {
    await openSample(page);
    const rows = page.getByTestId("build-part-row");
    if (isPhone(page)) {
      await expect(rows).toHaveCount(6);
      await page.getByRole("button", { name: "Show 2 more parts" }).click();
      await expect(rows).toHaveCount(8);
    } else {
      await expect(rows).toHaveCount(8);
      await expect(rows.first()).toHaveAttribute("aria-current", "true");
      await page.getByRole("button", { name: "Show the full anatomy" }).click();
      const dialog = page.getByRole("dialog", { name: "Anatomy" });
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  });

  test("blurs only the header, the title plate and the action dock (and, on a phone, the frame's dock)", async ({ page }) => {
    await openSample(page);
    const blurred = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => {
          const filter = getComputedStyle(el).backdropFilter;
          return Boolean(filter) && filter !== "none";
        })
        .map((el) => el.getAttribute("data-testid") ?? el.getAttribute("data-ui") ?? el.tagName.toLowerCase()),
    );
    expect(blurred.sort()).toEqual(
      isPhone(page)
        ? ["build-action-dock", "dock", "hero-plate", "mobile-header"]
        : ["build-action-dock", "hero-plate", "site-header"],
    );
  });

  test("does not move sideways at its own board width", async ({ page }) => {
    await openSample(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("no horizontal scroll", () => {
  for (const theme of THEMES) {
    for (const viewport of SWEEP) {
      test(`/b2/:slug at ${viewport}px on ${theme}`, async ({ page }) => {
        await openLive(page, viewport, theme);
        await settled(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});

/* UI-P30 — every other tab's body inside the viewer, and the sections under the
   first screen. There is no board for these, so they are driven on the compare
   page with the sample build: `&tab=` draws a tab's body, `&lower=1` the
   sections under the first screen. */

const BODIES = {
  watch: "build-replay",
  run: "build-run",
  understand: "build-layer",
  broke: "build-breakage",
  rebuilds: "build-rebuilds",
} as const;

async function openSampleTab(page: Page, query: string, theme: (typeof THEMES)[number] = "noon") {
  const viewport = isPhone(page) ? "mobile" : "desktop";
  await page.goto(`/dev/kit/pages/build?theme=${theme}&viewport=${viewport}&${query}`);
  await expect(page.getByTestId("build-view")).toBeVisible();
}

test.describe("the other tabs, with the sample build (UI-P30)", () => {
  for (const theme of THEMES) {
    for (const [tab, body] of Object.entries(BODIES)) {
      test(`draws ${tab} in the viewer on ${theme}, without moving sideways`, async ({ page }) => {
        await openSampleTab(page, `tab=${tab}`, theme);
        await expect(page.getByTestId("build-viewer").getByTestId(body)).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }

  test("moves the replay with the keyboard, and plays it from the button", async ({ page }) => {
    await openSampleTab(page, "tab=watch");
    const replay = page.getByTestId("build-replay");
    await expect(replay.getByText("step 1 of 5")).toBeVisible();
    const slider = replay.getByRole("slider", { name: "Step through the build" });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await expect(replay.getByText("step 2 of 5")).toBeVisible();
    await page.keyboard.press("End");
    await expect(replay.getByText("step 5 of 5")).toBeVisible();
    await expect(replay.getByTestId("build-replay-current")).toContainText("Running on the shared inbox");
    await replay.getByRole("button", { name: "Play the build" }).click();
    await expect(replay.getByText("step 1 of 5")).toBeVisible();
    await expect(replay.getByRole("button", { name: "Pause the build" })).toBeVisible();
  });

  test("keeps the reading switch for Run, and drops it for a body that is not a reading of the part", async ({ page }) => {
    await openSampleTab(page, "tab=run");
    const viewer = page.getByTestId("build-viewer");
    await expect(viewer.getByRole("button", { name: "Run", exact: true })).toBeVisible();
    await expect(viewer.getByTestId("build-run-step")).toHaveCount(3);
    await expect(viewer.getByRole("button", { name: "Copy all steps" })).toBeVisible();

    await openSampleTab(page, "tab=broke");
    await expect(page.getByTestId("build-viewer").getByRole("button", { name: "Run", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("build-open-gap")).toContainText("£150");
    await expect(page.getByRole("button", { name: /^Solve it/ })).toBeVisible();
  });

  test("draws the rebuilds as cards, then the way to the family tree", async ({ page }) => {
    await openSampleTab(page, "tab=rebuilds");
    await expect(page.getByTestId("build-rebuild-card")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "See the family tree" })).toHaveAttribute("href", "/b2/invoice-triage-agent/lineage");
  });

  for (const theme of THEMES) {
    test(`puts where next under the first screen in glass panels on ${theme}, without moving sideways`, async ({ page }) => {
      await openSampleTab(page, "lower=1", theme);
      const lower = page.getByTestId("build-lower");
      await expect(lower.locator('[data-ui="panel"]')).toHaveCount(2);
      await expect(lower.getByRole("heading", { level: 2, name: "Rebuilds of this" })).toBeVisible();
      await expect(lower.getByTestId("where-next-card")).toHaveCount(6);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
