// CA-09 Part 4: the Drafts page in the browser, on the stand-in with tonight's schema, under each way its three
// reads can go wrong. For each scenario and profile: when the first draft is drawn, when "That didn't load." is
// drawn, which requests were made and how they ended, and a screenshot.
//
// The three reads (DraftsPage.tsx:40-50): drafts (builds, BUILD_COLUMNS, then the counts), waiting sessions
// (import_sessions status=parsed, every 10 s), all sessions (status=parsed,claimed).
// Usage: node docs/audits/ca-09/scripts/drafts.mjs [desktop|iphone] [scenario …]
import { open, SITE, standin, resetData, clearLog, serverLog, write } from "./lib.mjs";

const profile = process.argv[2] ?? "desktop";
const only = process.argv.slice(3);
const WAITING = "^/rest/v1/import_sessions\\?.*status=in\\.\\(parsed\\)(&|$)";
const ALL = "^/rest/v1/import_sessions\\?.*status=in\\.\\(parsed,claimed\\)";
const DRAFTS = "^/rest/v1/builds\\?select=id,creator_id";
const T57014 = { status: 500, body: { code: "57014", details: null, hint: null, message: "canceling statement due to statement timeout" } };
// Postgres 16 spends ~1 ms per MB of proposal, hot (proposal-cost.mjs); 5 stands for a shared-CPU instance.
const COST = 5;

const SCENARIOS = {
  "normal (120 ms)": { latency: 120, proposalCostMsPerMb: COST },
  "slow (400 ms)": { latency: 400, proposalCostMsPerMb: COST },
  "statement timeout when a returned proposal is over 1 MB (8 s, 57014)": { latency: 400, proposalCostMsPerMb: COST, statementTimeoutMs: 8000, timeoutWhenProposalOverMb: 1 },
  "waiting sessions slow alone (+6 s)": { latency: 120, delays: [{ method: "GET", path: WAITING, delayMs: 6000 }] },
  "all sessions slow alone (+6 s)": { latency: 120, delays: [{ method: "GET", path: ALL, delayMs: 6000 }] },
  "drafts slow alone (+6 s)": { latency: 120, delays: [{ method: "GET", path: DRAFTS, delayMs: 6000 }] },
  "waiting sessions fail alone (57014)": { latency: 120, faults: [{ method: "GET", path: WAITING, ...T57014 }] },
  "all sessions fail alone (57014)": { latency: 120, faults: [{ method: "GET", path: ALL, ...T57014 }] },
  "drafts fail alone (57014)": { latency: 120, faults: [{ method: "GET", path: DRAFTS, ...T57014 }] },
  "both session reads fail": { latency: 120, faults: [{ method: "GET", path: WAITING, ...T57014 }, { method: "GET", path: ALL, ...T57014 }] },
  "everything fails": { latency: 120, faults: [{ method: "GET", path: WAITING, ...T57014 }, { method: "GET", path: ALL, ...T57014 }, { method: "GET", path: DRAFTS, ...T57014 }] },
};

const results = [];
for (const [name, config] of Object.entries(SCENARIOS)) {
  if (only.length && !only.some((o) => name.includes(o))) continue;
  await resetData();
  await standin(config);
  await clearLog();
  const { browser, page } = await open(profile);
  await page.goto(`${SITE}/drafts`, { waitUntil: "commit" });
  const times = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const out = { draftsMs: null, errorMs: null, sessionsMs: null };
        const tick = () => {
          const text = document.querySelector("main")?.innerText ?? "";
          if (out.draftsMs === null && /Pantry inventory helper/.test(text)) out.draftsMs = Math.round(performance.now());
          if (out.errorMs === null && /didn.t load/.test(text)) out.errorMs = Math.round(performance.now());
          if (out.sessionsMs === null && /claude-sonnet/.test(text)) out.sessionsMs = Math.round(performance.now());
          if (performance.now() > 40000) return resolve(out);
          setTimeout(tick, 50);
        };
        tick();
      }),
  );
  const shot = `measurements/screens/drafts-${profile}-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
  await page.screenshot({ path: new URL(`../${shot}`, import.meta.url).pathname });
  const finalText = (await page.evaluate(() => document.querySelector("main")?.innerText ?? "")).slice(0, 300);
  await browser.close();
  const log = (await serverLog()).filter((e) => /import_sessions|builds\?select=id/.test(e.path) && e.method === "GET");
  const what = (p) => (/status=in.\(parsed\)(&|$)/.test(p) ? "waiting" : /parsed,claimed\)/.test(p) ? "all sessions" : /select=id,session_count/.test(p) ? "draft counts" : /select=id,creator_id/.test(p) ? "drafts" : p.slice(0, 40));
  const r = {
    scenario: name,
    profile,
    firstDraftMs: times.draftsMs,
    errorShownMs: times.errorMs,
    sessionsShownMs: times.sessionsMs,
    reads: log.map((e) => `${(e.at / 1000).toFixed(1)}s ${what(e.path)} ${e.status}${e.code ? " " + e.code : ""} ${e.ms}ms${e.proposalMb ? " (" + e.proposalMb + " MB of proposal)" : ""}`),
    shows: /didn.t load/.test(finalText) ? "That didn't load." : /Pantry inventory helper/.test(finalText) ? "the drafts" : "a skeleton or nothing",
    screenshot: shot,
  };
  results.push(r);
  console.log(`${profile} ${name.padEnd(70)} drafts ${String(r.firstDraftMs).padStart(6)}  error ${String(r.errorShownMs).padStart(6)}  after 40 s: ${r.shows}  reads ${log.length}`);
}
write(`measurements/drafts-${profile}${only.length ? "-partial" : ""}.json`, results);
