// Tier 3 — the full bounty loop, end to end and by two different people
// (NS-P52).
//
// THE ONE CLAIM, in four parts, and it is the acceptance criterion the unit
// suite cannot reach because it needs two accounts and one database:
//
//   1. the feed carries the ask BEFORE it is answered
//   2. a solver who is not the author submits a solution against the gap
//   3. the author accepts it, and the build page then shows the gap node
//      FILLED, crediting the solver
//   4. the feed no longer carries the ask, because a solved bounty leaves the
//      open set
//
// Parts 1 and 4 are the same assertion twice, either side of the acceptance,
// which is what makes it a claim about the loop rather than about a page.
//
// WHAT IS ANSWERED IN THE UNIT SUITE INSTEAD.
// src/components/build/GapPanel.test.tsx drives the panel, the form, the
// confirm and the credit line against a stubbed data layer — every branch,
// including the ones a browser cannot reach without a second seeded account.
// src/components/feed/BuildFeedItems.test.tsx drives the mapper and the strip.
// This spec is the join: that those pieces, against a real database with real
// row level security, actually complete the round trip.
//
// THIS SPEC WRITES, AND WHAT IT WRITES CANNOT BE UNDONE FROM A BROWSER. It
// submits a solution and accepts it, which fills a node in a published build,
// solves a bounty and appends a milestone to the build's sequence. So it is
// pointed at a DEV project and at a build that is EXPECTED NOT TO SURVIVE it:
// after a run the seeded gap is filled and the same build cannot be reused.
// It skips unless every one of these is set, so it cannot be pointed anywhere
// by accident:
//
//   E2E_BOUNTY_SLUG      a published build with ONE open bounty on a gap node
//   E2E_AUTHOR_EMAIL     the creator of that build
//   E2E_AUTHOR_PASSWORD
//   E2E_SOLVER_EMAIL     somebody else — the author cannot solve their own gap
//   E2E_SOLVER_PASSWORD
//   E2E_SOLVER_HANDLE    that user's profiles.username, for the credit line
//
// WHAT THE SEEDED BUILD HAS TO BE. Published (so it is in the feed and
// readable signed-out), carrying exactly one gap node with an open bounty
// filed against it, and that bounty filed RECENTLY — the feed is ordered
// newest first and this spec reads the first two pages of it, so an ask from
// last month is not a failure of the code.
//
// Selectors are the testids NS-P52 introduced — gap-panel, solve-open,
// solution-submit, solution-accept, feed-item-bounty — plus NS-P53's
// solve-direct, which is where the typed form moved to when the rebuild became
// the primary path. Roles and labels everywhere else. Nothing here selects on a
// class: see the e2e skill.
//
// THIS SPEC IS NOW ALSO THE LEGACY GUARD. NS-P53 added a second way to answer a
// gap and did not change this one; that this spec still passes unchanged apart
// from one click is the evidence for it.

import { expect, test, type Page } from "@playwright/test";

const SLUG = process.env.E2E_BOUNTY_SLUG ?? "";
const AUTHOR_EMAIL = process.env.E2E_AUTHOR_EMAIL ?? "";
const AUTHOR_PASSWORD = process.env.E2E_AUTHOR_PASSWORD ?? "";
const SOLVER_EMAIL = process.env.E2E_SOLVER_EMAIL ?? "";
const SOLVER_PASSWORD = process.env.E2E_SOLVER_PASSWORD ?? "";
const SOLVER_HANDLE = process.env.E2E_SOLVER_HANDLE ?? "";

const NEEDS_SEED =
  "Set E2E_BOUNTY_SLUG, E2E_AUTHOR_EMAIL, E2E_AUTHOR_PASSWORD, " +
  "E2E_SOLVER_EMAIL, E2E_SOLVER_PASSWORD and E2E_SOLVER_HANDLE. This spec " +
  "fills a gap in a published build and cannot be re-run against the same " +
  "build, so point it at a DEV project.";

/** What the solver types into the gap type's first field. */
const ANSWER = "Back off exponentially: 1s, 2s, 4s, capped at six attempts.";
const SOLVER_NOTE = "Held at 300 messages on the same account.";

/** Pages of the feed this spec will scroll through looking for the ask. */
const FEED_PAGES = 2;

/**
 * Sign in through the login form.
 *
 * Through the UI, which is what the e2e skill tells you not to do — and there
 * is still no auth setup project in this repository to save a storage state
 * with (the config declares the project; no *.setup.ts exists). NS-P51's spec
 * carries the same helper and the same note. Whoever adds the fixture should
 * delete both and use two `test.use({ storageState })` contexts here, which is
 * also what would let the two halves of this loop run as separate tests.
 */
async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("Email or username").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByPlaceholder("Enter your password")).toHaveCount(0, {
    timeout: 20_000,
  });
}

async function signOut(page: Page): Promise<void> {
  // The session is in local storage; clearing it is what signing out amounts
  // to, and it does not depend on where the menu that does it lives today.
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
}

