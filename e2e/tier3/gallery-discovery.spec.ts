// RC-P10 — the Gallery as the discovery home, in a real browser.
//
// The lens row, the query and the two empty states, at the desktop and the
// phone project. THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/,
// /storage/v1/ and /functions/v1/ are answered here, the realtime socket and
// the font CDN are silenced, and the visitor is anonymous. What is asserted is
// what a reader sees and what the page asks the database for; nothing reaches
// the network.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";

type Row = Record<string, unknown>;

function build(n: number): Row {
  return {
    id: `00000000-0000-4000-8000-00000000010${n}`,
    creator_id: "00000000-0000-4000-8000-0000000000aa",
    slug: `build-${n}`,
    title: `Discovery build ${n}`,
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
    rebuild_count: n % 2,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    build_nodes: [],
    build_media: [],
    bounties: [],
  };
}

const BUILDS = [1, 2, 3].map(build);

const FACETS = {
  roles: [{ value: "lawyer", count: 3, label: null, logo_url: null }],
  tools: [{ value: "Claude", count: 3, label: "Claude", logo_url: null }],
};

interface Backend {
  /** The gallery's builds list requests, in order. */
  buildRequests: Request[];
}

/**
 * The whole backend. Playwright matches the LAST registered route first, so
 * the catch-alls are registered before the specific handlers.
 */
async function fakeBackend(
  page: Page,
  { rows = BUILDS, searchHits = [] as string[] } = {},
): Promise<Backend> {
  const backend: Backend = { buildRequests: [] };

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }),
  );
  await page.route(/\/storage\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route(/\/functions\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route(/\/rest\/v1\//, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": "*/0" },
      body: "[]",
    }),
  );
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FACETS) }),
  );
  await page.route(/\/rest\/v1\/rpc\/search_build_ids/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(searchHits.map((build_id) => ({ build_id }))),
    }),
  );
  await page.route(/\/rest\/v1\/builds/, (route) => {
    // The gallery's own list, not the cards' like and comment counts (RC-P16),
    // which read builds too once the list has landed.
    if (!decodeURIComponent(route.request().url()).includes("like_count")) {
      backend.buildRequests.push(route.request());
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
      body: JSON.stringify(rows),
    });
  });

  return backend;
}

const lens = (page: Page, name: string) =>
  page.getByRole("radiogroup", { name: "Lens" }).getByRole("radio", { name });

test("/gallery?lens=proven checks Proven and asks only for fresh reproduced builds", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/gallery?lens=proven");

  await expect(lens(page, "Proven")).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => backend.buildRequests.length).toBeGreaterThan(0);
  const url = decodeURIComponent(backend.buildRequests.at(-1)!.url());
  expect(url).toContain("reproduction_count=gte.1");
  expect(url).toMatch(/last_confirmed_at=gte\.\d{4}-\d{2}-\d{2}T/);
});

test("clicking Rebuilt writes lens=rebuilt into the address", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/gallery");
  await expect(lens(page, "All")).toHaveAttribute("aria-checked", "true");

  await lens(page, "Rebuilt").click();

  await expect(page).toHaveURL(/\/gallery\?lens=rebuilt$/);
  await expect(lens(page, "Rebuilt")).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(() => backend.buildRequests.some((request) => request.url().includes("rebuild_count=gte.1")))
    .toBe(true);
});

test("/gallery?q=zzzz says no builds match, with one Clear filters", async ({ page }) => {
  await fakeBackend(page, { searchHits: [] });
  await page.goto("/gallery?q=zzzz");

  await expect(page.getByText("No builds match that.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Clear filters" })).toHaveCount(1);
});

test("an empty gallery says nothing has been shown here yet", async ({ page }) => {
  await fakeBackend(page, { rows: [] });
  await page.goto("/gallery");

  await expect(page.getByText("Nothing has been shown here yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Show what you built" })).toHaveCount(1);
});

test("/gallery?focus=search focuses the gallery's field and drops the parameter", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/gallery?focus=search");

  await expect(page.getByRole("searchbox", { name: "Search the gallery" })).toBeFocused();
  await expect(page).toHaveURL(/\/gallery$/);
});

test("at 390 the lens row wraps rather than scrolling sideways", async ({ page }) => {
  await fakeBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery");

  const row = page.getByRole("radiogroup", { name: "Lens" });
  await expect(row.getByRole("radio")).toHaveCount(4);
  const overflow = await row.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const pageOverflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(pageOverflows).toBe(false);
});
