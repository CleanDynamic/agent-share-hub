// CA-29 Part 5. Every function that reads a body and writes, spends money or
// calls another service checks the body first, and answers one CORS way.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Body as GenerateLayers } from "../../supabase/functions/generate-build-layers/schema";
import { Body as ParseLovable } from "../../supabase/functions/parse-lovable/schema";
import { Body as ParseRepo } from "../../supabase/functions/parse-repo/schema";
import { Body as ParseTranscript } from "../../supabase/functions/parse-transcript/schema";
import { fieldError } from "../../supabase/functions/_shared/http";

const BUILD = "11111111-1111-4111-8111-111111111111";
const FUNCTIONS = join("supabase", "functions");

const problem = (schema: { safeParse(value: unknown): { success: boolean; error?: unknown } }, body: unknown) => {
  const result = schema.safeParse(body);
  return result.success ? null : fieldError(result.error as Parameters<typeof fieldError>[0]);
};

describe("CA-29 P5: a body that does not fit gets a 400 that names the field", () => {
  it("parse-transcript and parse-lovable", () => {
    for (const schema of [ParseTranscript, ParseLovable]) {
      expect(problem(schema, { raw_text: "hello", build_id: BUILD })).toBeNull();
      expect(problem(schema, { build_id: BUILD })).toMatch(/^raw_text:/);
      expect(problem(schema, { raw_text: "   ", build_id: BUILD })).toMatch(/^raw_text: is empty/);
      expect(problem(schema, { raw_text: "hello" })).toMatch(/^build_id:/);
      expect(problem(schema, { raw_text: "hello", build_id: "nope" })).toMatch(/^build_id:/);
      expect(problem(schema, { raw_text: "hello", build_id: BUILD, source_hint: 4 })).toMatch(/^source_hint:/);
      expect(problem(schema, null)).toMatch(/^body:/);
    }
  });

  it("parse-repo", () => {
    expect(problem(ParseRepo, { repo_url: "https://github.com/a/b", build_id: BUILD })).toBeNull();
    expect(problem(ParseRepo, { build_id: BUILD })).toMatch(/^repo_url:/);
    expect(problem(ParseRepo, { repo_url: "x".repeat(501), build_id: BUILD })).toMatch(/^repo_url: is too long/);
    expect(problem(ParseRepo, { repo_url: "https://github.com/a/b" })).toMatch(/^build_id:/);
  });

  it("generate-build-layers", () => {
    expect(problem(GenerateLayers, { build_id: BUILD })).toBeNull();
    expect(problem(GenerateLayers, { build_id: BUILD, layers: ["run"], force: true })).toBeNull();
    expect(problem(GenerateLayers, { layers: ["run"] })).toMatch(/^build_id:/);
    expect(problem(GenerateLayers, { build_id: BUILD, force: "yes" })).toMatch(/^force:/);
    expect(problem(GenerateLayers, { build_id: BUILD, layers: "run" })).toMatch(/^layers:/);
  });
});

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });

describe("CA-29 P5: one CORS helper", () => {
  const sources = filesUnder(FUNCTIONS)
    .filter((file) => /\.ts$/.test(file) && !/\.test\.ts$/.test(file))
    .map((file) => [file, readFileSync(file, "utf8")] as const);

  it("writes the allow-origin header in _shared/cors.ts and nowhere else", () => {
    const writers = sources.filter(([, source]) => source.includes("Access-Control-Allow-Origin")).map(([file]) => file);
    expect(writers).toEqual([join(FUNCTIONS, "_shared", "cors.ts")]);
  });

  it("is used by every function but the connector, which the @supabase/server middleware answers", () => {
    const names = readdirSync(FUNCTIONS).filter((name) => !name.startsWith("_") && name !== "mcp" && statSync(join(FUNCTIONS, name)).isDirectory());
    expect(names.length).toBeGreaterThanOrEqual(17);
    for (const name of names) {
      const own = sources.filter(([file]) => file.startsWith(join(FUNCTIONS, name) + "/"));
      expect(own.some(([, source]) => source.includes("_shared/cors.ts")), name).toBe(true);
    }
  });

  it("keeps public reads open and everything else closed", () => {
    const open = ["post-json", "public-api", "sitemap-xml"];
    for (const name of readdirSync(FUNCTIONS).filter((n) => !n.startsWith("_") && n !== "mcp")) {
      const own = filesUnder(join(FUNCTIONS, name)).filter((file) => /\.ts$/.test(file) && !/\.test\.ts$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n");
      expect(/open:\s*true/.test(own), name).toBe(open.includes(name));
    }
  });
});

describe("CA-29 P5: one error shape", () => {
  it("sends no database or exception message to the browser", () => {
    for (const file of filesUnder(FUNCTIONS).filter((f) => /(index|handler)\.ts$/.test(f) && !f.includes(`${join(FUNCTIONS, "mcp")}`))) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/error:\s*(?:\(?[a-z]+ as Error\)?|[a-z]+Error|error|err|e)\.message/);
      expect(source, file).not.toMatch(/\$\{\s*\w+(?:Result)?\.?(?:error|Error)?\.message\s*\}/);
    }
  });
});
