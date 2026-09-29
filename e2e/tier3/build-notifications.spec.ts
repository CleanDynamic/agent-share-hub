// RC-P19 — notifications about builds, in a real browser, at the desktop and
// the phone project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. notifications
// answers one row of each of the nine kinds the database writes, plus one kind
// nobody knows; profiles names the actor; builds names the builds. Nothing
// reaches the network.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { ME, THEM, withSession } from "../audit/support/harness";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const BUILDS = [1, 2, 3].map((n) => ({ id: id(n), slug: `build-${n}`, title: ["Invoice reader", "Inbox triage agent", "Contract clause finder"][n - 1] }));

const KINDS = [
  { kind: "rebuilt", body: "rebuilt your build", targetType: "build", build: 1, href: "/b2/build-1" },
  { kind: "published", body: "published a new build", targetType: "build", build: 2, href: "/b2/build-2" },
  { kind: "reproduced", body: "ran your build and it worked", targetType: "build", build: 1, href: "/b2/build-1" },
  { kind: "comment", body: "commented on your build", targetType: "build_comment", build: 1, href: "/b2/build-1#comments" },
  { kind: "reply", body: "replied to your comment", targetType: "build_comment", build: 2, href: "/b2/build-2#comments" },
  { kind: "like", body: "liked your build", targetType: "build", build: 1, href: "/b2/build-1" },
  { kind: "solution", body: "posted a solution to your bounty", targetType: "bounty_build", build: 3, href: "/b2/build-3" },
  { kind: "solved", body: "accepted your solution", targetType: "bounty_build", build: 3, href: "/b2/build-3" },
  { kind: "follow", body: "started following you", targetType: "profile", build: null, href: `/profile/${THEM.username}` },
] as const;

const ROWS: Row[] = [
  ...KINDS.map((spec, index) => {
    const build = spec.build ? BUILDS[spec.build - 1] : null;
    return {
      id: id(700 + index),
      recipient_id: ME.id,
      actor_id: THEM.id,
      notification_type: spec.kind,
      body: spec.body,
      target_type: spec.targetType,
      target_id: spec.targetType === "profile" ? THEM.id : spec.targetType === "build" ? build?.id : id(800 + index),
      content_id: null,
      project_id: null,
      collection_id: null,
      metadata: build ? { build_id: build.id } : null,
      is_read: index % 2 === 1,
      read_at: null,
      created_at: new Date(Date.now() - index * 60_000).toISOString(),
    };
  }),
  {
    id: id(799),
    recipient_id: ME.id,
    actor_id: null,
    notification_type: "made_up_kind",
    body: "Something happened that this page does not know about.",
    target_type: null,
    target_id: null,
    content_id: null,
    project_id: null,
    collection_id: null,
    metadata: null,
    is_read: false,
    read_at: null,
    created_at: new Date(Date.now() - 20 * 60_000).toISOString(),
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

async function fakeBackend(page: Page): Promise<{ writes: Request[]; buildReads: Request[] }> {
  const backend = { writes: [] as Request[], buildReads: [] as Request[] };
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
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    json(route, [
      { id: THEM.id, username: THEM.username, display_name: THEM.display_name, avatar_url: null },
      { id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null },
    ]),
  );
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("select=id,slug,title")) {
      backend.buildReads.push(route.request());
      return json(route, BUILDS);
    }
    return json(route, []);
  });
  await page.route(/\/rest\/v1\/notifications/, (route) => {
    const request = route.request();
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      backend.writes.push(request);
      return route.fulfill({ status: 204, contentType: "application/json", body: "" });
    }
    const url = decodeURIComponent(request.url());
    const rows = url.includes("is_read=eq.false") ? ROWS.filter((row) => !row.is_read) : ROWS;
    // A count is a HEAD: no body, the total in Content-Range, exposed to the
    // page across origins as Supabase exposes it.
    if (request.method() === "HEAD") {
      return route.fulfill({
        status: 200,
        headers: {
          "content-range": `*/${rows.length}`,
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range",
        },
        body: "",
      });
    }
    return json(route, rows);
  });

  return backend;
}

const row = (page: Page, kind: string) => page.locator(`[data-testid="notification"][data-kind="${kind}"]`);

test("each of the nine kinds says its message and leads where it should", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/notifications");
  await expect(page.getByTestId("notification")).toHaveCount(ROWS.length);

  for (const spec of KINDS) {
    const item = row(page, spec.kind);
    await expect(item.getByTestId("notification-message")).toHaveText(`${THEM.display_name} ${spec.body}`);
    await expect(item).toHaveAttribute("href", spec.href);
    if (spec.build) await expect(item.getByTestId("notification-build")).toHaveText(BUILDS[spec.build - 1].title);
  }
  // Every build the page names, in one request.
  expect(backend.buildReads).toHaveLength(1);
});

test("a kind nobody knows says its stored message and leads nowhere", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/notifications");

  const unknown = row(page, "made_up_kind");
  await expect(unknown.getByTestId("notification-message")).toHaveText("Something happened that this page does not know about.");
  expect(await unknown.evaluate((element) => element.tagName)).toBe("DIV");
});

test("there are no filter tabs, and Mark all as read sits above the list", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/notifications");
  await expect(page.getByTestId("notification").first()).toBeVisible();

  await expect(page.getByRole("button", { name: "All", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Unread", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark all as read" })).toBeEnabled();
});

test("opening a notification reads it and goes to its build", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/notifications");

  await row(page, "rebuilt").click();

  await expect(page).toHaveURL(/\/b2\/build-1$/);
  await expect.poll(() => backend.writes.filter((request) => request.method() === "PATCH").length).toBe(1);
});
