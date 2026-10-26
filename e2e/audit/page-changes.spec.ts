/* SV-04: what a page change looks like, step by step, on the built bundle (`npm run audit:pages`).

   THE TOUR is support/tourSteps.ts: Home, then each step's input (a nav link, a link in the page, the account menu, Back),
   on the audit database with every request DB_DELAY_MS late (support/pageStage.ts). It is played COLD (a fresh browser,
   nothing loaded but Home) and then WARM (the same browser, the same steps again from Home), RUNS times, and each number is
   the median of the runs.

   FOR EACH STEP, from the frame tools (support/frames.ts): click to first visible change, empty frames, the states the page
   area went through before the page was ready, layout shift during the change (in the page area; the footer, which
   follows the page's length, is reported apart), whether the header was kept (the same
   element and `data-frame-id`, never moved), and, after Back, the scroll position against the one the page was left at.

   WHAT FAILS (SV-04 Part 7), unless PAGES_REPORT_ONLY=1: a step over 100 ms to its first change, a step with an empty frame,
   more than one placeholder state (none on a warm step), a layout shift over 0.02, a header replaced or moved, or a Back more
   than 4 px from where the page was left. TOUR_VIDEO_DIR=<dir> records the first run's cold and warm tours there. */

import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

import { installFrameTools, measureChange, readFrames, resetFrames, type ChangeNumbers } from "./support/frames";
import { stage, type Span } from "./support/pageStage";
import { DB_DELAY_MS } from "./support/pageTargets";
import { OUT_DIR, writeText } from "./support/report";
import { TOUR_HOME, TOUR_START, TOUR_STEPS, type TourStep } from "./support/tourSteps";

test.describe.configure({ mode: "serial" });

const RUNS = Number(process.env.PAGES_RUNS ?? 3);
const BASE_URL = process.env.PERF_BASE_URL ?? "";
const VIDEO_DIR = process.env.TOUR_VIDEO_DIR ? path.resolve(process.cwd(), process.env.TOUR_VIDEO_DIR) : "";
const VIEWPORT = { width: 1440, height: 700 };

type Way = "cold" | "warm";

interface StepResult extends ChangeNumbers {
  step: string;
  way: Way;
  /** After Back: how far the scroll was from where the page was left, in px; null for other steps. */
  scrollOff: number | null;
  /** Any other step: how far from the top the new page opened, in px; null after Back. */
  topOff: number | null;
}

const ready = (page: Page, mark: string) =>
  page.waitForFunction((name) => document.documentElement.getAttribute("data-page-ready") === name, mark, { timeout: 30_000 });

async function act(page: Page, step: TourStep): Promise<"click" | "pop"> {
  const { action } = step;
  if (action.do === "nav") {
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: new RegExp(`^${action.name}(\\s|\\d|$)`) }).click();
    return "click";
  }
  if (action.do === "click") {
    await page.locator("#main").locator(action.selector).first().click();
    return "click";
  }
  if (action.do === "account") {
    await page.getByRole("button", { name: "Account" }).click();
    await page.getByRole("menuitem", { name: action.item }).click();
    return "click";
  }
  await page.goBack({ waitUntil: "commit" });
  return "pop";
}

async function playStep(page: Page, step: TourStep, from: string, way: Way, left: Map<string, number>): Promise<StepResult> {
  await resetFrames(page, from, step.readyMark);
  // Two frames recorded before the input, so "the frame before" is a real one.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const kind = await act(page, step);
  await ready(page, step.readyMark);
  await page.waitForTimeout(300);
  const log = await readFrames(page);
  const input = kind === "pop" ? log.lastPop : log.lastClick;
  const numbers = measureChange(log, input);
  let scrollOff: number | null = null;
  const topOff = kind === "pop" || step.sameParams ? null : numbers.scrollAtReady;
  if (step.restores) {
    const was = left.get(step.restores);
    scrollOff = was === undefined || numbers.scrollAtReady < 0 ? null : Math.abs(numbers.scrollAtReady - was);
  }
  if (step.scroll) {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" as ScrollBehavior }));
    await page.waitForTimeout(200);
    left.set(step.name, await page.evaluate(() => Math.round(window.scrollY)));
  }
  return { step: step.name, way, scrollOff, topOff, ...numbers };
}

