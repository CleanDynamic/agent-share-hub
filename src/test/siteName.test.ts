// UX-14 P5. The site is called OpenBuilds.ai. The old names do not come back into shown copy.
//
// Scans the files a person (or an assistant) reads for buildgallery, build gallery and neoscale, any case. A match fails unless
// its file is on ALLOWED with the reason. Comments and identifiers are not shown copy, and are stripped before the scan.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const OLD = /build[ -]?gallery|neoscale/i;

/** File, pattern the match must be, and why it stays. One line each. */
const ALLOWED: ReadonlyArray<readonly [file: string, only: RegExp, why: string]> = [
  ["src/lib/build/buildfile.ts", /neoscale_build/, "the one parser line that still reads Miles's earlier exports (UX-14 P4)"],
  ["src/pages/site/compose/PromptsPanel.tsx", /x-buildgallery-prompt/, "internal drag type, an identifier never shown"],
  ["src/pages/About.tsx", /neoscale/i, "an account handle and a mailbox that exist outside the repo; Miles decides"],
  ["src/pages/dev/ClassificationDemo.tsx", /neoscaleai/, "a dev fixture handle, not shown to a visitor"],
  ["src/pages/dev/KitComponents.tsx", /buildgallery/, "dev catalogue page, not shown to a visitor"],
  ["src/pages/dev/VisionComposerAddFromLibrary.tsx", /buildgallery/, "dev board fixture, not shown to a visitor"],
  ["src/dev/fixtures/vision/drafts.ts", /buildgallery-brand-handover/, "dev fixture file name, not shown to a visitor"],
  ["supabase/functions/mcp/constants.ts", /buildgallery:\/\//, "the node-types resource address, an identifier clients subscribe to"],
  ["supabase/functions/mcp/index.ts", /buildgallery[:_]/, "the node-types resource address and name, identifiers"],
  ["supabase/functions/mcp/vocabulary.ts", /buildgallery:\/\//, "the node-types resource address, named in its own text"],
];

const SHOWN_DIRS = ["src/pages", "src/components"];
const SHOWN_FILES = ["index.html", "public/ai.txt", "src/lib/build/buildfile.ts", "src/lib/build/layers.ts", "src/lib/build/shareMeta.ts", "src/lib/connect/connector.ts"];
const EDGE_SHOWN = [
  "supabase/functions/generate-ai-pdf/index.ts",
  "supabase/functions/create-donation-session/handler.ts",
  "supabase/functions/create-project-package-session/index.ts",
  "supabase/functions/generate-build-layers/model.ts",
];
const CONNECTOR = ["supabase/functions/mcp/index.ts", "supabase/functions/mcp/extract.ts", "supabase/functions/mcp/constants.ts", "supabase/functions/mcp/vocabulary.ts"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
}

/** What is left of a source file once its comments are gone. */
export function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`\\])\/\/[^\n"'`]*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "");
}

/** Every match in `text` that is not allowed for `file`. */
export function offenders(file: string, text: string): string[] {
  const rules = ALLOWED.filter(([f]) => f === file);
  const found: string[] = [];
  withoutComments(text).split("\n").forEach((line, i) => {
    if (!OLD.test(line)) return;
    const stripped = rules.reduce((l, [, only]) => l.replace(new RegExp(only.source, "gi"), ""), line);
    if (OLD.test(stripped)) found.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
  return found;
}

function shownFiles(): string[] {
  const notTest = (f: string) => !/\.(test|spec)\.tsx?$/.test(f) && /\.(tsx?|md|html|txt)$/.test(f);
  return [...SHOWN_DIRS.flatMap(walk).filter(notTest), ...SHOWN_FILES, ...CONNECTOR, ...EDGE_SHOWN, ...readdirSync("public/buildfile").filter((n) => n.endsWith(".md")).map((n) => join("public/buildfile", n))];
}

describe("UX-14 P5 · the old names stay out of shown copy", () => {
  it("finds none in the pages, components, index.html, ai.txt, the Build File documents, the PDF and the connector", () => {
    const bad = shownFiles().flatMap((f) => offenders(f, readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("fails on a fixture string 'Welcome to buildgallery'", () => {
    expect(offenders("src/pages/Fixture.tsx", '<h1>Welcome to buildgallery</h1>')).toHaveLength(1);
    expect(offenders("src/pages/Fixture.tsx", 'const t = "Welcome to Build Gallery";')).toHaveLength(1);
    expect(offenders("src/pages/Fixture.tsx", "title: 'NeoScale AI'")).toHaveLength(1);
  });

  it("lets a comment mention history, and lets an allowed identifier stand", () => {
    expect(offenders("src/pages/Fixture.tsx", "// BG-P01 was the buildgallery theme\n/* neoscale */")).toEqual([]);
    expect(offenders("src/pages/site/compose/PromptsPanel.tsx", 'export const T = "application/x-buildgallery-prompt";')).toEqual([]);
    expect(offenders("src/pages/site/compose/PromptsPanel.tsx", 'const x = "buildgallery";')).toHaveLength(1);
  });

  it("keeps every allowlist entry pointing at a file that still has the match", () => {
    for (const [file, only] of ALLOWED) expect(new RegExp(only.source, "i").test(readFileSync(file, "utf8")), file).toBe(true);
  });
});
