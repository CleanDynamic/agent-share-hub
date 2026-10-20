// CA-04 P6 — worked until, and runs from a script or GitHub: the goal, the two new ways a step ran, the command split
// and the workflow reader.

import { describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn(async (row: unknown) => row);
vi.mock("./nodes", () => ({ upsertNode: (...a: unknown[]) => upsertNode(...(a as [unknown])), reorderNodes: vi.fn(), getNodeTree: vi.fn(), deleteNode: vi.fn() }));

import { buildSteps, parseRuns, runsLabel, sessionGroups, setRuns } from "./graph";
import { goalLine, goalOf, goalRefusal } from "./making";
import { claudePromptOf, readWorkflow, runsWhenLine } from "./runsFrom";
import { routeSetupFiles } from "./setup";
import type { BuildNode, NodeTree } from "./types";

describe("worked until", () => {
  it("reads a goal defensively and says it with the parts that exist", () => {
    expect(goalOf({ condition: " the tests pass ", atMost: 40, reached: "reached", turns: 12 })).toEqual({ condition: "the tests pass", atMost: 40, reached: "reached", turns: 12 });
    expect(goalOf({ condition: "x", atMost: 900, reached: "maybe", turns: 3 })).toEqual({ condition: "x" });
    expect(goalOf({ condition: "  " })).toBeNull();
    expect(goalLine({ condition: "the tests pass", atMost: 40, reached: "reached", turns: 12 })).toBe("Worked until the tests pass · at most 40 turns · reached in 12");
    expect(goalLine({ condition: "the tests pass", reached: "limit" })).toBe("Worked until the tests pass");
    expect(goalRefusal({ condition: "a".repeat(201) })).toMatch(/200/);
    expect(goalRefusal({ condition: "ok", atMost: 0 })).toMatch(/1 to 500/);
    expect(goalRefusal({ condition: "ok", atMost: 500 })).toBeNull();
  });

  it("puts a saved goal on its session's group", () => {
    const tree = [{ id: "p", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "x", session: "typed-a" }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] } as NodeTree];
    const [group] = sessionGroups(buildSteps(tree), [], {}, { "typed-a": { tool: null, date: "2026-10-12", goal: { condition: "tests pass", reached: "reached", turns: 12 } } });
    expect(group.goal).toEqual({ condition: "tests pass", reached: "reached", turns: 12 });
  });
});

describe("the two new ways it ran", () => {
  const agent = { id: "a", build_id: "b", parent_id: null, position: 1, type: "agent_config", title: null, note: null, payload: { system_prompt: "x", model: "m" }, source_ref: null, event_id: null, is_gap: false } as unknown as BuildNode;

  it("round trips goal and script, and keeps every value it had", async () => {
    const goal = (await setRuns(agent, { how: "goal", detail: "ignored" })) as BuildNode;
    expect((goal.payload as { runs: unknown }).runs).toEqual({ how: "goal" });
    expect(parseRuns({ how: "goal" })).toEqual({ how: "goal" });
    expect(runsLabel({ how: "goal" })).toBe("Until a goal was reached");
    const command = 'claude -p "Fix the failing tests" --max-turns 20';
    const script = (await setRuns(agent, { how: "script", detail: command })) as BuildNode;
    expect((script.payload as { runs: unknown }).runs).toEqual({ how: "script", detail: command });
    expect(parseRuns({ how: "script", detail: command })).toEqual({ how: "script", detail: command });
    expect(runsLabel({ how: "script", detail: command })).toBe("From a script or GitHub");
    for (const how of ["once", "parallel", "until", "schedule", "event"] as const) expect(parseRuns({ how, count: 3, detail: "d" })?.how).toBe(how);
  });
});

describe("the command split", () => {
  it("takes the quoted text of claude -p or claude --print, exactly", () => {
    expect(claudePromptOf('claude -p "Fix the failing tests in src/"')).toBe("Fix the failing tests in src/");
    expect(claudePromptOf("claude --print 'Write the changelog'")).toBe("Write the changelog");
    expect(claudePromptOf('claude -p --model opus "Say \\"hi\\""')).toBe('Say "hi"');
    expect(claudePromptOf("claude -p summarise")).toBeNull();
    expect(claudePromptOf('npx claude -p "x"')).toBeNull();
    expect(claudePromptOf('claude "interactive"')).toBeNull();
  });
});

describe("the workflow reader", () => {
  const head = "name: Claude\n";
  const job = "jobs:\n  claude:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: anthropics/claude-code-action@v1\n        with:\n";

  it("reads a plain block of events with their types, and a one-line prompt", () => {
    const text = `${head}on:\n  pull_request:\n    types: [opened, synchronize]\n    branches: [main]\n  issue_comment:\n    types: [created]\n${job}          prompt: "Review this pull request for bugs."\n`;
    const reading = readWorkflow(text);
    expect(reading).toEqual({
      events: [
        { name: "pull_request", types: ["opened", "synchronize"] },
        { name: "issue_comment", types: ["created"] },
      ],
      prompt: "Review this pull request for bugs.",
    });
    expect(runsWhenLine(reading?.events ?? [])).toBe("Runs when a pull request is opened or a pull request gets new commits or someone comments on an issue or a pull request");
  });

  it("reads on: as one word, and as a one-line list", () => {
    expect(readWorkflow(`${head}on: workflow_dispatch\n${job}          prompt: Tidy the README\n`)).toEqual({ events: [{ name: "workflow_dispatch", types: [] }], prompt: "Tidy the README" });
    const listed = readWorkflow(`${head}on: [push, pull_request]\n${job}          model: x\n`);
    expect(listed).toEqual({ events: [{ name: "push", types: [] }, { name: "pull_request", types: [] }], prompt: null });
    expect(runsWhenLine(listed?.events ?? [])).toBe("Runs when code is pushed or a pull request changes");
  });

  it("declines what it is not sure of, and keeps the file", () => {
    const unsure = `${head}on: { pull_request: { types: [opened] } }\n${job}          prompt: |\n            Review it.\n`;
    expect(readWorkflow(unsure)).toEqual({ events: null, prompt: null });
    expect(readWorkflow(`${head}on:\n  push:\n${job}`)).toEqual({ events: [{ name: "push", types: [] }], prompt: null });
    expect(readWorkflow("on: push\njobs: {}\n")).toBeNull();
    const { drafts } = routeSetupFiles([{ name: "claude.yml", path: ".github/workflows/claude.yml", text: unsure }]);
    expect(drafts).toEqual([{ kind: "workflow", file: 0, reading: { events: null, prompt: null } }]);
  });
});
