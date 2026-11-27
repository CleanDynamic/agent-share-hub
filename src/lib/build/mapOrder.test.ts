import { describe, expect, it } from "vitest";

import { mapSandboxFixture } from "@/dev/fixtures/mapSandbox";

import { geometryOf, type MapGeometry } from "./mapGeometry";
import { insertNode, splitBox, swapNodes, boxOfTile, type MapLayout } from "./mapLayout";
import {
  MAP_ORDER_COPY,
  allowedDrops,
  allowedTileSlots,
  bandOf,
  bandsOf,
  boxesCanBeSimultaneous,
  isLevel,
  orderFacts,
  orderProblems,
  orderRefusal,
  phoneOrder,
  readingOrder,
  shareBand,
  slideToLevel,
  twoWayProblems,
  twoWayRefusal,
  type OrderFacts,
} from "./mapOrder";
import { INBOX, box, fiftyLayout, layout, measureFor, region, split } from "./mapSandboxTestSupport";

/* ── the support inbox, laid out as on `01-finished-map.png` ── */

const fixture = mapSandboxFixture("supportInbox");
const FACTS = orderFacts(fixture.steps, fixture.groups, fixture.files, fixture.results);

const finished = (over: Partial<MapLayout> = {}): MapLayout =>
  layout(
    split("m-root", "down", [
      region(
        "m-a",
        { part: "ws-a" },
        split("m-a-row", "across", [
          box("m-s1", ["p1", "f2", "p3"], { notesSide: "left", notes: { p1: "Starts the build", p3: "Waits for the rules" }, title: "Classify" }),
          box("m-s2", ["p4", "c5", "k6"], { notesSide: "right", indent: { k6: 1 }, notes: { k6: "Sits under Code 5" }, title: "Refund rules" }),
        ]),
      ),
      region("m-b", { part: "ws-b" }, split("m-b-col", "down", [box("m-s3", ["a7", "t8"], { layout: "across", title: "Draft and send" }), box("m-result", ["r9"], { title: "Result" })])),
    ]),
    over,
  );

const geo = (map: MapLayout): MapGeometry => geometryOf(map, INBOX);
const ok = <T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> => {
  if (!result.ok) throw new Error(`refused: ${(result as unknown as { reason: string }).reason}`);
  return result as Extract<T, { ok: true }>;
};

/* ── Part 1 ── */

describe("orderFacts", () => {
  it("orders each session's tiles, carrying a link's words when one joins the pair", () => {
    const pairs = FACTS.facts.map((fact) => `${fact.before}>${fact.after}:${fact.why}`);
    expect(pairs).toEqual(
      expect.arrayContaining(["p1>f2:uses", "f2>p3:reads", "p4>c5:uses", "c5>k6:tests", "a7>t8:session", "p4>p3:uses", "p3>a7:uses", "a7>r9:makes"]),
    );
    expect(FACTS.facts.find((fact) => fact.after === "k6")?.sentence).toBe("Check 6 tests Code 5, so it can't come before it.");
    expect(FACTS.facts.find((fact) => fact.after === "t8")?.sentence).toBe("Tool 8 comes after Agent 7 in Session 3.");
    expect(FACTS.facts.find((fact) => fact.before === "p4" && fact.after === "p3")?.sentence).toBe("Prompt 3 uses Prompt 4, so it can't come before it.");
    expect(FACTS.facts.find((fact) => fact.after === "r9")?.sentence).toBe(MAP_ORDER_COPY.result("Agent 7"));
  });

  it("keeps a link inside one session out of the facts when it runs against the build (Agent 7 uses Tool 8)", () => {
    expect(FACTS.facts.some((fact) => fact.before === "t8" && fact.after === "a7")).toBe(false);
  });

  it("lifts a child's links to its top-level tile", () => {
    const fifty = mapSandboxFixture("fiftyTiles");
    const facts = orderFacts(fifty.steps, fifty.groups);
    const ids = new Set(fifty.steps.map((step) => step.id));
    expect(facts.facts.every((fact) => ids.has(fact.before) && ids.has(fact.after))).toBe(true);
  });

  it("knows what must precede what, through chains", () => {
    expect(FACTS.mustPrecede("p1", "p3")).toBe(true);
    expect(FACTS.mustPrecede("p4", "a7")).toBe(true);
    expect(FACTS.mustPrecede("p1", "r9")).toBe(true);
    expect(FACTS.mustPrecede("p3", "p4")).toBe(false);
    expect(FACTS.mustPrecede("p1", "p1")).toBe(false);
  });

  it("lets tiles of sessions that ran side by side be simultaneous when nothing links them", () => {
    expect(FACTS.canBeSimultaneous("p1", "p4")).toBe(true);
    expect(FACTS.canBeSimultaneous("f2", "k6")).toBe(true);
    expect(FACTS.canBeSimultaneous("p3", "p4")).toBe(false);
    expect(FACTS.canBeSimultaneous("p4", "c5")).toBe(false);
    expect(FACTS.canBeSimultaneous("p1", "a7")).toBe(false);
    expect(boxesCanBeSimultaneous(FACTS, { tiles: ["p1", "f2"] }, { tiles: ["p4", "c5", "k6"] })).toBe(true);
    expect(boxesCanBeSimultaneous(FACTS, { tiles: ["p1", "f2", "p3"] }, { tiles: ["p4"] })).toBe(false);
  });
});

