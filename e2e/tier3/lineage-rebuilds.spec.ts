// RC-P14 — a build's family of rebuilds, in a real browser.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and the visitor is anonymous. The build is stubbed at the REST
// boundary the way provenance-line.spec.ts stubs it; the family comes from
// rpc/rebuild_tree and its makers from one profiles read.
//
// It replaces lineage-readable.spec.ts's remix assertions: the lineage page
// draws rebuilds now, and that file keeps only what is still promised at the
// old address.

import { expect, test, type Page, type Route } from "@playwright/test";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const ROOT = id(1);
const CURRENT = id(2);
const SLUG = "inbox-triage-gmail";

/** The build being read: a rebuild of ROOT, with one rebuild of its own. */
const build: Row = {
  id: CURRENT,
  creator_id: id(900),
  slug: SLUG,
  title: "Inbox triage, Gmail only",
  outcome: "Sorts a morning's Gmail into three piles and drafts the replies for two of them.",
  shape: "workflow",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude"],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  completeness: 70,
  reproduction_count: 4,
  last_confirmed_at: null,
  last_confirmed_model: null,
  parent_build_id: ROOT,
  root_build_id: ROOT,
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  published_at: "2026-08-02T00:00:00.000Z",
  rebuild_note: "Swapped the model",
  rebuild_count: 1,
  source_title_at_fork: "Inbox triage agent",
  source_handle_at_fork: "sam",
  solves_node_id: null,
};

const NODES: Row[] = [
  {
    id: id(500),
    build_id: CURRENT,
    parent_id: null,
    position: 0,
    type: "prompt",
    title: "The classify prompt",
    note: null,
    payload: { text: "Classify this email into reply, read, or ignore." },
    source_ref: null,
    event_id: null,
    is_gap: false,
    status: "placed",
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

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

const MAKERS: Row[] = [
  { id: id(900), username: "maya", display_name: "Maya Okafor", avatar_url: null },
  { id: id(901), username: "sam", display_name: "Sam Ilori", avatar_url: null },
];

function member(n: number, parent: number | null, depth: number, title: string, over: Row = {}): Row {
  return {
    id: id(n),
    parent_build_id: parent === null ? null : id(parent),
    depth,
    slug: n === 2 ? SLUG : `build-${n}`,
    title,
    creator_id: n === 2 ? id(900) : id(901),
    published_at: `2026-08-${String(n).padStart(2, "0")}T00:00:00.000Z`,
    reproduction_count: n === 1 ? 12 : 0,
    rebuild_note: null,
    ...over,
  };
}

/** Three generations: the root, two rebuilds of it, one rebuild of the first. */
const THREE_GENERATIONS: Row[] = [
  member(1, null, 0, "Inbox triage agent"),
  member(2, 1, 1, "Inbox triage, Gmail only", { rebuild_note: "Swapped the model" }),
  member(3, 1, 1, "Inbox triage for support teams"),
  member(4, 2, 2, "Triage with a weekly digest", { rebuild_note: "Added a Friday digest" }),
];

/** A chain six generations deep: the root, then one rebuild under the last. */
const SIX_DEEP: Row[] = [
  member(1, null, 0, "Inbox triage agent"),
  member(2, 1, 1, "Inbox triage, Gmail only"),
  ...[3, 4, 5, 6, 7].map((n) =>
    member(n, n - 1, n - 1, `Generation ${n - 1}, a rebuild with a long enough title to wrap on a phone`, {
      rebuild_note: "A rebuilder's note that is far too long to fit on one line of a phone screen",
    }),
  ),
];

/** The direct rebuilds the tab already listed, in listRebuilds' shape. */
const DIRECT: Row[] = [
  {
    id: id(4),
    slug: "build-4",
    title: "Triage with a weekly digest",
    rebuild_note: "Added a Friday digest",
    created_at: "2026-08-04T00:00:00.000Z",
    forked_from_event_id: null,
    reproduction_count: 0,
    creator: { id: id(901), username: "sam", display_name: "Sam Ilori", avatar_url: null },
  },
];

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

async function fakeBackend(page: Page, { family = THREE_GENERATIONS, own = build } = {}) {
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

  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/node_types/, (route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_nodes/, (route) => json(route, NODES));
  await page.route(/\/rest\/v1\/builds/, (route) => {
    if (route.request().url().includes("parent_build_id=eq.")) return json(route, DIRECT);
    return json(route, [own]);
  });
  await page.route(/\/rest\/v1\/rpc\/rebuild_tree/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(family) }),
  );
  await page.route(/\/rest\/v1\/profiles\?/, (route) => json(route, MAKERS));
}

