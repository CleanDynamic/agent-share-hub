import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import { refTo } from "@/lib/build/thread";
import type { NodeTree } from "@/lib/build/types";

import { PartWindow } from "./PartWindow";

const BUILD = "33333333-0000-4000-8000-000000000003";
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "x" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const helpers = [
  { provider: "scaledown", job: "summarize", trigger: { at: 0.8, keep: 0.1 }, did: { times: 6, source: "run" } },
  { provider: "scaledown", job: "compress", tools: ["fetch_docs"], did: { before: 18402, after: 3110, unit: "characters", source: "maker" } },
  { provider: "scaledown", job: "classify", labels: ["progress", "looping"], stopAt: 0.8, did: { times: 1, stopped: { label: "looping", score: 0.86 }, source: "run" } },
];
const tree = (definedIn: string[]) => [
  node({ id: "code1", position: 1, type: "code", payload: { source: "agent = create_deep_agent()", language: "python", filename: "kitchen_agent.py" } }),
  node({
    id: "ag",
    position: 2,
    type: "agent_config",
    title: "Kitchen agent",
    payload: {
      system_prompt: "Run the kitchen.",
      model: "claude-sonnet-5-5",
      harness: "deep-agents",
      helpers,
      defined_in: definedIn,
      trace_url: "https://smith.langchain.com/o/1",
      output_shape: { how: "json-schema", where: "Claude API", schema: JSON.stringify({ title: "Order", type: "object" }), sample: "{}" },
    },
  }),
];

let written = "";
beforeEach(() => {
  written = "";
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (words: string) => void (written = words) } });
});
afterEach(() => cleanup());

function open(definedIn: string[]) {
  const onGo = vi.fn();
  render(<PartWindow steps={buildSteps(tree(definedIn))} groups={[]} open={refTo({ kind: "node", id: "ag" })} onClose={vi.fn()} onGo={onGo} />);
  return { onGo };
}

describe("an agent's window (CA-13 P5 to P7)", () => {
  it("shows where it runs, a trace link, each helper in full with before and after worked out, and the answer shape", () => {
    open(["code1"]);
    expect(screen.getByText("Ran in LangChain Deep Agents")).toBeTruthy();
    const trace = screen.getByTestId("trace-link") as HTMLAnchorElement;
    expect(trace.target).toBe("_blank");
    expect(screen.getAllByTestId("helper-body")).toHaveLength(3);
    expect(screen.getByTestId("helper-before-after").textContent).toBe("18,402 → 3,110 characters (83% smaller)");
    // The classify helper's score goes through Certainty, with its source.
    expect(screen.getByTestId("certainty-words").textContent).toBe("86% confidence");
    expect(screen.getByTestId("shape-schema")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy the setting" })).toBeTruthy();
  });

  it("with a 'defined in' Code tile, the main button copies that tile's real code and the starting point is second", async () => {
    const { onGo } = open(["code1"]);
    fireEvent.click(screen.getByRole("button", { name: /Defined in kitchen_agent\.py/ }));
    expect(onGo).toHaveBeenCalledWith(refTo({ kind: "node", id: "code1" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy the code" }));
    await waitFor(() => expect(written).toBe("agent = create_deep_agent()"));
    expect(screen.getByRole("button", { name: "Copy as a starting point" })).toBeTruthy();
  });

  it("with none, 'Copy as a starting point' is the only button and says it was written from the page", async () => {
    open([]);
    expect(screen.queryByRole("button", { name: "Copy the code" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Copy as a starting point" }));
    await waitFor(() => expect(written).toContain("create_deep_agent("));
    expect(written).toContain("ScaledownSummarizationMiddleware");
    expect(screen.getByText(/not the maker's own code/)).toBeTruthy();
  });

  it("copies the setting for the Claude API as output_config.format", async () => {
    open([]);
    fireEvent.click(screen.getByRole("button", { name: "Copy the setting" }));
    await waitFor(() => expect(written).toContain("output_config"));
    expect(JSON.parse(written).output_config.format.type).toBe("json_schema");
  });
});
