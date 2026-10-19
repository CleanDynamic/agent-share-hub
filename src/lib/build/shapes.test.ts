// CA-02 P9 — five shapes of AI use, built and read back.
//
// Each shape in src/dev/fixtures/shapes.ts is a tree the composer would save. For each: buildSteps reads every step
// with the right kind, number, tool, model and children; every `uses` edge survives the read; the build page's
// renderers draw every part with its tool, models and roles; and every tool and model pair keeps the rules.
// CA-03 P9 adds a sixth shape, a team that checks itself, read back at the end.

import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/build", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build")>()), signedMediaUrl: async () => "https://example.com/m" }));

import { NodeCard } from "@/components/build/NodeCard";
import { allNodes, SHAPES, SHAPE_KEYS, SHAPE_NODE_TYPES, shapeDetailsProps, shapeListProps, shapeMapProps, type ShapeKey } from "@/dev/fixtures/shapes";
import { layoutMap, layoutOpened } from "@/lib/build/mapLayout";
import { pairCheck } from "@/lib/tools/modelRules";

import { buildSummary } from "./buildSummary";
import { agentModelsOf, buildSteps, checkStatus, runsLabel, usesOf, type Step } from "./graph";
import type { Build, NodeTree } from "./types";

afterEach(cleanup);

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

/** A step as the table below reads it: [id, kind, number, tool, model, children's ids]. */
const row = (step: Step) => [step.id, step.kind, step.number, step.tool, step.model, step.children.map((child) => child.id)];

const EXPECTED: Record<ShapeKey, unknown[]> = {
  alone: [["a-p1", "prompt", "1", "Claude", "Opus 5.5", []]],
  retrieval: [["r-p1", "prompt", "1", "Gemini Notebook", null, []]],
  agent: [["g-a1", "agent", "1", null, "Opus 5.5", ["g-a1:instructions", "g-p1", "g-p2"]]],
  team: [["t-team", "team", "1", null, null, ["t-lead", "t-research", "t-build", "t-review"]]],
  code: [
    ["c-p1", "prompt", "1", "Cursor", "Opus 5", []],
    ["c-p2", "prompt", "2", "Cursor", "Composer 2.5", []],
    ["c-c1", "code", "3", "Cursor", "Composer 2.5", []],
    ["c-c2", "code", "4", "Cursor", "Composer 2.5", []],
    ["c-m1", "manual", "5", "Vercel", null, []],
  ],
  "team-checks": [
    ["k-team", "team", "1", null, null, ["k-lead", "k-research", "k-build", "k-review"]],
    ["k-c1", "code", "2", "Claude Code", "Sonnet 5.5", []],
    ["k-check", "check", "3", null, null, []],
  ],
};

describe.each(SHAPE_KEYS)("the %s shape", (key) => {
  const { tree } = SHAPES[key];
  const steps = buildSteps(tree);
  const byId = new Map(allNodes(tree).map((entry) => [entry.id, entry]));

  it("reads every step back with its kind, number, tool, model and children", () => {
    expect(steps.map(row)).toEqual(EXPECTED[key]);
  });

  it("keeps every uses edge", () => {
    const stepUses = new Map(flatten(steps).map((step) => [step.id, step.uses]));
    for (const entry of allNodes(tree)) {
      const saved = usesOf(entry);
      if (saved.length === 0) continue;
      // A result is not a step: its uses are read from the node, as the List and the Map read them.
      const read = entry.type === "result" ? usesOf(entry) : stepUses.get(entry.id);
      expect(read, entry.id).toEqual(saved);
      for (const use of saved) expect(byId.has(use.node_id), `${entry.id} uses ${use.node_id}`).toBe(true);
    }
  });

  it("keeps the rules for every tool and model pair", () => {
    for (const entry of allNodes(tree)) {
      const payload = (entry.payload ?? {}) as Record<string, unknown>;
      const tool = (payload.tool ?? payload.harness) as string | undefined;
      const model = payload.model as string | undefined;
      if (!tool && !model) continue;
      expect(pairCheck(tool, model), `${entry.id}: ${tool} with ${model}`).toBe("ok");
      for (const extra of agentModelsOf(payload)) expect(pairCheck(tool, extra.model), `${entry.id}: ${tool} with ${extra.model}`).toBe("ok");
    }
  });

  it("draws every part on the build page with its tool, models and roles", () => {
    const build = { id: "shape-build", slug: `shape-${key}`, title: SHAPES[key].title } as Build;
    const types = new Map(SHAPE_NODE_TYPES.map((type) => [type.key, type]));
    for (const entry of allNodes(tree)) {
      const { container } = render(
        createElement(NodeCard, { node: entry, nodeType: types.get(entry.type), build, resolveNode: (id: string) => byId.get(id), resolveMedia: () => null }),
      );
      const text = container.textContent ?? "";
      const payload = (entry.payload ?? {}) as Record<string, unknown>;
      if (entry.type === "prompt" && payload.tool) expect(text, entry.id).toContain(steps.flatMap((step) => [step, ...step.children]).find((step) => step.id === entry.id)?.tool ?? "");
      if (typeof payload.model === "string" && entry.type !== "agent_config") expect(text, entry.id).toContain(payload.model);
      if (entry.type === "agent_config") {
        expect(text, entry.id).toContain(String(payload.model));
        if (payload.harness) expect(text, entry.id).toContain("Runs in");
        for (const extra of agentModelsOf(payload).length > 1 ? agentModelsOf(payload) : []) expect(text, entry.id).toContain(`${extra.model} · ${extra.role}`);
        for (const ref of (payload.tools as { tool_ref: string }[] | undefined) ?? []) expect(text, entry.id).toContain(String((byId.get(ref.tool_ref)?.payload as { service?: string }).service));
      }
      if (entry.type === "code") {
        expect(text, entry.id).toContain(String(payload.filename));
        const written = flatten(steps).find((step) => step.id === entry.id);
        expect(text, entry.id).toContain(`Written with ${written?.tool} · ${written?.model}`);
      }
      if (entry.type === "manual_step") expect(text, entry.id).toContain(String(payload.tool));
      if (entry.type === "document") expect(text, entry.id).toContain(String(payload.title));
      if (entry.type === "eval_run") for (const said of [payload.tested, payload.passing, payload.on_fail]) expect(text, entry.id).toContain(String(said));
      cleanup();
    }
  });

  it("gives the List, the Map and Details what they draw", () => {
    const list = shapeListProps(key);
    expect(list.steps.map((step) => step.id)).toEqual(steps.map((step) => step.id));
    const map = shapeMapProps(key);
    const layout = layoutMap(map.steps, map.groups, map.files, map.tools, map.results, map.suggestions);
    for (const step of steps) expect(layout.boxes.some((box) => box.id === step.id), step.id).toBe(true);
    const view = shapeDetailsProps(key).view;
    expect(view && "id" in view ? view.id : null).toBe(SHAPES[key].selected);
  });
});

