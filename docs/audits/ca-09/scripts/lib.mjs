// CA-09 measurement helpers: the two device profiles, signing in to the stand-in, and the in-page probes.
//
// Profiles (Part 1):
//   desktop  1280×800, Chromium, no throttling.
//   iphone   Playwright devices["iPhone 15 Pro Max"] (430×739 CSS px, DPR 3, touch, mobile UA). WebKit is not
//            installed in this container and may not be downloaded, so this is Chromium with that viewport, CPU
//            throttled 4× and the network on Chrome DevTools' "Fast 3G" preset (562.5 ms latency, 1.44 Mbit/s
//            down, 0.675 Mbit/s up), both through CDP.
import { chromium, devices } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The stand-in uses a self-signed certificate on 127.0.0.1; Node's fetch to it (config, reset) must accept it.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
export const SITE = process.env.CA09_SITE ?? "https://127.0.0.1:4443";
export const API = process.env.CA09_API ?? "https://127.0.0.1:54321";
export const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CHROMIUM = process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
export const STORAGE_KEY = "sb-127-auth-token";

export const FAST_3G = { offline: false, latency: 562.5, downloadThroughput: (1.44e6 / 8), uploadThroughput: (0.675e6 / 8) };

const iphone = { ...devices["iPhone 15 Pro Max"] };
delete iphone.defaultBrowserType;

export const PROFILES = {
  desktop: { name: "desktop", context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, cpu: 1, network: null },
  iphone: { name: "iphone", context: iphone, cpu: 4, network: FAST_3G },
  // Part 5's second phone width.
  iphone390: { name: "iphone390", context: { ...iphone, viewport: { width: 390, height: 664 }, screen: { width: 390, height: 844 } }, cpu: 4, network: FAST_3G },
};

export const ROUTES_FILE = path.join(OUT, "routes.json");

export async function standin(configPatch = {}) {
  const res = await fetch(`${API}/__audit/config`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(configPatch) });
  return res.json();
}
export const resetData = () => fetch(`${API}/__audit/reset`, { method: "POST" });
export const clearLog = () => fetch(`${API}/__audit/clear-log`, { method: "POST" });
export const serverLog = async () => (await fetch(`${API}/__audit/log`)).json();

export async function session() {
  const { sessionForStorage } = await import("../../../../src/lib/build/__audit__/ca09/seed.mjs");
  return sessionForStorage();
}

export async function landmarks() {
  const { landmarks } = await import("../../../../src/lib/build/__audit__/ca09/seed.mjs");
  return landmarks();
}

/** In-page probes, installed before any script: paints, long tasks, layout shifts, and React commits. */
export const PROBES = (target) => {
  const w = window;
  w.__ca09 = { longTasks: [], paints: [], renders: {}, commits: 0, events: [] };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__ca09.longTasks.push({ start: Math.round(e.startTime), ms: Math.round(e.duration) });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__ca09.paints.push({ name: e.name, at: Math.round(e.startTime) });
    }).observe({ type: "paint", buffered: true });
  } catch {}
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__ca09.events.push({ name: e.name, ms: Math.round(e.duration), at: Math.round(e.startTime) });
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {}
  // React DevTools' hook, as React looks for it: every commit, count each component that ran (PerformedWork = 1)
  // in the first 5 s, by function name. Names survive only in the unminified build (CA09_DIST_NAMES).
  const names = new Set(target ? target.split(",") : []);
  const walk = (fiber, depth) => {
    let node = fiber;
    while (node) {
      const type = node.type;
      const name = type && (type.displayName || type.name);
      if (name && (names.size === 0 || names.has(name)) && typeof type === "function" && (node.flags & 1) === 1) {
        w.__ca09.renders[name] = (w.__ca09.renders[name] || 0) + 1;
      }
      if (node.child) walk(node.child, depth + 1);
      node = node.sibling;
    }
  };
  let id = 0;
  w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer) {
      id += 1;
      this.renderers.set(id, renderer);
      return id;
    },
    onCommitFiberRoot(_id, root) {
      if (performance.now() > 5000 && !w.__ca09.forever) return;
      w.__ca09.commits += 1;
      try {
        walk(root.current.child, 0);
      } catch {}
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    onScheduleFiberRoot() {},
    setStrictMode() {},
    checkDCE() {},
    isDisabled: false,
  };
};

export async function open(profileName, { signedIn = true, renderTargets = "" } = {}) {
  const profile = PROFILES[profileName];
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--ignore-certificate-errors"] });
  const context = await browser.newContext({ ...profile.context, ignoreHTTPSErrors: true });
  if (signedIn) {
    const value = JSON.stringify(await session());
    await context.addInitScript(([key, v]) => {
      try {
        localStorage.setItem(key, v);
        // The theme and the "seen" flags a returning visitor has; the theme boot script reads bg-theme.
        localStorage.setItem("bg-theme", "noon");
      } catch {}
    }, [STORAGE_KEY, value]);
  }
  await context.addInitScript(PROBES, renderTargets);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (profile.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });
  if (profile.network) await cdp.send("Network.emulateNetworkConditions", profile.network);
  return { browser, context, page, cdp, profile };
}

/** Every request the page makes, with CDP timings and encoded sizes. */
export function recordNetwork(cdp, t0Ref) {
  const byId = new Map();
  cdp.on("Network.requestWillBeSent", (e) => {
    if (!byId.has(e.requestId)) byId.set(e.requestId, { url: e.request.url, method: e.request.method, type: e.type, start: e.timestamp, end: null, status: null, bytes: 0, fromCache: false, initiator: e.initiator?.type });
  });
  cdp.on("Network.responseReceived", (e) => {
    const r = byId.get(e.requestId);
    if (r) {
      r.status = e.response.status;
      r.type = e.type;
      r.fromCache = e.response.fromDiskCache || e.response.fromServiceWorker;
    }
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = byId.get(e.requestId);
    if (r) {
      r.end = e.timestamp;
      r.bytes = e.encodedDataLength;
    }
  });
  cdp.on("Network.loadingFailed", (e) => {
    const r = byId.get(e.requestId);
    if (r) {
      r.end = e.timestamp;
      r.failed = e.errorText;
    }
  });
  return () => {
    const t0 = t0Ref.value;
    return [...byId.values()].map((r) => ({ ...r, startMs: Math.round((r.start - t0) * 1000), endMs: r.end ? Math.round((r.end - t0) * 1000) : null }));
  };
}

export function write(rel, content) {
  const file = path.join(OUT, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  return file;
}

/** What an API request is for, from its path: table or RPC, and the select's first columns. */
export function purpose(url) {
  const u = new URL(url);
  const p = decodeURIComponent(u.pathname + u.search);
  if (p.startsWith("/auth/v1/")) return `auth ${u.pathname.replace("/auth/v1/", "")}`;
  if (p.startsWith("/storage/v1/")) return u.pathname.includes("/sign/") && !u.search.includes("token") ? "storage sign URL" : "storage file";
  if (p.startsWith("/rest/v1/rpc/")) return `rpc ${u.pathname.replace("/rest/v1/rpc/", "")}`;
  if (p.startsWith("/rest/v1/")) {
    const table = u.pathname.replace("/rest/v1/", "");
    const select = u.searchParams.get("select") ?? "";
    const filters = [...u.searchParams.keys()].filter((k) => !["select", "order", "limit", "offset"].includes(k));
    return `${table} [${select.split(",").length} cols${select.includes("(") ? ", embeds" : ""}] ${filters.join("&")}`.trim();
  }
  if (p.startsWith("/functions/v1/")) return `function ${u.pathname.replace("/functions/v1/", "")}`;
  return p;
}
