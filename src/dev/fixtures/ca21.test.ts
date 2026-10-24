// CA-21 P0: the fixture draws what the prompt says it draws.

import { describe, expect, it } from "vitest";

import { groupKey } from "@/lib/build/graph";
import { listPartsOf } from "@/pages/site/compose/partsModel";

import { ca21Build, CA21_A, CA21_B, CA21_S } from "./ca21";

describe("the ca21 fixture", () => {
  it("has two parts, the second empty, and two sessions with the tiles the prompt names", () => {
    const { steps, groups, making } = ca21Build();
    expect(steps.map((step) => step.kind)).toEqual(["prompt", "prompt", "prompt", "team", "agent", "tool", "decision", "manual", "file"]);
    const sessions = groups.filter((group) => !group.implicit);
    expect(sessions.map((group) => groupKey(group))).toEqual([...CA21_S]);
    expect(sessions[0].stepNumbers).toHaveLength(4);
    expect(sessions[1].stepNumbers).toHaveLength(5);
    const parts = listPartsOf(making, groups, "dusk");
    expect(parts?.list.map((part) => [part.view.key, part.sessions.length])).toEqual([
      [CA21_A, 2],
      [CA21_B, 0],
    ]);
    expect(steps[3].children.map((step) => step.kind)).toEqual(["agent", "agent"]);
  });
});