describe("what each shape holds", () => {
  it("names the agent's harness, its two models with their roles and its two tools", () => {
    const [agent] = buildSteps(SHAPES.agent.tree);
    expect(agent).toMatchObject({
      harness: "Hermes Agent",
      models: [
        { model: "Opus 5.5", role: "main" },
        { model: "Haiku 5.5", role: "other" },
      ],
      toolRefs: ["g-t1", "g-t2"],
    });
  });

  it("leads the team with an agent in Claude Code, Sonnet 5.5 acting", () => {
    const [team] = buildSteps(SHAPES.team.tree);
    expect(team.children.map((child) => [child.number, child.title, child.harness, child.model])).toEqual([
      ["1.1", "Lead", "Claude Code", "Fable 5.1"],
      ["1.2", "Research", "Claude Code", "Opus 5.5"],
      ["1.3", "Build", "Claude Code", "Sonnet 5.5"],
      ["1.4", "Review", "Claude Code", "Haiku 5.5"],
    ]);
    expect(team.children[0].models).toEqual([
      { model: "Fable 5.1", role: "main" },
      { model: "Sonnet 5.5", role: "acts" },
    ]);
    const result = SHAPES.team.tree.find((entry) => entry.type === "result") as NodeTree;
    expect(usesOf(result).map((use) => use.node_id)).toEqual(["t-research", "t-build", "t-review"]);
  });

  it("feeds the retrieval prompt two files", () => {
    const [prompt] = buildSteps(SHAPES.retrieval.tree);
    expect(prompt.uses).toEqual([
      { kind: "file", node_id: "r-f1" },
      { kind: "file", node_id: "r-f2" },
    ]);
  });

  it("keeps app.ts as the entrypoint and schema.sql as SQL", () => {
    const steps = buildSteps(SHAPES.code.tree);
    expect(steps.filter((step) => step.kind === "code").map((step) => [step.filename, step.language, step.entrypoint])).toEqual([
      ["app.ts", "ts", true],
      ["schema.sql", "sql", false],
    ]);
  });
});

describe("the outside-content warning on the build page (CA-03 P7)", () => {
  it("reads it for the agent in Hermes Agent with Gmail, and not for the team in Claude Code", async () => {
    const { readerSteps } = await import("./readerSteps");
    const [agent] = readerSteps(SHAPES.agent.tree, null);
    expect(agent.outside).toEqual(["Hermes Agent", "Gmail"]);
    const [team] = readerSteps(SHAPES.team.tree, null);
    expect(team.children.map((child) => child.outside)).toEqual([[], [], [], []]);
  });
});

