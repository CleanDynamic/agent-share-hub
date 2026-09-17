// Tier 3 — EX-P03, the two ways /oauth/consent can be reached without a request
// it can answer.
//
// WHY THESE TWO AND NOT THE HAPPY PATH. Approving or denying a real request
// needs a pending authorization on the auth service and a signed-in account that
// owns it — a fixture this suite deliberately does not have, because tier 3 runs
// with no auth and no seeded data so that a red suite means "something broke"
// rather than "nobody seeded the database". The two states below need neither.
// They are also the two that fail SILENTLY when they regress: a consent page
// that renders nothing is indistinguishable from a slow one, and a redirect that
// drops the query string looks like a working login until the visitor arrives
// back at an empty card and the application that sent them here is still
// waiting.
//
// BOTH VIEWPORTS, SET PER TEST. The `mobile` project in playwright.config.ts
// matches tier 1 only, so a tier-3 file covers the phone the way the other
// repaint specs in this directory do: `setViewportSize` inside the desktop
// project, once per width. 1400 and 390 are two of the three widths the theme
// names for overflow.
//
// SELECTORS ARE ROLE AND ACCESSIBLE NAME. No `.ns-*` class appears here — those
// live in the old shell and are scheduled for extraction — and no Tailwind
// utility either. The heading is a heading, the way out is a link, and the
// redirect is asserted on the URL, which is the thing that actually has to be
// right.

import { expect, test, type Page } from "@playwright/test";

/** Desktop and phone. The phone width is the one the theme names for overflow. */
const WIDTHS = [
  { name: "desktop", width: 1400, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/**
 * A plausible authorization id.
 *
 * IT DOES NOT NEED TO EXIST, and that is the whole reason this file needs no
 * fixture. The assertion is about what happens BEFORE the id is ever sent
 * anywhere: a signed-out visitor is redirected to sign in, and the id is only
 * looked up afterwards. A real id would prove nothing extra and would tie the
 * test to a backend it must not need.
 */
const AUTHORIZATION_ID = "11111111-2222-3333-4444-555555555555";

/** True when anything on the page reaches past the viewport horizontally. */
const overflowsX = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );

for (const viewport of WIDTHS) {
  test.describe(`EX-P03 — /oauth/consent error states (${viewport.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test("without an authorization_id it explains itself instead of rendering blank", async ({
      page,
    }) => {
      await page.goto("/oauth/consent");

      // The state is identity-independent, so it is reached signed out rather
      // than through a login round trip that ends in the same sentence.
      await expect(page).toHaveURL(/\/oauth\/consent$/);

      await expect(
        page.getByRole("heading", { name: "Nothing to authorize" })
      ).toBeVisible();

      // "Tidy, not blank" is a claim about what a visitor can read and do, so it
      // is asserted as both: a sentence that names the situation, and a way out.
      await expect(
        page.getByText("there is nothing here to allow or deny", { exact: false })
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Go to buildgallery" })).toBeVisible();

      // Neither decision may be offered when there is nothing to decide.
      await expect(page.getByRole("button", { name: "Allow" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Deny" })).toHaveCount(0);

      expect(await overflowsX(page)).toBe(false);
    });

    test("signed out it sends you to log in and keeps the authorization_id for the way back", async ({
      page,
    }) => {
      await page.goto(`/oauth/consent?authorization_id=${AUTHORIZATION_ID}`);

      await expect(page).toHaveURL(/\/login\?redirect=/);

      // THE ASSERTION THAT MATTERS. A redirect carrying only the pathname would
      // satisfy "goes to login" and still lose the request — the visitor would
      // sign in, return, and be told there is nothing to authorize. So the
      // decoded target is compared whole, query string included.
      const back = new URL(page.url()).searchParams.get("redirect");
      expect(back).toBe(`/oauth/consent?authorization_id=${AUTHORIZATION_ID}`);

      // And the login page is actually rendered, not merely routed to. The
      // login card carries no heading — its own submit button is the element
      // that says which card this is, so that is what is asserted.
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

      expect(await overflowsX(page)).toBe(false);
    });
  });
}
