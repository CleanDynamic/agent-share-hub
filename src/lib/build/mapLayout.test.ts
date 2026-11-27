import { describe, expect, it } from "vitest";

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";

import { groupKey } from "./graph";
import { SESSION_TITLE_MAX } from "./making";
import {
  MAP_LAYOUT_COPY,
  MAP_LIMITS,
  boxOfTile,
  boxes,
  evenOut,
  frameRegion,
  insertBox,
  insertNode,
  mapLayoutOf,
  mapLayoutRefusal,
  matchSize,
  mergeBoxes,
  moveEdge,
  moveTile,
  neighbours,
  newMapNodeId,
  nodeById,
  normalise,
  openRegion,
  parentOf,
  pathTo,
  placeTile,
  placedTiles,
  removeBox,
  spanBox,
  spanNode,
  splitBox,
  swapBoxes,
  swapNodes,
  type FrameResult,
  type MapBox,
  type MapLayout,
  type MapNode,
  type MapRegion,
  type MapSide,
  type MapSplit,
  type TileOptions,
  type TreeResult,
} from "./mapLayout";
import { MAP_WIDTH } from "./mapGeometry";

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

/** The support inbox map, as `01-finished-map.png` draws it, with every optional field used once. */
const FULL: MapLayout = layout(
  split("m-root", "down", [
    box("m-intro", [], { title: "How it is built", explanation: "Two parts, three sessions." }),
    region(
      "m-part-a",
      { part: "ws-a" },
      split(
        "m-a",
        "across",
        [
          region("m-s1", { session: "s1" }, box("m-b1", ["p1", "f2", "p3"], { notesSide: "left", indent: { f2: 1 }, show: { p1: ["text", "settings"] }, notes: { p1: "Sampled from March." } })),
          box("m-b2", ["p4", "c5", "k6"], { layout: "grid", gridColumns: 2, style: { fill: "amber", border: "dashed", corners: 8 }, collapsed: true }),
        ],
        [0.5, 0.5],
      ),
      { title: "Classify and rules", style: { fill: "grey" } },
    ),
    box("m-b3", ["a7", "t8", "r9"], { layout: "across" }),
  ], [0, 40, 0]),
  {
    width: 1200,
    background: "#141416",
    numbers: "part",
    outlines: ["s3"],
    twoWay: [{ a: { tile: "p1" }, b: { box: "m-b2" } }],
    twoWayDismissed: ["s1|s2"],
    hiddenLinks: ["p3>f2:reads"],
    linkGutters: { "a7>p3:uses": 2 },
  },
);

const read = (map_layout: unknown) => mapLayoutOf({ map_layout });
const root = (value: unknown) => read({ ...FULL, root: value })?.root ?? null;

describe("mapLayoutOf", () => {
  it("gives a valid layout back as it was", () => {
    expect(read(FULL)).toEqual(FULL);
    expect(read(layout(box("only")))).toEqual(layout(box("only")));
  });

  it("is null for no making, no layout, the wrong version, or a root it can't read", () => {
    expect(mapLayoutOf(null)).toBeNull();
    expect(mapLayoutOf("x")).toBeNull();
    expect(mapLayoutOf({})).toBeNull();
    expect(mapLayoutOf({ map_layout: [] })).toBeNull();
    expect(read({ ...FULL, v: 2 })).toBeNull();
    expect(read({ ...FULL, v: "1" })).toBeNull();
    expect(read({ ...FULL, root: undefined })).toBeNull();
    expect(read({ ...FULL, root: { kind: "circle", id: "x" } })).toBeNull();
    expect(read({ ...FULL, root: split("s", "across", [{ kind: "circle" } as never, { kind: "box" } as never]) })).toBeNull();
  });

  it("drops a node of an unknown kind and gives its width to the sibling before it", () => {
    const got = root(split("s", "across", [box("a"), box("b"), { kind: "note", id: "n" } as never], [0.2, 0.3, 0.5]));
    expect(got).toEqual(split("s", "across", [box("a"), box("b")], [0.2, 0.8]));
  });

  it("gives a first child's width to the next one", () => {
    const got = root(split("s", "across", [{ kind: "note" } as never, { kind: "note" } as never, box("a"), box("b")], [0.1, 0.2, 0.3, 0.4])) as MapSplit;
    expect(got.children).toEqual([box("a"), box("b")]);
    expect(got.sizes[0]).toBeCloseTo(0.6, 12);
    expect(got.sizes[1]).toBeCloseTo(0.4, 12);
  });

  it("drops a split whose sizes and children differ in number, and a split with a bad direction", () => {
    expect(root(split("s", "across", [box("a"), split("t", "down", [box("b"), box("c")], [0])], [0.5, 0.5]))).toEqual(box("a"));
    expect(root(split("s", "across", [box("a"), { ...split("t", "down", [box("b"), box("c")]), dir: "diagonal" } as never]))).toEqual(box("a"));
    expect(root({ kind: "split", id: "s", dir: "across", sizes: "1", children: [box("a")] })).toBeNull();
  });

  it("drops a box with a tile that isn't a string, or with no id", () => {
    expect(root(split("s", "down", [box("a", ["p1"]), box("b", ["p2", 3 as never])]))).toEqual(box("a", ["p1"]));
    expect(root(split("s", "down", [box("a"), { ...box("b"), id: 4 } as never]))).toEqual(box("a"));
    expect(root(split("s", "down", [box("a"), { ...box("b"), tiles: "p1" } as never]))).toEqual(box("a"));
  });

  it("keeps a split of what is left when two or more children remain, and replaces it by the child when one does", () => {
    const got = root(split("s", "down", [box("a"), { kind: "x" } as never, box("b")], [8, 16, 24]));
    expect(got).toEqual(split("s", "down", [box("a"), box("b")], [8, 24]));
  });

  it("drops a region with no child or no id, and lets a region that frames nothing stand aside", () => {
    expect(root(split("s", "down", [box("a"), region("r", { part: "ws" }, { kind: "x" } as never)]))).toEqual(box("a"));
    expect(root(split("s", "down", [box("a"), { ...region("r", { part: "ws" }, box("b")), id: null } as never]))).toEqual(box("a"));
    expect(root(region("r", { team: "x" } as never, box("b")))).toEqual(box("b"));
    expect(root(region("r", null as never, box("b")))).toEqual(box("b"));
  });

  it("scales across sizes to add up to 1, counts a size under 0 as 0, and shares all-zero sizes", () => {
    expect(root(split("s", "across", [box("a"), box("b")], [2, 6]))).toEqual(split("s", "across", [box("a"), box("b")], [0.25, 0.75]));
    expect(root(split("s", "across", [box("a"), box("b")], [-1, 0.5]))).toEqual(split("s", "across", [box("a"), box("b")], [0, 1]));
    expect(root(split("s", "across", [box("a"), box("b")], [0, "x" as never]))).toEqual(split("s", "across", [box("a"), box("b")], [0.5, 0.5]));
    expect(root(split("s", "down", [box("a"), box("b")], [-8, Number.NaN]))).toEqual(split("s", "down", [box("a"), box("b")], [0, 0]));
  });

  it("clamps the width, and reads a missing width as standard", () => {
    expect(read({ ...FULL, width: 100 })?.width).toBe(MAP_WIDTH.min);
    expect(read({ ...FULL, width: 5000 })?.width).toBe(MAP_WIDTH.max);
    expect(read({ ...FULL, width: "wide" })?.width).toBe(MAP_WIDTH.standard);
  });

  it("reads an unknown background as grey and an unknown numbering as build", () => {
    expect(read({ ...FULL, background: "plaid" })?.background).toBe("grey");
    expect(read({ ...FULL, background: "#12345" })?.background).toBe("grey");
    expect(read({ ...FULL, background: "paper" })?.background).toBe("paper");
    expect(read({ ...FULL, numbers: "roman" })?.numbers).toBe("build");
    expect(read({ ...FULL, numbers: "session" })?.numbers).toBe("session");
    expect(read({ ...FULL, dotGrid: "yes" })?.dotGrid).toBe(false);
  });

  it("keeps a tile in two boxes in its first place only, with its indent, parts and note", () => {
    const got = root(
      split("s", "down", [
        box("a", ["p1", "p2"]),
        box("b", ["p2", "p3", "p3"], { indent: { p2: 1, p3: 2 }, show: { p2: ["code"] }, notes: { p2: "Here too", p3: "Mine" } }),
      ]),
    );
    expect(got).toEqual(split("s", "down", [box("a", ["p1", "p2"]), box("b", ["p3"], { indent: { p3: 2 }, notes: { p3: "Mine" } })]));
  });

  it("reads box fields defensively", () => {
    const got = root({
      ...box("a", ["p1"]),
      layout: "spiral",
      gridColumns: 4,
      notesSide: "top",
      indent: { p1: 4, p2: 2 },
      show: { p1: ["text", "smell", "text"], p2: "code" },
      notes: { p1: 9, p2: "kept" },
      title: 5,
      explanation: "Why",
      style: { fill: "pink", border: "dotted", corners: 5 },
      collapsed: "yes",
    });
    expect(got).toEqual(box("a", ["p1"], { indent: { p2: 2 }, show: { p1: ["text"] }, notes: { p2: "kept" }, explanation: "Why", style: {} }));
    expect(root({ ...box("a"), indent: [], show: null, notes: "x", style: "blue" })).toEqual(box("a"));
  });

  it("reads the lists defensively", () => {
    const got = read({
      ...FULL,
      outlines: ["s1", 2, "s1"],
      twoWay: [{ a: { tile: "p1" }, b: { box: "m-b2" } }, { a: { tile: 1 }, b: { box: "x" } }, null, { a: { tile: "p1" } }],
      twoWayDismissed: "s1|s2",
      hiddenLinks: [null, "a>b:uses"],
      linkGutters: { a: 1, b: -1, c: 1.5, d: "2" },
    });
    expect(got?.outlines).toEqual(["s1"]);
    expect(got?.twoWay).toEqual([{ a: { tile: "p1" }, b: { box: "m-b2" } }]);
    expect(got?.twoWayDismissed).toEqual([]);
    expect(got?.hiddenLinks).toEqual(["a>b:uses"]);
    expect(got?.linkGutters).toEqual({ a: 1 });
    expect(read({ ...FULL, linkGutters: [] })?.linkGutters).toEqual({});
  });

  it("ignores unknown keys everywhere and never removes them", () => {
    const stored = {
      ...FULL,
      later: { a: 1 },
      root: { ...box("a", ["p1"]), glow: true, style: { fill: "blue", shadow: 2 } },
      twoWay: [{ a: { tile: "p1" }, b: { tile: "p2" }, colour: "red" }],
    };
    const got = read(stored) as unknown as Record<string, unknown>;
    expect(got.later).toEqual({ a: 1 });
    expect(got.root).toMatchObject({ glow: true, style: { fill: "blue", shadow: 2 } });
    expect((got.twoWay as unknown[])[0]).toMatchObject({ colour: "red" });
    const deep = read({ ...FULL, root: { ...split("s", "across", [box("a"), { ...region("r", { session: "s1" }, box("b")), tab: "x" } as MapNode]), weight: 3 } }) as unknown as { root: Record<string, unknown> & { children: Record<string, unknown>[] } };
    expect(deep.root.weight).toBe(3);
    expect(deep.root.children[1].tab).toBe("x");
  });

  it("stops at a depth no layout reaches, rather than overflowing", () => {
    let node: unknown = box("leaf");
    for (let at = 0; at < 400; at += 1) node = { kind: "region", id: `r${at}`, of: { part: "ws" }, child: node };
    expect(read({ ...FULL, root: node })).toBeNull();
  });
});

