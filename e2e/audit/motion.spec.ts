/* SV-06: the build page's motion, measured in a real browser.

     PW_CHROMIUM_PATH=<chrome> npm run audit:motion                      the after numbers, judged against the thresholds
     MOTION_STAGE=before PW_CHROMIUM_PATH=<chrome> npm run audit:motion  the before numbers, recorded and not judged
     MOTION_VIDEO=1 ...                                                  also a video of each moment

   Each moment is played on a fresh dev page (MotionDemo `?build=ca22`, MovingDemo `?build=ca21`, ReferencesDemo `?build=references`) at
   1440 in Dusk (a drag's window is taller, so both its ends are on screen), with the recorder from `support/frames.ts` armed just
   before the input, three times (`MOTION_RUNS`); each number is the median of the runs. Numbers go to
   `design/audits/composer/sv-06/<stage>.json`; videos to `design/audits/composer/sv-06/<stage>/<moment>.webm`.

   THE THRESHOLDS (after only): at most 1 frame gap over 25 ms per moment; no long task over 50 ms while something moves; no
   animation cut short without being continued; no element moves more than 35% of its travel in one frame; the first frame changes
   within 100 ms of the input. */

import { mkdirSync, renameSync, writeFileSync } from "node:fs";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { armMotion, installMotionTools, measureMotion, readMotion, type MotionNumbers } from "./support/frames";

/** "after" judges the thresholds; any other name ("before", or a scratch run while working) only records. */
const STAGE = process.env.MOTION_STAGE ?? "after";
const OUT = "design/audits/composer/sv-06";
const VIDEO = process.env.MOTION_VIDEO === "1";
/** Each moment is played this many times on a fresh page, and each number is the median: one slow frame in a container is not the motion. */
const RUNS = Number(process.env.MOTION_RUNS ?? 3);

const CA22 = "/dev/kit/pages/sandbox?build=ca22&bar=hide&fit=content&theme=dusk&viewport=desktop";
const CA21 = "/dev/kit/pages/sandbox?build=ca21&fit=content&theme=dusk&viewport=desktop";
const REFERENCES = "/dev/kit/pages/sandbox?build=references&fit=content&theme=dusk&viewport=desktop";

const act = (page: Page, name: string) => page.evaluate((id) => (document.querySelector(`[data-testid="act-${id}"]`) as HTMLElement).click(), name);

