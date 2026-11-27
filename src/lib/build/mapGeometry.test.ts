import { describe, expect, it } from "vitest";

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";

import {
  INDENT_STEP,
  LEADER_DROP,
  MAP_GEOMETRY_COPY,
  MAP_GRID,
  MAP_WIDTH,
  REGION_INSET,
  TILE_GAP,
  columnLinesOf,
  fitsOf,
  fitsWidth,
  geometryOf,
  minBoxWidth,
  neighboursAt,
  phoneOrder,
  slotsOf,
  snapWidth,
  snapX,
  snapY,
  widthPresets,
  type MapGeometry,
  type Measure,
  type Rect,
} from "./mapGeometry";
import { moveEdge, pathTo, type MapBox, type MapLayout, type MapNode, type MapRegion, type MapSplit } from "./mapLayout";

/* ── builders ── */

const box = (id: string, tiles: string[] = [], over: Partial<MapBox> = {}): MapBox => ({ kind: "box", id, tiles, layout: "stack", indent: {}, show: {}, notes: {}, ...over });
const split = (id: string, dir: MapSplit["dir"], children: MapNode[], sizes?: number[]): MapSplit => ({
  kind: "split",
  id,
  dir,
  sizes: sizes ?? children.map(() => (dir === "across" ? 1 / children.length : 0)),
  children,
});
const region = (id: string, of: MapRegion["of"], child: MapNode, over: Partial<MapRegion> = {}): MapRegion => ({ kind: "region", id, of, child, ...over });
const layout = (root: MapNode, over: Partial<MapLayout> = {}): MapLayout => ({
  v: 1,
  width: 960,
  background: "grey",
  dotGrid: true,
  numbers: "build",
  root,
  outlines: [],
  twoWay: [],
  twoWayDismissed: [],
  hiddenLinks: [],
  linkGutters: {},
  ...over,
});

/* ── the measure `01-finished-map.png` was drawn with ── */

const HEIGHTS: Record<string, number> = { prompt: 113, file: 118, tool: 118, agent: 140, code: 145, check: 148, result: 118 };
const PROMPT_WITH_SETTINGS = 220;
const MIN_TILE = 200;
const HEAD = 48;
const NOTE_WIDTH = 200;

function measureFor(name: "supportInbox" | "fiftyTiles"): Measure {
  const fixture = mapSandboxFixture(name);
  const kinds = new Map<string, string>(fixture.steps.map((step) => [step.id, step.kind]));
  fixture.results.forEach((result) => kinds.set(result.id, "result"));
  return {
    tile: (id, _width, parts) => {
      const kind = kinds.get(id) ?? "prompt";
      return { height: kind === "prompt" && parts.includes("settings") ? PROMPT_WITH_SETTINGS : HEIGHTS[kind] ?? HEIGHTS.prompt, minWidth: MIN_TILE };
    },
    chrome: (node) => ({ head: node.kind === "box" ? HEAD : 0, noteWidth: NOTE_WIDTH }),
  };
}
const INBOX = measureFor("supportInbox");

/** The support inbox's plain arrangement: Part A with S1 and S2 side by side, Part B with S3 above the Result. */
const inbox = (over: Partial<MapLayout> = {}) =>
  layout(
    split("m-root", "down", [
      region("m-a", { part: "ws-a" }, split("m-a-row", "across", [box("m-s1", ["p1", "f2", "p3"]), box("m-s2", ["p4", "c5", "k6"])])),
      region("m-b", { part: "ws-b" }, split("m-b-col", "down", [box("m-s3", ["a7", "t8"], { layout: "across" }), box("m-result", ["r9"])])),
    ]),
    over,
  );

/** The same without frames, so the leaves and gutters alone fill the canvas. */
const inboxBare = (over: Partial<MapLayout> = {}) =>
  layout(
    split("m-root", "down", [
      split("m-a-row", "across", [box("m-s1", ["p1", "f2", "p3"]), box("m-s2", ["p4", "c5", "k6"])]),
      box("m-s3", ["a7", "t8"], { layout: "across" }),
      box("m-result", ["r9"]),
    ]),
    over,
  );

