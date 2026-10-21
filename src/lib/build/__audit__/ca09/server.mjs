/* CA-09 audit — a fake Supabase (PostgREST, GoTrue, Storage, Realtime, Functions) served on localhost.

   WHY A SERVER, NOT page.route. Lighthouse and Chromium's network throttling only see real sockets, and the
   audit has to measure the built site the way a phone loads it. So the built bundle (pointed at this server
   through VITE_SUPABASE_URL, see README.md) talks to this process over HTTP and WebSocket.

   WHAT IT IS BUILT FROM.
   - The schema is read from src/integrations/supabase/types.ts (schema.mjs), which Lovable regenerated from the
     live database tonight. A selected, filtered or written column that types.ts does not list answers as
     PostgREST does: 400 42703 (read) or 400 PGRST204 (write).
   - Status codes and bodies follow CA-08's fake (src/lib/build/__audit__/fakeSupabase.ts, copied from PR #361).
     That fake runs inside vitest behind supabase-js; this one answers every table and the embeds the whole site
     uses, because Part 2 opens every route.
   - RLS is the migrations' policies for the build tables and import_sessions (as CA-08 wrote them out); other
     tables are readable by anyone and writable by the signed-in maker.
   - The data is seed.mjs: Miles's shape (16 drafts, one of 7 steps, 20 import sessions with 1 to 5 MB proposals,
     a 40-picture 10-post thread), made up.

   WHAT IT ADDS FOR THE AUDIT (all set at runtime through POST /__audit/config, so one server serves every run):
   - latency: ms added to every request, OPTIONS included (120 normal, 400 slow).
   - proposalCostMsPerMb: extra ms per MB of `proposal` in the rows a read of import_sessions returns. Postgres 16
     spends about 1 ms per MB, hot cache (docs/audits/ca-09/scripts/proposal-cost.mjs).
   - statementTimeoutMs, timeoutWhenProposalOverMb: Part 4's statement timeout. A read whose modelled time exceeds
     statementTimeoutMs, or (with timeoutWhenProposalOverMb) that returns a row whose proposal is larger than that,
     waits statementTimeoutMs and answers 500 57014 "canceling statement due to statement timeout".
   - faults: [{ method?, path (regex source), status, body, delayMs?, times? }] answered before anything else.
   - delays: [{ method?, path (regex source), delayMs }]: the right answer, that much later (one read slow alone).

   No key, token, address or account in here is real. Test only. */

import http from "node:http";
import http2 from "node:http2";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { WebSocketServer } from "ws";

import { readSchema } from "./schema.mjs";
import { seed, MAKER_ID, ACCESS_TOKEN } from "./seed.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.CA09_PORT ?? 54321);
const SCHEMA = readSchema();

const DEFAULT_CONFIG = { latency: 120, proposalCostMsPerMb: 0, statementTimeoutMs: 0, timeoutWhenProposalOverMb: 0, faults: [], delays: [], signedIn: true };
let config = { ...DEFAULT_CONFIG };
let rows = seed();
let log = [];
const started = Date.now();

const IMAGE = (() => {
  const file = process.env.CA09_IMAGE ?? path.join(here, "picture.jpg");
  return existsSync(file) ? readFileSync(file) : Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
})();
const IMAGE_TYPE = IMAGE[0] === 0xff ? "image/jpeg" : "image/png";

/* ── PostgREST ─────────────────────────────────────────────────────────────── */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "content-range, x-total-count, content-profile",
  // Assumed. Supabase's gateway sends a max-age; if the live value is lower, every call also pays a preflight.
  "access-control-max-age": "3600",
};

const pgError = (status, code, message, details = null, hint = null) => ({ status, body: { code, details, hint, message } });

function splitTop(text, sep = ",") {
  const out = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "(") depth++;
    if (!quoted && ch === ")") depth--;
    if (!quoted && depth === 0 && ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.length) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** select=… into picks: columns (with JSON paths and aliases) and embeds. */
