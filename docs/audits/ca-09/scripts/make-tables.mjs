// CA-09: builds the report's tables from the raw measurement files, so every number in report.md comes from a file
// in this folder. Writes measurements/tables.md. Usage: node docs/audits/ca-09/scripts/make-tables.mjs
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { OUT, write } from "./lib.mjs";

const load = (rel) => (existsSync(path.join(OUT, rel)) ? JSON.parse(readFileSync(path.join(OUT, rel), "utf8")) : null);
const s = (ms) => (ms === null || ms === undefined ? "never" : (ms / 1000).toFixed(1) + " s");
const out = [];
const say = (line = "") => out.push(line);

const NAMES = { home: "`/`", gallery: "`/gallery`", build: "build page (`/b2/ca09-showcase`)", drafts: "`/drafts`", "compose-new": "`/compose/new`", "compose-7step": "`/compose/:id` (7 steps)", "compose-thread": "`/compose/:id` (40-picture thread)", profile: "profile (`/profile/ana-test`)", messages: "`/messages`" };

// T1 timing
const runs = { "iPhone, 120 ms": load("measurements/routes-iphone-normal.json"), "iPhone, 400 ms": load("measurements/routes-iphone-slow.json"), "desktop, 120 ms": load("measurements/routes-desktop-normal.json"), "desktop, 400 ms": load("measurements/routes-desktop-slow.json") };
const renders = load("measurements/routes-desktop-normal-renders.json") ?? [];
say("### T1 · Time to first paint and to usable");
say();
say("First paint / first contentful paint / usable (main content drawn and its main button present and enabled). Medians are not taken: one run each, fresh browser, cold cache.");
say();
say("| Route | " + Object.keys(runs).join(" | ") + " |");
say("|---|" + Object.keys(runs).map(() => "---").join("|") + "|");
for (const name of Object.keys(NAMES)) {
  const cells = Object.values(runs).map((list) => {
    const r = list?.find((x) => x.route === name);
    return r ? `${s(r.firstPaintMs)} / ${s(r.firstContentfulPaintMs)} / **${s(r.usableMs)}**` : "–";
  });
  say(`| ${NAMES[name]} | ${cells.join(" | ")} |`);
}
say();

say("### T2 · Requests, JavaScript, long tasks and renders (iPhone profile, 120 ms)");
say();
say("API = PostgREST, auth, RPC and storage-sign calls (preflights and the WebSocket left out), within the first 20 s. Rounds = API round trips one after another before the page was usable. JS = JavaScript fetched (gzip, as served). Long tasks = over 50 ms, count / total, first 20 s. Renders = how many times the page's top component and AuthProvider rendered in the first 5 s (desktop, unminified build).");
say();
say("| Route | API calls (before usable) | of which sign-URL calls | API rounds before usable | JS files / KB | long tasks | top component renders | AuthProvider renders | console errors |");
say("|---|---|---|---|---|---|---|---|---|");
for (const name of Object.keys(NAMES)) {
  const r = runs["iPhone, 120 ms"]?.find((x) => x.route === name);
  const rr = renders.find((x) => x.route === name);
  if (!r) continue;
  const top = rr ? Object.entries(rr.renders5s).filter(([k]) => !["AuthProvider", "SiteFrame", "SandboxView", "PostTab", "BuildList", "DraftsView"].includes(k)).map(([k, v]) => `${k} ${v}`).join(", ") : "–";
  say(`| ${NAMES[name]} | ${r.requests.api + r.requests.signUrl} (${r.apiBeforeUsable}) | ${r.requests.signUrl} | ${r.apiRoundsBeforeUsable} | ${r.requests.scripts} / ${Math.round(r.jsBytesWire / 1024)} | ${r.longTasks.count} / ${r.longTasks.totalMs} ms (worst ${r.longTasks.worstMs}) | ${top} | ${rr?.renders5s.AuthProvider ?? "–"} | ${r.consoleErrors.length} |`);
}
say();

say("### T3 · What each route asks for (desktop, 120 ms, first 8 s)");
say();
say("Each line: method, table or call, and how many times. Repeated reads in bold.");
say();
for (const name of Object.keys(NAMES)) {
  const r = runs["desktop, 120 ms"]?.find((x) => x.route === name);
  if (!r) continue;
  const parts = Object.entries(r.byPurpose).sort((a, b) => b[1] - a[1]).map(([k, n]) => (n > 1 ? `**${k} ×${n}**` : k));
  say(`- ${NAMES[name]} (${r.requests.api + r.requests.signUrl}): ${parts.join("; ")}`);
}
say();

const lh = load("lighthouse/summary.json");
if (lh) {
  say("### T4 · Lighthouse, iPhone profile (DevTools throttling: 4× CPU, Fast 3G)");
  say();
  say("| Route | Score | FCP | LCP | Speed Index | TBT | CLS | Requests | Transfer |");
  say("|---|---|---|---|---|---|---|---|---|");
  for (const r of lh) say(r.error ? `| ${NAMES[r.route]} | failed: ${r.error} |||||||| ` : `| ${NAMES[r.route]} | ${r.score} | ${s(r.fcpMs)} | ${s(r.lcpMs)} | ${s(r.speedIndexMs)} | ${r.tbtMs} ms | ${r.cls} | ${r.requests} | ${r.transferKb} KB |`);
  say();
}

