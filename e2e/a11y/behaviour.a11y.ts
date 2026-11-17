// G27: what the page-by-page run cannot see. Focus on the h1 after five navigations (G1), the skip link (G4), the sign-in
// dialog (in, trapped, Escape, back to its trigger), the account menu, and focus after three removals (G17).
// Everything is done from the keyboard. Light theme at 1440; the network is faked as in the matrix run.

import { expect, test, type Page } from "@playwright/test";

import { installCondition, signIn } from "../pagestate/network";
import { settle } from "./harness";

interface Focused {
  tag: string;
  id: string;
  text: string;
  label: string;
  tabIndex: number;
  outline: string;
  inDialog: boolean;
  inMain: boolean;
  role: string;
}

const focused = (page: Page): Promise<Focused> =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const style = el ? getComputedStyle(el) : null;
    return {
      tag: el?.tagName.toLowerCase() ?? "none",
      id: el?.id ?? "",
      text: (el?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      label: el?.getAttribute("aria-label") ?? "",
      tabIndex: el?.tabIndex ?? 0,
      outline: style ? `${style.outlineStyle} ${style.outlineWidth}` : "",
      inDialog: Boolean(el?.closest('[role="dialog"], [role="alertdialog"]')),
      inMain: Boolean(el?.closest("main")),
      role: el?.getAttribute("role") ?? "",
    };
  });

async function open(page: Page, path: string, signedIn = false): Promise<void> {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await installCondition(page, "empty");
  if (signedIn) await signIn(page);
  await page.goto(path, { waitUntil: "load", timeout: 120_000 });
  await settle(page);
}

/** Focus a control the way a keyboard user would arrive on it, then press Enter. */
async function activate(page: Page, locator: ReturnType<Page["locator"]>): Promise<void> {
  await locator.focus();
  await page.keyboard.press("Enter");
}

/** G1: focus on the new page's h1, which takes tabIndex -1 and draws no outline when focused this way. */
async function expectFocusOnH1(page: Page, title: RegExp): Promise<void> {
  await expect.poll(async () => (await focused(page)).tag, { message: "focus moves to the new page's h1", timeout: 8_000 }).toBe("h1");
  const now = await focused(page);
  expect(now.text).toMatch(title);
  expect(now.tabIndex).toBe(-1);
  expect(now.outline.startsWith("none") || now.outline.endsWith(" 0px")).toBe(true);
}

test.describe("G1: focus after a page change", () => {
  test("five navigations, by link and by Back", async ({ page }) => {
    await open(page, "/");
    const primary = page.getByRole("navigation", { name: "Primary" });
    await activate(page, primary.getByRole("link", { name: "Builds", exact: true }));
    await page.waitForURL(/\/builds$/);
    await expectFocusOnH1(page, /Builds/);

    await activate(page, primary.getByRole("link", { name: "OpenBuilds", exact: true }));
    await page.waitForURL(/\/openbuilds$/);
    await expectFocusOnH1(page, /OpenBuilds/);

    await activate(page, page.getByRole("link", { name: "About", exact: true }).last());
    await page.waitForURL(/\/about$/);
    await expectFocusOnH1(page, /About/);

    await activate(page, primary.getByRole("link", { name: "Home", exact: true }));
    await page.waitForURL((url) => url.pathname === "/");
    await expectFocusOnH1(page, /Home/);

    await page.goBack();
    await page.waitForURL(/\/about$/);
    await expectFocusOnH1(page, /About/);
  });
});

/** An in-app change of page by Back/Forward's path: the router reads the address on popstate, as on a real Back. */
const popTo = (page: Page, path: string) =>
  page.evaluate((to) => {
    // The router keys each entry; one without a key reads as the entry already on screen.
    const idx = ((window.history.state as { idx?: number } | null)?.idx ?? 0) + 1;
    window.history.pushState({ usr: null, key: `a11y${Date.now().toString(36)}`, idx }, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);

/** Hold every request to the Supabase host until `release()`; then each goes on to the faker. */
async function holdNetwork(page: Page): Promise<() => void> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.hostname !== "127.0.0.1" && url.hostname !== "localhost",
    async (route) => {
      await gate;
      await route.fallback().catch(() => undefined);
    },
  );
  return release;
}

test.describe("G2: a page whose h1 is not drawn yet", () => {
  for (const [kind, path] of [["Build", "/b2/a11y-missing"], ["Profile", "/profile/a11y-somebody"]] as const) {
    test(`${kind}: focus rests on the placeholder h1, then moves to the real h1`, async ({ page }) => {
      await open(page, "/");
      const release = await holdNetwork(page);
      await popTo(page, path);
      await expect.poll(async () => (await focused(page)).text, { message: "focus on the placeholder h1", timeout: 15_000 }).toBe(kind);
      expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-h1-placeholder"))).toBe(true);
      release();
      await expect.poll(() => page.evaluate(() => document.activeElement?.tagName === "H1" && !document.activeElement.hasAttribute("data-h1-placeholder")), { message: "focus on the real h1", timeout: 15_000 }).toBe(true);
    });
  }
});

