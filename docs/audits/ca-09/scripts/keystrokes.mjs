// CA-09 Part 2 (renders): how much of the composer re-renders for one keystroke, and how long each key takes.
// Runs against the unminified build (component names kept; CA09_SITE=https://127.0.0.1:4444). Types 20 letters into
// the add-prompt field, then 20 into the first post, and counts the renders of the page's components per letter, and
// the longest `keydown`→paint event duration the browser reports.
// Usage: CA09_SITE=https://127.0.0.1:4444 node docs/audits/ca-09/scripts/keystrokes.mjs [desktop|iphone]
import { open, SITE, write, landmarks } from "./lib.mjs";
const profile = process.argv[2] ?? "desktop";
const L = await landmarks();
const NAMES = "AuthProvider,SiteFrame,SandboxPage,SandboxView,PostTab,BuildList,SourcesPanel,DetailsPanel,BuildMap,PostThread";
const { browser, page } = await open(profile, { renderTargets: NAMES });
await page.goto(`${SITE}/compose/${L.sevenStep}`);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(3000);
const out = { profile };
for (const [where, locate] of [
  ["add-prompt field", () => page.getByPlaceholder(/Paste or type a prompt/).first()],
  ["post editor", () => page.locator("main [contenteditable=true]").first()],
]) {
  const field = locate();
  await field.scrollIntoViewIfNeeded();
  await field.click();
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__ca09.renders = {}; window.__ca09.forever = true; window.__ca09.commits = 0; window.__ca09.events = []; });
  const t = Date.now();
  for (const ch of "abcdefghijklmnopqrst") await page.keyboard.type(ch, { delay: 120 });
  await page.waitForTimeout(1200);
  const probe = await page.evaluate(() => ({ renders: window.__ca09.renders, commits: window.__ca09.commits, events: window.__ca09.events }));
  const keyEvents = probe.events.filter((e) => /key|input/.test(e.name));
  out[where] = { letters: 20, ms: Date.now() - t, commits: probe.commits, rendersPerLetter: Object.fromEntries(Object.entries(probe.renders).map(([k, v]) => [k, Number((v / 20).toFixed(1))])), worstKeyEventMs: Math.max(0, ...keyEvents.map((e) => e.ms)), keyEventsOver50ms: keyEvents.filter((e) => e.ms > 50).length };
  console.log(where, JSON.stringify(out[where]));
}
write(`measurements/keystrokes-${profile}.json`, out);
await browser.close();
