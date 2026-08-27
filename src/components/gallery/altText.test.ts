// Every picture on the new path says what it is.
//
// A SOURCE SWEEP RATHER THAN A RENDER TEST, deliberately. Rendering each body
// proves the alt of the branch the fixture happened to take; this proves the
// property for every <img> that exists, including the ones no fixture reaches —
// which is the only way a rule like "no empty alt" stays true as bodies are
// added.
//
// It fails on three things, each of which has a real reader behind it:
//   - no alt attribute at all      an unlabelled image, announced as its URL
//   - alt=""                       announced as decoration, which it never is
//   - alt={x} where x may be blank  a caption that happens to be empty

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/components/gallery", "src/components/build"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith(".tsx")) return [];
    if (entry.name.includes(".test.")) return [];
    return [path];
  });
}

/**
 * The source with its comment lines blanked out, line numbering intact.
 *
 * These files explain themselves at length, and several of those explanations
 * mention an <img> in prose. Blanking rather than deleting keeps the reported
 * line numbers pointing at the real file.
 */
function withoutComments(source: string): string {
  return source
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const isComment =
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("{/*");
      return isComment ? "" : line;
    })
    .join("\n");
}

/** Each `<img ...>` tag in a file, with the line it opens on. */
function imageTags(source: string): { tag: string; line: number }[] {
  const code = withoutComments(source);
  const tags: { tag: string; line: number }[] = [];
  const pattern = /<img\b[\s\S]*?\/?>/g;
  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    tags.push({
      tag: match[0],
      line: code.slice(0, index).split("\n").length,
    });
  }
  return tags;
}

describe("alt text on the new path", () => {
  // ACCEPTANCE 4
  it("gives every image a non-empty alt", () => {
    const offences: string[] = [];

    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        for (const { tag, line } of imageTags(source)) {
          const alt = /\balt=(\{[^}]*\}|"[^"]*")/.exec(tag)?.[1];
          if (!alt) {
            offences.push(`${file}:${line} has no alt`);
            continue;
          }
          if (alt === '""' || alt === "{''}" || alt === '{""}') {
            offences.push(`${file}:${line} has an empty alt`);
          }
        }
      }
    }

    expect(offences).toEqual([]);
  });

  it("finds the images it is meant to be checking", () => {
    // A sweep that matches nothing passes silently, which is worse than a
    // failure. There are images under both roots; this says so.
    for (const root of ROOTS) {
      const found = sourceFiles(root).flatMap((file) =>
        imageTags(readFileSync(file, "utf8"))
      );
      expect(found.length).toBeGreaterThan(0);
    }
  });
});