/* ── Part 2 ── */

describe("bands and reading order", () => {
  const geometry = geo(finished());

  it("reads 1 and 4, then 2 and 5, then 3 and 6, then 7 and 8, then 9", () => {
    expect(bandsOf(geometry).bands).toEqual([["p1", "p4"], ["f2", "c5"], ["p3", "k6"], ["a7", "t8"], ["r9"]]);
    expect(readingOrder(geometry)).toEqual(["p1", "p4", "f2", "c5", "p3", "k6", "a7", "t8", "r9"]);
    expect(bandOf(geometry, "c5")).toBe(1);
    expect(bandOf(geometry, "nope")).toBe(-1);
  });

  it("never depends on the order slots are listed in", () => {
    const reversed: MapGeometry = { ...geometry, tiles: Object.fromEntries(Object.entries(geometry.tiles).reverse()) };
    expect(bandsOf(reversed).bands).toEqual(bandsOf(geometry).bands);
  });

  it("shares a band only past half the shorter span", () => {
    expect(shareBand({ y: 0, height: 100 }, { y: 49, height: 100 })).toBe(true);
    expect(shareBand({ y: 0, height: 100 }, { y: 50, height: 100 })).toBe(false);
    expect(shareBand({ y: 0, height: 300 }, { y: 200, height: 40 })).toBe(true);
  });

  it("stacks boxes on a phone at the reading place of their first tile, text boxes where they stand", () => {
    expect(phoneOrder(finished(), geometry)).toEqual(["m-s1", "m-s2", "m-s3", "m-result"]);
    const withIntro = layout(split("m-root", "down", [box("m-intro", [], { title: "How it is built" }), finished().root]));
    expect(phoneOrder(withIntro, geo(withIntro))).toEqual(["m-intro", "m-s1", "m-s2", "m-s3", "m-result"]);
    const shut = layout(split("m-root", "down", [box("m-s1", ["p1", "f2", "p3"], { collapsed: true }), box("m-s2", ["p4", "c5", "k6"])]));
    expect(phoneOrder(shut, geo(shut))).toEqual(["m-s1", "m-s2"]);
  });
});

/* ── Part 3 ── */

