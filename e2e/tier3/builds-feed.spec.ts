// Tier 3 — the Builds tab on Home (NS-P41).
//
// Covers the two acceptance criteria that live in the browser:
//   1. the tab renders all three item kinds
//   2. exactly ONE rpc per page of twenty, and the next page is asked for by
//      keyset — the cursor is the last item's own timestamp, never an offset
//
// WHY THIS SPEC SERVES THE RPC ITSELF RATHER THAN READING A SEEDED PROJECT.
// The thing being asserted is a COUNT of requests and the ARGUMENTS of the
// second one. Neither can be pinned down against live data: how many pages the
// tab fetches depends on how many builds happen to exist, and "one call per
// page" is unfalsifiable when the page is short enough to be the only one. So
// get_build_feed is fulfilled here with a fixed two-page fixture, and the spec
// asserts what the CLIENT does with it. The function's own behaviour — the
// union, the ordering, the RLS, the draft exclusion — is proven against a real
// Postgres in the NS-P41 migration's harness, which is where a database claim
// belongs; nothing about it is testable through a browser anyway, since a
// leaked draft would look exactly like a seeded one.
//
// The last spec in the file is the live one, and it skips unless a dev project
// has been seeded: a red suite meaning "nobody seeded the database" trains a
// maintainer to ignore red.
//
// Selectors are the testids NS-P41 introduced. Nothing here selects on a
// class: see the selector rules in the e2e skill.

import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The three item testids, anchored at both ends.
 *
 * A bare `/^feed-item-/` would also match a testid nested INSIDE an item, and
 * counting items is the assertion this file exists for.
 */
const FEED_ITEMS = /^feed-item-(build|rebuild|repro)$/;

/** What the tab asks for, and what the fixture pages are sized to. */
const PAGE_SIZE = 20;

const RPC = /\/rest\/v1\/rpc\/get_build_feed/;

/** Minutes back from a fixed point, so item_at is ordered and deterministic. */
const EPOCH = Date.parse("2026-08-20T12:00:00.000Z");
const at = (minutesBack: number) =>
  new Date(EPOCH - minutesBack * 60_000).toISOString();

type Row = Record<string, unknown>;

/**
 * One feed row with every column the function returns, so a client that reads
 * a column this fixture forgot fails here rather than in production.
 *
 * No cover: cover_path is what the browser signs, and a fixture that carried
 * one would send this spec off to Supabase storage for a URL it does not
 * assert on. The card's own fallback chain ends at the outcome, so every item
 * still renders something.
 */
function row(overrides: Row): Row {
  return {
    item_kind: "build",
    item_at: at(1),
    build_id: "00000000-0000-4000-8000-000000000001",
    slug: "a-build",
    title: "A build",
    outcome: "Does a thing, and says how well.",
    shape: "other",
    cover_media_id: null,
    creator_id: "00000000-0000-4000-8000-0000000000aa",
    creator_username: "amara",
    creator_display: "Amara Osei",
    creator_avatar: null,
    reproduction_count: 0,
    rebuild_count: 0,
    parent_build_id: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    rebuild_note: null,
    repro_note: null,
    repro_model: null,
    repro_user_username: null,
    status: "published",
    made_for: [],
    last_confirmed_at: null,
    last_confirmed_model: null,
    cover_bucket: null,
    cover_path: null,
    cover_kind: null,
    cover_poster_path: null,
    repro_worked: null,
    ...overrides,
  };
}

/** One of each kind, then filler up to a full page of twenty. */
function firstPage(): Row[] {
  const rows: Row[] = [
    row({
      item_kind: "repro_note",
      item_at: at(1),
      build_id: "00000000-0000-4000-8000-000000000010",
      slug: "inbox-triage-agent",
      title: "Inbox triage agent",
      repro_note: "Ran it on a 300-message inbox. Held up.",
      repro_model: "Sonnet 4.5",
      repro_user_username: "rae",
      repro_worked: true,
    }),
    row({
      item_kind: "rebuild",
      item_at: at(2),
      build_id: "00000000-0000-4000-8000-000000000011",
      slug: "inbox-triage-for-legal",
      title: "Inbox triage, for legal",
      parent_build_id: "00000000-0000-4000-8000-000000000010",
      source_title_at_fork: "Inbox triage agent",
      source_handle_at_fork: "amara",
      rebuild_note: "Swapped the classifier prompt and added a privilege check.",
      creator_username: "sam",
      creator_display: "Sam Reyes",
    }),
    row({
      item_kind: "build",
      item_at: at(3),
      build_id: "00000000-0000-4000-8000-000000000012",
      slug: "eval-harness",
      title: "Eval harness",
    }),
  ];

  while (rows.length < PAGE_SIZE) {
    const n = rows.length;
    rows.push(
      row({
        item_at: at(3 + n),
        build_id: `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`,
        slug: `filler-${n}`,
        title: `Filler build ${n}`,
      })
    );
  }
  return rows;
}

/** Short, so the client knows the feed has ended without a further request. */
function secondPage(): Row[] {
  return [0, 1, 2].map((n) =>
    row({
      item_at: at(100 + n),
      build_id: `00000000-0000-4000-8000-0000000002${String(n).padStart(2, "0")}`,
      slug: `page-two-${n}`,
      title: `Page two build ${n}`,
    })
  );
}