function parseSelect(select) {
  return splitTop(select).map((raw) => {
    let item = raw;
    let spread = false;
    if (item.startsWith("...")) {
      spread = true;
      item = item.slice(3);
    }
    const paren = item.indexOf("(");
    if (paren >= 0 && item.endsWith(")")) {
      const head = item.slice(0, paren);
      const inner = item.slice(paren + 1, -1);
      let alias = null;
      let target = head;
      const colon = head.indexOf(":");
      if (colon >= 0) {
        alias = head.slice(0, colon);
        target = head.slice(colon + 1);
      }
      const [name, ...hints] = target.split("!");
      const inner_ = hints.includes("inner");
      const hint = hints.find((h) => h !== "inner" && h !== "left") ?? null;
      if (name === "count" && inner === "") return { kind: "count", alias: alias ?? "count" };
      return { kind: "embed", alias: alias ?? name, name, hint, inner: inner_, spread, select: inner };
    }
    let alias = null;
    let expr = item;
    const colon = item.indexOf(":");
    if (colon >= 0 && item[colon + 1] !== ":") {
      alias = item.slice(0, colon);
      expr = item.slice(colon + 1);
    }
    expr = expr.replace(/::[a-z0-9_]+$/i, "");
    if (expr === "count()" || expr === "count") return { kind: expr === "count" ? "column" : "count", alias: alias ?? "count", column: "count", path: [], text: false };
    const parts = expr.split(/(->>|->)/);
    const column = parts[0];
    const p = [];
    let text = false;
    for (let at = 1; at < parts.length; at += 2) {
      p.push(parts[at + 1].replace(/^'|'$/g, ""));
      text = parts[at] === "->>";
    }
    return { kind: "column", alias: alias ?? (p.length ? p[p.length - 1] : column), column, path: p, text };
  });
}

function follow(value, p, text) {
  let cur = value;
  for (const step of p) {
    if (cur === null || cur === undefined) return null;
    if (Array.isArray(cur)) cur = cur[Number(step)];
    else if (typeof cur === "object") cur = cur[step];
    else return null;
  }
  if (cur === undefined) return null;
  return text && cur !== null && typeof cur !== "string" ? JSON.stringify(cur) : cur;
}

function listOf(value) {
  const inner = value.replace(/^\(/, "").replace(/\)$/, "").replace(/^\{/, "").replace(/\}$/, "");
  return splitTop(inner).map((v) => v.replace(/^"|"$/g, ""));
}

function cellOf(row, column) {
  const parts = column.split(/(->>|->)/);
  if (parts.length === 1) return row[column];
  const p = [];
  let text = false;
  for (let at = 1; at < parts.length; at += 2) {
    p.push(parts[at + 1]);
    text = parts[at] === "->>";
  }
  return follow(row[parts[0]], p, text);
}

const likeToRegex = (pattern, flags) => new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/[*%]/g, ".*") + "$", flags);

function compare(cell, op, value) {
  if (op === "is") {
    if (value === "null") return cell === null || cell === undefined;
    if (value === "true") return cell === true;
    if (value === "false") return cell === false;
    return false;
  }
  if (cell === null || cell === undefined) return false;
  switch (op) {
    case "eq":
      return String(cell) === value;
    case "neq":
      return String(cell) !== value;
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = typeof cell === "number" ? cell : String(cell);
      const b = typeof cell === "number" ? Number(value) : value;
      return op === "gt" ? a > b : op === "gte" ? a >= b : op === "lt" ? a < b : a <= b;
    }
    case "like":
      return likeToRegex(value, "").test(String(cell));
    case "ilike":
      return likeToRegex(value, "i").test(String(cell));
    case "in":
      return listOf(value).includes(String(cell));
    case "cs": {
      if (Array.isArray(cell)) return listOf(value).every((v) => cell.map(String).includes(v));
      try {
        const want = JSON.parse(value);
        return Object.entries(want).every(([k, v]) => JSON.stringify(cell[k]) === JSON.stringify(v));
      } catch {
        return false;
      }
    }
    case "cd":
      return Array.isArray(cell) && cell.every((v) => listOf(value).includes(String(v)));
    case "ov":
      return Array.isArray(cell) && listOf(value).some((v) => cell.map(String).includes(v));
    case "fts":
    case "plfts":
    case "phfts":
    case "wfts":
      return String(cell).toLowerCase().includes(value.replace(/^\([^)]*\)\./, "").toLowerCase());
    default:
      return true;
  }
}

