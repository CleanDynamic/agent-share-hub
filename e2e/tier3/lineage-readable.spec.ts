// Tier 3 — the old lineage address, after remix (NS-P43, rewritten RC-P14).
//
// WHAT THIS FILE CARRIED. NS-P43 froze createRemix on the promise that every
// remix lineage already recorded kept rendering at /b/:slug/lineage, and this
// file proved the page was still served for a seeded post. RC-P14 made lineage
// the family of rebuilds: the page draws builds, lives at /b2/:slug/lineage,
// and its remix assertions moved to lineage-rebuilds.spec.ts as rebuild ones.
//
// WHAT IT CARRIES NOW is what the OLD ADDRESS still promises while it is
// reachable (CONTRACT §3.4): it answers — landing on the build's family when
// its slug names a build, saying there is no build at it when not — and it
// never offers remix, or a notice that remix was removed (quiet retirement, as
// NS-P42 set out).
//
// THE BACKEND IS FAKED (CONTRACT §7), so nothing here waits on a seeded post
// any more, and nothing skips.

import { expect, test, type Page, type Route } from "@playwright/test";

type Row = Record<string, unknown>;

const BUILD: Row = {
  id: "00000000-0000-4000-8000-000000000001",
  creator_id: "00000000-0000-4000-8000-0000000000aa",
  slug: "inbox-triage-agent",
  title: "Inbox triage agent",
  status: "published",
  parent_build_id: null,
  root_build_id: null,
  published_at: "2026-08-02T00:00:00.000Z",
};

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

async function fakeBackend(page: Page, builds: Row[]) {
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
  await page.route(/\/rest\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route(/\/rest\/v1\/builds\?/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(wantsObject(route) ? (builds[0] ?? null) : builds),
    }),
  );
  await page.route(/\/rest\/v1\/rpc\/rebuild_tree/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(builds.length ? [{ ...builds[0], depth: 0, reproduction_count: 0, rebuild_note: null }] : []),
    }),
  );
}

test("the old address answers with the build's family, and no remix affordance or notice", async ({ page }) => {
  await fakeBackend(page, [BUILD]);
  await page.goto("/b/inbox-triage-agent/lineage");

  await expect(page).toHaveURL(/\/b2\/inbox-triage-agent\/lineage$/);
  await expect(page.getByRole("heading", { level: 1, name: "Rebuilds of this" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remix — build on this" })).toHaveCount(0);
  await expect(page.getByText(/remix(ing)? (is|has been) (retired|disabled|removed)/i)).toHaveCount(0);
});

test("the old address says there is no build at it when its slug names none", async ({ page }) => {
  await fakeBackend(page, []);
  await page.goto("/b/an-old-post/lineage");

  await expect(page.getByTestId("lineage-not-found")).toContainText("No build at this address.");
  await expect(page).toHaveURL(/\/b\/an-old-post\/lineage$/);
  await expect(page.getByText(/remix(ing)? (is|has been) (retired|disabled|removed)/i)).toHaveCount(0);
});
