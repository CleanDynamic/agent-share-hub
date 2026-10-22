import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteNode, type BuildNode, type NodeTree } from "@/lib/build";

const graph = vi.hoisted(() => ({
  addAgent: vi.fn(),
  addAgentPrompt: vi.fn(),
  addTeam: vi.fn(),
  setInstructions: vi.fn(),
  addManualStep: vi.fn(),
  placeStepAfter: vi.fn(),
  moveStep: vi.fn(),
  setManualFields: vi.fn(),
  removeUse: vi.fn(),
  addMadeFile: vi.fn(),
  addTool: vi.fn(),
  setAgentSetup: vi.fn(),
  addCode: vi.fn(),
  setExtras: vi.fn(),
  setRuntimeFields: vi.fn(),
}));
const media = vi.hoisted(() => ({ uploadMedia: vi.fn() }));
const making = vi.hoisted(() => ({ addMadeWithTools: vi.fn(), addWrittenPrompt: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), default: vi.fn() }));

vi.mock("@/lib/build/graph", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/graph")>()), ...graph }));
vi.mock("@/lib/build/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/media")>()), uploadMedia: media.uploadMedia }));
vi.mock("@/lib/build/making", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/making")>()), addMadeWithTools: making.addMadeWithTools }));
vi.mock("@/lib/build/composePrompts", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/composePrompts")>()), addWrittenPrompt: making.addWrittenPrompt }));
vi.mock("sonner", () => ({ toast: Object.assign(toast.default, { error: toast.error }) }));
vi.mock("@/lib/build", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build")>()), deleteNode: vi.fn() }));

import { useComposePrompts } from "./useComposePrompts";
import type { ComposeNodes } from "./useComposeNodes";

const row = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: "b1", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: {}, source_ref: null, created_at: "", updated_at: "", children: [], ...over }) as NodeTree;

let queryClient = new QueryClient();

function hook(tree: NodeTree[] = []) {
  const record = vi.fn();
  const nodes: ComposeNodes = {
    tree,
    current: () => tree,
    run: <T,>(task: () => Promise<T>) => task(),
    record,
    settled: () => Promise.resolve(),
  } as unknown as ComposeNodes;
  queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const rendered = renderHook(
    () => useComposePrompts({ buildId: "b1", nodes, ensureBuild: () => Promise.resolve("b1"), sessions: [], sessionPrompts: () => undefined }),
    { wrapper },
  );
  return { ...rendered, record, tree };
}

beforeEach(() => {
  vi.clearAllMocks();
  making.addMadeWithTools.mockResolvedValue({ madeWith: [], excluded: [] });
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

  it("writes an agent's limits, output, sample run and trace link to the agent itself (CA-15 P7)", async () => {
    graph.addAgent.mockResolvedValue({ id: "ag1" });
    graph.setRuntimeFields.mockResolvedValue({ id: "ag1", step: "traced" });
    graph.setExtras.mockResolvedValue({ id: "ag1", step: "dressed" });
    const { result, record } = hook();
    await act(async () => {
      await result.current.addAgentOrTeam({ kind: "agent", name: null, model: "Opus 5.5", limits: ["Stops after 20 steps"], output: "A Slack post", sample: "User: hi", traceUrl: "https://smith.langchain.com/r/1" });
    });
    expect(graph.setRuntimeFields).toHaveBeenCalledWith({ id: "ag1" }, { traceUrl: "https://smith.langchain.com/r/1" });
    expect(graph.setExtras).toHaveBeenCalledWith({ id: "ag1", step: "traced" }, { limits: ["Stops after 20 steps"], output: "A Slack post", sample: "User: hi" });
    expect(record).toHaveBeenCalledWith("ag1", { id: "ag1", step: "dressed" });
  });

  it("writes nothing extra for an agent that gave none of them", async () => {
    graph.addAgent.mockResolvedValue({ id: "ag1" });
    const { result } = hook();
    await act(async () => {
      await result.current.addAgentOrTeam({ kind: "agent", name: null, model: "Opus 5.5" });
    });
    expect(graph.setExtras).not.toHaveBeenCalled();
    expect(graph.setRuntimeFields).not.toHaveBeenCalled();
  });

  it("puts a team's orchestration pattern on the team, and its limits and supporting models on the agent that leads it (CA-15 P7)", async () => {
    graph.addTeam.mockResolvedValue({ team: { id: "tm1" }, agent: { id: "ag1" } });
    graph.setRuntimeFields.mockResolvedValue({ id: "ag1" });
    graph.setExtras.mockImplementation(async (node: { id: string }) => ({ ...node, extras: true }));
    const helpers = [{ provider: "scaledown", job: "summarize" as const }];
    const { result, record } = hook();
    await act(async () => {
      await result.current.addAgentOrTeam({ kind: "team", name: null, model: "Opus 5.5", pattern: "review", limits: ["Never deploys"], helpers });
    });
    expect(graph.setRuntimeFields).toHaveBeenCalledWith({ id: "ag1" }, { helpers });
    expect(graph.setExtras).toHaveBeenCalledWith({ id: "ag1" }, { limits: ["Never deploys"] });
    expect(graph.setExtras).toHaveBeenCalledWith({ id: "tm1" }, { pattern: "review" });
    expect(record).toHaveBeenCalledWith("tm1", { id: "tm1", extras: true });
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

describe("what an agent ran in, its models and its tools (CA-02 P5)", () => {
  const integration = (id: string, service: string) => row({ id, type: "integration", payload: { service } });

  it("hands the harness and the models on, and refers to the build's own integration node for a tool it has", async () => {
    graph.addAgent.mockResolvedValue({ id: "ag1" } as BuildNode);
    const tree = [integration("t-gmail", "Gmail")];
    const { result } = hook(tree);
    await act(async () => {
      await result.current.addAgentOrTeam({
        kind: "agent",
        name: null,
        model: "Opus 5.5",
        harness: "hermes-agent",
        models: [
          { model: "Opus 5.5", role: "main" },
          { model: "Haiku 5.5", role: "other" },
        ],
        tools: ["gmail"],
        instructions: "Triage my inbox",
      });
    });
    expect(graph.addAgent).toHaveBeenCalledWith("b1", tree, {
      name: null,
      model: "Opus 5.5",
      instructions: "Triage my inbox",
      harness: "hermes-agent",
      models: [
        { model: "Opus 5.5", role: "main" },
        { model: "Haiku 5.5", role: "other" },
      ],
      toolRefs: ["t-gmail"],
    });
    expect(graph.addTool).not.toHaveBeenCalled();
  });

  it("makes an integration node for a tool the build does not have yet", async () => {
    graph.addAgent.mockResolvedValue({ id: "ag1" } as BuildNode);
    graph.addTool.mockResolvedValue({ id: "t-new" } as BuildNode);
    const { result, record } = hook();
    await act(async () => {
      await result.current.addAgentOrTeam({ kind: "agent", name: null, model: "Opus 5.5", tools: ["github-copilot"] });
    });
    expect(graph.addTool).toHaveBeenCalledWith("b1", [], { service: "GitHub Copilot" });
    expect(record).toHaveBeenCalledWith("t-new", { id: "t-new" });
    expect(graph.addAgent).toHaveBeenCalledWith("b1", [], { name: null, model: "Opus 5.5", toolRefs: ["t-new"] });
  });

  it("changes an agent's setup from Details through setAgentSetup", async () => {
    graph.setAgentSetup.mockResolvedValue({ id: "ag1" } as BuildNode);
    const agent = row({ id: "ag1", type: "agent_config", payload: { system_prompt: "", model: "Opus 5.5" } });
    const { result } = hook([agent, integration("t-gmail", "Gmail")]);
    await act(async () => {
      result.current.setAgent("ag1", { model: "Sonnet 5.5", harness: "claude-code", models: [], tools: ["Gmail"] });
    });
    await vi.waitFor(() => expect(graph.setAgentSetup).toHaveBeenCalled());
    expect(graph.setAgentSetup.mock.calls[0][1]).toEqual({ model: "Sonnet 5.5", harness: "claude-code", models: [], toolRefs: ["t-gmail"] });
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

describe("a manual step (UI-P70)", () => {
  const steps = () => [row({ id: "p1", position: 1 }), row({ id: "p2", position: 2 }), row({ id: "m", position: 3, type: "manual_step", payload: { tool: "Figma", text: "x" } })];

  it("adds one with its picture, then moves it straight after the selected step", async () => {
    media.uploadMedia.mockResolvedValue({ id: "media-1" });
    graph.addManualStep.mockResolvedValue({ id: "m" } as BuildNode);
    graph.placeStepAfter.mockResolvedValue([{ id: "m", parent_id: null, position: 2 }, { id: "p2", parent_id: null, position: 3 }]);
    const { result, record, tree } = hook(steps());
    const file = new File(["x"], "hero.png", { type: "image/png" });
    let id: string | null = null;
    await act(async () => {
      id = await result.current.addManual({ tool: "Figma", text: "Laid out the hero", file, afterId: "p1" });
    });
    expect(media.uploadMedia).toHaveBeenCalledWith({ buildId: "b1", file });
    expect(graph.addManualStep).toHaveBeenCalledWith("b1", tree, { tool: "Figma", text: "Laid out the hero", media_id: "media-1" });
    expect(graph.placeStepAfter).toHaveBeenCalledWith("b1", tree, "m", "p1");
    expect(record).toHaveBeenCalledWith("m", { id: "m" });
    expect(record).toHaveBeenCalledWith("m", expect.objectContaining({ position: 2 }));
    expect(record).toHaveBeenCalledWith("p2", expect.objectContaining({ position: 3 }));
    expect(id).toBe("m");
  });

  it("goes at the end when nothing is selected, with no picture and no move", async () => {
    graph.addManualStep.mockResolvedValue({ id: "m" } as BuildNode);
    const { result } = hook(steps());
    await act(async () => {
      await result.current.addManual({ tool: "Figma", text: "Did a thing", file: null, afterId: null });
    });
    expect(media.uploadMedia).not.toHaveBeenCalled();
    expect(graph.addManualStep).toHaveBeenCalledWith("b1", expect.anything(), { tool: "Figma", text: "Did a thing", media_id: undefined });
    expect(graph.placeStepAfter).not.toHaveBeenCalled();
  });

  it("says why when the node type is not live, and resolves null", async () => {
    graph.addManualStep.mockRejectedValue(new Error("That needs the Deploy queue item from UI-P61."));
    const { result } = hook(steps());
    let id: string | null = "x";
    await act(async () => {
      id = await result.current.addManual({ tool: "Figma", text: "x", file: null, afterId: null });
    });
    expect(id).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Manual steps need the Deploy queue item from UI-P61.");
  });

  it("moves a manual step past whatever step is next to it, not only prompts", async () => {
    graph.moveStep.mockResolvedValue([{ id: "m", parent_id: null, position: 2 }, { id: "p2", parent_id: null, position: 3 }]);
    const { result, record, tree } = hook(steps());
    await act(async () => {
      result.current.move("m", -1);
      await Promise.resolve();
    });
    expect(graph.moveStep).toHaveBeenCalledWith("b1", tree, "m", -1);
    expect(record).toHaveBeenCalledWith("p2", expect.objectContaining({ position: 3 }));
  });

  it("puts a stored picture on the step, and refuses what is not a picture", async () => {
    media.uploadMedia.mockResolvedValue({ id: "media-2" });
    graph.setManualFields.mockResolvedValue({ id: "m" } as BuildNode);
    const { result } = hook(steps());
    let saved = false;
    await act(async () => {
      saved = await result.current.setManualPicture("m", new File(["x"], "new.png", { type: "image/png" }));
    });
    expect(saved).toBe(true);
    expect(graph.setManualFields).toHaveBeenCalledWith(expect.objectContaining({ id: "m" }), { media_id: "media-2" });
    await act(async () => {
      saved = await result.current.setManualPicture("m", new File(["x"], "spec.pdf", { type: "application/pdf" }));
    });
    expect(saved).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Couldn't add spec.pdf. Try again.");
  });
});

describe("tools on steps feed Made with (TF-03)", () => {
  const manual = () => [row({ id: "m", position: 1, type: "manual_step", payload: { tool: "Figma", text: "x" } })];
  const settle = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

  it("a manual step added in Base44 adds Base44, and the Card shows it at once", async () => {
    graph.addManualStep.mockResolvedValue({ id: "m" } as BuildNode);
    making.addMadeWithTools.mockResolvedValue({ madeWith: ["Claude Code", "Base44"], excluded: [] });
    const { result } = hook();
    queryClient.setQueryData(["build", "getMadeWith", "b1"], { madeWith: ["Claude Code"], excluded: [] });
    await act(async () => {
      await result.current.addManual({ tool: "base44", text: "Built the form", file: null, afterId: null });
    });
    await settle();
    expect(making.addMadeWithTools).toHaveBeenCalledWith("b1", ["Base44"]);
    expect(queryClient.getQueryData(["build", "getMadeWith", "b1"])).toEqual({ madeWith: ["Claude Code", "Base44"], excluded: [] });
  });

  it("a name the tool list does not know is passed as typed", async () => {
    graph.addManualStep.mockResolvedValue({ id: "m" } as BuildNode);
    const { result } = hook();
    await act(async () => {
      await result.current.addManual({ tool: "My Own Script", text: "x", file: null, afterId: null });
    });
    expect(making.addMadeWithTools).toHaveBeenCalledWith("b1", ["My Own Script"]);
  });

  it("a typed prompt added with Midjourney adds Midjourney; with no tool it adds nothing", async () => {
    making.addWrittenPrompt.mockResolvedValue({ id: "p9" } as BuildNode);
    const { result } = hook();
    await act(async () => {
      await result.current.addNow({ text: "a lighthouse", tool: "midjourney", model: null });
    });
    expect(making.addMadeWithTools).toHaveBeenCalledWith("b1", ["Midjourney"]);
    making.addMadeWithTools.mockClear();
    await act(async () => {
      await result.current.addNow({ text: "again", tool: null, model: null });
    });
    expect(making.addMadeWithTools).not.toHaveBeenCalled();
  });

  it("changing a manual step's tool adds the new tool; changing only its line does not", async () => {
    graph.setManualFields.mockResolvedValue({ id: "m" } as BuildNode);
    const { result } = hook(manual());
    await act(async () => {
      result.current.setManual("m", { tool: "Lovable" });
      await Promise.resolve();
    });
    await settle();
    expect(making.addMadeWithTools).toHaveBeenCalledWith("b1", ["Lovable"]);
    making.addMadeWithTools.mockClear();
    await act(async () => {
      result.current.setManual("m", { text: "new line" });
      await Promise.resolve();
    });
    await settle();
    expect(making.addMadeWithTools).not.toHaveBeenCalled();
  });

  it("a Made with failure is logged with a code and the build id only, and never blocks the step", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    graph.addManualStep.mockResolvedValue({ id: "m" } as BuildNode);
    making.addMadeWithTools.mockRejectedValue(Object.assign(new Error("addMadeWithTools failed: SECRET TEXT"), { cause: { code: "42501" } }));
    const { result } = hook();
    let id: string | null = null;
    await act(async () => {
      id = await result.current.addManual({ tool: "Base44", text: "x", file: null, afterId: null });
    });
    await settle();
    expect(id).toBe("m");
    expect(warn).toHaveBeenCalledWith("[Compose] Made with not updated", { code: "42501", buildId: "b1" });
    expect(toast.error).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("removing a step that makes a file (TF-07)", () => {
  const file = row({ id: "f1", position: 3, type: "document", payload: { title: "brand-guide.md", made_by: "p1" } });
  const plain = row({ id: "f2", position: 4, type: "document", payload: { title: "menu.pdf" } });
  const p1 = row({ id: "p1", position: 1 });
  const p2 = row({ id: "p2", position: 2, payload: { text: "x", uses: [{ kind: "file", node_id: "f1" }, { kind: "file", node_id: "f2" }] } });

  it("takes the file out of every step's uses, deletes it, then deletes the step", async () => {
    graph.removeUse.mockImplementation(async (node: BuildNode) => node);
    const { result, record } = hook([p1, p2, file, plain]);
    await act(async () => {
      result.current.remove("p1");
    });
    await vi.waitFor(() => expect(deleteNode).toHaveBeenCalledWith("p1"));
    expect(graph.removeUse).toHaveBeenCalledTimes(1);
    expect(graph.removeUse.mock.calls[0][0]).toMatchObject({ id: "p2" });
    expect(graph.removeUse.mock.calls[0][1]).toEqual({ kind: "file", node_id: "f1" });
    expect((deleteNode as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0])).toEqual(["f1", "p1"]);
    expect(record).toHaveBeenCalledWith("f1", null);
    expect(record).toHaveBeenCalledWith("p1", null);
  });

  it("leaves files that no removed step makes", async () => {
    const { result } = hook([p1, p2, file, plain]);
    await act(async () => {
      result.current.remove("p2");
    });
    await vi.waitFor(() => expect(deleteNode).toHaveBeenCalledWith("p2"));
    expect(graph.removeUse).not.toHaveBeenCalled();
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });
});

describe("naming and removing a file a step makes (TF-08)", () => {
  const p1 = row({ id: "p1", position: 1 });
  const p2 = row({ id: "p2", position: 2, payload: { text: "x", uses: [{ kind: "file", node_id: "f1" }, { kind: "file", node_id: "f2" }] } });
  const made = row({ id: "f1", position: 3, type: "document", payload: { title: "brand-guide.md", made_by: "p1" } });
  const plain = row({ id: "f2", position: 4, type: "document", payload: { title: "menu.pdf" } });

  it("writes the file for the step, records it and resolves its id", async () => {
    graph.addMadeFile.mockResolvedValue({ id: "f9" } as BuildNode);
    const { result, record, tree } = hook([p1]);
    let id: string | null = null;
    await act(async () => {
      id = await result.current.addMadeFile("p1", "brand-guide.md");
    });
    expect(graph.addMadeFile).toHaveBeenCalledWith("b1", tree, { stepId: "p1", name: "brand-guide.md" });
    expect(record).toHaveBeenCalledWith("f9", { id: "f9" });
    expect(id).toBe("f9");
  });

  it("says so and resolves null when the file could not be written", async () => {
    graph.addMadeFile.mockRejectedValue(new Error("That step already makes a file with that name."));
    const { result, record } = hook([p1]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    let id: string | null = "x";
    await act(async () => {
      id = await result.current.addMadeFile("p1", "brand-guide.md");
    });
    expect(id).toBeNull();
    expect(record).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Couldn't add that file. Try again.");
  });

  it("takes a made file out of the steps that use it, then deletes it", async () => {
    graph.removeUse.mockImplementation(async (node: BuildNode) => node);
    const { result, record } = hook([p1, p2, made, plain]);
    await act(async () => {
      result.current.removeMadeFile("f1");
    });
    await vi.waitFor(() => expect(deleteNode).toHaveBeenCalledWith("f1"));
    expect(graph.removeUse).toHaveBeenCalledTimes(1);
    expect(graph.removeUse.mock.calls[0][0]).toMatchObject({ id: "p2" });
    expect(graph.removeUse.mock.calls[0][1]).toEqual({ kind: "file", node_id: "f1" });
    expect(record).toHaveBeenCalledWith("f1", null);
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it("leaves a file nobody makes alone", async () => {
    const { result } = hook([p1, p2, made, plain]);
    await act(async () => {
      result.current.removeMadeFile("f2");
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(deleteNode).not.toHaveBeenCalled();
    expect(graph.removeUse).not.toHaveBeenCalled();
  });
});

describe("code steps (CA-02 P7)", () => {
  it("adds one step for each piece, in order, written with the tool and model, and says which is first", async () => {
    graph.addCode.mockResolvedValueOnce({ id: "c1" } as BuildNode).mockResolvedValueOnce({ id: "c2" } as BuildNode);
    const { result, record } = hook();
    let first: string | null = null;
    await act(async () => {
      first = await result.current.addCodeSteps({
        steps: [
          { source: "a", language: "ts", filename: "app.ts" },
          { source: "select 1;", language: "sql", filename: "schema.sql" },
        ],
        tool: "cursor",
        model: "Opus 5",
      });
    });
    expect(graph.addCode.mock.calls.map((call) => call[2])).toEqual([
      { source: "a", language: "ts", filename: "app.ts", tool: "cursor", model: "Opus 5" },
      { source: "select 1;", language: "sql", filename: "schema.sql", tool: "cursor", model: "Opus 5" },
    ]);
    expect(record).toHaveBeenCalledWith("c1", { id: "c1" });
    expect(record).toHaveBeenCalledWith("c2", { id: "c2" });
    expect(first).toBe("c1");
  });

  it("says why code over the limit was refused, and resolves null", async () => {
    graph.addCode.mockRejectedValue(new Error("Code is at most 100,000 characters. Upload it as a file instead."));
    const { result } = hook();
    let first: string | null = "x";
    await act(async () => {
      first = await result.current.addCodeSteps({ steps: [{ source: "x", language: "ts", filename: null }], tool: null, model: null });
    });
    expect(first).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Code is at most 100,000 characters. Upload it as a file instead.");
  });
});