/** One filter expression `col=op.value` or a logic tree `or=(…)`. */
function makeFilter(key, raw) {
  if (key === "or" || key === "and" || key === "not.or" || key === "not.and") {
    const negate = key.startsWith("not.");
    const kind = key.replace("not.", "");
    const parts = splitTop(raw.replace(/^\(/, "").replace(/\)$/, "")).map((part) => {
      const logic = part.match(/^(not\.)?(or|and)\((.*)\)$/);
      if (logic) return makeFilter(`${logic[1] ?? ""}${logic[2]}`, `(${logic[3]})`);
      const dot = part.indexOf(".");
      return makeFilter(part.slice(0, dot), part.slice(dot + 1));
    });
    return { columns: parts.flatMap((p) => p.columns), test: (row) => {
      const result = kind === "or" ? parts.some((p) => p.test(row)) : parts.every((p) => p.test(row));
      return negate ? !result : result;
    } };
  }
  let rest = raw;
  let negate = false;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  let op = rest.slice(0, dot);
  let value = rest.slice(dot + 1);
  const anyAll = op.match(/^(.*)\((any|all)\)$/);
  if (anyAll) op = anyAll[1];
  const base = key.split(/->>|->/)[0];
  return { columns: [base], test: (row) => {
    const result = compare(cellOf(row, key), op, value);
    return negate ? !result : result;
  } };
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function orderRows(list, spec) {
  if (!spec) return list;
  const keys = splitTop(spec).map((part) => {
    const [column, ...mods] = part.split(".");
    return { column, descending: mods.includes("desc"), nullsFirst: mods.includes("nullsfirst") };
  });
  return [...list].sort((a, b) => {
    for (const { column, descending, nullsFirst } of keys) {
      const x = cellOf(a, column);
      const y = cellOf(b, column);
      if (x === y) continue;
      if (x === null || x === undefined) return nullsFirst ? -1 : 1;
      if (y === null || y === undefined) return nullsFirst ? 1 : -1;
      return (x < y ? -1 : 1) * (descending ? -1 : 1);
    }
    return 0;
  });
}

function uidOf(headers) {
  return config.signedIn && headers.authorization === `Bearer ${ACCESS_TOKEN}` ? MAKER_ID : null;
}

const buildOf = (id) => (rows.builds ?? []).find((b) => b.id === id);

function readable(table, row, uid) {
  switch (table) {
    case "builds":
      return row.status !== "draft" || (uid !== null && row.creator_id === uid);
    case "build_nodes":
    case "build_media":
    case "build_events": {
      const b = buildOf(row.build_id);
      return Boolean(b && readable("builds", b, uid));
    }
    case "import_sessions":
      return uid !== null && row.user_id === uid;
    default:
      return true;
  }
}

function writable(table, row, uid) {
  if (uid === null) return false;
  switch (table) {
    case "builds":
      return row.creator_id === uid;
    case "build_nodes":
    case "build_media":
    case "build_events": {
      const b = buildOf(row.build_id);
      return Boolean(b && b.creator_id === uid);
    }
    case "import_sessions":
      return row.user_id === uid;
    case "profiles":
      return row.id === uid;
    default:
      return true;
  }
}

function relationFor(parent, embed) {
  const p = SCHEMA.tables[parent];
  const c = SCHEMA.tables[embed.name];
  const hintOk = (rel) => !embed.hint || rel.name === embed.hint || rel.columns.includes(embed.hint);
  // The embed names a column of the parent: follow its FK.
  if (!c && p) {
    const rel = p.relationships.find((r) => r.columns.includes(embed.name));
    if (rel) return { kind: "one", table: rel.to, from: rel.columns[0], to: rel.toColumns[0] };
    return null;
  }
  if (!p || !c) return null;
  // As PostgREST: every FK either way is a candidate; a hint narrows them; more than one left is PGRST201.
  const ones = p.relationships.filter((r) => r.to === embed.name && hintOk(r)).map((r) => ({ kind: "one", table: embed.name, from: r.columns[0], to: r.toColumns[0], fk: r.name }));
  const manys = c.relationships.filter((r) => r.to === parent && hintOk(r)).map((r) => ({ kind: r.oneToOne ? "one" : "many", table: embed.name, from: r.toColumns[0], to: r.columns[0], fk: r.name }));
  const seen = new Map();
  for (const cand of [...ones, ...manys]) seen.set(`${cand.fk}:${cand.from}:${cand.to}`, cand);
  const all = [...seen.values()];
  if (all.length > 1) return { ambiguous: all.map((cand) => cand.fk) };
  if (all.length === 1) return all[0];
  return null;
}

function project(table, list, picks, uid, embedFilters) {
  return list.map((row) => {
    if (!picks) return { ...row };
    const out = {};
    for (const pick of picks) {
      if (pick.kind === "column") {
        if (pick.column === "*") Object.assign(out, row);
        else out[pick.alias] = pick.path.length ? follow(row[pick.column], pick.path, pick.text) : (row[pick.column] ?? null);
      } else if (pick.kind === "count") {
        out[pick.alias] = 1;
      } else if (pick.kind === "embed") {
        const rel = relationFor(table, pick);
        const childPicks = parseSelect(pick.select || "*");
        if (!rel || rel.ambiguous) {
          out[pick.alias] = null;
          continue;
        }
        const childRows = (rows[rel.table] ?? []).filter((child) => readable(rel.table, child, uid) && child[rel.to] === row[rel.from] && row[rel.from] !== null && row[rel.from] !== undefined);
        const filters = embedFilters.filter((f) => f.alias === pick.alias).map((f) => f.filter);
        const kept = childRows.filter((child) => filters.every((f) => f.test(child)));
        const onlyCount = childPicks.length === 1 && (childPicks[0].kind === "count" || (childPicks[0].kind === "column" && childPicks[0].column === "count"));
        let value;
        if (onlyCount) value = rel.kind === "many" ? [{ count: kept.length }] : { count: kept.length };
        else {
          const projected = project(rel.table, kept, childPicks, uid, []);
          value = rel.kind === "one" ? (projected[0] ?? null) : projected;
        }
        if (pick.spread && value && typeof value === "object" && !Array.isArray(value)) Object.assign(out, value);
        else out[pick.alias] = value;
        out[`__inner_${pick.alias}`] = pick.inner ? (Array.isArray(value) ? value.length > 0 : value !== null) : true;
      }
    }
    return out;
  });
}

function stripInner(list) {
  return list
    .filter((row) => Object.keys(row).every((k) => !k.startsWith("__inner_") || row[k]))
    .map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("__inner_"))));
}

