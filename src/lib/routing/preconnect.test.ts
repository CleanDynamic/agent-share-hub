import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("index.html", () => {
  it("preconnects to the database from the client's own address, filled in at build time", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toMatch(/<link rel="preconnect" href="%VITE_SUPABASE_URL%" crossorigin \/>/);
  });
});
