/* CA-08 audit — a fake Supabase behind the real supabase-js client.

   NOTHING IN src/ IS MOCKED BUT THE NETWORK. `startAuditBackend` builds supabase-js's own `createClient`, pointed at a
   made-up project, with `fetch` replaced by `answer`: a small PostgREST and GoTrue that answer with the status codes,
   error codes and bodies the real ones send (postgrest-js 2.103 reads them exactly as it reads the real ones). So
   builds.ts, drafts.ts, making.ts and sessions.ts run as they do in the browser, request for request.

   THE SCHEMA IS DATA. Each table lists its columns. `LIVE_SCHEMA` is what src/integrations/supabase/types.ts says the
   live database had when Lovable last generated it (13 October 2026); `REPO_SCHEMA` adds what the migrations after
   it add. Take a column away and every request that names it fails as PostgREST fails it: 42703 when it is selected
   or filtered on, PGRST204 when it is written.

   RLS IS THE MIGRATIONS' POLICIES, written out: a draft is read by its creator (20260823120000:226), a build is
   inserted and updated by its creator (:234, :238), nodes and media follow their build, a session is its owner's
   (20260917120000:213-229), and anon has no grant on import_sessions (20260917120000:255).

   FAULTS are the failures the schema cannot make by itself (a refused check, a policy that refuses, a lost network):
   each matches a method and a path and answers once, or every time.

   No key, token, address or account in here is real. Test only. */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const AUDIT_URL = "https://ca08audit.supabase.co";
const ANON_KEY = "ca08-audit-anon-placeholder";
const ACCESS_TOKEN = "ca08-audit-access-placeholder";
const STORAGE_KEY = "sb-ca08audit-auth-token";
/** The signed-in maker. Made up. */
export const MAKER_ID = "0b0b0b0b-0000-4000-8000-000000000001";

export type Row = Record<string, unknown>;

/* ── the schema ── */

/** builds, as types.ts lists it (generated from the live database by Lovable, last on 13 October). */
const LIVE_BUILDS = [
  "ai_turn_count", "completeness", "cost_monthly", "cost_setup", "cover_media_id", "created_at", "created_via", "creator_id",
  "currency", "donation_enabled", "forked_from_event_id", "hero_node_id", "id", "last_confirmed_at", "last_confirmed_model",
  "live_url", "made_for", "made_with", "making", "models_used", "monetisation_type", "outcome", "parent_build_id", "price_gbp",
  "prompt_count", "published_at", "rebuild_count", "rebuild_note", "repo_url", "reproduction_count", "root_build_id",
  "session_count", "shape", "slug", "solves_node_id", "source_content_item_id", "source_handle_at_fork", "source_title_at_fork",
  "status", "time_to_first_result", "title", "updated_at",
];
const BUILD_NODES = ["build_id", "created_at", "event_id", "id", "is_gap", "note", "parent_id", "payload", "position", "source_ref", "title", "type"];
const BUILD_EVENTS = ["build_id", "created_at", "id", "kind", "occurred_at", "ordinal", "payload", "phase", "phase_title", "produced_node_id", "visibility"];
const NODE_TYPES = ["category", "colour", "copyable", "icon", "is_active", "key", "label", "renderer", "schema", "sort"];
const BUILD_MEDIA = [
  "bucket", "build_id", "bytes", "caption", "created_at", "duration", "filename", "height", "id", "kind", "metadata", "mime",
  "node_id", "path", "post_position", "post_text", "poster_path", "width",
];
const IMPORT_SESSIONS = [
  "build_id", "chunk_count", "client", "content_hash", "created_at", "declared_chars", "declared_turns", "detection_reason", "error",
  "expected_chunks", "expires_at", "fingerprint", "id", "model", "proposal", "reader_id", "secret_findings", "source_hint", "status",
  "target_build_id", "total_chars", "updated_at", "user_id",
];
const PROFILES = [
  "account_type", "avatar_url", "banner_url", "bio", "bounty_lifetime_acceptances", "bounty_lifetime_submissions",
  "bounty_lifetime_votes_received", "bounty_solutions_accepted", "bounty_solutions_submitted", "bounty_solver_acceptance_rate",
  "bounty_total_reward_earned", "created_at", "curator_application_status", "derived_bio", "display_name", "follower_count",
  "following_count", "id", "is_admin", "is_creator", "is_curator", "is_private", "is_trusted_solver", "is_verified", "joined_at",
  "last_derived_at", "level", "location", "notification_preferences", "stripe_account_id", "subscription_price_id",
  "twitter_handle", "user_ai_tools", "user_interests", "username", "website_url",
];

