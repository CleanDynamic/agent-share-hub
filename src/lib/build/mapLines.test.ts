import { describe, expect, it } from "vitest";

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";

import { MAP_GRID, geometryOf, type MapGeometry, type Rect } from "./mapGeometry";
import type { MapLayout } from "./mapLayout";
import { LANE_SPACING, hiddenCount, mapLinks, routeLines, type MapLine, type MapRoute, type Point } from "./mapLines";
import { INBOX, box, fiftyLayout, inbox, inboxBare, layout, measureFor, split } from "./mapSandboxTestSupport";

const fixture = mapSandboxFixture("supportInbox");
const linesOf = (map: MapLayout, name: "supportInbox" | "fiftyTiles" = "supportInbox") => {
  const build = mapSandboxFixture(name);
  return mapLinks(build.steps, build.files, map, build.results);
};
const lineOf = (lines: readonly MapLine[], id: string) => lines.find((line) => line.id === id) as MapLine;
const routeOf = (routes: readonly MapRoute[], id: string) => routes.find((route) => route.id === id) as MapRoute;
const segments = (points: readonly Point[]) => points.slice(1).map((point, at) => [points[at], point] as const);
const EPSILON = 0.01;
const inside = (rect: Rect, a: Point, b: Point) =>
  Math.max(a.x, b.x) > rect.x + EPSILON && Math.min(a.x, b.x) < rect.x + rect.width - EPSILON && Math.max(a.y, b.y) > rect.y + EPSILON && Math.min(a.y, b.y) < rect.y + rect.height - EPSILON;

/** A line made by hand, for layouts whose tiles aren't a build. */
const line = (from: string, to: string, over: Partial<MapLine> = {}): MapLine => ({
  id: `${from}>${to}:uses`,
  from,
  to,
  linkIds: [`${from}>${to}:uses`],
  sentences: [`${to} uses ${from}`],
  label: `${to} uses ${from}.`,
  dashed: false,
  hidden: false,
  inner: false,
  ...over,
});

function expectRightAngles(routes: readonly MapRoute[]) {
  for (const route of routes) {
    expect(route.points.length).toBeGreaterThanOrEqual(2);
    for (const [a, b] of segments(route.points)) expect(Math.abs(a.x - b.x) < EPSILON || Math.abs(a.y - b.y) < EPSILON).toBe(true);
  }
}

/** No route crosses a box but its two end boxes, and inside those only its own tile's row or column, or the padding. */
function expectClearOfBoxes(geometry: MapGeometry, routes: readonly MapRoute[]) {
  for (const route of routes) {
    const ends = [geometry.tiles[route.from], geometry.tiles[route.to]];
    const endBoxes = new Set(ends.map((slot) => slot.box));
    for (const [a, b] of segments(route.points)) {
      for (const leaf of geometry.leaves) {
        const rect = geometry.nodes[leaf];
        if (!inside(rect, a, b)) continue;
        expect(endBoxes.has(leaf), `${route.id} crosses ${leaf}`).toBe(true);
        for (const slot of Object.values(geometry.tiles)) expect(inside(slot, a, b), `${route.id} crosses a tile`).toBe(false);
        if (route.inner || ends[0].box === ends[1].box) continue;
        const horizontal = Math.abs(a.y - b.y) < EPSILON;
        const mine = ends.filter((slot) => slot.box === leaf);
        const inRow = mine.some((slot) => (horizontal ? a.y >= slot.y - EPSILON && a.y <= slot.y + slot.height + EPSILON : a.x >= slot.x - EPSILON && a.x <= slot.x + slot.width + EPSILON));
        const pad = MAP_GRID.padding;
        const inPadding = !inside({ x: rect.x + pad, y: rect.y + pad, width: rect.width - 2 * pad, height: rect.height - 2 * pad }, a, b);
        expect(inRow || inPadding, `${route.id} runs in ${leaf} outside its tile's row and the padding`).toBe(true);
      }
    }
  }
}