/** Waits until nothing has run for 300 ms, or `most` ms have passed. */
const quiet = (page: Page, most = 4000) =>
  page.evaluate(
    (limit) =>
      new Promise<void>((resolve) => {
        const began = performance.now();
        let still = performance.now();
        const tick = () => {
          const now = performance.now();
          if (document.getAnimations().some((animation) => animation.playState === "running")) still = now;
          if (now - still > 300 || now - began > limit) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    most,
  );

/** Picks up what `grip` is inside and drags it to `to`, by the mouse, as a maker would. */
async function drag(
  page: Page,
  held: string,
  to: () => Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>,
) {
  const item = page.locator(held).first();
  await item.hover();
  const grip = await item.locator('[data-testid$="drag-handle"]').first().boundingBox();
  if (!grip) throw new Error(`no drag handle in ${held}`);
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 3, grip.y + grip.height / 2 + 24, { steps: 4 });
  const target = await to();
  if (!target) throw new Error("no target");
  await page.mouse.move(grip.x + 40, target.y + 6, { steps: 16 });
  await page.waitForTimeout(250);
  await page.mouse.up();
}

interface Moment {
  name: string;
  url: string;
  /** The window's height: a drag needs its far end on screen (CA-21's measure drew the page 2600 tall). 900 by default. */
  height?: number;
  setup?: (page: Page) => Promise<void>;
  play: (page: Page) => Promise<void>;
}

/** CA-22's moments, each a button of MotionDemo's bar, and the ones SV-06 adds. */
const MOMENTS: Moment[] = [
  { name: "remove-a-tile", url: CA22, play: (page) => act(page, "remove-p2") },
  {
    name: "undo-the-removal",
    url: CA22,
    setup: (page) => act(page, "remove-p2"),
    play: (page) => act(page, "undo"),
  },
  {
    name: "remove-a-session",
    url: CA22,
    play: (page) => act(page, "remove-session-2"),
  },
  { name: "clear-the-build", url: CA22, play: (page) => act(page, "clear") },
  {
    name: "undo-clearing",
    url: CA22,
    setup: (page) => act(page, "clear"),
    play: (page) => act(page, "undo"),
  },
  { name: "merge", url: CA22, play: (page) => act(page, "merge-session-2") },
  { name: "add-a-tile", url: CA22, play: (page) => act(page, "add-tile") },
  { name: "duplicate", url: CA22, play: (page) => act(page, "duplicate-p2") },
  {
    name: "duplicate-two",
    url: CA22,
    play: (page) => act(page, "duplicate-two"),
  },
  { name: "insert-from-library", url: CA22, play: (page) => act(page, "insert-library") },
  { name: "split", url: CA22, play: (page) => act(page, "split-p3") },
  { name: "add-a-part", url: CA22, play: (page) => act(page, "add-part") },
  {
    name: "redo",
    url: CA22,
    setup: async (page) => {
      await act(page, "remove-p2");
      await quiet(page);
      await act(page, "undo");
    },
    play: (page) => act(page, "redo"),
  },
  {
    name: "move-to-part",
    url: CA22,
    play: (page) => act(page, "move-s2-to-part-2"),
  },
  {
    name: "send-together",
    url: CA22,
    play: (page) => act(page, "nest-p3-in-p2"),
  },
  { name: "convert", url: CA22, play: (page) => act(page, "convert-p3") },
  { name: "selection-bar", url: CA22, play: (page) => act(page, "pick-two") },
  { name: "details", url: CA22, play: (page) => act(page, "select-p3") },
  { name: "go-to-it", url: CA22, play: (page) => act(page, "go-to-p3") },
  { name: "fold", url: CA22, play: (page) => act(page, "fold-s1") },
  {
    name: "unfold",
    url: CA22,
    setup: (page) => act(page, "fold-s1"),
    play: (page) => act(page, "fold-s1"),
  },
  {
    name: "collapse-all",
    url: CA22,
    play: (page) => act(page, "collapse-all"),
  },
  { name: "list-to-map", url: CA22, play: (page) => act(page, "lens-map") },
  {
    name: "map-to-list",
    url: CA22,
    setup: (page) => act(page, "lens-map"),
    play: (page) => act(page, "lens-list"),
  },
  {
    name: "remove-and-undo",
    url: CA22,
    play: async (page) => {
      await act(page, "remove-p2");
      await page.waitForTimeout(700);
      await act(page, "undo");
    },
  },
  {
    name: "tile-drag-across-sessions",
    url: CA21,
    height: 2400,
    play: (page) => drag(page, '[data-skel-kind="tile"][data-skel-id="c21-p2"]', () => page.locator('[data-skel-id="c21-tool"]').boundingBox()),
  },
  {
    name: "session-drag-into-part",
    url: CA21,
    height: 2400,
    play: (page) => drag(page, '[data-skel-kind="session"][data-skel-id$="a2"]', () => page.locator('[data-testid="workstream-empty"]').boundingBox()),
  },
  {
    name: "import-arriving",
    url: CA21,
    setup: async (page) => {
      await page.getByTestId("add-session-row").click();
      await page.getByRole("button", { name: /Add from your connected chats/ }).click();
    },
    play: (page) => page.getByTestId("add-session-picker").getByRole("listitem").first().click(),
  },
  {
    name: "go-to-it-from-a-post-link",
    url: REFERENCES,
    play: (page) => page.evaluate(() => (document.querySelectorAll('[data-testid="sandbox-post"] [data-ref^="node:"]')[0] as HTMLElement).click()),
  },
];

async function open(page: Page, url: string, height = 900) {
  await installMotionTools(page);
  await page.setViewportSize({ width: 1440, height });
  await page.goto(url, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.locator("[data-slide-id]").first().waitFor();
  await page.waitForTimeout(1200);
}

async function playMoment(page: Page, moment: Moment): Promise<MotionNumbers> {
  await open(page, moment.url, moment.height);
  if (moment.setup) {
    await moment.setup(page);
    await quiet(page);
    await page.waitForTimeout(300);
  }
  await armMotion(page);
  await moment.play(page);
  await page.waitForTimeout(150);
  await quiet(page);
  return measureMotion(await readMotion(page));
}

const THRESHOLDS = {
  frameGaps: 1,
  longTasks: 0,
  cancelled: 0,
  largestJump: 0.35,
  firstFrameMs: 100,
};

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** The median of each number over the runs; the jump's element and the properties come from the runs as they are. */
function medianOf(runs: MotionNumbers[]): MotionNumbers {
  const jump = [...runs].sort((a, b) => a.largestJump - b.largestJump)[Math.floor(runs.length / 2)];
  return {
    frameGaps: median(runs.map((run) => run.frameGaps)),
    longTasks: median(runs.map((run) => run.longTasks)),
    longestTaskMs: median(runs.map((run) => run.longestTaskMs)),
    cancelled: median(runs.map((run) => run.cancelled)),
    largestJump: jump.largestJump,
    jumpOf: jump.jumpOf,
    firstFrameMs: median(runs.map((run) => run.firstFrameMs)),
    settledMs: median(runs.map((run) => run.settledMs)),
    offCompositor: [...new Set(runs.flatMap((run) => run.offCompositor))],
  };
}

const failures = (numbers: MotionNumbers): string[] => {
  const out: string[] = [];
  if (numbers.frameGaps > THRESHOLDS.frameGaps) out.push(`${numbers.frameGaps} frame gaps over 25 ms`);
  if (numbers.longTasks > THRESHOLDS.longTasks) out.push(`${numbers.longTasks} long tasks (longest ${numbers.longestTaskMs} ms)`);
  if (numbers.cancelled > THRESHOLDS.cancelled) out.push(`${numbers.cancelled} animations cut short`);
  if (numbers.largestJump > THRESHOLDS.largestJump) out.push(`a ${Math.round(numbers.largestJump * 100)}% jump: ${numbers.jumpOf}`);
  if (numbers.firstFrameMs > THRESHOLDS.firstFrameMs) out.push(`first frame ${numbers.firstFrameMs} ms after the input`);
  return out;
};

const results: Record<string, MotionNumbers & { failed: string[] }> = {};
const imports: Record<string, number> = {};

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${STAGE}.json`, `${JSON.stringify({ moments: results, imports }, null, 2)}\n`);
});

for (const moment of MOMENTS) {
  test(`motion: ${moment.name}`, async ({ page }) => {
    const runs: MotionNumbers[] = [];
    for (let run = 0; run < RUNS; run += 1) runs.push(await playMoment(page, moment));
    const numbers = medianOf(runs);
    const failed = failures(numbers);
    results[moment.name] = { ...numbers, failed };
    console.log(JSON.stringify({ moment: moment.name, ...numbers }));
    if (STAGE === "after") expect(failed, `${moment.name}: ${failed.join("; ")}`).toEqual([]);
  });
}

/* Part 5 and Part 8: an import of 1, 4, 8 and 18 prompts, from the click to the last prompt landing. */
for (const count of [1, 4, 8, 18]) {
  test(`motion: import of ${count} prompts, click to last prompt landed`, async ({ page }) => {
    const runs: number[] = [];
    for (let run = 0; run < RUNS; run += 1) runs.push(await importLanded(page, count));
    const landed = median(runs);
    imports[String(count)] = landed;
    console.log(JSON.stringify({ import: count, lastPromptLandedMs: landed, runs }));
    expect(landed).toBeGreaterThan(0);
  });
}

/** From the click that adds the session to the last frame any of its prompts was still falling. */
async function importLanded(page: Page, count: number): Promise<number> {
  await open(page, `${CA21}&prompts=${count}`);
  await page.getByTestId("add-session-row").click();
  await page.getByRole("button", { name: /Add from your connected chats/ }).click();
  const item = page.getByTestId("add-session-picker").getByRole("listitem").first();
  const handle = await item.elementHandle();
  const landed = await page.evaluate(async (element) => {
    const known = new Set([...document.querySelectorAll("[data-session-key]")].map((node) => node.getAttribute("data-session-key")));
    const pressed = performance.now();
    (element as HTMLElement).click();
    let last = -1;
    let key: string | null = null;
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        key ??= [...document.querySelectorAll("[data-session-key]")].map((node) => node.getAttribute("data-session-key")).find((name) => name && !known.has(name)) ?? null;
        if (key) {
          const tiles = [...document.querySelectorAll(`[data-skel-kind="tile"][data-skel-container="${key}"]`)].filter((tile) => !tile.closest('[data-testid="arriving-session"]'));
          if (tiles.some((tile) => tile.getAnimations({ subtree: true }).some((animation) => animation.playState === "running"))) last = now;
        }
        if (now - pressed > 7000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return last < 0 ? -1 : Math.round(last - pressed);
  }, handle);
  return landed;
}

/* The videos: the same moments, recorded on their own so the recording does not weigh on the numbers. */
async function record(browser: Browser, moment: Moment) {
  const dir = `${OUT}/${STAGE}`;
  mkdirSync(dir, { recursive: true });
  const height = moment.height ?? 900;
  const context = await browser.newContext({
    viewport: { width: 1440, height },
    recordVideo: {
      dir: `${dir}/raw`,
      size: { width: 960, height: Math.round((height * 960) / 1440) },
    },
  });
  const page = await context.newPage();
  await open(page, moment.url, height);
  if (moment.setup) {
    await moment.setup(page);
    await quiet(page);
  }
  await page.waitForTimeout(400);
  await moment.play(page);
  await page.waitForTimeout(150);
  await quiet(page);
  await page.waitForTimeout(500);
  const video = page.video();
  await context.close();
  if (video) renameSync(await video.path(), `${dir}/${moment.name}.webm`);
}

if (VIDEO) {
  for (const moment of MOMENTS) {
    test(`video: ${moment.name}`, async ({ browser }) => {
      await record(browser, moment);
    });
  }
}