async function playTour(browser: Browser, record: boolean): Promise<StepResult[]> {
  const context: BrowserContext = await browser.newContext({
    baseURL: BASE_URL || undefined,
    viewport: VIEWPORT,
    ...(record && VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: VIEWPORT } } : {}),
  });
  const page = await context.newPage();
  const spans: Span[] = [];
  const results: StepResult[] = [];
  try {
    await stage(page, { auth: true }, spans);
    await installFrameTools(page);
    await page.goto(TOUR_START.path, { waitUntil: "commit" });
    await ready(page, TOUR_START.readyMark);
    await page.waitForTimeout(1_000);

    for (const way of ["cold", "warm"] as Way[]) {
      const left = new Map<string, number>();
      let from = TOUR_START.readyMark;
      const steps = way === "warm" ? [TOUR_HOME, ...TOUR_STEPS] : TOUR_STEPS;
      for (const step of steps) {
        results.push(await playStep(page, step, from, way, left));
        from = step.readyMark;
      }
      await page.waitForTimeout(500);
    }
  } finally {
    const video = page.video();
    await context.close();
    if (video && VIDEO_DIR) {
      const file = await video.path();
      fs.renameSync(file, path.join(VIDEO_DIR, "tour.webm"));
    }
  }
  return results;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const runs: StepResult[][] = [];

test("page changes: the tour", async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  for (let run = 0; run < RUNS; run += 1) runs.push(await playTour(browser, run === 0));
});

test("page changes: report and thresholds", async () => {
  const keys = runs[0].map((row) => [row.step, row.way] as const);
  const rows = keys.map(([step, way]) => {
    const same = runs.map((run) => run.find((row) => row.step === step && row.way === way)).filter(Boolean) as StepResult[];
    const offs = same.map((row) => row.scrollOff).filter((value): value is number => value !== null);
    const tops = same.map((row) => row.topOff).filter((value): value is number => value !== null);
    return {
      step,
      way,
      firstChangeMs: median(same.map((row) => row.firstChangeMs)),
      readyMs: median(same.map((row) => row.readyMs)),
      emptyFrames: median(same.map((row) => row.emptyFrames)),
      placeholderStates: median(same.map((row) => row.placeholderStates)),
      states: same[0].states.join(" → ") || "none",
      layoutShift: median(same.map((row) => row.layoutShift)),
      footerShift: median(same.map((row) => row.footerShift)),
      headerKept: same.every((row) => row.headerKept),
      headerMoved: same.some((row) => row.headerMoved),
      scrollOff: offs.length ? median(offs) : null,
      topOff: tops.length ? median(tops) : null,
      longestTaskMs: median(same.map((row) => row.longestTaskMs)),
      shiftSources: same[0].shiftSources,
    };
  });

  const table = [
    "| step | way | click to change ms | to ready ms | empty frames | placeholder states | states before ready (first run) | layout shift | footer shift | header kept | header still | opened at y | Back scroll off px | longest task ms |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | ---: | ---: | ---: |",
    ...rows.map(
      (row) =>
        `| ${row.step} | ${row.way} | ${row.firstChangeMs} | ${row.readyMs} | ${row.emptyFrames} | ${row.placeholderStates} | ${row.states} | ${row.layoutShift} | ${row.footerShift} | ${row.headerKept ? "yes" : "no"} | ${row.headerMoved ? "no" : "yes"} | ${row.topOff ?? ""} | ${row.scrollOff ?? ""} | ${row.longestTaskMs} |`,
    ),
  ].join("\n");
  const shifted = rows.filter((row) => row.layoutShift > 0 || row.footerShift > 0).map((row) => `- ${row.step} (${row.way}), ${row.layoutShift}:\n${row.shiftSources.map((source) => `  - ${source}`).join("\n")}`);
  writeText("page-changes-shifts.md", `What moved, first run.\n\n${shifted.join("\n")}\n`);
  writeText("page-changes.md", `Page change tour, every database request delayed ${DB_DELAY_MS} ms, ${VIEWPORT.width} x ${VIEWPORT.height}, median of ${RUNS}.\n\n${table}\n`);
  writeText("page-changes.json", JSON.stringify({ rows, runs }, null, 2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n${table}\n`);

  const failures: string[] = [];
  for (const row of rows) {
    const at = `${row.step} (${row.way})`;
    if (row.firstChangeMs < 0 || row.firstChangeMs > 100) failures.push(`${at}: ${row.firstChangeMs} ms to the first change, the line is 100`);
    if (row.emptyFrames > 0) failures.push(`${at}: ${row.emptyFrames} frames with an empty page area`);
    if (row.placeholderStates > (row.way === "warm" ? 0 : 1)) failures.push(`${at}: ${row.placeholderStates} placeholder states`);
    if (row.layoutShift > 0.02) failures.push(`${at}: layout shift ${row.layoutShift}, the line is 0.02`);
    if (!row.headerKept) failures.push(`${at}: the header was replaced`);
    if (row.headerMoved) failures.push(`${at}: the header moved`);
    if (row.topOff !== null && row.topOff > 4) failures.push(`${at}: the new page opened ${row.topOff} px down, not at the top`);
    if (row.scrollOff !== null && row.scrollOff > 4) failures.push(`${at}: Back landed ${row.scrollOff} px from where the page was left`);
  }
  if (process.env.PAGES_REPORT_ONLY === "1") return;
  expect(failures, failures.join("\n")).toEqual([]);
});
