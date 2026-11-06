// Tier 1: UX-13 P4, one canonical per page, and it names openbuilds.ai whichever address the site is read on.
//
// The pages here need no sign-in and no data. The address the test runs on (127.0.0.1) stands in for the Lovable
// address or a preview: the canonical must not follow it.

import { expect, test } from "@playwright/test";

for (const path of ["/about", "/api-docs"]) {
  test(`${path} has one canonical, at openbuilds.ai`, async ({ page }) => {
    await page.goto(path);
    const canonical = page.locator('head link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    await expect(canonical).toHaveAttribute("href", `https://openbuilds.ai${path}`);
    await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute("content", `https://openbuilds.ai${path}`);
  });
}
