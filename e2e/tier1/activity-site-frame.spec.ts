// Tier 1 — UI-P35, Activity: the prompt's "Done when", proved in a browser.
//
//   new notifications appear live and update the header badge and the dock
//   badge; mark-read works per row and for all.
//
// THE TRANSPORT IS THE TIER-2 STUB. It answers PostgREST and the realtime socket
// locally and the spec pushes the INSERT frame itself, so "it arrived over
// realtime" is asserted at a known instant and nothing reaches the network.
// `applyPatches` lets a write change what the next read returns, as the database
// would, so a badge that drops after a row is read is the badge reading the
// write and not the stub standing still. What the stub cannot say: RLS, and
// whether a real broker delivers. It sends no realtime UPDATE for a PATCH, which
// the header's own channel would otherwise re-sync on, so a badge that drops
// here dropped because the page told it to.
//
// ONE SPEC, TWO PROJECTS. Desktop reads the header's bell and the list's own
// unread line; the phone reads the dock's Activity tile and the heading.

import { expect, test, type Page } from "@playwright/test";
import { ME, THEM, defaultSeed, installSupabaseStub, type Seed, type StubHandle } from "../tier2/support/supabaseStub";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

const BUILD = { id: "00000000-0000-4000-8000-00000000b001", slug: "invoice-triage-agent", title: "Invoice triage agent" };

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

function notificationRow(id: string, kind: string, body: string, minutes: number, read = false) {
  return {
    id,
    recipient_id: ME.id,
    actor_id: THEM.id,
    notification_type: kind,
    body,
    target_type: "build",
    target_id: BUILD.id,
    content_id: null,
    project_id: null,
    collection_id: null,
    metadata: { build_id: BUILD.id },
    is_read: read,
    read_at: read ? minutesAgo(minutes) : null,
    created_at: minutesAgo(minutes),
  };
}

/** Three unread and one read, all about one build, newest first. */
function seed(): Seed {
  const base = defaultSeed();
  base.tables.notifications = [
    notificationRow("n-ran", "reproduced", "ran your build and it worked", 2),
    notificationRow("n-rebuilt", "rebuilt", "rebuilt your build", 5),
    notificationRow("n-liked", "like", "liked your build", 9),
    notificationRow("n-commented", "comment", "commented on your build", 14, true),
  ];
  base.tables.builds = [{ id: BUILD.id, slug: BUILD.slug, title: BUILD.title }];
  return base;
}

const rows = (page: Page) => page.getByTestId("activity-row");
const unreadRows = (page: Page) => page.locator('[data-testid="activity-row"][data-unread="true"]');

async function open(page: Page): Promise<StubHandle> {
  const stub = await installSupabaseStub(page, seed(), { applyPatches: true });
  await page.goto("/notifications?frame=site");
  await expect(page.getByTestId("site-frame")).toBeVisible();
  await expect(rows(page)).toHaveCount(4);
  return stub;
}

/** The page's channel and the header's or the dock's, both joined: a push now reaches both. */
async function channelsJoined(stub: StubHandle) {
  await expect
    .poll(() => stub.joinedTopics().filter((topic) => topic.includes(`notifications:${ME.id}:`)).length)
    .toBeGreaterThanOrEqual(2);
}

/** The count the header's bell or the dock's tile says in its name. */
async function expectBadge(page: Page, unread: number) {
  const name = unread > 0 ? `Activity, ${unread} unread` : "Activity";
  if (isPhone(page)) await expect(page.getByTestId("dock-tile-activity")).toHaveAttribute("aria-label", name);
  else await expect(page.getByTestId("site-header").getByRole("link", { name, exact: true })).toBeVisible();
}

/** The count the page itself says: the list's subtitle on desktop, the heading on a phone. */
async function expectHeading(page: Page, unread: number) {
  if (isPhone(page)) {
    await expect(page.getByRole("heading", { level: 1, name: unread === 0 ? "All caught up" : `${unread} unread` })).toBeVisible();
  } else {
    await expect(page.getByText(`${unread} unread · live`)).toBeVisible();
  }
}

test.describe("Activity, live and read", () => {
  test("a new notification appears live, and the bell or the dock counts it", async ({ page }) => {
    const stub = await open(page);
    await expectHeading(page, 3);
    await expectBadge(page, 3);
    await channelsJoined(stub);

    await stub.deliver("notifications", notificationRow("n-arrived", "like", "liked your build", 0));

    await expect(rows(page)).toHaveCount(5);
    await expect(rows(page).first()).toContainText("@otherparty liked");
    await expectHeading(page, 4);
    await expectBadge(page, 4);
  });

  test("following a row reads it at once and writes it, and the badge drops", async ({ page }) => {
    const stub = await open(page);
    await expectBadge(page, 3);

    await rows(page).first().click();
    await expect(page).toHaveURL(/\/b2\/invoice-triage-agent/);

    await expect.poll(() => stub.patched("notifications").length).toBe(1);
    const [patch] = stub.patched("notifications");
    expect(patch.body).toEqual({ is_read: true });
    expect(patch.query).toContain("id=eq.n-ran");
    await expectBadge(page, 2);

    await page.goBack();
    await expect(rows(page)).toHaveCount(4);
    await expect(unreadRows(page)).toHaveCount(2);
    await expectHeading(page, 2);
  });

  test("Mark all read reads every row at once and writes it, and the badge clears", async ({ page }) => {
    const stub = await open(page);
    await expectBadge(page, 3);

    await page.getByRole("button", { name: "Mark all read" }).click();

    await expectHeading(page, 0);
    await expect(unreadRows(page)).toHaveCount(0);
    await expect.poll(() => stub.patched("notifications").length).toBe(1);
    const [patch] = stub.patched("notifications");
    expect(patch.body).toEqual({ is_read: true });
    expect(patch.query).toContain(`recipient_id=eq.${ME.id}`);
    expect(patch.query).toContain("is_read=eq.false");
    await expectBadge(page, 0);
  });
});
