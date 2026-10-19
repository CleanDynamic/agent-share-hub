import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CODE_LANGUAGES } from "@/lib/build/graph";

import { CODE_COPY, LANGUAGE_OF_DETECTED, codeLanguageFor, firstLines, isTextType, lineCount, looksLikeCode, readCodeFile } from "./codeModel";

const file = (body: BlobPart, name: string, type = "") => new File([body], name, { type });

describe("the language map (CA-02 P7)", () => {
  it("maps every detectLanguage name onto the code type's enum", () => {
    expect(LANGUAGE_OF_DETECTED).toEqual({
      javascript: "js",
      typescript: "ts",
      python: "python",
      json: "json",
      html: "html",
      css: "css",
      sql: "sql",
      shell: "bash",
      markdown: "other",
      plaintext: "other",
    });
    for (const value of Object.values(LANGUAGE_OF_DETECTED)) expect(CODE_LANGUAGES).toContain(value);
  });

  it("guesses from the text, and lets a .tsx, .jsx or .yml file name override the guess", () => {
    expect(codeLanguageFor("def main():\n    print('hi')\n")).toBe("python");
    expect(codeLanguageFor("SELECT id FROM builds WHERE id = 1;")).toBe("sql");
    expect(codeLanguageFor("#!/bin/bash\necho hi")).toBe("bash");
    expect(codeLanguageFor("just some words")).toBe("other");
    expect(codeLanguageFor("const x = 1;", "App.tsx")).toBe("tsx");
    expect(codeLanguageFor("const x = 1;", "App.jsx")).toBe("jsx");
    expect(codeLanguageFor("name: ci", "ci.yml")).toBe("yaml");
    expect(codeLanguageFor("def main():\n    pass", "main.py")).toBe("python");
    // A plain ending names the language too: the guess reads this as JavaScript.
    expect(codeLanguageFor("export const a = 1;", "app.ts")).toBe("ts");
    expect(codeLanguageFor("export const a = 1;", "notes")).toBe("js");
  });
});

describe("lines", () => {
  it("counts lines and keeps the first six", () => {
    expect(lineCount("")).toBe(0);
    expect(lineCount("a")).toBe(1);
    expect(lineCount("a\nb\n")).toBe(2);
    expect(lineCount("a\r\nb\r\nc")).toBe(3);
    expect(firstLines("1\n2\n3\n4\n5\n6\n7\n8")).toBe("1\n2\n3\n4\n5\n6");
  });

  it("offers text as code only from three lines, in a language that is not plain text or markdown", () => {
    expect(looksLikeCode("const a = 1;\nconst b = 2;\nexport { a, b };")).toBe(true);
    expect(looksLikeCode("const a = 1;\nconst b = 2;")).toBe(false);
    expect(looksLikeCode("Write me a poem\nabout bread\nand butter")).toBe(false);
    expect(looksLikeCode("# Title\n\n- one\n- two\n- three")).toBe(false);
  });
});

describe("uploads", () => {
  it("takes text by its type, and a code file a browser types wrongly by its name", () => {
    expect(isTextType({ name: "notes.txt", type: "text/plain" })).toBe(true);
    expect(isTextType({ name: "data.json", type: "application/json" })).toBe(true);
    expect(isTextType({ name: "app.ts", type: "video/mp2t" })).toBe(true);
    expect(isTextType({ name: "schema.sql", type: "" })).toBe(true);
    expect(isTextType({ name: "photo.png", type: "image/png" })).toBe(false);
    expect(isTextType({ name: "clip.ts", type: "video/mp4" })).toBe(false);
    expect(isTextType({ name: "blob", type: "" })).toBe(false);
  });

  it("reads a text file as one code step named by its file", async () => {
    expect(await readCodeFile(file("select 1;\n", "schema.sql", "application/sql"))).toEqual({ ok: true, source: "select 1;\n", filename: "schema.sql", language: "sql" });
  });

  it("refuses a file with a NUL byte in its first 8 KB, one that is not text, and one over the limit, by name", async () => {
    expect(await readCodeFile(file(new Uint8Array([104, 0, 105]), "bin.ts", "video/mp2t"))).toEqual({ ok: false, filename: "bin.ts", reason: CODE_COPY.notText });
    expect(await readCodeFile(file("x", "photo.png", "image/png"))).toEqual({ ok: false, filename: "photo.png", reason: "That file isn't text." });
    expect(await readCodeFile(file("x".repeat(100_001), "big.js", "text/javascript"))).toEqual({ ok: false, filename: "big.js", reason: "Code is at most 100,000 characters. Upload it as a file instead." });
  });
});

describe("maker code is never run (CA-02 P7)", () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sources(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it("is not imported anywhere in the composer or the build page", () => {
    const files = [...sources(join(process.cwd(), "src/pages/site/compose")), ...sources(join(process.cwd(), "src/pages/site/build"))];
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((path) => /from\s+["'][^"']*codeRunner["']|import\(\s*["'][^"']*codeRunner["']\s*\)/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});
