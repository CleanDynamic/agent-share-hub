// Nothing under supabase/functions/mcp/ or _shared/ imports what Lovable will
// not bundle with it (EX-P16-fix).
//
// Lovable deploys an edge function from two folders only: the function's own
// and supabase/functions/_shared/. An import that resolves anywhere else is a
// "Module not found" at deploy time, and nothing before the deploy notices. That
// is how the mcp function became undeployable: _shared/intake/readers/lovable.ts
// and readers/transcript.ts imported their parsers from the parse-lovable and
// parse-transcript function folders. EX-P16-fix moved both parsers into
// _shared/intake/parsers/; this test keeps them, and everything else, inside.
//
// THE RULE, per folder:
//   mcp/      A relative import stays in mcp/ or _shared/. Anything else is an
//             npm:, jsr:, https: or node: specifier, or a bare name that
//             mcp/deno.json maps to one.
//   _shared/  A relative import stays in _shared/ — never into mcp/ or any
//             other function, because _shared/ is bundled into every function
//             that uses it. And no bare names: parse-lovable and
//             parse-transcript have no import map, so a name that resolves
//             under mcp's map would break theirs.
// Every relative import must also name a file that exists.
//
// IMPORTS ARE READ BY THE TYPESCRIPT PARSER, NOT A REGEX. A string that only
// contains an import is not one — _shared/redact's tests carry one on purpose —
// and the parsers under _shared/ are full of regex literals holding quotes and
// backticks that a hand-rolled scanner would lose its place in. Deno's own
// resolver (`deno info`, the one the bundler uses) agreed with this reading
// when the rule was written: on main, the same four lines, and only those,
// resolved outside.
//
// Test files are held to the same rule. Lovable does not bundle them, but a
// test that imports a sibling function is the template for the next reader.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const FUNCTIONS = "supabase/functions";
const SCANNED = ["mcp", "_shared"] as const;

const REMOTE = /^(npm|jsr|https|node):/;
const COMPUTED = "<computed>";

interface ImportRef {
  /** Path under supabase/functions/, forward slashes: "_shared/intake/readers/lovable.ts". */
  file: string;
  line: number;
  specifier: string;
}

/** Every module specifier a file names, from the syntax tree. */
function importsOf(file: string, source: string): ImportRef[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const refs: ImportRef[] = [];
  const add = (position: number, specifier: string) =>
    refs.push({ file, line: tree.getLineAndCharacterOfPosition(position).line + 1, specifier });

  // `/// <reference path="…" />` and `/// <reference types="…" />`.
  for (const ref of [...tree.referencedFiles, ...tree.typeReferenceDirectives]) add(ref.pos, ref.fileName);

  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) add(node.moduleSpecifier.getStart(tree), node.moduleSpecifier.text);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const target = node.moduleReference.expression;
      add(target.getStart(tree), ts.isStringLiteral(target) ? target.text : COMPUTED);
    } else if (ts.isCallExpression(node)) {
      const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isImport || isRequire) {
        const [target] = node.arguments;
        add(node.getStart(tree), target && ts.isStringLiteralLike(target) ? target.text : COMPUTED);
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      add(node.getStart(tree), node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return refs;
}

/**
 * Why an import would not be bundled with the file that makes it, or null when
 * it would. `mapped` is mcp/deno.json's import map; `exists` answers for a path
 * under supabase/functions/.
 */
function problemWith(
  ref: ImportRef,
  mapped: Record<string, string>,
  exists: (file: string) => boolean
): string | null {
  const home = ref.file.split("/")[0];
  const allowed = home === "_shared" ? ["_shared"] : ["mcp", "_shared"];
  const { specifier } = ref;

  if (specifier === COMPUTED) return "computes its specifier, which neither the bundler nor this test can follow";

  if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:")) {
    const target = posix.normalize(posix.join(posix.dirname(ref.file), specifier));
    const folder = target.split("/")[0];
    if (specifier.startsWith("/") || specifier.startsWith("file:") || folder === "..") {
      return "resolves outside supabase/functions/";
    }
    if (!allowed.includes(folder)) {
      return home === "_shared"
        ? `reaches into ${folder}/, which is not bundled with the functions that use _shared/`
        : `reaches into ${folder}/, which is not bundled with mcp`;
    }
    return exists(target) ? null : `names ${target}, which does not exist`;
  }

  if (REMOTE.test(specifier)) return null;

  if (home === "_shared") {
    return "is a bare name, and _shared/ is bundled into functions that have no import map";
  }
  const key = Object.keys(mapped).find((name) => name === specifier || (name.endsWith("/") && specifier.startsWith(name)));
  if (!key) return "is a bare name mcp/deno.json does not map";
  const target = mapped[key] + specifier.slice(key.length);
  return REMOTE.test(target) ? null : `is mapped by mcp/deno.json to "${target}", which is not an npm:, jsr:, https: or node: specifier`;
}

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

