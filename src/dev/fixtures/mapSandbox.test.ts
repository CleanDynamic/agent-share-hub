import { describe, expect, it } from "vitest";

import { groupKey, groupOfStep, shownGroups, type Step } from "@/lib/build/graph";
import { mapLayoutOf, type MapBox, type MapSplit } from "@/lib/build/mapLayout";
import { sessionMapFor, tileLinksOf } from "@/lib/build/sessionMap";
import { workstreamsOf } from "@/lib/build/workstreams";

import { MAP_SANDBOX_NAMES, REMOVED_TILE_ID, mapSandboxFixture } from "./mapSandbox";

const sessionOf = (name: Parameters<typeof mapSandboxFixture>[0]) => {
  const fixture = mapSandboxFixture(name);
  return Object.fromEntries(fixture.steps.map((step) => [step.number, groupKey(groupOfStep(fixture.groups, step) ?? { sessionId: null, number: 0 })]));
};

describe("the map sandbox fixtures", () => {
  it("support inbox: 9 tiles in 3 sessions and 2 parts, as the board draws it", () => {
    const fixture = mapSandboxFixture("supportInbox");
    expect(fixture.steps.length + fixture.results.length).toBe(9);
    expect(fixture.steps.map((step) => [step.number, step.kind, step.title])).toEqual([
      ["1", "prompt", "Label the last 200 emails"],
      ["2", "file", "labels.json"],
      ["3", "prompt", "Merge the refund rules"],
      ["4", "prompt", "Write the refund rules"],
      ["5", "code", "refundRules.ts"],
      ["6", "check", "Rules pass 30 cases"],
      ["7", "agent", "Reply drafter"],
      ["8", "tool", "Gmail"],
    ]);
    expect(fixture.results).toMatchObject([{ id: "r9", title: "Support inbox", from: "7" }]);
    expect(sessionOf("supportInbox")).toEqual({ 1: "typed-s1", 2: "typed-s1", 3: "typed-s1", 4: "typed-s2", 5: "typed-s2", 6: "typed-s2", 7: "typed-s3", 8: "typed-s3" });
    const parts = workstreamsOf(fixture.making, shownGroups(fixture.groups).map(groupKey));
    expect(parts.map((part) => part.sessions)).toEqual([["typed-s1", "typed-s2"], ["typed-s3"]]);
    expect(mapLayoutOf(fixture.making)).toBeNull();
  });

  it("support inbox: the links the for-chat file lists", () => {
    const fixture = mapSandboxFixture("supportInbox");
    expect(tileLinksOf(fixture.steps, fixture.files).map((link) => link.sentence)).toEqual([
      "File 2 uses Prompt 1",
      "Prompt 3 reads File 2",
      "Prompt 3 uses Prompt 4",
      "Code 5 uses Prompt 4",
      "Check 6 tests Code 5",
      "Agent 7 uses Prompt 3",
      "Agent 7 uses Tool 8",
    ]);
  });

  it("support inbox: S1 and S2 ran side by side, S3 after them", () => {
    const fixture = mapSandboxFixture("supportInbox");
    const model = sessionMapFor({ groups: fixture.groups, steps: fixture.steps, files: fixture.files, making: fixture.making });
    const stage = (key: string) => model.stages.stages.find((info) => info.sessions.includes(key))?.number;
    expect(stage("typed-s1")).toBe(stage("typed-s2"));
    expect(stage("typed-s3")).toBeGreaterThan(stage("typed-s1") as number);
  });

  it("fifty tiles: 50 tiles in 8 sessions and 3 parts, with an agent of 3 and a Result", () => {
    const fixture = mapSandboxFixture("fiftyTiles");
    expect(fixture.steps.length + fixture.results.length).toBe(50);
    expect(shownGroups(fixture.groups)).toHaveLength(8);
    expect(workstreamsOf(fixture.making, fixture.groups.map(groupKey)).map((part) => part.sessions.length)).toEqual([3, 2, 3]);
    const agents = fixture.steps.filter((step) => step.kind === "agent");
    expect(agents).toHaveLength(1);
    expect(agents[0].children).toHaveLength(3);
    const model = sessionMapFor({ groups: fixture.groups, steps: fixture.steps, files: fixture.files, making: fixture.making });
    // Uses across sessions, and two pairs of sessions sharing a stage.
    expect(model.links.length).toBeGreaterThanOrEqual(6);
    const stages = model.stages.stages.filter((info) => info.sessions.length === 2);
    expect(stages.map((info) => info.sessions)).toEqual([["typed-f1", "typed-f2"], ["typed-f4", "typed-f5"]]);
  });

  it("the edge cases", () => {
    const one = mapSandboxFixture("oneSession");
    expect(one.steps).toHaveLength(4);
    expect(new Set(Object.values(sessionOf("oneSession")))).toEqual(new Set(["typed-one"]));

    const none = mapSandboxFixture("noUses");
    expect(tileLinksOf(none.steps)).toEqual([]);
    const model = sessionMapFor({ groups: none.groups, steps: none.steps, making: none.making });
    expect(model.stages.stages).toHaveLength(1);

    const removed = mapSandboxFixture("removedTile");
    const layout = mapLayoutOf(removed.making);
    const top = (layout?.root as MapSplit).children[0] as MapBox;
    expect(top.tiles).toContain(REMOVED_TILE_ID);
    expect(removed.steps.some((step) => step.id === REMOVED_TILE_ID)).toBe(false);

    const legacy = mapSandboxFixture("legacy");
    expect(legacy.groups.map(groupKey)).toEqual(["typed-legacy-1", "typed-legacy-2"]);
  });

  it("every fixture is made fresh", () => {
    for (const name of MAP_SANDBOX_NAMES) expect(mapSandboxFixture(name)).not.toBe(mapSandboxFixture(name));
    const first = mapSandboxFixture("supportInbox");
    (first.steps as Step[]).pop();
    expect(mapSandboxFixture("supportInbox").steps).toHaveLength(8);
  });
});
