// RC-P17 — comments on a build and on its parts, in a real browser, at the
// desktop and the phone project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. The build has
// four parts; build_comments answers the page of comments (a reply and a
// comment on part 3 among them), the part counts, and a POST with the row it
// was sent. Nothing reaches the network.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { ME, withSession } from "../audit/support/harness";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BUILD_ID = id(1);
const MAKER = id(900);
const SLUG = "invoice-reader";
const PART_3 = id(503);

const BUILD: Row = {
  id: BUILD_ID,
  creator_id: MAKER,
  slug: SLUG,
  title: "Invoice reader that files the totals",
  outcome: "Reads a folder of invoices and files each total in the right month.",
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

const TITLES = ["Open the folder", "Read each page", "Parse the invoice", "File the total"];
const NODES: Row[] = TITLES.map((title, index) => ({
  id: id(501 + index),
  build_id: BUILD_ID,
  parent_id: null,
  position: index,
  type: "prompt",
  title,
  note: null,
  payload: { text: "Read the page and say what the total is." },
  source_ref: null,
  event_id: null,
  is_gap: false,
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
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
];

const author = (who: string, name: string) => ({ id: who, username: name.toLowerCase(), display_name: name, avatar_url: null });

const COMMENTS: Row[] = [
  {
    id: id(701),
    build_id: BUILD_ID,
    node_id: null,
    parent_id: null,
    author_id: id(801),
    body: "Ran it on a year of invoices.\nTwo of them came out in the wrong month.",
    is_hidden: false,
    created_at: "2026-09-20T09:00:00.000Z",
    edited_at: null,
    author: author(id(801), "Rae"),
  },
  {
    id: id(702),
    build_id: BUILD_ID,
    node_id: PART_3,
    parent_id: null,
    author_id: id(802),
    body: "This step reads the total twice on a two-page invoice.",
    is_hidden: false,
    created_at: "2026-09-21T09:00:00.000Z",
    edited_at: null,
    author: author(id(802), "Sam"),
  },
  {
    id: id(703),
    build_id: BUILD_ID,
    node_id: null,
    parent_id: id(701),
    author_id: ME.id,
    body: "Same here: the ones dated on the 31st.",
    is_hidden: false,
    created_at: "2026-09-22T09:00:00.000Z",
    edited_at: null,
    author: author(ME.id, "Audit"),
  },
];

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown[], status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

interface Backend {
  /** Every POST to build_comments, as sent. */
  posts: Request[];
  /** Every GET on build_comments, the list and the part counts. */
  reads: Request[];
}

async function fakeBackend(page: Page, { signedIn }: { signedIn: boolean }): Promise<Backend> {
  const backend: Backend = { posts: [], reads: [] };
  if (signedIn) await withSession(page);

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) =>
    signedIn && route.request().url().includes("/user")
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: ME.id, aud: "authenticated" }) })
      : route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }),
  );
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/node_types/, (route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_nodes/, (route) => json(route, NODES));
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("like_count")) return json(route, [{ id: BUILD_ID, like_count: 4, comment_count: 3 }]);
    if (url.includes("parent_build_id=eq.") || url.includes("limit=3")) return json(route, []);
    return json(route, [BUILD]);
  });
  await page.route(/\/rest\/v1\/build_comments/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      backend.posts.push(request);
      const sent = request.postDataJSON() as Row;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: id(799),
          is_hidden: false,
          created_at: new Date().toISOString(),
          edited_at: null,
          ...sent,
          author: author(ME.id, "Audit"),
        }),
      });
    }
    backend.reads.push(request);
    const url = decodeURIComponent(request.url());
    if (url.includes("select=node_id")) {
      return json(
        route,
        COMMENTS.filter((row) => row.node_id).map((row) => ({ node_id: row.node_id })),
      );
    }
    return json(route, COMMENTS);
  });

  return backend;
}

