// Tier 1 — BG-P27, the signed-out entry.
//
// WHY TIER 1. These six routes are the only way into the application, they
// render OUTSIDE the frame (`Layout` hands the auth prefixes straight through
// to their route), and nothing else in the suite touches them: every tier-3
// spec is written against a surface inside the frame. A break here is a break
// for every visitor who is not already signed in.
//
// WHY A BROWSER SPEC AND NOT ONLY A UNIT TEST. authPaint.test.tsx asserts what
// each component RENDERS; jsdom has no layout engine, so it cannot answer
// whether the card fits at 390, whether anything reaches past the viewport, or
// whether the theme attribute actually reaches the paint. Those are the
// questions here, and neither file is the other's substitute.
//
// WHAT IT DELIBERATELY DOES NOT DO. It signs nobody in. There is no auth setup
// project in this repository and no seeded account, so a spec that tried would
// be asserting against whatever the Supabase project happens to hold. What it
// CAN prove without credentials is that every route renders its card, that the
// submit gate still opens and closes on the same input it always did, and that
// nothing on the way in overflows — which is what a repaint can break.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["exhibition", "dusk"] as const;
const SWEEP = [1400, 768, 390];

/* `/auth/callback` polls Supabase for a session for ten seconds and then shows
   its failure card, so a spec that holds the page open across three widths sees
   BOTH states. Its mark matches either — which state it is in is the callback's
   own behaviour and not something this repaint moved. */
const ROUTES = [
  { name: "login", path: "/login", mark: /Sign in/ },
  { name: "signup", path: "/signup", mark: /Create account/ },
  {
    name: "callback",
    path: "/auth/callback",
    mark: /Signing you in…|Couldn't complete sign-in/,
  },
  { name: "verify-email", path: "/verify-email", mark: /Check your inbox/ },
  { name: "reset-password", path: "/reset-password", mark: /Reset your password/ },
] as const;

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((choice) => {
    try {
      window.localStorage.setItem("bg-theme", choice);
    } catch {
      /* private window — the default theme is a fine fallback for a render */
    }
  }, theme);
}

async function open(page: Page, path: string, viewport: number, theme = "exhibition") {
  await withTheme(page, theme);
  await page.setViewportSize({ width: viewport, height: 900 });
  await page.goto(path);
  await page.getByText("buildgallery", { exact: true }).first().waitFor();
}

/**
 * True when anything on the page reaches past the viewport in either direction.
 * The scroller exemption is BG-P18b's, carried over unchanged: an element
 * inside a horizontal scroller is clipped by it, so the document check on the
 * first line is the one that can see it.
 */
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

/* ONE TEST PER ROUTE AND ROOM, SWEEPING THE WIDTHS INSIDE IT. Five navigations
   against a real dev server do not fit in one test's budget — the same reason
   wide-layout.spec.ts splits its widths — but three RESIZES of one loaded page
   do, and a resize is what the overflow claim is actually about. */
test.describe("every auth route renders, in both rooms, at every width", () => {
  for (const route of ROUTES) {
    for (const theme of THEMES) {
      test(`${route.name} in ${theme}`, async ({ page }) => {
        await open(page, route.path, SWEEP[0], theme);
        // The theme reached the paint rather than only the storage.
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        for (const viewport of SWEEP) {
          await page.setViewportSize({ width: viewport, height: 900 });
          await expect(
            page.getByText(route.mark).first(),
            `${route.path} did not render in ${theme} at ${viewport}`,
          ).toBeVisible();
          expect(
            await overflows(page),
            `${route.path} overflows in ${theme} at ${viewport}`,
          ).toBe(false);
        }
      });
    }
  }
});

test.describe("the visitor can choose their room before signing in", () => {
  test("the toggle is on the page and flips the attribute", async ({ page }) => {
    await open(page, "/login", 1400, "exhibition");
    const group = page.getByRole("radiogroup", { name: "Theme" });
    await expect(group).toBeVisible();

    await group.getByRole("radio", { name: "Dusk" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dusk");

    await group.getByRole("radio", { name: "Exhibition" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "exhibition");
  });
});

test.describe("the sign-in gate still opens on the same input", () => {
  test("submit is disabled until both fields are filled", async ({ page }) => {
    await open(page, "/login", 1400);
    const submit = page.getByRole("button", { name: "Sign in" });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder("Email or username").fill("someone@example.com");
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder("Enter your password").fill("hunter2hunter2");
    await expect(submit).toBeEnabled();
  });

  test("the password toggle still reveals and hides the field", async ({ page }) => {
    await open(page, "/login", 1400);
    const field = page.getByPlaceholder("Enter your password");
    await field.fill("hunter2hunter2");
    await expect(field).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(field).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(field).toHaveAttribute("type", "password");
  });

  test("the three OAuth buttons are present and enabled", async ({ page }) => {
    await open(page, "/login", 1400);
    for (const name of ["Continue with Google", "Continue with GitHub", "Continue with X"]) {
      await expect(page.getByRole("button", { name })).toBeEnabled();
    }
  });
});

test.describe("the strength meter reads on both grounds", () => {
  for (const theme of THEMES) {
    test(`${theme} moves through three states`, async ({ page }) => {
      await open(page, "/signup", 1400, theme);
      const field = page.getByPlaceholder("At least 8 characters");
      const meter = page.getByRole("img", { name: /Password strength/ });

      await field.fill("abcdefg");
      await expect(meter).toHaveAttribute("aria-label", "Password strength: Weak");
      // Three segments, not four — the fourth tier is a word, not a colour.
      expect(await meter.locator("> div").count()).toBe(3);

      await field.fill("abcdefgh1");
      await expect(meter).toHaveAttribute("aria-label", "Password strength: Fair");

      await field.fill("abcdefghij1!");
      await expect(meter).toHaveAttribute("aria-label", "Password strength: Good");

      await field.fill("Abcdefghij1!x");
      await expect(meter).toHaveAttribute("aria-label", "Password strength: Strong");
    });
  }
});

test.describe("the signup gate", () => {
  test("holds until every field and the terms box are done", async ({ page }) => {
    await open(page, "/signup", 1400);
    const submit = page.getByRole("button", { name: "Create account" });
    await expect(submit).toBeDisabled();

    await page.getByPlaceholder("Your name").fill("Ada Lovelace");
    await page.getByPlaceholder("username").fill("adalovelace");
    await page.getByPlaceholder("you@example.com").fill("ada@example.com");
    await page.getByPlaceholder("At least 8 characters").fill("Abcdefghij1!x");
    // Still shut: the terms box is the last gate, and it is the control whose
    // focus mark this prompt had to add.
    await expect(submit).toBeDisabled();

    /* CLICKED ON THE BOX, NOT THE INPUT AND NOT THE WORDS. The real control is
       `sr-only`, so Playwright rightly refuses to click it — the same fact that
       made its missing focus ring an affordance defect worth fixing. The label's
       words are not a target either: they carry the Terms and Privacy links, so
       a click in the middle of them navigates instead of ticking. */
    await page.locator('label[for="terms"] > div').first().click();
    await expect(page.locator("#terms")).toBeChecked();
    await expect(submit).toBeEnabled();
  });
});
