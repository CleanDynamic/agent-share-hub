// RC-P21 — the profile on builds, in a real browser, at the desktop and the
// phone project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. profiles
// answers the maker and the reader, rpc/maker_stats the four figures (and is
// counted), builds the tabs' cards, solutions the solved gaps. Nothing reaches
// the network.

import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, THEM, withSession } from "../audit/support/harness";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const TITLES = ["Invoice reader that files the totals", "Inbox triage agent", "Meeting notes to tasks"];

function card(n: number, creator: string, extra: Row = {}): Row {
  return {
    id: id(n),
    creator_id: creator,
    slug: `build-${n}`,
    title: TITLES[(n - 1) % TITLES.length],
    outcome: "Does a thing, and says how well it did it.",
    shape: "workflow",
    status: "published",
    made_for: ["founder"],
    made_with: ["Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 92,
    reproduction_count: 10 - n,
    last_confirmed_at: "2026-09-26T00:00:00.000Z",
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: "2026-08-01T00:00:00.000Z",
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    build_nodes: [],
    build_media: [],
    bounties: [],
    ...extra,
  };
}

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown[], status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

function profileRow(who: typeof ME | typeof THEM): Row {
  return {
    id: who.id,
    username: who.username,
    display_name: who.display_name,
    avatar_url: null,
    banner_url: null,
    bio: null,
    website_url: null,
    location: null,
    follower_count: 12,
    following_count: 3,
    created_at: "2026-01-10T00:00:00.000Z",
    is_verified: false,
    level: "reader",
    derived_bio: null,
    last_derived_at: null,
    is_private: false,
    is_trusted_solver: false,
    is_admin: false,
  };
}

interface Backend {
  /** How many times the four figures were asked for. */
  makerStatsCalls: () => number;
}

async function fakeBackend(page: Page, { empty = false }: { empty?: boolean } = {}): Promise<Backend> {
  let makerStats = 0;
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
  await page.route(/\/rest\/v1\/rpc\/maker_stats/, (route) => {
    makerStats += 1;
    const body = empty
      ? [{ builds: 0, reproductions_received: 0, rebuilds_of_their_work: 0, gaps_solved: 0 }]
      : [{ builds: 3, reproductions_received: 1204, rebuilds_of_their_work: 7, gaps_solved: 2 }];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.route(/\/rest\/v1\/profiles\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    const rows = [profileRow(ME), profileRow(THEM)];
    if (url.includes(`id=eq.${ME.id}`)) return json(route, [rows[0]]);
    if (url.includes(`username=ilike.${THEM.username}`)) return json(route, [rows[1]]);
    if (url.includes(`username=ilike.${ME.username}`)) return json(route, [rows[0]]);
    return json(route, rows);
  });
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("like_count")) return json(route, [1, 2, 3].map((n) => ({ id: id(n), like_count: 2, comment_count: 1 })));
    if (empty) return json(route, []);
    const creator = url.match(/creator_id=eq\.([^&]+)/)?.[1] ?? THEM.id;
    const ids = url.match(/[?&]id=in\.\(([^)]*)\)/)?.[1]?.split(",");
    if (ids) return json(route, [card(9, id(900))].filter((row) => ids.includes(String(row.id))));
    if (url.includes("parent_build_id=not.is.null")) {
      return json(route, [card(2, creator, { parent_build_id: id(800), source_title_at_fork: "Original", source_handle_at_fork: "someone" })]);
    }
    return json(route, [1, 2, 3].map((n) => card(n, creator)));
  });
  await page.route(/\/rest\/v1\/solutions\?/, (route) =>
    json(route, empty ? [] : [{ id: id(700), accepted_at: "2026-09-20T10:00:00.000Z", bounty: { build_id: id(9) } }]),
  );

  return { makerStatsCalls: () => makerStats };
}

/**
 * The header's controls painted with the --action fill, measured: a probe
 * resolves var(--action) to the colour the browser computes, and every button
 * and link in the header is compared against it.
 */
async function filledInHeader(page: Page): Promise<string[]> {
  return page.getByTestId("profile-header").evaluate((header) => {
    const probe = document.createElement("span");
    probe.style.backgroundColor = "var(--action)";
    document.body.appendChild(probe);
    const action = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [...header.querySelectorAll("button, a")]
      .filter((element) => getComputedStyle(element).backgroundColor === action)
      .map((element) => (element.textContent ?? "").trim());
  });
}

const tabRow = (page: Page) => page.getByTestId("profile-tab-row");
const figures = (page: Page) => page.getByTestId("maker-figure");

/** The row's choices, in order: its tabs, then any link beside them. */
async function rowChoices(page: Page): Promise<string[]> {
  await expect(tabRow(page).getByRole("tab").first()).toBeVisible();
  return tabRow(page)
    .locator('[role="tab"], a')
    .evaluateAll((elements) => elements.map((element) => (element.textContent ?? "").trim()));
}

