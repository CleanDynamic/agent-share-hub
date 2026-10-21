import { beforeEach, describe, expect, it, vi } from "vitest";

const getNodeTree = vi.fn();
const updateBuild = vi.fn();
vi.mock("./nodes", () => ({ getNodeTree: (...a: unknown[]) => getNodeTree(...a) }));
vi.mock("./builds", () => ({ updateBuild: (...a: unknown[]) => updateBuild(...a) }));

import { patternsOfBuild, refreshPatterns, resetPatternsColumn } from "./patternsWrite";

const BUILD = "33333333-0000-4000-8000-000000000003";
const node = (over: Record<string, unknown>) => ({ id: "n", build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "x" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over });

const router = [
  node({ id: "d", position: 1, type: "decision", payload: { provider: "typesafe-jev", model: "jev-1.13.0", questions: [{ id: "team", type: "choice", instructions: "", options: [{ key: "a" }, { key: "b" }] }] } }),
  node({ id: "a", position: 2, type: "agent_config", payload: { system_prompt: "x", model: "m", runs_when: { decision: "d", question: "team", is: ["a"] }, helpers: [{ provider: "scaledown", job: "summarize" }] } }),
];

beforeEach(() => {
  getNodeTree.mockReset();
  updateBuild.mockReset();
  updateBuild.mockResolvedValue({});
  resetPatternsColumn();
});

describe("builds.patterns (CA-13 P11)", () => {
  it("works the patterns out from the build's own steps", async () => {
    getNodeTree.mockResolvedValue(router);
    await expect(patternsOfBuild(BUILD, {})).resolves.toEqual(["router", "long-running", "structured-output"]);
  });

  it("writes only the patterns column", async () => {
    getNodeTree.mockResolvedValue(router);
    await expect(refreshPatterns(BUILD, {})).resolves.toBe(true);
    expect(updateBuild).toHaveBeenCalledWith(BUILD, { patterns: ["router", "long-running", "structured-output"] });
  });

  it("writes an empty list for a build that uses none, so a pattern that no longer holds is taken off", async () => {
    getNodeTree.mockResolvedValue([node({})]);
    await refreshPatterns(BUILD, {});
    expect(updateBuild).toHaveBeenCalledWith(BUILD, { patterns: [] });
  });

  it("before the migration, the first write that finds the column missing is remembered and no more are tried", async () => {
    getNodeTree.mockResolvedValue(router);
    updateBuild.mockRejectedValue(Object.assign(new Error('column "patterns" of relation "builds" does not exist'), { code: "42703" }));
    await expect(refreshPatterns(BUILD, {})).resolves.toBe(false);
    await expect(refreshPatterns(BUILD, {})).resolves.toBe(false);
    expect(updateBuild).toHaveBeenCalledTimes(1);
  });

  it("never fails the save that called it", async () => {
    getNodeTree.mockRejectedValue(new Error("network"));
    await expect(refreshPatterns(BUILD, {})).resolves.toBe(false);
  });
});