describe("mapLayoutRefusal", () => {
  it("lets a valid layout through", () => {
    expect(mapLayoutRefusal(FULL)).toBeNull();
    expect(mapLayoutRefusal(FULL, (session) => (session === "s3" ? "ws-b" : "ws-a"))).toBeNull();
  });

  it("refuses more than 2,000 nodes", () => {
    const many = split("s", "down", Array.from({ length: MAP_LIMITS.nodes }, (_, at) => box(`b${at}`)));
    expect(mapLayoutRefusal(layout(many))).toBe(MAP_LAYOUT_COPY.tooManyNodes);
    const enough = split("s", "down", Array.from({ length: MAP_LIMITS.nodes - 1 }, (_, at) => box(`b${at}`)));
    expect(mapLayoutRefusal(layout(enough))).toBeNull();
  });

  it("refuses nesting deeper than 24", () => {
    const nest = (depth: number): MapNode => (depth === 1 ? box("leaf") : split(`s${depth}`, depth % 2 ? "across" : "down", [box(`b${depth}`), nest(depth - 1)]));
    expect(mapLayoutRefusal(layout(nest(MAP_LIMITS.depth)))).toBeNull();
    expect(mapLayoutRefusal(layout(nest(MAP_LIMITS.depth + 1)))).toBe(MAP_LAYOUT_COPY.tooDeep);
  });

  it("refuses a split with fewer than 2 children", () => {
    expect(mapLayoutRefusal(layout(split("s", "across", [box("a")], [1])))).toBe(MAP_LAYOUT_COPY.fewChildren);
    expect(mapLayoutRefusal(layout(split("s", "down", [], [])))).toBe(MAP_LAYOUT_COPY.fewChildren);
  });

  it("refuses across sizes that don't add up to 1 within 0.001, and sizes that don't match the children", () => {
    expect(mapLayoutRefusal(layout(split("s", "across", [box("a"), box("b")], [0.5, 0.4985])))).toBe(MAP_LAYOUT_COPY.sizes);
    expect(mapLayoutRefusal(layout(split("s", "across", [box("a"), box("b")], [0.5, 0.4995])))).toBeNull();
    expect(mapLayoutRefusal(layout(split("s", "across", [box("a"), box("b")], [1])))).toBe(MAP_LAYOUT_COPY.sizes);
    expect(mapLayoutRefusal(layout(split("s", "down", [box("a"), box("b")], [0, -1])))).toBe(MAP_LAYOUT_COPY.sizes);
    expect(mapLayoutRefusal(layout(split("s", "down", [box("a"), box("b")], [0, 400])))).toBeNull();
  });

  it("refuses two nodes with the same id", () => {
    expect(mapLayoutRefusal(layout(split("s", "down", [box("a"), box("a")])))).toBe(MAP_LAYOUT_COPY.sameId);
    expect(mapLayoutRefusal(layout(split("a", "down", [box("a"), box("b")])))).toBe(MAP_LAYOUT_COPY.sameId);
  });

  it("refuses a tile in two boxes", () => {
    expect(mapLayoutRefusal(layout(split("s", "down", [box("a", ["p1"]), box("b", ["p2", "p1"])])))).toBe(MAP_LAYOUT_COPY.tileTwice);
    expect(mapLayoutRefusal(layout(box("a", ["p1", "p1"])))).toBe(MAP_LAYOUT_COPY.tileTwice);
  });

  it("refuses a region inside a region of the same kind", () => {
    expect(mapLayoutRefusal(layout(region("r", { part: "a" }, region("q", { part: "b" }, box("x")))))).toBe(MAP_LAYOUT_COPY.regionInRegion);
    expect(mapLayoutRefusal(layout(region("r", { session: "a" }, split("s", "down", [box("y"), region("q", { session: "b" }, box("x"))]))))).toBe(MAP_LAYOUT_COPY.regionInRegion);
    expect(mapLayoutRefusal(layout(region("r", { part: "a" }, region("q", { session: "s" }, box("x")))))).toBeNull();
  });

  it("refuses a session region outside its part's region when that part is framed, or inside another part's", () => {
    const partOf = (session: string) => ({ s1: "ws-a", s2: "ws-a", s3: "ws-b" })[session];
    const outside = layout(split("s", "down", [region("pa", { part: "ws-a" }, region("r1", { session: "s1" }, box("b1"))), region("r2", { session: "s2" }, box("b2"))]));
    expect(mapLayoutRefusal(outside, partOf)).toBe(MAP_LAYOUT_COPY.sessionOutsidePart);
    // Without the build's parts the check can't be made.
    expect(mapLayoutRefusal(outside)).toBeNull();
    const wrongPart = layout(region("pa", { part: "ws-a" }, split("s", "down", [region("r1", { session: "s1" }, box("b1")), region("r3", { session: "s3" }, box("b3"))])));
    expect(mapLayoutRefusal(wrongPart, partOf)).toBe(MAP_LAYOUT_COPY.sessionOutsidePart);
    // Part B isn't framed, so its session may sit loose.
    const loose = layout(split("s", "down", [region("pa", { part: "ws-a" }, region("r1", { session: "s1" }, box("b1"))), region("r3", { session: "s3" }, box("b3"))]));
    expect(mapLayoutRefusal(loose, partOf)).toBeNull();
  });

  it("refuses a title over 80 characters, an explanation over 280 and a note over 200", () => {
    expect(MAP_LIMITS.title).toBe(SESSION_TITLE_MAX);
    expect(mapLayoutRefusal(layout(box("a", [], { title: "x".repeat(80) })))).toBeNull();
    expect(mapLayoutRefusal(layout(box("a", [], { title: "x".repeat(81) })))).toBe(MAP_LAYOUT_COPY.title);
    expect(mapLayoutRefusal(layout(region("r", { part: "a" }, box("b"), { title: "x".repeat(81) })))).toBe(MAP_LAYOUT_COPY.title);
    expect(mapLayoutRefusal(layout(box("a", [], { explanation: "x".repeat(280) })))).toBeNull();
    expect(mapLayoutRefusal(layout(box("a", [], { explanation: "x".repeat(281) })))).toBe(MAP_LAYOUT_COPY.explanation);
    expect(mapLayoutRefusal(layout(region("r", { part: "a" }, box("b"), { explanation: "x".repeat(281) })))).toBe(MAP_LAYOUT_COPY.explanation);
    expect(mapLayoutRefusal(layout(box("a", ["p1"], { notes: { p1: "x".repeat(200) } })))).toBeNull();
    expect(mapLayoutRefusal(layout(box("a", ["p1"], { notes: { p1: "x".repeat(201) } })))).toBe(MAP_LAYOUT_COPY.note);
  });

  it("refuses stored JSON over 256 KB", () => {
    const big = layout(box("a"), { hiddenLinks: Array.from({ length: 12_000 }, (_, at) => `tile-${at}>other-${at}:uses`) });
    expect(JSON.stringify(big).length).toBeGreaterThan(MAP_LIMITS.bytes);
    expect(mapLayoutRefusal(big)).toBe(MAP_LAYOUT_COPY.tooLarge);
  });

  it("reads what it reads into something it accepts", () => {
    const messy = { ...FULL, root: split("s", "across", [box("a", ["p1"]), box("b", ["p1"]), { kind: "x" } as never], [3, 3, 4]) };
    const got = read(messy) as MapLayout;
    expect(mapLayoutRefusal(got)).toBeNull();
  });
});

