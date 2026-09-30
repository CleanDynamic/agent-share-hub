// RC-P23 — analytics on builds, in a real browser, at the desktop and the
// phone project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in maker is a session put in storage. builds answers
// the maker's published builds, rpc/maker_build_metrics their runs and asks,
// rpc/maker_stats the four figures; every other table answers empty.

import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, withSession } from "../audit/support/harness";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** Four builds: one healthy, one stale, one failing, one with solutions waiting. */
const BUILDS = [
  { n: 1, title: "Invoice reader that files the totals", reproduction_count: 12, last_confirmed_at: ago(3), published_at: ago(60) },
  { n: 2, title: "Inbox triage agent", reproduction_count: 4, last_confirmed_at: ago(200), published_at: ago(300) },
  { n: 3, title: "Meeting notes to tasks", reproduction_count: 1, last_confirmed_at: ago(45), published_at: ago(90) },
  { n: 4, title: "Contract clause finder", reproduction_count: 0, last_confirmed_at: null, published_at: ago(10) },
].map((b) => ({
  id: id(b.n),
  slug: `build-${b.n}`,
  title: b.title,
  reproduction_count: b.reproduction_count,
  last_confirmed_at: b.last_confirmed_at,
  last_confirmed_model: b.last_confirmed_at ? "claude-sonnet-4-5" : null,
  published_at: b.published_at,
  rebuild_count: b.n === 1 ? 3 : 0,
  like_count: 10 * b.n,
  comment_count: b.n,
  save_count: 2 * b.n,
}));

const METRICS = [
  { build_id: id(1), runs: 13, worked: 12, failed_last_30_days: 0, open_bounties: 1, solutions_waiting: 0 },
  { build_id: id(2), runs: 4, worked: 4, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0 },
  { build_id: id(3), runs: 3, worked: 1, failed_last_30_days: 2, open_bounties: 0, solutions_waiting: 0 },
  { build_id: id(4), runs: 0, worked: 0, failed_last_30_days: 0, open_bounties: 2, solutions_waiting: 3 },
];

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown) {
  const list = Array.isArray(rows) ? rows : [rows];
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(list.length - 1, 0)}/${list.length}` },
    body: wantsObject(route) ? JSON.stringify(list[0] ?? null) : JSON.stringify(rows),
  });
}

interface Backend {
  /** The requests the build numbers cost: the builds read and the two functions. */
  statsRequests: () => string[];
}

async function fakeBackend(page: Page, { empty = false }: { empty?: boolean } = {}): Promise<Backend> {
  const stats: string[] = [];
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
  await page.route(/\/rest\/v1\/rpc\/get_visible_surfaces/, (route) =>
    json(route, { tabs: ["overview", "trophies", "history"], quest: false, daily_nudge: false, next_unlock: false, eligibility_notice: false }),
  );
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    json(route, [{ id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: false, is_creator: true }]),
  );
  await page.route(/\/rest\/v1\/rpc\/maker_stats/, (route) => {
    stats.push(route.request().url());
    return json(route, [
      empty
        ? { builds: 0, reproductions_received: 0, rebuilds_of_their_work: 0, gaps_solved: 0 }
        : { builds: 4, reproductions_received: 17, rebuilds_of_their_work: 3, gaps_solved: 1 },
    ]);
  });
  await page.route(/\/rest\/v1\/rpc\/maker_build_metrics/, (route) => {
    stats.push(route.request().url());
    return json(route, empty ? [] : METRICS);
  });
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("save_count")) {
      stats.push(route.request().url());
      return json(route, empty ? [] : BUILDS);
    }
    return json(route, []);
  });

  return { statsRequests: () => [...stats] };
}

const table = (page: Page) => page.getByTestId("build-stats-table");

test("the builds table has the eight columns, in order", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/analytics");

  await expect(table(page).getByRole("columnheader")).toHaveText([
    "Build",
    "Got working",
    "Last confirmed",
    "Rebuilds",
    "Likes",
    "Comments",
    "Saves",
    "Open bounties",
  ]);
  await expect(page.getByTestId("build-stats-row")).toHaveCount(4);
  await expect(page.getByTestId("build-stats-order")).toHaveText("Most got working first, then the most recently confirmed.");
});

test("the build numbers cost three requests", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/analytics");

  await expect(page.getByTestId("build-stats-row")).toHaveCount(4);
  await expect(page.getByTestId("maker-figure-value")).toHaveText(["4", "17", "3", "1"]);
  expect(backend.statsRequests()).toHaveLength(3);
});

test("needs you names the three reasons, one line per build", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/analytics");

  const lines = page.getByTestId("needs-you-line");
  await expect(lines).toHaveCount(3);
  await expect(lines.nth(0)).toContainText("Contract clause finder");
  await expect(lines.nth(0)).toContainText("3 solutions waiting");
  await expect(lines.nth(1)).toContainText("a recent run did not work");
  await expect(lines.nth(2)).toContainText("not confirmed since");
});

test("with no published build, the page says so and offers New build", async ({ page }) => {
  await fakeBackend(page, { empty: true });
  await page.goto("/analytics");

  const empty = page.getByTestId("build-stats-empty");
  await expect(empty).toContainText("Publish a build and its numbers show up here.");
  await expect(empty.getByRole("link", { name: "New build" })).toHaveAttribute("href", "/compose/new");
  await expect(page.getByTestId("needs-you")).toHaveCount(0);
});

test("at 390 the page does not scroll sideways, and the table scrolls inside its wrapper", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeBackend(page);
  await page.goto("/analytics");

  await expect(page.getByTestId("build-stats-row")).toHaveCount(4);
  const body = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(body).toBeLessThanOrEqual(0);

  const wrapper = page.getByTestId("build-stats-scroll");
  const inside = await wrapper.evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(inside).toBeGreaterThan(0);
  await wrapper.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect.poll(() => wrapper.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});
