// Tier 3 — the browser half of "the home ActiveCompetitions strip and the
// discover query still render legacy metas, with the shims gone" (NS-P50).
//
// WHERE THE ACCEPTANCE IS ACTUALLY PROVEN, AND WHY THIS FILE IS THE THIRD PLACE
// RATHER THAN THE FIRST. NS-P48 moved meta_bounty_id and spawned_bounty_id off
// content_items and onto public.bounties on meta_bounty_sub_definitions, kept
// the legacy meta surfaces working through derived legacy_meta_item_id and
// legacy_spawned_item_id columns, and closed the table to bounties that live on
// a build. NS-P50 dropped both shims: every read resolves through
// bounties.legacy_item_id instead, in one batch for a strip and one lookup for
// a page. The freeze stays. That claim is answered in two places that can
// answer it today:
//
//   * supabase/tests/ns-p48-repoint-meta-sub-definitions.sql — check 6 reads a
//     legacy meta's sub-definitions as anon through the shim and confirms the
//     spawn pointer it hands back is a content_items row, then shows the author
//     filing, editing and deleting on their own meta where a third party is
//     refused all three. Check 5 proves the freeze twice: below row level
//     security, where the trigger binds service_role too, and in the INSERT
//     policy on its own. Under real RLS, against real Postgres. That is the
//     half a browser cannot prove — a policy that leaks renders identically to
//     one that does not.
//
//   * src/lib/bounty-competition/legacyMetaRedirect.test.ts — every read
//     resolves its header and then names the real column, the spawn pointer
//     that reaches the UI is mapped back to a content_items id because
//     MetaBountyBody routes on it, both writes supply a real bounties id, and
//     meta_bounty_pledges is left exactly where NS-P49 will find it.
//
// WHAT IS LEFT FOR A BROWSER is the join between the two: that the pages as
// shipped resolve their headers, ask PostgREST for the real columns and paint
// what comes back. This
// spec asserts exactly that, and it skips by default, because the project in
// supabase/config.toml cannot answer it — public.bounties answers PGRST205
// there, so NS-P45 through NS-P48 are not applied and every sub-definition in
// that database is still keyed the old way. Pointed at it, this spec would go
// green on the OLD shape and stay green if the shims were deleted, which is
// worse than not running: a vacuous green trains a maintainer to trust a check
// that is not checking.
//
// THE THIRD NS-P48 SURFACE, THE META-BOUNTY PAGE ITSELF, IS ASSERTED HERE TOO —
// getMetaBountyState is what /content/:id runs for a meta, and it is the only
// one of the three whose answer includes a spawn pointer that a click turns
// into a route. Set E2E_LEGACY_META_URL to exercise it.
//
// TO RUN ANY OF IT, point the variables below at a project where the migrations
// are applied. The request assertions then become the real thing: if a shim is
// dropped before NS-P50 rewires its caller, the query string it names goes
// missing and this fails.
//
// Selectors are roles and accessible names. Nothing here selects on a class:
// see the selector rules in the e2e skill.

import { expect, test } from "@playwright/test";

/**
 * Set to "1" against a project carrying NS-P45 through NS-P48 whose home strip
 * has at least one approved meta bounty with sub-definitions.
 */
const REPOINTED = process.env.E2E_META_REPOINTED === "1";
/** A meta-bounty page — /content/:id — on that same project. */
const LEGACY_META_URL = process.env.E2E_LEGACY_META_URL ?? "";

/** The PostgREST read every one of these surfaces makes. */
const SUB_DEFINITIONS_REQUEST = /\/rest\/v1\/meta_bounty_sub_definitions\?/;

function recordSubDefinitionQueries(page: import("@playwright/test").Page): string[] {
  const searches: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (SUB_DEFINITIONS_REQUEST.test(url)) {
      searches.push(new URL(url).search);
    }
  });
  return searches;
}

test.describe("the legacy meta surfaces after the repoint", () => {
  test.skip(
    !REPOINTED,
    "No repointed project to point at: public.bounties answers PGRST205 on the project in supabase/config.toml, so NS-P45 through NS-P48 are not applied there. Set E2E_META_REPOINTED=1 against a project that has them.",
  );

  test("the home ActiveCompetitions strip resolves its metas, then asks by meta_bounty_id", async ({
    page,
  }) => {
    const searches = recordSubDefinitionQueries(page);

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(
      searches.length,
      "the home strip made no request for sub-definitions at all — is there an approved meta bounty on this project?",
    ).toBeGreaterThan(0);

    // The redirect, as it appears on the wire. The strip holds content_items
    // ids (it reads content_items) and resolves them in one batch before it
    // asks; the route's own ids in meta_bounty_id would match nothing and the
    // strip would render every meta with an empty sub-bounty list rather than
    // fail.
    for (const search of searches) {
      expect(search).toContain("meta_bounty_id=in.");
      expect(search).not.toContain("legacy_meta_item_id");
    }

    // And the answer is painted. An empty list is the exact symptom of a filter
    // on the wrong column, so a strip that shows no sub-bounty progress fails
    // here even though every request above was well formed.
    await expect(page.getByText(/pledged/i).first()).toBeVisible();
  });

  test("the discover free-text search expands, then maps its matches back", async ({ page }) => {
    const searches = recordSubDefinitionQueries(page);

    // Any free-text bounty search runs expandBountySearchIds, whose rows are
    // OR-included into a content_items id filter — so the headers it matches
    // are mapped back through bounties.legacy_item_id before they get there.
    await page.goto("/discover?q=bounty");
    await page.waitForLoadState("networkidle");

    for (const search of searches) {
      expect(search).toContain("select=meta_bounty_id");
      expect(search).not.toContain("legacy_meta_item_id");
    }
  });

  test("a legacy meta page lists its sub-bounties and links a spawned one to /content", async ({
    page,
  }) => {
    test.skip(
      !LEGACY_META_URL,
      "Set E2E_LEGACY_META_URL to a meta-bounty page on a repointed project.",
    );
    const searches = recordSubDefinitionQueries(page);

    await page.goto(LEGACY_META_URL);
    await page.waitForLoadState("networkidle");

    expect(
      searches.length,
      "the meta page made no request for its sub-definitions at all",
    ).toBeGreaterThan(0);
    for (const search of searches) {
      expect(search).toContain("meta_bounty_id=eq.");
      expect(search).not.toContain("legacy_meta_item_id");
      // The spawn pointer is selected as the real column and mapped back to a
      // content_items id in the data layer: MetaBountyBody navigates to
      // /content/:id with it, and a bounties id there is a 404 on a bounty that
      // exists.
      expect(search).toContain("spawned_bounty_id");
      expect(search).not.toContain("legacy_spawned_item_id");
    }

    // The list is painted, which an empty answer would not be.
    await expect(page.getByRole("button", { name: /pledge/i }).first()).toBeVisible();
  });
});