describe("orderRefusal", () => {
  it("accepts the finished map, and the plain 50-tile arrangement", () => {
    expect(orderRefusal(finished(), geo(finished()), FACTS)).toBeNull();
    const fifty = mapSandboxFixture("fiftyTiles");
    const map = fiftyLayout();
    expect(orderRefusal(map, geometryOf(map, measureFor("fiftyTiles")), orderFacts(fifty.steps, fifty.groups, fifty.files, fifty.results))).toBeNull();
  });

  it("refuses tile 6 above tile 5", () => {
    let made = 0;
    const split6 = ok(splitBox(finished(), "m-s2", "down", 0.5, ["k6"], { newId: () => `m-six-${(made += 1)}`, buildOrder: (tile) => FACTS.buildOrder.get(tile) ?? 0, sessionOf: (tile) => FACTS.sessionOf.get(tile) }));
    const six = boxOfTile(split6.layout, "k6")?.id as string;
    const above = ok(insertNode(split6.layout, six, "m-s2", "top"));
    expect(orderRefusal(above.layout, geo(above.layout), FACTS)).toBe("Check 6 tests Code 5, so it can't come before it.");
  });

  it("refuses S1's box below S3's: Agent 7 uses Prompt 3", () => {
    const below = ok(insertNode(finished(), "m-s1", "m-s3", "bottom"));
    expect(orderRefusal(below.layout, geo(below.layout), FACTS)).toBe("Agent 7 uses Prompt 3, so it can't come before it.");
    expect(orderProblems(below.layout, geo(below.layout), FACTS).map((fact) => fact.after)).toEqual(["a7"]);
  });

  it("allows swapping S1 and S2, and 3 still reads after 4", () => {
    const swapped = ok(swapNodes(finished(), "m-s1", "m-s2"));
    const geometry = geo(swapped.layout);
    expect(orderRefusal(swapped.layout, geometry, FACTS)).toBeNull();
    expect(readingOrder(geometry).indexOf("p3")).toBeGreaterThan(readingOrder(geometry).indexOf("p4"));
  });

  it("refuses a later tile to the left of an earlier one of its session in one band, but not of another session", () => {
    const reversed = layout(split("m-root", "across", [box("m-b", ["c5"]), box("m-a", ["p4"])]));
    expect(orderRefusal(reversed, geo(reversed), FACTS)).toBe("Code 5 uses Prompt 4, so it can't come before it.");
    const level = layout(split("m-root", "across", [box("m-b", ["k6"]), box("m-a", ["f2"])]));
    expect(orderRefusal(level, geo(level), FACTS)).toBeNull();
  });

  it("checks a tile in a collapsed box at the box's place", () => {
    const map = layout(split("m-root", "down", [box("m-s3", ["a7", "t8"], { collapsed: true }), box("m-s1", ["p1", "f2", "p3"])]));
    expect(orderRefusal(map, geo(map), FACTS)).toBe("Agent 7 uses Prompt 3, so it can't come before it.");
  });

  it("lets the noUses build's three sessions share one band", () => {
    const none = mapSandboxFixture("noUses");
    const facts = orderFacts(none.steps, none.groups);
    const map = layout(split("m-root", "across", [box("m-u3", ["u3"]), box("m-u1", ["u1"]), box("m-u2", ["u2"])]));
    const geometry = geo(map);
    expect(orderRefusal(map, geometry, facts)).toBeNull();
    expect(bandsOf(geometry).bands).toHaveLength(1);
  });
});

/* ── Part 4 ── */

