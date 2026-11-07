// UX-14 P4. The connector's tools are named openbuilds_*, exactly these seven. The connector's own tests run under Deno,
// which the repo's Vitest run does not have, so this reads the source: a later edit cannot rename or drop a tool by accident.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MCP = "supabase/functions/mcp";
const TOOLS = [
  "openbuilds_append_chunk",
  "openbuilds_begin_import",
  "openbuilds_finish_import",
  "openbuilds_get_import_status",
  "openbuilds_list_drafts",
  "openbuilds_list_imports",
  "openbuilds_whoami",
];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
}

describe("UX-14 P4 · the connector's tool names", () => {
  it("registers exactly the seven openbuilds_ tools", () => {
    const source = readFileSync(join(MCP, "index.ts"), "utf8");
    const registered = [...source.matchAll(/server\.registerTool\(\s*"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(registered).toEqual(TOOLS);
  });

  it("names itself openbuilds-mcp-server", () => {
    const constants = readFileSync(join(MCP, "constants.ts"), "utf8");
    expect(constants).toContain('export const SERVER_NAME = "openbuilds-mcp-server";');
  });

  it("leaves no buildgallery_ tool name in supabase/ or src/", () => {
    const old = /buildgallery_(begin_import|append_chunk|finish_import|get_import_status|list_drafts|list_imports|whoami)/;
    const hits = [...walk("supabase"), ...walk("src")]
      .filter((f) => /\.(ts|tsx|md|json)$/.test(f) && f !== join("src", "test", "connectorTools.test.ts"))
      .filter((f) => old.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
});
