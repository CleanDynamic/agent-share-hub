// G20, G21: the security headers Netlify sends on every HTML response, read from netlify.toml, and the hashes of the two
// inline scripts in index.html. If either script changes without its hash in the policy, this fails.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The policy ships report-only first (D5). The enforcing commit changes this name and nothing else here. */
const CSP_HEADER = "Content-Security-Policy-Report-Only";

const TOML = readFileSync("netlify.toml", "utf8");

/** The values of the [[headers]] block for "/*". */
function headersForAll(): Record<string, string> {
  const blocks = TOML.split("[[headers]]").slice(1);
  const block = blocks.find((text) => /for\s*=\s*"\/\*"/.test(text));
  if (!block) return {};
  const values: Record<string, string> = {};
  for (const match of block.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"((?:[^"\\]|\\.)*)"\s*$/gm)) {
    if (match[1] !== "for") values[match[1]] = match[2].replace(/\\"/g, '"');
  }
  return values;
}

function directives(policy: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const part of policy.split(";").map((piece) => piece.trim()).filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/);
    out.set(name, sources);
  }
  return out;
}

const inlineScripts = () => [...readFileSync("index.html", "utf8").matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const hashOf = (code: string) => `'sha256-${createHash("sha256").update(code).digest("base64")}'`;

const headers = headersForAll();
const csp = directives(headers[CSP_HEADER] ?? "");

describe("G20: the headers on every response", () => {
  it(`sends ${CSP_HEADER}`, () => {
    expect(headers[CSP_HEADER]).toBeTruthy();
  });

  it("allows no inline script except by hash, and nothing may frame the site", () => {
    const scripts = csp.get("script-src") ?? [];
    expect(scripts).toContain("'self'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(scripts.filter((source) => source.startsWith("'sha256-"))).toHaveLength(inlineScripts().length);
    expect(csp.get("frame-ancestors")).toEqual(["'none'"]);
    expect(csp.get("object-src")).toEqual(["'none'"]);
    expect(csp.get("base-uri")).toEqual(["'self'"]);
    expect(csp.get("default-src")).toEqual(["'self'"]);
  });

  it("lists exact hosts in connect-src: no wildcard and no bare scheme", () => {
    for (const source of csp.get("connect-src") ?? []) {
      expect(source).not.toContain("*");
      expect(source).not.toMatch(/^(https?|wss?):$/);
    }
  });

  it("keeps 'unsafe-inline' for styles only (D6)", () => {
    expect(csp.get("style-src")).toContain("'unsafe-inline'");
  });

  it("sends HSTS for at least a year, nosniff, the referrer policy, and denies camera, microphone and geolocation", () => {
    const maxAge = Number(/max-age=(\d+)/.exec(headers["Strict-Transport-Security"] ?? "")?.[1] ?? 0);
    expect(maxAge).toBeGreaterThanOrEqual(31_536_000);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    for (const feature of ["camera=()", "microphone=()", "geolocation=()"]) expect(headers["Permissions-Policy"]).toContain(feature);
  });
});

describe("G21: the inline scripts in index.html are allowed by hash", () => {
  it("has exactly the two it is known to have", () => {
    expect(inlineScripts()).toHaveLength(2);
  });

  it.each(inlineScripts().map((code, index) => [index, code] as const))("script %i's hash is in script-src", (_index, code) => {
    expect(csp.get("script-src")).toContain(hashOf(code));
  });
});
