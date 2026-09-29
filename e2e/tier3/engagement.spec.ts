// RC-P16 — Like, Comment, Save and Share on cards and the build page, in a
// real browser, at the desktop and the phone project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. The gallery
// serves twelve builds; the engagement requests are the three the row's hook
// makes — builds' like and comment counts, build_likes and build_saves.
// Nothing reaches the network.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { ME, withSession } from "../audit/support/harness";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function galleryRow(n: number): Row {
  return {
    id: id(n),
    creator_id: id(900),
    slug: `build-${n}`,
    title: `Engagement build ${n}`,
    outcome: "Does a thing, and says how well it did it.",
    shape: "other",
    status: "published",
    made_for: ["lawyer"],
    made_with: ["Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 92,
    reproduction_count: 12,
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
  };
}

const TWELVE = Array.from({ length: 12 }, (_, index) => galleryRow(index + 1));
const FIRST = TWELVE[0];

/** The build page's own record: a gallery row with the columns the page reads. */
const PAGE_BUILD: Row = {
  ...FIRST,
  build_nodes: undefined,
  build_media: undefined,
  bounties: undefined,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  root_build_id: null,
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  solves_node_id: null,
};

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown[], status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

/** The three requests useEngagement makes, and nothing else. */
const isCounts = (request: Request) =>
  /\/rest\/v1\/builds\?/.test(request.url()) && decodeURIComponent(request.url()).includes("like_count");
const isMine = (request: Request, table: "build_likes" | "build_saves") =>
  request.method() === "GET" && new RegExp(`/rest/v1/${table}\\?`).test(request.url());
const isEngagement = (request: Request) =>
  isCounts(request) || isMine(request, "build_likes") || isMine(request, "build_saves");

interface Options {
  signedIn: boolean;
  /** Answers a like's POST; held until the test releases it when a gate is given. */
  likeWrite?: { status: number; gate?: Promise<void> };
}

async function fakeBackend(page: Page, { signedIn, likeWrite = { status: 201 } }: Options): Promise<Request[]> {
  const requests: Request[] = [];
  page.on("request", (request) => requests.push(request));
  if (signedIn) await withSession(page);

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) => {
    const url = route.request().url();
    if (url.includes("/token")) {
      // A password sign-in: the session withSession would have stored.
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "e2e.not.a-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: expiresAt,
          refresh_token: "e2e-refresh",
          user: { id: ME.id, aud: "authenticated", role: "authenticated", email: "reader@example.test" },
        }),
      });
    }
    if (signedIn && url.includes("/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: ME.id, aud: "authenticated", email: "reader@example.test" }),
      });
    }
    return route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' });
  });
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ roles: [], tools: [] }),
    }),
  );
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("like_count")) {
      return json(
        route,
        TWELVE.map((row, index) => ({ id: row.id, like_count: index === 0 ? 24 : 3, comment_count: index === 0 ? 5 : 1 })),
      );
    }
    if (url.includes(`slug=eq.${FIRST.slug}`)) return json(route, [PAGE_BUILD]);
    if (url.includes("parent_build_id=eq.") || url.includes("limit=3")) return json(route, []);
    return json(route, TWELVE);
  });
  await page.route(/\/rest\/v1\/build_likes/, async (route) => {
    if (route.request().method() === "POST") {
      if (likeWrite.gate) await likeWrite.gate;
      return route.fulfill({
        status: likeWrite.status,
        contentType: "application/json",
        body: likeWrite.status >= 400 ? JSON.stringify({ code: "XX000", message: "boom" }) : "",
      });
    }
    return json(route, []);
  });
  await page.route(/\/rest\/v1\/build_saves/, (route) => json(route, []));

  return requests;
}

const firstCard = (page: Page) => page.getByTestId("gallery-grid").locator('[data-visual-slot="gallery-card"]').first();

async function openGallery(page: Page) {
  await page.goto("/gallery");
  await expect(firstCard(page)).toBeVisible();
  // The counts have landed: the first card's Like reads 24.
  await expect(firstCard(page).getByRole("button", { name: "Like", exact: true })).toContainText("24");
}