async function openBuild(page: Page, hash = "") {
  await page.goto(`/b2/${SLUG}${hash}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

const comments = (page: Page) => page.getByTestId("comments");

test("posting a comment adds it to the list and raises the header's count", async ({ page }) => {
  const backend = await fakeBackend(page, { signedIn: true });
  await openBuild(page, "#comments");

  const header = page.getByTestId("engagement-row");
  await expect(header.getByRole("button", { name: "Comment", exact: true })).toContainText("3");
  await expect(comments(page).getByTestId("comment")).toHaveCount(3);

  await comments(page).getByLabel("Add a comment").fill("Works on scanned invoices too.");
  await comments(page).getByRole("button", { name: "Post", exact: true }).click();

  await expect(comments(page).getByTestId("comment")).toHaveCount(4);
  await expect(comments(page).getByTestId("comment").last()).toContainText("Works on scanned invoices too.");
  await expect(header.getByRole("button", { name: "Comment", exact: true })).toContainText("4");
  expect(backend.posts).toHaveLength(1);
  expect(backend.posts[0].postDataJSON()).toMatchObject({
    build_id: BUILD_ID,
    author_id: ME.id,
    body: "Works on scanned invoices too.",
    node_id: null,
    parent_id: null,
  });
});

test("commenting on part 3 attaches it, shows the chip and sends its node id", async ({ page }) => {
  const backend = await fakeBackend(page, { signedIn: true });
  await openBuild(page);

  await page.getByRole("button", { name: "Comment on this part" }).nth(2).click();

  const composer = comments(page).getByTestId("comments-composer");
  await expect(composer.getByTestId("comments-attached-part")).toHaveText("on part 3 · Parse the invoice");
  await expect(composer.getByLabel("Add a comment")).toBeFocused();

  await composer.getByLabel("Add a comment").fill("The total is read twice here.");
  await composer.getByRole("button", { name: "Post", exact: true }).click();

  await expect.poll(() => backend.posts.length).toBe(1);
  expect(backend.posts[0].postDataJSON()).toMatchObject({ node_id: PART_3, body: "The total is read twice here." });
  await expect(composer.getByTestId("comments-attached-part")).toHaveCount(0);
});

test("a part's marker shows how many comments it has", async ({ page }) => {
  await fakeBackend(page, { signedIn: false });
  await openBuild(page, "#comments");
  await expect(comments(page).getByTestId("comment")).toHaveCount(3);

  const markers = page.getByRole("button", { name: "Comment on this part" });
  await expect(markers).toHaveCount(4);
  await expect(markers.nth(2)).toHaveText("1");
  await expect(markers.nth(0)).toHaveText("");
});

test("the list and the part counts cost two requests together, near the section", async ({ page }) => {
  const backend = await fakeBackend(page, { signedIn: false });
  await openBuild(page, "#comments");
  await expect(comments(page).getByTestId("comment")).toHaveCount(3);

  expect(backend.reads).toHaveLength(2);
});

test("/b2/<slug>#comments brings the section into view with its box focused", async ({ page }) => {
  await fakeBackend(page, { signedIn: true });
  await openBuild(page, "#comments");

  await expect(comments(page).getByLabel("Add a comment")).toBeFocused();
  await expect(comments(page)).toBeInViewport();
});

test("a signed-out reader sees the comments and a way to sign in, not a box", async ({ page }) => {
  await fakeBackend(page, { signedIn: false });
  await openBuild(page, "#comments");

  await expect(comments(page).getByTestId("comment")).toHaveCount(3);
  await expect(comments(page).getByRole("link", { name: "Sign in to comment" })).toBeVisible();
  await expect(comments(page).getByLabel("Add a comment")).toHaveCount(0);
});

test("at 390 the page does not scroll sideways, comments and all", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeBackend(page, { signedIn: true });
  await openBuild(page, "#comments");
  await expect(comments(page).getByTestId("comment")).toHaveCount(3);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
