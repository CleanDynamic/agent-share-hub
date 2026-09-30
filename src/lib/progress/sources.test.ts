// RC-P27 — "How you earn" says what XP-DESIGN.md says, and nothing more.
//
// The progress page lists the sources of XP from lib/progress/sources.ts. The
// document is the specification, so this reads its Sources table and holds
// the list to it: the same six events, the same XP, in the same order.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { XP_SOURCES } from "./sources";

function designSources(): { event: string; xp: string }[] {
  const text = readFileSync(join("docs", "reconciliation", "XP-DESIGN.md"), "utf8");
  const from = text.indexOf("\n## Sources");
  expect(from, "XP-DESIGN.md has a Sources section").toBeGreaterThanOrEqual(0);
  const section = text.slice(from + 1, text.indexOf("\n## ", from + 1));
  return section
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.startsWith("| Event ") && !/^\|\s*-/.test(line))
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .map((cells) => ({ event: cells[1], xp: cells[3] }));
}

describe("How you earn", () => {
  it("lists the six sources of XP-DESIGN.md, event and XP word for word, in its order", () => {
    const design = designSources();
    expect(design).toHaveLength(6);
    expect(XP_SOURCES.map(({ event, xp }) => ({ event, xp }))).toEqual(design);
  });

  it("names no source the document rules out", () => {
    const words = XP_SOURCES.map((source) => source.event.toLowerCase()).join(" ");
    for (const never of ["like", "comment", "save", "follow", "log in", "login", "streak"]) {
      expect(words).not.toContain(never);
    }
  });
});
