// RC-P28 — guilds, leaderboards and reputation are parked
// (docs/reconciliation/XP-DESIGN.md › Parked; src/lib/progress/flags.ts). In a
// real browser, at the desktop and the phone project: each feature's address,
// and an address under it, lands a signed-in reader on the progress page; the
// visit fetches no code of the parked feature and asks the database nothing
// about it; and the page it lands on, frame included, links to none of them.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. user_progress
// answers a reader at the start of level 1 who has seen the welcome; every
// other table answers empty; every request the visit makes is recorded.

import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, withSession } from "../audit/support/harness";

const PARKED = ["/guilds", "/leaderboards", "/reputation"];

/** A parked feature's code: its component folder, or the one reputation badge outside them, as the
 *  dev server serves a module or the build names a chunk. The legacy bounty SolverLeaderboard is not
 *  one of them: it ranks solvers on a legacy bounty, loads with the frame, and stays (CONTRACT §2.12). */
const PARKED_CODE = /\/src\/components\/(guilds|leaderboards|reputation)\/|reputation-badge|\/assets\/(Guild|Leaderboard|reputation|rep-)[^/]*\.js$/;

/** A question to the database about a parked feature: a guild, a leaderboard, reputation. */
const PARKED_DATA = /\/rest\/v1\/[^?]*(guild|leaderboard|reputation)/i;

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown[]) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

/** Fakes the backend and returns every URL the visit asks for, code and data alike. */
async function fakeBackend(page: Page): Promise<() => string[]> {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(request.url()));

  await withSession(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) =>
    route.request().url().includes("/user")
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: ME.id, aud: "authenticated" }) })
      : route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }),
  );
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    json(route, [{ id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: false }]),
  );
  await page.route(/\/rest\/v1\/user_progress\?/, (route) =>
    decodeURIComponent(route.request().url()).includes("xp_total")
      ? json(route, [{ xp_total: 0, level: 1 }])
      : json(route, [{ welcome_xp_shown_at: "2026-01-10T00:00:00.000Z" }]),
  );

  return () => [...asked];
}

const path = (page: Page) => new URL(page.url()).pathname;

for (const address of PARKED) {
  test(`${address} lands on the progress page`, async ({ page }) => {
    await fakeBackend(page);
    await page.goto(address);

    await expect.poll(() => path(page)).toBe("/analytics");
    await expect(page.getByTestId("progress-page")).toBeVisible();
  });
}

test("an address under a parked feature lands on the progress page too", async ({ page }) => {
  await fakeBackend(page);

  for (const address of ["/guilds/night-owls", "/leaderboards/weekly", "/reputation/maren"]) {
    await page.goto(address);
    await expect.poll(() => path(page)).toBe("/analytics");
  }
  await expect(page.getByTestId("progress-page")).toBeVisible();
});

test("landing fetches no code of a parked feature and asks the database nothing about one", async ({ page }) => {
  const asked = await fakeBackend(page);
  for (const address of PARKED) {
    await page.goto(address);
    await expect(page.getByTestId("progress-page")).toBeVisible();
  }
  await page.waitForLoadState("networkidle");

  const requests = asked().map((url) => new URL(url).pathname);
  expect(requests.filter((path) => path.includes("/rest/v1/")).length).toBeGreaterThan(0);
  expect(requests.filter((path) => PARKED_CODE.test(path) || PARKED_DATA.test(path))).toEqual([]);
});

test("the progress page and its frame link to no parked feature", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/guilds");
  await expect(page.getByTestId("progress-page")).toBeVisible();

  const links = page.locator('a[href^="/guilds"], a[href^="/leaderboards"], a[href^="/reputation"]');
  await expect(links).toHaveCount(0);
  await expect(page.getByText(/\b(guilds?|leaderboards?|reputation)\b/i)).toHaveCount(0);
});