describe("mapLinks", () => {
  const lines = linesOf(inbox());

  it("lifts, drops and keys the support inbox's links", () => {
    expect(lines.map((one) => one.id)).toEqual(["p1>f2:uses", "f2>p3:reads", "p4>p3:uses", "p4>c5:uses", "c5>k6:tests", "p3>a7:uses", "t8>a7:uses", "a7>r9:makes"]);
    expect(lineOf(lines, "a7>r9:makes").sentences).toEqual(["Support inbox comes from Agent 7"]);
  });

  it("1 to 2 is an inner drop line, 6 to 5 is dashed, 4 to 3 is routed", () => {
    expect(lineOf(lines, "p1>f2:uses").inner).toBe(true);
    expect(lineOf(lines, "c5>k6:tests")).toMatchObject({ dashed: true, inner: true });
    expect(lineOf(lines, "p4>p3:uses")).toMatchObject({ dashed: false, inner: false });
    // 8 and 7 sit side by side in an Across box: their slots touch too.
    expect(lineOf(lines, "t8>a7:uses").inner).toBe(true);
  });

  it("merges links between the same two tiles, keeping every sentence", () => {
    const steps = fixture.steps.map((step) => (step.id === "p3" ? { ...step, uses: [...step.uses, { kind: "tool" as const, node_id: "p4" }] } : step));
    const merged = mapLinks(steps, [], inbox());
    const both = merged.filter((one) => one.from === "p4" && one.to === "p3");
    expect(both).toHaveLength(1);
    expect(both[0].sentences).toHaveLength(1);
    // A tool use of the same tile is the same `uses` link, so `tileLinksOf` already folds it; a check's test is a second verb.
    const tested = fixture.steps.map((step) => (step.id === "k6" ? { ...step, uses: [...step.uses, { kind: "file" as const, node_id: "c5" }] } : step));
    const two = lineOf(mapLinks(tested, [], inbox()), "c5>k6:tests");
    expect(two.linkIds).toEqual(["c5>k6:tests", "c5>k6:reads"]);
    expect(two.sentences).toEqual(["Check 6 tests Code 5", "Check 6 reads Code 5"]);
    expect(two.label).toBe("Check 6 tests Code 5. Check 6 reads Code 5.");
    expect(two.dashed).toBe(false);
  });

  it("drops links with an end that isn't placed, and lifts a child's links to its tile", () => {
    const fewer = inbox({ root: split("m-root", "down", [box("m-s1", ["p1", "f2", "p3"]), box("m-s3", ["a7", "t8"])]) });
    expect(mapLinks(fixture.steps, [], fewer).map((one) => one.id)).toEqual(["p1>f2:uses", "f2>p3:reads", "p3>a7:uses", "t8>a7:uses"]);
    const fifty = linesOf(fiftyLayout(), "fiftyTiles");
    expect(fifty.every((one) => !one.from.includes(".") && !one.to.includes("."))).toBe(true);
  });

  it("hidden lines are counted and not routed", () => {
    const map = inbox({ hiddenLinks: ["p4>p3:uses", "c5>k6:tests"] });
    const lines = linesOf(map);
    expect(hiddenCount(lines)).toBe(2);
    expect(hiddenCount(linesOf(inbox()))).toBe(0);
    const routes = routeLines(geometryOf(map, INBOX), lines, map);
    expect(routes.map((route) => route.id)).not.toContain("p4>p3:uses");
    expect(routes.map((route) => route.id)).not.toContain("c5>k6:tests");
    expect(routes).toHaveLength(lines.length - 2);
  });
});

