// Tier 3 — the browser half of "generation-1 bounty responses are frozen"
// (NS-P44).
//
// WHAT THIS FILE CARRIES, AND WHAT IT DELIBERATELY DOES NOT. NS-P44 has two
// acceptance criteria: no UI path submits a new `bounty_responses` row, and an
// existing response still renders. Both are answered in full by
// src/lib/bounty-gen1/gen1ResponsesRetired.test.tsx, which mounts the composer
// directly, calls the write gate, and paints an archived response on the
// creator profile with a signed-in viewer. They live there rather than here for
// two reasons, and the second is the finding of this prompt's audit:
//
//   1. No Playwright auth fixture. playwright.config.ts declares a `setup`
//      project but no `.setup.ts` exists, and the composer affordance rendered
//      only for a signed-in, non-posting viewer. An anonymous browser spec
//      asserting "no Submit a Blueprint button" would pass just as happily with
//      GEN1_BOUNTY_RESPONSES_ENABLED flipped back to true. A vacuous green is
//      worse than no test.
//
//   2. There is no generation-1 schema to render from. Measured 28 Aug 2026
//      against the project in supabase/config.toml: `bounty_responses`,
//      `bounty_me_too` and `bounty_response_verifications` each answer PGRST205
//      ("could not find the table in the schema cache"), and
//      `content_items.bounty_enabled` answers Postgres 42703 ("column does not
//      exist"). supabase/migrations/20260323000001_bounty_system.sql was
//      authored and never applied. No bounty in the dev project can show a
//      response section at all, because the column the section is gated on is
//      not there. docs/retired-surfaces.md carries the full measurement.
//
// There is also no reachable page to point a browser at. The only mount of
// BountyResponseComposer is in src/pages/ContentDetail.legacy.tsx, which no
// route registers and no module imports — App.tsx routes /content/:id to
// src/pages/ContentDetail.tsx, which is generation-2 only.
//
// So this spec skips by default, and states its price of entry. It becomes the
// browser proof the day someone applies the March migration and re-routes the
// legacy page — which is exactly the day the freeze starts mattering. Until
// then a red suite meaning "nobody restored a retired schema" would only train
// a maintainer to ignore red.
//
// Selectors are roles and accessible names. Nothing here selects on a class:
// see the selector rules in the e2e skill.

import { expect, test } from "@playwright/test";

/**
 * A URL that renders a generation-1 bounty response section — the page whose
 * "Submit a Blueprint →" affordance NS-P44 guarded off. Requires both the
 * March migration applied and ContentDetail.legacy re-routed.
 */
const GEN1_BOUNTY_URL = process.env.E2E_GEN1_BOUNTY_URL ?? "";

test.describe("generation-1 bounty responses are frozen", () => {
  test.skip(
    !GEN1_BOUNTY_URL,
    "No generation-1 bounty page exists: the March 2026 schema is not applied to this project and ContentDetail.legacy is not routed. Set E2E_GEN1_BOUNTY_URL to a page that renders a response section to run this."
  );

  test("offers no way to submit a new response", async ({ page }) => {
    await page.goto(GEN1_BOUNTY_URL);

    // A sibling control from the same section, so a page that failed to render
    // cannot pass as a page with the button removed.
    await expect(page.getByRole("button", { name: /^Top$/ })).toBeVisible();

    await expect(
      page.getByRole("button", { name: /submit a blueprint/i })
    ).toHaveCount(0);
    await expect(page.getByText("Submit your Blueprint")).toHaveCount(0);
  });

  test("still renders the responses already written", async ({ page }) => {
    await page.goto(GEN1_BOUNTY_URL);

    // The read path is outside the flag: the list, its sort and its counts are
    // untouched by the freeze.
    await expect(page.getByText(/Responses$/)).toBeVisible();
    await expect(
      page.getByText(/No responses yet\. Be the first to solve this!/)
    ).toHaveCount(0);
  });
});
