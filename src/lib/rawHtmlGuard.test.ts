// CA-29 Part 2. Text a maker or a reader wrote is drawn as text. Raw HTML reaches
// the page in exactly three places, each one fed by something other than user text:
//   components/ui/chart.tsx          CSS built from the chart's own config
//   pages/site/compose/listNest.tsx  the outerHTML of an element React already drew
//   pages/site/compose/mapMorph.tsx  the same, for the Map's flying copies
// A fourth is a new way in for markup, and is added here only after the same check.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it } from "vitest";

const ALLOWED = [
  join("src", "components", "ui", "chart.tsx"),
  join("src", "pages", "site", "compose", "listNest.tsx"),
  join("src", "pages", "site", "compose", "mapMorph.tsx"),
];

const RAW_HTML = /dangerouslySetInnerHTML|\.innerHTML\s*=(?!=)|\.insertAdjacentHTML\s*\(|\.outerHTML\s*=(?!=)/;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__audit__" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : [];
  });

describe("CA-29 P2: raw HTML", () => {
  it("is set in the three allowed files and nowhere else", () => {
    const files = sourceFiles("src");
    expect(files.length).toBeGreaterThan(100);

    const found = files.filter((file) => RAW_HTML.test(readFileSync(file, "utf8")));
    expect(found.map((file) => file.split(sep).join("/")).sort()).toEqual(ALLOWED.map((file) => file.split(sep).join("/")).sort());
  });

  it("keeps a comment beside each allowed use saying what feeds it", () => {
    for (const file of ALLOWED) {
      const lines = readFileSync(file, "utf8").split("\n");
      const at = lines.findIndex((line) => RAW_HTML.test(line));
      expect(at, file).toBeGreaterThan(0);
      expect(lines.slice(Math.max(0, at - 2), at + 1).join("\n"), file).toMatch(/\/\/|\{\/\*/);
    }
  });
});
