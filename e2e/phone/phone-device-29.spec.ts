// Mobile 29 audit, the parts a desktop browser can stand in for: performance under a mid-range phone's CPU, what a screen
// reader is given, and the gestures. Chromium with touch (hasTouch, isMobile) at 390 by 844.
//
// WHAT THIS IS NOT. It is not iOS Safari or Android Chrome, not VoiceOver or TalkBack, and not an on-screen keyboard: none
// of those run in this container. The CPU is slowed 4x through the DevTools protocol, which is the usual stand-in for a
// mid-range phone but not a measurement of one. The accessibility checks read the tree a screen reader is given (names,
// roles, states, focus), which is what VoiceOver and TalkBack announce from, without hearing them.
//
// Run: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/phone/phone-device-29 --project=desktop
// Numbers go to e2e/phone/shots/device-29.jsonl.

import { appendFileSync, mkdirSync } from "node:fs";

import { expect, test, type CDPSession, type Page } from "@playwright/test";

import { installPhoneStub } from "./support/phoneStub";

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

mkdirSync("e2e/phone/shots", { recursive: true });
const record = (row: Record<string, unknown>) => appendFileSync("e2e/phone/shots/device-29.jsonl", `${JSON.stringify(row)}\n`);

/** Counts each canvas's drawn frames (one clearRect a frame) and keeps every long task. Installed before the app loads. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const frames = new Map<HTMLCanvasElement, number>();
    (window as unknown as { __frames: typeof frames }).__frames = frames;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args: Parameters<typeof clear>) {
      frames.set(this.canvas, (frames.get(this.canvas) ?? 0) + 1);
      return clear.apply(this, args);
    };
    const tasks: number[] = [];
    (window as unknown as { __longTasks: number[] }).__longTasks = tasks;
    try {
      new PerformanceObserver((list) => list.getEntries().forEach((entry) => tasks.push(entry.duration))).observe({ type: "longtask", buffered: true });
    } catch {
      /* no longtask entries in this browser */
    }
  });
}

async function slowCpu(page: Page, rate = 4): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  return cdp;
}

/** Frames a second for the canvas matched by `selector`, over `ms`. */
async function fps(page: Page, selector: string, ms: number): Promise<number> {
  const count = () => page.evaluate((sel) => {
    const canvas = document.querySelector(sel) as HTMLCanvasElement | null;
    const frames = (window as unknown as { __frames: Map<HTMLCanvasElement, number> }).__frames;
    return canvas ? (frames.get(canvas) ?? 0) : -1;
  }, selector);
  const before = await count();
  await page.waitForTimeout(ms);
  const after = await count();
  return before < 0 || after < 0 ? -1 : ((after - before) * 1000) / ms;
}