function respondRows(status, list, headers, total) {
  const extra = total === undefined ? {} : { "content-range": list.length ? `0-${list.length - 1}/${total}` : `*/${total}` };
  if ((headers.accept ?? "").includes("vnd.pgrst.object+json")) {
    if (list.length !== 1) return pgError(406, "PGRST116", "Cannot coerce the result to a single JSON object", `The result contains ${list.length} rows`);
    return { status, body: list[0], headers: extra };
  }
  return { status, body: list, headers: extra };
}

function columnCheck(table, picks) {
  const columns = SCHEMA.tables[table].columns;
  for (const pick of picks ?? []) {
    if (pick.kind === "column" && pick.column !== "*" && pick.column !== "count" && !columns.includes(pick.column)) return pgError(400, "42703", `column ${table}.${pick.column} does not exist`);
    if (pick.kind === "embed") {
      const rel = relationFor(table, pick);
      if (!rel) return pgError(400, "PGRST200", `Could not find a relationship between '${table}' and '${pick.name}' in the schema cache`);
      if (rel.ambiguous) return pgError(300, "PGRST201", `Could not embed because more than one relationship was found for '${table}' and '${pick.name}'`, rel.ambiguous.join(", "), `Try changing '${pick.name}' to one of the following: ${rel.ambiguous.map((fk) => `'${pick.name}!${fk}'`).join(", ")}.`);
      const inner = columnCheck(rel.table, parseSelect(pick.select || "*"));
      if (inner) return inner;
    }
  }
  return null;
}

function defaultsFor(table) {
  const out = {};
  for (const column of SCHEMA.tables[table].columns) out[column] = null;
  out.id = randomUUID();
  if ("created_at" in out) out.created_at = new Date().toISOString();
  if ("updated_at" in out) out.updated_at = new Date().toISOString();
  if (table === "builds") Object.assign(out, { made_for: [], made_with: [], models_used: [], making: {}, completeness: 0, reproduction_count: 0, rebuild_count: 0, session_count: 0, prompt_count: 0, ai_turn_count: 0, donation_enabled: false, status: "draft", shape: "other" });
  return out;
}

const SIZES = new WeakMap();
function proposalBytes(value) {
  if (!value || typeof value !== "object") return 0;
  if (!SIZES.has(value)) SIZES.set(value, JSON.stringify(value).length);
  return SIZES.get(value);
}

