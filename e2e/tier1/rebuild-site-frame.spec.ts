// Tier 1 — UI-P31, Rebuild and lineage in the site frame.
//
// TWO HALVES, AS FOR THE BUILD PAGE. The live routes need no auth and no data:
// PostgREST is answered with an empty result, so /b2/:slug/lineage settles on
// "No build at this address." in the frame, and /rebuild/:slug, which needs a
// signed-in reader to own the draft, sends a signed-out visitor to sign in and
// back — forking nothing. The populated pages are driven on the dev compare
// page with the design kit's sample: the family as a tree and as a list, the
// draft, what changed, readiness, and picking a build on the lineage page.
//
// RUNS WITH THE DEV OVERRIDE. `?frame=site` forces the new frame for the browser
// session (src/lib/shell/flags.ts); the `site_frame` row stays off.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["noon", "dusk"] as const;
const SWEEP = [390, 768, 1024, 1280, 1440];

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

async function stubPostgrest(page: Page) {
  // Every PostgREST read answers "no rows", and every RPC an empty family.
  await page.route(/\/rest\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
}

async function openSample(page: Page, name: "rebuild" | "lineage", theme: (typeof THEMES)[number] = "noon") {
  const viewport = isPhone(page) ? "mobile" : "desktop";
  await page.goto(`/dev/kit/pages/${name}?theme=${theme}&viewport=${viewport}`);
  await expect(page.getByTestId(`${name}-view`)).toBeVisible();
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("/b2/:slug/lineage in the site frame", () => {
  test("draws the frame and settles on one h1 for an address that names no build", async ({ page }) => {
    await stubPostgrest(page);
    await page.goto("/b2/tier1-no-such-build/lineage?frame=site");
    await expect(page.getByTestId("site-frame")).toBeVisible();
    await expect(page.getByTestId("rebuild-notice")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "No build at this address." })).toBeVisible();
    if (!isPhone(page)) await expect(page.getByTestId("breadcrumb")).toContainText(/Lineage$/);
  });

  for (const theme of THEMES) {
    for (const width of SWEEP) {
      test(`does not move sideways at ${width}px on ${theme}`, async ({ page }) => {
        await withTheme(page, theme);
        await stubPostgrest(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/b2/tier1-no-such-build/lineage?frame=site");
        await expect(page.getByTestId("rebuild-notice")).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(1);
      });
    }
  }
});

test.describe("/rebuild/:slug in the site frame", () => {
  test("sends a signed-out visitor to sign in and back, forking nothing", async ({ page }) => {
    await stubPostgrest(page);
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && /\/rest\/v1\//.test(request.url())) writes.push(request.url());
    });
    await page.goto("/rebuild/tier1-no-such-build?frame=site");
    await expect(page).toHaveURL(/\/login\?redirect=%2Frebuild%2Ftier1-no-such-build/);
    expect(writes).toEqual([]);
  });
});

test.describe("the rebuild page, with the sample", () => {
  test("draws the family with the draft dashed, what changed, and the decision", async ({ page }) => {
    await openSample(page, "rebuild");
    const nodes = page.getByTestId("family-node");
    await expect(nodes).toHaveCount(6);
    await expect(page.locator('[data-testid="family-node"][data-draft]')).toHaveCount(1);
    await expect(page.getByTestId("change-row")).toHaveCount(isPhone(page) ? 5 : 7);
    await expect(page.getByTestId("rebuild-credit-line")).toHaveText("Rebuilt from Invoice triage agent by @maya");
    // One thing is missing, so Publish says no, and the missing thing is the way on.
    await expect(page.getByRole("button", { name: "Publish rebuild" })).toBeDisabled();
    await expect(page.getByTestId("rebuild-next")).toHaveAttribute("href", "/compose/sample-draft?from=rebuild");
    if (isPhone(page)) {
      await expect(page.getByRole("heading", { level: 1, name: "Multi-currency triage" })).toBeVisible();
      await expect(page.getByTestId("family-list")).toBeVisible();
    } else {
      await expect(page.getByTestId("family-tree")).toBeVisible();
      await expect(page.getByRole("button", { name: "Keep as draft" })).toBeVisible();
    }
  });

  test("reads the family as a list as well as a tree (desktop)", async ({ page }) => {
    test.skip(isPhone(page), "a phone reads the family as a list only");
    await openSample(page, "rebuild");
    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.getByTestId("family-list")).toBeVisible();
    await expect(page.getByTestId("family-list").getByRole("listitem")).toHaveCount(6);
    await page.getByRole("button", { name: "Tree", exact: true }).click();
    await expect(page.getByTestId("family-tree")).toBeVisible();
  });

  for (const theme of THEMES) {
    test(`does not move sideways at its own board width on ${theme}`, async ({ page }) => {
      await openSample(page, "rebuild", theme);
      expect(await overflow(page)).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("the lineage page, with the sample", () => {
  test("asks for a pick, then shows what the picked build changed and the way to it", async ({ page }) => {
    await openSample(page, "lineage");
    const panel = page.getByTestId("changes-panel");
    await expect(panel).toContainText("Pick a build in the family to see what changed.");
    await page.getByRole("button", { name: /^Triage for NGOs/ }).click();
    await expect(page.getByTestId("change-row").first()).toBeVisible();
    await expect(panel.getByRole("link", { name: "Open Triage for NGOs" })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
  });
});
