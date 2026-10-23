/* CA-18 P4 — Details beside the build, at 1280, 1440, 1920 and 2560 wide by 900 tall.

   For three different selections at each width: nothing overlaps, Details stays inside the window, no text is cut off,
   and Build's left edge and width are the same whatever is selected.

     npm run audit -- composer-details-layout */

import { expect, test } from "@playwright/test";

const WIDTHS = [1280, 1440, 1920, 2560];
const SELECTIONS = ["prompt", "session", "tool"];

for (const width of WIDTHS) {
  test(`composer/details-layout/${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const builds: { left: number; width: number }[] = [];
    for (const details of SELECTIONS) {
      await page.goto(`/dev/kit/pages/sandbox?theme=noon&build=bakery&details=${details}`);
      await page.locator('section[aria-label="Build"]').waitFor();
      const build = await page.locator('section[aria-label="Build"]').boundingBox();
      expect(build).not.toBeNull();
      builds.push({ left: Math.round(build!.x), width: Math.round(build!.width) });
      const aside = page.getByTestId("details-aside");
      if ((await aside.count()) === 0) continue;
      const box = (await aside.boundingBox())!;
      expect(box.x, `${details}: no overlap with Build`).toBeGreaterThanOrEqual(build!.x + build!.width);
      expect(box.x + box.width, `${details}: inside the window`).toBeLessThanOrEqual(width);
      expect(box.y + box.height, `${details}: bottom inside the window`).toBeLessThanOrEqual(900);
      const cut = await aside.evaluate((node) => {
        const scrolls = node.getAttribute("data-scrolls") === "true";
        if (scrolls) return [] as string[];
        return Array.from(node.querySelectorAll<HTMLElement>("[data-section] p, [data-section] h4"))
          .filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === "hidden" && getComputedStyle(el).textOverflow !== "ellipsis")
          .map((el) => el.textContent ?? "");
      });
      expect(cut, `${details}: no cut-off text`).toEqual([]);
    }
    expect(new Set(builds.map((b) => `${b.left}:${b.width}`)).size, "Build is the same for every selection").toBe(1);
  });
}