test.describe("performance at 4x CPU", () => {
  for (const rate of [1, 4]) {
    test(`the sign-in water at ${rate}x CPU`, async ({ page }) => {
      await instrument(page);
      await installPhoneStub(page);
      await slowCpu(page, rate);
      await page.goto("/?signin=login");
      await page.getByTestId("signin-water").waitFor();
      await page.waitForTimeout(1500);
      const value = await fps(page, "[data-testid='signin-water']", 4000);
      record({ check: `sign-in water fps (${rate}x CPU)`, value: Math.round(value * 10) / 10, target: 60 });
    });

    test(`a loading field at ${rate}x CPU`, async ({ page }) => {
      await instrument(page);
      await installPhoneStub(page);
      /* Hold the feed's read so its loading field stays up. */
      await page.route("**/rest/v1/rpc/get_build_feed**", () => undefined);
      await slowCpu(page, rate);
      await page.goto("/");
      /* Wait until a canvas is drawing (a slowed CPU takes longer to mount the page), then give it a moment to settle. */
      await expect
        .poll(() => page.evaluate(() => [...(window as unknown as { __frames: Map<HTMLCanvasElement, number> }).__frames.values()].some((n) => n > 3)), { timeout: 20_000 })
        .toBe(true);
      await page.waitForTimeout(1000);
      /* The loading field's canvas can be swapped for a fresh one as the placeholders settle (a slowed CPU shows it), so
         each canvas is measured on its own over four one-second windows, and the best window of any loading canvas is
         kept: a swap can only flatter the figure, never pull it down. */
      const snapshot = () =>
        page.evaluate(() => {
          const out: Record<string, number> = {};
          let next = Number(document.documentElement.dataset.canvasIds ?? "0");
          for (const [canvas, n] of (window as unknown as { __frames: Map<HTMLCanvasElement, number> }).__frames.entries()) {
            if (!canvas.isConnected || !canvas.closest("[aria-busy='true']")) continue;
            if (!canvas.dataset.cid) canvas.dataset.cid = String(next++);
            out[canvas.dataset.cid] = n;
          }
          document.documentElement.dataset.canvasIds = String(next);
          return out;
        });
      let value = 0;
      let previous = await snapshot();
      for (let window = 0; window < 4; window++) {
        await page.waitForTimeout(1000);
        const current = await snapshot();
        for (const [id, n] of Object.entries(current)) if (id in previous) value = Math.max(value, n - previous[id]);
        previous = current;
      }
      record({ check: `loading field fps (${rate}x CPU)`, value: Math.round(value * 10) / 10, target: 30 });
    });
  }

  for (const [name, path] of [["home", "/"], ["builds", "/builds"]] as const) {
    test(`long tasks while scrolling ${name}`, async ({ page }) => {
      await instrument(page);
      await installPhoneStub(page);
      await page.goto(path);
      await page.waitForTimeout(2500);
      await slowCpu(page);
      await page.evaluate(() => ((window as unknown as { __longTasks: number[] }).__longTasks.length = 0));
      for (let step = 0; step < 12; step++) {
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(120);
      }
      for (let step = 0; step < 12; step++) {
        await page.mouse.wheel(0, -300);
        await page.waitForTimeout(120);
      }
      const tasks = await page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks);
      record({ check: `long tasks scrolling ${name} (4x CPU)`, count: tasks.length, max: Math.round(Math.max(0, ...tasks)), target: "none over 50ms" });
    });

    test(`images below the first screen load lazily on ${name}`, async ({ page }) => {
      await installPhoneStub(page);
      await page.goto(path);
      await page.waitForTimeout(2500);
      const eager = await page.evaluate(() =>
        [...document.images].filter((img) => img.getBoundingClientRect().top > window.innerHeight && img.loading !== "lazy").map((img) => img.currentSrc || img.src).slice(0, 10),
      );
      record({ check: `eager images below the fold on ${name}`, count: eager.length, examples: eager });
    });
  }
});

/** A finger dragged from (x, y) by (dx, dy), as touch events through the DevTools protocol (Chromium makes pointer events of them). */
async function drag(page: Page, x: number, y: number, dx: number, dy: number, steps = 8) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= steps; step++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * step) / steps, y: y + (dy * step) / steps }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

