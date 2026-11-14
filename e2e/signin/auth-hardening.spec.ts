// Security prompt 7, the Playwright checks. RUN AGAINST MOCKS: Supabase is stubbed (support.ts) and Cloudflare's
// Turnstile script is replaced by a stand-in that hands out a token, so the bot-check token can be seen on each request.
import { expect, test, type Page, type Request } from "@playwright/test";

import { stub } from "./support";

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const REFUSAL = "That email or password isn't right.";

/** Cloudflare's script, faked: render hands a token over at once, and reset hands over a fresh one. */
async function fakeTurnstile(page: Page) {
  await page.route(/challenges\.cloudflare\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: `(function(){var n=0,o={};window.turnstile={render:function(h,opts){o=opts;setTimeout(function(){opts.callback("tok-"+(++n))},0);return "w"},reset:function(){setTimeout(function(){o.callback("tok-"+(++n))},0)},remove:function(){}};})();`,
    }),
  );
}

/** Password sign-in refused as the auth service refuses it: 400, invalid_credentials. */
async function refuseSignIn(page: Page, seen: Request[]) {
  await page.route(/supabase\.co\/auth\/v1\/token/, (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    seen.push(route.request());
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: cors,
      body: JSON.stringify({ code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }),
    });
  });
}

const dialog = (page: Page) => page.getByRole("dialog");
const primary = (page: Page) => dialog(page).locator('[data-variant="signin-primary"]');

async function signIn(page: Page, email: string, password = "a-password-1") {
  await dialog(page).getByPlaceholder("Email", { exact: true }).fill(email);
  await dialog(page).getByPlaceholder("Enter your password").fill(password);
  await primary(page).click();
}

test.beforeEach(async ({ page }) => {
  await stub(page);
  await fakeTurnstile(page);
});

test("1. a wrong password and an unknown email get the same refusal; any username gets the same answer, unsent", async ({ page }) => {
  const seen: Request[] = [];
  await refuseSignIn(page, seen);
  await page.goto("/?signin=login");

  const answers: string[] = [];
  for (const [email, password] of [
    ["ada@example.test", "the-wrong-password"],
    ["nobody-here@example.test", "a-password-1"],
  ]) {
    await signIn(page, email, password);
    await expect(dialog(page).getByText(REFUSAL)).toBeVisible();
    answers.push((await dialog(page).getByText(REFUSAL).textContent()) ?? "");
  }
  expect(answers).toEqual([REFUSAL, REFUSAL]);
  // Each request carried a bot-check token, and a fresh one each time.
  const tokens = seen.map((request) => (request.postDataJSON() as { gotrue_meta_security?: { captcha_token?: string } }).gotrue_meta_security?.captcha_token);
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).toMatch(/^tok-\d+$/);
  expect(tokens[1]).toMatch(/^tok-\d+$/);
  expect(tokens[0]).not.toBe(tokens[1]);

  // Sign-in is by email only: a username, known or not, is answered the same way and nothing is sent.
  const usernameAnswers: string[] = [];
  for (const username of ["ada_l", "nobody_at_all"]) {
    await signIn(page, username);
    const answer = dialog(page).getByText("Sign in with your email address.");
    await expect(answer).toBeVisible();
    usernameAnswers.push((await answer.textContent()) ?? "");
  }
  expect(usernameAnswers[0]).toBe(usernameAnswers[1]);
  expect(seen).toHaveLength(2);
});

test("2. joining with an address that already has an account shows Check your inbox", async ({ page }) => {
  await page.route(/supabase\.co\/auth\/v1\/signup/, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 422, contentType: "application/json", headers: cors, body: JSON.stringify({ code: 422, error_code: "user_already_exists", msg: "User already registered" }) }),
  );
  await page.goto("/?signin=signup");
  const view = dialog(page);
  await view.getByPlaceholder("Your name").fill("Ada Lovelace");
  await view.getByPlaceholder("username").fill("ada_l");
  await view.getByPlaceholder("you@example.com").fill("ada@example.test");
  await view.getByPlaceholder("At least 8 characters").fill("Abcdefghij1!xyz");
  // The terms box is a styled native checkbox; its label's box is what a person clicks (as e2e/tier1/auth-entry.spec.ts does).
  await view.locator('label[for="terms"] > div').first().click();
  await expect(view.locator("#terms")).toBeChecked();
  await expect(view.getByText("Username available")).toBeVisible();
  await view.getByRole("button", { name: "Create account" }).click();

  await expect(view.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await expect(view.getByText(/already/i)).toHaveCount(0);
});

test("3. signed out at /library?view=saved#top, sign in, and land on exactly that address", async ({ page }) => {
  await page.goto("/library?view=saved#top");
  await expect(dialog(page)).toBeVisible();
  await signIn(page, "ada@example.test");
  await expect.poll(() => {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}${url.hash}`;
  }).toBe("/library?view=saved#top");
});

test("4. a redirect to another site is refused: sign in lands on /", async ({ page }) => {
  await page.goto("/?signin=login&redirect=https://example.com");
  await signIn(page, "ada@example.test");
  await expect.poll(() => {
    const url = new URL(page.url());
    return `${url.host === "example.com" ? "LEFT THE SITE " : ""}${url.pathname}${url.search}`;
  }).toBe("/");
});