describe("newMapNodeId", () => {
  it("is m- and a uuid, new each time", () => {
    const id = newMapNodeId();
    expect(id).toMatch(/^m-[0-9a-f-]{36}$/);
    expect(newMapNodeId()).not.toBe(id);
  });
});

/* ── MS-01: the split tree ── */

/** Full and normal: every split has two or more children with a size each, `across` sizes add up to 1, sizes are never under
 *  0, and no split holds a split of its own direction. */
function expectFull(value: MapLayout) {
  const go = (node: MapNode) => {
    if (node.kind === "box") return;
    if (node.kind === "region") return go(node.child);
    expect(node.children.length, `split ${node.id} has two or more children`).toBeGreaterThanOrEqual(2);
    expect(node.sizes).toHaveLength(node.children.length);
    node.sizes.forEach((size) => expect(size).toBeGreaterThanOrEqual(0));
    if (node.dir === "across") expect(Math.abs(node.sizes.reduce((sum, size) => sum + size, 0) - 1)).toBeLessThan(1e-9);
    node.children.forEach((child) => expect(child.kind === "split" && child.dir === node.dir, `split ${child.id} inside a split of its direction`).toBe(false));
    node.children.forEach(go);
  };
  go(value.root);
  const ids = new Set<string>();
  const walkIds = (node: MapNode) => {
    expect(ids.has(node.id), `id ${node.id} once`).toBe(false);
    ids.add(node.id);
    if (node.kind === "split") node.children.forEach(walkIds);
    if (node.kind === "region") walkIds(node.child);
  };
  walkIds(value.root);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
  }
  return value;
}

/** An `ok` result's layout, after checking it is full. */
function okLayout(result: TreeResult | FrameResult): MapLayout {
  if (!result.ok) throw new Error(`refused: ${(result as { reason: string }).reason}`);
  expectFull(result.layout);
  return result.layout;
}

const refused = (result: TreeResult | FrameResult): string => {
  expect(result.ok).toBe(false);
  return (result as { reason: string }).reason;
};

/** Ids made one after another: n1, n2, … */
const counter = () => {
  let next = 0;
  return () => `n${(next += 1)}`;
};

/** Tiles are `<session>-<n>`; their build order is n. */
const sessionOf = (tile: string) => tile.split("-")[0];
const buildOrder = (tile: string) => Number(tile.split("-")[1]);
const tileOpts = (over: Partial<TileOptions> & { beside?: { id: string; side: MapSide } } = {}) => ({ sessionOf, buildOrder, newId: counter(), ...over });

/** Three boxes side by side: A (s1), B (s1), C (s2), at 0.2, 0.3, 0.5. */
const ROW = () => deepFreeze(layout(split("row", "across", [box("A", ["s1-1", "s1-2"]), box("B", ["s1-3"]), box("C", ["s2-4"])], [0.2, 0.3, 0.5])));

/** A column of two rows: row 1 across (A, B), row 2 the box C. */
const GRID = () =>
  deepFreeze(layout(split("col", "down", [split("r1", "across", [box("A", ["s1-1"]), box("B", ["s2-2"])], [0.5, 0.5]), box("C", ["s1-3", "s1-4"])], [0, 16])));

describe("normalise", () => {
  it("replaces a split of one child by the child and flattens a split of its own direction", () => {
    const messy = layout(
      split("root", "across", [split("one", "down", [box("a")], [0]), split("inner", "across", [box("b"), box("c")], [0.25, 0.75])], [0.5, 0.5]),
    );
    const got = normalise(deepFreeze(messy));
    expect(got.root).toEqual(split("root", "across", [box("a"), box("b"), box("c")], [0.5, 0.125, 0.375]));
    expectFull(got);
  });

  it("keeps extra heights through a flattened down split, giving the inner split's own to its last child", () => {
    const got = normalise(layout(split("root", "down", [box("a"), split("inner", "down", [box("b"), box("c")], [8, 16])], [0, 40])));
    expect(got.root).toEqual(split("root", "down", [box("a"), box("b"), box("c")], [0, 8, 56]));
  });

  it("doesn't flatten through a region", () => {
    const value = layout(split("root", "across", [box("a"), region("r", { session: "s" }, split("inner", "across", [box("b"), box("c")]))]));
    expect(normalise(value)).toEqual(value);
  });
});