/** The 50-tile build: one frame per part, sessions that ran beside the one above them side by side, the Result last. */
function fiftyLayout(width: number = MAP_WIDTH.standard): MapLayout {
  const fixture = mapSandboxFixture("fiftyTiles");
  const meta = fixture.making.sessions_meta as Record<string, { workstream: string; withAbove?: boolean }>;
  const keys = fixture.making.session_order as string[];
  const tilesOf = (key: string) => fixture.steps.filter((step) => step.session === key).map((step) => step.id);
  const parts: MapNode[] = [];
  for (const part of ["ws-a", "ws-b", "ws-c"]) {
    const rows: MapNode[][] = [];
    keys.filter((key) => meta[key].workstream === part).forEach((key) => {
      const made = box(`m-${key}`, tilesOf(key));
      if (meta[key].withAbove && rows.length) rows[rows.length - 1].push(made);
      else rows.push([made]);
    });
    const kids = rows.map((row, at) => (row.length === 1 ? row[0] : split(`m-${part}-row${at}`, "across", row)));
    parts.push(region(`m-${part}`, { part }, kids.length === 1 ? kids[0] : split(`m-${part}-col`, "down", kids)));
  }
  parts.push(box("m-result", fixture.results.map((result) => result.id)));
  return layout(split("m-root", "down", parts), { width });
}

/* ── checks ── */

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const area = (rect: Rect) => rect.width * rect.height;

/** No two drawn nodes overlap unless one holds the other. */
function expectNoOverlaps(map: MapLayout, geometry: MapGeometry) {
  const ids = Object.keys(geometry.nodes);
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue;
      const nested = pathTo(map, a).some((node) => node.id === b) || pathTo(map, b).some((node) => node.id === a);
      if (!nested) expect(overlap(geometry.nodes[a], geometry.nodes[b]), `${a} and ${b}`).toBe(0);
    }
  }
}

/** Without frames: the leaves and the gutters cover the root exactly, with nothing overlapping. */
function expectFilled(geometry: MapGeometry) {
  const pieces: Rect[] = [...geometry.leaves.map((id) => geometry.nodes[id]), ...geometry.gutters];
  for (let a = 0; a < pieces.length; a += 1) for (let b = a + 1; b < pieces.length; b += 1) expect(overlap(pieces[a], pieces[b])).toBe(0);
  expect(pieces.reduce((total, piece) => total + area(piece), 0)).toBeCloseTo(geometry.width * geometry.height, 3);
}

/* ── tests ── */

describe("MAP_GRID and MAP_WIDTH", () => {
  it("hold the README's measures", () => {
    expect(MAP_GRID).toEqual({ columns: 12, rhythm: 8, gutter: 24, padding: 20, snap: 6, minBoxColumns: 2, minBoxPx: 160 });
    expect(MAP_WIDTH).toEqual({ narrow: 720, standard: 960, wide: 1200, min: 640, max: 1600 });
  });

  it("puts 12 columns with gutters between them across the width", () => {
    const lines = columnLinesOf(960);
    expect(lines).toHaveLength(24);
    expect(lines[0]).toBe(0);
    expect(lines[1]).toBe(58);
    expect(lines[2]).toBe(82);
    expect(lines[23]).toBe(960);
  });

  it("keeps a box at least 2 columns wide and never under 160px", () => {
    expect(minBoxWidth(960)).toBe(160);
    expect(minBoxWidth(1600)).toBeCloseTo(2 * ((1600 - 11 * 24) / 12) + 24, 6);
  });
});

