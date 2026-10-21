// CA-09 Part 2 (polling): what each page asks for while it sits open, while its tab is hidden, and when the reader
// comes back. Desktop profile, normal latency. For each route:
//   - 60 s open and visible, after the first 10 s of loading: requests per minute, by purpose;
//   - 30 s hidden (document.hidden true, visibilitychange (bubbling, as the browser fires it) and blur dispatched, as a phone does when the reader
//     switches app): requests made while hidden;
//   - coming back (visible, visibilitychange and focus): requests in the next 5 s.
// Usage: node docs/audits/ca-09/scripts/polling.mjs [route-name …]
import { open, SITE, standin, resetData, clearLog, serverLog, write, landmarks } from "./lib.mjs";

const L = await landmarks();
const ROUTES = [
  ["home", "/"], ["gallery", "/gallery"], ["build", `/b2/${L.showcaseSlug}`], ["drafts", "/drafts"], ["compose-new", "/compose/new"],
  ["compose-7step", `/compose/${L.sevenStep}`], ["profile", `/profile/${L.profileHandle}`], ["messages", "/messages"],
];
const only = process.argv.slice(2);
const what = (path) => {
  const [p, q = ""] = path.split("?");
  const table = p.replace("/rest/v1/", "").replace("/auth/v1/", "auth ").replace("/storage/v1/", "storage ");
  const filters = q.split("&").filter((kv) => kv && !/^(select|order|limit|offset)=/.test(kv)).map((kv) => kv.split("=")[0]);
  return `${table}${filters.length ? " ?" + filters.join("&") : ""}`;
};
const tally = (log, method = true) => {
  const out = {};
  for (const e of log) {
    if (e.method === "OPTIONS" || e.method === "WS") continue;
    const k = `${method ? e.method + " " : ""}${what(e.path)}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

const results = [];
for (const [name, path] of ROUTES) {
  if (only.length && !only.includes(name)) continue;
  await resetData();
  await standin({ latency: 120 });
  const { browser, page } = await open("desktop");
  await page.goto(SITE + path);
  await page.waitForTimeout(10_000);
  await clearLog();
  await page.waitForTimeout(60_000);
  const visible = (await serverLog()).filter((e) => e.method !== "OPTIONS" && e.method !== "WS");
  await clearLog();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    window.dispatchEvent(new Event("blur"));
  });
  await page.waitForTimeout(30_000);
  const hidden = (await serverLog()).filter((e) => e.method !== "OPTIONS" && e.method !== "WS");
  await clearLog();
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    window.dispatchEvent(new Event("focus"));
  });
  await page.waitForTimeout(5_000);
  const back = (await serverLog()).filter((e) => e.method !== "OPTIONS" && e.method !== "WS");
  await browser.close();
  const r = { route: name, path, perMinuteVisible: visible.length, visibleByPurpose: tally(visible), hidden30s: hidden.length, hiddenByPurpose: tally(hidden), onReturn5s: back.length, returnByPurpose: tally(back) };
  results.push(r);
  console.log(`${name.padEnd(14)} visible/min ${String(r.perMinuteVisible).padStart(3)}  hidden 30s ${String(r.hidden30s).padStart(3)}  return 5s ${String(r.onReturn5s).padStart(3)}  ${JSON.stringify(r.visibleByPurpose)}`);
}
write(`measurements/polling${only.length ? "-" + only.join("_") : ""}.json`, results);
