/* SV-03: how long a page takes to show its first screen, and how many requests it takes to get there.

   RUN WITH `npm run audit:pages`, which builds the bundle and serves it with `vite preview`: a dev server serves hundreds
   of unbundled modules and says nothing about the product (performance.spec.ts explains the same).

   THE DATABASE IS THE AUDIT HARNESS (support/harness.ts, support/restFilter.ts), signed in as ME, with every request
   answered DB_DELAY_MS late, so a request chain shows as time: five rounds in a row cost five delays.

   FOR EACH PAGE IN support/pageTargets.ts, four ways, each run RUNS times with the median reported:
     cold    an empty cache: a fresh browser context opens the page, code and all.
     first   not visited yet: the app is open on another page (given time to load code at idle), and the page is opened from
             inside it for the first time, with no hover first.
     warm    visited earlier in the same visit: the page is opened, left for another, and opened again from inside the app.
     reload  the page opened, then reloaded.
   From the navigation (or the click) to the page-ready mark (`usePageReady`) it records the time, the requests, the request
   ROUNDS (the longest chain of requests where each starts after the one before it ended) and the bytes of JSON received.

   WHAT FAILS: a page whose `maxRounds` is missed on its first visit from inside the app, and a page whose cold request count is more than one over the number
   in support/pageBaseline.json (written at the end of SV-03). Times are reported and never fail: a time is read by eye. */

import { expect, test, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { BUILDS, BUILD_SLUG, THEM, installStub, withSession, withTheme } from "./support/harness";
import { filterRows } from "./support/restFilter";
import { SV_BUILD_SESSIONS, SV_DRAFTS, SV_DRAFT_ID, SV_IMPORT_SESSIONS, SV_SAVES } from "./fixtures/svPages";
import { DB_DELAY_MS, PAGE_TARGETS, type PageTarget } from "./support/pageTargets";
import { roundsOf } from "./support/rounds";
import { OUT_DIR, writeText } from "./support/report";

test.describe.configure({ mode: "serial" });

const RUNS = Number(process.env.PAGES_RUNS ?? 3);
const ONLY = (process.env.PAGES_ONLY ?? "").split(",").filter(Boolean);
const TRACE = process.env.PAGES_TRACE === "1";
/* PAGES_AFTER_MS=1500 adds that long after the ready mark to what is listed, to see what a page asks for next. */
const AFTER_MS = Number(process.env.PAGES_AFTER_MS ?? 0);
/* PAGES_REPORT_ONLY=1 writes the report and fails on nothing: the numbers before a change are what is being read. */
const BASE_URL = process.env.PERF_BASE_URL ?? "";
const BASELINE_FILE = path.resolve(process.cwd(), "e2e/audit/support/pageBaseline.json");

type Mode = "cold" | "first" | "warm" | "reload";
const MODES: Mode[] = ["cold", "first", "warm", "reload"];

interface Sample {
  ms: number;
  requests: number;
  rounds: number;
  bytes: number;
  urls: string[];
}

interface Span {
  url: string;
  start: number;
  end: number;
  bytes: number;
}

const isDatabase = (url: string) => /\/(rest|auth|functions)\/v1\//.test(url);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const resolvePath = (target: PageTarget) =>
  target.path.replace("{draft}", SV_DRAFT_ID).replace("{build}", BUILD_SLUG).replace("{maker}", THEM.username);

/** The harness, plus the SV-03 rows answered the way PostgREST would, and the delay on every database request. */
async function stage(page: Page, target: PageTarget, spans: Span[]) {
  await withTheme(page, "dusk");
  if (target.auth) await withSession(page);
  await installStub(page);

  const answer = (rows: Record<string, unknown>[]) => async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const found = filterRows(rows, route.request().url());
    const object = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": `0-${Math.max(found.length - 1, 0)}/${found.length}`, "access-control-allow-origin": "*" },
      body: JSON.stringify(object ? (found[0] ?? null) : found),
    });
  };
  await page.route(/\/rest\/v1\/builds(\?|$)/, answer([...BUILDS, ...SV_DRAFTS]));
  await page.route(/\/rest\/v1\/import_sessions(\?|$)/, answer(SV_IMPORT_SESSIONS));
  await page.route(/\/rest\/v1\/build_sessions(\?|$)/, answer(SV_BUILD_SESSIONS));
  await page.route(/\/rest\/v1\/build_saves(\?|$)/, answer(SV_SAVES(String(BUILDS[0].id))));

  // Registered last, so it runs first: hold the request, then hand it to the handlers above.
  await page.route(/\/(rest|auth|functions)\/v1\//, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DB_DELAY_MS));
    await route.fallback();
  });

  const open = new Map<import("@playwright/test").Request, number>();
  page.on("request", (request) => {
    if (isDatabase(request.url())) open.set(request, Date.now());
  });
  const done = (request: import("@playwright/test").Request) => {
    const start = open.get(request);
    if (start === undefined) return;
    open.delete(request);
    spans.push({ url: request.url(), start, end: Date.now(), bytes: 0 });
  };
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  page.on("response", (response) => {
    if (!isDatabase(response.url())) return;
    void response
      .body()
      .then((body) => {
        const span = [...spans].reverse().find((entry) => entry.url === response.url() && entry.bytes === 0);
        if (span) span.bytes = body.length;
        else spans.push({ url: response.url(), start: Date.now(), end: Date.now(), bytes: body.length });
      })
      .catch(() => {});
  });
}