test("D1: in the editor focus goes to Skip to build, and the page's title is said once", async ({ page }) => {
  await open(page, "/drafts", true);
  await popTo(page, "/compose/new");
  await expect.poll(async () => (await focused(page)).text, { message: "focus on Skip to build", timeout: 20_000 }).toBe("Skip to build");
  await expect(page.getByTestId("page-said")).toHaveText("Untitled build", { timeout: 20_000 });
  await expect(page.getByTestId("page-said")).toHaveAttribute("aria-live", "polite");
});

test("G3: a hash link on the same page moves focus to its anchor", async ({ page }) => {
  await open(page, "/privacy");
  const anchor = await page.evaluate(() => {
    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('main a[href^="#"]')).find((a) => a.getAttribute("href") !== "#main" && document.getElementById(a.hash.slice(1)));
    return link ? link.hash.slice(1) : null;
  });
  test.skip(!anchor, "the page has no in-page link");
  await activate(page, page.locator(`main a[href="#${anchor}"]`).first());
  await expect.poll(async () => (await focused(page)).id, { timeout: 8_000 }).toBe(anchor as string);
});

test("G4: the skip link moves focus into main", async ({ page }) => {
  await open(page, "/");
  await page.keyboard.press("Tab");
  expect((await focused(page)).text).toBe("Skip to content");
  await page.keyboard.press("Enter");
  const after = await focused(page);
  expect(after.tag + (after.id ? `#${after.id}` : ""), "focus lands on main#main").toBe("main#main");
  expect(after.outline.startsWith("none") || after.outline.endsWith(" 0px")).toBe(true);
  await page.keyboard.press("Tab");
  expect((await focused(page)).inMain, "the next Tab reaches the first control in main").toBe(true);
});

test("the sign-in dialog: focus in, trapped, Escape closes, focus back on its trigger", async ({ page }) => {
  await open(page, "/");
  const trigger = page.getByRole("banner").getByRole("button", { name: "Sign in", exact: true }).or(page.locator('[data-slot="header"]').getByRole("button", { name: "Sign in", exact: true })).first();
  await activate(page, trigger);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect.poll(async () => (await focused(page)).inDialog, { message: "focus moves into the dialog" }).toBe(true);
  for (let press = 0; press < 30; press++) {
    await page.keyboard.press("Tab");
    expect((await focused(page)).inDialog, `Tab ${press + 1} stays in the dialog`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await focused(page)).text).toBe("Sign in");
});

test("the account menu: Enter opens on the first item, arrows move, Escape closes and returns focus", async ({ page }) => {
  await open(page, "/settings/account", true);
  const button = page.locator('[data-slot="header"] button[aria-haspopup="menu"]').first();
  await activate(page, button);
  await expect(page.getByRole("menu")).toBeVisible();
  const first = await focused(page);
  expect(first.role).toBe("menuitem");
  await page.keyboard.press("ArrowDown");
  const second = await focused(page);
  expect(second.role).toBe("menuitem");
  expect(second.text).not.toBe(first.text);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  expect((await focused(page)).tag).toBe("button");
  expect(await button.evaluate((el) => el === document.activeElement)).toBe(true);
});

test.describe("G17: focus after a removal", () => {
  test("a filter chip removed: focus moves to the next chip", async ({ page }) => {
    await open(page, "/builds?f=field%3Aai-ml&open=1&state=confirmed&q=agents");
    const removes = page.getByRole("group", { name: "Active filters" }).getByRole("button", { name: /^Remove filter/ });
    await expect(removes.first()).toBeVisible();
    const before = await removes.count();
    expect(before).toBeGreaterThanOrEqual(2);
    const nextName = await removes.nth(1).getAttribute("aria-label");
    await activate(page, removes.first());
    await expect(removes).toHaveCount(before - 1);
    const now = await focused(page);
    expect(now.tag, "focus did not fall to the body").not.toBe("body");
    expect(now.label).toBe(nextName);
  });

  test("a connected app revoked: focus moves to the section's heading", async ({ page }) => {
    let revoked = false;
    await open(page, "about:blank");
    // After the faker, so these two answers come first: one app until it is revoked, then none.
    await page.route(/\/auth\/v1\/user\/oauth\/grants/, (route) => {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (route.request().method() === "DELETE") {
        revoked = true;
        return route.fulfill({ status: 204, headers: cors, body: "" });
      }
      const grants = revoked ? [] : [{ client: { id: "a11y-client", name: "A11y Test App", uri: null }, scopes: ["openid"], granted_at: "2026-01-01T00:00:00Z" }];
      return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(grants) });
    });
    await signIn(page);
    await page.goto("/settings/apps", { waitUntil: "load" });
    await settle(page);
    await activate(page, page.getByRole("button", { name: "Revoke A11y Test App" }));
    await activate(page, page.getByRole("group", { name: "Confirm" }).getByRole("button", { name: "Revoke", exact: true }));
    await expect(page.getByText("A11y Test App")).toHaveCount(0);
    const now = await focused(page);
    expect(now.tag, "focus did not fall to the body").not.toBe("body");
    expect(now.tag).toMatch(/^h[1-3]$/);
  });

  test("a dialog opened by address, with no trigger, closed: focus goes to the page's h1", async ({ page }) => {
    await open(page, "/?signin=login");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const now = await focused(page);
    expect(now.tag, "focus did not fall to the body").not.toBe("body");
    expect(now.tag).toBe("h1");
  });
});