describe("geometryOf: the support inbox at 960", () => {
  const geometry = geometryOf(inbox(), INBOX);
  const { nodes } = geometry;

  it("puts S1 and S2 side by side with the same top and height", () => {
    expect(nodes["m-s1"].y).toBe(nodes["m-s2"].y);
    expect(nodes["m-s1"].height).toBe(nodes["m-s2"].height);
    expect(nodes["m-s2"].x).toBe(nodes["m-s1"].x + nodes["m-s1"].width + MAP_GRID.gutter);
  });

  it("makes the row as tall as the taller box: S2's code and check outgrow S1", () => {
    const s2 = 2 * MAP_GRID.padding + HEAD + 113 + 145 + 148 + 2 * TILE_GAP;
    expect(nodes["m-s2"].height).toBe(Math.ceil(s2 / 8) * 8);
  });

  it("spans the Result across Part B's full width", () => {
    expect(nodes["m-result"].x).toBe(REGION_INSET);
    expect(nodes["m-result"].width).toBe(960 - 2 * REGION_INSET);
    expect(nodes["m-s3"].width).toBe(nodes["m-result"].width);
  });

  it("insets each frame's child by the frame's padding", () => {
    expect(nodes["m-a-row"]).toEqual({ x: nodes["m-a"].x + REGION_INSET, y: nodes["m-a"].y + REGION_INSET, width: nodes["m-a"].width - 2 * REGION_INSET, height: nodes["m-a"].height - 2 * REGION_INSET });
  });

  it("rounds every height to the 8px rhythm, and the canvas is the root's height", () => {
    for (const rect of Object.values(nodes)) expect(rect.height % 8).toBe(0);
    expect(geometry.height).toBe(nodes["m-root"].height);
    expect(nodes["m-root"]).toEqual({ x: 0, y: 0, width: 960, height: geometry.height });
  });

  it("gives every placed tile a slot inside its box, in build order, 16px apart", () => {
    expect(Object.keys(geometry.tiles).sort()).toEqual(["a7", "c5", "f2", "k6", "p1", "p3", "p4", "r9", "t8"]);
    const p1 = geometry.tiles.p1;
    const f2 = geometry.tiles.f2;
    expect(p1).toMatchObject({ box: "m-s1", level: 0, x: nodes["m-s1"].x + MAP_GRID.padding, y: nodes["m-s1"].y + MAP_GRID.padding + HEAD, height: 113 });
    expect(f2.y).toBe(p1.y + p1.height + TILE_GAP);
    expect(geometry.tiles.a7.y).toBe(geometry.tiles.t8.y);
  });

  it("lists the gutters and shared edges", () => {
    expect(geometry.edges).toContainEqual({ axis: "width", splitId: "m-a-row", index: 0, x: nodes["m-s1"].x + nodes["m-s1"].width, top: nodes["m-a-row"].y, bottom: nodes["m-a-row"].y + nodes["m-a-row"].height });
    expect(geometry.edges.filter((edge) => edge.axis === "height" && edge.splitId === "m-root")).toHaveLength(2);
    expect(geometry.gutters.filter((gutter) => gutter.dir === "vertical")).toHaveLength(1);
    expect(geometry.gutters.filter((gutter) => gutter.dir === "horizontal")).toHaveLength(2);
    expect(geometry.leaves).toEqual(["m-s1", "m-s2", "m-s3", "m-result"]);
  });

  it("overlaps nothing except a node and what it holds", () => expectNoOverlaps(inbox(), geometry));
});