describe("allowedDrops", () => {
  it("allows the swap of S1 and S2 and refuses S1 below S3 with its reason", () => {
    const drops = allowedDrops(finished(), INBOX, FACTS, { box: "m-s1" });
    const swap = drops.find((drop) => drop.kind === "swap" && drop.target === "m-s2");
    expect(swap?.allowed).toBe(true);
    expect(swap?.result && orderRefusal(swap.result, geo(swap.result), FACTS)).toBeNull();
    const below = drops.find((drop) => drop.kind === "insert" && drop.target === "m-s3" && drop.side === "bottom");
    expect(below).toMatchObject({ allowed: false, reason: "Agent 7 uses Prompt 3, so it can't come before it." });
    expect(below?.result).toBeUndefined();
    expect(drops.every((drop) => drop.allowed === Boolean(drop.result))).toBe(true);
  });

  it("offers a tile every box of its session and every box edge", () => {
    const drops = allowedDrops(finished(), INBOX, FACTS, { tile: "k6" });
    expect(drops.filter((drop) => drop.kind === "into")).toEqual([]);
    const top = drops.find((drop) => drop.kind === "insert" && drop.target === "m-s2" && drop.side === "top");
    expect(top).toMatchObject({ allowed: false, reason: "Check 6 tests Code 5, so it can't come before it." });
    expect(drops.some((drop) => drop.kind === "insert" && drop.target === "m-s2" && drop.side === "bottom" && drop.allowed)).toBe(true);
    const twoBoxes = layout(split("m-root", "down", [box("m-x", ["p4", "c5"]), box("m-y", ["k6"])]));
    expect(allowedDrops(twoBoxes, INBOX, FACTS, { tile: "c5" }).find((drop) => drop.kind === "into")).toMatchObject({ target: "m-y", allowed: true });
    expect(allowedDrops(finished(), INBOX, FACTS, { tile: "nope" })).toEqual([]);
  });

  it("works out every drop for one box of the 50-tile build in under 50 ms", () => {
    const fifty = mapSandboxFixture("fiftyTiles");
    const facts = orderFacts(fifty.steps, fifty.groups, fifty.files, fifty.results);
    const map = fiftyLayout();
    const measure = measureFor("fiftyTiles");
    allowedDrops(map, measure, facts, { box: "m-typed-f4" });
    const runs = 5;
    const started = performance.now();
    let count = 0;
    for (let run = 0; run < runs; run += 1) count = allowedDrops(map, measure, facts, { box: "m-typed-f4" }).length;
    const each = (performance.now() - started) / runs;
    // eslint-disable-next-line no-console -- the prompt asks for the number in the report
    console.info(`MS-03 allowedDrops, 50 tiles, one box: ${count} candidates in ${each.toFixed(2)} ms`);
    expect(count).toBeGreaterThan(20);
    expect(each).toBeLessThan(50);
  });

  it("lets a tile move inside its box only where the order allows", () => {
    expect(allowedTileSlots({ tiles: ["p4", "c5", "k6"] }, "k6", FACTS)).toEqual([
      { index: 0, allowed: false, reason: "Check 6 tests Code 5, so it can't come before it." },
      { index: 1, allowed: false, reason: "Check 6 tests Code 5, so it can't come before it." },
      { index: 2, allowed: true },
    ]);
    expect(allowedTileSlots({ tiles: ["p4"] }, "c5", FACTS)).toEqual([]);
  });
});

/* ── Part 5 ── */