test("Like changes at once, before the database answers, and rolls back when it refuses", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await fakeBackend(page, { signedIn: true, likeWrite: { status: 500, gate } });
  await openGallery(page);

  const card = firstCard(page);
  await card.getByRole("button", { name: "Like", exact: true }).click();

  // Before the write is answered: pressed, filled, one more.
  const unlike = card.getByRole("button", { name: "Unlike", exact: true });
  await expect(unlike).toHaveAttribute("aria-pressed", "true");
  await expect(unlike).toContainText("25");
  await expect(unlike.locator("[data-engagement-icon]")).toHaveAttribute("fill", "currentColor");
  await expect(page).toHaveURL(/\/gallery$/);

  release();

  const like = card.getByRole("button", { name: "Like", exact: true });
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(like).toContainText("24");
  await expect(page.getByText("Something went wrong.")).toBeVisible();
  await expect(page).toHaveURL(/\/gallery$/);
});

test("signed out, Like goes to sign in and comes back to the gallery", async ({ page }) => {
  await fakeBackend(page, { signedIn: false });
  await openGallery(page);

  await firstCard(page).getByRole("button", { name: "Like", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fgallery$/);

  await page.getByLabel("Email or username").fill("reader@example.test");
  await page.getByLabel("Password", { exact: true }).fill("a-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/gallery$/);
  await expect(firstCard(page)).toBeVisible();
});

test("Share copies the build's link when the device has no share sheet", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "share", { value: undefined, configurable: true });
    const store = window as unknown as { __copied: string[] };
    store.__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          store.__copied.push(text);
        },
      },
    });
  });
  await fakeBackend(page, { signedIn: false });
  await page.goto(`/b2/${FIRST.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Share", exact: true }).click();

  await expect(page.getByText("Link copied")).toBeVisible();
  const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
  expect(copied).toEqual([`https://buildgallery.ai/b2/${FIRST.slug}`]);
});

test("a gallery page of twelve cards asks three engagement questions signed in", async ({ page }) => {
  const requests = await fakeBackend(page, { signedIn: true });
  await openGallery(page);

  await expect(page.getByTestId("gallery-grid").locator('[data-visual-slot="gallery-card"]')).toHaveCount(12);
  const engagement = requests.filter(isEngagement);
  expect(engagement).toHaveLength(3);
  expect(engagement.filter(isCounts)).toHaveLength(1);
  expect(engagement.filter((request) => isMine(request, "build_likes"))).toHaveLength(1);
  expect(engagement.filter((request) => isMine(request, "build_saves"))).toHaveLength(1);
});

test("a gallery page of twelve cards asks one engagement question signed out", async ({ page }) => {
  const requests = await fakeBackend(page, { signedIn: false });
  await openGallery(page);

  await expect(page.getByTestId("gallery-grid").locator('[data-visual-slot="gallery-card"]')).toHaveCount(12);
  const engagement = requests.filter(isEngagement);
  expect(engagement).toHaveLength(1);
  expect(engagement.filter(isCounts)).toHaveLength(1);
});

test("every engagement action is at least 44 by 44, on a card and on the build page", async ({ page }) => {
  await fakeBackend(page, { signedIn: false });
  await openGallery(page);

  const cardActions = firstCard(page).getByTestId("engagement-row").getByRole("button");
  await expect(cardActions).toHaveCount(3);
  for (const box of await boxes(cardActions)) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await page.goto(`/b2/${FIRST.slug}`);
  const pageActions = page.getByTestId("engagement-row").getByRole("button");
  await expect(pageActions).toHaveCount(4);
  for (const box of await boxes(pageActions)) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

/**
 * Each button's box, measured once the page's entrance has finished: a card
 * and a build-page section rise into place with a transform, and a box
 * measured mid-rise is a fraction of a pixel off its layout size.
 */
async function boxes(locator: ReturnType<Page["locator"]>) {
  const out: { width: number; height: number }[] = [];
  await expect
    .poll(() =>
      locator.first().evaluate((element) => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          const transform = getComputedStyle(node).transform;
          if (transform !== "none" && transform !== "matrix(1, 0, 0, 1, 0, 0)") return false;
        }
        return true;
      }),
    )
    .toBe(true);
  for (const element of await locator.all()) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    out.push({ width: box!.width, height: box!.height });
  }
  return out;
}
