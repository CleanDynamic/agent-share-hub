// SV-01 Part 2. Raw HTML is how a maker's words become a script in a reader's
// browser. Four places hold it on purpose, each for markup the code itself
// made (see the comment beside each). A new one has to be added here, on
// purpose, in review.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ALLOWED = new Set([
  join("src", "components", "ui", "chart.tsx"),
  join("src", "pages", "site", "compose", "listNest.tsx"),
  join("src", "pages", "site", "compose", "mapMorph.tsx"),
  join("src", "pages", "ContentDetail.tsx"),
]);

const RAW = /dangerouslySetInnerHTML|\binnerHTML\s*=|insertAdjacentHTML|document\.write\(|\.document\.write\(/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name) ? [path] : [];
  });
}

describe("SV-01: raw HTML outside the allow list", () => {
  it("is nowhere in src", () => {
    const offenders = files("src").filter((file) => !ALLOWED.has(file) && RAW.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("is still in each allowed file, with its reason beside it (or the file leaves the list)", () => {
    for (const file of ALLOWED) {
      const source = readFileSync(file, "utf8");
      expect(RAW.test(source), file).toBe(true);
      expect(source, file).toContain("SV-01: raw HTML on purpose");
    }
  });
});
