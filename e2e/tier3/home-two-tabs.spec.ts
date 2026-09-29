// RC-P11 — Home as two tabs on the build feed, in a real browser.
//
// THE BACKEND IS FAKED (CONTRACT §7) with the audit harness: every table, the
// auth server, storage and the realtime socket are answered locally, and a
// signed-in reader is a session put in storage. On top of it this file answers
// the two things Home asks about: how many makers the reader follows (a HEAD
// count on follows) and the feed (get_build_feed), whose request body shows
// which tab asked. Nothing reaches the network.

import { expect, test, type Page, type Request } from "@playwright/test";
import { installStub, withSession } from "../audit/support/harness";

const RPC = /\/rest\/v1\/rpc\/get_build_feed/;

interface Reader {
  signedIn: boolean;
  /** How many makers the reader follows. */
  follows?: number;
}

/** The harness, then Home's two answers: the follows count and an empty feed. */
async function openHome(page: Page, path: string, reader: Reader): Promise<Request[]> {
  const requests: Request[] = [];
  page.on("request", (request) => requests.push(request));

  if (reader.signedIn) await withSession(page);
  await installStub(page);

  const follows = reader.follows ?? 0;
  await page.route(/\/rest\/v1\/follows(\?|$)/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "content-range": follows > 0 ? `0-${follows - 1}/${follows}` : "*/0",
        "access-control-expose-headers": "content-range",
      },
      body: route.request().method() === "HEAD" ? "" : "[]",
    }),
  );
  await page.route(RPC, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );

  await page.goto(path);
  await expect(page.getByTestId("feed-empty")).toBeVisible();
  return requests;
}

const feedCalls = (requests: Request[]) =>
  requests
    .filter((request) => RPC.test(request.url()))
    .map((request) => (request.postDataJSON() ?? {}) as { only_following?: boolean });

/* ── No legacy reads ──────────────────────────────────────────────────────── */

for (const tab of ["following", "everyone"] as const) {
  test(`a cold load of ${tab} asks nothing of content_items`, async ({ page }) => {
    const requests = await openHome(page, `/?tab=${tab}`, { signedIn: false });

    expect(requests.filter((request) => request.url().includes("content_items"))).toEqual([]);
    expect(feedCalls(requests)).toHaveLength(1);
  });
}

/* ── The three empty states: one sentence, one action ─────────────────────── */

test("Everyone, empty, says nothing has been published yet", async ({ page }) => {
  await openHome(page, "/?tab=everyone", { signedIn: true, follows: 1 });

  const empty = page.getByTestId("feed-empty");
  await expect(empty).toContainText("Nothing has been published yet.");
  await expect(empty.getByRole("link")).toHaveCount(1);
  await expect(empty.getByRole("link", { name: "Show what you built" })).toHaveAttribute(
    "href",
    "/compose/new",
  );
});

test("Following, for a reader who follows nobody, says to follow a maker", async ({ page }) => {
  await openHome(page, "/?tab=following", { signedIn: true, follows: 0 });

  const empty = page.getByTestId("feed-empty");
  await expect(empty).toContainText("Follow a maker and their work lands here.");
  const actions = empty.getByRole("link", { name: "Browse the gallery" });
  await expect(actions).toHaveCount(1);
  await expect(actions).toHaveAttribute("href", "/gallery");
});

test("Following, for a reader whose makers are quiet, offers everyone", async ({ page }) => {
  await openHome(page, "/?tab=following", { signedIn: true, follows: 2 });

  const empty = page.getByTestId("feed-empty");
  await expect(empty).toContainText("The makers you follow have been quiet.");
  await expect(empty.getByRole("link")).toHaveCount(1);
  await empty.getByRole("link", { name: "See everyone" }).click();
  await expect(page.getByTestId("feed-tab-everyone")).toHaveAttribute("data-state", "active");
});

/* ── The default tab ──────────────────────────────────────────────────────── */

test("a signed-in reader who follows makers lands on Following", async ({ page }) => {
  const requests = await openHome(page, "/", { signedIn: true, follows: 3 });

  await expect(page.getByTestId("feed-tab-following")).toHaveAttribute("data-state", "active");
  // Everyone was never fetched on the way: one feed request, with the scope.
  expect(feedCalls(requests)).toEqual([expect.objectContaining({ only_following: true })]);
});

test("a signed-in reader who follows nobody lands on Everyone", async ({ page }) => {
  const requests = await openHome(page, "/", { signedIn: true, follows: 0 });

  await expect(page.getByTestId("feed-tab-everyone")).toHaveAttribute("data-state", "active");
  expect(feedCalls(requests)).toHaveLength(1);
  expect(feedCalls(requests)[0]).not.toHaveProperty("only_following");
});

test("a signed-out visitor lands on Everyone", async ({ page }) => {
  await openHome(page, "/", { signedIn: false });
  await expect(page.getByTestId("feed-tab-everyone")).toHaveAttribute("data-state", "active");
});