test.describe("what a screen reader is given", () => {
  test("the top bar's controls have names, the dock says which page is current, and the hidden h1 is there", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    await page.goto("/");
    const bar = page.locator("[data-ui='phone-top-bar']");
    await expect(bar.getByRole("button", { name: /account menu/ })).toBeVisible();
    await expect(bar.getByRole("link", { name: "OpenBuilds.ai home" })).toBeVisible();
    for (const control of await bar.locator("button, a").all()) expect((await control.getAttribute("aria-label")) || (await control.textContent())?.trim()).toBeTruthy();
    const dock = page.getByRole("navigation", { name: "Primary" });
    await expect(dock.locator("[aria-current='page']")).toHaveCount(1);
    await expect(dock.locator("[aria-current='page']")).toContainText("Home");
    await expect(page.locator("h1")).toHaveCount(1);
    record({ check: "top bar and dock, as a screen reader is given them", tree: await page.locator("body").ariaSnapshot().then((tree) => tree.split("\n").filter((line) => /banner|navigation "Primary"|current|heading .*level=1/.test(line)).slice(0, 12)) });
  });

  test("the More sheet is a dialog named by its title, closes on Escape and gives focus back to More", async ({ page }) => {
    await installPhoneStub(page);
    await page.goto("/b2/b-invoice");
    const more = page.locator("[data-ui='phone-top-bar']").getByRole("button", { name: "More" });
    await more.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(((await dialog.getAttribute("aria-labelledby")) || (await dialog.getAttribute("aria-label"))) ?? "").not.toBe("");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test("the account drawer is a dialog named Account, and gives focus back to the avatar", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    await page.goto("/");
    const avatar = page.locator("[data-ui='phone-top-bar']").getByRole("button", { name: /account menu/ });
    await avatar.click();
    await expect(page.getByRole("dialog", { name: "Account" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Account" })).toHaveCount(0);
    await expect(avatar).toBeFocused();
  });
});

test.describe("gestures, as touch", () => {
  test("a sheet closes on a swipe down from its handle", async ({ page }) => {
    await installPhoneStub(page);
    await page.goto("/b2/b-invoice");
    await page.locator("[data-ui='phone-top-bar']").getByRole("button", { name: "More" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.waitForTimeout(300);
    const box = await dialog.boundingBox();
    await drag(page, (box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + 10, 0, 160);
    await expect(dialog).toHaveCount(0, { timeout: 3000 });
  });

  test("the account drawer closes on a swipe left", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    await page.goto("/");
    await page.locator("[data-ui='phone-top-bar']").getByRole("button", { name: /account menu/ }).click();
    const drawer = page.getByRole("dialog", { name: "Account" });
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(300);
    const box = await drawer.boundingBox();
    await drag(page, (box?.x ?? 0) + (box?.width ?? 0) - 30, (box?.y ?? 0) + 200, -200, 0);
    await expect(drawer).toHaveCount(0, { timeout: 3000 });
  });

  test("a mostly vertical move in the drawer scrolls and does not close it", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    await page.goto("/");
    await page.locator("[data-ui='phone-top-bar']").getByRole("button", { name: /account menu/ }).click();
    const drawer = page.getByRole("dialog", { name: "Account" });
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(300);
    const box = await drawer.boundingBox();
    await drag(page, (box?.x ?? 0) + 150, (box?.y ?? 0) + 400, -30, -200);
    await page.waitForTimeout(400);
    await expect(drawer).toBeVisible();
  });
});

/** An on-screen keyboard `height` tall, as the visual viewport reports one (Chromium here has no on-screen keyboard). */
async function keyboard(page: Page, height: number) {
  await page.evaluate((covered) => {
    const vv = window.visualViewport;
    if (!vv) return;
    Object.defineProperty(vv, "height", { configurable: true, get: () => window.innerHeight - covered });
    vv.dispatchEvent(new Event("resize"));
  }, height);
}

test.describe("the keyboard, as the visual viewport reports it", () => {
  test("a topic's reply bar rides above a 300 keyboard, and the field is 16px so iOS does not zoom", async ({ page }) => {
    await installPhoneStub(page, { signedIn: {} });
    await page.goto("/openbuilds/topics/t-open");
    const field = page.getByTestId("reply-box").locator("textarea");
    await expect(field).toBeVisible({ timeout: 10_000 });
    await field.tap();
    await keyboard(page, 300);
    await page.waitForTimeout(300);
    const box = await field.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(844 - 300);
    expect(parseFloat(await field.evaluate((el) => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
    await page.screenshot({ path: "e2e/phone/shots/29-keyboard-topic.png" });
  });

  test("the round post button steps out of the way while the keyboard is open", async ({ page }) => {
    await installPhoneStub(page);
    await page.goto("/openbuilds");
    const button = page.getByRole("button", { name: "Post" }).last();
    await expect(button).toBeVisible({ timeout: 10_000 });
    await keyboard(page, 300);
    await expect(page.getByTestId("round-post-button")).toBeHidden();
    await keyboard(page, 0);
    await expect(page.getByTestId("round-post-button")).toBeVisible();
  });
});