const ready = (page: Page, mark: string) =>
  page.waitForFunction((name) => document.documentElement.getAttribute("data-page-ready") === name, mark, { timeout: 30_000 });

/** When the page-ready mark was last set: the epoch millisecond, and the milliseconds since the document began. */
const readMark = (page: Page, mark: string) =>
  page.evaluate((name) => {
    const entry = performance.getEntriesByName(`page-ready:${name}`).at(-1);
    return { startTime: entry?.startTime ?? -1, epoch: entry ? performance.timeOrigin + entry.startTime : -1 };
  }, mark);

function summarise(spans: Span[], from: number, until: number, ms: number): Sample {
  const counted = spans.filter((span) => span.start >= from && span.start <= until);
  return {
    ms: Math.round(ms),
    requests: counted.length,
    rounds: roundsOf(counted),
    bytes: counted.reduce((sum, span) => sum + span.bytes, 0),
    // With PAGES_TRACE=1: when each request started and ended, from the first of them, to read the chain by eye.
    urls: [...counted]
      .sort((a, b) => a.start - b.start)
      .map((span) => `+${span.start - (counted[0] ? Math.min(...counted.map((c) => c.start)) : 0)}..+${span.end - Math.min(...counted.map((c) => c.start))}  ${new URL(span.url).pathname.replace("/rest/v1/", "")}${new URL(span.url).search.slice(0, 80)}`),
  };
}