describe("routeLines on the support inbox", () => {
  const map = inbox();
  const geometry = geometryOf(map, INBOX);
  const routes = routeLines(geometry, linesOf(map), map);

  it("routes every visible line", () => {
    expect(routes.map((route) => route.id)).toEqual(linesOf(map).map((one) => one.id));
  });

  it("4 to 3 runs through the middle gutter, out of 4's left and into 3's right", () => {
    const middle = geometry.gutters.find((gutter) => gutter.splitId === "m-a-row") as MapGeometry["gutters"][number];
    const route = routeOf(routes, "p4>p3:uses");
    expect(route).toMatchObject({ fromSide: "left", toSide: "right" });
    const vertical = segments(route.points).filter(([a, b]) => Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) > EPSILON);
    expect(vertical).toHaveLength(1);
    expect(vertical[0][0].x).toBeCloseTo(middle.x + middle.width / 2);
    expect(route.points[0]).toEqual({ x: geometry.tiles.p4.x, y: geometry.tiles.p4.y + geometry.tiles.p4.height / 2 });
    expect(route.points[route.points.length - 1]).toEqual({ x: geometry.tiles.p3.x + geometry.tiles.p3.width, y: geometry.tiles.p3.y + geometry.tiles.p3.height / 2 });
  });

  it("1 to 2 is a straight drop between the two slots; 3 to 7 leaves the bottom and enters the top", () => {
    const drop = routeOf(routes, "p1>f2:uses");
    expect(drop.points).toHaveLength(2);
    expect(drop.points[0].x).toBe(drop.points[1].x);
    expect(drop.points[0].y).toBe(geometry.tiles.p1.y + geometry.tiles.p1.height);
    expect(drop.points[1].y).toBe(geometry.tiles.f2.y);
    expect(routeOf(routes, "p3>a7:uses")).toMatchObject({ fromSide: "bottom", toSide: "top" });
    expect(routeOf(routes, "c5>k6:tests").dashed).toBe(true);
  });

  it("no segment is diagonal and no route crosses a box", () => {
    expectRightAngles(routes);
    expectClearOfBoxes(geometry, routes);
    const bare = inboxBare();
    const bareGeometry = geometryOf(bare, INBOX);
    const bareRoutes = routeLines(bareGeometry, linesOf(bare), bare);
    expectRightAngles(bareRoutes);
    expectClearOfBoxes(bareGeometry, bareRoutes);
  });
});

