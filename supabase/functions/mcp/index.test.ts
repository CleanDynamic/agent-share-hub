// =============================================================================
// buildgallery — mcp tests (EX-P02 the door, EX-P04 the lock, EX-P06 the pipe)
// =============================================================================
// Run with:
//   SUPABASE_FUNCTION_SLUG=mcp \
//   SUPABASE_URL=https://zybdotagjwektucfdkri.supabase.co \
//   SUPABASE_ANON_KEY=test SUPABASE_PUBLISHABLE_KEY=sb_publishable_test \
//   deno test --config supabase/functions/mcp/deno.json \
//     --allow-net --allow-env --allow-read supabase/functions/mcp/
//
// No Supabase is running and none is needed. The gate is exercised through the
// real pipeline — a request with no token really is refused by the real
// middleware — and the tools are exercised against a fake client that records
// every query and every storage call, so "named columns, never select('*')",
// "upsert on the path" and "recount from the bucket" are tests rather than
// promises. The fake bucket holds object sizes only, never bodies: a test
// cannot accidentally assert on conversation content because the fake never
// keeps any.
//
// SUPABASE_FUNCTION_SLUG is set because the platform sets it: it is what makes
// withOAuthProtectedResource derive /functions/v1/mcp rather than falling back
// to composing a path from the request, which doubles the prefix. Testing
// without it would prove the wrong branch.
// =============================================================================

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";

import door, { buildServer, humanTime } from "./index.ts";
import type { CallerClient, CallerIdentity } from "./index.ts";
import {
  CHUNK_SIZE_CHARS,
  CONNECTOR_STATEMENT,
  DEFAULT_PAGE_SIZE,
  MAX_CHUNK_CHARS,
  MAX_PAGE_SIZE,
  MAX_TOTAL_CHARS,
  SERVER_NAME,
  VERBATIM_INSTRUCTION,
} from "./constants.ts";
import { createMcpHandler } from "@modelcontextprotocol/server";

const PROJECT = "https://zybdotagjwektucfdkri.supabase.co";
const ENDPOINT = `${PROJECT}/functions/v1/mcp`;
const RESOURCE = `${PROJECT}/functions/v1/mcp`;

const TOOLS = [
  "buildgallery_whoami",
  "buildgallery_list_drafts",
  "buildgallery_begin_import",
  "buildgallery_append_chunk",
  "buildgallery_get_import_status",
  "buildgallery_list_imports",
];

const CALLER = { id: "3f6c1e02-9b1a-4f7d-8d02-1c2f5a9e77b4", email: "mel@example.com" };
const IMPORT_ID = "6d0f4a2e-1c3b-4e5f-9a7b-8c9d0e1f2a3b";
const DRAFT_ID = "9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f";
const NOW = Date.parse("2026-09-17T12:00:00Z");

// -----------------------------------------------------------------------------
// Helpers — requests
// -----------------------------------------------------------------------------

