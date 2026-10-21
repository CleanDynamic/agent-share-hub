import { describe, expect, it } from "vitest";

import { branchRows, hasBranches, JOIN_LINE } from "./branches";
import type { Step } from "./graph";

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: id, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;

const decision = step("d", "decision", {
  decision: { provider: "typesafe-jev", model: "jev-1.13.0", calledFrom: [], stateFrom: null, questions: [{ id: "team", type: "choice", instructions: "", options: [{ key: "billing" }, { key: "support" }] }] },
});
const when = (key: string) => ({ decision: "d", question: "team", is: [key] });

describe("branchRows", () => {
  it("draws a build with no condition exactly as it was", () => {
    const steps = [step("1", "prompt"), decision, step("3", "agent")];
    expect(hasBranches(steps)).toBe(false);
    expect(branchRows(steps).every((row) => row.kind === "step" && row.group === null)).toBe(true);
  });

  it("groups steps with the same condition under a head and marks where branches join", () => {
    const steps = [step("1", "prompt"), decision, step("3", "agent", { runsWhen: when("billing") }), step("4", "code", { runsWhen: when("billing") }), step("5", "agent", { runsWhen: when("support") }), step("6", "agent")];
    const rows = branchRows(steps);
    expect(rows.map((row) => (row.kind === "step" ? row.step.id : row.kind === "head" ? `head:${row.label}` : "join"))).toEqual([
      "1",
      "d",
      "head:If team is billing",
      "3",
      "4",
      "head:If team is support",
      "5",
      "join",
      "6",
    ]);
    const grouped = rows.filter((row) => row.kind === "step").map((row) => (row as { group: number | null }).group);
    expect(grouped).toEqual([null, null, 0, 0, 1, null]);
    expect(JOIN_LINE).toBe("Branches join here");
  });

  it("starts a new group when the same condition returns after an unconditioned step", () => {
    const rows = branchRows([decision, step("2", "agent", { runsWhen: when("billing") }), step("3", "agent"), step("4", "agent", { runsWhen: when("billing") })]);
    expect(rows.filter((row) => row.kind === "head")).toHaveLength(2);
  });
});
