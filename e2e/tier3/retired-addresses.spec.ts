// UX-11 P1: three retired addresses, opened on the built site (`vite build && vite preview`), land where that thing lives
// now and keep their search string. The unit test (src/lib/routing/retiredAddresses.test.tsx) covers every address; this one
// shows the real bundle follows it. The destinations are public pages, so nothing here needs a session or a backend: the
// assertion is the address the browser ends on.

import { expect, test } from "@playwright/test";

const CASES: ReadonlyArray<readonly [string, RegExp]> = [
  ["/browse?q=claude", /\/builds\?q=claude$/],
  ["/openbuilds/solvers", /\/openbuilds$/],
  ["/feed?x=1", /\/builds\?x=1$/],
];

for (const [from, landed] of CASES) {
  test(`${from} lands on its new address`, async ({ page }) => {
    await page.goto(from);
    await expect(page).toHaveURL(landed);
    // One hop: the entry was replaced, so Back leaves the site rather than returning to the old address.
    expect(await page.evaluate(() => window.history.length)).toBeLessThanOrEqual(2);
  });
}
