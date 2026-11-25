// Mobile 29 audit, the sign-in fields: the input inside each field is 20 tall, drawn in a 48 box. A tap anywhere on the box
// (its padding, left of the text and right of it, top and bottom edges) must focus the input, so the touch target is the box.
// Touch is emulated (hasTouch, isMobile), so the taps are touch events, not mouse clicks. Dark and light, at 360 and 390.
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-signin-fields-29 --project=desktop

import { expect, test } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

test.use({ hasTouch: true, isMobile: true });

for (const theme of ["dusk", "noon"] as const) {
  for (const width of [360, 390]) {
    for (const view of ["login", "signup"] as const) {
      test(`${view} at ${width}, ${theme}: a tap anywhere on a field's box focuses its input`, async ({ page }) => {
        await installPhoneStub(page);
        await page.addInitScript((value) => window.localStorage.setItem("bg-theme", value), theme);
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/?signin=${view}`);
        const card = page.locator("[data-occlude]");
        await expect(card).toBeVisible();
        const inputs = card.locator("input:not([type='checkbox']):not([type='hidden'])");
        const count = await inputs.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index++) {
          const input = inputs.nth(index);
          const name = (await input.getAttribute("aria-label")) ?? `input ${index}`;
          /* The box is the input's nearest ancestor at least 44 tall: the label's drawn field. */
          const boxRect = await input.evaluate((el) => {
            let node: HTMLElement | null = el.parentElement;
            while (node && node.getBoundingClientRect().height < 44) node = node.parentElement;
            const r = (node ?? el).getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          });
          const inputRect = await input.boundingBox();
          expect(boxRect.height, `${name}: the box is a 44 target`).toBeGreaterThanOrEqual(44);
          /* Points on the box that are outside the input itself. */
          const points = [
            { x: boxRect.x + 4, y: boxRect.y + boxRect.height / 2 },
            { x: boxRect.x + boxRect.width / 2, y: boxRect.y + 3 },
            { x: boxRect.x + boxRect.width / 2, y: boxRect.y + boxRect.height - 3 },
          ].filter((p) => !inputRect || p.x < inputRect.x || p.x > inputRect.x + inputRect.width || p.y < inputRect.y || p.y > inputRect.y + inputRect.height);
          expect(points.length, `${name}: there is box outside the input to tap`).toBeGreaterThan(0);
          for (const point of points) {
            await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
            await page.touchscreen.tap(point.x, point.y);
            await expect(input, `${name}: a tap at ${Math.round(point.x)},${Math.round(point.y)}`).toBeFocused();
          }
          /* 16px or more, so iOS does not zoom on focus. */
          expect(parseFloat(await input.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
        }
      });
    }
  }
}
