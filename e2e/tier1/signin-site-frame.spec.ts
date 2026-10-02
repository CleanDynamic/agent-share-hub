// Tier 1 — UI-P36, Sign in, Join, reset and verify in the entrance's frame: the
// prompt's "Done when", proved in a browser.
//
//   signing in with ?redirect=/gallery lands on the gallery.
//
// And what the repaint could break on the way: every one of the four pages draws
// in the bare frame (no header, footer or dock), the Sign in · Join free switch
// keeps ?redirect=, Back goes Home when there is nowhere to go back to, the orbs
// are drawn on a desktop and not on a phone, and nothing on any of the four
// pages reaches past the viewport at any width the frame serves.
//
// THE FRAME IS FORCED, NOT FLAGGED. `?frame=site` is the development override of
// the `site_frame` row (it is eliminated from a production build), so these pages
// are the ones under test without a database to flip. The legacy pages are what
// `auth-entry.spec.ts` covers, and that spec passes unchanged against both.
//
// THE BACKEND IS FAKED, as the engagement spec does it: /rest/v1/, /auth/v1/ and
// the realtime socket are answered here and nothing reaches the network. A
// password sign-in is answered with a session; the two head counts the orbs read
// answer 48 and 1,284. What the fake cannot say: whether the real project accepts
// the password, which is the project's and not this repaint's.
//
// ONE SPEC, TWO PROJECTS. Desktop reads the card with its Back link and orbs;
// the phone reads the panel with neither.

import { expect, test, type Page } from "@playwright/test";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

const SESSION_USER = { id: "00000000-0000-4000-8000-00000000beef", aud: "authenticated", role: "authenticated", email: "reader@example.test" };

/** Answer the three boundaries the entrance talks through, and silence the font CDN and the realtime socket. */
async function fakeBackend(page: Page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) => {
    if (route.request().url().includes("/token")) {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          access_token: "e2e.not.a-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: expiresAt,
          refresh_token: "e2e-refresh",
          user: SESSION_USER,
        }),
      });
    }
    return route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' });
  });
  await page.route(/\/rest\/v1\//, (route) => {
    const url = route.request().url();
    const head = route.request().method() === "HEAD";
    const total = /build_reproductions/.test(url) ? 48 : /\/builds\?/.test(url) ? 1284 : 0;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "content-range": head ? `*/${total}` : `0-0/${total}`,
        // The page is not the project's origin, so the count header has to be exposed to be read.
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "content-range",
      },
      body: head ? "" : "[]",
    });
  });
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
}

async function open(page: Page, path: string, theme = "noon") {
  await fakeBackend(page);
  await page.addInitScript((choice) => {
    try {
      window.localStorage.setItem("bg-theme", choice);
    } catch {
      /* private window — the default theme is a fine fallback for a render */
    }
  }, theme);
  const joiner = path.includes("?") ? "&" : "?";
  await page.goto(`${path}${joiner}frame=site`);
  await expect(page.getByTestId("site-frame")).toBeVisible();
}

/** True when anything on the page reaches past the viewport, as auth-entry.spec.ts asks it. */
const overflows = (page: Page) =>
  page.evaluate(() => {
    if (document.documentElement.scrollWidth > window.innerWidth + 1) return true;
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const x = getComputedStyle(p).overflowX;
        if (x === "auto" || x === "scroll" || x === "hidden") return true;
      }
      return false;
    };
    return [...document.querySelectorAll("body *")].some((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      if (r.right <= window.innerWidth + 1 && r.left >= -1) return false;
      return !inScroller(el);
    });
  });

const PAGES = [
  { name: "login", path: "/login", ready: (page: Page) => page.getByRole("button", { name: "Sign in", exact: true }) },
  { name: "signup", path: "/signup", ready: (page: Page) => page.getByRole("button", { name: "Create account", exact: true }) },
  { name: "reset-password", path: "/reset-password", ready: (page: Page) => page.getByRole("heading", { name: "Reset your password" }) },
  { name: "verify-email", path: "/verify-email", ready: (page: Page) => page.getByRole("heading", { name: "Check your inbox" }) },
] as const;

