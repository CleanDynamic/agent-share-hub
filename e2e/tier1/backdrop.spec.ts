// Tier 1 — UI-P13b, the living backdrop, against its test plan in a browser:
//
//   a click or tap, and Enter or Space on a focused control, send a wavefront and
//   the field keeps drawing; prefers-reduced-motion draws one frame and ignores
//   input; without WebGL the static room is the backdrop and nothing throws; the
//   canvas is created once per document, not per page or per frame.
//
// WHAT IT CANNOT SAY: the frame rate. Headless Chromium draws WebGL in software
// (SwiftShader), a few frames a second, so 60fps during scroll stays a manual
// DevTools check on real hardware (design/BASELINE.md).
//
// TIME IS THE TEST'S. Software WebGL at desktop size, with workers in parallel,
// can hold a frame for longer than a ripple lives (4s), so the input tests
// install Playwright's clock, pause it, send the input and advance it a known
// amount: the frames that run, and each ripple's age in them, are then exact.
//
// HOW IT LOOKS INSIDE. An init script wraps the WebGL prototype before the app
// loads and counts draws, shader compiles and contexts, and keeps the last
// `ripples` uniform. The app is not asked anything and exposes nothing.

import { expect, test, type Page } from "@playwright/test";

// Software WebGL, and no throttling of frames in windows the headless browser
// considers in the background: with parallel workers it otherwise holds a page's
// animation frames for seconds, longer than a ripple lives.
test.use({
  launchOptions: {
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
    ],
  },
});

interface Probe {
  draws: number;
  compiles: number;
  contexts: number;
  /** Every live ripple slot drawn so far: [x, y, born], born in `performance.now()` ms. */
  seen: number[][];
}

function instrument() {
  const probe = { draws: 0, compiles: 0, contexts: 0, seen: [] as number[][] };
  (window as unknown as { __backdrop: typeof probe }).__backdrop = probe;
  const gl = WebGLRenderingContext.prototype;
  const names = new WeakMap<WebGLUniformLocation, string>();
  const getUniformLocation = gl.getUniformLocation;
  gl.getUniformLocation = function (program, name) {
    const location = getUniformLocation.call(this, program, name);
    if (location) names.set(location, name);
    return location;
  };
  const drawArrays = gl.drawArrays;
  gl.drawArrays = function (...args) {
    probe.draws++;
    return drawArrays.apply(this, args);
  };
  const compileShader = gl.compileShader;
  gl.compileShader = function (...args) {
    probe.compiles++;
    return compileShader.apply(this, args);
  };
  const uniform3fv = gl.uniform3fv;
  gl.uniform3fv = function (location: WebGLUniformLocation | null, value: Float32List) {
    if (location && names.get(location) === "ripples") {
      const slots = Array.from(value as ArrayLike<number>);
      const now = performance.now();
      for (let i = 0; i < slots.length; i += 3) {
        if (slots[i + 2] >= 0) probe.seen.push([slots[i], slots[i + 1], now - slots[i + 2] * 1000]);
      }
      probe.seen = probe.seen.slice(-400);
    }
    return uniform3fv.call(this, location, value);
  } as typeof gl.uniform3fv;
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    if (type === "webgl" && this.dataset.ui === "backdrop-canvas") probe.contexts++;
    return (getContext as (...a: unknown[]) => unknown).call(this, type, ...rest);
  } as typeof HTMLCanvasElement.prototype.getContext;
}

const probe = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { __backdrop: Probe }).__backdrop }));

const now = (page: Page) => page.evaluate(() => performance.now());

/** The origins of the ripples drawn that were born at or after `since`. */
const ripplesSince = (p: Probe, since: number) => {
  const origins = new Map<string, number[]>();
  for (const [x, y, born] of p.seen) if (born >= since - 5) origins.set(`${x},${y}`, [x, y]);
  return [...origins.values()];
};

async function open(
  page: Page,
  errors: string[] = [],
  { reducedMotion = "no-preference", clock = false }: { reducedMotion?: "reduce" | "no-preference"; clock?: boolean } = {},
) {
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion });
  await page.addInitScript(instrument);
  if (clock) await page.clock.install();
  await page.goto("/gallery?frame=site");
  await expect(page.getByTestId("site-frame")).toBeVisible();
  await expect(page.getByTestId("gallery-view")).toBeVisible();
  if (clock) await pauseClock(page);
  return errors;
}

/** Pauses the page's clock a little ahead of now; under load it can get there first, so aim further and retry. */
async function pauseClock(page: Page) {
  for (let ahead = 250; ; ahead *= 2) {
    try {
      await page.clock.pauseAt(await page.evaluate((ms) => Date.now() + ms, ahead));
      return;
    } catch (error) {
      if (!/past/.test(String(error)) || ahead >= 16_000) throw error;
    }
  }
}

/** Runs the paused clock forward: the animation frames in that span run, in order. */
const advance = (page: Page, ms = 400) => page.clock.runFor(ms);

/** Waits for `n` more draws than there are now. */
async function drawsMore(page: Page, n = 2) {
  const from = (await probe(page)).draws;
  await expect.poll(async () => (await probe(page)).draws, { timeout: 30_000 }).toBeGreaterThanOrEqual(from + n);
}

