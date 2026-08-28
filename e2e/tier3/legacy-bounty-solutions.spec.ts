// Tier 3 — the browser half of "a legacy bounty page still lists its solutions
// and accepts a vote, through the shim" (NS-P46).
//
// WHERE THE ACCEPTANCE IS ACTUALLY PROVEN, AND WHY THIS FILE IS THE THIRD PLACE
// RATHER THAN THE FIRST. NS-P46 moves solutions.bounty_id off content_items and
// onto public.bounties, and keeps the legacy page working through
// solutions.legacy_bounty_item_id. That claim is answered in two places that
// can answer it today:
//
//   * supabase/tests/ns-p46-repoint-solutions.sql, check 6 — anon lists an
//     approved legacy bounty's solutions through the shim column, sees its
//     comments, cannot see its drafts, and a signed-in reader's vote reaches
//     the counter. Under real row level security, against real Postgres. That
//     is the half a browser cannot prove: a policy that leaks would render
//     identically to one that does not.
//
//   * src/lib/bounty-solver/legacyBountyShim.test.ts — every read the page runs
//     names legacy_bounty_item_id and not bounty_id, the draft insert resolves
//     the bounties header first, and the realtime filter moved with them.
//
// WHAT IS LEFT FOR A BROWSER is the join between the two: that the page as
// shipped asks PostgREST for the shimmed column and paints what comes back.
// This spec asserts exactly that, and it skips by default, because the project
// in supabase/config.toml cannot answer it — measured 28 Aug 2026 through the
// anon key: public.bounties answers PGRST205 ("could not find the table in the
// schema cache"), so NS-P45 and NS-P46 are not applied there and every solution
// in that database is still keyed the old way. Pointed at it, this spec would
// go green on the OLD shape and stay green if the shim were deleted, which is
// worse than not running: a vacuous green trains a maintainer to trust a check
// that is not checking.
//
// TO RUN IT, point E2E_LEGACY_BOUNTY_URL at a bounty page on a project where
// both migrations are applied and the bounty has at least one submitted
// solution. The request assertion then becomes the real thing: if a shim is
// dropped before NS-P50 rewires its caller, the query string it names goes
// missing and this fails.
//
// Selectors are roles and accessible names. Nothing here selects on a class:
// see the selector rules in the e2e skill.

import { expect, test } from "@playwright/test";

/**
 * A bounty page — /content/:slug — on a project carrying NS-P45 and NS-P46,
 * for a bounty that has at least one submitted or accepted solution.
 */
const LEGACY_BOUNTY_URL = process.env.E2E_LEGACY_BOUNTY_URL ?? "";

/** The PostgREST reads the page makes against the repointed tables. */
const SOLUTIONS_REQUEST = /\/rest\/v1\/solutions\?/;

test.describe("a legacy bounty page after the repoint", () => {
  test.skip(
    !LEGACY_BOUNTY_URL,
    "No repointed bounty page to point at: public.bounties answers PGRST205 on the project in supabase/config.toml, so NS-P45 and NS-P46 are not applied there. Set E2E_LEGACY_BOUNTY_URL to a bounty page on a project that has them.",
  );

  test("asks for its solutions by the shim column, and renders them", async ({ page }) => {
    const solutionQueries: string[] = [];
    page.on("request", (request) => {
      if (SOLUTIONS_REQUEST.test(request.url())) {
        solutionQueries.push(new URL(request.url()).search);
      }
    });

    await page.goto(LEGACY_BOUNTY_URL);
    await page.waitForLoadState("networkidle");

    expect(
      solutionQueries.length,
      "the page made no request for solutions at all",
    ).toBeGreaterThan(0);

    // The shim, as it appears on the wire. A page rewired early —
    // or a shim removed before NS-P50 — shows up here and nowhere else.
    for (const search of solutionQueries) {
      expect(search).toContain("legacy_bounty_item_id=eq.");
      expect(search).not.toContain("bounty_id=eq.");
    }

    // And the answer is painted. An empty solutions list is the exact symptom
    // of a filter on the wrong column, so a page that lists nothing fails here
    // even though every request above was well formed.
    const solutions = page.getByTestId(/^solution-card/);
    await expect(solutions.first()).toBeVisible();
  });

  test("still accepts a vote on one of them", async ({ page }) => {
    await page.goto(LEGACY_BOUNTY_URL);
    await page.waitForLoadState("networkidle");

    const upvote = page.getByRole("button", { name: /upvote/i }).first();
    await expect(upvote).toBeVisible();

    // Signed out, the affordance is there and the write is refused by policy,
    // which is the pre-NS-P46 behaviour and must stay that way. The signed-in
    // half of this — the vote landing and the counter moving — is check 6b of
    // supabase/tests/ns-p46-repoint-solutions.sql, which can sign in and this
    // suite cannot: playwright.config.ts declares a `setup` project with no
    // `.setup.ts` behind it, so tier 3 has no auth fixture.
    await upvote.click();
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
  });
});
