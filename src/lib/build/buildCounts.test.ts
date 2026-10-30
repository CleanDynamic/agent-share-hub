// SV-23 P1: the stored counts are the composer's own, and a write is owed only when one differs from the row's.

import { describe, expect, it } from "vitest";

import { countsToWrite, heldCountsOf, storedCountsOf } from "./buildCounts";
import type { SessionGroup, Step } from "./graph";

const step = (number: string, kind: Step["kind"], children: Step[] = []): Step => ({ number, kind, children }) as unknown as Step;
const group = (key: string, implicit = false): SessionGroup => ({ key, kind: "import", implicit, sessionId: key, number: 1, tool: null, model: null, startedAt: null, stepNumbers: [] }) as SessionGroup;

describe("storedCountsOf", () => {
  it("counts top-level steps, agents anywhere, parts, and the sessions the composer shows", () => {
    const steps = [step("1", "prompt"), step("2", "team", [step("2.1", "agent"), step("2.2", "agent")]), step("3", "agent"), step("4", "code")];
    const counts = storedCountsOf(steps, [group("a"), group("b"), group("implicit", true)], [{ key: "p1" }, { key: "p2" }]);
    expect(counts).toEqual({ step_count: 4, part_count: 2, agent_count: 3, session_count: 2 });
  });
});

describe("countsToWrite", () => {
  const counts = { step_count: 4, part_count: 1, agent_count: 0, session_count: 2 };

  it("writes every count to a build that was never counted", () => {
    expect(countsToWrite(counts, { step_count: null, part_count: null, agent_count: null, session_count: 0 })).toEqual(counts);
  });

  it("writes only what differs", () => {
    expect(countsToWrite(counts, { ...counts, step_count: 3 })).toEqual({ step_count: 4 });
  });

  it("writes nothing when the row already holds them", () => {
    expect(countsToWrite(counts, counts)).toBeNull();
  });

  it("writes nothing for an empty build that was never counted, and zeros for a counted build that was emptied", () => {
    const zero = { step_count: 0, part_count: 0, agent_count: 0, session_count: 0 };
    expect(countsToWrite(zero, { step_count: null, part_count: null, agent_count: null, session_count: 0 })).toBeNull();
    expect(countsToWrite(zero, { ...counts, agent_count: 2 })).toEqual({ step_count: 0, part_count: 0, agent_count: 0, session_count: 0 });
  });

  it("reads a row defensively", () => {
    expect(heldCountsOf(null)).toEqual({ step_count: null, part_count: null, agent_count: null, session_count: null });
    expect(heldCountsOf({ step_count: "3", session_count: 2 }).step_count).toBeNull();
  });
});
