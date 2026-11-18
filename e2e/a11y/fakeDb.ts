// G19: a small in-memory stand-in for the project's REST API, so the editor can make a build, its sessions and its tiles in a
// keyboard-only run. Every request to the Supabase host is answered here (auth, functions and storage by e2e/pagestate's
// "empty" answers); nothing reaches the live project. It keeps rows per table and understands what the client sends:
// eq / neq / in / is filters, insert and upsert, update, delete, a single object on request, and embedded children
// (`select=*,child(*)`), matched on `<parent>_id`. It is not PostgREST: just enough of it for the editor's writes and reads.

import { randomUUID } from "node:crypto";
import type { Page, Route } from "@playwright/test";

import { installCondition } from "../pagestate/network";

type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Map<string, Row[]>;
  writes: { method: string; table: string; body: unknown }[];
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "or", "and"]);
const SCALAR_RPCS: Record<string, unknown> = { is_admin: false, is_blocked_between: false, get_quest_state: null, collection_saved_by_count: 0 };

const singular = (table: string) => table.replace(/ies$/, "y").replace(/s$/, "");

function unquote(value: string): string {
  return value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
}

function matches(row: Row, params: URLSearchParams): boolean {
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    const at = raw.indexOf(".");
    const op = raw.slice(0, at);
    const value = raw.slice(at + 1);
    const cell = row[key];
    const text = cell === null || cell === undefined ? null : String(cell);
    if (op === "eq" && text !== unquote(value)) return false;
    if (op === "neq" && text === unquote(value)) return false;
    if (op === "is" && value === "null" && text !== null) return false;
    if (op === "is" && value === "true" && cell !== true) return false;
    if (op === "is" && value === "false" && cell !== false) return false;
    if (op === "in") {
      const list = value.replace(/^\(|\)$/g, "").split(",").map(unquote);
      if (!list.includes(text ?? "")) return false;
    }
    if (op === "not" && value.startsWith("is.null") && text === null) return false;
  }
  return true;
}

/** `*,build_nodes(*),author:profiles(*)` -> the embedded names, with their aliases. */
function embeds(select: string | null): { as: string; table: string }[] {
  if (!select) return [];
  const found: { as: string; table: string }[] = [];
  const re = /(?:([a-z_]+):)?([a-z_]+)(?:!\w+)?\(/g;
  for (let m = re.exec(select); m; m = re.exec(select)) found.push({ as: m[1] ?? m[2], table: m[2] });
  return found;
}

function withEmbeds(db: FakeDb, table: string, rows: Row[], select: string | null): Row[] {
  const list = embeds(select);
  if (!list.length) return rows;
  return rows.map((row) => {
    const out: Row = { ...row };
    for (const { as, table: child } of list) {
      if (out[as] !== undefined) continue;
      const key = `${singular(table)}_id`;
      out[as] = (db.tables.get(child) ?? []).filter((candidate) => candidate[key] === row.id);
    }
    return out;
  });
}

const json = (route: Route, status: number, body: unknown, headers: Record<string, string> = {}) =>
  route.fulfill({ status, contentType: "application/json", headers: { ...CORS, ...headers }, body: body === undefined ? "" : JSON.stringify(body) }).catch(() => undefined);

export async function installFakeDb(page: Page, seed: Record<string, Row[]> = {}): Promise<FakeDb> {
  const db: FakeDb = { tables: new Map(Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))])), writes: [] };
  // Auth, functions, storage and the realtime socket as prompt 10's "empty" answers; the REST API below, on top.
  await installCondition(page, "empty");
  // Storage: an upload is taken (answered as the storage API does) and kept by its path; nothing is stored anywhere.
  await page.route(/\/storage\/v1\/object\//, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS }).catch(() => undefined);
    const key = new URL(request.url()).pathname.replace(/^.*\/storage\/v1\/object\/(sign\/|public\/|authenticated\/)?/, "");
    if (request.method() === "POST" || request.method() === "PUT") {
      db.writes.push({ method: request.method(), table: "storage", body: key });
      return json(route, 200, { Key: key, Id: randomUUID(), path: key });
    }
    if (/\/object\/sign\//.test(request.url())) return json(route, 200, { signedURL: `/storage/v1/object/public/${key}`, signedUrl: `/storage/v1/object/public/${key}` });
    return route.fulfill({ status: 200, contentType: "image/png", headers: CORS, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") }).catch(() => undefined);
  });
  await page.route(/\/rest\/v1\//, async (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS }).catch(() => undefined);
    const url = new URL(request.url());
    const path = url.pathname.slice("/rest/v1/".length);
    const params = url.searchParams;
    const single = (request.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const prefer = request.headers()["prefer"] ?? "";
    const represent = prefer.includes("return=representation");

    if (path.startsWith("rpc/")) {
      const name = path.slice(4);
      return json(route, 200, name in SCALAR_RPCS ? SCALAR_RPCS[name] : []);
    }
    const table = path;
    const rows = db.tables.get(table) ?? [];
    db.tables.set(table, rows);
    const now = new Date().toISOString();
    const answer = (picked: Row[], status = 200) => {
      const shaped = withEmbeds(db, table, picked, params.get("select"));
      if (single) return shaped.length === 1 ? json(route, status, shaped[0]) : json(route, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
      return json(route, status, shaped, { "content-range": `0-${Math.max(0, shaped.length - 1)}/${shaped.length}` });
    };

    if (method === "GET" || method === "HEAD") {
      const picked = rows.filter((row) => matches(row, params));
      const limit = Number(params.get("limit") ?? "0");
      return answer(limit > 0 ? picked.slice(0, limit) : picked);
    }
    const body = request.postData() ? (JSON.parse(request.postData() as string) as Row | Row[]) : {};
    db.writes.push({ method, table, body });
    if (method === "POST") {
      const conflict = params.get("on_conflict")?.split(",") ?? (prefer.includes("merge-duplicates") ? ["id"] : null);
      const made: Row[] = [];
      for (const given of Array.isArray(body) ? body : [body]) {
        const existing = conflict ? rows.find((row) => conflict.every((key) => given[key] !== undefined && row[key] === given[key])) : undefined;
        if (existing) {
          Object.assign(existing, given, { updated_at: now });
          made.push(existing);
        } else {
          const row: Row = { id: randomUUID(), created_at: now, updated_at: now, ...given };
          rows.push(row);
          made.push(row);
        }
      }
      return represent || single ? answer(made, 201) : json(route, 201, undefined);
    }
    if (method === "PATCH") {
      const picked = rows.filter((row) => matches(row, params));
      for (const row of picked) Object.assign(row, body as Row, { updated_at: now });
      return represent || single ? answer(picked) : json(route, 204, undefined);
    }
    if (method === "DELETE") {
      const picked = rows.filter((row) => matches(row, params));
      db.tables.set(table, rows.filter((row) => !picked.includes(row)));
      return represent || single ? answer(picked) : json(route, 204, undefined);
    }
    return json(route, 200, []);
  });
  return db;
}
