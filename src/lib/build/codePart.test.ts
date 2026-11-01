// SV-30 P9: what code belongs to, and where it runs.

import { describe, expect, it } from "vitest";

import { groupByPart, partLine, partOfOf, runsWhereOf } from "./codePart";
import { copyTogether } from "./copyTogether";
import { methodOf } from "./forkRules";
import { buildSteps } from "./graph";
import { setupPromptOf } from "./setupPrompt";
import { cleanExtras } from "./tileExtras";
import type { NodeTree } from "./types";

const code = (id: string, position: number, payload: Record<string, unknown>, parent: string | null = null) =>
  ({ id, build_id: "b", parent_id: parent, position, type: "code", title: null, note: null, payload: { language: "bash", source: "npm run evals", ...payload }, children: [], created_at: "", event_id: null, is_gap: false, source_ref: null }) as unknown as NodeTree;

describe("SV-30 P9: what code belongs to", () => {
  it("saves each part and where it runs, within the limit", () => {
    for (const part of ["app", "eval_harness", "ci", "setup"]) expect(cleanExtras("code", { part_of: part })).toEqual({ part_of: part });
    expect(cleanExtras("code", { part_of: "other" })).toEqual({ part_of: null });
    expect(cleanExtras("code", { runs_where: " Terminal 2, in the harness folder " })).toEqual({ runs_where: "Terminal 2, in the harness folder" });
    expect(() => cleanExtras("code", { runs_where: "x".repeat(41) })).toThrow("Where it runs: 40 characters max");
  });
  it("says it as one line, and reads unset as before", () => {
    expect(partLine({ partOf: "eval_harness", runsWhere: "Terminal 2, in the harness folder" })).toBe("Eval harness · Terminal 2, in the harness folder");
    expect(partLine({ partOf: "ci", runsWhere: "GitHub Actions" })).toBe("CI configuration · GitHub Actions");
    expect(partLine({})).toBeNull();
    expect(partOfOf({ source: "x" })).toBeNull();
    expect(runsWhereOf({ source: "x" })).toBeNull();
    const [step] = buildSteps([code("a", 1, {})]);
    expect(step.partOf).toBeUndefined();
    expect(step.runsWhere).toBeUndefined();
  });
  it("reads both onto the step", () => {
    const [step] = buildSteps([code("a", 1, { part_of: "eval_harness", runs_where: "Terminal 2" })]);
    expect(step).toMatchObject({ partOf: "eval_harness", runsWhere: "Terminal 2" });
  });
  it("groups by part only when more than one is present, and keeps the numbers", () => {
    const steps = buildSteps([code("a", 1, { part_of: "app" }), code("b", 2, { part_of: "eval_harness" }), code("c", 3, { part_of: "app" }), code("d", 4, { part_of: "ci" })]);
    const groups = groupByPart(steps);
    expect(groups?.map((group) => [group.part, group.tiles.map((tile) => tile.number)])).toEqual([["app", ["1", "3"]], ["eval_harness", ["2"]], ["ci", ["4"]]]);
    expect(steps.map((step) => step.number)).toEqual(["1", "2", "3", "4"]);
    expect(groupByPart(buildSteps([code("a", 1, { part_of: "app" }), code("b", 2, { part_of: "app" })]))).toBeNull();
    expect(groupByPart(buildSteps([code("a", 1, {}), code("b", 2, {})]))).toBeNull();
  });
  it("keeps both fields on a copy", () => {
    expect(methodOf({ part_of: "ci", runs_where: "GitHub Actions", build_cost: 4 })).toEqual({ part_of: "ci", runs_where: "GitHub Actions" });
  });
  it("tells the setup prompt which part each file belongs to", () => {
    const tree = [
      code("h", 1, { part_of: "eval_harness", runs_where: "Terminal 2, in the harness folder", filename: "run-evals.sh" }),
      code("a", 2, { part_of: "app", source: "npm start", filename: "start.sh" }),
    ];
    const text = setupPromptOf("pipeline", { tree }).text;
    expect(text).toContain("Add this to the eval harness, not the app (run-evals.sh):");
    expect(text).toContain("It runs in: Terminal 2, in the harness folder.");
    expect(text).toContain("Add this to the app (start.sh):");
    expect(copyTogether(buildSteps([code("a", 1, { part_of: "app" })])[0])).toContain("npm run evals");
  });
});
