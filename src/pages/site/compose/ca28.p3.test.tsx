// CA-28 P3: a failed action on the build page says "{Thing} not {past participle}", and where the toast can carry an action it
// carries Retry, which runs the same operation again. A sample of each verb, and the page with a write that fails once.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NodeTree } from "@/lib/build";

const graph = vi.hoisted(() => ({
  addAgent: vi.fn(),
  addTeam: vi.fn(),
  addManualStep: vi.fn(),
  addCode: vi.fn(),
  addCheck: vi.fn(),
  addDecision: vi.fn(),
  addTool: vi.fn(),
  addResult: vi.fn(),
  setInstructions: vi.fn(),
  setStepTitle: vi.fn(),
  setStepSession: vi.fn(),
}));
const making = vi.hoisted(() => ({ addMadeWithTools: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), default: vi.fn() }));

vi.mock("@/lib/build/graph", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/graph")>()), ...graph }));
vi.mock("@/lib/build/making", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/making")>()), addMadeWithTools: making.addMadeWithTools }));
vi.mock("sonner", async (importOriginal) => {
  const real = await importOriginal<typeof import("sonner")>();
  return { ...real, toast: Object.assign(toast.default, { error: toast.error }) };
});

import { sayFailed, DraftNotStartedError } from "./draftStart";
import type { ComposeNodes } from "./useComposeNodes";
import { useComposePrompts } from "./useComposePrompts";

const retryOf = (call: number) => {
  const options = toast.error.mock.calls[call]?.[1] as { action?: { label: string; onClick: () => void } } | undefined;
  return options?.action;
};
const withRetry = () => expect.objectContaining({ action: expect.objectContaining({ label: "Retry", onClick: expect.any(Function) }) });

function hook(tree: NodeTree[] = []) {
  const record = vi.fn();
  const nodes = { tree, current: () => tree, run: <T,>(task: () => Promise<T>) => task(), record, settled: () => Promise.resolve() } as unknown as ComposeNodes;
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const rendered = renderHook(() => useComposePrompts({ buildId: "b1", nodes, ensureBuild: () => Promise.resolve("b1"), sessions: [], sessionPrompts: () => undefined }), { wrapper });
  return { ...rendered, record };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  making.addMadeWithTools.mockResolvedValue({ madeWith: [], excluded: [] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("sayFailed", () => {
  it("says the line alone when there is nothing to run again", () => {
    sayFailed(new Error("x"), "Prompt not saved");
    expect(toast.error).toHaveBeenCalledWith("Prompt not saved");
  });

  it("puts Retry on the toast, and Retry runs what it was given", () => {
    const retry = vi.fn();
    sayFailed(new Error("x"), "Session not moved", retry);
    expect(toast.error).toHaveBeenCalledWith("Session not moved", withRetry());
    expect(retry).not.toHaveBeenCalled();
    retryOf(0)?.onClick();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("says nothing when the maker has been told already", () => {
    sayFailed(new DraftNotStartedError(new Error("x")), "Prompt not saved", () => undefined);
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("the verbs, as {Thing} not {past participle}", () => {
  const cases: { name: string; line: string; fail: () => void; run: (api: ReturnType<typeof hook>["result"]["current"]) => Promise<unknown>; calls: () => number }[] = [
    {
      name: "add an agent",
      line: "Agent not added",
      fail: () => graph.addAgent.mockRejectedValue(new Error("down")),
      run: (api) => api.addAgentOrTeam({ kind: "agent", name: null, model: "Opus 5.5" }),
      calls: () => graph.addAgent.mock.calls.length,
    },
    {
      name: "add a team",
      line: "Team not added",
      fail: () => graph.addTeam.mockRejectedValue(new Error("down")),
      run: (api) => api.addAgentOrTeam({ kind: "team", name: null, model: "Opus 5.5" }),
      calls: () => graph.addTeam.mock.calls.length,
    },
    {
      name: "add a manual step",
      line: "Manual step not added",
      fail: () => graph.addManualStep.mockRejectedValue(new Error("down")),
      run: (api) => api.addManual({ tool: "Figma", text: "x", file: null, afterId: null }),
      calls: () => graph.addManualStep.mock.calls.length,
    },
    {
      name: "add code",
      line: "Code not added",
      fail: () => graph.addCode.mockRejectedValue(new Error("down")),
      run: (api) => api.addCodeSteps({ steps: [{ source: "x", language: "ts", filename: null }], tool: null, model: null }),
      calls: () => graph.addCode.mock.calls.length,
    },
    {
      name: "add a decision",
      line: "Decision not added",
      fail: () => graph.addDecision.mockRejectedValue(new Error("down")),
      run: (api) => api.addDecisionTile({ provider: "typesafe-jev", model: "m", questions: [] } as never),
      calls: () => graph.addDecision.mock.calls.length,
    },
    {
      name: "save the instructions",
      line: "Instructions not saved",
      fail: () => graph.setInstructions.mockRejectedValue(new Error("down")),
      run: async (api) => api.setInstructions("ag1", "Do it"),
      calls: () => graph.setInstructions.mock.calls.length,
    },
    {
      name: "rename a tile",
      line: "Tile not renamed",
      fail: () => graph.setStepTitle.mockRejectedValue(new Error("down")),
      run: async (api) => api.rename("ag1", "New name"),
      calls: () => graph.setStepTitle.mock.calls.length,
    },
  ];

  const node = (id: string) => ({ id, build_id: "b1", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: {}, source_ref: null, created_at: "", updated_at: "", children: [] }) as unknown as NodeTree;

  for (const item of cases) {
    it(`${item.name}: "${item.line}", with Retry that runs it again`, async () => {
      item.fail();
      const { result } = hook([node("ag1")]);
      await act(async () => {
        await item.run(result.current);
      });
      expect(toast.error).toHaveBeenCalledWith(item.line, withRetry());
      expect(item.calls()).toBe(1);
      // Retry is the same operation again.
      await act(async () => {
        retryOf(0)?.onClick();
        await Promise.resolve();
        await Promise.resolve();
      });
      await waitFor(() => expect(item.calls()).toBe(2));
    });
  }

  it("a limit says {Field}: {rule}", async () => {
    graph.addCode.mockRejectedValue(new Error("Code: 100,000 characters max"));
    const { result } = hook();
    await act(async () => {
      await result.current.addCodeSteps({ steps: [{ source: "x", language: "ts", filename: null }], tool: null, model: null });
    });
    expect(toast.error).toHaveBeenCalledWith("Code: 100,000 characters max", withRetry());
  });
});
