// =============================================================================
// buildgallery — mcp tests (EX-P02 the door, EX-P04 the lock)
// =============================================================================
// Run with:
//   SUPABASE_FUNCTION_SLUG=mcp \
//   SUPABASE_URL=https://zybdotagjwektucfdkri.supabase.co \
//   SUPABASE_ANON_KEY=test SUPABASE_PUBLISHABLE_KEY=sb_publishable_test \
//   deno test --allow-net --allow-env --allow-read supabase/functions/mcp/
//
// No Supabase is running and none is needed. The gate is exercised through the
// real pipeline — a request with no token really is refused by the real
// middleware — and the tool is exercised against a stub client that records
// what it was asked for, so "named columns, never select('*')" is a test
// rather than a promise.
//
// SUPABASE_FUNCTION_SLUG is set because the platform sets it: it is what makes
// withOAuthProtectedResource derive /functions/v1/mcp rather than falling back
// to composing a path from the request, which doubles the prefix. Testing
// without it would prove the wrong branch.
// =============================================================================

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";

import door, { buildServer } from "./index.ts";
import type { CallerClient, CallerIdentity } from "./index.ts";
import { CONNECTOR_STATEMENT, SERVER_NAME } from "./constants.ts";
import { createMcpHandler } from "@modelcontextprotocol/server";

const PROJECT = "https://zybdotagjwektucfdkri.supabase.co";
const ENDPOINT = `${PROJECT}/functions/v1/mcp`;
const RESOURCE = `${PROJECT}/functions/v1/mcp`;

// -----------------------------------------------------------------------------
// Helpers
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

/** One recorded database read: which table, which columns, which row. */
interface ProfileRead {
  table: string;
  columns: string;
  column: string;
  value: unknown;
}

/** Records what the tool asked the database for, and answers with one row. */
function stubClient(row: Record<string, unknown> | null): {
  client: CallerClient;
  calls: ProfileRead[];
} {
  const calls: ProfileRead[] = [];

  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              return {
                maybeSingle() {
                  calls.push({ table, columns, column, value });
                  return Promise.resolve({ data: row, error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  return { client: client as unknown as CallerClient, calls };
}

async function callWhoami(
  row: Record<string, unknown> | null,
  caller: CallerIdentity,
) {
  const { client, calls } = stubClient(row);
  const handler = createMcpHandler(() => buildServer(client, caller));
  const res = await handler.fetch(
    rpc("tools/call", { name: "buildgallery_whoami", arguments: {} }),
  );
  const payload = await body(res);
  return { res, payload, calls };
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
// EX-P02 — the tool surface
// -----------------------------------------------------------------------------

Deno.test("the server is named by the contract", () => {
  const { client } = stubClient(null);
  const server = buildServer(client, { id: "u", email: null });
  assert(server, "server built");
  assertEquals(SERVER_NAME, "buildgallery-mcp-server");
});

Deno.test("tools/list offers buildgallery_whoami and nothing else", async () => {
  const { client } = stubClient(null);
  const handler = createMcpHandler(() => buildServer(client, { id: "u", email: null }));
  const payload = await body(await handler.fetch(rpc("tools/list")));
  const result = payload.result as { tools: Array<Record<string, unknown>> };

  assertEquals(result.tools.map((t) => t.name), ["buildgallery_whoami"]);
});

Deno.test("buildgallery_whoami carries all four annotations", async () => {
  const { client } = stubClient(null);
  const handler = createMcpHandler(() => buildServer(client, { id: "u", email: null }));
  const payload = await body(await handler.fetch(rpc("tools/list")));
  const result = payload.result as { tools: Array<Record<string, unknown>> };
  const annotations = result.tools[0].annotations as Record<string, boolean>;

  assertEquals(annotations.readOnlyHint, true);
  assertEquals(annotations.destructiveHint, false);
  assertEquals(annotations.idempotentHint, true);
  assertEquals(annotations.openWorldHint, false);
});

Deno.test("buildgallery_whoami describes itself in under 1500 characters", async () => {
  const { client } = stubClient(null);
  const handler = createMcpHandler(() => buildServer(client, { id: "u", email: null }));
  const payload = await body(await handler.fetch(rpc("tools/list")));
  const result = payload.result as { tools: Array<{ description: string }> };

  assert(
    result.tools[0].description.length < 1500,
    `description is ${result.tools[0].description.length} characters`,
  );
});

// -----------------------------------------------------------------------------
// EX-P04 — whoami reports the signed-in account
// -----------------------------------------------------------------------------

const CALLER = { id: "3f6c1e02-9b1a-4f7d-8d02-1c2f5a9e77b4", email: "mel@example.com" };

Deno.test("whoami returns the caller's id, email and display name", async () => {
  const { payload } = await callWhoami(
    { id: CALLER.id, display_name: "Mel Okafor", username: "mel" },
    CALLER,
  );
  const result = payload.result as {
    structuredContent: Record<string, unknown>;
    content: Array<{ text: string }>;
  };

  assertEquals(result.structuredContent.user_id, CALLER.id);
  assertEquals(result.structuredContent.email, CALLER.email);
  assertEquals(result.structuredContent.display_name, "Mel Okafor");
  assertEquals(result.structuredContent.connector, CONNECTOR_STATEMENT);

  // The same facts in the markdown face.
  assertStringIncludes(result.content[0].text, CALLER.id);
  assertStringIncludes(result.content[0].text, CALLER.email);
  assertStringIncludes(result.content[0].text, "Mel Okafor");
  assertStringIncludes(result.content[0].text, CONNECTOR_STATEMENT);
});

Deno.test("whoami reads named columns from the caller's own profile row", async () => {
  const { calls } = await callWhoami(
    { id: CALLER.id, display_name: "Mel Okafor", username: "mel" },
    CALLER,
  );

  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "profiles");
  assertEquals(calls[0].columns, "display_name, username");
  assert(!calls[0].columns.includes("*"), "never select('*')");
  assertEquals(calls[0].column, "id");
  assertEquals(calls[0].value, CALLER.id);
});

Deno.test("whoami falls back to username, then to null", async () => {
  const withUsername = await callWhoami(
    { id: CALLER.id, display_name: null, username: "mel" },
    CALLER,
  );
  assertEquals(
    (withUsername.payload.result as { structuredContent: Record<string, unknown> })
      .structuredContent.display_name,
    "mel",
  );

  const withNeither = await callWhoami(null, CALLER);
  assertEquals(
    (withNeither.payload.result as { structuredContent: Record<string, unknown> })
      .structuredContent.display_name,
    null,
  );
});

Deno.test("whoami survives a token that carries no email", async () => {
  const { payload } = await callWhoami(
    { id: CALLER.id, display_name: "Mel Okafor", username: "mel" },
    { id: CALLER.id, email: null },
  );
  const result = payload.result as { structuredContent: Record<string, unknown> };

  assertEquals(result.structuredContent.email, null);
});