export interface Schema {
  /** table -> its columns */
  tables: Record<string, readonly string[]>;
  /** RPCs PostgREST would find in its schema cache. */
  functions: readonly string[];
  /** set_build_post_media's cap: 4 before 20261016120000_post_threads.sql, 40 after it. */
  postMediaCap: number;
}

/** The live database as types.ts describes it: no builds.post_doc, no profiles.colour_swatches. */
export const LIVE_SCHEMA: Schema = {
  tables: {
    builds: LIVE_BUILDS,
    build_nodes: BUILD_NODES,
    build_events: BUILD_EVENTS,
    node_types: NODE_TYPES,
    build_media: BUILD_MEDIA,
    import_sessions: IMPORT_SESSIONS,
    profiles: PROFILES,
  },
  functions: ["gallery_facets", "set_build_post_media"],
  postMediaCap: 4,
};

/** Every migration in supabase/migrations applied: post_doc (20261016120000) and colour_swatches (20261020120000). */
export const REPO_SCHEMA: Schema = {
  ...LIVE_SCHEMA,
  tables: { ...LIVE_SCHEMA.tables, builds: [...LIVE_BUILDS, "post_doc"], profiles: [...PROFILES, "colour_swatches"] },
  postMediaCap: 40,
};

/** A schema with one column taken away (the live database behind the repository by that column). */
export function without(schema: Schema, table: string, column: string): Schema {
  return { ...schema, tables: { ...schema.tables, [table]: schema.tables[table].filter((name) => name !== column) } };
}

/* ── faults ── */

export type FaultAnswer = "network" | { status: number; body: Row };

export interface Fault {
  method?: string;
  /** Tested against "/rest/v1/builds?select=…" (the decoded path and query). */
  path: RegExp;
  answer: FaultAnswer;
  /** How many requests it answers; every one when absent. */
  times?: number;
}

/** CA-10: the right answer, later (one read slow alone), as the CA-09 stand-in's `delays`. */
export interface Delay {
  method?: string;
  path: RegExp;
  delayMs: number;
}

/** PostgREST's error bodies, word for word as it sends them. */
export const PG = {
  rlsInsert: (table: string): FaultAnswer => ({ status: 403, body: { code: "42501", details: null, hint: null, message: `new row violates row-level security policy for table "${table}"` } }),
  check: (table: string, constraint: string): FaultAnswer => ({
    status: 400,
    body: { code: "23514", details: "Failing row contains (…).", hint: null, message: `new row for relation "${table}" violates check constraint "${constraint}"` },
  }),
  missingFunction: (signature: string): FaultAnswer => ({ status: 404, body: { code: "42883", details: null, hint: "No function matches the given name and argument types. You might need to add explicit type casts.", message: `function ${signature} does not exist` } }),
  zeroRows: (): FaultAnswer => ({ status: 406, body: { code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "Cannot coerce the result to a single JSON object" } }),
};

/* ── the backend ── */

export interface Logged {
  method: string;
  /** "/rest/v1/builds?select=…", decoded. */
  path: string;
  status: number;
  code: string | null;
}

interface Backend {
  schema: Schema;
  rows: Record<string, Row[]>;
  faults: Fault[];
  delays: Delay[];
  log: Logged[];
  signedIn: boolean;
  client: SupabaseClient | null;
}

const backend: Backend = { schema: REPO_SCHEMA, rows: {}, faults: [], delays: [], log: [], signedIn: true, client: null };

