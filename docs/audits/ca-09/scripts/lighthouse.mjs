// CA-09 Part 2: one Lighthouse run per route on the iPhone profile, signed in, against the stand-in.
//
// Lighthouse 12 (installed outside the project, CA09_LIGHTHOUSE) drives the pre-installed Chromium through a debugging
// port. The browser is launched by Playwright with a persistent profile so the signed-in session can be put in
// localStorage first; Lighthouse is told not to clear storage. Emulation: 430×932 at DPR 3 with the iPhone 15 Pro Max
// user agent; throttling applied by DevTools (not simulated): CPU 4×, "Fast 3G" (562.5 ms RTT, 1.44 Mbit/s down,
// 0.675 Mbit/s up). Reports: lighthouse/<route>.report.html and .json.
// Usage: CA09_LIGHTHOUSE=/path/to/node_modules/.bin/lighthouse node docs/audits/ca-09/scripts/lighthouse.mjs [route …]
import { chromium, devices } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { SITE, CHROMIUM, STORAGE_KEY, OUT, session, landmarks, standin, resetData, write } from "./lib.mjs";

const LH = process.env.CA09_LIGHTHOUSE ?? "lighthouse";
const L = await landmarks();
const ROUTES = [
  ["home", "/"], ["gallery", "/gallery"], ["build", `/b2/${L.showcaseSlug}`], ["drafts", "/drafts"], ["compose-new", "/compose/new"],
  ["compose-7step", `/compose/${L.sevenStep}`], ["compose-thread", `/compose/${L.thread}`], ["profile", `/profile/${L.profileHandle}`], ["messages", "/messages"],
];
const only = process.argv.slice(2);
const UA = devices["iPhone 15 Pro Max"].userAgent;
const dir = path.join(OUT, "lighthouse");
mkdirSync(dir, { recursive: true });
const summary = [];

for (const [name, route] of ROUTES) {
  if (only.length && !only.includes(name)) continue;
  await resetData();
  await standin({ latency: 120 });
  const profileDir = `/var/tmp/ca09-lh-profile-${name}`;
  rmSync(profileDir, { recursive: true, force: true });
  const port = 9300 + summary.length;
  const context = await chromium.launchPersistentContext(profileDir, { executablePath: CHROMIUM, headless: true, ignoreHTTPSErrors: true, args: [`--remote-debugging-port=${port}`, "--ignore-certificate-errors"] });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(`${SITE}/about`);
  const value = JSON.stringify(await session());
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, value]);
  await page.goto("about:blank");
  const outBase = path.join(dir, name);
  try {
    // Asynchronous on purpose: Playwright holds the browser and must keep answering it (it releases the tab
    // Lighthouse opens), which a blocking execFileSync would stop it doing.
    await promisify(execFile)(LH, [
      `${SITE}${route}`, `--port=${port}`, "--disable-storage-reset", "--output=html", "--output=json", `--output-path=${outBase}`,
      "--only-categories=performance", "--form-factor=mobile", "--screenEmulation.mobile", "--screenEmulation.width=430", "--screenEmulation.height=932", "--screenEmulation.deviceScaleFactor=3",
      `--emulatedUserAgent=${UA}`, "--throttling-method=devtools", "--throttling.cpuSlowdownMultiplier=4", "--throttling.requestLatencyMs=562.5",
      "--throttling.downloadThroughputKbps=1440", "--throttling.uploadThroughputKbps=675", "--max-wait-for-load=45000", "--quiet", "--chrome-flags=--ignore-certificate-errors",
    ], { timeout: 300_000, maxBuffer: 64 * 1024 * 1024 });
    const json = JSON.parse(readFileSync(`${outBase}.report.json`, "utf8"));
    const a = json.audits;
    const row = {
      route: name,
      score: Math.round((json.categories.performance.score ?? 0) * 100),
      fcpMs: Math.round(a["first-contentful-paint"].numericValue),
      lcpMs: Math.round(a["largest-contentful-paint"].numericValue),
      tbtMs: Math.round(a["total-blocking-time"].numericValue),
      cls: Number(a["cumulative-layout-shift"].numericValue.toFixed(3)),
      speedIndexMs: Math.round(a["speed-index"].numericValue),
      ttiMs: a.interactive ? Math.round(a.interactive.numericValue) : null,
      requests: a["network-requests"].details.items.length,
      transferKb: Math.round(a["total-byte-weight"].numericValue / 1024),
      unusedJsKb: a["unused-javascript"]?.details?.overallSavingsBytes ? Math.round(a["unused-javascript"].details.overallSavingsBytes / 1024) : 0,
      mainThreadMs: Math.round(a["mainthread-work-breakdown"].numericValue),
      bootupMs: Math.round(a["bootup-time"].numericValue),
    };
    summary.push(row);
    console.log(JSON.stringify(row));
  } catch (error) {
    summary.push({ route: name, error: String(error.message).split("\n")[0] });
    console.log(name, "failed", String(error.stderr ?? "").slice(-800), String(error.message).slice(0, 300));
  }
  await context.close();
}
write(`lighthouse/summary${only.length ? "-" + only.join("_") : ""}.json`, summary);