function rpc(method: string, params: Record<string, unknown> = {}, token?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

async function body(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (text.startsWith("event:") || text.includes("\ndata: ")) {
    const frames = text.split("\n").filter((l) => l.startsWith("data: "));
    return JSON.parse(frames[frames.length - 1].slice(6));
  }
  return JSON.parse(text);
}

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Helpers — the fake client
// -----------------------------------------------------------------------------

/** One recorded PostgREST query, as the builder chain described it. */
interface Query {
  table: string;
  op: "select" | "insert" | "update";
  columns?: string;
  options?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  filters: Array<{ kind: string; column: string; value: unknown }>;
  order?: { column: string; ascending: boolean };
  range?: [number, number];
  limit?: number;
  single?: "single" | "maybeSingle";
}

interface Answer {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
}

type Respond = (q: Query) => Answer;

/** A private bucket that remembers sizes and paths, never bodies. */
class FakeBucket {
  objects = new Map<string, number>();
  uploads: Array<{ bucket: string; path: string; size: number; options: Record<string, unknown> }> = [];
  lists: Array<{ bucket: string; prefix: string; options: Record<string, unknown> }> = [];
  failUpload = false;
  failList = false;

  seed(userId: string, importId: string, sizes: Record<number, number>): void {
    for (const [seq, size] of Object.entries(sizes)) {
      this.objects.set(`${userId}/${importId}/${seq}.txt`, size);
    }
  }

  from(bucket: string) {
    return {
      upload: (path: string, file: Blob, options: Record<string, unknown>) => {
        this.uploads.push({ bucket, path, size: file.size, options });
        if (this.failUpload) return Promise.resolve({ data: null, error: { name: "StorageApiError" } });
        if (!options.upsert && this.objects.has(path)) {
          return Promise.resolve({ data: null, error: { name: "StorageApiError" } });
        }
        this.objects.set(path, file.size);
        return Promise.resolve({ data: { path }, error: null });
      },
      list: (prefix: string, options: Record<string, unknown>) => {
        this.lists.push({ bucket, prefix, options });
        if (this.failList) return Promise.resolve({ data: null, error: { name: "StorageApiError" } });
        const all = [...this.objects.entries()]
          .filter(([path]) => path.startsWith(`${prefix}/`))
          .map(([path, size]) => ({
            name: path.slice(prefix.length + 1),
            id: "object",
            metadata: { size },
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const offset = Number(options.offset ?? 0);
        const limit = Number(options.limit ?? 100);
        return Promise.resolve({ data: all.slice(offset, offset + limit), error: null });
      },
    };
  }
}

/** The slice of the PostgREST builder the tools chain. Thenable, like the real one. */
interface Builder extends PromiseLike<{ data: unknown; error: unknown; count: number | null }> {
  select(columns: string, options?: Record<string, unknown>): Builder;
  insert(payload: Record<string, unknown>): Builder;
  update(payload: Record<string, unknown>): Builder;
  eq(column: string, value: unknown): Builder;
  in(column: string, value: unknown): Builder;
  order(column: string, options: { ascending: boolean }): Builder;
  range(from: number, to: number): Builder;
  limit(n: number): Builder;
  maybeSingle(): Builder;
  single(): Builder;
  overrideTypes(): Builder;
}

function fakeClient(respond: Respond, bucket = new FakeBucket()): {
  client: CallerClient;
  queries: Query[];
  bucket: FakeBucket;
} {
  const queries: Query[] = [];

  const client = {
    from(table: string) {
      const q: Query = { table, op: "select", filters: [] };
      const builder: Builder = {
        select(columns, options) {
          q.columns = columns;
          if (options) q.options = options;
          return builder;
        },
        insert(payload) {
          q.op = "insert";
          q.payload = payload;
          return builder;
        },
        update(payload) {
          q.op = "update";
          q.payload = payload;
          return builder;
        },
        eq(column, value) {
          q.filters.push({ kind: "eq", column, value });
          return builder;
        },
        in(column, value) {
          q.filters.push({ kind: "in", column, value });
          return builder;
        },
        order(column, options) {
          q.order = { column, ascending: options.ascending };
          return builder;
        },
        range(from, to) {
          q.range = [from, to];
          return builder;
        },
        limit(n) {
          q.limit = n;
          return builder;
        },
        maybeSingle() {
          q.single = "maybeSingle";
          return builder;
        },
        single() {
          q.single = "single";
          return builder;
        },
        overrideTypes() {
          return builder;
        },
        then(resolve, reject) {
          queries.push(q);
          const a = respond(q);
          return Promise.resolve({
            data: a.data ?? null,
            error: a.error ?? null,
            count: a.count ?? null,
          }).then(resolve, reject);
        },
      };
      return builder;
    },
    storage: { from: (name: string) => bucket.from(name) },
  };

  return { client: client as unknown as CallerClient, queries, bucket };
}

/** Answers every query with nothing; enough for tools/list. */
const NOTHING: Respond = () => ({ data: null });

async function call(
  name: string,
  args: Record<string, unknown>,
  respond: Respond = NOTHING,
  bucket = new FakeBucket(),
  caller: CallerIdentity = CALLER,
) {
  const fake = fakeClient(respond, bucket);
  const handler = createMcpHandler(() => buildServer(fake.client, caller, () => NOW));
  const res = await handler.fetch(rpc("tools/call", { name, arguments: args }));
  const payload = await body(res);
  const result = payload.result as ToolResult | undefined;
  return { res, payload, result, queries: fake.queries, bucket: fake.bucket };
}

async function listTools() {
  const { client } = fakeClient(NOTHING);
  const handler = createMcpHandler(() => buildServer(client, { id: "u", email: null }));
  const payload = await body(await handler.fetch(rpc("tools/list")));
  return (payload.result as { tools: Array<Record<string, unknown>> }).tools;
}

function text(result: ToolResult | undefined): string {
  return result?.content.map((c) => c.text).join("\n") ?? "";
}

/** A well-formed open import row, for tests that need one to exist. */
function importRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: IMPORT_ID,
    status: "open",
    chunk_count: 0,
    total_chars: 0,
    expected_chunks: null,
    declared_turns: 48,
    declared_chars: 212000,
    target_build_id: null,
    build_id: null,
    error: null,
    created_at: "2026-09-17T10:00:00Z",
    updated_at: "2026-09-17T10:00:00Z",
    expires_at: "2026-09-24T10:00:00Z",
    turn_count: null,
    event_count: null,
    node_count: null,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
// EX-P04 — the lock
// -----------------------------------------------------------------------------

Deno.test("a request with no token is refused", async () => {
  const res = await door.fetch(rpc("tools/list"));
  assertEquals(res.status, 401);
});

Deno.test("the 401 carries WWW-Authenticate pointing at the metadata URL", async () => {
  const res = await door.fetch(rpc("tools/list"));
  await res.body?.cancel();

  const header = res.headers.get("www-authenticate");
  assert(header, "WWW-Authenticate is present");
  assertStringIncludes(header, "Bearer");
  assertStringIncludes(header, `resource_metadata="${RESOURCE}/oauth-protected-resource"`);
});

Deno.test("a token that does not verify is refused, not crashed on", async () => {
  const res = await door.fetch(rpc("tools/list", {}, "not-a-real-jwt"));
  await res.body?.cancel();
  assertEquals(res.status, 401);
});

Deno.test("the discovery endpoint answers without a token", async () => {
  const res = await door.fetch(new Request(`${ENDPOINT}/.well-known/oauth-protected-resource`));
  assertEquals(res.status, 200);

  const metadata = await res.json();
  assertEquals(metadata.resource, RESOURCE);
  assertEquals(metadata.authorization_servers, [`${PROJECT}/auth/v1`]);
});

Deno.test("no refusal leaks an internal error to the caller", async () => {
  const res = await door.fetch(rpc("tools/list"));
  const text = await res.text();

  for (const leak of ["service_role", "SERVICE_ROLE", "at Object.", "    at ", "pg_"]) {
    assert(!text.includes(leak), `401 body must not contain ${leak}`);
  }
});

/**
 * The service-role prohibition, as a test rather than a promise.
 *
 * Comments are stripped before scanning, deliberately: index.ts names
 * `ctx.supabaseAdmin` in prose precisely in order to warn the next session off
 * it, and a test that forbade the warning would delete the warning. What is
 * forbidden is the key reaching the code — an env read, a literal, or an
 * access on the admin client the middleware puts within reach.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

Deno.test("no executable line reaches for the service-role key", async () => {
  const here = new URL(".", import.meta.url).pathname;
  const forbidden = ["SERVICE_ROLE", "service_role", "supabaseAdmin", "secretKey"];

  for await (const entry of Deno.readDir(here)) {
    if (!entry.isFile || !entry.name.endsWith(".ts")) continue;
    if (entry.name === "index.test.ts") continue;

    const code = stripComments(await Deno.readTextFile(`${here}${entry.name}`));
    for (const offender of forbidden) {
      assert(
        !code.includes(offender),
        `${entry.name} must not use ${offender}`,
      );
    }
  }
});

// -----------------------------------------------------------------------------
// EX-P02 / EX-P06 — the tool surface
// -----------------------------------------------------------------------------

Deno.test("the server is named by the contract", () => {
  const { client } = fakeClient(NOTHING);
  const server = buildServer(client, { id: "u", email: null });
  assert(server, "server built");
  assertEquals(SERVER_NAME, "buildgallery-mcp-server");
});

Deno.test("tools/list offers the six tools in the contract's order and nothing else", async () => {
  const tools = await listTools();
  assertEquals(tools.map((t) => t.name), TOOLS);
});

Deno.test("every tool carries the four annotations from the contract's table", async () => {
  const tools = await listTools();
  const readOnly = ["buildgallery_whoami", "buildgallery_list_drafts", "buildgallery_list_imports", "buildgallery_get_import_status"];

  for (const tool of tools) {
    const a = tool.annotations as Record<string, boolean>;
    assertEquals(a.readOnlyHint, readOnly.includes(tool.name as string), `${tool.name} readOnlyHint`);
    assertEquals(a.destructiveHint, false, `${tool.name} destructiveHint`);
    assertEquals(a.idempotentHint, true, `${tool.name} idempotentHint`);
    assertEquals(a.openWorldHint, false, `${tool.name} openWorldHint`);
  }
});

Deno.test("every description is under 1500 characters", async () => {
  for (const tool of await listTools()) {
    const description = tool.description as string;
    assert(description.length < 1500, `${tool.name} description is ${description.length} characters`);
  }
});

Deno.test("every EX-P06 description begins with the verbatim instruction, word for word", async () => {
  for (const tool of await listTools()) {
    if (tool.name === "buildgallery_whoami") continue;
    assert(
      (tool.description as string).startsWith(VERBATIM_INSTRUCTION),
      `${tool.name} must begin with the verbatim instruction`,
    );
  }
});

Deno.test("every tool declares an input schema and an output schema", async () => {
  for (const tool of await listTools()) {
    assert(tool.inputSchema, `${tool.name} has inputSchema`);
    assert(tool.outputSchema, `${tool.name} has outputSchema`);
    assertEquals((tool.inputSchema as { additionalProperties?: boolean }).additionalProperties, false, `${tool.name} is strict`);
  }
});

Deno.test("get_import_status is annotated with anthropic/maxResultSizeChars in tools/list", async () => {
  const tools = await listTools();
  const status = tools.find((t) => t.name === "buildgallery_get_import_status");
  assertEquals(status?._meta, { "anthropic/maxResultSizeChars": 20000 });
  for (const tool of tools) {
    if (tool.name !== "buildgallery_get_import_status") assertEquals(tool._meta, undefined);
  }
});

Deno.test("the server instructions carry the verbatim instruction", async () => {
  const { client } = fakeClient(NOTHING);
  const handler = createMcpHandler(() => buildServer(client, { id: "u", email: null }));
  const payload = await body(await handler.fetch(rpc("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  })));
  const result = payload.result as { instructions?: string };
  assertStringIncludes(result.instructions ?? "", VERBATIM_INSTRUCTION);
});

Deno.test("an argument the schema does not name is rejected, not silently accepted", async () => {
  const { payload, result, queries } = await call("buildgallery_begin_import", { title: "My build" });
  assert(payload.error !== undefined || result?.isError === true, "rejected");
  assertEquals(queries.length, 0, "nothing was written");
});

// -----------------------------------------------------------------------------
// EX-P04 — whoami reports the signed-in account
// -----------------------------------------------------------------------------

Deno.test("whoami returns the caller's id, email and display name", async () => {
  const { result } = await call("buildgallery_whoami", {}, () => ({
    data: { id: CALLER.id, display_name: "Mel Okafor", username: "mel" },
  }));
  const out = result!.structuredContent!;

  assertEquals(out.user_id, CALLER.id);
  assertEquals(out.email, CALLER.email);
  assertEquals(out.display_name, "Mel Okafor");
  assertEquals(out.connector, CONNECTOR_STATEMENT);

  // The same facts in the markdown face.
  assertStringIncludes(text(result), CALLER.id);
  assertStringIncludes(text(result), CALLER.email);
  assertStringIncludes(text(result), "Mel Okafor");
  assertStringIncludes(text(result), CONNECTOR_STATEMENT);
});

Deno.test("whoami reads named columns from the caller's own profile row", async () => {
  const { queries } = await call("buildgallery_whoami", {}, () => ({
    data: { id: CALLER.id, display_name: "Mel Okafor", username: "mel" },
  }));

  assertEquals(queries.length, 1);
  assertEquals(queries[0].table, "profiles");
  assertEquals(queries[0].columns, "display_name, username");
  assert(!queries[0].columns!.includes("*"), "never select('*')");
  assertEquals(queries[0].filters, [{ kind: "eq", column: "id", value: CALLER.id }]);
});

Deno.test("whoami falls back to username, then to null", async () => {
  const withUsername = await call("buildgallery_whoami", {}, () => ({
    data: { id: CALLER.id, display_name: null, username: "mel" },
  }));
  assertEquals(withUsername.result!.structuredContent!.display_name, "mel");

  const withNeither = await call("buildgallery_whoami", {}, () => ({ data: null }));
  assertEquals(withNeither.result!.structuredContent!.display_name, null);
});

Deno.test("whoami survives a token that carries no email", async () => {
  const { result } = await call(
    "buildgallery_whoami",
    {},
    () => ({ data: { id: CALLER.id, display_name: "Mel Okafor", username: "mel" } }),
    new FakeBucket(),
    { id: CALLER.id, email: null },
  );
  assertEquals(result!.structuredContent!.email, null);
});

// -----------------------------------------------------------------------------
// EX-P06 — begin_import
// -----------------------------------------------------------------------------

const created = { id: IMPORT_ID, target_build_id: null, created_at: "2026-09-17T11:00:00Z" };

Deno.test("begin_import opens an import for the caller and returns the handle and ceilings", async () => {
  const { result, queries } = await call(
    "buildgallery_begin_import",
    { client: "claude", declared_turns: 48, declared_chars: 212000, source_hint: "claude-export" },
    (q) => (q.op === "insert" ? { data: created } : { data: null }),
  );

  assertEquals(result?.isError, undefined);
  const out = result!.structuredContent!;
  assertEquals(out.import_id, IMPORT_ID);
  assertEquals(out.chunk_size_chars, CHUNK_SIZE_CHARS);
  assertEquals(out.max_total_chars, MAX_TOTAL_CHARS);
  assertEquals(out.target, null);
  assertEquals(out.reused, false);

  const instructions = out.instructions as string;
  assertStringIncludes(instructions, "verbatim");
  assertStringIncludes(instructions, "in order");
  assertStringIncludes(instructions, "message boundaries");
  assertStringIncludes(instructions, "from 1");
  assertStringIncludes(instructions, "buildgallery_finish_import");

  assertEquals(queries.length, 1);
  assertEquals(queries[0].table, "import_sessions");
  assertEquals(queries[0].op, "insert");
  assertEquals(queries[0].payload, {
    user_id: CALLER.id,
    client: "claude",
    source_hint: "claude-export",
    fingerprint: null,
    declared_turns: 48,
    declared_chars: 212000,
    target_build_id: null,
    status: "open",
  });
  assertEquals(queries[0].columns, "id, target_build_id, created_at");
});

Deno.test("begin_import maps a client outside the six the CHECK admits to unknown", async () => {
  const { queries } = await call(
    "buildgallery_begin_import",
    { client: "claude-desktop" },
    (q) => (q.op === "insert" ? { data: created } : { data: null }),
  );
  assertEquals(queries[0].payload!.client, "unknown");

  const absent = await call("buildgallery_begin_import", {}, (q) => (q.op === "insert" ? { data: created } : { data: null }));
  assertEquals(absent.queries[0].payload!.client, null);
});

Deno.test("begin_import returns the existing live import for the same fingerprint, and says so", async () => {
  const existing = { id: IMPORT_ID, target_build_id: null, created_at: "2026-09-17T10:00:00Z" };
  const { result, queries } = await call(
    "buildgallery_begin_import",
    { fingerprint: "conv-123" },
    (q) => (q.op === "select" && q.table === "import_sessions" ? { data: existing } : { data: null }),
  );

  const out = result!.structuredContent!;
  assertEquals(out.import_id, IMPORT_ID);
  assertEquals(out.reused, true);
  assertStringIncludes(text(result), "already open");
  assertStringIncludes(text(result), "2 hours ago");

  assertEquals(queries.length, 1, "no insert");
  assertEquals(queries[0].op, "select");
  assertEquals(queries[0].filters, [
    { kind: "eq", column: "fingerprint", value: "conv-123" },
    { kind: "in", column: "status", value: ["open", "assembling", "parsed"] },
  ]);
  assert(queries[0].filters.every((f) => f.column !== "user_id"), "ownership is RLS's job");
});

Deno.test("begin_import survives losing the race to the unique fingerprint index", async () => {
  let lookups = 0;
  const existing = { id: IMPORT_ID, target_build_id: null, created_at: "2026-09-17T11:59:00Z" };
  const { result, queries } = await call(
    "buildgallery_begin_import",
    { fingerprint: "conv-123" },
    (q) => {
      if (q.op === "insert") return { data: null, error: { code: "23505" } };
      lookups += 1;
      return { data: lookups === 1 ? null : existing };
    },
  );

  assertEquals(result!.structuredContent!.import_id, IMPORT_ID);
  assertEquals(result!.structuredContent!.reused, true);
  assertEquals(queries.map((q) => q.op), ["select", "insert", "select"]);
});

Deno.test("begin_import refuses a target that is not the caller's draft, and creates nothing", async () => {
  const { result, queries } = await call(
    "buildgallery_begin_import",
    { target_build_id: DRAFT_ID },
    () => ({ data: null }),
  );

  assertEquals(result?.isError, true);
  assertEquals(
    text(result),
    "No draft with that id belongs to this account. Call buildgallery_list_drafts to see the " +
      "available drafts, or omit target_build_id to create a new build.",
  );
  assertEquals(queries.length, 1);
  assertEquals(queries[0].table, "builds");
  assertEquals(queries[0].columns, "id, status");
  assertEquals(queries[0].filters, [
    { kind: "eq", column: "id", value: DRAFT_ID },
    { kind: "eq", column: "creator_id", value: CALLER.id },
  ]);
});

Deno.test("begin_import refuses a published target, and creates nothing", async () => {
  const { result, queries } = await call(
    "buildgallery_begin_import",
    { target_build_id: DRAFT_ID },
    (q) => (q.table === "builds" ? { data: { id: DRAFT_ID, status: "published" } } : { data: null }),
  );

  assertEquals(result?.isError, true);
  assertEquals(
    text(result),
    "That build is published, and the connector only adds to drafts. Choose a draft, or omit " +
      "target_build_id to create a new build.",
  );
  assertEquals(queries.length, 1, "no insert");
});

Deno.test("begin_import records a draft target and reports it", async () => {
  const { result, queries } = await call(
    "buildgallery_begin_import",
    { target_build_id: DRAFT_ID },
    (q) =>
      q.table === "builds"
        ? { data: { id: DRAFT_ID, status: "draft" } }
        : { data: { ...created, target_build_id: DRAFT_ID } },
  );

  assertEquals(result!.structuredContent!.target, DRAFT_ID);
  assertStringIncludes(result!.structuredContent!.instructions as string, DRAFT_ID);
  assertEquals(queries[1].op, "insert");
  assertEquals(queries[1].payload!.target_build_id, DRAFT_ID);
});

Deno.test("begin_import never lets a database message reach the caller", async () => {
  const { result } = await call(
    "buildgallery_begin_import",
    {},
    () => ({ data: null, error: { code: "42P01", message: 'relation "import_sessions" does not exist' } }),
  );
  assertEquals(result?.isError, true);
  assert(!text(result).includes("relation"), "no database message");
  assertStringIncludes(text(result), "buildgallery_begin_import");
});

// -----------------------------------------------------------------------------
// EX-P06 — append_chunk
// -----------------------------------------------------------------------------

/** Answers the row read and accepts the recount; the bucket does the rest. */
const openImport: Respond = (q) => {
  if (q.table === "import_sessions" && q.op === "select") return { data: importRow() };
  return { data: null };
};

Deno.test("append_chunk rejects a chunk over the limit with the table's wording, before touching anything", async () => {
  const { result, queries, bucket } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 7, text: "x".repeat(61_204) },
    openImport,
  );

  assertEquals(result?.isError, true);
  assertEquals(
    text(result),
    "Chunk 7 is 61,204 characters. The limit is 40,000. Split it at a message boundary and " +
      "resend as chunks 7 and 8, renumbering the rest.",
  );
  assertEquals(queries.length, 0);
  assertEquals(bucket.uploads.length, 0);
  assertEquals(MAX_CHUNK_CHARS, 40_000);
});

Deno.test("append_chunk rejects a total over the ceiling with the table's wording, and stores nothing", async () => {
  const bucket = new FakeBucket();
  bucket.seed(CALLER.id, IMPORT_ID, { 1: 395_000 });
  const { result } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 2, text: "y".repeat(36_000) },
    openImport,
    bucket,
  );

  assertEquals(result?.isError, true);
  assertEquals(
    text(result),
    "This import would reach 431,000 characters; the limit is 400,000. Send the remainder as a " +
      "second import, or ask the creator to export the conversation as a file and drop it on " +
      "agent-share-hub.lovable.app/compose/new, which has no such limit.",
  );
  assertEquals(bucket.uploads.length, 0);
  assertEquals(MAX_TOTAL_CHARS, 400_000);
});