describe("geometryOf: filled and proportional", () => {
  it("fills the canvas with leaves and gutters only", () => {
    expectFilled(geometryOf(inboxBare(), INBOX));
    const fifty = fiftyLayout();
    expectNoOverlaps(fifty, geometryOf(fifty, measureFor("fiftyTiles")));
  });

  it("keeps every proportion and every order of boxes from 960 to 720", () => {
    const map = layout(
      split("m-root", "down", [
        split("m-row", "across", [box("m-a", ["p1"]), box("m-b", ["p4"]), box("m-c", ["a7"])], [0.25, 0.45, 0.3]),
        box("m-d", ["r9"]),
      ]),
    );
    const wide = geometryOf(map, INBOX);
    const narrow = geometryOf({ ...map, width: MAP_WIDTH.narrow }, INBOX);
    expectFilled(narrow);
    expect(phoneOrder(map, narrow)).toEqual(phoneOrder(map, wide));
    for (const [geometry, width] of [[wide, 960], [narrow, 720]] as const) {
      const room = width - 2 * MAP_GRID.gutter;
      ["m-a", "m-b", "m-c"].forEach((id, at) => {
        expect(Math.abs(geometry.nodes[id].width - [0.25, 0.45, 0.3][at] * room)).toBeLessThanOrEqual(MAP_GRID.snap + 1);
      });
      expect(geometry.nodes["m-a"].x).toBeLessThan(geometry.nodes["m-b"].x);
      expect(geometry.nodes["m-b"].x).toBeLessThan(geometry.nodes["m-c"].x);
    }
  });

  it("lands an edge within 6px of a grid line on it, and leaves one further away", () => {
    const room = 960 - MAP_GRID.gutter;
    // Column 4 ends at 304 and column 9 at 714. 300 is 4px off it; 704 is 10px off.
    const near = geometryOf(layout(split("m-root", "across", [box("m-a"), box("m-b")], [300 / room, 1 - 300 / room])), INBOX);
    expect(near.nodes["m-a"].width).toBe(304);
    expect(near.nodes["m-b"].x).toBe(304 + MAP_GRID.gutter);
    expect(columnLinesOf(960)).toContain(304);
    expect(columnLinesOf(960)).toContain(328);
    const far = geometryOf(layout(split("m-root", "across", [box("m-a"), box("m-b")], [704 / room, 1 - 704 / room])), INBOX);
    expect(far.nodes["m-a"].width).toBe(704);
    expect(columnLinesOf(960)).not.toContain(704);
  });

  it("makes a row its tallest box's height, and collapsing that box shrinks the row", () => {
    const tall = box("m-tall", ["p4", "c5", "k6"]);
    const map = (collapsed: boolean) => layout(split("m-root", "down", [split("m-row", "across", [box("m-short", ["p1"]), { ...tall, collapsed }]), box("m-end", ["r9"])]));
    const open = geometryOf(map(false), INBOX);
    expect(open.nodes["m-row"].height).toBe(open.nodes["m-tall"].height);
    expect(open.nodes["m-short"].height).toBe(open.nodes["m-tall"].height);
    const shut = geometryOf(map(true), INBOX);
    const short = Math.ceil((2 * MAP_GRID.padding + HEAD + 113) / 8) * 8;
    expect(shut.nodes["m-row"].height).toBe(short);
    expect(shut.nodes["m-tall"].height).toBe(short);
    expect(shut.tiles.p4).toBeUndefined();
    expect(shut.height).toBeLessThan(open.height);
  });

  it("draws a collapsed box one line high and a collapsed frame one line high with nothing inside", () => {
    const map = layout(split("m-root", "down", [box("m-one", ["p1"], { collapsed: true }), region("m-f", { session: "typed-s2" }, box("m-in", ["p4"]), { collapsed: true })]));
    const measure: Measure = { ...INBOX, chrome: () => ({ head: 30, noteWidth: 0 }) };
    const geometry = geometryOf(map, measure);
    expect(geometry.nodes["m-one"].height).toBe(32);
    expect(geometry.nodes["m-f"].height).toBe(32);
    expect(geometry.nodes["m-in"]).toBeUndefined();
    expect(geometry.tiles).toEqual({});
    expect(geometry.leaves).toEqual(["m-one", "m-f"]);
  });

  it("adds a down split's extra height to its child, and puts a column's spare height into its last child", () => {
    const map = layout(
      split("m-root", "across", [
        split("m-col", "down", [box("m-a", ["p1"]), box("m-b", ["p4"])], [40, 0]),
        box("m-tall", ["p4", "c5", "k6", "a7"]),
      ]),
    );
    const geometry = geometryOf(map, INBOX);
    const plain = Math.ceil((2 * MAP_GRID.padding + HEAD + 113) / 8) * 8;
    expect(geometry.nodes["m-a"].height).toBe(Math.ceil((2 * MAP_GRID.padding + HEAD + 113 + 40) / 8) * 8);
    expect(geometry.nodes["m-b"].height).toBeGreaterThan(plain);
    expect(geometry.nodes["m-b"].y + geometry.nodes["m-b"].height).toBe(geometry.nodes["m-tall"].height);
    expectFilled(geometry);
  });

  it("gives a frame room for its own title and explanation", () => {
    const measure: Measure = { ...INBOX, chrome: (node) => ({ head: node.kind === "region" ? 40 : HEAD, noteWidth: NOTE_WIDTH }) };
    const geometry = geometryOf(layout(region("m-f", { part: "ws-a" }, box("m-in", ["p1"]))), measure);
    expect(geometry.nodes["m-in"].y).toBe(REGION_INSET + 40);
    expect(geometry.height).toBe(geometry.nodes["m-in"].height + 2 * REGION_INSET + 40);
  });
});

