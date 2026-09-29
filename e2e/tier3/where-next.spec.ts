// RC-P14b — where next, at the foot of a build page, in a real browser.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and the visitor is anonymous. The build is stubbed at the REST
// boundary the way provenance-line.spec.ts stubs it, with enough parts that its
// foot starts well below the first screen; the three where-next rows are the
// three builds requests that carry limit=3.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const BUILD_ID = id(1);
const MAKER = id(900);
const SLUG = "inbox-triage-agent";

const build: Row = {
  id: BUILD_ID,
  creator_id: MAKER,
  slug: SLUG,
  title: "Inbox triage agent that drafts the replies",
  outcome: "Sorts a morning's email into three piles and drafts the replies for two of them.",
  shape: "workflow",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude", "n8n"],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  completeness: 90,
  reproduction_count: 3,
  last_confirmed_at: null,
  last_confirmed_model: null,
  parent_build_id: null,
  root_build_id: null,
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  published_at: "2026-08-02T00:00:00.000Z",
  rebuild_note: null,
  rebuild_count: 0,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  solves_node_id: null,
};

/** Twelve parts, so the page's foot starts far below the first screen. */
const NODES: Row[] = Array.from({ length: 12 }, (_, index) => ({
  id: id(500 + index),
  build_id: BUILD_ID,
  parent_id: null,
  position: index,
  type: "prompt",
  title: `Step ${index + 1} of the triage`,
  note: null,
  payload: {
    text: "Classify this email into reply, read, or ignore, and say in one line why, so the reader can check the pile before sending anything.",
  },
  source_ref: null,
  event_id: null,
  is_gap: false,
  status: "placed",
  created_at: "2026-08-01T00:00:00.000Z",
}));

const NODE_TYPES: Row[] = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    colour: "#E8571A",
    icon: "MessageSquare",
    renderer: "instruction",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
];

/** A card's header columns, as the where-next rows select them. */
function card(n: number, over: Row = {}): Row {
  return {
    id: id(n),
    creator_id: MAKER,
    slug: `next-${n}`,
    title: `Onward build ${n}`,
    outcome: "Takes the dull half of a job and does it the same way every time.",
    shape: "workflow",
    status: "published",
    made_for: ["founder"],
    made_with: ["Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 90,
    reproduction_count: 10 - (n % 10),
    last_confirmed_at: "2026-09-20T00:00:00.000Z",
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: "2026-09-12T00:00:00.000Z",
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    ...over,
  };
}

interface Rows {
  rebuilds: Row[];
  sharedTool: Row[];
  fromMaker: Row[];
}

const FULL: Rows = {
  rebuilds: [101, 102, 103].map((n) =>
    card(n, { parent_build_id: BUILD_ID, source_title_at_fork: build.title, source_handle_at_fork: "sam" }),
  ),
  sharedTool: [201, 202, 203].map((n) => card(n)),
  fromMaker: [301, 302, 303].map((n) => card(n)),
};

const NOTHING: Rows = { rebuilds: [], sharedTool: [], fromMaker: [] };

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: Row[]) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

/** A where-next request: a builds read capped at three. */
const isWhereNext = (request: Request) =>
  /\/rest\/v1\/builds\?/.test(request.url()) && new URL(request.url()).searchParams.get("limit") === "3";

async function fakeBackend(page: Page, rows: Rows = FULL): Promise<Request[]> {
  const whereNext: Request[] = [];

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
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/node_types/, (route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_nodes/, (route) => json(route, NODES));
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const request = route.request();
    const url = decodeURIComponent(request.url());
    if (isWhereNext(request)) {
      whereNext.push(request);
      if (url.includes("parent_build_id=eq.")) return json(route, rows.rebuilds);
      if (url.includes("made_with=ov.")) return json(route, rows.sharedTool);
      if (url.includes("creator_id=eq.")) {
        return json(
          route,
          rows.fromMaker.map((row) => ({ ...row, maker: { username: "sam", display_name: "Sam Ilori" } })),
        );
      }
      return json(route, []);
    }
    if (url.includes("parent_build_id=eq.")) return json(route, []);
    return json(route, [build]);
  });

  return whereNext;
}

async function openBuild(page: Page) {
  await page.goto(`/b2/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** Scroll the reader to the foot of the page, wherever the frame scrolls. */
async function scrollToFoot(page: Page) {
  await page.getByTestId("where-next-sentinel").scrollIntoViewIfNeeded();
}

test("asks for nothing onward until the reader nears the foot, then asks three times", async ({ page }) => {
  const whereNext = await fakeBackend(page);
  await openBuild(page);
  await expect(page.getByTestId("where-next-sentinel")).toBeAttached();
  expect(whereNext).toHaveLength(0);

  await scrollToFoot(page);

  await expect(page.getByTestId("where-next")).toBeVisible();
  expect(whereNext).toHaveLength(3);
});

test("the rows come in their fixed order, at most three cards each, never this build", async ({ page }) => {
  await fakeBackend(page);
  await openBuild(page);
  await scrollToFoot(page);

  const section = page.getByTestId("where-next");
  await expect(section.getByTestId("where-next-heading")).toHaveText([
    /^Rebuilds of this$/i,
    /^More made with Claude$/i,
    /^More from Sam Ilori$/i,
  ]);
  for (const key of ["rebuilds", "made-with", "maker"]) {
    await expect(section.getByTestId(`where-next-${key}`).getByTestId("where-next-card")).toHaveCount(3);
  }
  await expect(section.locator(`a[href="/b2/${SLUG}"]`)).toHaveCount(0);
});

test("a row with nothing in it is left out", async ({ page }) => {
  await fakeBackend(page, { ...FULL, rebuilds: [] });
  await openBuild(page);
  await scrollToFoot(page);

  const section = page.getByTestId("where-next");
  await expect(section.getByTestId("where-next-heading")).toHaveText([
    /^More made with Claude$/i,
    /^More from Sam Ilori$/i,
  ]);
  await expect(section.getByTestId("where-next-rebuilds")).toHaveCount(0);
});

test("a build with nothing onward renders no section at all", async ({ page }) => {
  const whereNext = await fakeBackend(page, NOTHING);
  await openBuild(page);
  await scrollToFoot(page);

  await expect.poll(() => whereNext.length).toBe(3);
  await expect(page.getByTestId("where-next-sentinel")).toHaveCount(0);
  await expect(page.getByTestId("where-next")).toHaveCount(0);
  await expect(page.getByTestId("where-next-heading")).toHaveCount(0);
});
