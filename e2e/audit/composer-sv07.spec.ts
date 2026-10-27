/* SV-07 P0 and P9: the screen recording, played in a real browser on the real composer, before and after.

     PW_CHROMIUM_PATH=<chrome> npx playwright test --config=playwright.audit.config.ts composer-sv07              after
     SV07_STAGE=before E2E_BASE_URL=<main's dev server> npx playwright test --config=... composer-sv07         before

   The page runs on the jsdom tests' faked backend (`src/lib/build/__audit__/fakeSupabase.ts`), answered from Node: every database
   request the page makes is handed to it, with writes slow (100 to 800 ms, out of order) and reads of the build answered late with
   the data as it was when asked (`sv07Backend.ts`), as the recording saw. "Before" points the same spec at a dev server running
   `main`, so both recordings are made by one harness.

   Each frame, the page keeps where every `[data-slide-id]` element in the List stands on the screen (its top, its height, its
   opacity), the scroll, and the long tasks. For each step of the recording the node side works out:
     - click to first change: from the press to the first frame where anything in the List differs, in ms;
     - the largest one-frame change: the most of the step's whole change (every element's travel, growth, and fade times its
       height) that happened between two frames, as a share. A snap is about 100%; a slide spreads it over its frames;
     - the scrolls the maker did not make (this spec never scrolls);
     - the long tasks over 50 ms.
   Numbers go to `design/audits/composer/sv-07/<stage>.json`, the video to `design/audits/composer/sv-07/<stage>/replay.webm`. */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { ACCESS_TOKEN, answer, MAKER_ID, REPO_SCHEMA, startAuditBackend } from "../../src/lib/build/__audit__/fakeSupabase";
import { CHATS, seed, slowBackend } from "../../src/pages/site/compose/sv07Backend";

const STAGE = process.env.SV07_STAGE ?? "after";
const OUT = "design/audits/composer/sv-07";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range, content-profile" };

function projectRef(): string {
  const fromEnv = process.env.VITE_SUPABASE_URL;
  const env = fromEnv ?? readFileSync(".env", "utf8").match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m)?.[1];
  if (!env) throw new Error("VITE_SUPABASE_URL is not set and .env does not define it.");
  return new URL(env).hostname.split(".")[0];
}

/** The page signed in as the fake's maker, in a theme, with the fake answering every database request. */
async function stage(page: Page, theme: "dusk" | "noon" = "dusk") {
  startAuditBackend({ schema: REPO_SCHEMA, delays: slowBackend(), seed });
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const session = {
    access_token: "sv07-session",
    refresh_token: "sv07-refresh",
    token_type: "bearer",
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    user: { id: MAKER_ID, aud: "authenticated", role: "authenticated", email: "maker@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-08-01T00:00:00Z" },
  };
  await page.addInitScript(
    ([key, value, room]) => {
      try {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem("bg-theme", room);
      } catch {
        /* the page draws without */
      }
    },
    [`sb-${projectRef()}-auth-token`, JSON.stringify(session), theme] as const,
  );
  await page.route(/\/(rest|auth|functions|storage)\/v1\//, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const headers = { ...request.headers() };
    // The page's own session token stands for the fake's maker; the anon key stays anon.
    const bearer = headers.authorization?.replace(/^Bearer\s+/i, "");
    if (bearer && bearer !== headers.apikey) headers.authorization = `Bearer ${ACCESS_TOKEN}`;
    const response = await answer(request.url(), { method: request.method(), headers, body: request.postData() ?? undefined });
    const body = Buffer.from(await response.arrayBuffer());
    await route.fulfill({ status: response.status, headers: { ...Object.fromEntries(response.headers), ...CORS }, body });
  });
}

/* ── the sampler ── */

