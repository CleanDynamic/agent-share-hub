import { describe, expect, it } from "vitest";

import { SESSION_TITLE_MAX } from "./making";
import { MAP_LAYOUT_COPY, MAP_LIMITS, MAP_WIDTH, mapLayoutOf, mapLayoutRefusal, newMapNodeId, type MapBox, type MapLayout, type MapNode, type MapRegion, type MapSplit } from "./mapLayout";

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
