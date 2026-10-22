import { describe, expect, it } from "vitest";

import { COLLECTIONS, countOf, keysOf, visibleCollections } from "./collections";
import { isKnown, type Facet } from "./taxonomy";

describe("collections", () => {
  it("starts with the board's three, by name and line", () => {
    expect(COLLECTIONS.map((c) => [c.name, c.line])).toEqual([
      ["AI for teachers", "Marking, lesson planning, presentations"],
      ["Research with AI", "Literature review, text analysis, statistics"],
      ["Runs on its own", "Autonomous agents shown running"],
    ]);
  });

  it("stands only for ids the taxonomy knows", () => {
    for (const collection of COLLECTIONS) {
      for (const [facet, ids] of Object.entries(collection.values) as [Facet, string[]][]) for (const id of ids) expect(isKnown(facet, id), `${collection.name}: ${facet}:${id}`).toBe(true);
    }
  });

  it("applies its values as facet keys", () => {
    expect(keysOf(COLLECTIONS[0])).toEqual(["field:education"]);
    expect(keysOf(COLLECTIONS[2])).toEqual(["built:autonomous-agent", "built:multi-agent-system"]);
  });

  it("counts the most within a facet and the least across facets", () => {
    const counts = { "built:autonomous-agent": 3, "built:multi-agent-system": 5 };
    expect(countOf(COLLECTIONS[2], counts)).toBe(5);
    expect(countOf({ id: "x", name: "x", line: "x", values: { field: ["education"], skill: ["no-coding"] } }, { "field:education": 7, "skill:no-coding": 2 })).toBe(2);
  });

  it("hides a collection with no builds", () => {
    expect(visibleCollections({})).toEqual([]);
    expect(visibleCollections({ "field:education": 4 }).map((entry) => [entry.collection.id, entry.count])).toEqual([["ai-for-teachers", 4]]);
  });
});