describe("finding things", () => {
  const value = GRID();

  it("nodeById, parentOf, pathTo", () => {
    expect(nodeById(value, "B")).toEqual(box("B", ["s2-2"]));
    expect(nodeById(value, "nope")).toBeNull();
    expect(parentOf(value, "B")).toMatchObject({ parent: { id: "r1" }, index: 1 });
    expect(parentOf(value, "col")).toBeNull();
    expect(parentOf(value, "nope")).toBeNull();
    expect(pathTo(value, "B").map((node) => node.id)).toEqual(["col", "r1", "B"]);
    expect(pathTo(value, "nope")).toEqual([]);
    const framed = layout(region("f", { part: "p" }, box("x")));
    expect(parentOf(framed, "x")).toMatchObject({ parent: { id: "f" }, index: 0 });
  });

  it("boxOfTile, placedTiles, boxes in tree order", () => {
    expect(boxOfTile(value, "s1-4")?.id).toBe("C");
    expect(boxOfTile(value, "s9-9")).toBeNull();
    expect(placedTiles(value)).toEqual(["s1-1", "s2-2", "s1-3", "s1-4"]);
    expect(boxes(value).map((node) => node.id)).toEqual(["A", "B", "C"]);
  });

  it("neighbours: the siblings of one split, with the side", () => {
    expect(neighbours(value, "A")).toEqual([{ id: "B", side: "right" }]);
    expect(neighbours(value, "B")).toEqual([{ id: "A", side: "left" }]);
    expect(neighbours(value, "r1")).toEqual([{ id: "C", side: "bottom" }]);
    expect(neighbours(value, "C")).toEqual([{ id: "r1", side: "top" }]);
    expect(neighbours(value, "col")).toEqual([]);
    expect(neighbours(value, "nope")).toEqual([]);
    const middle = ROW();
    expect(neighbours(middle, "B")).toEqual([{ id: "A", side: "left" }, { id: "C", side: "right" }]);
    // A box in a frame takes the frame's place.
    const framed = layout(split("s", "across", [box("a"), region("f", { session: "s1" }, box("b"))]));
    expect(neighbours(framed, "b")).toEqual([{ id: "a", side: "left" }]);
  });
});

describe("splitBox", () => {
  it("splits a box side by side, keeping its contents and dress, the new half empty", () => {
    const value = deepFreeze(layout(split("col", "down", [box("A", ["s1-1"], { title: "Mine", style: { fill: "blue" } }), box("C")], [0, 0])));
    const result = splitBox(value, "A", "across", 0.25, [], { newId: counter() });
    const got = okLayout(result);
    expect(got.root).toEqual(split("col", "down", [split("n2", "across", [box("A", ["s1-1"], { title: "Mine", style: { fill: "blue" } }), box("n1")], [0.25, 0.75]), box("C")], [0, 0]));
    expect(result.ok && result.changed).toEqual(["A", "n1", "n2"]);
  });

  it("joins a split of the same direction instead of nesting, sharing the box's size at `at`", () => {
    const got = okLayout(splitBox(ROW(), "B", "across", 0.5, [], { newId: counter() }));
    expect(got.root).toEqual(split("row", "across", [box("A", ["s1-1", "s1-2"]), box("B", ["s1-3"]), box("n1"), box("C", ["s2-4"])], [0.2, 0.15, 0.15, 0.5]));
    const down = okLayout(splitBox(GRID(), "C", "down", 0.5, [], { newId: counter() }));
    expect((down.root as MapSplit).sizes).toEqual([0, 16, 0]);
  });

  it("puts tiles of the same session in the new half, taken from where they were, in build order, with their dress", () => {
    const value = deepFreeze(layout(split("row", "across", [box("A", ["s1-1", "s1-2", "s1-5"], { notes: { "s1-5": "Five" } }), box("B", ["s1-3", "s1-4"])], [0.5, 0.5])));
    const got = okLayout(splitBox(value, "A", "down", 0.5, ["s1-5", "s1-4"], tileOpts()));
    expect(boxes(got).map((node) => [node.id, node.tiles])).toEqual([["A", ["s1-1", "s1-2"]], ["n1", ["s1-4", "s1-5"]], ["B", ["s1-3"]]]);
    expect(nodeById(got, "n1")).toMatchObject({ notes: { "s1-5": "Five" } });
    expect(nodeById(got, "A")).toMatchObject({ notes: {} });
  });

  it("refuses a missing box, a split, a cut outside the box, another session's tile, the last tile of a box, and what doesn't fit", () => {
    expect(refused(splitBox(ROW(), "nope", "across"))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(splitBox(ROW(), "row", "across"))).toBe(MAP_LAYOUT_COPY.notABox);
    expect(refused(splitBox(ROW(), "A", "across", 0))).toBe(MAP_LAYOUT_COPY.splitAt);
    expect(refused(splitBox(ROW(), "A", "across", 1))).toBe(MAP_LAYOUT_COPY.splitAt);
    expect(refused(splitBox(ROW(), "A", "across", 0.5, ["s2-4"], tileOpts()))).toBe(MAP_LAYOUT_COPY.differentSessions);
    expect(refused(splitBox(ROW(), "A", "across", 0.5, ["s1-3"], tileOpts()))).toBe(MAP_LAYOUT_COPY.lastTile);
    expect(refused(splitBox(ROW(), "A", "across", 0.5, ["s1-1", "s1-2"], tileOpts()))).toBe(MAP_LAYOUT_COPY.lastTile);
    expect(refused(splitBox(ROW(), "A", "across", 0.5, [], { fits: () => "Needs 160px." }))).toBe("Needs 160px.");
  });
});

describe("removeBox", () => {
  it("gives the second of three's share to the first, and the first's to the second", () => {
    const second = okLayout(removeBox(ROW(), "B"));
    expect(second.root).toEqual(split("row", "across", [box("A", ["s1-1", "s1-2"]), box("C", ["s2-4"])], [0.5, 0.5]));
    const first = okLayout(removeBox(ROW(), "A"));
    expect(first.root).toEqual(split("row", "across", [box("B", ["s1-3"]), box("C", ["s2-4"])], [0.5, 0.5]));
  });

  it("unplaces its tiles, collapses a split left with one child, and takes its frame with it", () => {
    const result = removeBox(GRID(), "B");
    const got = okLayout(result);
    expect(got.root).toEqual(split("col", "down", [box("A", ["s1-1"]), box("C", ["s1-3", "s1-4"])], [0, 16]));
    expect(placedTiles(got)).not.toContain("s2-2");
    expect(result.ok && result.changed).toEqual(["B", "A"]);
    const framed = deepFreeze(layout(split("s", "across", [box("a"), region("f", { session: "s1" }, box("b"))])));
    expect(okLayout(removeBox(framed, "b")).root).toEqual(box("a"));
  });

  it("refuses the last box, a missing box and a split", () => {
    expect(refused(removeBox(deepFreeze(layout(box("only"))), "only"))).toBe(MAP_LAYOUT_COPY.lastBox);
    expect(refused(removeBox(deepFreeze(layout(region("f", { part: "p" }, box("only")))), "only"))).toBe(MAP_LAYOUT_COPY.lastBox);
    expect(refused(removeBox(ROW(), "nope"))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(removeBox(GRID(), "r1"))).toBe(MAP_LAYOUT_COPY.notABox);
    expect(refused(removeBox(ROW(), "A", { fits: () => "Too narrow." }))).toBe("Too narrow.");
  });
});

