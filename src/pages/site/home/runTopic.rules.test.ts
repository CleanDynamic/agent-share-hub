// SV-21 P1: who is offered the button on a run (UX-08 P2: "Start a topic from this run").

import { describe, expect, it } from "vitest";

import { canStartTopicFromRun } from "./runTopic";

describe("canStartTopicFromRun", () => {
  it("is for the maker, on a run that did not work", () => {
    expect(canStartTopicFromRun({ worked: false }, "maker", "maker")).toBe(true);
    expect(canStartTopicFromRun({ worked: true }, "maker", "maker")).toBe(false);
    expect(canStartTopicFromRun({ worked: false }, "maker", "someone")).toBe(false);
    expect(canStartTopicFromRun({ worked: false }, "maker", null)).toBe(false);
  });
});
