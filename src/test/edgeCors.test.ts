// CA-29 Parts 3 and 5. The origins an edge function answers, and the return
// addresses a checkout accepts, come from one constant in _shared/origins.ts.

import { describe, expect, it } from "vitest";
import { corsHeaders, preflight } from "../../supabase/functions/_shared/cors";
import { fieldError, jsonResponse } from "../../supabase/functions/_shared/http";
import { ALLOWED_ORIGINS, isAllowedReturnUrl } from "../../supabase/functions/_shared/origins";

const call = (origin?: string, method = "POST") => new Request("https://project.supabase.co/functions/v1/x", { method, headers: origin ? { origin } : {} });

describe("CA-29 P5: one CORS helper", () => {
  it("reflects an allowed origin and says the answer varies by origin", () => {
    const headers = corsHeaders(call("https://buildgallery.ai"));
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://buildgallery.ai");
    expect(headers["Vary"]).toContain("Origin");
  });

  it("gives a foreign origin no allow header", () => {
    for (const origin of ["https://evil.example", "https://buildgallery.ai.evil.example", "http://buildgallery.ai", "null"]) {
      const headers = corsHeaders(call(origin));
      expect(headers["Access-Control-Allow-Origin"], origin).toBeUndefined();
    }
  });

  it("gives a call with no origin no allow header", () => {
    expect(corsHeaders(call())["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("answers every origin only when the function is public", () => {
    expect(corsHeaders(call("https://evil.example"), { open: true })["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("answers a preflight from a foreign origin without an allow header", () => {
    const response = preflight(call("https://evil.example", "OPTIONS"));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const allowed = preflight(call("http://localhost:8080", "OPTIONS"));
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8080");
  });
});

describe("CA-29 P3: return addresses", () => {
  it("lists the site, the Lovable preview and published hosts and localhost, and no wildcard", () => {
    expect(ALLOWED_ORIGINS).toContain("https://buildgallery.ai");
    expect(ALLOWED_ORIGINS).toContain("http://localhost:8080");
    expect(ALLOWED_ORIGINS.some((origin) => origin.endsWith(".lovable.app"))).toBe(true);
    expect(ALLOWED_ORIGINS.some((origin) => origin.includes("*"))).toBe(false);
  });

  it("accepts an address on an allowed origin", () => {
    expect(isAllowedReturnUrl("https://buildgallery.ai/content/1?payment=success")).toBe(true);
    expect(isAllowedReturnUrl("http://localhost:8080/project/2")).toBe(true);
  });

  it("refuses any other address", () => {
    for (const url of [
      "https://evil.example/content/1",
      "https://buildgallery.ai.evil.example/",
      "https://buildgallery.ai@evil.example/",
      "https://evil.example/https://buildgallery.ai/",
      "http://buildgallery.ai/",
      "javascript:alert(1)",
      "//evil.example",
      "/content/1",
      "",
    ]) {
      expect(isAllowedReturnUrl(url), url).toBe(false);
    }
  });
});

describe("CA-29 P5: one error shape", () => {
  it("names the first field that failed", () => {
    expect(fieldError({ issues: [{ path: ["content_id"], message: "Required" }] })).toBe("content_id: Required");
    expect(fieldError({ issues: [{ path: [], message: "Invalid input" }] })).toBe("body: Invalid input");
  });

  it("writes { error } with the status and the headers it is given", async () => {
    const response = jsonResponse({ error: "Not found" }, 404, { "Access-Control-Allow-Origin": "*" });
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
