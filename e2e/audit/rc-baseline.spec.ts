// RC-P00 — the request baseline for the reconciliation series.
//
// WHAT THIS RECORDS. How many backend requests an anonymous visitor's page makes
// before the network goes quiet: every request whose URL contains /rest/v1/
// (PostgREST tables, RPCs and HEAD counts) or /functions/v1/ (edge functions),
// on each route in ROUTES. The count is written to the test output and the only
// assertion is that it is a number. It is a measurement, not a check: later RC
// prompts re-run this spec and report the count before and after their change
// (docs/reconciliation/CONTRACT.md §8), and extend ROUTES when a prompt says so.
//
// NOTHING REACHES THE NETWORK. /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, as in e2e/tier3/waiting-imports.spec.ts; the
// realtime socket and the font CDN are stubbed the way e2e/audit/support/
// harness.ts stubs them. The database is empty, so the count is what each page
// asks for on arrival, not what a seeded page would go on to ask for.
//
// COMPARE IT ONLY WITH ITSELF. The default config serves the app from Vite's dev
// server, so the number describes this harness, not production traffic. A cold
// dev server can reload the page once while it optimises a dependency, so the
// count restarts on every main-frame navigation and describes the document that
// finally rendered.
//
// DESKTOP ONLY. The mobile project matches tier 1 alone; the skip also keeps the
// spec out of `npm run audit`, whose config has no desktop project.

import { expect, test, type Page, type Route } from "@playwright/test";

/** The routes the baseline measures, in report order. RC-P10 added the
    gallery with a query, whose empty database matches nothing. */
const ROUTES = ["/", "/gallery", "/gallery?q=agent"] as const;

/** What is counted: PostgREST and edge-function requests. */
const COUNTED = /\/rest\/v1\/|\/functions\/v1\//;

/** A cold dev server compiles the whole app on the first visit. */
const COLD_LOAD_MS = 150_000;

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
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" })
  );
  await page.route(/\/rest\/v1\//, noRows);
  // Anonymous: there is no session, so anything that asks the auth server is refused.
  await page.route(/\/auth\/v1\//, (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ msg: "no session" }) })
  );
  await page.route(/\/storage\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );
  await page.route(/\/functions\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* deliberately silent: no broker is contacted */
  });
}

// One route at a time, so the second is not measured while the first is still
// compiling on the same dev server.
test.describe.configure({ mode: "default" });

for (const path of ROUTES) {
  test(`records the backend requests an anonymous visit to ${path} makes`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "The request baseline is measured on desktop only.");
    test.setTimeout(COLD_LOAD_MS + 30_000);

    await stubBackend(page);

    let count = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        count = 0;
        return;
      }
      if (COUNTED.test(request.url())) count += 1;
    });

    await page.goto(path, { waitUntil: "networkidle", timeout: COLD_LOAD_MS });
    await page.waitForLoadState("networkidle", { timeout: COLD_LOAD_MS });

    console.log(`rc-baseline ${path} backend requests: ${count}`);
    expect(typeof count).toBe("number");
  });
}
