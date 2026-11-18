// G8 and G9 kept: at 320 CSS pixels (400% zoom on a 1280 window) no page in the matrix scrolls sideways (WCAG 1.4.10).
// Dark theme only: the layout is the same in both. The widest element is named so a failure says where to look.

import { expect, test } from "@playwright/test";

import { openPage, writeResult } from "./harness";
import { MATRIX, slugOf } from "./matrix";

for (const entry of MATRIX) {
  test(`reflow at 320 · ${entry.name}`, async ({ page }) => {
    // A kit page draws a fixed 390 or 1440 board, not the page at the window's width, so it is opened at its real address
    // (signed in, the network faked as "empty"). Build steps has none of its own: Build covers it.
    test.skip(Boolean(entry.kit) && !entry.real, "a dev kit page with no real address");
    const opened = entry.kit ? { name: entry.name, path: entry.real, signedIn: true, state: "empty" } : entry;
    await openPage(page, opened, { theme: "dark", width: 390 });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.waitForTimeout(800);
    const seen = await page.evaluate(() => {
      const width = document.documentElement.scrollWidth;
      const widest = Array.from(document.querySelectorAll("body *"))
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(el).position !== "fixed")
        .filter((el) => !Array.from(el.children).some((child) => child.getBoundingClientRect().right > window.innerWidth + 1))
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[aria-label="${el.getAttribute("aria-label")}"]` : ""} "${(el.textContent ?? "").trim().slice(0, 30)}" to ${Math.round(el.getBoundingClientRect().right)}`);
      return { width, widest };
    });
    writeResult(`reflow-${slugOf(entry.name)}`, { page: entry.name, ...seen });
    expect(seen.width, `scrolls sideways: ${seen.widest.join("; ")}`).toBeLessThanOrEqual(320);
  });
}
