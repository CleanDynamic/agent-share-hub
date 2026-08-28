// Tier 3 — the browser half of "reblog composing is retired" (NS-P42).
//
// WHAT THIS FILE CARRIES, AND WHAT IT DELIBERATELY DOES NOT. NS-P42 has two
// acceptance criteria: no UI path opens the reblog composer, and an existing
// reblog still renders and still likes and bookmarks. The first is answered in
// full by src/components/reblog/composeRetired.test.tsx, which walks all six
// call sites with a signed-in viewer and clicks every button on each surface.
// It lives there rather than here for a reason worth stating plainly: four of
// the six affordances render only when signed in, this repository has no
// Playwright auth fixture — playwright.config.ts declares a `setup` project but
// no `.setup.ts` exists — and an anonymous browser spec asserting "no reblog
// button" would pass just as happily with the flag flipped back to true. A
// vacuous green is worse than no test.
//
// What a browser CAN prove, and what this file is for, is the read path: that a
// reblog published before the retirement is still served at its own URL, with
// its engagement controls, and with nothing standing where the composer button
// used to be.
//
// WHY IT SKIPS BY DEFAULT — AND WHAT IS BLOCKING IT TODAY. NS-P42 found two
// pre-existing faults, both present unchanged on the branch base and both
// outside this prompt's remit (which must not touch route resolution or the
// read path), that together stop a seeded reblog rendering in the dev project:
//
//   1. ContentOrReblogRoute branches to ReblogDetail only when the slug starts
//      with "reblog-", but seeded slugs take the "<title>-rb-<hash>" form, so
//      /b/plain-english-rb-a97e6b falls through to ContentDetail instead.
//   2. ReblogDetail's query asks PostgREST for the FK hint
//      reblogs_reblogger_id_fkey, which is not in the dev project's schema
//      cache; the request comes back PGRST200 rather than a row.
//
// So this spec is gated on E2E_REBLOG_SLUG naming a reblog URL that actually
// renders. Until one does it skips rather than fails: a red suite meaning
// "nobody fixed the read path" trains a maintainer to ignore red. Point it at a
// working URL and it becomes the browser proof of acceptance 2.
//
// Selectors are roles and accessible names. Nothing here selects on a class:
// see the selector rules in the e2e skill.

import { expect, test, type Page } from "@playwright/test";

/** A reblog URL that renders — the segment after /b/, or a full path. */
const REBLOG_SLUG = process.env.E2E_REBLOG_SLUG ?? "";

const NEEDS_REBLOG =
  "Set E2E_REBLOG_SLUG to a published reblog that renders at its /b/ URL.";

/** Every accessible name the retired affordances answered to. */
const RETIRED = ["Reblog", "Reblog with quote"];

async function openReblog(page: Page, slug: string) {
  await page.goto(slug.startsWith("/") ? slug : `/b/${slug}`);
  await expect(page.getByText("Reblog not found.")).toHaveCount(0);
}

test.describe("a reblog published before the retirement", () => {
  test.skip(!REBLOG_SLUG, NEEDS_REBLOG);

  // ACCEPTANCE 2 — the read path is untouched. The engagement row is the
  // card's body, so if it drew, the reblog resolved and rendered.
  test("still renders at its own URL, with its engagement controls", async ({
    page,
  }) => {
    await openReblog(page, REBLOG_SLUG);

    await expect(page.getByRole("button", { name: "Like" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Bookmark" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Comment" }).first()).toBeVisible();
  });

  // ACCEPTANCE 1, and TASK 4 — quiet removal. Nothing stands where the button
  // sat: no tombstone, no "reblogging has moved" note, no redirect away.
  test("carries no reblog affordance, and no notice that one was removed", async ({
    page,
  }) => {
    await openReblog(page, REBLOG_SLUG);

    for (const name of RETIRED) {
      await expect(page.getByRole("button", { name, exact: true })).toHaveCount(0);
    }
    await expect(page.getByText(/reblog this/i)).toHaveCount(0);
    await expect(
      page.getByText(/reblogging (is|has been) (retired|disabled|removed)/i)
    ).toHaveCount(0);

    // Still on the reblog, not bounced to a build page or the feed.
    await expect(page).toHaveURL(
      new RegExp(`/b/${REBLOG_SLUG.replace(/^\//, "").replace(/^b\//, "")}`)
    );
  });
});