/**
 * How long Postgres would spend on this read of import_sessions, beyond the base latency. Measured on Postgres 16
 * (docs/audits/ca-09/scripts/proposal-cost.mjs): about 1 ms per MB of `proposal` the returned rows hold, hot cache,
 * whether the select names one JSON path or three. `proposalCostMsPerMb` scales it (5 for a shared-CPU instance).
 */
function proposalCost(table, picks, list) {
  if (table !== "import_sessions" || !picks) return { ms: 0, mb: 0, maxMb: 0 };
  const touches = picks.some((p) => p.kind === "column" && (p.column === "proposal" || p.column === "*"));
  if (!touches) return { ms: 0, mb: 0, maxMb: 0 };
  const sizes = list.map((row) => proposalBytes(row.proposal) / 1e6);
  const mb = sizes.reduce((a, b) => a + b, 0);
  return { ms: mb * (config.proposalCostMsPerMb ?? 0), mb, maxMb: Math.max(0, ...sizes) };
}

function table(method, name, params, headers, body) {
  const meta = SCHEMA.tables[name];
  if (!meta) return { result: pgError(404, "PGRST205", `Could not find the table 'public.${name}' in the schema cache`) };
  const uid = uidOf(headers);
  if (uid === null && name === "import_sessions") return { result: pgError(401, "42501", "permission denied for table import_sessions") };
  if (uid === null && !["GET", "HEAD"].includes(method)) return { result: pgError(401, "42501", `permission denied for table ${name}`) };

  const payload = Array.isArray(body) ? body : body === undefined || body === null ? [] : [body];
  for (const entry of payload) for (const key of Object.keys(entry)) if (!meta.columns.includes(key)) return { result: pgError(400, "PGRST204", `Could not find the '${key}' column of '${name}' in the schema cache`) };

  const select = params.get("select");
  const picks = select === null ? null : parseSelect(select);
  const bad = columnCheck(name, picks);
  if (bad) return { result: bad };

  const filters = [];
  const embedFilters = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key) || /\.(order|limit|offset)$/.test(key)) continue;
    const dotted = key.match(/^([a-z0-9_]+)\.(.+)$/i);
    if (dotted && !["or", "and", "not"].includes(dotted[1]) && picks?.some((p) => p.kind === "embed" && p.alias === dotted[1])) {
      embedFilters.push({ alias: dotted[1], filter: makeFilter(dotted[2], raw) });
      continue;
    }
    const filter = makeFilter(key, raw);
    for (const c of filter.columns) if (!meta.columns.includes(c)) return { result: pgError(400, "42703", `column ${name}.${c} does not exist`) };
    filters.push(filter);
  }
  const prefer = headers.prefer ?? "";
  const representation = prefer.includes("return=representation");
  const list = rows[name] ?? (rows[name] = []);

  if (method === "GET" || method === "HEAD") {
    const visible = orderRows(list.filter((row) => readable(name, row, uid) && filters.every((f) => f.test(row))), params.get("order"));
    const offset = Number(params.get("offset") ?? 0);
    const limit = params.has("limit") ? Number(params.get("limit")) : visible.length;
    const projectedAll = stripInner(project(name, visible, picks, uid, embedFilters));
    const page = projectedAll.slice(offset, offset + limit);
    const cost = proposalCost(name, picks, visible.slice(offset, offset + limit));
    const total = /count=(exact|planned|estimated)/.test(prefer) ? projectedAll.length : undefined;
    if (method === "HEAD") return { result: { status: 200, body: undefined, headers: total === undefined ? {} : { "content-range": `*/${total}` } }, cost };
    return { result: respondRows(200, page, headers, total), cost };
  }

  if (method === "POST") {
    const merge = prefer.includes("resolution=merge-duplicates");
    const conflict = (params.get("on_conflict") ?? "id").split(",");
    const written = [];
    for (const entry of payload) {
      const existing = merge ? list.find((row) => conflict.every((c) => row[c] === entry[c])) : undefined;
      const next = existing ? { ...existing, ...entry } : { ...defaultsFor(name), ...entry };
      if (!writable(name, next, uid)) return { result: pgError(403, "42501", `new row violates row-level security policy for table "${name}"`) };
      written.push(next);
    }
    for (const next of written) {
      const at = list.findIndex((row) => row.id === next.id);
      if (at >= 0) list[at] = next;
      else list.push(next);
    }
    return { result: representation ? respondRows(201, stripInner(project(name, written, picks, uid, [])), headers) : { status: 201, body: undefined } };
  }

  if (method === "PATCH") {
    const targets = list.filter((row) => readable(name, row, uid) && writable(name, row, uid) && filters.every((f) => f.test(row)));
    const patch = payload[0] ?? {};
    const written = targets.map((row) => ({ ...row, ...patch, ...("updated_at" in row && !("updated_at" in patch) ? { updated_at: new Date().toISOString() } : null) }));
    for (const next of written) list[list.findIndex((row) => row.id === next.id)] = next;
    return { result: representation ? respondRows(200, stripInner(project(name, written, picks, uid, [])), headers) : { status: 204, body: undefined } };
  }

  if (method === "DELETE") {
    const gone = list.filter((row) => writable(name, row, uid) && filters.every((f) => f.test(row)));
    rows[name] = list.filter((row) => !gone.includes(row));
    return { result: representation ? respondRows(200, stripInner(project(name, gone, picks, uid, [])), headers) : { status: 204, body: undefined } };
  }
  return { result: pgError(405, "PGRST117", `Unsupported HTTP method: ${method}`) };
}