Deno.test("append_chunk stores the chunk at {user_id}/{import_id}/{seq}.txt with upsert on", async () => {
  const marker = "THE-CREATOR-SAID-SOMETHING-PRIVATE";
  const chunk = `${marker} ${"z".repeat(1000)}`;
  const { result, queries, bucket } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 1, text: chunk },
    openImport,
  );

  assertEquals(result?.isError, undefined);
  assertEquals(bucket.uploads.length, 1);
  assertEquals(bucket.uploads[0].bucket, "imports");
  assertEquals(bucket.uploads[0].path, `${CALLER.id}/${IMPORT_ID}/1.txt`);
  assertEquals(bucket.uploads[0].options, { contentType: "text/plain", upsert: true });
  assertEquals(bucket.uploads[0].size, chunk.length);

  const out = result!.structuredContent!;
  assertEquals(out, { received: 1, chunk_chars: chunk.length, chunks_so_far: 1, chars_so_far: chunk.length });

  // The acknowledgement carries counts, never the text.
  assert(!text(result).includes(marker), "never echoes the text back");
  assert(!JSON.stringify(out).includes(marker), "never echoes the text back");
  for (const q of queries) assert(!JSON.stringify(q.payload ?? {}).includes(marker), "text never reaches the table");
});

Deno.test("append_chunk recounts from the bucket and writes the counts to the row", async () => {
  const bucket = new FakeBucket();
  bucket.seed(CALLER.id, IMPORT_ID, { 1: 24_000, 2: 24_000 });
  const { result, queries } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 3, text: "w".repeat(10_000) },
    openImport,
    bucket,
  );

  assertEquals(result!.structuredContent, { received: 3, chunk_chars: 10_000, chunks_so_far: 3, chars_so_far: 58_000 });
  assertStringIncludes(text(result), "3 chunks, 58,000 characters so far");

  const update = queries.find((q) => q.op === "update")!;
  assertEquals(update.table, "import_sessions");
  assertEquals(update.filters, [{ kind: "eq", column: "id", value: IMPORT_ID }]);
  assertEquals(update.payload!.chunk_count, 3);
  assertEquals(update.payload!.total_chars, 58_000);
  assertEquals(update.payload!.updated_at, new Date(NOW).toISOString());
  assert(update.filters.every((f) => f.column !== "user_id"), "ownership is RLS's job");

  // The listing named the caller's own folder, exactly.
  assert(bucket.lists.every((l) => l.prefix === `${CALLER.id}/${IMPORT_ID}` && l.bucket === "imports"));
});

