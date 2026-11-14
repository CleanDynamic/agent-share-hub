// Part D: the code style (G21 to G23) and its font (step 13). RUN AGAINST MOCKS (e2e/signin/support.ts).
import { expect, test, type Page } from "@playwright/test";

import { stub } from "./support";

/** Count the window listeners the code style adds and removes, by event name. */
async function countWindowListeners(page: Page) {
  await page.addInitScript(() => {
    const live: Record<string, number> = {};
    (window as unknown as { __live: Record<string, number> }).__live = live;
    const names = ["pointerdown", "pointerup", "pointercancel", "keydown", "keyup", "blur"];
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    const fromLayer = () => /HalftoneLayer/.test(new Error().stack ?? "");
    window.addEventListener = ((type: string, ...rest: unknown[]) => {
      if (names.includes(type) && fromLayer()) live[type] = (live[type] ?? 0) + 1;
      return (add as (...a: unknown[]) => void)(type, ...rest);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, ...rest: unknown[]) => {
      if (names.includes(type) && fromLayer()) live[type] = (live[type] ?? 0) - 1;
      return (remove as (...a: unknown[]) => void)(type, ...rest);
    }) as typeof window.removeEventListener;
  });
}
const live = (page: Page) => page.evaluate(() => (window as unknown as { __live: Record<string, number> }).__live);

const layer = (page: Page) => page.getByTestId("signin-halftone");
const mode = (page: Page) => layer(page).getAttribute("data-mode");

async function openOver(page: Page) {
  await page.goto("/builds");
  await page.waitForLoadState("networkidle");
  await page.getByRole("banner").getByRole("button", { name: "Sign in" }).click();
  await page.getByTestId("signin-dialog").waitFor();
  await expect(layer(page)).toHaveAttribute("data-font", /.+/);
  await page.waitForTimeout(2200);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page);
});

test("step 13: the sheet is drawn in Geist Mono, and in the system monospace when the font is blocked", async ({ page, browser }) => {
  await openOver(page);
  await expect(layer(page)).toHaveAttribute("data-font", "geist-mono");

  const blocked = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await stub(blocked);
  await blocked.route("**/GeistMono-Variable.woff2", (route) => route.abort());
  await openOver(blocked);
  await expect(layer(blocked)).toHaveAttribute("data-font", "fallback");
  await blocked.keyboard.down("Shift");
  await expect(layer(blocked)).toHaveAttribute("data-mode", "code");
  await blocked.keyboard.up("Shift");
  await blocked.close();
});

test("G21: a held mouse button and a held key switch to characters and back; a tap shows for 0.14s", async ({ page }) => {
  await openOver(page);
  expect(await mode(page)).toBe("dots");
  // Inside the dialog (its picture): a press and release on the scrim is a click, which closes it (G5).
  await page.mouse.move(450, 300);
  await page.mouse.down();
  expect(await mode(page)).toBe("code");
  await page.waitForTimeout(800);
  expect(await mode(page)).toBe("code");
  await page.mouse.up();
  expect(await mode(page)).toBe("dots");

  await page.keyboard.down("Shift");
  expect(await mode(page)).toBe("code");
  await page.keyboard.up("Shift");
  // A quick press stays on for its 0.14s, then goes.
  await expect.poll(() => mode(page), { timeout: 1000 }).toBe("dots");

  // A tap: on at once, still on just after the release, off after 0.14s.
  const shown = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const canvas = document.querySelector('[data-testid="signin-halftone"]')!;
        window.dispatchEvent(new PointerEvent("pointerdown"));
        const on = performance.now();
        window.dispatchEvent(new PointerEvent("pointerup"));
        const watch = () => (canvas.getAttribute("data-mode") === "dots" ? resolve(performance.now() - on) : requestAnimationFrame(watch));
        watch();
      }),
  );
  expect(shown).toBeGreaterThanOrEqual(140);
  expect(shown).toBeLessThan(260);
});

test("G21: typing in the email and password fields triggers it", async ({ page }) => {
  await openOver(page);
  for (const placeholder of ["Email", "Enter your password"]) {
    await page.getByPlaceholder(placeholder).focus();
    await page.keyboard.down("a");
    expect(await mode(page)).toBe("code");
    await page.keyboard.up("a");
    await expect.poll(() => mode(page), { timeout: 1000 }).toBe("dots");
  }
});

test("G21: pointercancel, window blur and the 0.6s safety timeout each let go", async ({ page }) => {
  await openOver(page);
  const after = (fire: string, waitMs = 300) =>
    page.evaluate(
      ([fire, waitMs]) =>
        new Promise<string | null>((resolve) => {
          window.dispatchEvent(fire === "key" ? new KeyboardEvent("keydown", { key: "a" }) : new PointerEvent("pointerdown"));
          setTimeout(() => {
            if (fire === "cancel") window.dispatchEvent(new PointerEvent("pointercancel"));
            if (fire === "blur") window.dispatchEvent(new FocusEvent("blur"));
            setTimeout(() => resolve(document.querySelector('[data-testid="signin-halftone"]')!.getAttribute("data-mode")), Number(waitMs));
          }, 200);
        }),
      [fire, String(waitMs)] as const,
    );
  expect(await after("cancel", 50)).toBe("dots");
  expect(await after("blur", 50)).toBe("dots");
  // A keydown with no keyup and no repeat: on until the 0.6s safety timeout (fired 200ms in, checked at 200 + 300 and 200 + 500).
  expect(await after("key", 300)).toBe("code");
  await page.waitForTimeout(200);
  expect(await mode(page)).toBe("dots");
});

test("G22: the window listeners exist only while the dialog is open", async ({ page }) => {
  await countWindowListeners(page);
  await page.goto("/builds");
  await page.waitForLoadState("networkidle");
  expect(Object.values(await live(page)).every((n) => n === 0)).toBe(true);
  await page.getByRole("banner").getByRole("button", { name: "Sign in" }).click();
  await expect(layer(page)).toHaveCount(1);
  await expect.poll(async () => await live(page)).toEqual({ pointerdown: 1, pointerup: 1, pointercancel: 1, keydown: 1, keyup: 1, blur: 1 });
  await page.keyboard.press("Escape");
  await expect.poll(async () => await live(page)).toEqual({ pointerdown: 0, pointerup: 0, pointercancel: 0, keydown: 0, keyup: 0, blur: 0 });
});

test("G23: no character inside the dialog grown by 10 sideways and 14 up and down", async ({ page }) => {
  await openOver(page);
  // Held on the dialog's picture: a held mouse button has no safety timeout (Playwright's held key sends no repeats).
  await page.mouse.move(450, 300);
  await page.mouse.down();
  expect(await mode(page)).toBe("code");
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(300);
    const inside = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="signin-halftone"]')!;
      const dialog = document.querySelector<HTMLElement>('[data-testid="signin-dialog"]')!;
      const ratio = canvas.width / canvas.clientWidth;
      const box = [dialog.offsetLeft - 10, dialog.offsetTop - 14, dialog.offsetWidth + 20, dialog.offsetHeight + 28].map((v) => Math.round(v * ratio));
      const data = canvas.getContext("2d")!.getImageData(box[0], box[1], box[2], box[3]).data;
      let max = 0;
      for (let k = 3; k < data.length; k += 4) max = Math.max(max, data[k]);
      return max;
    });
    expect(inside).toBe(0);
    expect(await mode(page)).toBe("code");
  }
  await page.mouse.up();
});
