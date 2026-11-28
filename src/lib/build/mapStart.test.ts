import { describe, expect, it } from "vitest";

import { MAP_SANDBOX_NAMES, mapSandboxFixture, type MapSandboxName } from "@/dev/fixtures/mapSandbox";

import { groupKey, groupOfStep } from "./graph";
import { geometryOf, type Measure } from "./mapGeometry";
import { mapLayoutRefusal, placedTiles, type MapNode } from "./mapLayout";
import { orderFacts, orderRefusal, readingOrder } from "./mapOrder";
import { HEAD, HEIGHTS, MIN_TILE, NOTE_WIDTH } from "./mapSandboxTestSupport";
import { startFromBuild } from "./mapStart";
import { workstreamsOf } from "./workstreams";

const measure: Measure = { tile: () => ({ height: HEIGHTS.prompt, minWidth: MIN_TILE }), chrome: (node) => ({ head: node.kind === "box" ? HEAD : 0, noteWidth: NOTE_WIDTH }) };
const start = (name: MapSandboxName) => {
  const fixture = mapSandboxFixture(name);
  return { fixture, layout: startFromBuild(fixture.steps, fixture.groups, fixture.making, fixture.results) };
};

/** The tree with ids and sizes left out: what kind of node, what it holds. */
const shape = (node: MapNode): unknown =>
  node.kind === "box" ? node.tiles : node.kind === "region" ? { of: node.of, child: shape(node.child) } : { [node.dir]: node.children.map(shape) };

describe("startFromBuild", () => {
  it.each(MAP_SANDBOX_NAMES)("%s: valid, in order, every top-level tile once", (name) => {
    const { fixture, layout } = start(name);
    const parts = workstreamsOf(fixture.making, fixture.groups.filter((group) => !group.implicit).map(groupKey));
    const partOf = (session: string) => parts.find((part) => part.sessions.includes(session))?.key;
    expect(mapLayoutRefusal(layout, partOf)).toBeNull();
    const facts = orderFacts(fixture.steps, fixture.groups, fixture.files, fixture.results);
    expect(orderRefusal(layout, geometryOf(layout, measure), facts)).toBeNull();
    const placed = placedTiles(layout);
    expect([...placed].sort()).toEqual([...fixture.steps.map((step) => step.id), ...fixture.results.map((result) => result.id)].sort());
    expect(layout).toMatchObject({ width: 960, background: "grey", dotGrid: false, numbers: "build", hiddenLinks: [], twoWay: [], twoWayDismissed: [], linkGutters: {} });
  });

  it("is the same on every render", () => {
    expect(start("fiftyTiles").layout).toEqual(start("fiftyTiles").layout);
  });

  it("support inbox: Part A with S1 and S2 side by side, Part B with S3 and its Result in S3's region", () => {
    const { layout } = start("supportInbox");
    expect(shape(layout.root)).toEqual({
      down: [
        { of: { part: "ws-a" }, child: { across: [{ of: { session: "typed-s1" }, child: ["p1", "f2", "p3"] }, { of: { session: "typed-s2" }, child: ["p4", "c5", "k6"] }] } },
        { of: { part: "ws-b" }, child: { of: { session: "typed-s3" }, child: { down: [["a7", "t8"], ["r9"]] } } },
      ],
    });
    expect(layout.outlines).toEqual([]);
  });

  it("support inbox reads 1 and 4, then 2 and 5, then 3 and 6, then 7, 8 and 9", () => {
    const { layout } = start("supportInbox");
    expect(readingOrder(geometryOf(layout, measure))).toEqual(["p1", "p4", "f2", "c5", "p3", "k6", "a7", "t8", "r9"]);
  });

  it("one part: no part region; sessions one after another stack", () => {
    const { layout } = start("legacy");
    expect(shape(layout.root)).toEqual({ down: [{ of: { session: "typed-legacy-1" }, child: ["l1", "l2"] }, { of: { session: "typed-legacy-2" }, child: ["l3"] }] });
    const { layout: side } = start("noUses");
    expect(shape(side.root)).toEqual({ across: [{ of: { session: "typed-u1" }, child: ["u1"] }, { of: { session: "typed-u2" }, child: ["u2"] }, { of: { session: "typed-u3" }, child: ["u3"] }] });
  });

  it("a Result whose session sits beside another goes after the row, and the session is outlined", () => {
    const fixture = mapSandboxFixture("supportInbox");
    const layout = startFromBuild(fixture.steps, fixture.groups, fixture.making, [{ id: "r9", from: "3" }]);
    expect(shape(layout.root)).toEqual({
      down: [
        { of: { part: "ws-a" }, child: { down: [{ across: [{ of: { session: "typed-s1" }, child: ["p1", "f2", "p3"] }, { of: { session: "typed-s2" }, child: ["p4", "c5", "k6"] }] }, ["r9"]] } },
        { of: { part: "ws-b" }, child: { of: { session: "typed-s3" }, child: ["a7", "t8"] } },
      ],
    });
    expect(layout.outlines).toEqual(["typed-s1"]);
  });

  it("an old build's implicit group gets a box at the very top with no region", () => {
    const fixture = mapSandboxFixture("legacy");
    const groups = [{ key: "typed-legacy-0", kind: "legacy" as const, implicit: true, sessionId: null, number: 0, tool: null, model: null, startedAt: "typed here", stepNumbers: ["1"] }, { ...fixture.groups[0], stepNumbers: ["2"] }, fixture.groups[1]];
    expect(groupOfStep(groups, fixture.steps[0])).toBeUndefined();
    const layout = startFromBuild(fixture.steps, groups, fixture.making);
    expect(shape(layout.root)).toEqual({ down: [["l1"], { of: { session: "typed-legacy-1" }, child: ["l2"] }, { of: { session: "typed-legacy-2" }, child: ["l3"] }] });
  });

  it("a build with no tiles is one empty box", () => {
    expect(startFromBuild([], [], {}).root).toMatchObject({ kind: "box", tiles: [] });
  });
});