test.describe("the living backdrop", () => {
  test("draws one canvas over the static room, and keeps drawing", async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-ui="page-backdrop"] canvas[data-ui="backdrop-canvas"]')).toHaveCount(1);
    await expect(page.locator('svg[data-ui="arc"]')).toHaveCount(1);
    await drawsMore(page, 3);
  });

  test("a click or tap sends a wavefront from where it landed, and the field keeps drawing", async ({ page }) => {
    const errors = await open(page, [], { clock: true });
    const { width, height } = page.viewportSize()!;
    const since = await now(page);
    await page.mouse.click(width / 2, height / 4);
    await advance(page);
    const [ripple] = ripplesSince(await probe(page), since);
    expect(ripple[0]).toBeCloseTo(0.5, 2);
    expect(ripple[1]).toBeCloseTo(0.75, 2);
    const drawn = (await probe(page)).draws;
    await advance(page);
    expect((await probe(page)).draws).toBeGreaterThan(drawn);
    expect(errors).toEqual([]);
  });

  test("Enter and Space on a focused control send a wavefront from that control", async ({ page }) => {
    const errors = await open(page, [], { clock: true });
    const lens = page.getByRole("button", { name: /^Proven/ }).first();
    await lens.focus();
    const box = (await lens.boundingBox())!;
    const { width, height } = page.viewportSize()!;
    const origin = [(box.x + box.width / 2) / width, 1 - (box.y + box.height / 2) / height];
    for (const key of ["Enter", "Space"]) {
      const since = await now(page);
      await page.keyboard.press(key);
      await advance(page);
      const ripples = ripplesSince(await probe(page), since);
      expect(ripples, key).toHaveLength(1);
      expect(ripples[0][0]).toBeCloseTo(origin[0], 2);
      expect(ripples[0][1]).toBeCloseTo(origin[1], 2);
    }
    expect(errors).toEqual([]);
  });

  test("typing a space into the search field sends nothing", async ({ page }) => {
    await open(page, [], { clock: true });
    await page.getByRole("searchbox", { name: "Search builds" }).focus();
    const since = await now(page);
    await page.keyboard.type("a b");
    await page.keyboard.press("Enter");
    await advance(page);
    expect((await probe(page)).draws).toBeGreaterThan(0);
    expect(ripplesSince(await probe(page), since)).toEqual([]);
  });
});

test.describe("the living backdrop under prefers-reduced-motion", () => {
  test("draws one static frame and ignores clicks and keys", async ({ page }) => {
    const errors = await open(page, [], { reducedMotion: "reduce" });
    await expect.poll(async () => (await probe(page)).draws, { timeout: 30_000 }).toBe(1);
    await page.mouse.click(200, 200);
    await page.getByRole("button", { name: /^Proven/ }).first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    const after = await probe(page);
    expect(after.draws).toBe(1);
    expect(after.seen).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("starts moving when the setting is turned off, and stops when it is turned back on", async ({ page }) => {
    await open(page, [], { reducedMotion: "reduce", clock: true });
    await advance(page, 1000);
    expect((await probe(page)).draws).toBe(1);

    await page.emulateMedia({ reducedMotion: "no-preference" });
    await advance(page, 500);
    const moving = (await probe(page)).draws;
    expect(moving).toBeGreaterThan(5);

    // Back on: at most the one static frame, then nothing however long it waits.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await advance(page, 500);
    const settled = (await probe(page)).draws;
    expect(settled - moving).toBeLessThanOrEqual(1);
    await advance(page, 2000);
    expect((await probe(page)).draws).toBe(settled);
  });
});

test.describe("the backdrop without WebGL", () => {
  test("is the static room, with no canvas and no error", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        return /webgl/.test(type) ? null : (getContext as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof HTMLCanvasElement.prototype.getContext;
    });
    await page.goto("/gallery?frame=site");
    await expect(page.getByTestId("site-frame")).toBeVisible();
    const room = page.locator('[data-ui="page-backdrop"]');
    await expect(room).toHaveCount(1);
    await expect(room).toHaveCSS("background-image", /gradient/);
    await expect(page.locator('canvas[data-ui="backdrop-canvas"]')).toHaveCount(0);
    await page.mouse.click(200, 200);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    expect(errors).toEqual([]);
  });

  test("keeps the static room when the GPU will not compile the shader", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      WebGLRenderingContext.prototype.getShaderParameter = () => false;
    });
    await page.goto("/gallery?frame=site");
    await expect(page.getByTestId("site-frame")).toBeVisible();
    await expect(page.locator('[data-ui="page-backdrop"]')).toHaveCount(1);
    await expect(page.locator('canvas[data-ui="backdrop-canvas"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe("the backdrop canvas is created once", () => {
  test("across pages, frames that remount, the breakpoint and a theme switch", async ({ page }) => {
    await open(page);
    await drawsMore(page);
    const go = async (path: string) => {
      await page.evaluate((to) => {
        history.pushState({}, "", to);
        dispatchEvent(new PopStateEvent("popstate"));
      }, path);
      await expect(page.getByTestId("site-frame")).toBeVisible();
    };
    // /rebuild/:slug and the entrance bring their own SiteFrame.
    for (const path of ["/bounties", "/rebuild/no-such-build", "/gallery", "/login", "/gallery"]) await go(path);
    const { width } = page.viewportSize()!;
    await page.setViewportSize({ width: width < 768 ? 1024 : 600, height: 800 });
    await page.setViewportSize({ width, height: 800 });
    await page.evaluate(() => {
      const root = document.documentElement;
      root.dataset.theme = root.dataset.theme === "dusk" ? "noon" : "dusk";
    });
    await drawsMore(page);

    const p = await probe(page);
    expect(p.contexts).toBe(1);
    expect(p.compiles).toBe(2);
    await expect(page.locator('canvas[data-ui="backdrop-canvas"]')).toHaveCount(1);
  });
});