Deno.test("append_chunk retried with the same seq lands in the same slot and counts once", async () => {
  const bucket = new FakeBucket();
  bucket.seed(CALLER.id, IMPORT_ID, { 1: 24_000, 2: 24_000, 3: 10_000 });
  const { result } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 3, text: "w".repeat(12_000) },
    openImport,
    bucket,
  );

  assertEquals(result!.structuredContent, { received: 3, chunk_chars: 12_000, chunks_so_far: 3, chars_so_far: 60_000 });
  assertEquals(bucket.objects.size, 3);
});

Deno.test("append_chunk counts a replaced slot once when checking the ceiling", async () => {
  const bucket = new FakeBucket();
  bucket.seed(CALLER.id, IMPORT_ID, { 1: 380_000, 2: 20_000 });
  const { result } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 2, text: "v".repeat(20_000) },
    openImport,
    bucket,
  );
  assertEquals(result?.isError, undefined, "a resend of chunk 2 is not counted twice");
});

Deno.test("append_chunk on an import the caller cannot see is 'not found', not a database error", async () => {
  const { result, bucket } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 1, text: "hello" },
    () => ({ data: null }),
  );
  assertEquals(result?.isError, true);
  assertEquals(
    text(result),
    "No import with that id belongs to this account. Call buildgallery_list_imports to find it, " +
      "or buildgallery_begin_import to open a new one.",
  );
  assertEquals(bucket.uploads.length, 0);
});

