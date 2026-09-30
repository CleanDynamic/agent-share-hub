// RC-P22 — one address for each thing: the old personal pages land on their
// one home, in a real browser, at the desktop and the phone project.
//
//   /creator/:username   →  /profile/:username  (the handle carried across)
//   /creator             →  /profile
//   /my-uploads          →  /profile
//   /saved               →  /library
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. Each test
// asserts where the reader lands and that the page there is the new one.

import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, THEM, withSession } from "../audit/support/harness";

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown[]) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

function profileRow(who: typeof ME | typeof THEM) {
  return {
    id: who.id,
    username: who.username,
    display_name: who.display_name,
    avatar_url: null,
    banner_url: null,
    bio: null,
    website_url: null,
    location: null,
    follower_count: 0,
    following_count: 0,
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

async function fakeBackend(page: Page) {
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
  await page.route(/\/rest\/v1\/rpc\/maker_stats/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ builds: 0, reproductions_received: 0, rebuilds_of_their_work: 0, gaps_solved: 0 }]),
    }),
  );
  await page.route(/\/rest\/v1\/profiles\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes(`username=ilike.${THEM.username}`)) return json(route, [profileRow(THEM)]);
    return json(route, [profileRow(ME)]);
  });
}

const path = (page: Page) => new URL(page.url()).pathname;

test("the old creator address lands on that maker's profile", async ({ page }) => {
  await fakeBackend(page);
  await page.goto(`/creator/${THEM.username}`);

  await expect.poll(() => path(page)).toBe(`/profile/${THEM.username}`);
  await expect(page.getByTestId("profile-header")).toContainText(THEM.display_name);
  await expect(page.getByTestId("profile-tab-row")).toBeVisible();
});

test("the old creator address with no handle lands on your own profile", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/creator");

  await expect.poll(() => path(page)).toBe("/profile");
  await expect(page.getByTestId("profile-header")).toContainText(ME.display_name);
});

test("the old uploads list lands on your own profile", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/my-uploads");

  await expect.poll(() => path(page)).toBe("/profile");
  await expect(page.getByTestId("profile-header")).toContainText(ME.display_name);
});

test("the old saves list lands on the Library", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/saved");

  await expect.poll(() => path(page)).toBe("/library");
  await expect(page.getByTestId("library-page")).toBeVisible();
});