/** The requests made since the backend was set up. */
export const requests = (): readonly Logged[] => backend.log;
/** The rows of a table as they stand. */
export const tableRows = (table: string): readonly Row[] => backend.rows[table] ?? [];

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return `0c0c0c0c-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
};

/** Fifteen drafts, last touched from 25 August to 10 October 2026, as the connector listed them (titles made up). */
function seedRows(): Record<string, Row[]> {
  const touched = [
    "2026-10-10T19:31:55Z", "2026-10-10T19:19:24Z", "2026-10-10T19:16:46Z", "2026-10-10T14:39:16Z", "2026-10-05T16:31:31Z",
    "2026-10-05T16:00:38Z", "2026-10-05T10:44:25Z", "2026-09-24T11:35:20Z", "2026-09-23T22:39:12Z", "2026-08-26T18:32:51Z",
    "2026-08-26T18:32:04Z", "2026-08-26T14:07:51Z", "2026-08-25T16:50:03Z", "2026-08-25T13:49:03Z", "2026-08-25T13:40:52Z",
  ];
  const builds = touched.map((at, index) => buildRow({ id: `0d0d0d0d-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, title: `Draft ${index + 1}`, created_at: at, updated_at: at }));
  const proposal = (text: string) => ({ events: [{ kind: "prompt", ordinal: 0, payload: { text }, source_ref: { index: 0 } }], summary: { user_turn_count: 1, assistant_turn_count: 1 } });
  const sessions: Row[] = [
    { id: "0e0e0e0e-0000-4000-8000-000000000001", user_id: MAKER_ID, client: "claude-code", model: null, status: "parsed", build_id: null, target_build_id: null, created_at: "2026-10-09T10:00:00Z", updated_at: "2026-10-09T10:00:00Z", proposal: proposal("A waiting session.") },
    { id: "0e0e0e0e-0000-4000-8000-000000000002", user_id: MAKER_ID, client: "claude", model: null, status: "claimed", build_id: builds[0].id, target_build_id: null, created_at: "2026-10-08T10:00:00Z", updated_at: "2026-10-08T10:00:00Z", proposal: proposal("A session in a draft.") },
  ];
  const nodeTypes = ["prompt", "agent_config", "team", "manual_step", "document", "integration", "result", "code", "eval_run", "breakage", "gap", "recording", "screenshot"].map((key, sort) => ({
    // No colour: the two flows never draw a type's colour, and src/ holds no raw colour literal (theme/compliance.test.ts).
    key, label: key, category: "process", colour: null, icon: "Box", renderer: "process", copyable: true, is_active: true, sort, schema: { fields: [] },
  }));
  const profile = { id: MAKER_ID, username: "maker", display_name: "Maker", avatar_url: null, is_admin: false, is_creator: true };
  return { builds, build_nodes: [], build_events: [], node_types: nodeTypes, build_media: [], import_sessions: sessions, profiles: [profile] };
}

function buildRow(over: Row): Row {
  const now = new Date().toISOString();
  const row: Row = {
    id: nextId(), creator_id: MAKER_ID, slug: `draft-${sequence}`, title: "Untitled build", outcome: null, shape: "other", status: "draft",
    made_for: [], made_with: [], live_url: null, repo_url: null, hero_node_id: null, cover_media_id: null, cost_setup: null,
    cost_monthly: null, currency: null, time_to_first_result: null, completeness: 0, reproduction_count: 0, last_confirmed_at: null,
    last_confirmed_model: null, parent_build_id: null, root_build_id: null, forked_from_event_id: null, source_content_item_id: null,
    monetisation_type: null, price_gbp: null, donation_enabled: false, created_at: now, updated_at: now, published_at: null,
    rebuild_note: null, rebuild_count: 0, source_title_at_fork: null, source_handle_at_fork: null, solves_node_id: null,
    created_via: null, session_count: 0, prompt_count: 0, ai_turn_count: 0, models_used: [], making: {}, post_doc: null,
    ...over,
  };
  return row;
}

/**
 * Set the backend up for one test: the schema, the faults, whether the maker is signed in. Returns the client the
 * mocked `@/integrations/supabase/client` hands out.
 */
export function startAuditBackend({
  schema = REPO_SCHEMA,
  faults = [],
  delays = [],
  signedIn = true,
  seed,
}: { schema?: Schema; faults?: Fault[]; delays?: Delay[]; signedIn?: boolean; seed?: (rows: Record<string, Row[]>) => void } = {}): SupabaseClient {
  backend.schema = schema;
  backend.rows = seedRows();
  seed?.(backend.rows);
  backend.faults = faults.map((fault) => ({ ...fault }));
  backend.delays = delays;
  backend.log = [];
  backend.signedIn = signedIn;
  const store = new Map<string, string>();
  if (signedIn) {
    store.set(
      STORAGE_KEY,
      JSON.stringify({
        access_token: ACCESS_TOKEN,
        refresh_token: "ca08-audit-refresh-placeholder",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: MAKER_ID, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-08-01T00:00:00Z" },
      }),
    );
  }
  backend.client = createClient(AUDIT_URL, ANON_KEY, {
    global: { fetch: answer },
    auth: {
      storageKey: STORAGE_KEY,
      storage: { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => void store.set(key, value), removeItem: (key) => void store.delete(key) },
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return backend.client;
}

/** What the mocked `@/integrations/supabase/client` exports: the current test's client, whichever it is. */
export const clientModule = {
  supabase: new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      const client = backend.client;
      if (!client) throw new Error("CA-08 audit: call startAuditBackend() before the data layer runs.");
      const value = Reflect.get(client, prop, client) as unknown;
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
    },
  }),
};