Deno.test("append_chunk refuses an import that is no longer open", async () => {
  const { result, bucket } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 1, text: "hello" },
    () => ({ data: importRow({ status: "parsed" }) }),
  );
  assertEquals(result?.isError, true);
  assertEquals(
    text(result),
    `Import ${IMPORT_ID} is parsed, so it no longer accepts chunks. Call buildgallery_begin_import to open a new one.`,
  );
  assertEquals(bucket.uploads.length, 0);
});

Deno.test("append_chunk reports a failed upload in the table's shape, with no internal detail", async () => {
  const bucket = new FakeBucket();
  bucket.failUpload = true;
  const { result, queries } = await call(
    "buildgallery_append_chunk",
    { import_id: IMPORT_ID, seq: 4, text: "hello" },
    openImport,
    bucket,
  );
  assertEquals(result?.isError, true);
  assertEquals(text(result), "Chunk 4 could not be stored. Nothing was changed; resend chunk 4.");
  assertEquals(queries.filter((q) => q.op === "update").length, 0);
});

Deno.test("append_chunk rejects a seq below 1 and a missing text", async () => {
  const zero = await call("buildgallery_append_chunk", { import_id: IMPORT_ID, seq: 0, text: "a" }, openImport);
  assert(zero.payload.error !== undefined || zero.result?.isError === true);
  assertEquals(zero.bucket.uploads.length, 0);

  const none = await call("buildgallery_append_chunk", { import_id: IMPORT_ID, seq: 1 }, openImport);
  assert(none.payload.error !== undefined || none.result?.isError === true);
});

