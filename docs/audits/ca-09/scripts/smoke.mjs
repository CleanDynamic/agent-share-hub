// CA-09: open one route signed in and print what happened: console errors, API requests, the text on screen.
// Usage: node docs/audits/ca-09/scripts/smoke.mjs /drafts [desktop|iphone] [wait ms]
import { open, SITE, standin, resetData, purpose } from "./lib.mjs";

const route = process.argv[2] ?? "/drafts";
const profile = process.argv[3] ?? "desktop";
const waitMs = Number(process.argv[4] ?? 6000);
await resetData();
await standin({ latency: 120 });
const { browser, page } = await open(profile);
const errors = [];
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()}: ${m.text().slice(0, 300)}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const api = [];
page.on("requestfinished", async (r) => {
  if (!r.url().includes(":54321")) return;
  const res = await r.response();
  api.push(`${r.method()} ${res?.status()} ${purpose(r.url())}`);
});
await page.goto(SITE + route);
await page.waitForTimeout(waitMs);
console.log("URL", page.url());
console.log("--- errors\n" + errors.join("\n"));
console.log("--- api\n" + api.join("\n"));
console.log("--- text\n" + (await page.evaluate(() => document.body.innerText)).slice(0, 1500));
await page.screenshot({ path: `/var/tmp/ca09-smoke-${profile}.png` });
await browser.close();