/* ── PostgREST, as far as these flows reach ── */

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const pgError = (status: number, code: string, message: string, details: string | null = null, hint: string | null = null) =>
  json(status, { code, details, hint, message });

interface Pick {
  alias: string;
  column: string;
  /** JSON path after the column, and whether the last step is ->> (text). */
  path: string[];
  text: boolean;
}

function parseSelect(select: string): Pick[] | "embedded" {
  if (select.includes("(")) return "embedded";
  return select.split(",").filter(Boolean).map((item) => {
    const colon = item.indexOf(":");
    const alias = colon >= 0 ? item.slice(0, colon) : null;
    const expression = colon >= 0 ? item.slice(colon + 1) : item;
    const parts = expression.split(/(->>|->)/);
    const column = parts[0];
    const path: string[] = [];
    let text = false;
    for (let at = 1; at < parts.length; at += 2) {
      path.push(parts[at + 1]);
      text = parts[at] === "->>";
    }
    return { alias: alias ?? (path.length ? path[path.length - 1] : column), column, path, text };
  });
}

function follow(value: unknown, path: readonly string[], text: boolean): unknown {
  let current: unknown = value;
  for (const step of path) {
    if (current === null || current === undefined) return null;
    if (Array.isArray(current)) current = current[Number(step)];
    else if (typeof current === "object") current = (current as Row)[step];
    else return null;
  }
  if (current === undefined) return null;
  return text && current !== null && typeof current !== "string" ? JSON.stringify(current) : current;
}

interface Filter {
  column: string;
  negate: boolean;
  op: string;
  value: string;
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

function parseFilters(params: URLSearchParams): Filter[] {
  const out: Filter[] = [];
  for (const [column, raw] of params) {
    if (RESERVED.has(column)) continue;
    let rest = raw;
    let negate = false;
    if (rest.startsWith("not.")) {
      negate = true;
      rest = rest.slice(4);
    }
    const dot = rest.indexOf(".");
    out.push({ column, negate, op: rest.slice(0, dot), value: rest.slice(dot + 1) });
  }
  return out;
}

function listOf(value: string): string[] {
  const inner = value.replace(/^\(/, "").replace(/\)$/, "");
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of inner) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      out.push(current);
      current = "";
    } else current += char;
  }
  if (inner.length) out.push(current);
  return out;
}

function matches(row: Row, filter: Filter): boolean {
  const cell = row[filter.column];
  let result: boolean;
  switch (filter.op) {
    case "eq":
      result = cell !== null && cell !== undefined && String(cell) === filter.value;
      break;
    case "neq":
      result = cell !== null && cell !== undefined && String(cell) !== filter.value;
      break;
    case "in":
      result = cell !== null && cell !== undefined && listOf(filter.value).includes(String(cell));
      break;
    case "is":
      result = filter.value === "null" ? cell === null || cell === undefined : String(cell) === filter.value;
      break;
    default:
      throw new Error(`CA-08 audit fake: filter ${filter.op} is not modelled`);
  }
  return filter.negate ? !result : result;
}

function order(rows: Row[], spec: string | null): Row[] {
  if (!spec) return rows;
  const keys = spec.split(",").map((part) => {
    const [column, direction] = part.split(".");
    return { column, descending: direction === "desc" };
  });
  return [...rows].sort((a, b) => {
    for (const { column, descending } of keys) {
      const x = a[column] as string | number | null;
      const y = b[column] as string | number | null;
      if (x === y) continue;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (x < y ? -1 : 1) * (descending ? -1 : 1);
    }
    return 0;
  });
}