// -----------------------------------------------------------------------------
// EX-P06 — get_import_status
// -----------------------------------------------------------------------------

Deno.test("get_import_status reports counts, declared counts, target and the missing sequence numbers", async () => {
  const bucket = new FakeBucket();
  bucket.seed(CALLER.id, IMPORT_ID, { 1: 24_000, 2: 24_000, 4: 24_000 });
  const { result, queries } = await call(
    "buildgallery_get_import_status",
    { import_id: IMPORT_ID },
    () => ({ data: importRow({ chunk_count: 3, total_chars: 72_000, target_build_id: DRAFT_ID }) }),
    bucket,
  );

  assertEquals(result?.isError, undefined);
  const out = result!.structuredContent!;
  assertEquals(out.status, "open");
  assertEquals(out.chunk_count, 3);
  assertEquals(out.total_chars, 72_000);
  assertEquals(out.declared_turns, 48);
  assertEquals(out.declared_chars, 212_000);
  assertEquals(out.missing_chunks, [3]);
  assertEquals(out.target, DRAFT_ID);
  assertEquals(out.proposal, null);

  assertStringIncludes(text(result), "Missing chunks**: 3");
  assertStringIncludes(text(result), `draft ${DRAFT_ID}`);

  // The read names its columns and lifts only counts out of the proposal.
  assertEquals(queries.length, 1);
  const columns = queries[0].columns!;
  assert(!columns.includes("*"), "never select('*')");
  assert(!/\bproposal\s*,/.test(columns) && !/\bproposal$/.test(columns), "never the whole proposal");
  assertStringIncludes(columns, "proposal->summary->event_count");
});

