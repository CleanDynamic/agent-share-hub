// RC-P12 — the open bounties board, in a real browser.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and the visitor is anonymous. The board's three requests a page
// are answered from fixtures: the asks (a first page of twenty-one, so there
// is a next page, and a short second page), their solutions and their makers.

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
    builds: {
      id: `b${n}`,
      slug: `build-${n}`,
      title: `Build number ${n}`,
      made_with: n % 2 === 0 ? ["Claude"] : ["n8n"],
      creator_id: `u${n % 4}`,
    },
    build_nodes: n % 3 === 0 ? null : { title: `Gap in build ${n}` },
  };
}

const FIRST_PAGE = Array.from({ length: 21 }, (_, n) => ask(n + 1));
const SECOND_PAGE = [ask(22), ask(23), ask(24)];
const MAKERS = [0, 1, 2, 3].map((n) => ({
  id: `u${n}`,
  username: `maker${n}`,
  display_name: `Maker ${n}`,
  avatar_url: null,
}));

interface Backend {
  boardRequests: Request[];
}

async function fakeBackend(page: Page, { empty = false } = {}): Promise<Backend> {
  const backend: Backend = { boardRequests: [] };

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
  await page.route(/\/rest\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route(/\/rest\/v1\/solutions\?/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "s1", bounty_id: FIRST_PAGE[0].id }]),
    }),
  );
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MAKERS) }),
  );
  await page.route(/\/rest\/v1\/bounties\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    // The facets: the asks' made_with arrays.
    if (url.includes("!inner(made_with)")) {
      const rows = empty ? [] : [...FIRST_PAGE, ...SECOND_PAGE];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows.map((row) => ({ id: row.id, builds: row.builds }))),
      });
    }
    backend.boardRequests.push(route.request());
    const narrowed = url.includes("builds.made_with=ov.");
    let rows = empty ? [] : url.includes("created_at=lt.") ? SECOND_PAGE : FIRST_PAGE;
    if (narrowed) rows = rows.filter((row) => ((row.builds as Row).made_with as string[]).includes("Claude"));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
  });

  return backend;
}

const rows = (page: Page) => page.getByTestId("bounty-row");

test("a page of the board shows each ask's reward, ask, build and maker", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/bounties");

  await expect(rows(page)).toHaveCount(20);
  const second = rows(page).nth(1);
  await expect(second.getByTestId("bounty-reward")).toHaveText("£75");
  await expect(second.getByTestId("bounty-ask")).toHaveText("Gap in build 2");
  await expect(second).toContainText("on Build number 2 · by Maker 2");
});

test("an ask with no reward says so", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/bounties");

  await expect(rows(page).first().getByTestId("bounty-reward")).toHaveText("No reward");
});

test("Show more adds the next page under the first", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/bounties");
  await expect(rows(page)).toHaveCount(20);

  await page.getByTestId("bounties-show-more").click();

  await expect(rows(page)).toHaveCount(23);
  await expect(rows(page).nth(20).getByTestId("bounty-ask")).toHaveText("Gap in build 22");
  expect(decodeURIComponent(backend.boardRequests.at(-1)!.url())).toContain("created_at=lt.");
  await expect(page.getByTestId("bounties-show-more")).toHaveCount(0);
});

test("choosing a Made with option narrows the board", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/bounties");
  await expect(rows(page)).toHaveCount(20);

  const trigger = page.getByTestId("gallery-filters-trigger");
  const scope = (await trigger.isVisible()) ? (await trigger.click(), page.getByRole("dialog", { name: "Filters" })) : page;
  await scope.getByTestId("facet-made-with-Claude").click();

  await expect(page).toHaveURL(/\/bounties\?with=Claude$/);
  await expect(rows(page)).toHaveCount(10);
  expect(decodeURIComponent(backend.boardRequests.at(-1)!.url())).toContain("builds.made_with=ov.");
});

test("an empty board says so in one sentence, with one action", async ({ page }) => {
  await fakeBackend(page, { empty: true });
  await page.goto("/bounties");

  const empty = page.getByTestId("bounties-empty");
  await expect(empty).toContainText("No open bounties right now.");
  await expect(empty.getByRole("link")).toHaveCount(1);
  await expect(empty.getByRole("link", { name: "Browse the gallery" })).toHaveAttribute("href", "/gallery");
});

test("Open the build goes to the build's page", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/bounties");

  await rows(page).nth(2).getByRole("link", { name: "Open the build" }).click();
  await expect(page).toHaveURL(/\/b2\/build-3$/);
});

test("at 390 the board does not scroll sideways", async ({ page }) => {
  await fakeBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/bounties");
  await expect(rows(page)).toHaveCount(20);

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
