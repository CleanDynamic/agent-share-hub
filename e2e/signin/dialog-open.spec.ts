// G5, G6, G7: the sign-in dialog opens over the page it was asked from, carries its state in the address, closes four
// ways back to the same page with focus on the opener, and still ends a guarded visit signed in on the guarded page.
// RUN AGAINST MOCKS: Supabase is stubbed (every read is empty, a password sign-in succeeds); nothing reaches a project.
import { expect, test, type Page } from "@playwright/test";

const USER = {
  id: "00000000-0000-4000-8000-0000000000a1",
  aud: "authenticated",
  role: "authenticated",
  email: "ada@example.test",
  email_confirmed_at: new Date(0).toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

function jwt(payload: Record<string, unknown>) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

async function stub(page: Page) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await page.route(/supabase\.co\/rest\/v1\//, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fulfill({ status: 204, headers: cors })
      : route.fulfill({ status: 200, contentType: "application/json", headers: { ...cors, "content-range": "0-0/0" }, body: route.request().url().includes("/rpc/") ? "null" : "[]" }),
  );
  await page.route(/supabase\.co\/auth\/v1\//, (route) => {
    const url = route.request().url();
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.includes("/token")) {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: cors,
        body: JSON.stringify({ access_token: jwt({ sub: USER.id, exp, role: "authenticated" }), token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user: USER }),
      });
    }
    if (url.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(USER) });
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "{}" });
  });
  await page.route(/supabase\.co\/(storage|functions|realtime)\//, (route) => route.fulfill({ status: 200, headers: cors, body: "{}" }));
}

const dialog = (page: Page) => page.getByTestId("signin-dialog");

/** What the page behind looks like: its address and its main content's text, which the dialog must not change. */
const behind = (page: Page) => page.evaluate(() => ({ path: location.pathname, main: document.querySelector("main")?.textContent ?? document.body.firstElementChild?.textContent ?? "" }));

async function openFromHeader(page: Page, path: string) {
  await page.goto(path);
  const signIn = page.getByRole("banner").getByRole("button", { name: "Sign in" });
  await signIn.waitFor();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const before = { url: page.url(), page: await behind(page) };
  await signIn.click();
  await expect(dialog(page)).toBeVisible();
  return before;
}

test.describe("G5: opening over the page", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await stub(page);
  });

  for (const path of ["/", "/builds", "/b2/some-build"]) {
    test(`over ${path}: the address carries it, the page is unchanged, scroll is locked`, async ({ page }) => {
      const before = await openFromHeader(page, path);
      const url = new URL(page.url());
      expect(url.pathname).toBe(new URL(before.url).pathname);
      expect(url.searchParams.get("signin")).toBe("login");
      expect(await behind(page)).toEqual(before.page);
      expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
    });
  }

  for (const how of ["Escape", "Close", "scrim", "Back"] as const) {
    test(`${how} closes it, back to the same address, focus on Sign in`, async ({ page }) => {
      const before = await openFromHeader(page, "/builds");
      if (how === "Escape") await page.keyboard.press("Escape");
      if (how === "Close") await dialog(page).getByRole("button", { name: "Close" }).click();
      if (how === "scrim") await page.mouse.click(20, 450);
      if (how === "Back") await page.goBack();
      await expect(dialog(page)).toHaveCount(0);
      expect(page.url()).toBe(before.url);
      await expect(page.getByRole("banner").getByRole("button", { name: "Sign in" })).toBeFocused();
    });
  }

  test("Back steps out of reset to sign in, then closes", async ({ page }) => {
    const before = await openFromHeader(page, "/builds");
    await dialog(page).getByRole("link", { name: "Forgot password?" }).click();
    await expect(dialog(page)).toHaveAttribute("data-view", "reset");
    await page.goBack();
    await expect(dialog(page)).toHaveAttribute("data-view", "login");
    await page.goBack();
    await expect(dialog(page)).toHaveCount(0);
    expect(page.url()).toBe(before.url);
  });

  test("Close after two view changes leaves the address as it was", async ({ page }) => {
    const before = await openFromHeader(page, "/builds");
    await dialog(page).getByRole("button", { name: "Join free" }).click();
    await expect(dialog(page)).toHaveAttribute("data-view", "signup");
    await dialog(page).getByRole("button", { name: "Sign in" }).first().click();
    await expect(dialog(page)).toHaveAttribute("data-view", "login");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
    expect(page.url()).toBe(before.url);
  });
});

test.describe("G6: the six old addresses", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await stub(page);
  });
  const CASES = [
    { from: "/login", view: "login" },
    { from: "/signup", view: "signup" },
    { from: "/reset-password", view: "reset" },
    { from: "/reset-password/abc123", view: "reset", token: "abc123" },
    { from: "/verify-email", view: "verify" },
    { from: "/verify-email/abc123", view: "verify", token: "abc123" },
  ];
  for (const c of CASES) {
    test(`${c.from} opens Home with the ${c.view} view`, async ({ page }) => {
      await page.goto(c.from);
      await expect(dialog(page)).toHaveAttribute("data-view", c.view);
      const url = new URL(page.url());
      expect(url.pathname).toBe("/");
      expect(url.searchParams.get("signin")).toBe(c.view);
      if (c.token) expect(url.searchParams.get("token")).toBe(c.token);
      if (c.view === "signup") await expect(dialog(page).getByRole("button", { name: "Join free" })).toHaveAttribute("aria-pressed", "true");
    });
  }
  test("Join free opens with Join free selected", async ({ page }) => {
    await openFromHeader(page, "/");
    await dialog(page).getByRole("button", { name: "Join free" }).click();
    await expect(dialog(page).getByRole("button", { name: "Join free" })).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).searchParams.get("signin")).toBe("signup");
  });
});

test.describe("G7: redirect and returnTo", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await stub(page);
  });
  for (const key of ["redirect", "returnTo"]) {
    test(`a signed-out visit to a guarded page ends signed in on it (${key})`, async ({ page }) => {
      await page.goto(key === "redirect" ? "/library" : "/login?returnTo=%2Flibrary");
      await expect(dialog(page)).toHaveAttribute("data-view", "login");
      expect(new URL(page.url()).searchParams.get(key)).toBe("/library");
      await dialog(page).getByPlaceholder("Email or username").fill("ada@example.test");
      await dialog(page).getByPlaceholder("Enter your password").fill("correct horse");
      await dialog(page).locator('[data-variant="signin-primary"]').click();
      await expect(page).toHaveURL(/\/library$/);
      await expect(dialog(page)).toHaveCount(0);
    });
  }
});
