// Tier 3 — RC-P05, the old discovery addresses land on the Gallery.
//
// WHAT THIS GUARDS. The old product had six ways into discovery, each of them a
// duplicate of the Gallery. RC-P05 removed them as destinations and kept them
// as addresses: a bookmark, a shared link or an old tab lands on /gallery,
// and /search carries its words across as /gallery?q=. The unit tests beside
// the nav prove what the navigation offers; this proves what the old
// addresses do in a real browser, and that /bounties — the new third home —
// renders.
//
// BOTH PROJECTS. The mobile project runs this file as well as tier 1
// (playwright.config.ts), because below 768px the app mounts different chrome
// around the same routes.
//
// NOTHING REACHES THE NETWORK. /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here with an empty, signed-out backend, as in
// e2e/audit/rc-baseline.spec.ts; the realtime socket and the font CDN are
// stubbed too.
//
// SELECTORS ARE ROLES AND NAMES: the Gallery's page heading, and the Bounties
// page's; and one exact text, "Discover", which must not be there.

import { expect, test, type Page, type Route } from "@playwright/test";

/** A cold dev server compiles each lazy page on first visit. */
const PAGE_READY_MS = 45_000;

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

/** An empty database: every read answers no rows and every count answers zero. */
function noRows(route: Route) {
  const headers = { "content-range": "*/0", "access-control-expose-headers": "content-range" };
  if (route.request().method() === "HEAD") {
    return route.fulfill({ status: 200, headers, body: "" });
  }
  return route.fulfill({
    status: 200,
    contentType: wantsObject(route) ? "application/vnd.pgrst.object+json" : "application/json",
    headers,
    body: wantsObject(route) ? "null" : "[]",
  });
}

async function stubBackend(page: Page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.route(/\/rest\/v1\//, noRows);
  // Signed out: there is no session, so anything that asks the auth server is refused.
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

/** The Gallery, as a reader sees it: its address and its page heading. */
async function expectGallery(page: Page, url: RegExp) {
  await expect(page).toHaveURL(url, { timeout: PAGE_READY_MS });
  await expect(page.getByRole("heading", { level: 1, name: "Builds worth running" })).toBeVisible({
    timeout: PAGE_READY_MS,
  });
}

test.beforeEach(async ({ page }) => {
  await stubBackend(page);
});

for (const path of ["/browse", "/discover", "/discover-legacy", "/recent", "/fyp", "/category/anything"]) {
  test(`${path} lands on the gallery`, async ({ page }) => {
    await page.goto(path);
    await expectGallery(page, /\/gallery$/);
  });
}

// RC-P09c. The address survives; the word does not. On the phone the top bar
// over the Gallery read "Discover" until this pass.
test("the gallery an old /discover link lands on is never titled Discover", async ({ page }) => {
  await page.goto("/discover");
  await expectGallery(page, /\/gallery$/);
  await expect(page.getByText("Discover", { exact: true })).toHaveCount(0);
});

test("/search?q=claude lands on the gallery with the query", async ({ page }) => {
  await page.goto("/search?q=claude");
  await expectGallery(page, /\/gallery\?q=claude$/);
});

test("/search with no query lands on the gallery", async ({ page }) => {
  await page.goto("/search");
  await expectGallery(page, /\/gallery$/);
});

test("/bounties shows the Bounties heading", async ({ page }) => {
  await page.goto("/bounties");
  await expect(page.getByRole("heading", { level: 1, name: "Bounties" })).toBeVisible({
    timeout: PAGE_READY_MS,
  });
});
