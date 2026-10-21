import { describe, expect, it } from "vitest";

import { readyChecks } from "./forkRules";

const questions = [{ id: "team", type: "choice", instructions: "Which team?", options: [{ key: "billing" }, { key: "support" }] }];
const rows = [
  { id: "d1", type: "decision", parent_id: null, position: 1, title: "Router", payload: { provider: "typesafe-jev", model: "jev", questions, expected: { team: { value: "billing" } }, source: "original" } },
  { id: "d2", type: "decision", parent_id: null, position: 2, title: "Empty", payload: { provider: "typesafe-jev", model: "jev", questions } },
  { id: "p", type: "prompt", parent_id: null, position: 3, payload: { text: "x" } },
];

describe("a ready-made check (CA-13 P16)", () => {
  it("makes one unrun check for a decision with an expected answer, and none for the rest", () => {
    let n = 0;
    const out = readyChecks(rows, () => `c${++n}`);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("eval_run");
    expect(out[0].position).toBe(4);
    expect(out[0].payload).toMatchObject({ passing: "On this example, your copy should answer team = billing.", passed: 0, total: 0, uses: [{ kind: "output", node_id: "d1" }] });
  });
});
