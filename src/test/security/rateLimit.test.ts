// G10: the durable per-IP limit, as the edge functions call it. The database is faked (the `hit` seam); what is claimed
// is which address is counted, that no raw address is stored, and what a caller over the limit gets.

import { describe, expect, it, vi } from "vitest";

import { bucketFor, clientIp, limitByIp } from "../../../supabase/functions/_shared/rateLimit.ts";

const request = (headers: Record<string, string>) => new Request("https://fn.test/x", { method: "POST", headers: { origin: "https://openbuilds.ai", ...headers } });

describe("clientIp", () => {
  it("prefers Cloudflare's address, then x-real-ip, then the first x-forwarded-for entry", () => {
    expect(clientIp(request({ "cf-connecting-ip": "203.0.113.1", "x-real-ip": "203.0.113.2", "x-forwarded-for": "203.0.113.3" }))).toBe("203.0.113.1");
    expect(clientIp(request({ "x-real-ip": "203.0.113.2", "x-forwarded-for": "203.0.113.3" }))).toBe("203.0.113.2");
    expect(clientIp(request({ "x-forwarded-for": " 203.0.113.3 , 10.0.0.1" }))).toBe("203.0.113.3");
    expect(clientIp(request({}))).toBe("unknown");
  });

  it("caps what it reads, so a long header is not a long key", () => {
    expect(clientIp(request({ "x-forwarded-for": "a".repeat(500) })).length).toBeLessThanOrEqual(64);
  });
});

describe("bucketFor", () => {
  it("names the function and a hash of the address, never the address", async () => {
    const bucket = await bucketFor("import-github-readme", "203.0.113.1");
    expect(bucket).toMatch(/^import-github-readme:[0-9a-f]{64}$/);
    expect(bucket).not.toContain("203.0.113.1");
    expect(await bucketFor("import-github-readme", "203.0.113.1")).toBe(bucket);
    expect(await bucketFor("generate-ai-pdf", "203.0.113.1")).not.toBe(bucket);
  });
});

describe("limitByIp", () => {
  const rule = { limit: 3, windowSeconds: 600 };

  it("lets a caller under the limit through", async () => {
    const hit = vi.fn(async () => true);
    await expect(limitByIp(request({ "cf-connecting-ip": "203.0.113.1" }), "fn", rule, { hit })).resolves.toBeNull();
    expect(hit).toHaveBeenCalledWith(expect.stringMatching(/^fn:[0-9a-f]{64}$/), 3, 600);
  });

  it("answers a caller over the limit 429, in the one error shape, with Retry-After and the site's CORS", async () => {
    const res = await limitByIp(request({ "cf-connecting-ip": "203.0.113.1" }), "fn", rule, { hit: async () => false });
    expect(res!.status).toBe(429);
    expect(await res!.json()).toEqual({ error: "Too many requests. Try again later." });
    expect(res!.headers.get("Retry-After")).toBe("600");
    expect(res!.headers.get("Access-Control-Allow-Origin")).toBe("https://openbuilds.ai");
  });

  it("lets the call through and logs, without the address, when the store cannot answer", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await limitByIp(request({ "cf-connecting-ip": "203.0.113.1" }), "fn", rule, { hit: async () => { throw new Error("db down"); } });
    expect(res).toBeNull();
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain("203.0.113.1");
    error.mockRestore();
  });
});