Deno.test("get_import_status measures gaps against the declared chunk count when there is one", async () => {
  const bucket = new FakeBucket();
  bucket.seed(CALLER.id, IMPORT_ID, { 1: 10, 2: 10, 4: 10 });
  const { result } = await call(
    "buildgallery_get_import_status",
    { import_id: IMPORT_ID },
    () => ({ data: importRow({ expected_chunks: 6 }) }),
    bucket,
  );
  assertEquals(result!.structuredContent!.missing_chunks, [3, 5, 6]);
});

Deno.test("get_import_status returns the proposal's counts once parsed, and never its content", async () => {
  const { result, bucket } = await call(
    "buildgallery_get_import_status",
    { import_id: IMPORT_ID },
    () => ({
      data: importRow({
        status: "parsed",
        chunk_count: 9,
        total_chars: 212_000,
        turn_count: 48,
        event_count: 31,
        node_count: 6,
      }),
    }),
  );

  const out = result!.structuredContent!;
  assertEquals(out.proposal, { turn_count: 48, event_count: 31, node_count: 6 });
  assertEquals(out.missing_chunks, []);
  assertStringIncludes(text(result), "31 events, 6 parts from 48 turns");
  assertEquals(bucket.lists.length, 0, "a parsed import's folder is not listed");
});

Deno.test("get_import_status on an import the caller cannot see is 'not found'", async () => {
  const { result } = await call("buildgallery_get_import_status", { import_id: IMPORT_ID }, () => ({ data: null }));
  assertEquals(result?.isError, true);
  assertStringIncludes(text(result), "No import with that id belongs to this account.");
});

// -----------------------------------------------------------------------------
// EX-P06 — list_imports
// -----------------------------------------------------------------------------

function importListRow(n: number): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    status: n % 2 ? "open" : "parsed",
    client: "claude",
    chunk_count: n,
    total_chars: n * 1000,
    declared_turns: null,
    declared_chars: null,
    target_build_id: null,
    created_at: "2026-09-17T09:00:00Z",
    expires_at: "2026-09-24T09:00:00Z",
  };
}

Deno.test("list_imports pages the caller's imports newest first with exact pagination fields", async () => {
  const rows = Array.from({ length: 20 }, (_, i) => importListRow(i + 1));
  const { result, queries } = await call("buildgallery_list_imports", {}, () => ({ data: rows, count: 45 }));

  assertEquals(result?.isError, undefined);
  const out = result!.structuredContent!;
  assertEquals(out.total_count, 45);
  assertEquals(out.has_more, true);
  assertEquals(out.next_offset, 20);
  assertEquals(out.count, 20);
  assertEquals(out.offset, 0);
  const first = (out.imports as Array<Record<string, unknown>>)[0];
  assertEquals(Object.keys(first).sort(), [
    "chunk_count", "client", "created_at", "declared_chars", "declared_turns",
    "expires_at", "id", "status", "target", "total_chars",
  ]);

  assertEquals(queries.length, 1);
  const q = queries[0];
  assertEquals(q.table, "import_sessions");
  assert(!q.columns!.includes("*"), "never select('*')");
  assert(!q.columns!.includes("proposal"), "never the proposal");
  assertEquals(q.options, { count: "exact" });
  assertEquals(q.order, { column: "created_at", ascending: false });
  assertEquals(q.range, [0, DEFAULT_PAGE_SIZE - 1]);
  assertEquals(q.limit, DEFAULT_PAGE_SIZE);
  assertEquals(q.filters, [], "ownership is RLS's job");

  assertStringIncludes(text(result), "Your imports (20 of 45)");
  assertStringIncludes(text(result), `(${rows[0].id})`);
  assertStringIncludes(text(result), "pass offset 20");
});

Deno.test("list_imports honours limit and offset, caps limit at the maximum, and closes the last page", async () => {
  const rows = Array.from({ length: 5 }, (_, i) => importListRow(i + 41));
  const last = await call("buildgallery_list_imports", { limit: 50, offset: 40 }, () => ({ data: rows, count: 45 }));
  assertEquals(last.queries[0].range, [40, 89]);
  assertEquals(last.queries[0].limit, MAX_PAGE_SIZE);
  assertEquals(last.result!.structuredContent!.has_more, false);
  assertEquals(last.result!.structuredContent!.next_offset, null);

  const over = await call("buildgallery_list_imports", { limit: MAX_PAGE_SIZE + 1 }, () => ({ data: [], count: 0 }));
  assert(over.payload.error !== undefined || over.result?.isError === true, "over the maximum is rejected");
  assertEquals(over.queries.length, 0);
});

