// =============================================================================
// buildgallery — mcp tests (EX-P02)
// =============================================================================
// Run with: deno test --allow-net supabase/functions/mcp/
//
// These exercise the handler directly through its fetch face. No Supabase is
// running, and none is needed: the door's own behaviour is what is under test.
// =============================================================================

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";

import door, { buildServer } from "./index.ts";
import { CONNECTOR_STATEMENT, SERVER_NAME } from "./constants.ts";

const ENDPOINT = "https://zybdotagjwektucfdkri.supabase.co/functions/v1/mcp";

function rpc(method: string, params: Record<string, unknown> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}

async function body(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  // A streamable-HTTP response may arrive as SSE; take the last data frame.
  if (text.startsWith("event:") || text.includes("\ndata: ")) {
    const frames = text.split("\n").filter((l) => l.startsWith("data: "));
    return JSON.parse(frames[frames.length - 1].slice(6));
  }
  return JSON.parse(text);
}

Deno.test("the server is named by the contract", () => {
  const server = buildServer();
  assert(server, "server built");
  assertEquals(SERVER_NAME, "buildgallery-mcp-server");
});

Deno.test("tools/list offers buildgallery_whoami and nothing else", async () => {
  const res = await door.fetch(rpc("tools/list"));
  assertEquals(res.status, 200);

  const payload = await body(res);
  const result = payload.result as { tools: Array<Record<string, unknown>> };
  const names = result.tools.map((t) => t.name);

  assertEquals(names, ["buildgallery_whoami"]);
});

Deno.test("buildgallery_whoami carries all four annotations", async () => {
  const res = await door.fetch(rpc("tools/list"));
  const payload = await body(res);
  const result = payload.result as { tools: Array<Record<string, unknown>> };
  const whoami = result.tools[0];
  const annotations = whoami.annotations as Record<string, boolean>;

  assertEquals(annotations.readOnlyHint, true);
  assertEquals(annotations.destructiveHint, false);
  assertEquals(annotations.idempotentHint, true);
  assertEquals(annotations.openWorldHint, false);
});

Deno.test("buildgallery_whoami states what the connector cannot do", async () => {
  const res = await door.fetch(
    rpc("tools/call", { name: "buildgallery_whoami", arguments: {} }),
  );
  assertEquals(res.status, 200);

  const payload = await body(res);
  const result = payload.result as {
    structuredContent: { authenticated: boolean; connector: string };
    content: Array<{ type: string; text: string }>;
  };

  assertEquals(result.structuredContent.authenticated, false);
  assertEquals(result.structuredContent.connector, CONNECTOR_STATEMENT);
  assert(
    result.content[0].text.includes(CONNECTOR_STATEMENT),
    "the markdown text carries the statement too",
  );
});