describe("mergeBoxes", () => {
  it("joins tiles in build order: 6 and 4 give [4, 6]", () => {
    const value = deepFreeze(layout(split("row", "across", [box("A", ["s1-6"]), box("B", ["s1-4"]), box("C")], [0.25, 0.25, 0.5])));
    const got = okLayout(mergeBoxes(value, "B", "A", tileOpts()));
    expect(got.root).toEqual(split("row", "across", [box("A", ["s1-4", "s1-6"]), box("C")], [0.5, 0.5]));
  });

  it("keeps the first box's id and dress, and the second's where the first has none", () => {
    const value = deepFreeze(
      layout(
        split("col", "down", [box("A", ["s1-1"], { explanation: "First" }), box("B", ["s1-2"], { title: "Second", explanation: "Not this", style: { fill: "green" }, indent: { "s1-2": 1 } }), box("C")], [8, 16, 0]),
      ),
    );
    const got = okLayout(mergeBoxes(value, "A", "B", tileOpts()));
    expect(got.root).toEqual(
      split("col", "down", [box("A", ["s1-1", "s1-2"], { title: "Second", explanation: "First", style: { fill: "green" }, indent: { "s1-2": 1 } }), box("C")], [24, 0]),
    );
  });

  it("a text box merges with anything", () => {
    const value = deepFreeze(layout(split("row", "across", [box("T", [], { title: "Intro" }), box("C", ["s2-4"])], [0.5, 0.5])));
    expect(okLayout(mergeBoxes(value, "C", "T", tileOpts())).root).toEqual(box("T", ["s2-4"], { title: "Intro" }));
  });

  it("refuses the same box, a missing box, a split, boxes that don't share a full edge, and two sessions", () => {
    expect(refused(mergeBoxes(ROW(), "A", "A", tileOpts()))).toBe(MAP_LAYOUT_COPY.sameBox);
    expect(refused(mergeBoxes(ROW(), "A", "nope", tileOpts()))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(mergeBoxes(GRID(), "r1", "C", tileOpts()))).toBe(MAP_LAYOUT_COPY.notABox);
    expect(refused(mergeBoxes(ROW(), "A", "C", tileOpts()))).toBe(MAP_LAYOUT_COPY.notNeighbours);
    expect(refused(mergeBoxes(GRID(), "A", "C", tileOpts()))).toBe(MAP_LAYOUT_COPY.notNeighbours);
    expect(refused(mergeBoxes(ROW(), "B", "C", tileOpts()))).toBe(MAP_LAYOUT_COPY.differentSessions);
  });
});

describe("moveEdge", () => {
  /** Refuses any box narrower than `min` of the canvas. */
  const minShare = (min: number) => (value: MapLayout) => {
    const go = (node: MapNode, share: number): boolean =>
      node.kind === "box" ? share >= min - 1e-12 : node.kind === "region" ? go(node.child, share) : node.children.every((kid, at) => go(kid, node.dir === "across" ? share * node.sizes[at] : share));
    return go(value.root, 1) ? null : "Too narrow.";
  };

  it("moves an across edge by a share, keeping the total", () => {
    const result = moveEdge(ROW(), "row", 0, 0.1);
    const got = okLayout(result);
    expect((got.root as MapSplit).sizes.map((size) => +size.toFixed(6))).toEqual([0.3, 0.2, 0.5]);
    expect(result.ok && result.changed).toEqual(["A", "B"]);
  });

  it("clamps at the far side, and at the minimum `fits` sets", () => {
    expect((okLayout(moveEdge(ROW(), "row", 0, 0.9)).root as MapSplit).sizes.map((size) => +size.toFixed(6))).toEqual([0.5, 0, 0.5]);
    const clamped = okLayout(moveEdge(ROW(), "row", 0, 0.9, { fits: minShare(0.1) }));
    expect((clamped.root as MapSplit).sizes.map((size) => +size.toFixed(4))).toEqual([0.4, 0.1, 0.5]);
    expect(refused(moveEdge(ROW(), "row", 1, 0.5, { fits: minShare(0.6) }))).toBe("Too narrow.");
  });

  it("changes a down split's extra height, never below 0", () => {
    const result = moveEdge(GRID(), "col", 0, 24);
    expect((okLayout(result).root as MapSplit).sizes).toEqual([24, 16]);
    expect(result.ok && result.changed).toEqual(["r1"]);
    expect((okLayout(moveEdge(GRID(), "col", 0, -50)).root as MapSplit).sizes).toEqual([0, 16]);
  });

  it("refuses a split that isn't there, and an edge that isn't there", () => {
    expect(refused(moveEdge(ROW(), "A", 0, 0.1))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(moveEdge(ROW(), "row", 2, 0.1))).toBe(MAP_LAYOUT_COPY.noEdge);
    expect(refused(moveEdge(ROW(), "row", -1, 0.1))).toBe(MAP_LAYOUT_COPY.noEdge);
    expect(refused(moveEdge(ROW(), "row", 0.5, 0.1))).toBe(MAP_LAYOUT_COPY.noEdge);
    expect(refused(moveEdge(ROW(), "row", 0, Number.NaN))).toBe(MAP_LAYOUT_COPY.noEdge);
  });
});

describe("spanBox", () => {
  it("stretches a box across its row; its row-mates make a row directly below, its width going to its neighbour", () => {
    const value = deepFreeze(layout(split("col", "down", [box("top"), split("r1", "across", [box("A"), box("B"), box("C")], [0.25, 0.25, 0.5]), box("end")], [0, 8, 0])));
    const result = spanBox(value, "B");
    const got = okLayout(result);
    expect(got.root).toEqual(split("col", "down", [box("top"), box("B"), split("r1", "across", [box("A"), box("C")], [0.5, 0.5]), box("end")], [0, 0, 8, 0]));
    expect(result.ok && result.changed).toEqual(["B", "r1"]);
  });

  it("makes the canvas a column when there is no down split above", () => {
    const got = okLayout(spanBox(ROW(), "C", { newId: counter() }));
    expect(got.root).toEqual(split("n1", "down", [box("C", ["s2-4"]), split("row", "across", [box("A", ["s1-1", "s1-2"]), box("B", ["s1-3"])], [0.2, 0.8])], [0, 0]));
  });

  it("spans a frame", () => {
    const value = deepFreeze(layout(split("row", "across", [region("f", { session: "s1" }, box("A")), box("B")])));
    expect(okLayout(spanNode(value, "f", { newId: counter() })).root).toEqual(split("n1", "down", [region("f", { session: "s1" }, box("A")), box("B")], [0, 0]));
  });

  it("refuses a box that already spans, a box inside a frame inside the row, a missing box and a split", () => {
    expect(refused(spanBox(GRID(), "C"))).toBe(MAP_LAYOUT_COPY.alreadySpans);
    expect(refused(spanBox(deepFreeze(layout(box("only"))), "only"))).toBe(MAP_LAYOUT_COPY.alreadySpans);
    const framed = deepFreeze(layout(split("col", "down", [split("r1", "across", [region("f", { session: "s1" }, split("in", "across", [box("A"), box("A2")])), box("B")]), box("C")])));
    expect(refused(spanBox(framed, "A"))).toBe(MAP_LAYOUT_COPY.spanInFrame);
    // Inside a frame that holds a column of its own, the box's row is that column's.
    const column = deepFreeze(layout(split("row", "across", [region("f", { session: "s1" }, split("in", "down", [box("A"), box("A2")])), box("B")])));
    expect(refused(spanBox(column, "A"))).toBe(MAP_LAYOUT_COPY.alreadySpans);
    expect(refused(spanBox(ROW(), "nope"))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(spanBox(GRID(), "r1"))).toBe(MAP_LAYOUT_COPY.notABox);
  });
});