describe("routing rules", () => {
  const measure = measureFor("supportInbox");

  it("three lines through one gutter sit 6 px apart, centred", () => {
    const map = layout(split("root", "across", [box("left", ["a", "b", "c", "d"]), box("right", ["w", "x", "y", "z"])]));
    const geometry = geometryOf(map, measure);
    const gutter = geometry.gutters[0];
    const centre = gutter.x + gutter.width / 2;
    const routes = routeLines(geometry, [line("a", "z"), line("b", "z"), line("c", "z")], map);
    expect(routes).toHaveLength(3);
    expectRightAngles(routes);
    expectClearOfBoxes(geometry, routes);
    const xs = routes.map((route) => segments(route.points).find(([p, q]) => Math.abs(p.x - q.x) < EPSILON && p.x > gutter.x && p.x < gutter.x + gutter.width)?.[0].x as number);
    expect([...xs].sort((p, q) => p - q)).toEqual([centre - LANE_SPACING, centre, centre + LANE_SPACING]);
    // The line that turns off first (from c, the lowest) keeps the lane nearest its tile: none of them cross.
    expect(xs[2]).toBe(centre - LANE_SPACING);
    // They enter z side by side too, centred on its middle.
    const ends = routes.map((route) => route.points[route.points.length - 1].y).sort((p, q) => p - q);
    const middle = geometry.tiles.z.y + geometry.tiles.z.height / 2;
    expect(ends).toEqual([middle - LANE_SPACING, middle, middle + LANE_SPACING]);
  });

  it("linkGutters moves a line's middle segment to the chosen gutter, and a gutter that's gone is ignored", () => {
    const root = split("root", "across", [box("L", ["t1"]), split("mid", "down", [box("M1", ["m1"]), box("M2", ["m2"]), box("M3", ["m3"])]), box("R", ["t2"])]);
    const plain = layout(root);
    const geometry = geometryOf(plain, measure);
    const index = (at: number) => geometry.gutters.findIndex((gutter) => gutter.splitId === "mid" && gutter.index === at);
    const centreOf = (at: number) => geometry.gutters[index(at)].y + MAP_GRID.gutter / 2;
    const runsAt = (route: MapRoute, y: number) => segments(route.points).some(([a, b]) => Math.abs(a.y - y) < EPSILON && Math.abs(b.y - y) < EPSILON && Math.abs(a.x - b.x) > EPSILON);
    const one = [line("t1", "t2")];

    const before = routeLines(geometry, one, plain)[0];
    expect(runsAt(before, centreOf(0))).toBe(true);
    expect(runsAt(before, centreOf(1))).toBe(false);

    const moved = layout(root, { linkGutters: { "t1>t2:uses": index(1) } });
    const after = routeLines(geometryOf(moved, measure), one, moved)[0];
    expect(runsAt(after, centreOf(1))).toBe(true);
    expect(runsAt(after, centreOf(0))).toBe(false);
    expectRightAngles([after]);
    expectClearOfBoxes(geometry, [after]);

    const gone = layout(root, { linkGutters: { "t1>t2:uses": 99 } });
    expect(routeLines(geometryOf(gone, measure), one, gone)[0].points).toEqual(before.points);
  });

  it("a middle tile of a Stack leaves from the side, and two tiles of one box that don't touch use its padding", () => {
    const map = layout(split("root", "down", [split("row", "across", [box("A", ["a1", "a2", "a3"]), box("B", ["b1"])]), box("C", ["c1"])]));
    const geometry = geometryOf(map, measure);
    const routes = routeLines(geometry, [line("a2", "c1"), line("a1", "a3")], map);
    expect(routeOf(routes, "a2>c1:uses").fromSide).toBe("right");
    expect(routeOf(routes, "a2>c1:uses").toSide).toBe("top");
    const padding = routeOf(routes, "a1>a3:uses");
    expect(padding).toMatchObject({ fromSide: "right", toSide: "right" });
    const lane = geometry.nodes.A.x + geometry.nodes.A.width - MAP_GRID.padding / 2;
    expect(padding.points.map((point) => point.x)).toEqual([geometry.tiles.a1.x + geometry.tiles.a1.width, lane, lane, geometry.tiles.a3.x + geometry.tiles.a3.width]);
    expectRightAngles(routes);
    expectClearOfBoxes(geometry, routes);
  });

  it("a tile with no slot is left out", () => {
    const map = inbox({ root: split("m-root", "down", [box("m-s1", ["p1", "f2", "p3"], { collapsed: true }), box("m-s3", ["a7", "t8"])]) });
    const routes = routeLines(geometryOf(map, INBOX), linesOf(map), map);
    expect(routes.map((route) => route.id)).toEqual(["t8>a7:uses"]);
  });
});

describe("the 50-tile build", () => {
  it("routes every line in under 30 ms", () => {
    const map = fiftyLayout();
    const geometry = geometryOf(map, measureFor("fiftyTiles"));
    const lines = linesOf(map, "fiftyTiles");
    const once = routeLines(geometry, lines, map);
    expect(once.map((route) => route.id)).toEqual(lines.map((one) => one.id));
    expect(once.filter((route) => !route.inner).length).toBeGreaterThan(5);
    expectRightAngles(once);
    expectClearOfBoxes(geometry, once);
    const runs = 20;
    const started = performance.now();
    for (let run = 0; run < runs; run += 1) routeLines(geometry, lines, map);
    const each = (performance.now() - started) / runs;
    // eslint-disable-next-line no-console -- the prompt asks for the number in the report
    console.info(`MS-04 routeLines, 50 tiles, ${lines.length} lines: ${each.toFixed(2)} ms per run over ${runs} runs`);
    expect(each).toBeLessThan(30);
  });
});
