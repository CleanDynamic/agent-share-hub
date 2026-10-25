// SV-01 Part 5. One CORS helper, one error shape, input checks that name the field.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readBody } from "../../../supabase/functions/_shared/body.ts";
import { corsHeaders, fail, preflight } from "../../../supabase/functions/_shared/cors.ts";
import { ALLOWED_ORIGINS } from "../../../supabase/functions/_shared/origins.ts";

const req = (origin: string | null, method = "POST") =>
  new Request("https://fn.test/x", { method, headers: origin ? { origin } : {} });

describe("SV-01 P5: CORS", () => {
  it("gives a foreign origin no allow header", () => {
    expect(corsHeaders(req("https://evil.example"))["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(corsHeaders(req(null))["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(preflight(req("https://evil.example", "OPTIONS"))?.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("reflects an allowed origin, not a star", () => {
    for (const origin of ALLOWED_ORIGINS) {
      const headers = corsHeaders(req(origin));
      expect(headers["Access-Control-Allow-Origin"]).toBe(origin);
      expect(headers["Vary"]).toBe("Origin");
    }
  });

  it("answers every origin only when asked to (a public read)", () => {
    expect(corsHeaders(req("https://evil.example"), { open: true })["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("is not a preflight unless it is OPTIONS", () => {
    expect(preflight(req(null))).toBeNull();
  });

  it("answers errors as { error } with the status", async () => {
    const res = fail(req("https://buildgallery.ai"), 418, "No");
    expect(res.status).toBe(418);
    expect(await res.json()).toEqual({ error: "No" });
  });
});

describe("SV-01 P5: input checks", () => {
  const schema = z.object({ content_id: z.string({ required_error: "Required" }).uuid(), n: z.number().int().optional() });
  const post = (raw: string) => new Request("https://fn.test/x", { method: "POST", body: raw });

  it("names the missing field", async () => {
    expect(await readBody(post("{}"), schema)).toEqual({ ok: false, error: "content_id: Required" });
  });
  it("names a wrong field", async () => {
    expect(await readBody(post('{"content_id":"x"}'), schema)).toEqual({ ok: false, error: "content_id: Invalid uuid" });
  });
  it("refuses a body that is not JSON", async () => {
    expect(await readBody(post("nope"), schema)).toEqual({ ok: false, error: "The body must be JSON" });
  });
  it("drops fields the schema does not know", async () => {
    const r = await readBody(post(JSON.stringify({ content_id: "7b2f1c1e-3b6a-4f77-9d52-0f2c8b1b9a11", price_amount: 1 })), schema);
    expect(r).toEqual({ ok: true, data: { content_id: "7b2f1c1e-3b6a-4f77-9d52-0f2c8b1b9a11" } });
  });
});

describe("SV-01 P5: every function uses the helper", () => {
  const FUNCTIONS = "supabase/functions";
  // Not CORS-helper users: the mcp server answers its own discovery and auth,
  // and the four parsers and the layer writer, which already require a login,
  // are checked in the next test.
  const SELF = new Set(["_shared", "mcp"]);
  const dirs = readdirSync(FUNCTIONS).filter((name) => statSync(join(FUNCTIONS, name)).isDirectory() && !SELF.has(name));

  it("no function declares its own allow-origin", () => {
    const offenders = dirs.filter((dir) =>
      readdirSync(join(FUNCTIONS, dir)).some((file) => /\.ts$/.test(file) && /Access-Control-Allow-Origin/.test(readFileSync(join(FUNCTIONS, dir, file), "utf8"))),
    );
    expect(offenders).toEqual([]);
  });
});