const scannedFiles = SCANNED.flatMap((folder) => tsFiles(join(FUNCTIONS, folder)))
  .map((path) => path.split("\\").join("/").slice(FUNCTIONS.length + 1))
  .sort();
const refs = scannedFiles.flatMap((file) => importsOf(file, readFileSync(join(FUNCTIONS, file), "utf8")));
const importMap: Record<string, string> =
  JSON.parse(readFileSync(join(FUNCTIONS, "mcp", "deno.json"), "utf8")).imports ?? {};
/** A file, not a folder: Deno resolves no index file, so importing a folder is "Module not found" too. */
const existsUnderFunctions = (file: string) =>
  existsSync(join(FUNCTIONS, file)) && statSync(join(FUNCTIONS, file)).isFile();

const describeRef = (ref: ImportRef, problem: string) => `${ref.file}:${ref.line} imports "${ref.specifier}" — it ${problem}`;

describe("edge bundles: mcp/ and _shared/ import only what Lovable bundles with them", () => {
  it("every import in every file under mcp/ and _shared/ stays inside", () => {
    const problems = refs.flatMap((ref) => {
      const problem = problemWith(ref, importMap, existsUnderFunctions);
      return problem ? [describeRef(ref, problem)] : [];
    });
    expect(problems).toEqual([]);
  });

  it("reads the tree it claims to: the connector, the readers and the parsers they import", () => {
    // Guard the guard: a scan that found nothing would pass the test above forever.
    for (const file of [
      "mcp/index.ts",
      "_shared/intake/readers/lovable.ts",
      "_shared/intake/readers/transcript.ts",
      "_shared/intake/parsers/lovable.ts",
      "_shared/intake/parsers/transcript.ts",
    ]) {
      expect(scannedFiles).toContain(file);
    }
    const edges = refs.map((ref) => `${ref.file} -> ${ref.specifier}`);
    expect(edges).toContain("mcp/index.ts -> ../_shared/intake/readers/index.ts");
    expect(edges).toContain("_shared/intake/readers/lovable.ts -> ../parsers/lovable.ts");
    expect(edges).toContain("_shared/intake/readers/transcript.ts -> ../parsers/transcript.ts");
    expect(edges).toContain("mcp/index.ts -> @modelcontextprotocol/server");
  });

  describe("the rule itself, on sources written to break it", () => {
    const EXISTING = new Set(["_shared/intake/envelope.ts", "_shared/redact/index.ts", "mcp/constants.ts"]);
    const MAP = { "zod/v4": "npm:zod@^4.2.0/v4", "@supabase/server": "npm:@supabase/server@^1.7.0" };
    const problemsIn = (file: string, source: string) =>
      importsOf(file, source).flatMap((ref) => {
        const problem = problemWith(ref, MAP, (path) => EXISTING.has(path));
        return problem ? [`${ref.line}: ${ref.specifier} — ${problem}`] : [];
      });

    it("refuses the import this step removed, in every form it can take", () => {
      const source = [
        'import { detect } from "../../../parse-lovable/parse.ts";',
        'import type { DetectedFormat } from "../../../parse-transcript/parse.ts";',
        'export { parseLovable } from "../../../parse-lovable/parse.ts";',
        'const later = await import("../../../parse-transcript/parse.ts");',
        'type Parsed = typeof import("../../../parse-lovable/parse.ts");',
      ].join("\n");
      expect(problemsIn("_shared/intake/readers/x.ts", source)).toEqual([
        "1: ../../../parse-lovable/parse.ts — reaches into parse-lovable/, which is not bundled with the functions that use _shared/",
        "2: ../../../parse-transcript/parse.ts — reaches into parse-transcript/, which is not bundled with the functions that use _shared/",
        "3: ../../../parse-lovable/parse.ts — reaches into parse-lovable/, which is not bundled with the functions that use _shared/",
        "4: ../../../parse-transcript/parse.ts — reaches into parse-transcript/, which is not bundled with the functions that use _shared/",
        "5: ../../../parse-lovable/parse.ts — reaches into parse-lovable/, which is not bundled with the functions that use _shared/",
      ]);
    });

    it("refuses a sibling function from mcp/, but not _shared/", () => {
      const source = [
        'import { parseRepo } from "../parse-repo/parse.ts";',
        'import type { Envelope } from "../_shared/intake/envelope.ts";',
      ].join("\n");
      expect(problemsIn("mcp/x.ts", source)).toEqual([
        "1: ../parse-repo/parse.ts — reaches into parse-repo/, which is not bundled with mcp",
      ]);
    });

    it("refuses _shared/ reaching into mcp/, src/ or a file that is not there", () => {
      const source = [
        'import { SERVER_NAME } from "../../mcp/constants.ts";',
        'import { materialiseProposal } from "../../../src/lib/build/intake.ts";',
        'import { gone } from "./gone.ts";',
        'import { redactSecrets } from "../redact/index.ts";',
      ].join("\n");
      expect(problemsIn("_shared/intake/x.ts", source)).toEqual([
        "1: ../../mcp/constants.ts — reaches into mcp/, which is not bundled with the functions that use _shared/",
        "2: ../../../src/lib/build/intake.ts — resolves outside supabase/functions/",
        "3: ./gone.ts — names _shared/intake/gone.ts, which does not exist",
      ]);
    });

    it("allows a bare name in mcp/ only when deno.json maps it, and never in _shared/", () => {
      const source = ['import { z } from "zod/v4";', 'import { z as zed } from "zod";'].join("\n");
      expect(problemsIn("mcp/x.ts", source)).toEqual(["2: zod — is a bare name mcp/deno.json does not map"]);
      expect(problemsIn("_shared/x.ts", source)).toEqual([
        "1: zod/v4 — is a bare name, and _shared/ is bundled into functions that have no import map",
        "2: zod — is a bare name, and _shared/ is bundled into functions that have no import map",
      ]);
    });

    it("allows npm:, jsr:, https: and node: from either folder", () => {
      const source = [
        'import { assert } from "jsr:@std/assert@^1.0.0";',
        'import { createClient } from "npm:@supabase/supabase-js@2";',
        'import { serve } from "https://deno.land/std@0.190.0/http/server.ts";',
        'import { Buffer } from "node:buffer";',
      ].join("\n");
      expect(problemsIn("_shared/x.ts", source)).toEqual([]);
      expect(problemsIn("mcp/x.ts", source)).toEqual([]);
    });

    it("is not fooled by an import inside a string, a comment or a regex", () => {
      const source = [
        "// import { detect } from \"../../../parse-lovable/parse.ts\";",
        "const example = 'import { x } from \"../../../parse-lovable/parse.ts\"';",
        "const fence = /^\\s*(?:```|~~~)(.*)$/;",
        "const template = `import { y } from \"../../../parse-transcript/parse.ts\"`;",
        'import { redactSecrets } from "../redact/index.ts";',
        'import { detect } from "../../parse-lovable/parse.ts";',
      ].join("\n");
      expect(problemsIn("_shared/intake/x.ts", source)).toEqual([
        "6: ../../parse-lovable/parse.ts — reaches into parse-lovable/, which is not bundled with the functions that use _shared/",
      ]);
    });
  });
});