function rpc(name, params, headers, body) {
  const fn = SCHEMA.functions[name];
  const args = body ?? Object.fromEntries(params);
  if (!fn) {
    const list = Object.keys(args).join(", ");
    return pgError(404, "PGRST202", `Could not find the function public.${name}(${list}) in the schema cache`, `Searched for the function public.${name} with parameters ${list} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`);
  }
  const uid = uidOf(headers);
  if (name === "gallery_facets") return { status: 200, body: { roles: ["designers", "teachers", "families"], tools: [] } };
  if (name === "set_build_post_media") {
    const ids = args.p_media_ids ?? [];
    if (ids.length > 40) return pgError(400, "23514", `post_media_too_many: a thread shows at most 40 pictures, got ${ids.length}`);
    const media = rows.build_media;
    for (const row of media) if (row.build_id === args.p_build_id && writable("build_media", row, uid)) row.post_position = null;
    ids.forEach((id, slot) => {
      const row = media.find((m) => m.id === id && m.build_id === args.p_build_id);
      if (row) row.post_position = slot;
    });
    const set = orderRows(media.filter((m) => m.build_id === args.p_build_id && m.post_position !== null), "post_position.asc");
    const sel = params.get("select");
    return { status: 200, body: project("build_media", set, sel ? parseSelect(sel) : null, uid, []) };
  }
  if (name === "get_build_feed") {
    const list = orderRows((rows.builds ?? []).filter((b) => b.status !== "draft"), "published_at.desc").slice(0, Number(args.page_size ?? 20));
    return { status: 200, body: list.map((b) => ({ ...b, build_id: b.id })) };
  }
  const returns = fn.returns;
  if (returns === "rows" || /\[\]$/.test(returns)) return { status: 200, body: [] };
  if (returns === "boolean") return { status: 200, body: false };
  if (returns === "number") return { status: 200, body: 0 };
  if (returns === "undefined" || returns === "unknown") return { status: 204, body: undefined };
  return { status: 200, body: null };
}

/* ── GoTrue, Storage, Functions ───────────────────────────────────────────── */