async function sampleOnce(browser: Browser, target: PageTarget, mode: Mode): Promise<Sample> {
  const context = await browser.newContext({ baseURL: BASE_URL || undefined, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const spans: Span[] = [];
  try {
    await stage(page, target, spans);
    const url = resolvePath(target);

    if (mode === "cold") {
      const from = Date.now();
      await page.goto(url, { waitUntil: "commit" });
      await ready(page, target.readyMark);
      const mark = await readMark(page, target.readyMark);
      await page.waitForTimeout(150 + AFTER_MS);
      return summarise(spans, from - 1, mark.epoch + 1 + AFTER_MS, mark.startTime);
    }

    if (mode === "reload") {
      await page.goto(url, { waitUntil: "commit" });
      await ready(page, target.readyMark);
      await page.waitForTimeout(3_000); // the kept cache is written two seconds after the last change
      const from = Date.now();
      await page.reload({ waitUntil: "commit" });
      await ready(page, target.readyMark);
      const mark = await readMark(page, target.readyMark);
      await page.waitForTimeout(150);
      return summarise(spans, from - 1, mark.epoch + 1, mark.startTime);
    }

    const goInApp = (to: string) =>
      page.evaluate((address) => {
        const at = performance.now();
        const epoch = Date.now();
        history.pushState({}, "", address);
        dispatchEvent(new PopStateEvent("popstate"));
        return { at, epoch };
      }, to);

    if (mode === "first") {
      const [from, fromMark] = target.key === "home" ? ["/library", "library"] : ["/", "home"];
      await page.goto(from, { waitUntil: "commit" });
      await ready(page, fromMark);
      await page.waitForTimeout(4_000); // the idle loader has time to bring the next pages' code
      const start = await goInApp(url);
      await ready(page, target.readyMark);
      const mark = await readMark(page, target.readyMark);
      await page.waitForTimeout(150);
      return summarise(spans, start.epoch - 1, mark.epoch + 1, mark.startTime - start.at);
    }

    // warm: open it, leave for Drafts (or Library), come back from inside the app
    await page.goto(url, { waitUntil: "commit" });
    await ready(page, target.readyMark);
    await page.waitForTimeout(400);
    const [elsewhere, elsewhereMark] = target.key === "drafts" ? ["/library", "library"] : ["/drafts", "drafts"];
    await page.evaluate((to) => {
      history.pushState({}, "", to);
      dispatchEvent(new PopStateEvent("popstate"));
    }, elsewhere);
    await ready(page, elsewhereMark);
    await page.waitForTimeout(400);
    const start = await goInApp(url);
    await ready(page, target.readyMark);
    const mark = await readMark(page, target.readyMark);
    await page.waitForTimeout(150);
    return summarise(spans, start.epoch - 1, mark.epoch + 1, mark.startTime - start.at);
  } finally {
    await context.close();
  }
}

interface Row {
  key: string;
  mode: Mode;
  ms: number;
  requests: number;
  rounds: number;
  /** The fewest rounds in any of the runs: a busy main thread delays a request that did not wait for anything, and that reads as a round. */
  roundsBest: number;
  kb: number;
  urls: string[];
}

const results: Row[] = [];

for (const target of PAGE_TARGETS.filter((entry) => ONLY.length === 0 || ONLY.includes(entry.key))) {
  test(`pages: ${target.key}`, async ({ browser }) => {
    for (const mode of MODES) {
      const samples: Sample[] = [];
      for (let run = 0; run < RUNS; run += 1) samples.push(await sampleOnce(browser, target, mode));
      const row: Row = {
        key: target.key,
        mode,
        ms: median(samples.map((sample) => sample.ms)),
        requests: median(samples.map((sample) => sample.requests)),
        rounds: median(samples.map((sample) => sample.rounds)),
        roundsBest: Math.min(...samples.map((sample) => sample.rounds)),
        kb: Math.round((median(samples.map((sample) => sample.bytes)) / 1024) * 10) / 10,
        urls: samples[0].urls,
      };
      results.push(row);
      if (TRACE) console.log(`${target.key} ${mode}: ${row.ms} ms, ${row.requests} requests, ${row.rounds} rounds\n  ${row.urls.join("\n  ")}`);
    }
  });
}

test("pages: report and targets", async () => {
  const table = [
    "| page | way | ms | requests | rounds | best of runs | KB |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...results.map((row) => `| ${row.key} | ${row.mode} | ${row.ms} | ${row.requests} | ${row.rounds} | ${row.roundsBest} | ${row.kb} |`),
  ].join("\n");
  writeText("pages.md", `Page audit, every database request delayed ${DB_DELAY_MS} ms, median of ${RUNS}.\n\n${table}\n`);
  writeText("pages.json", JSON.stringify(results, null, 2));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n${table}\n`);

  const failures: string[] = [];
  const baseline: Record<string, number> = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8")) : {};
  for (const target of PAGE_TARGETS) {
    const cold = results.find((row) => row.key === target.key && row.mode === "cold");
    if (!cold) continue;
    // Rounds are judged where the page is opened from inside the app, on the best of the runs: a direct load's code, or a
    // heavy first render, holds the main thread long enough to open gaps between requests that no chain made.
    const first = results.find((entry) => entry.key === target.key && entry.mode === "first");
    if (first && target.maxRounds !== null && first.roundsBest > target.maxRounds) failures.push(`${target.key}: ${first.roundsBest} rounds at best, the target is ${target.maxRounds}`);
    const allowed = baseline[target.key];
    if (allowed !== undefined && cold.requests > allowed + 1) failures.push(`${target.key}: ${cold.requests} requests, ${allowed} after SV-03 and one more is allowed`);
  }
  if (process.env.PAGES_REPORT_ONLY === "1") return;
  expect(failures, failures.join("\n")).toEqual([]);
});