/** The caller, as RLS reads auth.uid(): the maker when the request carries the maker's token, else nobody. */
function uidOf(headers: Headers): string | null {
  return backend.signedIn && headers.get("authorization") === `Bearer ${ACCESS_TOKEN}` ? MAKER_ID : null;
}

const buildOf = (id: unknown) => backend.rows.builds.find((build) => build.id === id);

/** The SELECT policies (20260823120000:226-260, 20260823140000:70, 20260917120000:213). */
function readable(table: string, row: Row, uid: string | null): boolean {
  switch (table) {
    case "builds":
      return row.status !== "draft" || (uid !== null && row.creator_id === uid);
    case "build_nodes":
    case "build_media":
    case "build_events": {
      const build = buildOf(row.build_id);
      return Boolean(build && readable("builds", build, uid));
    }
    case "import_sessions":
      return uid !== null && row.user_id === uid;
    default:
      return true;
  }
}

/** The INSERT, UPDATE and DELETE policies: the build's creator (20260823120000:234-300). */
function writable(table: string, row: Row, uid: string | null): boolean {
  switch (table) {
    case "builds":
      return uid !== null && row.creator_id === uid;
    case "build_nodes":
    case "build_media":
    case "build_events": {
      const build = buildOf(row.build_id);
      return Boolean(build && uid !== null && build.creator_id === uid);
    }
    case "import_sessions":
      return uid !== null && row.user_id === uid;
    case "profiles":
      return uid !== null && row.id === uid;
    default:
      return false;
  }
}

/** The CHECK constraints a write meets, as the migrations define them (only those whose column exists). */
function checkViolation(table: string, row: Row): string | null {
  const columns = backend.schema.tables[table];
  if (table === "builds") {
    if (!["draft", "published", "gallery"].includes(String(row.status))) return "builds_status_check";
    if (!["app", "agent", "workflow", "prompt", "dataset", "study", "media", "technique", "other"].includes(String(row.shape))) return "builds_shape_check";
    if (columns.includes("making") && (row.making === null || typeof row.making !== "object" || Array.isArray(row.making))) return "builds_making_object_check";
    for (const count of ["session_count", "prompt_count", "ai_turn_count"]) if (columns.includes(count) && Number(row[count]) < 0) return `builds_${count}_check`;
    if (columns.includes("post_doc") && row.post_doc !== null && row.post_doc !== undefined) {
      if (typeof row.post_doc !== "object" || Array.isArray(row.post_doc) || JSON.stringify(row.post_doc).length > 200000) return "builds_post_doc_check";
    }
  }
  if (table === "build_media" && row.post_position !== null && row.post_position !== undefined) {
    const max = backend.schema.postMediaCap - 1;
    if (Number(row.post_position) < 0 || Number(row.post_position) > max) return "build_media_post_position_range_check";
  }
  return null;
}

function project(rows: readonly Row[], picks: Pick[] | null): Row[] {
  if (!picks || (picks.length === 1 && picks[0].column === "*")) return rows.map((row) => ({ ...row }));
  return rows.map((row) => Object.fromEntries(picks.map((pick) => [pick.alias, pick.path.length ? follow(row[pick.column], pick.path, pick.text) : (row[pick.column] ?? null)])));
}

function respondRows(status: number, rows: Row[], headers: Headers, total?: number): Response {
  const accept = headers.get("accept") ?? "";
  const extra: Record<string, string> = total === undefined ? {} : { "content-range": rows.length ? `0-${rows.length - 1}/${total}` : `*/${total}` };
  if (accept.includes("vnd.pgrst.object+json")) {
    if (rows.length !== 1) return pgError(406, "PGRST116", "Cannot coerce the result to a single JSON object", `The result contains ${rows.length} rows`);
    return json(status, rows[0], extra);
  }
  return json(status, rows, extra);
}