describe("evenOut", () => {
  it("evens out all children, or the chosen ones within the space they take", () => {
    expect((okLayout(evenOut(ROW(), "row")).root as MapSplit).sizes.map((size) => +size.toFixed(6))).toEqual([0.333333, 0.333333, 0.333333]);
    const result = evenOut(ROW(), "row", [1, 2]);
    expect((okLayout(result).root as MapSplit).sizes).toEqual([0.2, 0.4, 0.4]);
    expect(result.ok && result.changed).toEqual(["B", "C"]);
    expect((okLayout(evenOut(GRID(), "col")).root as MapSplit).sizes).toEqual([8, 8]);
  });

  it("refuses a missing split and fewer than two children", () => {
    expect(refused(evenOut(ROW(), "A"))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(evenOut(ROW(), "row", [1]))).toBe(MAP_LAYOUT_COPY.chooseTwo);
    expect(refused(evenOut(ROW(), "row", [1, 7]))).toBe(MAP_LAYOUT_COPY.chooseTwo);
    expect(refused(evenOut(ROW(), "row", undefined, { fits: () => "No." }))).toBe("No.");
  });
});

describe("matchSize", () => {
  it("gives boxes the width of the first, in the same split and in another", () => {
    const same = okLayout(matchSize(ROW(), ["C", "A"], "width"));
    expect((same.root as MapSplit).sizes.map((size) => +size.toFixed(6))).toEqual([0.5, 0, 0.5]);
    const value = deepFreeze(layout(split("col", "down", [split("r1", "across", [box("A"), box("B")], [0.25, 0.75]), split("r2", "across", [box("C"), box("D"), box("E")], [0.5, 0.25, 0.25])])));
    const got = okLayout(matchSize(value, ["A", "C", "D"], "width"));
    const r2 = (got.root as MapSplit).children[1] as MapSplit;
    expect(r2.sizes.map((size) => +size.toFixed(6))).toEqual([0.25, 0.25, 0.5]);
  });

  it("gives boxes the extra height of the first", () => {
    const value = deepFreeze(layout(split("col", "down", [box("A"), box("B"), box("C")], [40, 0, 8])));
    const result = matchSize(value, ["A", "C"], "height");
    expect((okLayout(result).root as MapSplit).sizes).toEqual([40, 0, 40]);
    expect(result.ok && result.changed).toEqual(["C"]);
  });

  it("names a box that can't change, or that would need more room than its row", () => {
    expect(refused(matchSize(GRID(), ["A", "C"], "width"))).toBe(MAP_LAYOUT_COPY.cantMatch("This box", "width"));
    expect(refused(matchSize(GRID(), ["C", "A"], "width", { nameOf: (id) => `Box ${id}` }))).toBe(MAP_LAYOUT_COPY.cantMatch("Box C", "width"));
    expect(refused(matchSize(ROW(), ["A", "B"], "height"))).toBe(MAP_LAYOUT_COPY.cantMatch("This box", "height"));
    const value = deepFreeze(layout(split("col", "down", [box("wide", [], { title: "Wide" }), split("r", "across", [box("half"), split("in", "down", [box("q"), box("q2")])], [0.5, 0.5])])));
    expect(refused(matchSize(value, ["half", "q"], "width"))).toBe(MAP_LAYOUT_COPY.cantMatch("This box", "width"));
    const narrow = deepFreeze(layout(split("col", "down", [split("r1", "across", [box("A", [], { title: "Big" }), box("B")], [0.8, 0.2]), split("r2", "across", [box("C"), split("in", "down", [split("deep", "across", [box("D", [], { title: "Small" }), box("E")], [0.5, 0.5]), box("F")])], [0.5, 0.5])])));
    expect(refused(matchSize(narrow, ["A", "D"], "width"))).toBe(MAP_LAYOUT_COPY.noRoom("Small"));
  });

  it("refuses fewer than two boxes and a missing box", () => {
    expect(refused(matchSize(ROW(), ["A"], "width"))).toBe(MAP_LAYOUT_COPY.chooseTwo);
    expect(refused(matchSize(ROW(), ["A", "nope"], "width"))).toBe(MAP_LAYOUT_COPY.noNode);
  });
});

describe("swapBoxes and swapNodes", () => {
  it("trades places and sizes; everything about each box goes with it", () => {
    const value = deepFreeze(layout(split("row", "across", [box("A", ["s1-1"], { title: "A", notes: { "s1-1": "n" } }), box("B", ["s2-2"])], [0.25, 0.75])));
    const result = swapBoxes(value, "A", "B");
    expect(okLayout(result).root).toEqual(split("row", "across", [box("B", ["s2-2"]), box("A", ["s1-1"], { title: "A", notes: { "s1-1": "n" } })], [0.25, 0.75]));
    expect(result.ok && result.changed).toEqual(["A", "B"]);
    const across = okLayout(swapNodes(GRID(), "A", "C"));
    expect(boxes(across).map((node) => node.id)).toEqual(["C", "B", "A"]);
  });

  it("swaps a region with a box", () => {
    const value = deepFreeze(layout(split("row", "across", [region("f", { part: "p" }, box("A")), box("B")])));
    expect(okLayout(swapNodes(value, "f", "B")).root).toEqual(split("row", "across", [box("B"), region("f", { part: "p" }, box("A"))]));
  });

  it("refuses the same node, a missing one, one inside the other, and a non-box for swapBoxes", () => {
    expect(refused(swapBoxes(ROW(), "A", "A"))).toBe(MAP_LAYOUT_COPY.sameBox);
    expect(refused(swapBoxes(ROW(), "A", "nope"))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(swapNodes(GRID(), "r1", "A"))).toBe(MAP_LAYOUT_COPY.insideItself);
    expect(refused(swapBoxes(GRID(), "r1", "C"))).toBe(MAP_LAYOUT_COPY.notABox);
    expect(refused(swapBoxes(ROW(), "A", "B", { fits: () => "No." }))).toBe("No.");
  });
});

describe("insertBox and insertNode", () => {
  it("takes a box out and splits it in beside the target at half its size", () => {
    const result = insertBox(GRID(), "A", "C", "right", { newId: counter() });
    const got = okLayout(result);
    expect(got.root).toEqual(split("col", "down", [box("B", ["s2-2"]), split("n1", "across", [box("C", ["s1-3", "s1-4"]), box("A", ["s1-1"])], [0.5, 0.5])], [0, 16]));
    expect(result.ok && result.changed).toEqual(["A", "C", "B"]);
  });

  it("joins the target's split when it runs the same way", () => {
    const got = okLayout(insertBox(ROW(), "A", "C", "left"));
    expect(got.root).toEqual(split("row", "across", [box("B", ["s1-3"]), box("A", ["s1-1", "s1-2"]), box("C", ["s2-4"])], [0.5, 0.25, 0.25]));
    const top = okLayout(insertBox(GRID(), "B", "C", "top"));
    expect(top.root).toEqual(split("col", "down", [box("A", ["s1-1"]), box("B", ["s2-2"]), box("C", ["s1-3", "s1-4"])], [0, 0, 16]));
  });

  it("moves a region, keeping what is inside it", () => {
    const value = deepFreeze(layout(split("col", "down", [region("f", { session: "s1" }, split("in", "across", [box("A"), box("B")])), box("C")])));
    const got = okLayout(insertNode(value, "f", "C", "bottom"));
    expect(got.root).toEqual(split("col", "down", [box("C"), region("f", { session: "s1" }, split("in", "across", [box("A"), box("B")]))], [0, 0]));
  });

  it("refuses the same node, a missing one, a target inside the node, the whole canvas, a non-box for insertBox, and what doesn't fit", () => {
    expect(refused(insertBox(ROW(), "A", "A", "left"))).toBe(MAP_LAYOUT_COPY.sameBox);
    expect(refused(insertBox(ROW(), "A", "nope", "left"))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(insertNode(GRID(), "r1", "A", "left"))).toBe(MAP_LAYOUT_COPY.insideItself);
    const framed = deepFreeze(layout(split("row", "across", [region("f", { session: "s1" }, box("A")), box("B")])));
    expect(refused(insertNode(framed, "A", "f", "left"))).toBe(MAP_LAYOUT_COPY.insideItself);
    expect(refused(insertBox(GRID(), "r1", "C", "left"))).toBe(MAP_LAYOUT_COPY.notABox);
    expect(refused(insertBox(ROW(), "A", "C", "left", { fits: () => "No." }))).toBe("No.");
  });
});

