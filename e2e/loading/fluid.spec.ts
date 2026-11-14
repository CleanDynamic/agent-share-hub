// Part E's Playwright checks (G24, G28): the placeholder's canvas is there while the data is on its way, content replaces it
// with layout shift under 0.01, regions off screen are paused, and one loop drives them all; and reduced motion draws one
// still frame. RUN AGAINST MOCKS: Supabase's reads are held back and then answered empty; the network is throttled.
import { expect, test, type Page } from "@playwright/test";

const REF = process.env.VITE_SUPABASE_URL?.replace(/^https:\/\//, "").split(".")[0];

function jwt(payload: Record<string, unknown>) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.sig`;
}

async function stub(page: Page, { holdMs, signedIn }: { holdMs: number; signedIn: boolean }) {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
  await page.route(/supabase\.co/, async (route) => {
    const url = route.request().url();
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (url.includes("/rest/") || url.includes("/functions/")) await new Promise((resolve) => setTimeout(resolve, holdMs));
    await route.fulfill({ status: 200, contentType: "application/json", headers: { ...cors, "content-range": "0-0/0" }, body: url.includes("/rest/") ? "[]" : "{}" }).catch(() => undefined);
  });
  if (signedIn) {
    const ref = REF ?? (await page.evaluate(() => "")); // the project ref comes from the environment the dev server reads
    const exp = Math.floor(Date.now() / 1000) + 86400;
    const user = { id: "00000000-0000-4000-8000-0000000000a1", aud: "authenticated", role: "authenticated", email: "a@b.test", app_metadata: {}, user_metadata: {}, created_at: new Date(0).toISOString() };
    const session = { access_token: jwt({ sub: user.id, exp, role: "authenticated" }), token_type: "bearer", expires_in: 86400, expires_at: exp, refresh_token: "r", user };
    await page.addInitScript(([key, value]) => {
      // Any project ref: the app reads the one key it expects, written under every ref it might use.
      localStorage.setItem(key, value);
    }, [`sb-${ref}-auth-token`, JSON.stringify(session)] as const);
  }
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!entry.hadRecentInput) w.__cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
}

async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  // Throttled, but not so far that the dev server's hundreds of unbundled modules outlast the test: 40ms and 10 Mbps, with
  // every Supabase read held back a further 2.5s by the stub.
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 });
}

const PAGES = [
  { name: "Home", path: "/", signedIn: false },
  { name: "Gallery", path: "/builds", signedIn: false },
  { name: "a build page", path: "/b2/some-build", signedIn: false },
  { name: "the Composer", path: "/compose/00000000-0000-4000-8000-0000000000b1", signedIn: true },
];

for (const target of PAGES) {
  test(`${target.name}: the placeholder's canvas, then content in its place with layout shift under 0.01`, async ({ page }) => {
    test.skip(target.signedIn && !REF, "the Composer needs VITE_SUPABASE_URL in the test's environment for its session");
    await page.setViewportSize({ width: 1440, height: 900 });
    await stub(page, { holdMs: 2500, signedIn: target.signedIn });
    await throttle(page);
    await page.goto(target.path);
    test.setTimeout(150_000);
    await expect(page.locator("canvas[data-fluid]").first()).toBeAttached({ timeout: 60000 });
    await expect(page.locator("canvas[data-fluid]")).toHaveCount(0, { timeout: 60000 });
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    console.log(`${target.name} CLS ${cls.toFixed(4)}`);
    expect(cls).toBeLessThan(0.01);
  });
}

test("G28: regions off screen are paused, and one loop drives every region", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await stub(page, { holdMs: 30000, signedIn: false });
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number };
    w.__frames = 0;
    const original = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      if (/\/src\/lib\/dots\/engine\.ts|\/assets\/engine-/.test(new Error().stack ?? "")) w.__frames += 1;
      return original(callback);
    };
  });
  await page.goto("/");
  await expect(page.locator("canvas[data-fluid]").first()).toBeAttached();
  const regions = await page.locator("canvas[data-fluid]").count();
  expect(regions).toBeGreaterThan(3);
  // One loop: about one engine frame per display frame, however many regions there are.
  const before = await page.evaluate(() => (window as unknown as { __frames: number }).__frames);
  const started = Date.now();
  await page.waitForTimeout(1000);
  const frames = (await page.evaluate(() => (window as unknown as { __frames: number }).__frames)) - before;
  const elapsed = (Date.now() - started) / 1000;
  expect(frames).toBeLessThanOrEqual(Math.ceil(elapsed * 61) + 2);
  // Off screen: the page pushed down past every region, each says it is paused, and the loop stops.
  await page.evaluate(() => {
    document.body.style.paddingTop = "5000px";
    window.scrollTo(0, 0);
  });
  await expect.poll(() => page.locator('canvas[data-fluid][data-visible="true"]').count()).toBe(0);
  const idle = await page.evaluate(() => (window as unknown as { __frames: number }).__frames);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __frames: number }).__frames)).toBe(idle);
});

test("reduced motion: one still frame, and no loop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stub(page, { holdMs: 30000, signedIn: false });
  await page.goto("/builds");
  const canvas = page.locator("canvas[data-fluid]").first();
  await expect(canvas).toBeAttached();
  await page.waitForTimeout(800);
  const first = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.mouse.move(400, 400);
  await page.waitForTimeout(800);
  expect(await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(first);
  expect(first.length).toBeGreaterThan(1000);
});