interface Frame {
  t: number;
  y: number;
  /** The page's height: a page that grows shorter than the scroll takes the scroll with it. */
  h: number;
  /** Animations running in the List. */
  a: number;
  items: [string, number, number, number][];
}
interface Log {
  frames: Frame[];
  marks: { name: string; t: number }[];
  /** Each press (pointerdown), at the page's own time. */
  presses: number[];
  longTasks: { start: number; duration: number }[];
  /** Every scroll the page asked for (window.scrollTo, scrollIntoView, a focus that scrolls), with who asked. */
  asked: { t: number; what: string; from: string }[];
}

async function installSampler(page: Page) {
  await page.addInitScript(() => {
    const log: Log = { frames: [], marks: [], presses: [], longTasks: [], asked: [] };
    (window as unknown as { __sv07: Log }).__sv07 = log;
    window.addEventListener("pointerdown", () => log.presses.push(performance.now()), { capture: true, passive: true });
    const caller = () => (new Error().stack ?? "").split("\n").slice(2, 7).map((line) => line.trim().replace(/https?:\/\/[^/]+/, "")).join(" < ");
    const scrollTo = window.scrollTo.bind(window);
    window.scrollTo = ((...args: unknown[]) => {
      log.asked.push({ t: performance.now(), what: `scrollTo ${JSON.stringify(args[0])}`, from: caller() });
      return (scrollTo as (...a: unknown[]) => void)(...args);
    }) as typeof window.scrollTo;
    const into = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, ...args: unknown[]) {
      log.asked.push({ t: performance.now(), what: `scrollIntoView ${this.getAttribute("data-testid") ?? this.tagName}`, from: caller() });
      return (into as (...a: unknown[]) => void).apply(this, args);
    };
    const focus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      if (!options?.preventScroll) log.asked.push({ t: performance.now(), what: `focus ${this.getAttribute("data-testid") ?? this.getAttribute("aria-label") ?? this.tagName}`, from: caller() });
      return focus.call(this, options);
    };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) log.longTasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: "longtask", buffered: true });
    } catch {
      /* no long-task timing in this browser */
    }
    const tick = () => {
      const root = document.querySelector('[data-testid="build-list"]') ?? document.querySelector('[data-testid="empty-build"]');
      const items = root
        ? [...root.querySelectorAll<HTMLElement>("[data-slide-id]")].flatMap((element) => {
            const box = element.getBoundingClientRect();
            // What is not drawn (a closed part's sessions) has no box, and is not sampled.
            if (box.width === 0 && box.height === 0) return [];
            // Where it stands on the screen, as the maker sees it: a scroll is counted on its own.
            return [[element.getAttribute("data-slide-id") ?? "", Math.round(box.top), Math.round(box.height), Math.round(Number(getComputedStyle(element).opacity) * 100) / 100] as [string, number, number, number]];
          })
        : [];
      const a = root ? root.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length : 0;
      log.frames.push({ t: performance.now(), y: Math.round(window.scrollY), h: document.documentElement.scrollHeight, a, items });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/** A step of the recording: marked, then pressed. */
async function step(page: Page, name: string, press: () => Promise<void>) {
  current = name;
  await page.evaluate((label) => (window as unknown as { __sv07: Log }).__sv07.marks.push({ name: label, t: performance.now() }), name);
  await press();
}

const readLog = (page: Page) => page.evaluate(() => (window as unknown as { __sv07: Log }).__sv07);

/* ── the numbers ── */

export interface StepNumbers {
  name: string;
  /** From the press to the first frame where the List differs; null when nothing in it changed. */
  firstChangeMs: number | null;
  /** The most of the step's whole change that happened between two frames, 0 to 1; null when the List did not change. */
  largestFrameShare: number | null;
  /**
   * Every move of the scroll in the step: [from, to]. Most are not the page's: Playwright scrolls to what it presses (as a maker
   * would), the browser holds the foot of a page that grows or shrinks under it, and scroll anchoring keeps what is in view still.
   */
  scrolls: [number, number][];
  /** The scrolls the page's own code made (scrollTo, scrollIntoView, a focus that scrolls): the ones the maker did not ask for. */
  pageScrolls: number;
  longTasks: number;
  /** The most of its own travel one element covers in a single frame (SV-06's 35% threshold); null when nothing travelled 24 or more. */
  worstElementShare: number | null;
  /** What changed most in that frame, and by how much. */
  largestFrameWhat: string[];
  /** The scrolls the page asked for in the step, and who asked. */
  asked: string[];
  /** The page's least height in the step. */
  shortest: number;
  /** The most animations running in the List at once in the step. */
  animated: number;
}

/** Each element's place, size and opacity in a frame, by its slide id. */
const placesOf = (frame: Frame) => new Map(frame.items.map(([id, top, height, opacity]) => [id, { top, height, opacity }]));

/** How much changed between two frames: every element's travel, growth and fade (times its height); one that came or went counts its height. */
/** What changed between two frames, element by element: its travel, growth and fade (times its height); one that came or went counts its height. */
function changesBetween(before: Frame, after: Frame): Map<string, number> {
  const was = placesOf(before);
  const now = placesOf(after);
  const out = new Map<string, number>();
  for (const [id, place] of now) {
    const old = was.get(id);
    const change = old ? Math.abs(place.top - old.top) + Math.abs(place.height - old.height) + Math.abs(place.opacity - old.opacity) * place.height : place.height * place.opacity;
    if (change > 0) out.set(id, change);
  }
  for (const [id, place] of was) if (!now.has(id) && place.height * place.opacity > 0) out.set(id, place.height * place.opacity);
  return out;
}

const sum = (changes: Map<string, number>) => [...changes.values()].reduce((total, change) => total + change, 0);

export function measureSteps(log: Log): StepNumbers[] {
  return log.marks.map((mark, at) => {
    const end = log.marks[at + 1]?.t ?? Number.POSITIVE_INFINITY;
    // Timed from the press itself, in the page's own clock: not from when the spec asked for it.
    const pressed = log.presses.find((t) => t >= mark.t && t < end) ?? mark.t;
    const frames = log.frames.filter((frame) => frame.t >= pressed && frame.t < end);
    const before = [...log.frames].reverse().find((frame) => frame.t < pressed);
    const changes: Map<string, number>[] = [];
    let first: number | null = null;
    let previous = before;
    for (const frame of frames) {
      if (previous) {
        const change = changesBetween(previous, frame);
        changes.push(change);
        if (first === null && sum(change) > 0.5) first = frame.t - pressed;
      }
      previous = frame;
    }
    const totals = changes.map(sum);
    // SV-06's measure, per element: the most of its own travel any element covers in one frame (those that travel 24 or more).
    const travel = new Map<string, { total: number; most: number }>();
    previous = before;
    for (const frame of frames) {
      if (previous) {
        const was = placesOf(previous);
        for (const [id, place] of placesOf(frame)) {
          const old = was.get(id);
          if (!old) continue;
          const moved = Math.abs(place.top - old.top);
          const entry = travel.get(id) ?? { total: 0, most: 0 };
          entry.total += moved;
          entry.most = Math.max(entry.most, moved);
          travel.set(id, entry);
        }
      }
      previous = frame;
    }
    const travelled = [...travel.values()].filter((entry) => entry.total >= 24);
    const biggest = changes[totals.indexOf(Math.max(...totals))];
    const whole = totals.reduce((total, change) => total + change, 0);
    const scrolls: [number, number][] = [];
    let y = before?.y ?? frames[0]?.y ?? 0;
    for (const frame of frames) {
      if (frame.y !== y) scrolls.push([y, frame.y]);
      y = frame.y;
    }
    return {
      name: mark.name,
      firstChangeMs: first === null ? null : Math.round(first),
      largestFrameShare: whole < 2 ? null : Math.round((Math.max(...totals) / whole) * 100) / 100,
      worstElementShare: travelled.length === 0 ? null : Math.round(Math.max(...travelled.map((entry) => entry.most / entry.total)) * 100) / 100,
      largestFrameWhat: biggest ? [...biggest].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, change]) => `${id} ${Math.round(change)}`) : [],
      scrolls: mergeScrolls(scrolls),
      longTasks: log.longTasks.filter((task) => task.start >= mark.t && task.start < end && task.duration > 50).length,
      asked: log.asked.filter((entry) => entry.t >= mark.t && entry.t < end).map((entry) => `${entry.what} · ${entry.from}`),
      pageScrolls: log.asked.filter((entry) => entry.t >= mark.t && entry.t < end && !entry.what.startsWith("focus")).length,
      shortest: Math.min(...frames.map((frame) => frame.h)),
      animated: Math.max(0, ...frames.map((frame) => frame.a)),
    };
  });
}

