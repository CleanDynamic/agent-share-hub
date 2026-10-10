// What every visitor downloads before the first page paints: the modules
// src/main.tsx reaches through static imports. Anything reached here is in the
// first download whether or not the page needs it; a lazy import() is not
// followed, because its module arrives with the route that asks for it.
//
// THE COMPOSER STAYS OUT (neoscale-performance: "the compose route must never
// appear in the initial bundle"). App.tsx imports ComposeRoute eagerly, and
// one import of the `@/lib/build` barrel or of useComposeBuild from it used to
// put the whole build layer (Build File, conversion, rebuild, the composer's
// hook) into the first download: about 70 KB of minified script that no page
// paints with. ComposeRoute names the narrow modules instead.
//
// IMPORTS ARE READ BY THE TYPESCRIPT PARSER, as in edgeBundles.test.ts. A
// type-only import brings no code, so it is not followed.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null; // a package
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The modules a file imports for their code, not only for their types. */
function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  for (const statement of source.statements) {
    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      const named = clause?.namedBindings;
      const onlyTypes =
        clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly);
      if (onlyTypes) continue;
      specifier = statement.moduleSpecifier;
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.isTypeOnly) {
      specifier = statement.moduleSpecifier;
    }
    if (specifier && ts.isStringLiteral(specifier)) {
      const target = resolveImport(file, specifier.text);
      if (target) found.push(target);
    }
  }
  return found;
}

/** Every module statically reachable from src/main.tsx, with the chain that reaches it. */
function firstDownload(): Map<string, string | null> {
  const start = join(SRC, "main.tsx");
  const reachedFrom = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    for (const next of runtimeImports(file)) {
      if (!reachedFrom.has(next)) {
        reachedFrom.set(next, file);
        queue.push(next);
      }
    }
  }
  return reachedFrom;
}

const chainTo = (reached: Map<string, string | null>, file: string) => {
  const chain: string[] = [];
  for (let at: string | null | undefined = file; at; at = reached.get(at)) chain.unshift(relative(ROOT, at));
  return chain.join(" → ");
};

describe("the first download", () => {
  const reached = firstDownload();

  it("reaches App.tsx, so the walk is reading imports at all", () => {
    expect(reached.has(join(SRC, "App.tsx"))).toBe(true);
    expect(reached.has(join(SRC, "pages/site/compose/ComposeRoute.tsx"))).toBe(true);
  });

  it.each(["src/pages/site/compose/ComposePage.tsx", "src/hooks/useComposeBuild.ts", "src/lib/build/index.ts"])(
    "does not carry %s",
    (path) => {
      const file = join(ROOT, path);
      expect(reached.has(file), reached.has(file) ? chainTo(reached, file) : "").toBe(false);
    },
  );
});