/** The build page, once its record has painted. */
async function openBuild(page: Page): Promise<void> {
  await page.goto(`/b2/${SLUG}`);
  await expect(page.locator('[data-visual-slot="build-anatomy-tree"]')).toBeVisible();
}

/**
 * Whether the Builds tab is carrying an open ask on THIS build.
 *
 * Scrolls a bounded number of pages rather than once: the feed is keyset-paged
 * at twenty and the seeded ask is recent, so it is on the first page in
 * practice — the second is slack, not a search.
 */
async function feedCarriesTheAsk(page: Page): Promise<boolean> {
  await page.goto("/?tab=builds");
  await expect(page.getByTestId("feed-builds")).toBeVisible();

  const strip = page.locator(
    `[data-testid="feed-item-bounty"]:has(a[href="/b2/${SLUG}"])`,
  );

  for (let round = 0; round < FEED_PAGES; round += 1) {
    if (await strip.count()) return true;
    await page.getByTestId("feed-scroll-sentinel").scrollIntoViewIfNeeded();
    // The next page either arrives or the feed says it has ended; either way
    // the strip's count below is the answer.
    await page
      .getByTestId("feed-builds-end")
      .waitFor({ state: "visible", timeout: 5_000 })
      .catch(() => undefined);
  }

  return (await strip.count()) > 0;
}

test.describe("the bounty loop, from ask to credit", () => {
  test.skip(
    !SLUG ||
      !AUTHOR_EMAIL ||
      !AUTHOR_PASSWORD ||
      !SOLVER_EMAIL ||
      !SOLVER_PASSWORD ||
      !SOLVER_HANDLE,
    NEEDS_SEED,
  );

  // One test, not four: each part depends on the state the one before it
  // wrote, and splitting them would make three of the four pass or fail for
  // reasons that have nothing to do with what they assert.
  test("a solver answers, the author accepts, and the ask leaves the feed", async ({
    page,
  }) => {
    // ---------------------------------------------------------------- part 1
    expect(await feedCarriesTheAsk(page)).toBe(true);

    // ---------------------------------------------------------------- part 2
    await signIn(page, SOLVER_EMAIL, SOLVER_PASSWORD);
    await openBuild(page);

    const panel = page.getByTestId("gap-panel").first();
    await expect(panel).toBeVisible();
    // The copy is an invitation, and it is the design.
    await expect(panel).toContainText("the build works without it");

    await panel.getByTestId("solve-open").click();
    const sheet = page.getByTestId("solve-panel");
    await expect(sheet).toBeVisible();

    // NS-P53 RANKED THE TWO WAYS IN, and this spec is the one that proves the
    // SECOND one still works end to end: the typed payload path is now behind
    // "Just send the missing part", and everything after this click is exactly
    // what NS-P52 asserted, unchanged.
    await sheet.getByTestId("solve-direct").click();

    // The form is the GAP NODE'S OWN TYPE, so the field is whatever that type
    // declares. The first textbox in the sheet is its first field, which is
    // the one a schema puts first: the required one.
    await sheet.getByRole("textbox").first().fill(ANSWER);
    await sheet.getByTestId("solution-note").fill(SOLVER_NOTE);

    const written = page.waitForResponse(
      (response) =>
        /\/rest\/v1\/solutions/.test(response.url()) &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    );
    await sheet.getByTestId("solution-submit").click();
    await written;

    await expect(sheet.getByTestId("solution-row").first()).toContainText(
      SOLVER_NOTE,
    );
    // A solver is not offered the author's control, whatever the DOM says
    // about the row being theirs.
    await expect(sheet.getByTestId("solution-accept")).toHaveCount(0);

    // ---------------------------------------------------------------- part 3
    await signOut(page);
    await signIn(page, AUTHOR_EMAIL, AUTHOR_PASSWORD);
    await openBuild(page);

    const authorPanel = page.getByTestId("gap-panel").first();
    await authorPanel.getByTestId("solve-open").click();
    const authorSheet = page.getByTestId("solve-panel");
    await expect(authorSheet.getByTestId("solution-row").first()).toBeVisible();

    await authorSheet.getByTestId("solution-accept").first().click();
    // The confirm names the consequence before anything is written.
    await expect(authorSheet).toContainText("fills the gap in your build");
    await authorSheet.getByTestId("solution-accept-confirm").click();

    // The record itself changed, so the page refetches: the gap becomes the
    // filled node, carrying the answer and the credit read off its source_ref.
    const credit = page.getByTestId("gap-solved-credit").first();
    await expect(credit).toBeVisible({ timeout: 20_000 });
    await expect(credit).toHaveText(`Solved by @${SOLVER_HANDLE}`);
    await expect(page.getByTestId("gap-panel")).toHaveCount(0);
    await expect(page.locator('[data-visual-slot="build-anatomy-tree"]')).toContainText(
      ANSWER,
    );

    // ---------------------------------------------------------------- part 4
    // Signed out, so what is asserted is what any reader sees: the ask is
    // gone from the feed because the bounty is solved, not because this
    // browser holds a stale cache.
    await signOut(page);
    expect(await feedCarriesTheAsk(page)).toBe(false);
  });
});
