// G1: every database function the app calls is named a read or a write, so the read limit knows which to cut.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { READ_RPCS, WRITE_RPCS } from "./readRpcs";

const SRC = path.resolve(__dirname, "../..");

/** The call forms in src: `.rpc("x"`, `.rpc<T>("x"`, `rpc("x"` (a local wrapper), and `(… .rpc as …)("x"`. */
const CALL = /(?:\brpc\s*(?:<[^>]*>)?\s*\(|\)\s*\()\s*["']([a-z][a-z0-9]*_[a-z0-9_]+)["']/g;

function callSites(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "dev" && entry.name !== "test") walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.|\.fixtures?\./.test(entry.name)) {
        const text = fs.readFileSync(full, "utf8");
        if (!/\brpc\b/.test(text)) continue;
        for (const match of text.matchAll(CALL)) found.set(match[1], [...(found.get(match[1]) ?? []), path.relative(SRC, full)]);
      }
    }
  };
  walk(SRC);
  return found;
}

describe("the read and write lists of database functions", () => {
  const sites = callSites();

  it("finds the call sites (the scan itself works)", () => {
    expect(sites.size).toBeGreaterThanOrEqual(30);
    expect(sites.has("gallery_facets")).toBe(true);
    expect(sites.has("create_post")).toBe(true);
  });

  it("names every function called from src as a read or a write", () => {
    const unclassified = [...sites].filter(([name]) => !READ_RPCS.has(name) && !WRITE_RPCS.has(name)).map(([name, files]) => `${name} (${files.join(", ")})`);
    expect(unclassified).toEqual([]);
  });

  it("names no function as both", () => {
    expect([...READ_RPCS].filter((name) => WRITE_RPCS.has(name))).toEqual([]);
  });

  it("lists no function that src no longer calls", () => {
    expect([...READ_RPCS, ...WRITE_RPCS].filter((name) => !sites.has(name))).toEqual([]);
  });
});
