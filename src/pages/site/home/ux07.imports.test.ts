// UX-07: Home and Drafts still import nothing from the composer's folder themselves, now that Home draws topics and their reply box.
// Imports are read by the TypeScript parser, as src/test/initialBundle.test.ts reads them: a type-only import brings no code.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const COMPOSE = join(SRC, "pages/site/compose") + "/";
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];

function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/") ? join(SRC, specifier.slice(2)) : specifier.startsWith(".") ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function runtimeImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  for (const statement of source.statements) {
    let specifier: ts.Expression | undefined;
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      if (clause?.isTypeOnly) continue;
      const named = clause?.namedBindings;
      if (clause && !clause.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly)) continue;
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

/** The files of a folder (tests left out) that import something in the composer's folder themselves. Through shared pieces the
    folder is reached already on main (FeedPost → RefLinks, the route table's placeholders), which is reported, not changed here. */
function directComposerImports(folder: string): string[] {
  const dir = join(ROOT, folder);
  return readdirSync(dir)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name))
    .flatMap((name) => runtimeImports(join(dir, name)).filter((target) => target.startsWith(COMPOSE)).map((target) => `${folder}/${name} → ${relative(ROOT, target)}`));
}

describe("UX-07: the composer's folder stays out of Home and Drafts", () => {
  it("no file of Home imports from src/pages/site/compose", () => {
    expect(directComposerImports("src/pages/site/home")).toEqual([]);
  });

  // Drafts imported one composer piece before UX-07 (DraftsView's reference chip); nothing here adds another.
  it("Drafts imports nothing from src/pages/site/compose beyond what it did on main", () => {
    expect(directComposerImports("src/pages/site/drafts")).toEqual(["src/pages/site/drafts/DraftsView.tsx → src/pages/site/compose/referencePieces.tsx"]);
  });
});
