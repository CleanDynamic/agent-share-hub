// CA-21 P1: the moves the rules plan, written to a build in memory, give the order the rules promised.

import { describe, expect, it } from "vitest";

import { ca21Build, ca21Making, ca21Tree, CA21_A, CA21_B, CA21_S } from "@/dev/fixtures/ca21";
import { listPartsOf } from "@/pages/site/compose/partsModel";

import { buildSteps, groupKey, sessionGroups } from "./graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "./making";
import { applyWrite, type MemoryBuild } from "./moveMemory";
import { moveBy, moveModelOf, writeOf, type MoveModel } from "./moveRules";
import type { NodeTree } from "./types";

const start = (): MemoryBuild => ({ tree: ca21Tree, making: ca21Making });

/** The model of a memory build, as the List draws it. */
function modelOf(build: MemoryBuild): MoveModel {
  const steps = buildSteps(build.tree);
  const groups = sessionGroups(steps, build.making.sessions, build.making.session_tools ?? {}, sessionsMetaOf(build.making), sessionOrderOf(build.making));
  const heads = new Map(groups.filter((group) => !group.implicit).map((group) => [group.stepNumbers[0], { key: groupKey(group) }]));
  const parts = listPartsOf(build.making, groups, "dusk");
  return moveModelOf({ steps, heads, parts: parts?.list.map((part) => ({ key: part.view.key, sessions: part.sessions })) });
}

/** Moves `id` by one place and writes it, the way the page does. */
function move(build: MemoryBuild, id: string, by: -1 | 1): MemoryBuild {
  const before = modelOf(build);
  const result = moveBy(before, id, by);
  expect(result, `${id} ${by}`).not.toBeNull();
  const write = writeOf(before, result!.model, id);
  expect(write, `${id} ${by} write`).not.toBeNull();
  return applyWrite(build, write!);
}

describe("moves written to a build in memory", () => {
  it("every kind of tile in Session 2 moves up and down within it", () => {
    for (const id of ["c21-tool", "c21-decision", "c21-manual"]) {
      for (const by of [-1, 1] as const) {
        const after = modelOf(move(start(), id, by));
        const was = modelOf(start()).tiles[CA21_S[1]].indexOf(id);
        expect(after.tiles[CA21_S[1]].indexOf(id)).toBe(was + by);
      }
    }
  });

  it("the first tile of Session 2 goes to the end of Session 1, and back", () => {
    const up = move(start(), "c21-agent", -1);
    const model = modelOf(up);
    expect(model.tiles[CA21_S[0]].at(-1)).toBe("c21-agent");
    expect(model.tiles[CA21_S[1]]).toEqual(["c21-tool", "c21-decision", "c21-manual", "c21-file"]);
    const down = move(up, "c21-agent", 1);
    expect(modelOf(down).tiles[CA21_S[1]][0]).toBe("c21-agent");
  });

  it("a tile never crosses with its team's agents", () => {
    const after = modelOf(move(start(), "c21-a1", 1));
    expect(after.nested["c21-team"]).toEqual(["c21-a2", "c21-a1"]);
    expect(after.tiles[CA21_S[0]]).toEqual(["c21-p1", "c21-p2", "c21-p3", "c21-team"]);
  });

  it("a session crosses into the empty Part 2 and back", () => {
    const down = move(start(), CA21_S[1], 1);
    const parts = modelOf(down).parts;
    expect(parts.map((part) => [part.key, part.sessions])).toEqual([
      [CA21_A, [CA21_S[0]]],
      [CA21_B, [CA21_S[1]]],
    ]);
    // Its tiles went with it.
    expect(modelOf(down).tiles[CA21_S[1]]).toHaveLength(5);
    const back = move(down, CA21_S[1], -1);
    expect(modelOf(back).parts[0].sessions).toEqual([CA21_S[0], CA21_S[1]]);
  });

  it("a session passes its neighbour in its part, and its tiles follow it", () => {
    const after = move(start(), CA21_S[0], 1);
    expect(modelOf(after).parts[0].sessions).toEqual([CA21_S[1], CA21_S[0]]);
    const steps = buildSteps(after.tree).map((step) => step.id);
    expect(steps.slice(0, 5)).toEqual(["c21-agent", "c21-tool", "c21-decision", "c21-manual", "c21-file"]);
  });

  it("a part moves with its sessions", () => {
    const after = move(start(), CA21_A, 1);
    expect(modelOf(after).parts.map((part) => part.key)).toEqual([CA21_B, CA21_A]);
    expect((after.making as Making).workstreams?.map((part) => part.key)).toEqual([CA21_B, CA21_A]);
  });

  it("a tile in the tree keeps its place among tiles when the tree is the same object", () => {
    const tree: NodeTree[] = start().tree;
    expect(tree.map((node) => node.id)).toContain("c21-team");
    expect(buildSteps(ca21Build().tree)).toHaveLength(9);
  });
});
