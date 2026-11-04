// SV-21 P1: who is offered the button on a run (UX-08 P2: "Start a topic from this run").

import { describe, expect, it } from "vitest";

import { canOpenFromRun } from "@/lib/bounty/runRequestRules";

describe("canOpenFromRun", () => {
  it("is for the maker, on a run that did not work", () => {
    expect(canOpenFromRun({ worked: false }, "maker", "maker")).toBe(true);
    expect(canOpenFromRun({ worked: true }, "maker", "maker")).toBe(false);
    expect(canOpenFromRun({ worked: false }, "maker", "someone")).toBe(false);
    expect(canOpenFromRun({ worked: false }, "maker", null)).toBe(false);
  });
});
