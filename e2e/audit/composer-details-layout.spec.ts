/* CA-18b P2, Synth 09: the three panels (Sources, Build, Details) as one box, 8 apart and 8 from the window's edges, the box
   centred once Build is at its 760.

   At 1152 to 2560 wide by 900 tall, with nothing selected and then with a long prompt selected: the box is centred (or fills
   the window), Build's left and width are the same in both states, no panel overlaps another, the title row's panel spans the
   box, Details stays inside the window, and no text in Details is cut off.

     npm run audit -- composer-details-layout */

import { expect, test } from "@playwright/test";

const WIDTHS = [1152, 1280, 1440, 1600, 1920, 2560];
const STATES = ["none", "prompt"];

for (const width of WIDTHS) {
  test(`composer/details-layout/${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const builds: { left: number; width: number }[] = [];
    const publishes: number[] = [];
    for (const details of STATES) {
      await page.goto(`/dev/kit/pages/sandbox?theme=noon&build=bakery&details=${details}&window=1`);
      await page.locator('section[aria-label="Build"]').waitFor();
      // Build's column is the post and the list together: the head and the Build section share its left and width.
      const column = (await page.getByTestId("sandbox-build-head").boundingBox())!;
      const build = (await page.locator('section[aria-label="Build"]').boundingBox())!;
      expect(Math.abs(build.x - column.x), `${details}: the list is in the same column as the post`).toBeLessThanOrEqual(1);
      builds.push({ left: Math.round(column.x), width: Math.round(column.width) });
      const sources = (await page.getByTestId("sandbox-sources-slot").boundingBox())!;
      expect(sources.x + sources.width, `${details}: Sources does not overlap Build`).toBeLessThanOrEqual(column.x);
      expect(sources.x, `${details}: Sources is 8 or more from the window's edge`).toBeGreaterThanOrEqual(8 - 1);
      const slot = page.getByTestId("sandbox-details-slot");
      const right = (await slot.count()) > 0 ? (await slot.boundingBox())!.x + (await slot.boundingBox())!.width : null;
      if (right !== null) {
        // The box: Sources' left to Details' right, centred in the window (or 8 from each edge while Build is under 760).
        expect(Math.abs((sources.x + right) / 2 - width / 2), `${details}: the box is centred`).toBeLessThanOrEqual(1);
        // CA-18b P5: one box. The title row's panel runs from Sources' left to Details' right; the title is 16 in.
        const row = (await page.getByTestId("sandbox-tabrow").boundingBox())!;
        expect(Math.abs(row.x - sources.x), `${details}: the title row starts at Sources' left`).toBeLessThanOrEqual(1);
        expect(Math.abs(row.x + row.width - right), `${details}: the title row ends at Details' right`).toBeLessThanOrEqual(1);
        const title = (await page.getByTestId("sandbox-heading").boundingBox())!;
        expect(Math.abs(title.x - (sources.x + 16)), `${details}: the title is 16 inside the row`).toBeLessThanOrEqual(1);
      }
      const publish = (await page.getByRole("button", { name: "Publish", exact: true }).boundingBox())!;
      publishes.push(Math.round(publish.x + publish.width));
      const aside = page.getByTestId("details-aside");
      if ((await aside.count()) === 0) continue;
      const box = (await aside.boundingBox())!;
      expect(box.x, `${details}: Details is right of Build`).toBeGreaterThanOrEqual(column.x + column.width + 8 - 1);
      expect(box.x + box.width, `${details}: Details is 8 or more from the window's edge`).toBeLessThanOrEqual(width - 8 + 1);
      expect(box.y + box.height, `${details}: bottom inside the window`).toBeLessThanOrEqual(900);
      const cut = await aside.evaluate((node) => {
        const right = node.getBoundingClientRect().right;
        const out: string[] = [];
        for (const el of Array.from(node.querySelectorAll<HTMLElement>("p, h4, span, li"))) {
          if (el.getBoundingClientRect().right > right + 1) out.push(el.textContent ?? "");
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === "hidden" && getComputedStyle(el).textOverflow !== "ellipsis") out.push(el.textContent ?? "");
        }
        return out;
      });
      expect(cut, `${details}: no cut-off text`).toEqual([]);
    }
    expect(new Set(publishes).size, "Publish does not move when the selection changes").toBe(1);
    expect(new Set(builds.map((b) => `${b.left}:${b.width}`)).size, "Build is the same with nothing selected and with a prompt selected").toBe(1);
  });
}
