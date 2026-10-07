// UI-P49 — the Gallery feed's faked backend, shared by the gallery specs.
//
// listGalleryFeed reads builds (cards, ids, light rows), build_reproductions
// (the proof by model, and the worked rows for one model) and profiles (the
// handles). This answers each from one list of builds and their reproductions:
// a builds read is filtered by its `id=in.(…)` and by the interim search's
// `ilike` text, a reproductions read by its `build_id=in.(…)`. Order is the
// app's business. Nothing reaches the network; the visitor is anonymous.

import type { Page, Request, Route } from "@playwright/test";

export type Row = Record<string, unknown>;

export interface FeedBuild {
  n: number;
  title: string;
  handle?: string;
  models?: string[];
  /** model_used → worked count, each confirmed `days` ago. */
  proof?: Record<string, number>;
  days?: number;
  reproductionCount?: number;
  /** UI-P50: the dashboard's figures (session_count, prompt_count, ai_turn_count). */
  sessions?: number;
  prompts?: number;
  turns?: number;
}

const id = (n: number) => `00000000-0000-4000-8000-${String(100 + n).padStart(12, "0")}`;
const creator = (n: number) => `00000000-0000-4000-8000-${String(900 + n).padStart(12, "0")}`;
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export function feedRow(b: FeedBuild): Row {
  const worked = Object.values(b.proof ?? {}).reduce((sum, n) => sum + n, 0);
  return {
    id: id(b.n),
    creator_id: creator(b.n),
    slug: `feed-build-${b.n}`,
    title: b.title,
    outcome: `What ${b.title.toLowerCase()} does, in a sentence.`,
    shape: "app",
    status: "gallery",
    made_for: ["Photographers"],
    made_with: [],
    models_used: b.models ?? ["claude-sonnet-5-5"],
    session_count: b.sessions ?? 1,
    prompt_count: b.prompts ?? 0,
    ai_turn_count: b.turns ?? 0,
    making: { sessions: [] },
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 95,
    reproduction_count: b.reproductionCount ?? worked,
    last_confirmed_at: worked > 0 ? ago(b.days ?? 3) : null,
    last_confirmed_model: worked > 0 ? Object.keys(b.proof ?? {})[0] : null,
    published_at: ago(10 + b.n),
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    build_nodes: [],
    build_media: [],
    bounties: [],
  };
}

/** The sample the feed specs share: two reproduced on Sonnet 5.5, one only elsewhere, one never. */
export const FEED_BUILDS: FeedBuild[] = [
  { n: 1, title: "Photo renamer by date taken", handle: "maria", models: ["claude-sonnet-5-5", "claude-opus-5-5"], proof: { "claude-sonnet-5-5": 5, "claude-opus-5": 4, "gpt-6-astra": 2 } },
  { n: 2, title: "CV tailored to a job ad", handle: "dana", models: ["gpt-6-astra"], proof: { "gpt-6-astra": 15 } },
  { n: 3, title: "Inbox triage for a small shop", handle: "priya", proof: { "claude-sonnet-5-5": 9 } },
  { n: 4, title: "Receipt photos to an expenses sheet", handle: "sam" },
];

export interface FeedBackend {
  /** Every builds read the page made. */
  buildRequests: Request[];
  /** Every request the page made to an RPC, by name. */
  rpcs: string[];
  /** HEAD counts on builds: how getGalleryStats and countGalleryLenses ask. The feed makes none. */
  headCounts: number;
}

const inIds = (url: string, column: string): string[] | null => {
  const match = decodeURIComponent(url).match(new RegExp(`[?&]${column}=in\\.\\(([^)]*)\\)`));
  return match ? match[1].split(",").map((value) => value.replace(/"/g, "")) : null;
};

const searchText = (url: string): string | null => {
  const match = decodeURIComponent(url).match(/title\.ilike\.%([^%]*)%/);
  return match ? match[1].toLowerCase() : null;
};

function respond(route: Route, rows: unknown[]) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    // Exposed, as PostgREST does: the page reads the exact count off this header across origins.
    headers: {
      "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
      "access-control-expose-headers": "content-range",
    },
    body: JSON.stringify(rows),
  });
}

export async function fakeFeedBackend(page: Page, builds: FeedBuild[] = FEED_BUILDS): Promise<FeedBackend> {
  const backend: FeedBackend = { buildRequests: [], rpcs: [], headCounts: 0 };
  const rows = builds.map(feedRow);
  const reproductions = builds.flatMap((b) =>
    Object.entries(b.proof ?? {}).flatMap(([model, worked]) =>
      Array.from({ length: worked }, () => ({ build_id: id(b.n), model_used: model, worked: true, confirmed_at: ago(b.days ?? 3) })),
    ),
  );
  const handles = builds.map((b) => ({ id: creator(b.n), username: b.handle ?? null }));

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) =>
    route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }),
  );
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => respond(route, []));
  await page.route(/\/rest\/v1\/rpc\//, (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    backend.rpcs.push(name);
    if (name === "gallery_facets") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ roles: [{ value: "Photographers", count: rows.length, label: null, logo_url: null }], tools: [] }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route(/\/rest\/v1\/profiles/, (route) => respond(route, handles));
  await page.route(/\/rest\/v1\/build_reproductions/, (route) => {
    const ids = inIds(route.request().url(), "build_id");
    return respond(route, ids ? reproductions.filter((r) => ids.includes(r.build_id)) : reproductions);
  });
  await page.route(/\/rest\/v1\/builds/, (route) => {
    const url = route.request().url();
    if (route.request().method() === "HEAD") {
      backend.headCounts += 1;
      return route.fulfill({ status: 200, headers: { "content-range": `*/${rows.length}` }, body: "" });
    }
    if (!decodeURIComponent(url).includes("like_count")) backend.buildRequests.push(route.request());
    const ids = inIds(url, "id");
    const text = searchText(url);
    const matching = rows.filter(
      (row) =>
        (!ids || ids.includes(String(row.id))) &&
        (!text || `${row.title} ${row.outcome}`.toLowerCase().includes(text)),
    );
    return respond(route, matching);
  });

  return backend;
}
