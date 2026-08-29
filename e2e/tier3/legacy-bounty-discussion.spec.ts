// Tier 3 — the browser half of "a legacy bounty thread still renders, and a
// reaction still posts, through the shim" (NS-P47).
//
// WHERE THE ACCEPTANCE IS ACTUALLY PROVEN, AND WHY THIS FILE IS THE THIRD PLACE
// RATHER THAN THE FIRST. NS-P47 moves bounty_id off content_items and onto
// public.bounties for bounty_discussion_comments, bounty_comment_last_read,
// bounty_deadline_extensions and bounty_author_review, and keeps the legacy
// page working through a legacy_bounty_item_id shim on each. That claim is
// answered in two places that can answer it today:
//
//   * supabase/tests/ns-p47-repoint-bounty-satellites.sql — check 6 reads a
//     thread as anon through the shim, proves a comment on an UNAPPROVED
//     bounty stays invisible, posts a comment, posts a reaction, marks the
//     thread read, and shows the bounty author extending a deadline and
//     triaging a solution where a third party is refused both. Under real row
//     level security, against real Postgres. That is the half a browser cannot
//     prove: a policy that leaks renders identically to one that does not.
//     Check 8 is the me-too dual-write, on both counters.
//
//   * src/lib/bounty-solver/legacyDiscussionShim.test.ts — every read the page
//     runs names legacy_bounty_item_id and not bounty_id, every write resolves
//     the bounties header first, and the realtime filter moved with them.
//
// WHAT IS LEFT FOR A BROWSER is the join between the two: that the page as
// shipped asks PostgREST for the shimmed column and paints what comes back.
// This spec asserts exactly that, and it skips by default, because the project
// in supabase/config.toml cannot answer it — public.bounties answers PGRST205
// there, so NS-P45 through NS-P47 are not applied and every comment in that
// database is still keyed the old way. Pointed at it, this spec would go green
// on the OLD shape and stay green if the shim were deleted, which is worse than
// not running: a vacuous green trains a maintainer to trust a check that is not
// checking.
//
// THE ME-TOO HALF OF THE NS-P47 ACCEPTANCE IS NOT HERE, AND CANNOT BE. The
// me-too affordance lives in src/pages/ContentDetail.legacy.tsx, which no route
// registers and no module imports — NS-P44 measured that and it has not changed
// — and it writes public.bounty_me_too, which answers PGRST205 on the same
// project because the generation-1 migration was never applied. There is no URL
// a browser can visit to click it. "Me-too increments both counters" is
// therefore proven where it can be: check 8 of the SQL test above, which
// inserts a me-too and asserts content_items.bounty_me_too_count AND
// bounties.me_too_count both move, then deletes it and asserts both move back.
// If the legacy page is ever re-routed and generation 1 ever applied, the
// browser assertion belongs here.
//
// TO RUN IT, point E2E_LEGACY_BOUNTY_URL at a bounty page on a project where
// the migrations are applied and the bounty has at least one discussion
// comment. The request assertion then becomes the real thing: if a shim is
// dropped before NS-P50 rewires its caller, the query string it names goes
// missing and this fails.
//
// Selectors are roles and accessible names. Nothing here selects on a class:
// see the selector rules in the e2e skill.

import { expect, test } from "@playwright/test";

/**
 * A bounty page — /content/:slug — on a project carrying NS-P45 through
 * NS-P47, for a bounty that has at least one discussion comment.
 */
const LEGACY_BOUNTY_URL = process.env.E2E_LEGACY_BOUNTY_URL ?? "";

/** The PostgREST reads the page makes against the repointed discussion table. */
const DISCUSSION_REQUEST = /\/rest\/v1\/bounty_discussion_comments\?/;
/** And against the read-mark table, which the thread reads for its unread dots. */
const LAST_READ_REQUEST = /\/rest\/v1\/bounty_comment_last_read\?/;

test.describe("a legacy bounty thread after the repoint", () => {
  test.skip(
    !LEGACY_BOUNTY_URL,
    "No repointed bounty page to point at: public.bounties answers PGRST205 on the project in supabase/config.toml, so NS-P45 through NS-P47 are not applied there. Set E2E_LEGACY_BOUNTY_URL to a bounty page on a project that has them.",
  );

  test("asks for its discussion by the shim column, and renders it", async ({ page }) => {
    const discussionQueries: string[] = [];
    const lastReadQueries: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (DISCUSSION_REQUEST.test(url)) {
        discussionQueries.push(new URL(url).search);
      }
      if (LAST_READ_REQUEST.test(url)) {
        lastReadQueries.push(new URL(url).search);
      }
    });

    await page.goto(LEGACY_BOUNTY_URL);
    await page.waitForLoadState("networkidle");

    expect(
      discussionQueries.length,
      "the page made no request for the discussion at all",
    ).toBeGreaterThan(0);

    // The shim, as it appears on the wire. A page rewired early — or a shim
    // removed before NS-P50 — shows up here and nowhere else.
    for (const search of discussionQueries) {
      expect(search).toContain("legacy_bounty_item_id=eq.");
      expect(search).not.toContain("bounty_id=eq.");
    }
    // The read mark is filtered the same way, when the viewer is signed in
    // enough for the page to ask for one at all.
    for (const search of lastReadQueries) {
      expect(search).toContain("legacy_bounty_item_id=eq.");
      expect(search).not.toContain("bounty_id=eq.");
    }

    // And the answer is painted. An empty thread is the exact symptom of a
    // filter on the wrong column, so a page that lists nothing fails here even
    // though every request above was well formed.
    await expect(
      page.getByRole("button", { name: /^React$/ }).first(),
    ).toBeVisible();
  });

  test("still offers the reaction control on a rendered comment", async ({ page }) => {
    await page.goto(LEGACY_BOUNTY_URL);
    await page.waitForLoadState("networkidle");

    const react = page.getByRole("button", { name: /^React$/ }).first();
    await expect(react).toBeVisible();
    await react.click();

    // The picker opens against a comment id, which NS-P47 does not move —
    // bounty_comment_reactions reaches a bounty only through its comment and
    // was deliberately not repointed. Signed out, the affordance is there and
    // the write is refused by policy, which is the pre-NS-P47 behaviour and
    // must stay that way. The signed-in half — the reaction landing under RLS —
    // is check 6b of supabase/tests/ns-p47-repoint-bounty-satellites.sql, which
    // can sign in and this suite cannot: playwright.config.ts declares a
    // `setup` project with no `.setup.ts` behind it, so tier 3 has no auth
    // fixture.
    await expect(page.getByRole("button", { name: /^React$/ }).first()).toBeVisible();
  });
});
