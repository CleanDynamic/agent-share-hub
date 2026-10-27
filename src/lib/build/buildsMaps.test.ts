// SV-12 P2: the Maps of a page of builds, read on demand. The claims: the Map of a build is the one the composer draws for
// it (same sessions, numbers, parts and lines, from the same functions); the read is ONE request with named columns
// and a limit; a build the read does not return, or with no sessions, has no Map; and for 24 builds of the size of the
// largest fixture the JSON read is far under 300 KB.

import { describe, expect, it, vi } from "vitest";

const calls: { table: string; columns: string; filters: unknown[][] }[] = [];
let rows: unknown[] = [];
let failure: unknown = null;

vi.mock("@/integrations/supabase/client", () => {
  const builder = (call: { filters: unknown[][] }) => {
    const query: Record<string, unknown> = {};
    for (const method of ["in", "not", "order", "limit"]) {
      query[method] = (...args: unknown[]) => {
        call.filters.push([method, ...args]);
        return query;
      };
    }
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: failure ? null : rows, error: failure }).then(resolve);
    return query;
  };
  return {
    supabase: {
      from: (table: string) => ({
        select: (columns: string) => {
          const call = { table, columns, filters: [] as unknown[][] };
          calls.push(call);
          return builder(call);
        },
      }),
    },
  };
});

import { partsBuild, partsMaking, partsTree } from "@/dev/fixtures/parts";
import { flattenTree } from "./buildsMapsTestSupport";
import { MAP_NODE_COLUMNS, buildMapOf, listBuildMaps } from "./buildsMaps";
import { layoutSessionMap, sessionMapFor } from "./sessionMap";
import { madeFileNamesOf, madeFilesOf } from "./graph";

const rowOf = (id = "parts-build") => ({ id, making: partsMaking, build_nodes: flattenTree(partsTree) });

describe("the Map of one build", () => {
  it("is the Map the composer draws for it: the same sessions, numbers, parts and lines", () => {
    const { steps, groups, making, tree } = partsBuild();
    const files = [...madeFilesOf(tree)].map(([id, madeBy]) => ({ id, name: madeFileNamesOf(tree).get(id) ?? "", madeBy }));
    const composer = sessionMapFor({ groups, steps, files, making });
    const read = buildMapOf(rowOf()).model!;
    expect(read.sessions.map((session) => [session.number, session.title, session.part])).toEqual(composer.sessions.map((session) => [session.number, session.title, session.part]));
    expect(read.parts.map((part) => [part.label, part.name, part.sessions])).toEqual(composer.parts.map((part) => [part.label, part.name, part.sessions]));
    expect(read.links.map((link) => link.id).sort()).toEqual(composer.links.map((link) => link.id).sort());
    expect(layoutSessionMap(read, "horizontal").boxes).toEqual(layoutSessionMap(composer, "horizontal").boxes);
    expect(layoutSessionMap(read, "vertical").boxes).toEqual(layoutSessionMap(composer, "vertical").boxes);
  });

  it("numbers the five sessions 1 to 5 in two parts and finds the line from Part A to Part B", () => {
    const model = buildMapOf(rowOf()).model!;
    expect(model.sessions.map((session) => session.number)).toEqual([1, 2, 3, 4, 5]);
    expect(model.hasParts).toBe(true);
    expect(model.links.some((link) => link.from.endsWith("a2") && link.session.endsWith("a4"))).toBe(true);
  });

  it("has no Map when the build has no sessions", () => {
    expect(buildMapOf({ id: "empty", making: {}, build_nodes: [] }).model).toBeNull();
    expect(buildMapOf({ id: "none", making: null, build_nodes: null }).model).toBeNull();
  });
});

describe("the read", () => {
  it("is one request: the builds with their placed nodes, named columns, limits, no star", async () => {
    calls.length = 0;
    rows = [rowOf("a"), rowOf("b")];
    failure = null;
    await listBuildMaps(["a", "b"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("builds");
    expect(calls[0].columns).toBe(`id, making, build_nodes!build_nodes_build_id_fkey(${MAP_NODE_COLUMNS})`);
    expect(calls[0].columns).not.toContain("*");
    const names = calls[0].filters.map((filter) => filter[0]);
    expect(names).toContain("in");
    expect(names.filter((name) => name === "limit")).toHaveLength(2);
    expect(calls[0].filters).toContainEqual(["not", "build_nodes.position", "is", null]);
  });

  it("answers in the order asked, with a build the database did not return as having no Map", async () => {
    rows = [rowOf("b"), rowOf("a")];
    const maps = await listBuildMaps(["a", "gone", "b"]);
    expect(maps.map((map) => [map.buildId, map.model !== null])).toEqual([["a", true], ["gone", false], ["b", true]]);
  });

  it("asks nothing for no builds, and throws when the read fails", async () => {
    calls.length = 0;
    expect(await listBuildMaps([])).toEqual([]);
    expect(calls).toHaveLength(0);
    failure = { code: "500", message: "down" };
    await expect(listBuildMaps(["a"])).rejects.toThrow();
    failure = null;
  });

  it("stays far under 300 KB of JSON for 24 builds of the fixture's size", () => {
    const one = JSON.stringify({ id: "x", making: partsMaking, build_nodes: flattenTree(partsTree).map(({ id, parent_id, position, type, title, payload, is_gap }) => ({ id, parent_id, position, type, title, payload, is_gap })) }).length;
    const kb = (one * 24) / 1024;
    // Measured at SV-12: 4187 bytes for this 8-tile build, 98.1 KB for 24. Real builds carry longer prompts and code: the live
    // size is read in the browser's Network panel (the report says how), and 300 KB is where the stored summary begins.
    expect(kb).toBeLessThan(300);
  });
});