const poll = load("measurements/polling.json");
if (poll) {
  say("### T5 · Polling: requests while the page sits open (desktop, 120 ms)");
  say();
  say("| Route | Requests per minute, visible | While hidden (30 s) | In the 5 s after coming back | What repeats |");
  say("|---|---|---|---|---|");
  for (const r of poll) say(`| ${NAMES[r.route]} | ${r.perMinuteVisible} | ${r.hidden30s} | ${r.onReturn5s} | ${Object.entries(r.visibleByPurpose).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${k} ×${n}`).join("; ")} |`);
  say();
}

const keys = ["desktop", "iphone"].map((p) => load(`measurements/keystrokes-${p}.json`)).filter(Boolean);
if (keys.length) {
  say("### T6 · One keystroke in the composer (7-step draft; 20 letters typed)");
  say();
  say("| Profile | Where | Renders per letter | Worst key event | Key events over 50 ms |");
  say("|---|---|---|---|---|");
  for (const k of keys) for (const where of ["add-prompt field", "post editor"]) if (k[where]) say(`| ${k.profile} | ${where} | ${Object.entries(k[where].rendersPerLetter).map(([n, v]) => `${n} ${v}`).join(", ") || "none counted"} | ${k[where].worstKeyEventMs} ms | ${k[where].keyEventsOver50ms} of 20 |`);
  say();
}

const acts = ["desktop", "iphone"].map((p) => load(`actions-${p}.json`));
if (acts[0] && acts[1]) {
  say("### T7 · Every action (desktop / iPhone profile)");
  say();
  say("ms = from the press to the first change on screen that is not just focus landing on the control (a menu, a dialog, a new step, the address changing, text). Works ≤ 300 ms with the expected result; Slow > 300 ms; Silent = something happened (a request, a focus) but nothing the maker can see; Broken = nothing, or it cannot be pressed.");
  say();
  say("| Where | Control | Should | Desktop | iPhone | What happens |");
  say("|---|---|---|---|---|---|");
  const keyOf = (r) => `${r.area}|${r.name}`;
  const all = new Map();
  for (const list of acts) for (const r of list) all.set(keyOf(r), { ...(all.get(keyOf(r)) ?? {}), [r.profile]: r });
  for (const [, pair] of all) {
    const any = pair.desktop ?? pair.iphone;
    const cell = (r) => (r ? `${r.verdict}${r.effectMs != null && r.verdict !== "Broken" ? ` ${r.effectMs} ms` : ""}` : "–");
    const happens = [pair.desktop, pair.iphone].filter(Boolean).map((r) => (r.verdict === "Works" ? null : `${r.profile}: ${r.note ?? r.effect ?? r.whatChanged ?? r.error ?? ""}`)).filter(Boolean).join("; ");
    say(`| ${any.area} | ${any.name} | ${any.should} | ${cell(pair.desktop)} | ${cell(pair.iphone)} | ${happens.replace(/\|/g, "/").slice(0, 160)} |`);
  }
  say();
}

const drafts = ["desktop", "iphone"].map((p) => load(`measurements/drafts-${p}.json`)).filter(Boolean);
if (drafts.length) {
  say("### T8 · The Drafts page under each failure");
  say();
  say("| Scenario | Profile | First draft drawn | \"That didn't load.\" drawn | After 40 s it shows | Session reads sent |");
  say("|---|---|---|---|---|---|");
  for (const list of drafts) for (const r of list) say(`| ${r.scenario} | ${r.profile} | ${s(r.firstDraftMs)} | ${s(r.errorShownMs)} | ${r.shows} | ${r.reads.filter((x) => /waiting|all sessions/.test(x)).length} |`);
  say();
}

const phone = [430, 390].map((w) => load(`phone/phone-${w}.json`));
if (phone[0]) {
  say("### T9 · Phone layout, per route (430 / 390 wide)");
  say();
  say("| Route | Points left for the page (of 739 / 664) | Bars | Touch targets under 44 | Desktop words | Text off the 22/18/15/13/11 scale | Gaps off 4/8/16/32 | Text left edge (most common) | Buttons drawn at 36 |");
  say("|---|---|---|---|---|---|---|---|---|");
  for (const r of phone[0]) {
    const n = phone[1]?.find((x) => x.route === r.route);
    say(`| ${NAMES[r.route]} | ${r.pointsLeft} / ${n?.pointsLeft ?? "–"} | ${r.bars.map((b) => `${b.edge} ${b.height}`).join(", ")} | ${r.targetsUnder44} of ${r.controls} | ${r.desktopWords.length ? r.desktopWords.map((w) => `"${w.slice(0, 40)}"`).join(", ") : "none"} | ${r.spacing.textOffScale} of ${r.spacing.textElements} (${r.spacing.textOffScaleTop.slice(0, 3).map(([v, c]) => `${v} ×${c}`).join(", ")}) | ${r.spacing.gapsOffScale} (${r.spacing.gapsOffScaleTop.slice(0, 3).map(([v, c]) => `${v} ×${c}`).join(", ")}) | ${r.spacing.leftEdges.slice(0, 2).map(([v, c]) => `${v} ×${c}`).join(", ")} | ${r.spacing.buttonsAt36} of ${r.spacing.buttons} |`);
  }
  say();
}

write("measurements/tables.md", out.join("\n"));
console.log(out.length, "lines");
