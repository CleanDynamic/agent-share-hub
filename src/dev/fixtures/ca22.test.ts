// CA-22 P0 - the fixture reads as the composer reads a build: two parts, three sessions, a nested prompt, a post that links to Prompt 3.

import { describe, expect, it } from "vitest";

import { groupKey } from "@/lib/build/graph";

import { CA22_A, CA22_B, CA22_LONG, CA22_S, ca22Build, ca22Post } from "./ca22";

describe("the ca22 fixture", () => {
  it("has two parts and three sessions: four prompts (one holding a nested prompt), an agent and a manual step, and one prompt", () => {
    const { steps, groups, making } = ca22Build();
    const sessions = groups.filter((group) => !group.implicit);
    expect(sessions.map((group) => groupKey(group))).toEqual([...CA22_S]);
    expect(steps.filter((step) => step.kind === "prompt").map((step) => step.id)).toEqual(["c22-p1", "c22-p2", "c22-p3", "c22-p4", "c22-p5"]);
    expect(steps.find((step) => step.id === "c22-p2")?.sentWith?.length).toBe(1);
    expect(steps.filter((step) => step.kind === "agent" || step.kind === "manual").map((step) => step.id)).toEqual(["c22-agent", "c22-manual"]);
    expect((making.workstreams ?? []).map((part) => part.key)).toEqual([CA22_A, CA22_B]);
  });

  it("the post links 'the words' to Prompt 3", () => {
    expect(JSON.stringify(ca22Post())).toContain("node:c22-p3");
  });

  it("adds a long session of prompts on request", () => {
    const { steps, groups } = ca22Build(300);
    expect(steps.filter((step) => step.id.startsWith("c22-long-"))).toHaveLength(300);
    expect(groups.some((group) => groupKey(group) === CA22_LONG)).toBe(true);
  });
});
