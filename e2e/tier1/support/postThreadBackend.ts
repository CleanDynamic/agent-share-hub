// PT-09 — a stateful fake of the tables a post thread passes through, for e2e/tier1/post-thread.spec.ts.
//
// The composer writes a build, its pictures and its thread; the Gallery and the build page read them back. This
// holds one maker's builds and build_media in memory and answers each read from them, so the spec can write a thread
// in the browser, publish it and read it in the Gallery and on the build page without a project behind it. Nothing
// reaches the network. Every request is recorded, so the spec can say what a press cost.

import type { Page, Request, Route } from "@playwright/test";

import { ME } from "../../audit/support/harness";
import { fakeBoundaries, json, uuid, type Row } from "../../tier3/support/fakeBackend";

/** A 1×1 PNG: the body of every picture the fake serves, and the file the spec uploads. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const BUILD_ID = uuid(31);
const NOW = "2026-10-16T09:00:00.000Z";

export interface ThreadBackend {
  /** Every request the page made, in order. */
  requests: { method: string; url: string }[];
  build: () => Row | null;
  media: () => Row[];
  /** Requests whose URL contains this text. */
  count: (text: string, method?: string) => number;
}

const bodyOf = (request: Request): Row | null => {
  try {
    return request.postDataJSON() as Row;
  } catch {
    return null;
  }
};

const param = (url: string, column: string): string | null =>
  decodeURIComponent(url).match(new RegExp(`[?&]${column}=eq\\.([^&]+)`))?.[1] ?? null;

