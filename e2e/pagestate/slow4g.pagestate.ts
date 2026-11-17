// D2: the five reads most likely to take longer than READ_TIMEOUT_MS on a slow phone connection, timed under Slow 4G.
//
// THE MODEL. Chrome DevTools' Slow 4G preset: 562.5 ms of latency and 180 000 bytes a second down. A response the test
// fulfils is not throttled by the browser's network emulation, so each answer is held for latency + bytes / rate before
// it is given. Server time is not in the model: this measures the transfer the client limit has to allow for.
//
// THE BODIES. Built from the columns the app itself asks for (the `select` of the request it makes), filled with values
// of a realistic size: a prompt part's text 1 500 characters, ten parts a build, a post_doc of 3 000 characters, titles
// and outcomes of a sentence. The rows are a full page: 50 for the Builds table, 24 for Library, 20 for each feed, and
// 200 for a family (rebuild_tree's cap). Every other request is answered empty after the latency alone.
//
// Run: npx playwright test -c playwright.pagestate.config.ts slow4g. The readings land in test-results/pagestate-slow4g.

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Route } from "@playwright/test";

import { installCondition, signIn } from "./network";

const LATENCY_MS = 562.5;
const BYTES_PER_SECOND = 180_000;
const OUT = path.resolve("test-results/pagestate-slow4g");

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const words = (n: number) => "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ".repeat(Math.ceil(n / 78)).slice(0, n);

/* ── a body from a PostgREST select ── */

interface Field {
  name: string;
  children: Field[] | null;
}

function parseSelect(select: string): Field[] {
  const fields: Field[] = [];
  let depth = 0;
  let start = 0;
  const push = (part: string) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const open = trimmed.indexOf("(");
    const head = open === -1 ? trimmed : trimmed.slice(0, open);
    const alias = head.includes(":") ? head.split(":")[0] : head.split("!")[0];
    fields.push({ name: alias.replace(/->>.*$/, ""), children: open === -1 ? null : parseSelect(trimmed.slice(open + 1, trimmed.lastIndexOf(")"))) });
  };
  for (let i = 0; i < select.length; i += 1) {
    if (select[i] === "(") depth += 1;
    else if (select[i] === ")") depth -= 1;
    else if (select[i] === "," && depth === 0) {
      push(select.slice(start, i));
      start = i + 1;
    }
  }
  push(select.slice(start));
  return fields;
}

const MANY = /^(build_nodes|build_media|build_reproductions|attachments|post_spaces|collection_items|first_prompt)$/;
const COUNT_OF: Record<string, number> = { build_nodes: 10, build_media: 2, build_reproductions: 3, attachments: 1, post_spaces: 1, collection_items: 1, first_prompt: 1 };

function leaf(name: string, n: number): unknown {
  if (name === "id" || name.endsWith("_id") || name === "pinned_by" || name === "hidden_by") return name === "id" ? uuid(n) : name.startsWith("hidden") || name.startsWith("pinned") || name === "parent_id" ? null : uuid(n + 1);
  if (name.endsWith("_at")) return new Date(Date.now() - n * 3_600_000).toISOString();
  if (/count|position|completeness|depth|width|height|duration|reward/.test(name)) return n % 9;
  if (name === "payload") return { text: words(1500) };
  if (name === "post_doc") return { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: words(3000) }] }] };
  if (name === "body") return words(600);
  if (name === "classification" || name === "snapshot" || name === "making") return {};
  if (/made_with|made_for|patterns|worked_models|tags/.test(name)) return ["claude", "cursor"];
  if (name === "shape") return "app";
  if (name === "status") return "published";
  if (name === "kind" || name === "type") return name === "type" ? "prompt" : "image";
  if (name === "is_gap" || name === "still_open" || name === "is_public") return false;
  if (name === "slug" || name === "username") return `item-${n}`;
  if (name === "title" || name === "display_name" || name === "name") return `A build that does a useful thing, number ${n}`;
  if (name === "outcome" || name === "rebuild_note" || name === "text" || name === "description") return words(160);
  return words(24);
}

function row(fields: Field[], n: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.children) out[field.name] = leaf(field.name, n);
    else if (MANY.test(field.name)) out[field.name] = Array.from({ length: COUNT_OF[field.name] ?? 1 }, (_, k) => row(field.children as Field[], n * 100 + k));
    else out[field.name] = row(field.children, n + 7);
  }
  return out;
}

function selectBody(url: URL, rows: number): unknown[] {
  const fields = parseSelect(url.searchParams.get("select") ?? "id");
  return Array.from({ length: rows }, (_, n) => row(fields, n + 1));
}

/* ── the flat rows of the two functions ── */

function feedRows(rows: number) {
  return Array.from({ length: rows }, (_, n) => ({
    item_kind: "published", item_at: new Date().toISOString(), build_id: uuid(n), slug: `item-${n}`, title: `A build that does a useful thing, number ${n}`,
    outcome: words(160), shape: "app", cover_media_id: uuid(n + 900), creator_id: uuid(n + 500), creator_username: `maker-${n}`, creator_display: `Maker ${n}`,
    creator_avatar: null, reproduction_count: 3, rebuild_count: 1, parent_build_id: null, source_title_at_fork: null, source_handle_at_fork: null,
    rebuild_note: null, repro_note: null, repro_model: null, repro_user_username: null, status: "published", made_for: ["teams"],
    last_confirmed_at: new Date().toISOString(), last_confirmed_model: "claude", cover_bucket: "build-media", cover_path: `covers/${n}.png`,
    cover_kind: "image", cover_poster_path: null, repro_worked: null,
  }));
}