describe("a team that checks itself (CA-03 P9)", () => {
  const { tree } = SHAPES["team-checks"];
  const steps = buildSteps(tree);
  const [team, code, check] = steps;

  it("reads back the team, its lead and the three agents with the words they were given", () => {
    expect(team.title).toBe("Bakery order page team");
    expect(team.runs).toEqual({ how: "parallel", count: 3 });
    expect(team.children.map((child) => [child.number, child.title, child.harness, child.model])).toEqual([
      ["1.1", "Lead", "Claude Code", "Fable 5.1"],
      ["1.2", "Research", "Claude Code", "Opus 5.5"],
      ["1.3", "Build", "Claude Code", "Sonnet 5.5"],
      ["1.4", "Review", "Claude Code", "Haiku 5.5"],
    ]);
    expect(team.children[0].models).toEqual([
      { model: "Fable 5.1", role: "main" },
      { model: "Sonnet 5.5", role: "acts" },
    ]);
    for (const helper of team.children.slice(1)) expect(helper.uses).toEqual([{ kind: "output", node_id: "k-lead" }]);
    const build = team.children[2];
    expect(build.toolRefs).toEqual(["k-t1", "k-t2"]);
    expect(build.memory).toBe("which page sections it already reviewed");
    expect(runsLabel(team.children[3].runs)).toBe("Again until the review has no changes · at most 3 times");
  });

  it("reads back the code step and the check, with its answers and its 14 of 14", () => {
    expect([code.filename, code.language, code.uses]).toEqual(["order-form.tsx", "tsx", [{ kind: "output", node_id: "k-team" }]]);
    expect(check.uses).toEqual([{ kind: "output", node_id: "k-c1" }]);
    expect(check.check).toMatchObject({
      tested: "Places a test order for 2 sourdough loaves",
      passing: "The total shows £9.00",
      onFail: "The total showed £8.99. The Build agent fixed the rounding and ran it again.",
      passed: 14,
      total: 14,
    });
    expect(checkStatus(check.check!)).toEqual({ allPassed: true, line: "Passed 14 of 14 runs · since 12 Oct" });
    const result = tree.find((entry) => entry.type === "result") as NodeTree;
    expect(usesOf(result)).toEqual([{ kind: "output", node_id: "k-c1" }]);
  });

  it("puts the three agents in one column on the Map, fanned out from the lead and fanned in to the code step", () => {
    const map = shapeMapProps("team-checks");
    const layout = layoutOpened(team, map.steps, map.files, map.tools, map.results);
    const at = (id: string) => layout.boxes.find((box) => box.id === id)!;
    const [lead, research, build, review] = ["k-lead", "k-research", "k-build", "k-review"].map(at);
    expect(lead.column).toBe(0);
    expect([research.column, build.column, review.column]).toEqual([1, 1, 1]);
    expect(new Set([research.x, build.x, review.x]).size).toBe(1);
    expect(layout.sideBySide.map((group) => group.ids)).toEqual([["k-research", "k-build", "k-review"]]);
    expect(layout.wires.filter((wire) => wire.from === "k-lead").map((wire) => wire.to)).toEqual(["k-research", "k-build", "k-review"]);
    expect(layout.wires.filter((wire) => wire.to === "k-c1").map((wire) => wire.from)).toEqual(["k-research", "k-build", "k-review"]);
  });

  it("says what kind of build it is", () => {
    expect(buildSummary(steps)).toBe("A team of 4 agents · checks its own work · 1 code file");
  });

  it("warns that the Build agent reads content it doesn't control, naming Gmail", async () => {
    const { readerSteps } = await import("./readerSteps");
    const [readerTeam] = readerSteps(tree, null);
    expect(readerTeam.children.map((child) => child.outside)).toEqual([[], [], ["Gmail"], []]);
    expect(shapeListProps("team-checks").names).toMatchObject({ "k-t1": "Gmail", "k-t2": "Google Sheets" });
  });

  it("leaves the plaque's markup as it was without the check", async () => {
    const { buildFixture } = await import("@/dev/fixtures/build");
    const { buildStepsFixture } = await import("@/dev/fixtures/buildSteps");
    const { BuildView } = await import("@/pages/site/build/BuildView");
    const { stepTabs } = await import("@/pages/site/build/buildModel");
    const checkNode = tree.find((entry) => entry.type === "eval_run") as NodeTree;
    const plaqueWith = (extra: NodeTree[]) => {
      const { title, outcome, ...built } = buildStepsFixture("list", extra);
      const base = buildFixture("desktop");
      const props = { ...base, hero: { ...base.hero, title, outcome }, viewer: { ...base.viewer, tabs: stepTabs(false), tab: "anatomy" as const }, steps: built };
      const { container } = render(createElement(MemoryRouter, { initialEntries: ["/dev/kit/pages/build-steps"] }, createElement(BuildView, props)));
      const plaque = container.querySelector('[data-ui="plaque"]')?.outerHTML ?? "";
      cleanup();
      return plaque;
    };
    const without = plaqueWith([]);
    expect(without).not.toBe("");
    expect(plaqueWith([{ ...checkNode, uses: undefined, payload: { ...(checkNode.payload as object), uses: [] } } as NodeTree])).toBe(without);
  });
});
