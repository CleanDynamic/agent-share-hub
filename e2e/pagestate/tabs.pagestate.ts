// G17: a deliberate sign-out stays deliberate in every tab. Three tabs of one browser, signed in as the same member, the
// network faked ("empty": every read answers, with nothing). The member signs out in the first; the second, on a protected
// page, goes quietly Home; the third, on an open page, stays where it is as a visitor's. Neither shows the dialog or the
// signed-out notice. Run: npx playwright test -c playwright.pagestate.config.ts tabs

import { expect, test } from "@playwright/test";

import { installCondition, signIn } from "./network";

const NOTICE = "You've been signed out";

test("a sign-out in one tab is quiet in the others", async ({ context }) => {
  test.setTimeout(60_000);
  const tabs = [await context.newPage(), await context.newPage(), await context.newPage()];
  for (const tab of tabs) {
    await installCondition(tab, "empty");
    await signIn(tab);
  }
  const [here, protectedTab, openTab] = tabs;
  await protectedTab.goto("/library");
  await openTab.goto("/builds");
  await here.goto("/builds");
  for (const tab of tabs) await expect(tab.getByRole("button", { name: "Sign out" })).toBeVisible({ timeout: 15_000 });

  await here.getByRole("button", { name: "Sign out" }).click();

  await expect(protectedTab).toHaveURL((url) => url.pathname === "/" && !url.searchParams.has("signin"), { timeout: 10_000 });
  await expect(openTab.getByRole("link", { name: "Sign in" }).first()).toBeVisible({ timeout: 10_000 });
  // Long enough for a dialog to have opened, had it been going to.
  await openTab.waitForTimeout(2_000);
  for (const tab of [protectedTab, openTab]) {
    expect(new URL(tab.url()).searchParams.has("signin"), `no dialog in ${tab.url()}`).toBe(false);
    await expect(tab.getByText(NOTICE)).toHaveCount(0);
  }
  expect(new URL(openTab.url()).pathname).toBe("/builds");
});