Deno.test("list_imports in json format returns the structured object as text", async () => {
  const rows = [importListRow(1)];
  const { result } = await call("buildgallery_list_imports", { response_format: "json" }, () => ({ data: rows, count: 1 }));
  assertEquals(JSON.parse(text(result)), result!.structuredContent);
});

Deno.test("list_imports with nothing to list says so", async () => {
  const { result } = await call("buildgallery_list_imports", {}, () => ({ data: [], count: 0 }));
  assertEquals(result!.structuredContent!.total_count, 0);
  assertStringIncludes(text(result), "No imports yet");
});

// -----------------------------------------------------------------------------
// EX-P06 — list_drafts
// -----------------------------------------------------------------------------

Deno.test("list_drafts reads the caller's own drafts through their own client, newest work first", async () => {
  const rows = [
    { id: DRAFT_ID, title: "Invoice chaser agent", updated_at: "2026-09-17T09:00:00Z", build_nodes: [{ count: 4 }] },
    { id: IMPORT_ID, title: "Untitled", updated_at: "2026-09-10T09:00:00Z", build_nodes: [{ count: 0 }] },
  ];
  const { result, queries } = await call("buildgallery_list_drafts", {}, () => ({ data: rows, count: 2 }));

  assertEquals(result?.isError, undefined);
  const out = result!.structuredContent!;
  assertEquals(out.drafts, [
    { id: DRAFT_ID, title: "Invoice chaser agent", last_touched: "2026-09-17T09:00:00Z", part_count: 4 },
    { id: IMPORT_ID, title: "Untitled", last_touched: "2026-09-10T09:00:00Z", part_count: 0 },
  ]);
  assertEquals(out.total_count, 2);
  assertEquals(out.has_more, false);
  assertEquals(out.next_offset, null);

  assertEquals(queries.length, 1);
  const q = queries[0];
  assertEquals(q.table, "builds");
  assertEquals(q.columns, "id, title, updated_at, build_nodes(count)");
  assertEquals(q.options, { count: "exact" });
  assertEquals(q.filters, [
    { kind: "eq", column: "creator_id", value: CALLER.id },
    { kind: "eq", column: "status", value: "draft" },
  ]);
  assertEquals(q.order, { column: "updated_at", ascending: false });
  assertEquals(q.range, [0, DEFAULT_PAGE_SIZE - 1]);
  assertEquals(q.limit, DEFAULT_PAGE_SIZE);

  assertStringIncludes(text(result), `**Invoice chaser agent** (${DRAFT_ID}) — last touched 3 hours ago, 4 parts`);
  assertStringIncludes(text(result), "last touched 10 Sep, 0 parts");
});

Deno.test("list_drafts pages like list_imports and rejects a limit over the maximum", async () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    title: `Draft ${i}`,
    updated_at: "2026-09-17T09:00:00Z",
    build_nodes: [{ count: i }],
  }));
  const { result, queries } = await call("buildgallery_list_drafts", { limit: 20, offset: 20 }, () => ({ data: rows, count: 41 }));
  assertEquals(queries[0].range, [20, 39]);
  assertEquals(result!.structuredContent!.has_more, true);
  assertEquals(result!.structuredContent!.next_offset, 40);

  const over = await call("buildgallery_list_drafts", { limit: MAX_PAGE_SIZE + 1 }, () => ({ data: [], count: 0 }));
  assert(over.payload.error !== undefined || over.result?.isError === true);
});

Deno.test("list_drafts in json format returns the structured object as text", async () => {
  const rows = [{ id: DRAFT_ID, title: "Invoice chaser agent", updated_at: "2026-09-17T09:00:00Z", build_nodes: [{ count: 4 }] }];
  const { result } = await call("buildgallery_list_drafts", { response_format: "json" }, () => ({ data: rows, count: 1 }));
  assertEquals(JSON.parse(text(result)), result!.structuredContent);
});

Deno.test("list tools report a database failure in the table's shape, with no internal detail", async () => {
  for (const name of ["buildgallery_list_drafts", "buildgallery_list_imports"]) {
    const { result } = await call(name, {}, () => ({ data: null, error: { code: "42501", message: "permission denied for table builds" } }));
    assertEquals(result?.isError, true, name);
    assertEquals(text(result), "The list could not be read. Nothing was changed; call the tool again.");
  }
});

// -----------------------------------------------------------------------------
// EX-P06 — human-readable time
// -----------------------------------------------------------------------------

Deno.test("humanTime writes timestamps the way the contract asks", () => {
  assertEquals(humanTime("2026-09-17T11:59:40Z", NOW), "just now");
  assertEquals(humanTime("2026-09-17T11:57:00Z", NOW), "3 minutes ago");
  assertEquals(humanTime("2026-09-17T11:59:00Z", NOW), "1 minute ago");
  assertEquals(humanTime("2026-09-17T09:00:00Z", NOW), "3 hours ago");
  assertEquals(humanTime("2026-09-16T11:00:00Z", NOW), "yesterday");
  assertEquals(humanTime("2026-09-12T10:00:00Z", NOW), "12 Sep");
  assertEquals(humanTime("2025-12-01T10:00:00Z", NOW), "1 Dec 2025");
  assertEquals(humanTime("2026-09-24T10:00:00Z", NOW), "24 Sep");
  assertEquals(humanTime("not a date", NOW), "unknown");
});