const rows = (page: Page) => page.getByTestId("rebuild-tree-row");

test("three generations render as three levels, in order", async ({ page }) => {
  await fakeBackend(page);
  await page.goto(`/b2/${SLUG}/lineage`);

  await expect(page.getByRole("heading", { level: 1, name: "Rebuilds of this" })).toBeVisible();
  await expect(page.getByText("Every published rebuild in this family.")).toBeVisible();
  await expect(rows(page)).toHaveCount(4);

  await expect(page.getByTestId("rebuild-tree-title")).toHaveText([
    "Inbox triage agent",
    "Inbox triage, Gmail only",
    "Triage with a weekly digest",
    "Inbox triage for support teams",
  ]);
  const depths = await rows(page).evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-depth")),
  );
  expect(depths).toEqual(["0", "1", "2", "1"]);

  /* Each generation starts further in than the one above it. */
  const edges = await page
    .getByTestId("rebuild-tree-title")
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().left));
  expect(edges[1] - edges[0]).toBeGreaterThanOrEqual(24);
  expect(edges[2] - edges[1]).toBeGreaterThanOrEqual(24);
  expect(edges[3]).toBe(edges[1]);

  /* The build being read is marked, and is the one title that is not a link. */
  const current = rows(page).nth(1);
  await expect(current.getByTestId("rebuild-tree-here").first()).toHaveText("you are here");
  await expect(page.getByRole("link", { name: "Inbox triage, Gmail only" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Triage with a weekly digest" })).toHaveAttribute(
    "href",
    "/b2/build-4",
  );
  await expect(current.getByTestId("rebuild-tree-note").first()).toHaveText("Δ Swapped the model");
});

test("a family nobody has rebuilt says so, and offers to rebuild it", async ({ page }) => {
  await fakeBackend(page, {
    own: { ...build, parent_build_id: null, root_build_id: null },
    family: [member(2, null, 0, "Inbox triage, Gmail only")],
  });
  await page.goto(`/b2/${SLUG}/lineage`);

  const empty = page.getByTestId("lineage-empty");
  await expect(empty).toContainText("No rebuilds yet.");
  await expect(empty.getByRole("link")).toHaveCount(1);
  await expect(empty.getByRole("link", { name: "Rebuild this" })).toHaveAttribute("href", `/rebuild/${SLUG}`);
  await expect(rows(page)).toHaveCount(0);
});

test("the old lineage address lands on the build's own", async ({ page }) => {
  await fakeBackend(page);
  await page.goto(`/b/${SLUG}/lineage`);

  await expect(page).toHaveURL(new RegExp(`/b2/${SLUG}/lineage$`));
  await expect(page.getByRole("heading", { level: 1, name: "Rebuilds of this" })).toBeVisible();
  await expect(rows(page)).toHaveCount(4);
});

test("the Rebuilds tab shows THE FAMILY above the direct list", async ({ page }) => {
  await fakeBackend(page);
  await page.goto(`/b2/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("tab", { name: /Rebuilds/ }).click();

  const family = page.getByTestId("rebuild-family");
  const direct = page.getByTestId("rebuilds-tab");
  await expect(family.getByRole("heading", { name: "The family" })).toBeVisible();
  await expect(family.getByTestId("rebuild-tree-row")).toHaveCount(4);
  await expect(direct.getByTestId("rebuild-row")).toHaveCount(1);

  const familyBox = await family.boundingBox();
  const directBox = await direct.boundingBox();
  expect(familyBox && directBox && familyBox.y + familyBox.height <= directBox.y).toBe(true);
});

test("at 390 a family six generations deep does not scroll sideways", async ({ page }) => {
  await fakeBackend(page, { family: SIX_DEEP });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/b2/${SLUG}/lineage`);
  await expect(rows(page)).toHaveCount(7);

  await expect(page.getByTestId("rebuild-tree-depth")).toHaveText(["depth 5", "depth 6"]);
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflows).toBe(false);
});