function table(method: string, name: string, params: URLSearchParams, headers: Headers, body: unknown): Response {
  const columns = backend.schema.tables[name];
  if (!columns) return pgError(404, "PGRST205", `Could not find the table 'public.${name}' in the schema cache`);
  const uid = uidOf(headers);

  // Grants: anon has none on import_sessions (20260917120000:255), and only SELECT on builds and its children.
  if (uid === null && name === "import_sessions") return pgError(401, "42501", "permission denied for table import_sessions");
  if (uid === null && method !== "GET" && method !== "HEAD") return pgError(401, "42501", `permission denied for table ${name}`);

  // The payload first, as PostgREST reads it: a key it has no column for is PGRST204.
  const payload = (Array.isArray(body) ? body : body === undefined ? [] : [body]) as Row[];
  for (const entry of payload) {
    for (const key of Object.keys(entry)) {
      if (!columns.includes(key)) return pgError(400, "PGRST204", `Could not find the '${key}' column of '${name}' in the schema cache`);
    }
  }

  // Then the statement: a selected or filtered column that does not exist is 42703, and nothing is written.
  const select = params.get("select");
  const picks = select === null ? null : parseSelect(select);
  if (picks === "embedded") throw new Error("CA-08 audit fake: embedded resources are not modelled");
  for (const pick of picks ?? []) {
    if (pick.column !== "*" && !columns.includes(pick.column)) return pgError(400, "42703", `column ${name}.${pick.column} does not exist`);
  }
  const filters = parseFilters(params);
  for (const filter of filters) if (!columns.includes(filter.column)) return pgError(400, "42703", `column ${name}.${filter.column} does not exist`);
  const prefer = headers.get("prefer") ?? "";
  const representation = prefer.includes("return=representation");
  const rows = backend.rows[name] ?? (backend.rows[name] = []);

  if (method === "GET" || method === "HEAD") {
    const visible = order(rows.filter((row) => readable(name, row, uid) && filters.every((filter) => matches(row, filter))), params.get("order"));
    const offset = Number(params.get("offset") ?? 0);
    const limit = params.has("limit") ? Number(params.get("limit")) : visible.length;
    const page = visible.slice(offset, offset + limit);
    const total = prefer.includes("count=exact") ? visible.length : undefined;
    if (method === "HEAD") return new Response(null, { status: 200, headers: total === undefined ? {} : { "content-range": `*/${total}` } });
    return respondRows(200, project(page, picks), headers, total);
  }

  if (method === "POST") {
    const merge = prefer.includes("resolution=merge-duplicates");
    const written: Row[] = [];
    for (const entry of payload) {
      const existing = merge ? rows.find((row) => row.id === entry.id) : undefined;
      const next: Row = existing ? { ...existing, ...entry } : name === "builds" ? buildRow(entry) : { id: nextId(), created_at: new Date().toISOString(), ...entry };
      if (!writable(name, next, uid)) return pgError(403, "42501", `new row violates row-level security policy for table "${name}"`);
      const broken = checkViolation(name, next);
      if (broken) return pgError(400, "23514", `new row for relation "${name}" violates check constraint "${broken}"`, "Failing row contains (…).");
      if (name === "build_nodes" && !backend.rows.node_types.some((type) => type.key === next.type)) {
        return pgError(409, "23503", 'insert or update on table "build_nodes" violates foreign key constraint "build_nodes_type_fkey"', `Key (type)=(${String(next.type)}) is not present in table "node_types".`);
      }
      written.push(next);
    }
    for (const next of written) {
      const at = rows.findIndex((row) => row.id === next.id);
      if (at >= 0) rows[at] = next;
      else rows.push(next);
    }
    return representation ? respondRows(201, project(written, picks), headers) : new Response(null, { status: 201 });
  }

  if (method === "PATCH") {
    // UPDATE ... USING: a row the caller may not write is a row that did not match. No error; nothing changes.
    const targets = rows.filter((row) => readable(name, row, uid) && writable(name, row, uid) && filters.every((filter) => matches(row, filter)));
    const patch = (payload[0] ?? {}) as Row;
    const written: Row[] = [];
    for (const row of targets) {
      const next = { ...row, ...patch, ...(name === "builds" ? { updated_at: new Date().toISOString() } : null) };
      const broken = checkViolation(name, next);
      if (broken) return pgError(400, "23514", `new row for relation "${name}" violates check constraint "${broken}"`, "Failing row contains (…).");
      written.push(next);
    }
    for (const next of written) rows[rows.findIndex((row) => row.id === next.id)] = next;
    return representation ? respondRows(200, project(written, picks), headers) : new Response(null, { status: 204 });
  }

  if (method === "DELETE") {
    const gone = rows.filter((row) => writable(name, row, uid) && filters.every((filter) => matches(row, filter)));
    backend.rows[name] = rows.filter((row) => !gone.includes(row));
    return representation ? respondRows(200, project(gone, picks), headers) : new Response(null, { status: 204 });
  }

  throw new Error(`CA-08 audit fake: ${method} is not modelled`);
}

