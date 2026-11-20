// TB-02 — Community rules, Report a problem and Contact, in a real browser.
//
// THE BACKEND IS FAKED: /rest/v1/, /auth/v1/, /storage/v1/ and /functions/v1/ are answered here, the realtime socket and the
// font CDN are silenced. These pages read no data, so every request gets an empty answer. Nothing reaches the network.
// Set E2E_SHOTS=1 to also write the twelve screenshots to design/audits/tb-02/.

import { expect, test, type Page } from "@playwright/test";

const PAGES = [
  { path: "/rules", title: "Community rules", second: "reproductions-and-rebuilds", side: "Report a problem", sideHref: "/report" },
  { path: "/report", title: "Report a problem", second: "block-someone", side: "Contact", sideHref: "/contact" },
  { path: "/contact", title: "Contact", second: "email", side: "Community rules", sideHref: "/rules" },
] as const;
const THEMES = [
  { name: "dusk", stored: "dusk" },
  { name: "noon", stored: "noon" },
] as const;

async function fake(page: Page, theme: string) {
  // Local app files may load; all external traffic is blocked unless a stub below answers it.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:5173").origin
      ? route.continue()
      : route.abort();
  });
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* private window: the default theme is a fine ground */
    }
  }, theme);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* silent */
  });
  await page.route(/\/auth\/v1\//, (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }));
  await page.route(/\/(storage|functions)\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
  await page.route(/\/rest\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "*/0" }, body: "[]" }),
  );
}

const box = async (page: Page, locator: ReturnType<Page["locator"]>) => {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box");
  return b;
};

for (const theme of THEMES) {
  for (const p of PAGES) {
    test.describe(`${p.path} at 1440 in ${theme.name}`, () => {
      test.use({ viewport: { width: 1440, height: 900 } });

      test("title, columns and side column sit on the grid", async ({ page }) => {
        await fake(page, theme.stored);
        await page.goto(p.path);
        const h1 = page.getByRole("heading", { level: 1, name: p.title });
        await expect(h1).toBeVisible();
        const type = await h1.evaluate((el) => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight }));
        expect(type).toEqual({ size: "20px", weight: "500" });
        const h = await box(page, h1);
        expect(Math.abs(h.x - 64)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(h.y - 88)).toBeLessThanOrEqual(0.5);

        const first = await box(page, page.getByTestId("footer-main").locator("section").first());
        const side = await box(page, page.getByRole("complementary", { name: "About this page" }));
        expect(Math.abs(first.x - 64)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(side.x - 1072)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(first.y - side.y)).toBeLessThanOrEqual(0.5);

        if (process.env.E2E_SHOTS) await page.screenshot({ path: `design/audits/tb-02/${p.path.slice(1)}-1440-${theme.name}.png` });
      });

      test("a hash scrolls its card into view, and the side links navigate", async ({ page }) => {
        await fake(page, theme.stored);
        await page.goto(`${p.path}#${p.second}`);
        await expect(page.getByRole("heading", { level: 1, name: p.title })).toBeVisible();
        await expect.poll(async () => (await box(page, page.locator(`section#${p.second}`))).y).toBeLessThan(400);

        await page.getByRole("navigation", { name: "In this page" }).getByRole("link").first().click();
        await expect(page).toHaveURL(new RegExp(`${p.path}#${p.path === "/rules" ? "what-you-must-not-do" : p.path === "/report" ? "report-something" : "who-we-are"}$`));
        await page.getByRole("navigation", { name: "Related pages" }).getByRole("link", { name: p.side }).click();
        await expect(page).toHaveURL(new RegExp(`${p.sideHref}$`));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      });
    });
  }
}

for (const theme of THEMES) {
  for (const p of PAGES) {
    test.describe(`${p.path} at 390 in ${theme.name}`, () => {
      test.use({ viewport: { width: 390, height: 844 } });

      test("no sideways scroll, side below the cards, hit areas of 44", async ({ page }) => {
        await fake(page, theme.stored);
        await page.goto(p.path);
        await expect(page.getByRole("heading", { level: 1, name: p.title })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

        const cards = page.getByTestId("footer-main").locator("section");
        const last = await box(page, cards.last());
        const side = await box(page, page.getByRole("complementary", { name: "About this page" }));
        expect(side.y).toBeGreaterThanOrEqual(last.y + last.height - 0.5);

        const small = await page.getByTestId("footer-page").getByRole("link").evaluateAll((links) =>
          links
            .map((el) => el.getBoundingClientRect())
            .filter((b) => b.width > 0 && (b.height < 43.5 || b.width < 43.5))
            .map((b) => `${Math.round(b.width)}x${Math.round(b.height)}`),
        );
        expect(small).toEqual([]);

        if (process.env.E2E_SHOTS) await page.screenshot({ path: `design/audits/tb-02/${p.path.slice(1)}-390-${theme.name}.png` });
      });
    });
  }
}