function treeRows(rows: number) {
  return Array.from({ length: rows }, (_, n) => ({
    id: n === 0 ? uuid(1) : uuid(1000 + n), parent_build_id: n === 0 ? null : n < 10 ? uuid(1) : uuid(1000 + Math.floor(n / 10)), depth: n === 0 ? 0 : n < 10 ? 1 : 2,
    slug: `item-${n}`, title: `A rebuild that changes one thing, number ${n}`, creator_id: uuid(n + 500), published_at: new Date().toISOString(),
    reproduction_count: n % 4, rebuild_note: words(160),
  }));
}

/* ── the run ── */

interface Target {
  name: string;
  path: string;
  /** The request whose time is reported. */
  match: (url: URL, method: string) => boolean;
  body: (url: URL) => unknown;
}

const BUILD_ROW = (url: URL) => [{ ...row(parseSelect(url.searchParams.get("select") ?? "id"), 1), id: uuid(1), slug: "pagestate-slow", status: "published", parent_build_id: null }];

const TARGETS: Target[] = [
  { name: "Builds table", path: "/builds", match: (u, m) => m === "GET" && u.pathname === "/rest/v1/builds" && (u.searchParams.get("select") ?? "").startsWith("id,slug,title,shape"), body: (u) => selectBody(u, 50) },
  { name: "Home feed", path: "/", match: (u) => u.pathname === "/rest/v1/rpc/get_build_feed", body: () => feedRows(20) },
  { name: "OpenBuilds feed", path: "/openbuilds", match: (u, m) => m === "GET" && u.pathname === "/rest/v1/openbuild_posts" && u.searchParams.get("limit") === "20", body: (u) => selectBody(u, 20) },
  { name: "Lineage family", path: "/b2/pagestate-slow/lineage", match: (u) => u.pathname === "/rest/v1/rpc/rebuild_tree", body: () => treeRows(200) },
  { name: "Library saved", path: "/library", match: (u, m) => m === "GET" && u.pathname === "/rest/v1/build_saves" && u.searchParams.get("limit") === "24", body: (u) => selectBody(u, 24) },
];

const hold = (bytes: number) => new Promise((resolve) => setTimeout(resolve, LATENCY_MS + (bytes / BYTES_PER_SECOND) * 1000));
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };

for (const target of TARGETS) {
  test(`slow4g ${target.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await installCondition(page, "empty");
    // Registered after the condition, so it is asked first; anything it passes on is answered empty, after the latency.
    await page.route(/supabase\.co\//, async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const isTarget = target.match(url, request.method());
      const isBuildRow = target.name === "Lineage family" && url.pathname === "/rest/v1/builds" && url.searchParams.get("slug") === "eq.pagestate-slow";
      if (!isTarget && !isBuildRow) {
        await hold(0);
        return route.fallback();
      }
      const body = JSON.stringify(isTarget ? target.body(url) : BUILD_ROW(url));
      await hold(Buffer.byteLength(body));
      const single = (request.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      await route
        .fulfill({ status: 200, contentType: "application/json", headers: { ...CORS, "content-range": "0-0/*" }, body: single ? JSON.stringify(JSON.parse(body)[0]) : body })
        .catch(() => undefined);
    });
    await signIn(page);

    const timings: { ms: number; bytes: number; outcome: string }[] = [];
    const starts = new Map<object, number>();
    page.on("request", (r) => {
      const url = new URL(r.url());
      if (target.match(url, r.method())) starts.set(r, Date.now());
    });
    page.on("requestfinished", async (r) => {
      const at = starts.get(r);
      if (at === undefined) return;
      const response = await r.response();
      const bytes = response ? (await response.body().catch(() => Buffer.alloc(0))).length : 0;
      timings.push({ ms: Date.now() - at, bytes, outcome: "answered" });
    });
    page.on("requestfailed", (r) => {
      const at = starts.get(r);
      if (at !== undefined) timings.push({ ms: Date.now() - at, bytes: 0, outcome: `failed: ${r.failure()?.errorText ?? ""}` });
    });

    const started = Date.now();
    await page.goto(target.path, { waitUntil: "commit" });
    await expect.poll(() => timings.length, { timeout: 30_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    const timedOut = await page.evaluate(() => document.body.innerText.includes("didn't load") || document.body.innerText.includes("Couldn't load"));

    fs.mkdirSync(OUT, { recursive: true });
    const result = { read: target.name, path: target.path, firstAnsweredAfterMs: Date.now() - started, timings, pageSaysFailed: timedOut };
    fs.writeFileSync(path.join(OUT, `${target.name.toLowerCase().replace(/\s+/g, "-")}.json`), JSON.stringify(result, null, 2));
    console.log(`SLOW4G ${target.name}: ${timings.map((t) => `${(t.ms / 1000).toFixed(2)} s, ${(t.bytes / 1024).toFixed(0)} KB, ${t.outcome}`).join(" | ")}`);
    expect(timings.every((t) => t.outcome === "answered" && t.ms < 10_000)).toBe(true);
  });
}