test("your own profile offers four tabs: Builds, Rebuilds, Solutions and Drafts", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/profile");

  expect(await rowChoices(page)).toEqual(["Builds", "Rebuilds", "Solutions", "Drafts"]);
  await expect(tabRow(page).getByRole("link", { name: "Drafts" })).toHaveAttribute("href", "/drafts");
});

test("someone else's profile offers three tabs: Builds, Rebuilds and Solutions", async ({ page }) => {
  await fakeBackend(page);
  await page.goto(`/profile/${THEM.username}`);

  expect(await rowChoices(page)).toEqual(["Builds", "Rebuilds", "Solutions"]);
});

test("the four figures come from one maker_stats request", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto(`/profile/${THEM.username}`);

  await expect(figures(page)).toHaveCount(4);
  await expect(page.getByTestId("maker-figure-value")).toHaveText(["3", "1,204", "7", "2"]);
  await expect(figures(page)).toContainText(["builds", "got working by others", "rebuilt by others", "gaps solved"]);
  // The tabs' cards have landed, so every request the page makes on load has been made.
  await expect(page.getByTestId("profile-card")).toHaveCount(3);
  expect(backend.makerStatsCalls()).toBe(1);
});

test("each tab shows the gallery's cards for its builds", async ({ page }) => {
  await fakeBackend(page);
  await page.goto(`/profile/${THEM.username}`);

  await expect(page.getByTestId("profile-card").locator('[data-visual-slot="gallery-card"]')).toHaveCount(3);
  await tabRow(page).getByRole("tab", { name: "Rebuilds" }).click();
  await expect(page).toHaveURL(/[?&]tab=rebuilds/);
  await expect(page.getByTestId("profile-card")).toHaveCount(1);
  await tabRow(page).getByRole("tab", { name: "Solutions" }).click();
  await expect(page.getByTestId("profile-card")).toHaveCount(1);
  await expect(page.getByTestId("profile-card")).toContainText(TITLES[2]);
});

test("the header holds exactly one filled button: Follow on someone else's profile", async ({ page }) => {
  await fakeBackend(page);
  await page.goto(`/profile/${THEM.username}`);

  const header = page.getByTestId("profile-header");
  await expect(header.getByRole("button", { name: "Follow", exact: true })).toBeVisible();
  expect(await filledInHeader(page)).toEqual(["Follow"]);
  await expect(header.locator('[data-visual-slot="btn-primary"]')).toHaveText(["Follow"]);
});

test("the header holds exactly one filled button: Edit profile on your own", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/profile");

  const header = page.getByTestId("profile-header");
  await expect(header.getByRole("button", { name: "Edit profile" })).toBeVisible();
  expect(await filledInHeader(page)).toEqual(["Edit profile"]);
  await expect(header.locator('[data-visual-slot="btn-primary"]')).toHaveText(["Edit profile"]);
});

test("your own empty profile says so in each tab, with a way on", async ({ page }) => {
  await fakeBackend(page, { empty: true });
  await page.goto("/profile");

  const builds = page.getByTestId("profile-empty-builds");
  await expect(builds).toContainText("You haven't published a build yet.");
  await expect(builds.getByRole("link", { name: "New build" })).toHaveAttribute("href", "/compose/new");

  await tabRow(page).getByRole("tab", { name: "Rebuilds" }).click();
  await expect(page.getByTestId("profile-empty-rebuilds")).toHaveText("No rebuilds yet.");

  await tabRow(page).getByRole("tab", { name: "Solutions" }).click();
  const solutions = page.getByTestId("profile-empty-solutions");
  await expect(solutions).toContainText("No solved gaps yet.");
  await expect(solutions.getByRole("link", { name: "See open bounties" })).toHaveAttribute("href", "/bounties");
});

test("someone else's empty profile says so, and offers no action", async ({ page }) => {
  await fakeBackend(page, { empty: true });
  await page.goto(`/profile/${THEM.username}`);

  const builds = page.getByTestId("profile-empty-builds");
  await expect(builds).toHaveText("Nothing published yet.");
  await expect(builds.getByRole("link")).toHaveCount(0);
  await expect(builds.getByRole("button")).toHaveCount(0);

  await tabRow(page).getByRole("tab", { name: "Solutions" }).click();
  const solutions = page.getByTestId("profile-empty-solutions");
  await expect(solutions).toHaveText("No solved gaps yet.");
  await expect(solutions.getByRole("link")).toHaveCount(0);
});

test("at 390 the figures sit two by two and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeBackend(page);
  await page.goto(`/profile/${THEM.username}`);

  await expect(page.getByTestId("maker-figure-value")).toHaveCount(4);
  const boxes = await figures(page).evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: Math.round(box.left), y: Math.round(box.top) };
    }),
  );
  // Two rows of two: the first two share a top edge, the last two share a
  // lower one, and each column shares a left edge.
  expect(boxes[0].y).toBe(boxes[1].y);
  expect(boxes[2].y).toBe(boxes[3].y);
  expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
  expect(boxes[0].x).toBe(boxes[2].x);
  expect(boxes[1].x).toBe(boxes[3].x);
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x);

  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