describe("two-way rules", () => {
  const map = finished();
  const geometry = geo(map);

  it("allows 1 and 4 and finds them level", () => {
    expect(twoWayRefusal(map, geometry, FACTS, { tile: "p1" }, { tile: "p4" })).toBeNull();
    expect(isLevel(geometry, { tile: "p1" }, { tile: "p4" })).toBe(true);
  });

  it("refuses things in sequence", () => {
    expect(twoWayRefusal(map, geometry, FACTS, { tile: "p4" }, { tile: "c5" })).toBe("These happen one after the other.");
    expect(twoWayRefusal(map, geometry, FACTS, { tile: "p3" }, { tile: "p4" })).toBe(MAP_ORDER_COPY.inSequence);
    expect(twoWayRefusal(map, geometry, FACTS, { box: "m-s1" }, { box: "m-s3" })).toBe(MAP_ORDER_COPY.inSequence);
  });

  it("refuses the same thing twice, ends off the map, mixed ends and empty boxes", () => {
    expect(twoWayRefusal(map, geometry, FACTS, { tile: "p1" }, { tile: "p1" })).toBe(MAP_ORDER_COPY.sameThing);
    expect(twoWayRefusal(map, geometry, FACTS, { tile: "p1" }, { tile: "gone" })).toBe(MAP_ORDER_COPY.tileNotPlaced);
    expect(twoWayRefusal(map, geometry, FACTS, { box: "gone" }, { box: "m-s1" })).toBe(MAP_ORDER_COPY.boxNotPlaced);
    expect(twoWayRefusal(map, geometry, FACTS, { box: "m-a" }, { box: "m-s1" })).toBe(MAP_ORDER_COPY.boxNotPlaced);
    expect(twoWayRefusal(map, geometry, FACTS, { tile: "p1" }, { box: "m-s2" })).toBe(MAP_ORDER_COPY.mixedEnds);
    const withText = layout(split("m-root", "across", [box("m-t"), box("m-s1", ["p1"])]));
    expect(twoWayRefusal(withText, geo(withText), FACTS, { box: "m-t" }, { box: "m-s1" })).toBe(MAP_ORDER_COPY.emptyBox);
  });

  it("finds two boxes level by the band rule, and a tile and a box never", () => {
    const boxes = layout(split("m-root", "across", [box("m-s1", ["p1", "f2"]), box("m-s2", ["p4"])]));
    expect(twoWayRefusal(boxes, geo(boxes), FACTS, { box: "m-s1" }, { box: "m-s2" })).toBeNull();
    expect(isLevel(geo(boxes), { box: "m-s1" }, { box: "m-s2" })).toBe(true);
    expect(isLevel(geometry, { box: "m-s1" }, { box: "m-s3" })).toBe(false);
    expect(isLevel(geometry, { tile: "p1" }, { box: "m-s2" })).toBe(false);
  });

  it("slides 1 and 4 level when S2's box starts lower: extra height above S1", () => {
    const lower = layout(
      split("m-root", "across", [
        split("m-left", "down", [box("m-note-a", [], { title: "Classify first" }), box("m-s1", ["p1", "f2", "p3"])]),
        split("m-right", "down", [box("m-note-b", [], { title: "Rules" }), box("m-s2", ["p4", "c5", "k6"])], [80, 0]),
      ]),
    );
    expect(isLevel(geo(lower), { tile: "p1" }, { tile: "p4" })).toBe(false);
    const slid = ok(slideToLevel(lower, INBOX, FACTS, { tile: "p1" }, { tile: "p4" }));
    const after = geo(slid.layout);
    expect(isLevel(after, { tile: "p1" }, { tile: "p4" })).toBe(true);
    expect(orderRefusal(slid.layout, after, FACTS)).toBeNull();
    expect((slid.layout.root as { children: { sizes: number[] }[] }).children[0].sizes[0]).toBeGreaterThan(0);
  });

  it("slides by moving a box into the other's row when no extra height can do it", () => {
    const lower = layout(split("m-root", "across", [box("m-s1", ["p1", "f2", "p3"]), split("m-right", "down", [box("m-note", [], { title: "Rules" }), box("m-s2", ["p4", "c5", "k6"])])]));
    const slid = ok(slideToLevel(lower, INBOX, FACTS, { tile: "p1" }, { tile: "p4" }));
    const after = geo(slid.layout);
    expect(isLevel(after, { tile: "p1" }, { tile: "p4" })).toBe(true);
    expect(orderRefusal(slid.layout, after, FACTS)).toBeNull();
  });

  it("answers level ends at once, and refuses what can't be simultaneous or can't be levelled", () => {
    expect(slideToLevel(map, INBOX, FACTS, { tile: "p1" }, { tile: "p4" })).toEqual({ ok: true, layout: map });
    expect(slideToLevel(map, INBOX, FACTS, { tile: "p3" }, { tile: "p4" })).toEqual({ ok: false, reason: MAP_ORDER_COPY.inSequence });
    // f2 and p4: f2 is the second tile of S1, so it can only be level with p4 by putting p1 above p4, which the boxes can't do.
    const facts: OrderFacts = { ...FACTS, canBeSimultaneous: () => true };
    const stuck = layout(split("m-root", "down", [box("m-s2", ["p4", "c5", "k6"]), box("m-s1", ["p1", "f2", "p3"])]));
    expect(slideToLevel(stuck, INBOX, facts, { tile: "p3" }, { tile: "p4" })).toEqual({ ok: false, reason: MAP_ORDER_COPY.cantLevel });
  });

  it("lists stored two-way arrows that are no longer allowed or level", () => {
    const stored = finished({
      twoWay: [
        { a: { tile: "p1" }, b: { tile: "p4" } },
        { a: { tile: "p4" }, b: { tile: "c5" } },
        { a: { tile: "f2" }, b: { tile: "p4" } },
      ],
    });
    expect(twoWayProblems(stored, geo(stored), FACTS)).toEqual([
      { index: 1, a: { tile: "p4" }, b: { tile: "c5" }, reason: MAP_ORDER_COPY.inSequence },
      { index: 2, a: { tile: "f2" }, b: { tile: "p4" }, reason: MAP_ORDER_COPY.notLevel },
    ]);
  });
});
