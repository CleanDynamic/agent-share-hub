import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildNode, NodeTree } from "@/lib/build";

const graph = vi.hoisted(() => ({
  addAgent: vi.fn(),
  addAgentPrompt: vi.fn(),
  addTeam: vi.fn(),
  setInstructions: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), default: vi.fn() }));

vi.mock("@/lib/build/graph", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/graph")>()), ...graph }));
vi.mock("sonner", () => ({ toast: Object.assign(toast.default, { error: toast.error }) }));
vi.mock("@/lib/build", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build")>()), deleteNode: vi.fn() }));

import { useComposePrompts } from "./useComposePrompts";
import type { ComposeNodes } from "./useComposeNodes";

const row = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: "b1", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: {}, source_ref: null, created_at: "", updated_at: "", children: [], ...over }) as NodeTree;

function hook(tree: NodeTree[] = []) {
  const record = vi.fn();
  const nodes: ComposeNodes = {
    tree,
    current: () => tree,
    run: <T,>(task: () => Promise<T>) => task(),
    record,
    settled: () => Promise.resolve(),
  } as unknown as ComposeNodes;
  const rendered = renderHook(() =>
    useComposePrompts({ buildId: "b1", nodes, ensureBuild: () => Promise.resolve("b1"), sessions: [], sessionPrompts: () => undefined }),
  );
  return { ...rendered, record, tree };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adding an agent or a team (UI-P69)", () => {
  it("adds an agent with the name and model, records it and says which node it is", async () => {
    graph.addAgent.mockResolvedValue({ id: "ag1" } as BuildNode);
    const { result, record, tree } = hook();
    let id: string | null = null;
    await act(async () => {
      id = await result.current.addAgentOrTeam({ kind: "agent", name: "Order checker", model: "Opus 5.5" });
    });
    expect(graph.addAgent).toHaveBeenCalledWith("b1", tree, { name: "Order checker", model: "Opus 5.5" });
    expect(record).toHaveBeenCalledWith("ag1", { id: "ag1" });
    expect(id).toBe("ag1");
  });

  it("adds a team holding one agent and says which node the team is", async () => {
    graph.addTeam.mockResolvedValue({ team: { id: "tm1" }, agent: { id: "ag1" } });
    const { result, record } = hook();
    let id: string | null = null;
    await act(async () => {
      id = await result.current.addAgentOrTeam({ kind: "team", name: null, model: "Opus 5.5" });
    });
    expect(graph.addTeam).toHaveBeenCalledWith("b1", [], { name: null, model: "Opus 5.5" });
    expect(record).toHaveBeenCalledWith("tm1", { id: "tm1" });
    expect(id).toBe("tm1");
  });

  it("says why a team could not be added while the node type is not live, and resolves null", async () => {
    graph.addTeam.mockRejectedValue(new Error("That needs the Deploy queue item from UI-P61."));
    const { result } = hook();
    let id: string | null = "x";
    await act(async () => {
      id = await result.current.addAgentOrTeam({ kind: "team", name: null, model: "Opus 5.5" });
    });
    expect(id).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Teams need the Deploy queue item from UI-P61.");
  });

  it("adds an agent inside a team", async () => {
    graph.addAgent.mockResolvedValue({ id: "ag2" } as BuildNode);
    const { result, tree } = hook([row({ id: "tm1", type: "team" })]);
    let id: string | null = null;
    await act(async () => {
      id = await result.current.addAgentTo("tm1", "Opus 5.5");
    });
    expect(graph.addAgent).toHaveBeenCalledWith("b1", tree, { model: "Opus 5.5", parentId: "tm1" });
    expect(id).toBe("ag2");
  });
});

describe("prompts and instructions of an agent (UI-P69)", () => {
  const agent = row({ id: "ag1", type: "agent_config", payload: { system_prompt: "Be brief.", model: "m" } });

  it("adds a prompt inside an agent, and resolves true", async () => {
    graph.addAgentPrompt.mockResolvedValue({ id: "pr1" } as BuildNode);
    const { result, tree } = hook([agent]);
    let saved = false;
    await act(async () => {
      saved = await result.current.addPromptTo("ag1", "Also flag items over ten pounds.");
    });
    expect(graph.addAgentPrompt).toHaveBeenCalledTimes(1);
    const [given, passedTree, text] = graph.addAgentPrompt.mock.calls[0];
    expect(given).toMatchObject({ id: "ag1", type: "agent_config" });
    expect(given).not.toHaveProperty("children");
    expect(passedTree).toBe(tree);
    expect(text).toBe("Also flag items over ten pounds.");
    expect(saved).toBe(true);
  });

  it("resolves false when the agent is gone or the write is refused", async () => {
    const { result } = hook([agent]);
    let saved = true;
    await act(async () => {
      saved = await result.current.addPromptTo("missing", "x");
    });
    expect(saved).toBe(false);
    expect(graph.addAgentPrompt).not.toHaveBeenCalled();

    graph.addAgentPrompt.mockRejectedValue(new Error("A prompt needs its text."));
    await act(async () => {
      saved = await result.current.addPromptTo("ag1", "  ");
    });
    expect(saved).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Couldn't add that prompt. Try again.");
  });

  it("writes the instructions of an agent that sits inside a team", async () => {
    graph.setInstructions.mockResolvedValue({ id: "ag9" } as BuildNode);
    const inner = row({ id: "ag9", parent_id: "tm1", type: "agent_config", payload: { system_prompt: "", model: "m" } });
    const { result, record } = hook([row({ id: "tm1", type: "team", children: [inner] })]);
    await act(async () => {
      result.current.setInstructions("ag9", "Find the sources.");
      await Promise.resolve();
    });
    expect(graph.setInstructions).toHaveBeenCalledWith(expect.objectContaining({ id: "ag9" }), "Find the sources.");
    expect(record).toHaveBeenCalledWith("ag9", { id: "ag9" });
  });
});