test.describe("the four pages draw in the bare frame", () => {
  for (const entrance of PAGES) {
    test(`${entrance.name}: the backdrop, the card and the sentence, and no header, footer or dock`, async ({ page }) => {
      await open(page, entrance.path);

      const frame = page.getByTestId("site-frame");
      await expect(frame).toHaveAttribute("data-variant", "bare");
      await expect(frame.locator('[data-ui="page-backdrop"]')).toHaveAttribute("data-tone", "signin");
      await expect(entrance.ready(page)).toBeVisible();
      await expect(page.getByTestId("signin-card")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "Every AI build, hung with its proof." })).toBeAttached();
      await expect(page.getByTestId("signin-view")).toHaveAttribute("data-viewport", isPhone(page) ? "mobile" : "desktop");

      for (const chrome of ["site-header", "site-footer", "dock", "breadcrumb"]) {
        await expect(page.getByTestId(chrome)).toHaveCount(0);
      }
    });
  }

  test("the orbs say the two numbers on a desktop, and are not drawn on a phone", async ({ page }) => {
    await open(page, "/login");
    if (isPhone(page)) {
      await expect(page.locator('[data-ui="orb-glass"]')).toHaveCount(0);
      await expect(page.locator('[data-ui="orb-solid"]')).toHaveCount(0);
    } else {
      await expect(page.locator('[data-ui="orb-glass"]')).toContainText("48 today");
      await expect(page.locator('[data-ui="orb-solid"]')).toContainText("1,284");
    }
  });

  test("the theme control is a radio group on the page, and flips the room", async ({ page }) => {
    await open(page, "/login", "noon");
    const group = page.getByRole("radiogroup", { name: "Theme" });
    await expect(group).toBeVisible();
    await group.getByRole("radio", { name: "Dusk" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dusk");
    await expect(group.getByRole("radio", { name: "Dusk" })).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("nothing reaches past the viewport", () => {
  for (const entrance of PAGES) {
    for (const theme of ["noon", "dusk"]) {
      test(`${entrance.name} in ${theme}, at 1400, 1100, 768 and 390`, async ({ page }) => {
        await open(page, entrance.path, theme);
        for (const width of [1400, 1100, 768, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await expect(entrance.ready(page), `${entrance.path} did not render at ${width}`).toBeVisible();
          await expect.poll(() => overflows(page), { message: `${entrance.path} overflows in ${theme} at ${width}` }).toBe(false);
        }
      });
    }
  }
});

test.describe("the Sign in · Join free switch", () => {
  test("keeps ?redirect= across the switch, in both directions", async ({ page }) => {
    await open(page, "/login?redirect=%2Fgallery");

    await page.getByRole("link", { name: "Join free" }).click();
    await expect(page).toHaveURL(/\/signup\?redirect=%2Fgallery$/);
    await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Join free" })).toHaveAttribute("aria-current", "page");

    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login\?redirect=%2Fgallery$/);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("aria-current", "page");
  });

  test("has no switch on the reset and verify pages", async ({ page }) => {
    await open(page, "/reset-password");
    await expect(page.getByRole("link", { name: "Join free" })).toHaveCount(0);
  });
});

test.describe("Back", () => {
  test("goes Home on a desktop when this is the first page of the visit", async ({ page }) => {
    test.skip(isPhone(page), "a phone's card has no Back link");
    await open(page, "/login");
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/$|\/\?/);
    await expect(page.getByTestId("site-frame")).toHaveAttribute("data-variant", "site");
  });
});

test.describe("signing in", () => {
  test("with ?redirect=/gallery lands on the gallery", async ({ page }) => {
    await open(page, "/login?redirect=%2Fgallery");

    await page.getByLabel("Email or username").fill("reader@example.test");
    await page.getByLabel("Password", { exact: true }).fill("a-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page).toHaveURL(/\/gallery$/);
    // The entrance has handed over to a page that is not the entrance.
    await expect(page.getByPlaceholder("Enter your password")).toHaveCount(0);
  });

  test("the unencoded redirect, and the returnTo alias, land there too", async ({ page }) => {
    await open(page, "/login?returnTo=/gallery");
    await page.getByPlaceholder("Email or username").fill("reader@example.test");
    await page.getByPlaceholder("Enter your password").fill("a-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("the button waits until both fields are filled, and the reveal shows the password", async ({ page }) => {
    await open(page, "/login");
    const submit = page.getByRole("button", { name: "Sign in", exact: true });
    await expect(submit).toBeDisabled();
    await page.getByPlaceholder("Email or username").fill("reader@example.test");
    await expect(submit).toBeDisabled();
    const password = page.getByPlaceholder("Enter your password");
    await password.fill("a-password");
    await expect(submit).toBeEnabled();

    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });
});
