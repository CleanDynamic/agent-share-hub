// SV-27: Harness has three states. A harness picked; Built in code (no harness), stored as `payload.built_in_code = true`; and
// Not sure, which stores nothing and shows "Not said". An old agent with no harness reads as Not said. Framework shows only for
// Built in code. The model rules treat Not said as no harness (any model); Classification says nothing about a harness for it.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn(async (node: unknown) => node);
vi.mock("@/lib/build/nodes", async (original) => ({ ...(await original<object>()), upsertNode: (node: unknown) => upsertNode(node) }));

const { buildSteps, setAgentSetup } = await import("@/lib/build/graph");
const { HARNESS_COPY } = await import("@/lib/build/harnessWords");
const { OWN_CODE, harnessTool, modelMenu } = await import("@/lib/tools/modelRules");
const { deriveClassification } = await import("@/lib/classify/derive");
const { AddAgentDialog } = await import("./AddAgentDialog");
const { AgentRuntimeFields } = await import("./AgentRuntimeFields");
const { resolveView } = await import("./detailsView");
const { fieldNamed } = await import("./optionalKit");
type BuildNode = import("@/lib/build/types").BuildNode;
type NodeTree = import("@/lib/build/types").NodeTree;
type AgentView = import("./DetailsPanel").AgentView;

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  upsertNode.mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const agent = (payload: Record<string, unknown>): NodeTree =>
  ({ id: "a1", build_id: "b1", type: "agent_config", title: null, note: null, payload: { system_prompt: "Help.", model: "opus-5-5", ...payload }, position: 0, parent_id: null, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as unknown as NodeTree;

const saved = async (payload: Record<string, unknown>, setup: Parameters<typeof setAgentSetup>[1]) => {
  await setAgentSetup(agent(payload) as unknown as BuildNode, setup);
  return (upsertNode.mock.calls.at(-1)?.[0] as { payload: Record<string, unknown> }).payload;
};

const setupOf = (tree: NodeTree[]) => {
  const steps = buildSteps(tree);
  const view = resolveView({ selectedId: "a1", steps, groups: [], tree, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined }) as AgentView;
  return view.setup;
};

describe("each state saves and reads back", () => {
  it("a harness picked: harness stored, built_in_code taken off", async () => {
    const payload = await saved({ built_in_code: true }, { model: "opus-5-5", harness: "openclaw" });
    expect(payload.harness).toBe("openclaw");
    expect(payload).not.toHaveProperty("built_in_code");
    expect(setupOf([agent(payload)])).toMatchObject({ harness: "OpenClaw" });
    expect(setupOf([agent(payload)])).not.toHaveProperty("builtInCode");
  });

  it("Built in code: built_in_code true, no harness", async () => {
    const payload = await saved({ harness: "openclaw" }, { model: "opus-5-5", harness: null, builtInCode: true });
    expect(payload).not.toHaveProperty("harness");
    expect(payload.built_in_code).toBe(true);
    expect(setupOf([agent(payload)])).toMatchObject({ harness: null, builtInCode: true });
  });

  it("Not sure: stores neither", async () => {
    const payload = await saved({ harness: "openclaw", built_in_code: true }, { model: "opus-5-5", harness: null, builtInCode: false });
    expect(payload).not.toHaveProperty("harness");
    expect(payload).not.toHaveProperty("built_in_code");
    expect(setupOf([agent(payload)])).toMatchObject({ harness: null });
    expect(setupOf([agent(payload)])).not.toHaveProperty("builtInCode");
  });

  it("an old agent with no harness reads as Not said", () => {
    expect(setupOf([agent({})])).toEqual(expect.objectContaining({ harness: null }));
    expect(setupOf([agent({})])).not.toHaveProperty("builtInCode");
  });

  it("the Add window hands back each state", () => {
    const onAdd = vi.fn();
    render(<AddAgentDialog open onOpenChange={vi.fn()} nextNumber={1} teamsAvailable onAdd={onAdd} />);
    const harness = () => screen.getAllByRole("button", { name: "Harness" }).at(-1) as HTMLElement;
    fieldNamed("Harness");
    fireEvent.click(harness());
    fireEvent.click(screen.getByRole("option", { name: "Built in code (no harness)" }));
    expect(harness().textContent).toBe("Built in code (no harness)");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onAdd).toHaveBeenLastCalledWith(expect.objectContaining({ harness: null, builtInCode: true }));
  });
});

describe("what each state shows", () => {
  const fields = (builtInCode: boolean, harness: string | null = null) =>
    render(<AgentRuntimeFields id="a1" kind="agent" phone={false} fields={{}} harness={harness} builtInCode={builtInCode} tools={[]} inTeam={false} deployment={[]} onExtras={vi.fn()} />);

  it("Framework shows for Built in code only, never for Not said or a harness", () => {
    fields(true);
    expect(screen.getByRole("button", { name: "Framework" })).toBeTruthy();
    cleanup();
    fields(false);
    expect(screen.queryByRole("button", { name: "Framework" })).toBeNull();
    cleanup();
    fields(false, "openclaw");
    expect(screen.queryByRole("button", { name: "Framework" })).toBeNull();
  });

  it("names the three states", () => {
    expect([HARNESS_COPY.builtInCode, HARNESS_COPY.notSure, HARNESS_COPY.notSaid]).toEqual(["Built in code (no harness)", "Not sure", "Not said"]);
  });

  it("the model rules treat Not said as no harness: the menu that takes any model", () => {
    // Not said and Built in code both store no harness, so both read the menu an agent with no harness always had.
    expect(harnessTool(null)).toBe(OWN_CODE);
    expect(modelMenu(harnessTool(null))).toEqual(modelMenu(OWN_CODE));
  });

  it("Classification reads Direct API only from Built in code, and nothing for Not said", () => {
    const method = (payload: Record<string, unknown>) => deriveClassification(buildSteps([agent(payload)]), { tree: [agent(payload)] }).derived.method?.values ?? [];
    expect(method({ built_in_code: true })).toContain("direct-api");
    expect(method({})).not.toContain("direct-api");
  });
});
