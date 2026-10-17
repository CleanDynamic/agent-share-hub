import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BuildNode, NodeTree } from "@/lib/build";

const graph = vi.hoisted(() => ({
  addAgent: vi.fn(),
  addAgentPrompt: vi.fn(),
  addTeam: vi.fn(),
  setInstructions: vi.fn(),
  addManualStep: vi.fn(),
  placeStepAfter: vi.fn(),
  moveStep: vi.fn(),
  setManualFields: vi.fn(),
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