function rpc(name: string, params: URLSearchParams, headers: Headers, body: unknown): Response {
  const args = (body ?? {}) as Row;
  if (!backend.schema.functions.includes(name)) {
    const list = Object.keys(args).join(", ");
    return pgError(
      404,
      "PGRST202",
      `Could not find the function public.${name}(${list}) in the schema cache`,
      `Searched for the function public.${name} with parameters ${list} or with a single unnamed json/jsonb parameter, but no matches were found in the schema cache.`,
    );
  }
  if (name === "gallery_facets") return json(200, { roles: [], tools: [] });
  if (name === "set_build_post_media") {
    const ids = (args.p_media_ids ?? []) as string[];
    if (ids.length > backend.schema.postMediaCap) {
      const said = backend.schema.postMediaCap === 4 ? `a post shows at most 4 pictures, got ${ids.length}` : `a thread shows at most ${backend.schema.postMediaCap} pictures, got ${ids.length}`;
      return pgError(400, "23514", `post_media_too_many: ${said}`);
    }
    const uid = uidOf(headers);
    const media = backend.rows.build_media;
    for (const row of media) if (row.build_id === args.p_build_id && writable("build_media", row, uid)) row.post_position = null;
    ids.forEach((id, slot) => {
      const row = media.find((candidate) => candidate.id === id && candidate.build_id === args.p_build_id && writable("build_media", candidate, uid));
      if (row) row.post_position = slot;
    });
    const set = order(media.filter((row) => row.build_id === args.p_build_id && row.post_position !== null && row.post_position !== undefined), "post_position.asc");
    const picks = params.get("select");
    return json(200, project(set, picks ? (parseSelect(picks) as Pick[]) : null));
  }
  return json(200, null);
}

function auth(path: string, headers: Headers): Response {
  if (path === "/auth/v1/user") {
    return uidOf(headers)
      ? json(200, { id: MAKER_ID, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} })
      : json(401, { code: 401, error_code: "no_authorization", msg: "This endpoint requires a valid Bearer token" });
  }
  if (path === "/auth/v1/logout") return new Response(null, { status: 204 });
  return json(400, { code: 400, error_code: "validation_failed", msg: "not modelled by the CA-08 audit fake" });
}

/** The fetch supabase-js is given. */
export async function answer(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const shown = `${url.pathname}${url.search ? `?${decodeURIComponent(url.searchParams.toString())}` : ""}`;

  const delay = backend.delays.find((candidate) => (!candidate.method || candidate.method === method) && candidate.path.test(shown));
  if (delay) await new Promise((resolve) => setTimeout(resolve, delay.delayMs));

  const fault = backend.faults.find((candidate) => (!candidate.method || candidate.method === method) && candidate.path.test(shown) && (candidate.times === undefined || candidate.times > 0));
  if (fault) {
    if (fault.times !== undefined) fault.times -= 1;
    if (fault.answer === "network") {
      backend.log.push({ method, path: shown, status: 0, code: null });
      throw new TypeError("Failed to fetch");
    }
    backend.log.push({ method, path: shown, status: fault.answer.status, code: String(fault.answer.body.code ?? "") || null });
    return json(fault.answer.status, fault.answer.body);
  }

  const body = typeof init.body === "string" && init.body ? (JSON.parse(init.body) as unknown) : undefined;
  let response: Response;
  if (url.pathname.startsWith("/auth/v1/")) response = auth(url.pathname, headers);
  else if (url.pathname.startsWith("/rest/v1/rpc/")) response = rpc(url.pathname.slice("/rest/v1/rpc/".length), url.searchParams, headers, body);
  else if (url.pathname.startsWith("/rest/v1/")) response = table(method, url.pathname.slice("/rest/v1/".length), url.searchParams, headers, body);
  else response = json(404, { message: "not modelled by the CA-08 audit fake" });

  let code: string | null = null;
  if (!response.ok && response.headers.get("content-type")?.includes("json")) {
    const said = (await response.clone().json().catch(() => null)) as Row | null;
    code = said && typeof said.code === "string" ? said.code : null;
  }
  backend.log.push({ method, path: shown, status: response.status, code });
  return response;
}