interface RpcCall {
  page_size?: number;
  before?: string;
}

/**
 * Serves the two fixture pages and records every call, so a spec can assert on
 * how many were made and what they asked for.
 */
async function stubFeed(page: Page): Promise<RpcCall[]> {
  const calls: RpcCall[] = [];
  const one = firstPage();
  const two = secondPage();

  await page.route(RPC, async (route: Route) => {
    const body = (route.request().postDataJSON() ?? {}) as RpcCall;
    calls.push(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body.before ? two : one),
    });
  });

  return calls;
}

async function openBuildsTab(page: Page) {
  await page.goto("/?tab=builds");
  await expect(page.getByTestId("feed-tab-builds")).toBeVisible();
  await expect(page.getByTestId("feed-builds")).toBeVisible();
}

test.describe("the Builds tab", () => {
  // ACCEPTANCE 2 — the tab exists, first among the tabs, and the five that
  // predate it are still there in their own order.
  test("sits first among the six tabs, and displaces none of them", async ({ page }) => {
    await stubFeed(page);
    await page.goto("/?tab=builds");

    const labels = await page
      .getByTestId(/^feed-tab-/)
      .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()));

    expect(labels).toEqual([
      "Builds",
      "For You",
      "Following",
      "Trending",
      "Recent",
      "Bounties",
    ]);
  });

  // ACCEPTANCE 1
  test("renders a build, a rebuild and a reproduction note", async ({ page }) => {
    await stubFeed(page);
    await openBuildsTab(page);

    await expect(page.getByTestId("feed-item-build").first()).toBeVisible();

    // The rebuild carries the credit line the gallery card already renders,
    // composed from the frozen snapshot columns, and the rebuilder's own note.
    const rebuild = page.getByTestId("feed-item-rebuild");
    await expect(rebuild).toHaveCount(1);
    await expect(rebuild).toContainText("Rebuilt from Inbox triage agent by @amara");
    await expect(rebuild.getByTestId("feed-rebuild-note")).toContainText(
      "Swapped the classifier prompt"
    );

    // The note is a strip rather than a card, and it says who, what, whether
    // it worked, on what, and in their own words.
    const repro = page.getByTestId("feed-item-repro");
    await expect(repro).toHaveCount(1);
    await expect(repro).toContainText("@rae");
    await expect(repro).toContainText("ran");
    await expect(repro).toContainText("Inbox triage agent");
    await expect(repro).toContainText("worked on Sonnet 4.5");
    await expect(repro).toContainText("Ran it on a 300-message inbox. Held up.");
    await expect(repro.getByRole("link")).toHaveAttribute(
      "href",
      "/b2/inbox-triage-agent"
    );
  });

  // ACCEPTANCE 2 — the request count is the whole point of the function.
  test("costs exactly one rpc per page, and pages by keyset", async ({ page }) => {
    const calls = await stubFeed(page);
    await openBuildsTab(page);

    // Twenty items on screen, one request to get them.
    await expect(page.getByTestId(FEED_ITEMS)).toHaveCount(PAGE_SIZE);
    expect(calls).toHaveLength(1);
    expect(calls[0].page_size).toBe(PAGE_SIZE);
    // The first page names no cursor: the database uses now(), rather than the
    // browser's clock, as the top of the feed.
    expect(calls[0].before).toBeUndefined();

    // Reaching the bottom asks for the next page, and asks for it by the last
    // item's own timestamp — not by an offset.
    const lastOfFirstPage = firstPage()[PAGE_SIZE - 1].item_at as string;
    await page.getByTestId("feed-scroll-sentinel").scrollIntoViewIfNeeded();

    await expect(page.getByTestId(FEED_ITEMS)).toHaveCount(PAGE_SIZE + 3);
    expect(calls).toHaveLength(2);
    expect(calls[1].before).toBe(lastOfFirstPage);
    expect(calls[1].page_size).toBe(PAGE_SIZE);

    // The second page came back short, so the client knows the feed has ended
    // and does not spend a third request finding out.
    await expect(page.getByTestId("feed-builds-end")).toBeVisible();
    await page.getByTestId("feed-builds-end").scrollIntoViewIfNeeded();
    expect(calls).toHaveLength(2);
  });

  test("says so plainly when there is nothing to show", async ({ page }) => {
    await page.route(RPC, (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    );
    await page.goto("/?tab=builds");

    await expect(page.getByText("Nothing here yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open the gallery" })).toBeVisible();
  });
});

// =============================================================================
// The same tab, against whatever the dev project actually holds
// =============================================================================
// Nothing is stubbed here, so this is the one that would catch a column the
// function renamed or a policy that hid every row. It needs a project with at
// least one published build in it, which is what the flag names.

const LIVE = process.env.E2E_LIVE_FEED === "1";

test.describe("the Builds tab, against seeded data", () => {
  test.skip(!LIVE, "Set E2E_LIVE_FEED=1 against a dev project with published builds.");

  test("renders published builds and asks for them once", async ({ page }) => {
    let calls = 0;
    await page.route(RPC, async (route) => {
      calls += 1;
      await route.continue();
    });

    await page.goto("/?tab=builds");
    await expect(page.getByTestId("feed-builds")).toBeVisible();
    await expect(page.getByTestId(FEED_ITEMS).first()).toBeVisible();
    expect(calls).toBe(1);
  });
});