describe("minimum widths", () => {
  it("lets the neighbours give up space for a box under the minimum, and reports it", () => {
    const map = layout(split("m-root", "across", [box("m-a"), box("m-b"), box("m-c")], [0.05, 0.5, 0.45]));
    const geometry = geometryOf(map, INBOX);
    expect(geometry.nodes["m-a"].width).toBeGreaterThanOrEqual(minBoxWidth(960) - 1);
    expect(geometry.nodes["m-b"].width / geometry.nodes["m-c"].width).toBeCloseTo(0.5 / 0.45, 1);
    expectFilled(geometry);
    expect(fitsWidth(map, 960)).toBe(MAP_GEOMETRY_COPY.boxTooNarrow(160));
    expect(fitsOf(map)).toBe(MAP_GEOMETRY_COPY.boxTooNarrow(160));
  });

  it("refuses a canvas narrower than its boxes need, and accepts the plain arrangement", () => {
    const six = layout(split("m-root", "across", ["a", "b", "c", "d", "e"].map((id) => box(`m-${id}`))));
    expect(fitsWidth(six, 720)).toBe(MAP_GEOMETRY_COPY.canvasTooNarrow(5 * 160 + 4 * 24));
    expect(fitsWidth(six, 1200)).toBeNull();
    expect(fitsOf(inbox())).toBeNull();
    expect(fitsWidth(inbox(), MAP_WIDTH.min)).toBeNull();
  });

  it("stops MS-01's edge drag at the minimum when given `fitsOf`", () => {
    const map = layout(split("m-root", "across", [box("m-a"), box("m-b")]));
    const result = moveEdge(map, "m-root", 0, -0.49, { fits: fitsOf });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const geometry = geometryOf(result.layout, INBOX);
    expect(geometry.nodes["m-a"].width).toBeGreaterThanOrEqual(159);
    expect(geometry.nodes["m-a"].width).toBeLessThan(170);
  });
});

