// RC-P12, redrawn by SV-14: the open requests on OpenBuilds, in a real browser.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and the visitor is anonymous. A page of step requests takes two
// rounds: the asks (a first page of twenty-one, so there is a next page, and a
// short second page), then their solutions, makers and steps strips.

import { expect, test, type Page, type Request } from "@playwright/test";

type Row = Record<string, unknown>;

const EPOCH = Date.parse("2026-09-20T12:00:00.000Z");

function ask(n: number): Row {
  return {
    id: `bb000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    build_id: `b${n}`,
    gap_node_id: n % 3 === 0 ? null : `n${n}`,
    legacy_item_id: null,
    author_id: `u${n % 4}`,
    status: "open",
    reward_gbp: n % 5 === 1 ? null : 25 * (n + 1),
    closes_at: null,
    is_meta: false,
    meta_parent_id: null,
    accepted_solution_id: null,
    me_too_count: 0,
    created_at: new Date(EPOCH - n * 3_600_000).toISOString(),
    solved_at: null,
    builds: { id: `b${n}`, slug: `build-${n}`, title: `Build number ${n}`, creator_id: `u${n % 4}` },
    build_nodes: n % 3 === 0 ? null : { title: `Gap in build ${n}` },
  };
}

const FIRST_PAGE = Array.from({ length: 21 }, (_, n) => ask(n + 1));
const SECOND_PAGE = [ask(22), ask(23), ask(24)];
const MAKERS = [0, 1, 2, 3].map((n) => ({ id: `u${n}`, username: `maker${n}`, avatar_url: null }));
/** Build 2's steps: three prompts with its gap second. */
const STEPS = [
  { id: "s1", build_id: "b2", parent_id: null, type: "prompt", title: "Take the question", position: 1, is_gap: false, tested: null, setup: null, step: null, gap_problem: null },
  { id: "n2", build_id: "b2", parent_id: null, type: "prompt", title: "Gap in build 2", position: 2, is_gap: true, tested: null, setup: null, step: null, gap_problem: "Stops on the first paywall." },
  { id: "s3", build_id: "b2", parent_id: null, type: "prompt", title: "Write the brief", position: 3, is_gap: false, tested: null, setup: null, step: null, gap_problem: null },
];

const json = (body: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function fakeBackend(page: Page, { empty = false } = {}): Promise<{ boardRequests: Request[] }> {
  const backend = { boardRequests: [] as Request[] };

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }));
  await page.route(/\/storage\/v1\//, (route) => route.fulfill(json([])));
  await page.route(/\/functions\/v1\//, (route) => route.fulfill(json({})));
  await page.route(/\/rest\/v1\//, (route) => route.fulfill(json([])));
  await page.route(/\/rest\/v1\/rpc\/top_solvers/, (route) => route.fulfill(json([])));
  await page.route(/\/rest\/v1\/solutions\?/, (route) => route.fulfill(json([{ id: "s1", bounty_id: FIRST_PAGE[0].id }])));
  await page.route(/\/rest\/v1\/profiles\?/, (route) => route.fulfill(json(MAKERS)));
  await page.route(/\/rest\/v1\/build_nodes\?/, (route) => route.fulfill(json(STEPS)));
  await page.route(/\/rest\/v1\/bounties\?/, (route) => {
    backend.boardRequests.push(route.request());
    const offset = Number(new URL(route.request().url()).searchParams.get("offset") ?? 0);
    return route.fulfill(json(empty ? [] : offset > 0 ? SECOND_PAGE : FIRST_PAGE));
  });
  return backend;
}

const requests = (page: Page) => page.getByTestId("openbuilds-request");

test("a page of requests shows each one's reward, step, build and maker", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/openbuilds");

  await expect(requests(page)).toHaveCount(20);
  const second = requests(page).nth(1);
  await expect(second.getByRole("heading")).toHaveText("Step 2 · Gap in build 2");
  await expect(second).toContainText("£75");
  await expect(second).toContainText("Build number 2 · @maker2");
  await expect(second).toContainText("Stops on the first paywall.");
  await expect(second.getByRole("listitem")).toHaveText(["1 · PromptTake the question", "2 · Prompt · openGap in build 2", "3 · PromptWrite the brief"]);
});

test("a request with no reward says so", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/openbuilds");

  await expect(requests(page).first()).toContainText("No reward");
});

test("Show more adds the next page under the first", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/openbuilds");
  await expect(requests(page)).toHaveCount(20);

  await page.getByRole("button", { name: "Show more" }).click();

  await expect(requests(page)).toHaveCount(23);
  await expect(requests(page).nth(20).getByRole("heading")).toHaveText("Gap in build 22");
  expect(new URL(backend.boardRequests.at(-1)!.url()).searchParams.get("offset")).toBe("20");
  await expect(page.getByRole("button", { name: "Show more" })).toHaveCount(0);
});

test("no requests says so in one sentence, with one action", async ({ page }) => {
  await fakeBackend(page, { empty: true });
  await page.goto("/openbuilds");

  await expect(page.getByText("No open requests right now.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse builds" })).toHaveAttribute("href", "/builds");
});

test("Answer goes to the request's solve page, and /bounties still lands here", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/bounties");
  await expect(page).toHaveURL(/\/openbuilds$/);

  await expect(requests(page).nth(2).getByRole("link", { name: "Answer" })).toHaveAttribute("href", `/openbuilds/${FIRST_PAGE[2].id}/solve`);
});

test("at 390 the page does not scroll sideways", async ({ page }) => {
  await fakeBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/openbuilds");
  await expect(requests(page)).toHaveCount(20);

  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflows).toBe(false);
});
