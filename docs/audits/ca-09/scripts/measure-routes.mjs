// CA-09 Part 2: every route, on both profiles, against the stand-in. Writes measurements/routes-<profile>-<mode>.json.
//
// Per route: first paint and first contentful paint; time to usable (the route's main content drawn AND its main
// button present and enabled, `ready` below); every request with its purpose and timing; API requests repeated
// within the window; the depth of the API waterfall (how many round trips one after another); JavaScript fetched;
// long tasks over 50 ms; React commits in the first 5 s; and, with CA09_RENDERS=1 against the unminified build,
// renders of the page's top component.
//
// Usage: node docs/audits/ca-09/scripts/measure-routes.mjs desktop|iphone [normal|slow] [route-name …]
import { open, SITE, standin, resetData, recordNetwork, write, purpose, landmarks } from "./lib.mjs";

const profileName = process.argv[2] ?? "desktop";
const mode = process.argv[3] ?? "normal";
const only = process.argv.slice(4);
const latency = mode === "slow" ? 400 : 120;
const WINDOW_MS = Number(process.env.CA09_WINDOW_MS ?? (profileName === "desktop" ? 8000 : 20000));
const L = await landmarks();

const visible = (el) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
};

/** Each route: its address, its top component, and when it counts as usable. */
export const ROUTES = [
  { name: "home", path: "/", top: "HomePage", main: "the feed's first build", ready: () => [...document.querySelectorAll("main a[href^='/b2/']")].some((a) => a.offsetHeight > 0) },
  { name: "gallery", path: "/gallery", top: "GalleryPage", main: "the first build card, or the error", ready: () => [...document.querySelectorAll("main a[href^='/b2/']")].some((a) => a.offsetHeight > 0) || /didn.t load/i.test(document.querySelector("main")?.innerText ?? "") },
  { name: "build", path: `/b2/${L.showcaseSlug}`, top: "BuildPage", main: "the title and Copy for AI", ready: () => /Garden diary, start to finish/.test(document.querySelector("main h1")?.textContent ?? "") && [...document.querySelectorAll("main button")].some((b) => /copy/i.test(b.textContent) && !b.disabled) },
  { name: "drafts", path: "/drafts", top: "DraftsPage", main: "the first draft and the session list", ready: () => /Pantry inventory helper/.test(document.querySelector("main")?.innerText ?? "") && /Sessions/.test(document.querySelector("main")?.innerText ?? "") },
  { name: "compose-new", path: "/compose/new", top: "SandboxPage", main: "the Add button", ready: () => [...document.querySelectorAll("main button")].some((b) => b.textContent.trim() === "Add" && !b.disabled && b.offsetHeight > 0) },
  { name: "compose-7step", path: `/compose/${L.sevenStep}`, top: "SandboxPage", main: "the steps and Add", ready: () => /Prompt 1/.test(document.querySelector("main")?.innerText ?? "") && [...document.querySelectorAll("main button")].some((b) => b.textContent.trim() === "Add" && !b.disabled && b.offsetHeight > 0) },
  { name: "compose-thread", path: `/compose/${L.thread}`, top: "SandboxPage", main: "the post's words and Add", ready: () => /The by the lost sort/i.test(document.querySelector("main .ProseMirror, main [contenteditable]")?.textContent ?? "") && [...document.querySelectorAll("main button")].some((b) => b.textContent.trim() === "Add" && !b.disabled) },
  { name: "profile", path: `/profile/${L.profileHandle}`, top: "ProfilePage", main: "the maker's name and builds", ready: () => /Ana Test/.test(document.querySelector("main")?.innerText ?? "") && [...document.querySelectorAll("main a[href^='/b2/']")].some((a) => a.offsetHeight > 0) },
  { name: "messages", path: "/messages", top: "MessagesPage", main: "the thread list", ready: () => /\b(Bo|Chi|Dev) Test\b/.test(document.body.innerText) },
];