describe("slotsOf: inside a box", () => {
  it("stacks tiles full width, insetting an indented one 24px per level", () => {
    const laid = slotsOf(box("m-s2", ["p4", "c5", "k6"], { indent: { k6: 1 } }), 468, INBOX);
    expect(laid.ok).toBe(true);
    if (!laid.ok) return;
    expect(laid.slots.p4).toEqual({ x: 20, y: 20 + HEAD, width: 428, height: 113, box: "m-s2", level: 0 });
    expect(laid.slots.k6).toMatchObject({ x: 20 + INDENT_STEP, width: 428 - INDENT_STEP, level: 1 });
    expect(laid.height).toBe(113 + 145 + 148 + 2 * TILE_GAP);
  });

  it("grows a prompt that shows its settings", () => {
    const laid = slotsOf(box("m-s2", ["p4"], { show: { p4: ["text", "settings"] } }), 468, INBOX);
    expect(laid.ok && laid.slots.p4.height).toBe(PROMPT_WITH_SETTINGS);
  });

  it("puts notes in the notes column beside their tile, top-aligned, with the leader on the tile's edge", () => {
    const left = slotsOf(box("m-s1", ["p1", "f2"], { notesSide: "left", notes: { p1: "Starts the build" } }), 744, INBOX);
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.slots.p1).toMatchObject({ x: 20 + NOTE_WIDTH + TILE_GAP, width: 744 - 40 - NOTE_WIDTH - TILE_GAP });
    expect(left.notes.p1).toEqual({ tile: "p1", box: "m-s1", side: "left", x: 20, y: left.slots.p1.y, width: NOTE_WIDTH, leader: { x: left.slots.p1.x, y: left.slots.p1.y + LEADER_DROP } });
    expect(left.notes.f2).toBeUndefined();
    const right = slotsOf(box("m-s2", ["k6"], { notesSide: "right", notes: { k6: "Sits under Code 5" } }), 744, INBOX);
    if (!right.ok) throw new Error("refused");
    expect(right.slots.k6.x).toBe(20);
    expect(right.notes.k6.x).toBe(20 + right.slots.k6.width + TILE_GAP);
    expect(right.notes.k6.leader.x).toBe(right.slots.k6.x + right.slots.k6.width);
  });

  it("places tiles across, sharing the width, tops aligned", () => {
    const laid = slotsOf(box("m-s3", ["a7", "t8"], { layout: "across" }), 928, INBOX);
    if (!laid.ok) throw new Error("refused");
    expect(laid.slots.a7.width).toBe(laid.slots.t8.width);
    expect(laid.slots.t8.x).toBe(laid.slots.a7.x + laid.slots.a7.width + TILE_GAP);
    expect(laid.slots.a7.y).toBe(laid.slots.t8.y);
    expect(laid.height).toBe(140);
  });

  it("refuses Across with the width the box would need when tiles would be too narrow", () => {
    const across = box("m-s2", ["p4", "c5", "k6"], { layout: "across" });
    expect(slotsOf(across, 400, INBOX)).toEqual({ ok: false, needs: 3 * MIN_TILE + 2 * TILE_GAP + 2 * MAP_GRID.padding });
    expect(slotsOf({ ...across, notesSide: "right" }, 400, INBOX)).toEqual({ ok: false, needs: 3 * MIN_TILE + 2 * TILE_GAP + 2 * MAP_GRID.padding + NOTE_WIDTH + TILE_GAP });
    expect(slotsOf(across, 672, INBOX).ok).toBe(true);
    // The canvas draws it stacked meanwhile and says what it needs.
    const geometry = geometryOf(layout(split("m-root", "across", [box("m-a", ["p1"]), across], [0.5, 0.5])), INBOX);
    expect(geometry.narrow).toEqual({ "m-s2": 672 });
    expect(geometry.tiles.c5.y).toBeGreaterThan(geometry.tiles.p4.y);
  });

  it("fills a grid row by row in build order, each row as tall as its tallest tile", () => {
    const laid = slotsOf(box("m-g", ["p4", "c5", "k6"], { layout: "grid", gridColumns: 2 }), 468, INBOX);
    if (!laid.ok) throw new Error("refused");
    expect(laid.slots.p4.y).toBe(laid.slots.c5.y);
    expect(laid.slots.k6.x).toBe(laid.slots.p4.x);
    expect(laid.slots.k6.y).toBe(laid.slots.p4.y + 145 + TILE_GAP);
    const three = slotsOf(box("m-g", ["p4", "c5", "k6"], { layout: "grid", gridColumns: 3 }), 768, INBOX);
    if (!three.ok) throw new Error("refused");
    expect(new Set(Object.values(three.slots).map((slot) => slot.y)).size).toBe(1);
  });

  it("lays out nothing for an empty or collapsed box", () => {
    expect(slotsOf(box("m-text"), 400, INBOX)).toEqual({ ok: true, height: 0, slots: {}, notes: {} });
    expect(slotsOf(box("m-c", ["p1"], { collapsed: true }), 400, INBOX)).toEqual({ ok: true, height: 0, slots: {}, notes: {} });
  });
});

