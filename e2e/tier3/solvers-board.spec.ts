// RC-P13 — the solvers board, in a real browser.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and the visitor is anonymous. The board's two requests are
// answered from fixtures: the ranking (rpc/top_solvers) and the names
// (profiles, by id).

import { expect, test, type Page, type Request } from "@playwright/test";

type Row = Record<string, unknown>;

/** The ranking, as top_solvers returns it: most solved first. */
const RANKING: Row[] = [
  { user_id: "u1", solved: 12, reward_total: 1250, last_solved_at: "2026-09-20T12:00:00.000Z" },
  { user_id: "u2", solved: 9, reward_total: "480.50", last_solved_at: "2026-09-19T12:00:00.000Z" },
  { user_id: "u3", solved: 7, reward_total: null, last_solved_at: "2026-09-18T12:00:00.000Z" },
];

/** The names, deliberately not in the ranking's order. */
const PEOPLE: Row[] = [
  { id: "u3", username: "dev", display_name: "Dev Rao", avatar_url: null },
  { id: "u1", username: "sam", display_name: "Sam Ilori", avatar_url: null },
  { id: "u2", username: "maya", display_name: "Maya Okafor", avatar_url: null },
];

interface Backend {
  rankingRequests: Request[];
  nameRequests: Request[];
}

async function fakeBackend(page: Page, { empty = false } = {}): Promise<Backend> {
  const backend: Backend = { rankingRequests: [], nameRequests: [] };

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
  /* Everything else the frame or the bounties board asks for: nothing. */
  await page.route(/\/rest\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route(/\/rest\/v1\/rpc\/top_solvers/, (route) => {
    backend.rankingRequests.push(route.request());
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(empty ? [] : RANKING),
    });
  });
  await page.route(/\/rest\/v1\/profiles\?/, (route) => {
    backend.nameRequests.push(route.request());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PEOPLE) });
  });

  return backend;
}

const rows = (page: Page) => page.getByTestId("solver-row");

test("the board lists solvers most solved first, numbered from 1, in two requests", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/bounties/solvers");

  await expect(page.getByRole("heading", { level: 1, name: "Solvers" })).toBeVisible();
  await expect(page.getByText("People whose solutions were accepted. Most solved first.")).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(page.getByTestId("solver-position")).toHaveText(["1", "2", "3"]);
  await expect(page.getByTestId("solver-maker")).toHaveText([/Sam Ilori/, /Maya Okafor/, /Dev Rao/]);
  await expect(page.getByTestId("solver-solved")).toHaveText(["12 solved", "9 solved", "7 solved"]);

  /* A total only where the solver's bounties named rewards. */
  await expect(rows(page).nth(0).getByTestId("solver-reward")).toHaveText("£1,250 in rewards");
  await expect(rows(page).nth(1).getByTestId("solver-reward")).toHaveText("£480.50 in rewards");
  await expect(rows(page).nth(2).getByTestId("solver-reward")).toHaveCount(0);

  expect(backend.rankingRequests).toHaveLength(1);
  expect(backend.nameRequests).toHaveLength(1);
  expect(JSON.parse(backend.rankingRequests[0].postData() ?? "{}")).toEqual({ max_results: 25 });
});

test("a solver's name opens their profile", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/bounties/solvers");

  await rows(page).nth(1).getByRole("link", { name: /Maya Okafor/ }).click();
  await expect(page).toHaveURL(/\/profile\/maya$/);
});

test("an empty board says so in one sentence, with one way to the open bounties", async ({ page }) => {
  await fakeBackend(page, { empty: true });
  await page.goto("/bounties/solvers");

  const empty = page.getByTestId("solvers-empty");
  await expect(empty).toContainText("Nobody has solved a bounty yet.");
  await expect(empty.getByRole("link")).toHaveCount(1);
  await expect(empty.getByRole("link", { name: "See open bounties" })).toHaveAttribute("href", "/bounties");
  await expect(rows(page)).toHaveCount(0);
});

test("an old leaderboard address lands on the solvers board", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/b/anything/leaderboard");

  await expect(page).toHaveURL(/\/bounties\/solvers$/);
  await expect(page.getByRole("heading", { level: 1, name: "Solvers" })).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
});

test("the Solvers link on the bounties board opens the solvers board", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/bounties");
  await expect(page.getByRole("heading", { level: 1, name: "Bounties" })).toBeVisible();

  await page.getByRole("link", { name: "Solvers", exact: true }).click();

  await expect(page).toHaveURL(/\/bounties\/solvers$/);
  await expect(page.getByRole("heading", { level: 1, name: "Solvers" })).toBeVisible();
});

test("at 390 the board does not scroll sideways", async ({ page }) => {
  await fakeBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bounties/solvers");
  await expect(rows(page)).toHaveCount(3);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
