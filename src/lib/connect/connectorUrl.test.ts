// CA-29 Part 7. The connector's address is built in one place, from the project's
// own URL, and the Connect page imports it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CLAUDE_CODE_COMMAND, CONNECTOR_URL } from "@/lib/connect/connector";

describe("CA-29 P7: the connector address", () => {
  it("is the project's functions address, from VITE_SUPABASE_URL", () => {
    const base = String(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, "");
    expect(base).toMatch(/^https:\/\//);
    expect(CONNECTOR_URL).toBe(`${base}/functions/v1/mcp`);
    expect(CLAUDE_CODE_COMMAND).toBe(`claude mcp add --transport http buildgallery ${CONNECTOR_URL}`);
  });

  it("is written out nowhere else in src", () => {
    const connect = readFileSync("src/pages/Connect.tsx", "utf8");
    expect(connect).not.toMatch(/supabase\.co\/functions/);
    expect(connect).toMatch(/from "@\/lib\/connect\/connector"/);
    expect(readFileSync("src/lib/connect/connector.ts", "utf8")).not.toMatch(/supabase\.co/);
  });
});