describe("neighboursAt", () => {
  it("finds boxes facing each other across a gutter or a frame, with the overlap", () => {
    const geometry = geometryOf(inbox(), INBOX);
    expect(neighboursAt(geometry, "m-s1")).toEqual([
      { id: "m-s2", side: "right", overlap: geometry.nodes["m-s1"].height },
      { id: "m-s3", side: "bottom", overlap: geometry.nodes["m-s1"].width },
    ]);
    expect(neighboursAt(geometry, "m-result").map((found) => found.id)).toEqual(["m-s3"]);
    expect(neighboursAt(geometry, "m-gone")).toEqual([]);
  });

  it("finds a partial edge across branches", () => {
    const map = layout(
      split("m-root", "across", [
        split("m-l", "down", [box("m-a", ["p1"]), box("m-b", ["p4", "c5"])]),
        split("m-r", "down", [box("m-c", ["p4", "c5", "k6"]), box("m-d", ["p1"])]),
      ]),
    );
    const geometry = geometryOf(map, INBOX);
    const found = neighboursAt(geometry, "m-b");
    const c = found.find((item) => item.id === "m-c");
    expect(c?.side).toBe("right");
    expect(c?.overlap).toBeGreaterThan(0);
    expect(c?.overlap).toBeLessThan(geometry.nodes["m-b"].height);
    expect(found.find((item) => item.id === "m-d")?.side).toBe("right");
  });
});

describe("snapping", () => {
  const geometry = geometryOf(inboxBare(), INBOX);
  const s1 = geometry.nodes["m-s1"];

  it("snaps x to the nearest grid line or edge within 6px, with a guide", () => {
    expect(snapX(geometry, 60)).toEqual({ x: 58, guide: { x: 58, from: 0, to: geometry.height } });
    const edge = snapX(geometry, s1.x + s1.width + 3);
    expect(edge.x).toBe(s1.x + s1.width);
    expect(edge.guide).toEqual({ x: s1.x + s1.width, from: s1.y, to: s1.y + s1.height });
    expect(snapX(geometry, 70)).toEqual({ x: 70, guide: null });
  });

  it("ignores the edges it is told to", () => {
    const right = s1.x + s1.width;
    expect(snapX(geometry, right + 3, ["m-s1"]).guide?.from).toBe(0);
    expect(snapX(geometry, right + 3, ["m-a-row"]).guide?.from).toBe(0);
  });

  it("snaps y to a box edge within 6px, otherwise to the 8px rhythm with no guide", () => {
    const bottom = s1.y + s1.height;
    expect(snapY(geometry, bottom - 4)).toEqual({ y: bottom, guide: { y: bottom, from: 0, to: 960 } });
    const free = geometry.nodes["m-s3"].y + 50;
    expect(snapY(geometry, free + 0.5)).toEqual({ y: Math.round((free + 0.5) / 8) * 8, guide: null });
  });
});

describe("widths and phones", () => {
  it("offers narrow, standard and wide", () => {
    expect(widthPresets()).toEqual([{ key: "narrow", width: 720 }, { key: "standard", width: 960 }, { key: "wide", width: 1200 }]);
  });

  it("snaps a free width to a preset within 24px, otherwise to a 12px grid step, between min and max", () => {
    expect(snapWidth(940)).toBe(960);
    expect(snapWidth(1224)).toBe(1200);
    expect(snapWidth(1000)).toBe(996);
    expect(snapWidth(1100) % 12).toBe(0);
    expect(snapWidth(100)).toBe(MAP_WIDTH.min);
    expect(snapWidth(9000)).toBe(MAP_WIDTH.max);
    expect(snapWidth(Number.NaN)).toBe(MAP_WIDTH.standard);
  });

  it("stacks boxes on a phone top to bottom, left to right", () => {
    const geometry = geometryOf(inbox(), INBOX);
    expect(phoneOrder(inbox(), geometry)).toEqual(["m-s1", "m-s2", "m-s3", "m-result"]);
  });
});

describe("the 50-tile build", () => {
  it("places every tile and computes in under 20 ms", () => {
    const map = fiftyLayout();
    const measure = measureFor("fiftyTiles");
    const once = geometryOf(map, measure);
    expect(Object.keys(once.tiles)).toHaveLength(50);
    expectNoOverlaps(map, once);
    const runs = 20;
    const started = performance.now();
    for (let run = 0; run < runs; run += 1) geometryOf(map, measure);
    const each = (performance.now() - started) / runs;
    // eslint-disable-next-line no-console -- the prompt asks for the number in the report
    console.info(`MS-02 geometryOf, 50 tiles: ${each.toFixed(2)} ms per run over ${runs} runs`);
    expect(each).toBeLessThan(20);
  });
});
