// Mobile prompt 29g: four type sizes and one Mint fill per screen.
//
// On Home, Builds, OpenBuilds and Activity at 390 (and 360), every element that draws its own text has a computed font size of
// 13, 15 or 17 (24 only for a reading page's title, which none of the dock pages has). Named exceptions: a text field's 16, the
// size a phone needs so it does not zoom in on focus; the dock's unread count, 11/16 in its 16 tall pill (29d); and the default
// cover's title, a work's name in Geist Serif 22/28. And each
// page has exactly one element filled with Mint (`--brand-accent`): the round post button. Unread marks (the dock's unread pill,
// the avatar's square, Activity's dot), tagged `data-unread-mark`, are the Mint allowed beside it.
//
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-type-mint-29g --project=desktop

import { expect, test, type Page } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

const PAGES = [
  { path: "/", name: "Home", signedIn: false },
  { path: "/builds", name: "Builds", signedIn: false },
  { path: "/openbuilds", name: "OpenBuilds", signedIn: false },
  { path: "/notifications", name: "Activity", signedIn: true },
] as const;

const SIZES = new Set(["13px", "15px", "17px"]);

interface Sweep {
  offSize: string[];
  mint: string[];
}

/** Every visible element with text of its own, and every Mint-filled one, outside the named exceptions. */
async function sweep(page: Page): Promise<Sweep> {
  return page.evaluate((allowed) => {
    const probe = document.createElement("div");
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--brand-accent").trim();
    document.body.appendChild(probe);
    const mint = getComputedStyle(probe).color;
    probe.remove();
    const offSize: string[] = [];
    const fills: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || box.width === 0 || box.height === 0) continue;
      if (el.closest(".sr-only, [data-testid=skip-link]")) continue;
      const label = `${el.tagName.toLowerCase()}${el.dataset.testid ? `[${el.dataset.testid}]` : ""} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
      if (style.backgroundColor === mint && !el.closest("[data-unread-mark]")) fills.push(label);
      const ownText = [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "");
      const field = el.matches("input, textarea, [contenteditable=true]") || el.closest("[contenteditable=true]");
      if (field) {
        if (style.fontSize !== "16px") offSize.push(`${style.fontSize} ${label}`);
        continue;
      }
      if (el.closest("[data-unread-mark]")) continue;
      // The default cover's title is a work's name in Geist Serif 22/28, the size this prompt gives it.
      if (el.closest("[data-default-cover]") && style.fontSize === "22px") continue;
      if (ownText && !allowed.includes(style.fontSize)) offSize.push(`${style.fontSize} ${label}`);
    }
    return { offSize, mint: fills };
  }, [...SIZES]);
}

for (const theme of ["dark", "light"] as const) {
  for (const width of [390, 360] as const) {
    test.describe(`phone type and Mint at ${width}, ${theme}`, () => {
      test.use({ colorScheme: theme });
      for (const target of PAGES) {
        test(`${target.name}: 13, 15 and 17 only, and one Mint fill`, async ({ page }) => {
          await installPhoneStub(page, { signedIn: target.signedIn });
          await page.addInitScript((mode) => {
            try {
              window.localStorage.setItem("bg-theme", mode);
            } catch {
              /* storage-less context: the colour scheme still applies */
            }
          }, theme === "dark" ? "dusk" : "noon");
          await page.setViewportSize({ width, height: 844 });
          await page.goto(target.path);
          await expect(page.getByTestId("phone-top-bar")).toBeVisible();
          await expect(page.getByTestId("create-button")).toBeVisible();
          // Let the stubbed reads land, so the populated page is what is swept.
          await page.waitForLoadState("networkidle");
          const found = await sweep(page);
          expect(found.offSize, `${target.name}: sizes off 13, 15, 17`).toEqual([]);
          expect(found.mint, `${target.name}: Mint fills`).toEqual([expect.stringContaining("[create-button]")]);
        });
      }
    });
  }
}
