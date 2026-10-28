// SV-14: the address and the steps strip. A strip's numbers are the build's top-level step numbers (`topSteps`), the
// same the composer and the build page show.

import { describe, expect, it } from "vitest";

import { addressSearch, readAddress, stripFor, stripsFor, type StripNode } from "./openBuildsModel";

const node = (id: string, position: number | null, extra: Partial<StripNode> = {}): StripNode => ({
  id,
  build_id: "b1",
  parent_id: null,
  type: "prompt",
  title: `Title ${id}`,
  position,
  is_gap: false,
  payload: {},
  ...extra,
});

describe("the address", () => {
  it("reads the tab and the sort, falling back to All and Most needed", () => {
    expect(readAddress(new URLSearchParams(""))).toEqual({ tab: "all", sort: "needed" });
    expect(readAddress(new URLSearchParams("type=steps&sort=reward"))).toEqual({ tab: "steps", sort: "reward" });
  });

  it("ignores a tab that has no live type yet, and a sort it does not know", () => {
    expect(readAddress(new URLSearchParams("type=briefs&sort=oldest"))).toEqual({ tab: "all", sort: "needed" });
  });

  it("writes only what is not the default, and keeps other parameters", () => {
    expect(addressSearch(new URLSearchParams("x=1"), { tab: "steps", sort: "needed" }).toString()).toBe("x=1&type=steps");
    expect(addressSearch(new URLSearchParams("type=steps&sort=reward"), { tab: "all" }).toString()).toBe("sort=reward");
  });
});

describe("the steps strip", () => {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => node(`s${n}`, n * 10));

  it("numbers by place among the top-level steps and opens the gap's", () => {
    const gap = { ...steps[3], is_gap: true, type: "code", title: "Paywalled sources" };
    const strip = stripFor([...steps.slice(0, 3), gap, ...steps.slice(4)], "s4", "Paywalled sources");
    expect(strip.number).toBe("4");
    expect(strip.tiles.map((tile) => tile.number)).toEqual(["2", "3", "4", "5", "6"]);
    expect(strip.tiles.find((tile) => tile.open)).toMatchObject({ id: "s4", kind: "Code", title: "Paywalled sources" });
  });

  it("keeps five tiles at either end of the build", () => {
    expect(stripFor(steps, "s1", "First").tiles.map((tile) => tile.number)).toEqual(["1", "2", "3", "4", "5"]);
    expect(stripFor(steps, "s8", "Last").tiles.map((tile) => tile.number)).toEqual(["4", "5", "6", "7", "8"]);
  });

  it("leaves out what is not a step: an unplaced node, a tool not added as a tile, a setup node", () => {
    const rows = [
      node("a", 1),
      node("tray", null),
      node("tool", 2, { type: "tool" }),
      node("rule", 3, { type: "code", payload: { setup: { kind: "rule" } } }),
      node("b", 4, { is_gap: true }),
    ];
    const strip = stripFor(rows, "b", "Gap");
    expect(strip.tiles.map((tile) => [tile.id, tile.number])).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
  });

  it("opens the top-level step a gap sits straight inside, with the gap's title", () => {
    const rows = [node("a", 1), node("agent", 2, { type: "agent_config" }), node("inner", 1, { parent_id: "agent", is_gap: true, title: "Inner" })];
    const strip = stripFor(rows, "inner", "Inner");
    expect(strip.number).toBe("2");
    expect(strip.tiles.find((tile) => tile.open)).toMatchObject({ id: "agent", number: "2", kind: "Agent", title: "Inner" });
  });

  it("draws a gap it cannot place as the gap tile alone, unnumbered", () => {
    const strip = stripFor([node("a", 1)], "deep", "Deep gap");
    expect(strip).toEqual({ number: null, tiles: [{ id: "deep", number: "", kind: "Step", title: "Deep gap", open: true }] });
  });

  it("names an untitled step by its kind", () => {
    expect(stripFor([node("a", 1, { title: null }), node("g", 2, { is_gap: true })], "g", "Gap").tiles[0].title).toBe("Prompt");
  });

  it("groups one read's rows by build", () => {
    const rows = [node("a", 1), node("g", 2, { is_gap: true }), node("x", 1, { build_id: "b2", is_gap: true })];
    const strips = stripsFor(rows, [
      { key: "r1", buildId: "b1", gapId: "g", gapTitle: "Gap" },
      { key: "r2", buildId: "b2", gapId: "x", gapTitle: "Other" },
    ]);
    expect(strips.get("r1")?.tiles.map((tile) => tile.id)).toEqual(["a", "g"]);
    expect(strips.get("r2")?.tiles.map((tile) => tile.id)).toEqual(["x"]);
  });
});