/** Frame-by-frame scroll moves joined into the scrolls they make. */
function mergeScrolls(moves: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [from, to] of moves) {
    const last = out[out.length - 1];
    if (last && last[1] === from && Math.sign(to - from) === Math.sign(last[1] - last[0])) last[1] = to;
    else out.push([from, to]);
  }
  return out;
}

/* ── the sequence ── */

const list = (page: Page) => page.getByTestId("build-list");

/** What the page could not do as the recording did it, by step (main's second Add a part makes no part). */
const notes = new Map<string, string>();
let current = "";

/** Add a session (or the empty build's panel) › Your sessions › the chat by its words, in `part` when there are parts. */
async function addChat(page: Page, name: string, part?: string) {
  const picker = page.getByTestId("add-session-picker");
  if (!(await picker.isVisible())) {
    if (part) {
      await page.getByTestId("add-session-row").click();
      await page.getByTestId("add-to-button").click();
      const wanted = page.getByRole("menuitem", { name: new RegExp(part) });
      if (await wanted.isVisible({ timeout: 3000 }).catch(() => false)) await wanted.click();
      else {
        // The part is not there: the chat goes to the last part there is, and the numbers say so.
        notes.set(current, `${part} was not there; added to the last part`);
        await page.getByRole("menuitem").last().click();
      }
      await page.getByRole("button", { name: /Add from your connected chats/ }).click();
    } else await page.getByTestId("empty-build-chats").click();
  }
  await picker.getByRole("listitem").filter({ hasText: `Make the ${name.toLowerCase()}` }).first().click();
}