async function measure(route) {
  await resetData();
  await standin({ latency });
  const { browser, page, cdp } = await open(profileName, { renderTargets: process.env.CA09_RENDERS ? [route.top, "AuthProvider", "SiteFrame", "SiteHeader", "SandboxView", "BuildList", "PostTab", "DraftsView"].join(",") : "" });
  const t0 = { value: 0 };
  cdp.on("Network.requestWillBeSent", (e) => {
    if (!t0.value && e.type === "Document") t0.value = e.timestamp;
  });
  const requests = recordNetwork(cdp, t0);
  const consoleErrors = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 240)));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 240)}`));

  await page.goto(SITE + route.path, { waitUntil: "commit" });
  let usableMs = null;
  try {
    const handle = await page.waitForFunction(
      (src) => {
        const ok = new Function("visible", `return (${src})()`)((el) => el && el.offsetHeight > 0);
        return ok ? performance.now() : false;
      },
      route.ready.toString(),
      { timeout: 60_000, polling: 50 },
    );
    usableMs = Math.round(await handle.jsonValue());
  } catch {
    usableMs = null;
  }
  const elapsed = await page.evaluate(() => performance.now());
  if (elapsed < WINDOW_MS) await page.waitForTimeout(WINDOW_MS - elapsed);
  const probe = await page.evaluate(() => ({ ...window.__ca09, nav: performance.getEntriesByType("navigation")[0]?.toJSON?.() }));
  const shot = `measurements/screens/${profileName}-${mode}-${route.name}.png`;
  await page.screenshot({ path: new URL(`../${shot}`, import.meta.url).pathname });
  const all = requests().filter((r) => r.startMs !== null && r.startMs <= WINDOW_MS);
  await browser.close();

  const api = all.filter((r) => r.url.includes(":54321") && r.method !== "OPTIONS" && !r.url.includes("/storage/v1/object/sign") && !r.url.includes("/render/image/sign"));
  const storageFiles = all.filter((r) => /\/storage\/v1\/(object|render\/image)\/(sign|public)\//.test(r.url) && r.method === "GET");
  const signCalls = all.filter((r) => /\/storage\/v1\/object\/sign\//.test(r.url) && r.method === "POST");
  const scripts = all.filter((r) => r.type === "Script");
  // Rounds: a request is in round n+1 when it started after a request of round n had finished.
  const apiSorted = [...api, ...signCalls].sort((a, b) => a.startMs - b.startMs);
  const round = new Map();
  for (const r of apiSorted) {
    let n = 1;
    for (const q of apiSorted) if (q !== r && q.endMs !== null && q.endMs <= r.startMs + 2) n = Math.max(n, (round.get(q) ?? 1) + 1);
    round.set(r, n);
  }
  const usableRound = usableMs === null ? null : Math.max(0, ...apiSorted.filter((r) => r.endMs !== null && r.endMs <= usableMs).map((r) => round.get(r)));
  const byPurpose = {};
  for (const r of [...api, ...signCalls]) {
    const key = `${r.method} ${purpose(r.url)}`;
    byPurpose[key] = (byPurpose[key] ?? 0) + 1;
  }
  const paint = (name) => probe.paints.find((p) => p.name === name)?.at ?? null;
  return {
    route: route.name,
    path: route.path,
    profile: profileName,
    mode,
    latencyMs: latency,
    windowMs: WINDOW_MS,
    firstPaintMs: paint("first-paint"),
    firstContentfulPaintMs: paint("first-contentful-paint"),
    usableMs,
    usableMeans: route.main,
    requests: { total: all.length, api: api.length, signUrl: signCalls.length, storageFiles: storageFiles.length, scripts: scripts.length, css: all.filter((r) => r.type === "Stylesheet").length, fonts: all.filter((r) => r.type === "Font").length },
    apiBeforeUsable: usableMs === null ? null : [...api, ...signCalls].filter((r) => r.startMs <= usableMs).length,
    apiRoundsBeforeUsable: usableRound,
    apiRoundsTotal: Math.max(0, ...round.values()),
    repeated: Object.entries(byPurpose).filter(([, n]) => n > 1).map(([k, n]) => ({ request: k, times: n })),
    byPurpose,
    jsBytesWire: scripts.reduce((s, r) => s + (r.bytes ?? 0), 0),
    jsBeforeUsableWire: usableMs === null ? null : scripts.filter((r) => r.startMs <= usableMs).reduce((s, r) => s + (r.bytes ?? 0), 0),
    scriptFiles: scripts.map((r) => ({ file: new URL(r.url).pathname.replace("/assets/", ""), bytes: r.bytes, startMs: r.startMs, endMs: r.endMs })),
    longTasks: { count: probe.longTasks.length, totalMs: probe.longTasks.reduce((s, t) => s + t.ms, 0), worstMs: Math.max(0, ...probe.longTasks.map((t) => t.ms)), list: probe.longTasks },
    reactCommits5s: probe.commits,
    renders5s: probe.renders,
    consoleErrors,
    failed: all.filter((r) => r.status >= 400 || r.failed).map((r) => ({ status: r.status, failed: r.failed, what: purpose(r.url) })),
    timeline: [...api, ...signCalls].map((r) => ({ startMs: r.startMs, endMs: r.endMs, status: r.status, method: r.method, what: purpose(r.url) })),
    screenshot: shot,
  };
}

const results = [];
for (const route of ROUTES) {
  if (only.length && !only.includes(route.name)) continue;
  const r = await measure(route);
  results.push(r);
  console.log(`${profileName} ${mode} ${r.route.padEnd(15)} FCP ${String(r.firstContentfulPaintMs).padStart(6)}  usable ${String(r.usableMs).padStart(6)}  api ${String(r.requests.api).padStart(3)} sign ${String(r.requests.signUrl).padStart(3)} rounds ${r.apiRoundsBeforeUsable}  js ${Math.round(r.jsBytesWire / 1024)}KB  long ${r.longTasks.count}/${r.longTasks.totalMs}ms  commits ${r.reactCommits5s} ${JSON.stringify(r.renders5s)}`);
}
const suffix = process.env.CA09_RENDERS ? "-renders" : "";
write(`measurements/routes-${profileName}-${mode}${suffix}${only.length ? "-" + only.join("_") : ""}.json`, results);