function authAnswer(url, headers) {
  const p = url.pathname;
  const user = { id: MAKER_ID, aud: "authenticated", role: "authenticated", email: "maker@example.test", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-08-01T00:00:00Z" };
  if (p === "/auth/v1/user") return uidOf(headers) ? { status: 200, body: user } : { status: 401, body: { code: 401, error_code: "no_authorization", msg: "This endpoint requires a valid Bearer token" } };
  if (p === "/auth/v1/token") return { status: 200, body: { access_token: ACCESS_TOKEN, token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, refresh_token: "ca09-refresh", user } };
  if (p === "/auth/v1/logout") return { status: 204, body: undefined };
  if (p === "/auth/v1/settings") return { status: 200, body: { external: { email: true }, disable_signup: false } };
  return { status: 400, body: { code: 400, error_code: "validation_failed", msg: "not modelled by the CA-09 stand-in" } };
}

function storageAnswer(method, url, body) {
  const p = url.pathname.replace("/storage/v1", "");
  if (method === "POST" && /^\/object\/sign\//.test(p)) {
    const rest = p.replace(/^\/object\/sign\//, "");
    if (Array.isArray(body?.paths)) {
      return { status: 200, body: body.paths.map((one) => ({ path: one, signedURL: `/object/sign/${rest}/${one}?token=ca09`, error: null })) };
    }
    const kind = body?.transform ? "render/image/sign" : "object/sign";
    return { status: 200, body: { signedURL: `/${kind}/${rest}?token=ca09` } };
  }
  if (method === "GET" && /^\/(object|render\/image)\/(sign|public|authenticated)\//.test(p)) return { status: 200, raw: IMAGE, type: IMAGE_TYPE };
  if (method === "POST" && /^\/object\/list\//.test(p)) return { status: 200, body: [] };
  if ((method === "POST" || method === "PUT") && /^\/object\//.test(p)) return { status: 200, body: { Key: p.replace(/^\/object\//, ""), Id: randomUUID() } };
  if (method === "DELETE") return { status: 200, body: [] };
  return { status: 200, body: {} };
}

/* ── the HTTP server ──────────────────────────────────────────────────────── */

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function send(res, answer, extraHeaders = {}, acceptGzip = false) {
  const headers = { ...CORS, ...extraHeaders, ...(answer.headers ?? {}) };
  if (answer.raw) {
    res.writeHead(answer.status, { ...headers, "content-type": answer.type, "content-length": answer.raw.length, "cache-control": "max-age=3600" });
    return res.end(answer.raw);
  }
  if (answer.body === undefined) {
    res.writeHead(answer.status, headers);
    return res.end();
  }
  const text = JSON.stringify(answer.body);
  // Supabase's gateway compresses JSON; so does the stand-in, above 1 kB.
  if (acceptGzip && text.length > 1024) {
    const packed = gzipSync(text);
    res.writeHead(answer.status, { ...headers, "content-type": "application/json; charset=utf-8", "content-encoding": "gzip", "content-length": packed.length });
    return res.end(packed);
  }
  res.writeHead(answer.status, { ...headers, "content-type": "application/json; charset=utf-8" });
  return res.end(text);
}

// HTTP/2 over TLS when CA09_TLS_DIR holds key.pem and cert.pem (as Supabase serves it); HTTP/1.1 otherwise.
const TLS = process.env.CA09_TLS_DIR;
async function handle(req, res) {
  const at = Date.now();
  const url = new URL(req.url, `http://${req.headers[":authority"] ?? req.headers.host}`);
  const method = req.method.toUpperCase();
  const raw = await readBody(req);

  if (url.pathname.startsWith("/__audit/")) {
    if (url.pathname === "/__audit/config" && method === "POST") {
      const next = raw.length ? JSON.parse(raw.toString()) : {};
      config = { ...DEFAULT_CONFIG, ...next };
      return send(res, { status: 200, body: config });
    }
    if (url.pathname === "/__audit/config") return send(res, { status: 200, body: config });
    if (url.pathname === "/__audit/reset") {
      rows = seed();
      log = [];
      return send(res, { status: 200, body: { ok: true } });
    }
    if (url.pathname === "/__audit/log") {
      const since = Number(url.searchParams.get("since") ?? 0);
      return send(res, { status: 200, body: log.filter((entry) => entry.at >= since) });
    }
    if (url.pathname === "/__audit/clear-log") {
      log = [];
      return send(res, { status: 200, body: { ok: true } });
    }
    if (url.pathname === "/__audit/rows") return send(res, { status: 200, body: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])) });
    return send(res, { status: 404, body: {} });
  }

  if (method === "OPTIONS") {
    await sleep(config.latency);
    log.push({ at: at - started, method, path: url.pathname, status: 204, ms: Date.now() - at, preflight: true });
    return send(res, { status: 204, body: undefined });
  }

  let body;
  try {
    body = raw.length && (req.headers["content-type"] ?? "").includes("json") ? JSON.parse(raw.toString()) : undefined;
  } catch {
    body = undefined;
  }
  const shown = `${url.pathname}${url.search ? `?${decodeURIComponent(url.searchParams.toString())}` : ""}`;
  let answer;
  let cost = { ms: 0, mb: 0 };

  const fault = config.faults.find((f) => (!f.method || f.method === method) && new RegExp(f.path).test(shown) && (f.times === undefined || f.times > 0));
  if (fault) {
    if (fault.times !== undefined) fault.times -= 1;
    await sleep(config.latency + (fault.delayMs ?? 0));
    answer = { status: fault.status, body: fault.body };
  } else {
    try {
      if (url.pathname.startsWith("/auth/v1/")) answer = authAnswer(url, req.headers);
      else if (url.pathname.startsWith("/rest/v1/rpc/")) answer = rpc(url.pathname.slice("/rest/v1/rpc/".length), url.searchParams, req.headers, body);
      else if (url.pathname.startsWith("/rest/v1/")) {
        const out = table(method, url.pathname.slice("/rest/v1/".length), url.searchParams, req.headers, body);
        answer = out.result;
        cost = out.cost ?? cost;
      } else if (url.pathname.startsWith("/storage/v1/")) answer = storageAnswer(method, url, body);
      else if (url.pathname.startsWith("/functions/v1/")) answer = { status: 200, body: {} };
      else answer = { status: 404, body: { message: "not modelled by the CA-09 stand-in" } };
    } catch (error) {
      answer = { status: 500, body: { code: "CA09", message: `stand-in error: ${error.message}` } };
    }
    const slow = (config.delays ?? []).filter((d) => (!d.method || d.method === method) && new RegExp(d.path).test(shown)).reduce((sum, d) => sum + d.delayMs, 0);
    const total = config.latency + cost.ms + slow;
    // Part 4's statement timeout: Postgres cancels the read after statementTimeoutMs (the authenticated role's 8 s on
    // Supabase) either because the modelled time is longer, or, with timeoutWhenProposalOverMb, because a returned
    // row's proposal is larger than that many MB.
    const forced = config.timeoutWhenProposalOverMb && cost.maxMb > config.timeoutWhenProposalOverMb;
    if (config.statementTimeoutMs && (forced || cost.ms > config.statementTimeoutMs)) {
      await sleep(config.latency + config.statementTimeoutMs);
      answer = pgError(500, "57014", "canceling statement due to statement timeout");
    } else await sleep(total);
  }
  const code = answer.body && typeof answer.body === "object" && !Array.isArray(answer.body) && answer.status >= 400 ? (answer.body.code ?? null) : null;
  log.push({ at: at - started, method, path: shown.slice(0, 400), status: answer.status, code: code === null ? null : String(code), ms: Date.now() - at, proposalMb: cost.mb ? Number(cost.mb.toFixed(2)) : undefined, bytes: answer.raw ? answer.raw.length : answer.body === undefined ? 0 : JSON.stringify(answer.body).length });
  send(res, answer, {}, /gzip/.test(req.headers["accept-encoding"] ?? ""));
}
const server = TLS
  ? http2.createSecureServer({ key: readFileSync(path.join(TLS, "key.pem")), cert: readFileSync(path.join(TLS, "cert.pem")), allowHTTP1: true }, handle)
  : http.createServer(handle);

/* ── Realtime: Phoenix channels, enough for supabase-js to join and stay quiet ── */

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (!req.url.startsWith("/realtime/v1/websocket")) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    log.push({ at: Date.now() - started, method: "WS", path: "/realtime/v1/websocket", status: 101, ms: 0 });
    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      const isArray = Array.isArray(msg);
      const [joinRef, ref, topic, event, payload] = isArray ? msg : [msg.join_ref, msg.ref, msg.topic, msg.event, msg.payload];
      log.push({ at: Date.now() - started, method: "WS", path: `${topic} ${event}`, status: 0, ms: 0 });
      const reply = (response) => {
        const out = { join_ref: joinRef, ref, topic, event: "phx_reply", payload: { status: "ok", response } };
        ws.send(JSON.stringify(isArray ? [out.join_ref, out.ref, out.topic, out.event, out.payload] : out));
      };
      if (event === "phx_join") {
        const changes = (payload?.config?.postgres_changes ?? []).map((c, i) => ({ ...c, id: i + 1 }));
        setTimeout(() => reply({ postgres_changes: changes }), config.latency);
      } else if (event === "heartbeat" || event === "phx_leave" || event === "access_token" || event === "presence" || event === "broadcast") reply({});
    });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`CA-09 stand-in on ${TLS ? "https (h2)" : "http"}://127.0.0.1:${PORT} (${Object.keys(SCHEMA.tables).length} tables from types.ts)`);
});