/** Nothing is on its way and the rows can be pressed again. */
async function settled(page: Page) {
  await expect(page.getByTestId("arriving-session")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.getByTestId("add-session-row")).toBeEnabled({ timeout: 30_000 });
  await page.waitForTimeout(400);
}

async function playRecording(page: Page) {
  await page.goto("/compose/new");
  await expect(page.getByTestId("empty-build-chats")).toBeVisible({ timeout: 30_000 });
  await step(page, "import a one-prompt chat from the empty build panel", async () => {
    await page.getByTestId("empty-build-chats").click();
    await page.getByTestId("add-session-picker").getByRole("listitem").filter({ hasText: `Make the ${CHATS[0].name.toLowerCase()}` }).first().click();
  });
  await settled(page);
  await expect(list(page)).toBeVisible();
  for (const nth of ["first", "second"]) {
    await expect(page.getByTestId("add-part-row")).toBeEnabled({ timeout: 30_000 });
    await step(page, `Add a part (${nth})`, () => page.getByTestId("add-part-row").click());
    await page.waitForTimeout(1500);
  }
  await expect(page.getByTestId("add-part-row")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("add-session-row").click();
  await step(page, "Start a new session", () => page.getByRole("button", { name: /Start a new session/ }).click());
  await settled(page);
  await step(page, "a library chat into Part 2", () => addChat(page, CHATS[1].name, "Part 2"));
  await settled(page);
  await step(page, "collapse Part 2", () => page.getByRole("button", { name: "Collapse Part 2" }).click());
  await page.waitForTimeout(800);
  await step(page, "another chat into the closed Part 2", () => addChat(page, CHATS[2].name, "Part 2"));
  await settled(page);
  await step(page, "a chat into Part 3", () => addChat(page, CHATS[3].name, "Part 3"));
  await expect(page.getByTestId("add-session-row")).toBeEnabled({ timeout: 30_000 });
  await step(page, "another into Part 3 straight after", () => addChat(page, CHATS[4].name, "Part 3"));
  await settled(page);
  // The maker's own moves, in a window of their own: Playwright scrolls to what it presses, as a maker would.
  await step(page, "maker: View › Session list, and Part 2 closed again", async () => {
    await page.getByTestId("sandbox-view").click();
    await page.getByRole("menuitemcheckbox", { name: /Session list/ }).click();
    await page.keyboard.press("Escape");
    const closed = page.getByRole("button", { name: "Collapse Part 2" });
    if (await closed.isVisible()) await closed.click();
    await page.waitForTimeout(800);
  });
  await step(page, "a jump tab for a session in the closed Part 2", () => page.getByTestId("session-list").getByRole("button", { name: /^3 / }).click());
  await page.waitForTimeout(2000);
}

test.use({ viewport: { width: 1440, height: 900 }, video: { mode: "on", size: { width: 1440, height: 900 } } });

test.describe("SV-07 · the recorded sequence in a browser", () => {
  test(`plays the recording and keeps its numbers (${STAGE})`, async ({ page }) => {
    test.setTimeout(10 * 60_000);
    await stage(page);
    await installSampler(page);
    await playRecording(page);
    const log = await readLog(page);
    const numbers = measureSteps(log).map((entry) => (notes.has(entry.name) ? { ...entry, note: notes.get(entry.name) } : entry));
    if (process.env.SV07_RAW) writeFileSync(path.join(OUT, `${STAGE}.raw.json`), JSON.stringify(log));
    mkdirSync(path.join(OUT, STAGE), { recursive: true });
    writeFileSync(path.join(OUT, `${STAGE}.json`), `${JSON.stringify(numbers, null, 2)}\n`);
    const video = page.video();
    await page.close();
    if (video) renameSync(await video.path(), path.join(OUT, STAGE, "replay.webm"));
    if (STAGE !== "after") return;
    // The maker's own moves (Playwright scrolling to what it presses) are not the page's.
    for (const entry of numbers.filter((candidate) => !candidate.name.startsWith("maker:"))) {
      if (entry.firstChangeMs !== null) expect.soft(entry.firstChangeMs, entry.name).toBeLessThanOrEqual(100);
      expect.soft(entry.scrolls.filter(([, to]) => to === 0), entry.name).toEqual([]);
      // The page scrolls by itself only through the helper, for a jump the maker asked for or an arrival off screen.
      if (!entry.name.startsWith("a jump tab")) expect.soft(entry.asked.filter((asked) => asked.startsWith("scroll") && !asked.includes("scrollToShow")), entry.name).toEqual([]);
    }
  });
});


/* ── P9.3: the screens, and P6.3: the focus ring ── */

/** Where a keyboard focus ring would be clipped: each ancestor that clips (overflow, paint containment) and does not hold it whole. */
async function ringClippedBy(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((target) => {
    const element = document.querySelector<HTMLElement>(target);
    if (!element) return ["(not found)"];
    const style = getComputedStyle(element);
    const reach = (parseFloat(style.outlineWidth) || 0) + (parseFloat(style.outlineOffset) || 0);
    const box = element.getBoundingClientRect();
    const ring = { left: box.left - reach, right: box.right + reach, top: box.top - reach, bottom: box.bottom + reach };
    const out: string[] = [];
    for (let at = element.parentElement; at; at = at.parentElement) {
      const own = getComputedStyle(at);
      const clips = own.overflowX !== "visible" || own.overflowY !== "visible" || /paint|strict|content/.test(own.contain) || own.contentVisibility === "auto";
      if (!clips) continue;
      const edge = at.getBoundingClientRect();
      if (ring.left < edge.left - 0.5 || ring.right > edge.right + 0.5 || ring.top < edge.top - 0.5 || ring.bottom > edge.bottom + 0.5) out.push(`${at.tagName.toLowerCase()}${at.dataset.testid ? `[${at.dataset.testid}]` : ""} (${own.overflowX}/${own.overflowY}, contain ${own.contain})`);
    }
    return out;
  }, selector);
}

const SIZES = [
  { name: "1440", viewport: { width: 1440, height: 900 } },
  { name: "390", viewport: { width: 390, height: 844 } },
] as const;

for (const size of SIZES) {
  for (const theme of ["dusk", "noon"] as const) {
    test(`screens at ${size.name} in ${theme === "dusk" ? "Dusk" : "Noon"} (${STAGE})`, async ({ page }) => {
      test.setTimeout(6 * 60_000);
      await page.setViewportSize(size.viewport);
      await stage(page, theme);
      const dir = path.join(OUT, STAGE, "screens");
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => page.screenshot({ path: path.join(dir, `${what}-${size.name}-${theme}.png`) });
      const phone = size.name === "390";
      await page.goto("/compose/new");
      await expect(page.getByTestId("empty-build-chats")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("empty-build-chats").click();
      await page.getByTestId("add-session-picker").getByRole("listitem").filter({ hasText: `Make the ${CHATS[0].name.toLowerCase()}` }).first().click();
      await expect(page.getByTestId("arriving-session")).toBeVisible({ timeout: 10_000 });
      await shot("import-midway");
      await settled(page);
      await page.getByTestId("add-part-row").click();
      await shot("new-part");
      await expect(page.getByTestId("add-part-row")).toBeEnabled({ timeout: 30_000 });
      if (!phone) {
        // P6.3: the ring on "+ Add a session to this part", drawn for the keyboard.
        const button = page.getByTestId("workstream-empty").getByRole("button").first();
        await page.keyboard.press("Shift");
        await button.evaluate((element) => (element as HTMLElement).focus());
        writeFileSync(path.join(dir, `focus-ring-${theme}.json`), `${JSON.stringify({ clippedBy: await ringClippedBy(page, '[data-testid="workstream-empty"] button') }, null, 2)}\n`);
        await button.screenshot({ path: path.join(dir, `focus-ring-${size.name}-${theme}.png`) }).catch(() => undefined);
        await page.keyboard.press("Escape");
      }
      await page.getByRole("button", { name: "Collapse Part 2" }).click();
      await page.waitForTimeout(800);
      await addChat(page, CHATS[1].name, "Part 2");
      await page.waitForTimeout(120);
      await shot("closed-part-opening");
      await settled(page);
      await expect(page.getByTestId("reference-notice")).toBeVisible({ timeout: 15_000 });
      await shot("notice");
      await page.getByTestId("add-session-row").click();
      await page.getByTestId("add-to-button").click();
      await page.getByRole("menuitem", { name: /Part 1/ }).click();
      await page.getByRole("button", { name: /Start a new session/ }).click();
      await settled(page);
      await page.getByText("No tiles yet").first().scrollIntoViewIfNeeded();
      await shot("empty-session");
      await page.getByTestId("add-session-row").click();
      await page.getByRole("button", { name: /Add from your connected chats/ }).click();
      await page.getByTestId("add-session-picker").getByRole("listitem").filter({ hasText: "Make the window signs" }).first().click();
      await settled(page);
      const summary = page.locator('[data-testid="step-card"][data-kind="summary"]');
      await expect(summary).toBeVisible({ timeout: 15_000 });
      await summary.scrollIntoViewIfNeeded();
      await shot("summary-tile");
    });
  }
}