describe("moveTile", () => {
  it("moves a tile into another box of its session, in build order, with its dress", () => {
    const value = deepFreeze(layout(split("row", "across", [box("A", ["s1-1", "s1-4"], { indent: { "s1-4": 2 } }), box("B", ["s1-3", "s1-5"])], [0.5, 0.5])));
    const result = moveTile(value, "s1-4", "B", tileOpts());
    const got = okLayout(result);
    expect(boxes(got).map((node) => node.tiles)).toEqual([["s1-1"], ["s1-3", "s1-4", "s1-5"]]);
    expect(nodeById(got, "B")).toMatchObject({ indent: { "s1-4": 2 } });
    expect(nodeById(got, "A")).toMatchObject({ indent: {} });
    expect(result.ok && result.changed).toEqual(["A", "B"]);
  });

  it("moves a tile into a text box, and does nothing in its own box", () => {
    const value = deepFreeze(layout(split("row", "across", [box("A", ["s1-1", "s1-2"]), box("T")])));
    expect(boxes(okLayout(moveTile(value, "s1-2", "T", tileOpts()))).map((node) => node.tiles)).toEqual([["s1-1"], ["s1-2"]]);
    expect(moveTile(value, "s1-2", "A", tileOpts())).toEqual({ ok: true, layout: value, changed: [] });
  });

  it("refuses another session's box with the names, the last tile, an unplaced tile, a missing box and a split", () => {
    const names = tileOpts({ tileName: () => "Prompt 4", sessionName: (key) => ({ s1: "Session 1", s2: "Session 2" })[key] ?? key });
    expect(refused(moveTile(ROW(), "s2-4", "A", names))).toBe("Prompt 4 is in Session 2. This box holds Session 1.");
    expect(refused(moveTile(ROW(), "s2-4", "A", tileOpts()))).toBe("s2-4 is in s2. This box holds s1.");
    expect(refused(moveTile(ROW(), "s1-3", "A", tileOpts()))).toBe(MAP_LAYOUT_COPY.lastTile);
    expect(refused(moveTile(ROW(), "s9-9", "A", tileOpts()))).toBe(MAP_LAYOUT_COPY.notPlaced);
    expect(refused(moveTile(ROW(), "s1-1", "nope", tileOpts()))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(moveTile(GRID(), "s1-3", "r1", tileOpts()))).toBe(MAP_LAYOUT_COPY.notABox);
  });
});

describe("placeTile", () => {
  it("puts an unplaced tile into a box of its session, in build order", () => {
    const got = okLayout(placeTile(ROW(), "s1-0", "A", tileOpts()));
    expect(nodeById(got, "A")).toMatchObject({ tiles: ["s1-0", "s1-1", "s1-2"] });
  });

  it("with no box, splits a new box in beside the one it's dropped by", () => {
    const result = placeTile(ROW(), "s3-9", null, tileOpts({ beside: { id: "C", side: "bottom" } }));
    const got = okLayout(result);
    expect((got.root as MapSplit).children[2]).toEqual(split("n2", "down", [box("C", ["s2-4"]), box("n1", ["s3-9"])], [0, 0]));
    expect(result.ok && result.changed).toEqual(["n1", "C"]);
  });

  it("refuses a placed tile, another session's box, a missing box, a split, and no place beside", () => {
    expect(refused(placeTile(ROW(), "s1-1", "B", tileOpts()))).toBe(MAP_LAYOUT_COPY.alreadyPlaced);
    expect(refused(placeTile(ROW(), "s3-9", "A", tileOpts()))).toBe("s3-9 is in s3. This box holds s1.");
    expect(refused(placeTile(ROW(), "s3-9", "nope", tileOpts()))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(placeTile(GRID(), "s3-9", "r1", tileOpts()))).toBe(MAP_LAYOUT_COPY.notABox);
    expect(refused(placeTile(ROW(), "s3-9", null, tileOpts()))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(placeTile(ROW(), "s3-9", null, tileOpts({ beside: { id: "nope", side: "left" } })))).toBe(MAP_LAYOUT_COPY.noNode);
  });
});

describe("frameRegion and openRegion", () => {
  it("frames the whole of one node", () => {
    const result = frameRegion(GRID(), { session: "s1" }, ["A", "B"], { newId: counter() });
    expect(okLayout(result).root).toEqual(split("col", "down", [region("n1", { session: "s1" }, split("r1", "across", [box("A", ["s1-1"]), box("B", ["s2-2"])], [0.5, 0.5])), box("C", ["s1-3", "s1-4"])], [0, 16]));
    expect(result.ok && result.changed).toEqual(["n1"]);
    expect(okLayout(frameRegion(ROW(), { part: "p" }, ["C"], { newId: counter() })).root).toMatchObject({ children: [{ id: "A" }, { id: "B" }, { kind: "region", child: { id: "C" } }] });
  });

  it("frames a run of one split's children as a rectangle", () => {
    const got = okLayout(frameRegion(ROW(), { session: "s1" }, ["A", "B"], { newId: counter() }));
    expect(got.root).toEqual(
      split("row", "across", [region("n1", { session: "s1" }, split("n2", "across", [box("A", ["s1-1", "s1-2"]), box("B", ["s1-3"])], [0.4, 0.6])), box("C", ["s2-4"])], [0.5, 0.5]),
    );
    const down = deepFreeze(layout(split("col", "down", [box("A"), box("B"), box("C")], [4, 8, 12])));
    expect(okLayout(frameRegion(down, { session: "s1" }, ["B", "C"], { newId: counter() })).root).toEqual(
      split("col", "down", [box("A"), region("n1", { session: "s1" }, split("n2", "down", [box("B"), box("C")], [8, 12]))], [4, 0]),
    );
  });

  it("refuses boxes that aren't one rectangle, with the smallest rearrangement as a proposal", () => {
    const value = deepFreeze(layout(split("row", "across", [box("A", ["s1-1"]), box("X", ["s2-2"]), box("B", ["s1-3"]), box("Y", ["s2-4"])], [0.25, 0.25, 0.25, 0.25])));
    const result = frameRegion(value, { session: "s1" }, ["A", "B"], { newId: counter() });
    expect(refused(result)).toBe(MAP_LAYOUT_COPY.notRectangle);
    const proposal = (result as { proposal: MapLayout }).proposal;
    expectFull(proposal);
    // One box moved; every other box in the same order.
    expect(boxes(proposal).map((node) => node.id)).toEqual(["A", "B", "X", "Y"]);
    expect(okLayout(frameRegion(proposal, { session: "s1" }, ["A", "B"], { newId: counter() }))).toBeTruthy();
    const mixed = deepFreeze(layout(split("col", "down", [split("r1", "across", [box("A"), box("X")]), box("B")])));
    const second = frameRegion(mixed, { session: "s1" }, ["A", "B"]);
    expect(refused(second)).toBe(MAP_LAYOUT_COPY.notRectangle);
    expect(frameable((second as { proposal: MapLayout }).proposal, ["A", "B"])).toBe(true);
  });

  it("refuses no boxes, a missing box, a split, and a frame inside a frame of its kind", () => {
    expect(refused(frameRegion(ROW(), { part: "p" }, []))).toBe(MAP_LAYOUT_COPY.chooseTwo);
    expect(refused(frameRegion(ROW(), { part: "p" }, ["nope"]))).toBe(MAP_LAYOUT_COPY.noNode);
    expect(refused(frameRegion(GRID(), { part: "p" }, ["r1"]))).toBe(MAP_LAYOUT_COPY.notABox);
    const framed = deepFreeze(layout(region("f", { part: "p" }, split("row", "across", [box("A"), box("B")]))));
    expect(refused(frameRegion(framed, { part: "q" }, ["A"]))).toBe(MAP_LAYOUT_COPY.regionInRegion);
    expect(okLayout(frameRegion(framed, { session: "s" }, ["A"]))).toBeTruthy();
  });

  it("opens a frame with its boxes in exactly the same places", () => {
    const value = deepFreeze(layout(split("row", "across", [region("f", { session: "s1" }, split("in", "across", [box("A"), box("B")], [0.4, 0.6])), box("C")], [0.5, 0.5])));
    const result = openRegion(value, "f");
    expect(okLayout(result).root).toEqual(split("row", "across", [box("A"), box("B"), box("C")], [0.2, 0.3, 0.5]));
    expect(result.ok && result.changed).toEqual(["f"]);
    expect(refused(openRegion(value, "A"))).toBe(MAP_LAYOUT_COPY.notARegion);
    expect(refused(openRegion(value, "nope"))).toBe(MAP_LAYOUT_COPY.notARegion);
  });
});