const list = (url: string, column: string): string[] | null => {
  const match = decodeURIComponent(url).match(new RegExp(`[?&]${column}=in\\.\\(([^)]*)\\)`));
  return match ? match[1].split(",").map((value) => value.replace(/"/g, "")) : null;
};

export async function fakeThreadBackend(page: Page): Promise<ThreadBackend> {
  let build: Row | null = null;
  const media: Row[] = [];
  const nodes: Row[] = [];
  const requests: ThreadBackend["requests"] = [];
  let nextMedia = 0;
  let nextNode = 0;

  await fakeBoundaries(page);

  page.on("request", (request) => {
    if (/\/(rest|storage)\/v1\//.test(request.url())) requests.push({ method: request.method(), url: decodeURIComponent(request.url()) });
  });

  /** The row as the Gallery and the build page read it: media embedded, the maker beside it. */
  const asRead = (): Row | null =>
    build && {
      models_used: ["claude-opus-5-5"],
      session_count: 0,
      prompt_count: 1,
      ai_turn_count: 0,
      making: { sessions: [] },
      live_url: null,
      repo_url: null,
      hero_node_id: null,
      rebuild_count: 0,
      like_count: 0,
      comment_count: 0,
      rebuild_note: null,
      source_title_at_fork: null,
      source_handle_at_fork: null,
      post_doc: null,
      ...build,
      build_nodes: nodes.map((node) => ({ id: node.id, type: node.type, title: node.title, payload: node.payload, position: node.position, parent_id: null })),
      build_media: media.filter((row) => row.build_id === build?.id),
      bounties: [],
      maker: { username: ME.username, display_name: ME.display_name, avatar_url: null },
    };

  // Pictures and the files behind them.
  await page.route(/\/storage\/v1\//, (route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() === "POST" && url.includes("/object/sign/")) {
      const path = url.split("/object/sign/")[1];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedURL: `/object/sign/${path}?token=t` }) });
    }
    if (request.method() === "GET" || request.method() === "HEAD") return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "build-media/x" }) });
  });

  await page.route(/\/rest\/v1\/builds/, (route: Route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": `*/${build ? 1 : 0}` }, body: "" });
    if (request.method() === "POST") {
      build = {
        id: BUILD_ID,
        creator_id: ME.id,
        slug: "weekend-bakery-site-k3f9x1",
        outcome: null,
        shape: "other",
        status: "draft",
        made_for: [],
        made_with: ["Claude Code"],
        completeness: 0,
        reproduction_count: 0,
        cover_media_id: null,
        parent_build_id: null,
        root_build_id: null,
        created_at: NOW,
        updated_at: NOW,
        published_at: null,
        ...(bodyOf(request) ?? {}),
      };
      return json(route, [build], 201);
    }
    if (request.method() === "PATCH") {
      build = { ...(build ?? {}), ...(bodyOf(request) ?? {}) };
      return json(route, [asRead()]);
    }
    if (!build) return json(route, []);
    const id = param(url, "id");
    const slug = param(url, "slug");
    const ids = list(url, "id");
    // The gallery lists published builds only; an id or a slug finds the build in whatever state it is.
    if (id || slug || ids) {
      const found = id === build.id || slug === build.slug || ids?.includes(String(build.id));
      return json(route, found ? [asRead()] : []);
    }
    return json(route, build.status === "draft" ? [] : [asRead()]);
  });

  await page.route(/\/rest\/v1\/build_media/, (route) => {
    const request = route.request();
    const url = decodeURIComponent(request.url());
    if (request.method() === "POST") {
      const incoming = bodyOf(request) ?? {};
      const row = {
        id: uuid(500 + nextMedia++),
        node_id: null,
        bucket: "build-media",
        poster_path: null,
        post_position: null,
        post_text: null,
        width: 1,
        height: 1,
        created_at: NOW,
        ...incoming,
      };
      media.push(row);
      return json(route, [row], 201);
    }
    if (request.method() !== "GET") return json(route, []);
    const ids = list(url, "id");
    let rows = ids ? media.filter((row) => ids.includes(String(row.id))) : media;
    if (url.includes("post_position=not.is.null")) {
      rows = rows.filter((row) => row.post_position !== null).sort((a, b) => Number(a.post_position) - Number(b.post_position));
    }
    return json(route, rows);
  });

  // set_build_post_media: positions follow the array; the cover mirror follows the first picture.
  await page.route(/\/rest\/v1\/rpc\/set_build_post_media/, (route) => {
    const ids = ((bodyOf(route.request()) ?? {}).p_media_ids ?? []) as string[];
    for (const row of media) row.post_position = ids.includes(String(row.id)) ? ids.indexOf(String(row.id)) : null;
    if (build) build.cover_media_id = ids[0] ?? null;
    return json(
      route,
      media.filter((row) => row.post_position !== null).sort((a, b) => Number(a.post_position) - Number(b.post_position)),
    );
  });

  await page.route(/\/rest\/v1\/node_types/, (route) =>
    json(route, [
      { key: "screenshot", label: "Screenshot", category: "evidence", description: "", icon: null, schema: { fields: [] }, sort: 1, is_active: true },
      { key: "recording", label: "Recording", category: "evidence", description: "", icon: null, schema: { fields: [] }, sort: 2, is_active: true },
      { key: "prompt", label: "Prompt", category: "instruction", description: "", icon: null, schema: { fields: [] }, sort: 3, is_active: true },
    ]),
  );
  await page.route(/\/rest\/v1\/build_nodes/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Row | Row[];
      const rows = (Array.isArray(body) ? body : [body]).map((incoming) => {
        const at = incoming.id ? nodes.findIndex((row) => row.id === incoming.id) : -1;
        if (at !== -1) return Object.assign(nodes[at], incoming);
        const row = { id: uuid(900 + nextNode++), build_id: BUILD_ID, parent_id: null, title: null, note: null, source_ref: null, event_id: null, is_gap: false, created_at: NOW, ...incoming };
        nodes.push(row);
        return row;
      });
      return json(route, rows, 201);
    }
    if (request.method() !== "GET") return json(route, []);
    const url = decodeURIComponent(request.url());
    if (url.includes("position=is.null")) return json(route, []);
    return json(route, [...nodes].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)));
  });

  await page.route(/\/rest\/v1\/profiles/, (route) =>
    json(route, [{ id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: false }]),
  );
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ roles: [], tools: [] }) }),
  );

  return {
    requests,
    build: () => build,
    media: () => media,
    count: (text, method) => requests.filter((entry) => entry.url.includes(text) && (!method || entry.method === method)).length,
  };
}
