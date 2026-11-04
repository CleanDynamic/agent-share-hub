/* UX-02: the composer on the jsdom tests' faked backend, seeded with a draft of three sessions (Session 1 with two prompts, Session 2
   with one, Session 3 empty) and one source file, brief.md. Shared by composer-ux02.spec.ts and composer-ux02-shots.spec.ts. The file
   store is not modelled by the fake, so an upload is answered here. */

import { readFileSync } from "node:fs";

import { expect, type Page } from "@playwright/test";

import { ACCESS_TOKEN, answer, MAKER_ID, REPO_SCHEMA, startAuditBackend, type Fault } from "../../../src/lib/build/__audit__/fakeSupabase";
import { ADD_CATEGORY_FALLBACK } from "../../../src/pages/site/compose/addMenuGroups";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range, content-profile" };
export const DRAFT = "0d0d0d0d-0000-4000-8000-000000000003";
const id = (n: number) => `0c2c2c2c-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const KEY = { a: "typed-ux02-a", b: "typed-ux02-b", c: "typed-ux02-c" } as const;
export const IDS = { p1: id(1), p2: id(2), p3: id(3), source: id(9) } as const;
export const SOURCE_MEDIA = "0f1f1f1f-0000-4000-8000-000000000001";

export type Row = Record<string, unknown>;

/** The node types' categories as the seed migration has them (the fake's registry files every type under "process"). */
function categorise(rows: Record<string, Row[]>) {
  for (const type of rows.node_types ?? []) {
    const category = ADD_CATEGORY_FALLBACK[String(type.key)];
    if (category) type.category = category;
  }
}

function seed(rows: Record<string, Row[]>) {
  categorise(rows);
  const build = rows.builds.find((row) => row.id === DRAFT) as Row;
  build.title = "UX-02 draft";
  build.making = {
    sessions_meta: { [KEY.a]: { tool: "claude-code", date: "2026-10-20" }, [KEY.b]: { tool: "claude-code", date: "2026-10-21" }, [KEY.c]: { tool: null, date: "2026-10-22" } },
    session_order: [KEY.a, KEY.b, KEY.c],
  };
  const node = (nodeId: string, position: number, type: string, payload: Row): Row => ({ id: nodeId, build_id: DRAFT, parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-20T10:00:00Z" });
  rows.build_nodes.push(
    node(IDS.p1, 0, "prompt", { text: "Write the poster copy", session: KEY.a }),
    node(IDS.p2, 1, "prompt", { text: "Pick the poster colours", session: KEY.a }),
    node(IDS.p3, 2, "prompt", { text: "Write the menu", session: KEY.b }),
    node(IDS.source, 3, "document", { title: "brief.md", media_id: SOURCE_MEDIA }),
  );
  rows.build_sessions.push(
    { id: id(101), build_id: DRAFT, session_key: KEY.a, import_id: null, position: 0, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
    { id: id(102), build_id: DRAFT, session_key: KEY.b, import_id: null, position: 1, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
    { id: id(103), build_id: DRAFT, session_key: KEY.c, import_id: null, position: 2, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
  );
}

function projectRef(): string {
  const env = process.env.VITE_SUPABASE_URL ?? readFileSync(".env", "utf8").match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m)?.[1];
  if (!env) throw new Error("VITE_SUPABASE_URL is not set and .env does not define it.");
  return new URL(env).hostname.split(".")[0];
}

/** The composer on the seeded draft, signed in as the fake's maker, in Dusk. */
export async function open(page: Page, width = 1440, faults: Fault[] = [], height = 900, everyType = false) {
  startAuditBackend({
    schema: REPO_SCHEMA,
    seed: (rows) => {
      seed(rows);
      // Every node type live: the Add menu with every entry (UX-02 P6's measure).
      if (everyType) for (const type of rows.node_types ?? []) type.is_active = true;
    },
    faults,
  });
  await page.setViewportSize({ width, height });
  const session = { access_token: "ux02", refresh_token: "ux02-refresh", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: MAKER_ID, aud: "authenticated", role: "authenticated", email: "maker@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-08-01T00:00:00Z" } };
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem("bg-theme", "dusk");
      } catch {
        /* the page draws without */
      }
    },
    [`sb-${projectRef()}-auth-token`, JSON.stringify(session)] as const,
  );
  await page.route(/\/(rest|auth|functions|storage)\/v1\//, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    // The file store is not modelled by the fake: an upload is taken as written.
    if (/\/storage\/v1\//.test(request.url())) return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ Key: "build-media/x", Id: "x" }) });
    const headers = { ...request.headers() };
    const bearer = headers.authorization?.replace(/^Bearer\s+/i, "");
    if (bearer && bearer !== headers.apikey) headers.authorization = `Bearer ${ACCESS_TOKEN}`;
    const response = await answer(request.url(), { method: request.method(), headers, body: request.postData() ?? undefined });
    const body = Buffer.from(await response.arrayBuffer());
    await route.fulfill({ status: response.status, headers: { ...Object.fromEntries(response.headers), ...CORS }, body });
  });
  await page.goto(`/compose/${DRAFT}`);
  await expect(page.getByRole("group", { name: /^Session 1 · / })).toBeVisible({ timeout: 30_000 });
}