/** Whether `ids` can be framed as they stand. */
function frameable(value: MapLayout | null, ids: string[]): boolean {
  return Boolean(value && frameRegion(value, { session: "s" }, ids).ok);
}

describe("500 random sequences on the 50-tile build", () => {
  /** A seeded generator (mulberry32), so a failure can be run again. */
  function seeded(seed: number) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  const fixture = mapSandboxFixture("fiftyTiles");
  const tileSession = new Map<string, string>();
  for (const step of fixture.steps) tileSession.set(step.id, step.session as string);
  const lastSession = fixture.groups[fixture.groups.length - 1];
  for (const result of fixture.results) tileSession.set(result.id, groupKey(lastSession));
  const order = new Map([...fixture.steps.map((step) => step.id), ...fixture.results.map((result) => result.id)].map((id, at) => [id, at]));
  const all = [...order.keys()];

  /** The plain arrangement until MS-05 writes `startFromBuild`: one box per session, stacked. */
  const start = (): MapLayout =>
    layout(split("m-root", "down", fixture.groups.map((group) => box(`m-${groupKey(group)}`, all.filter((id) => tileSession.get(id) === groupKey(group))))));

  it("every result is full, normal, and holds every placed tile exactly once", () => {
    const options = (random: () => number): TileOptions => {
      let made = 0;
      return { sessionOf: (tile) => tileSession.get(tile), buildOrder: (tile) => order.get(tile) ?? 0, newId: () => `g${Math.floor(random() * 1e9)}-${(made += 1)}` };
    };
    let applied = 0;
    for (let run = 0; run < 500; run += 1) {
      const random = seeded(run + 1);
      const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)];
      const opts = options(random);
      let current = deepFreeze(start());
      for (let move = 0; move < 12; move += 1) {
        const ids = pathIds(current.root);
        const boxIds = boxes(current).map((node) => node.id);
        const splits = splitsOf(current.root);
        const sides: MapSide[] = ["left", "right", "top", "bottom"];
        const placed = placedTiles(current);
        const unplaced = all.filter((id) => !placed.includes(id));
        const op = Math.floor(random() * 13);
        const someBox = pick(boxIds);
        let result: TreeResult | FrameResult;
        switch (op) {
          case 0: {
            const own = (nodeById(current, someBox) as MapBox).tiles;
            result = splitBox(current, someBox, random() < 0.5 ? "across" : "down", 0.1 + random() * 0.8, own.length > 1 ? own.slice(Math.floor(own.length / 2)) : [], opts);
            break;
          }
          case 1:
            result = removeBox(current, someBox, opts);
            break;
          case 2: {
            const next = neighbours(current, someBox)[0]?.id ?? pick(boxIds);
            result = mergeBoxes(current, someBox, next, opts);
            break;
          }
          case 3: {
            const target = splits.length ? pick(splits) : null;
            result = target ? moveEdge(current, target.id, Math.floor(random() * (target.children.length - 1)), target.dir === "across" ? random() - 0.5 : random() * 80 - 40, opts) : removeBox(current, someBox, opts);
            break;
          }
          case 4:
            result = spanNode(current, pick(ids), opts);
            break;
          case 5: {
            const target = splits.length ? pick(splits) : null;
            result = target ? evenOut(current, target.id, undefined, opts) : removeBox(current, someBox, opts);
            break;
          }
          case 6:
            result = matchSize(current, [pick(boxIds), pick(boxIds), pick(boxIds)], random() < 0.5 ? "width" : "height", opts);
            break;
          case 7:
            result = swapNodes(current, pick(ids), pick(ids), opts);
            break;
          case 8:
            result = insertNode(current, pick(ids), pick(ids), pick(sides), opts);
            break;
          case 9:
            result = placed.length ? moveTile(current, pick(placed), pick(boxIds), opts) : removeBox(current, someBox, opts);
            break;
          case 10:
            result = unplaced.length
              ? random() < 0.5
                ? placeTile(current, pick(unplaced), pick(boxIds), opts)
                : placeTile(current, pick(unplaced), null, { ...opts, beside: { id: pick(ids), side: pick(sides) } })
              : removeBox(current, someBox, opts);
            break;
          case 11: {
            const chosen = [...new Set([pick(boxIds), pick(boxIds)])];
            const framed = frameRegion(current, random() < 0.5 ? { session: "typed-f1" } : { part: "ws-a" }, chosen, opts);
            result = !framed.ok && "proposal" in framed && framed.proposal ? { ok: true, layout: framed.proposal, changed: [] } : framed;
            break;
          }
          default: {
            const regions = regionsOf(current.root);
            result = regions.length ? openRegion(current, pick(regions).id, opts) : removeBox(current, someBox, opts);
          }
        }
        if (!result.ok) continue;
        applied += 1;
        expectFull(result.layout);
        const now = placedTiles(result.layout);
        expect(new Set(now).size, `run ${run} move ${move}: a tile placed twice`).toBe(now.length);
        now.forEach((tile) => expect(order.has(tile)).toBe(true));
        current = deepFreeze(result.layout);
      }
    }
    // The run means something only when most moves are made.
    expect(applied).toBeGreaterThan(2500);
  });
});

function pathIds(root: MapNode): string[] {
  return [root.id, ...(root.kind === "split" ? root.children.flatMap(pathIds) : root.kind === "region" ? pathIds(root.child) : [])];
}
function splitsOf(root: MapNode): MapSplit[] {
  return root.kind === "split" ? [root, ...root.children.flatMap(splitsOf)] : root.kind === "region" ? splitsOf(root.child) : [];
}
function regionsOf(root: MapNode): MapRegion[] {
  return root.kind === "split" ? root.children.flatMap(regionsOf) : root.kind === "region" ? [root, ...regionsOf(root.child)] : [];
}
