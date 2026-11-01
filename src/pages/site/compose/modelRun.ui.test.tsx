// CA-05 P8 — the model line on screen: the prompt window and the agent window ask how it was run for a model on your own
// computer (CA-18: Details only reads it), and the List, Details and What you need say it.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import { readerSteps, stepsMarkdown, whatYouNeed } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";

import { BuildList } from "./BuildList";
import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import type { DetailsHandlers, PromptView } from "./DetailsPanel";
import { TileEditDialog } from "./TileEditDialog";
import { resolveView } from "./detailsView";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, type: string, payload: Record<string, unknown>, position: number): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;

const RUN = { precision: "4-bit", where: "computer" };
const tree = (run: Record<string, unknown> | null = RUN): NodeTree[] => [
  node("p1", "prompt", { text: "Say hello.", tool: "ollama", model: "Muse Spark Open", ...(run ? { modelRun: run } : null) }, 1),
  node("a1", "agent_config", { system_prompt: "Greet.", model: "Muse Spark Open", harness: "ollama", ...(run ? { modelRun: run } : null) }, 2),
  node("p2", "prompt", { text: "Say bye.", tool: "claude", model: "Opus 5.5" }, 3),
];

function ctx(selectedId: string, run: Record<string, unknown> | null) {
  const t = tree(run);
  const steps = buildSteps(t);
  const view = resolveView({ selectedId, steps, groups: [], tree: t, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined });
  return { steps, view };
}

/** A prompt: its window saves as it goes. */
function promptWindow(selectedId: string, run: Record<string, unknown> | null = RUN) {
  const { steps, view } = ctx(selectedId, run);
  const handlers = { onModel: vi.fn(), onModelRun: vi.fn(), onAddUse: vi.fn(), onAttach: vi.fn(), onRemoveUse: vi.fn(), onAddMade: vi.fn(), onRemoveMade: vi.fn(), onFields: vi.fn() };
  render(<FullPromptWindow steps={steps} openId={selectedId} mode="maker" onClose={vi.fn()} onTitle={vi.fn()} details={() => view as PromptView} handlers={handlers} />);
  return { props: handlers, view };
}

/** An agent: its window holds the writes until Save. */
function agentWindow(selectedId: string, run: Record<string, unknown> | null = RUN) {
  const { view } = ctx(selectedId, run);
  const handlers = { onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onModelRun: vi.fn(), onAgentSetup: vi.fn() } as unknown as DetailsHandlers & { onModelRun: ReturnType<typeof vi.fn> };
  render(<TileEditDialog view={view} handlers={handlers} onClose={vi.fn()} />);
  return handlers;
}

describe("the windows", () => {
  it("asks How it was run and Where for a prompt on Ollama, and says the model line", () => {
    const { view } = promptWindow("p1");
    expect((view as PromptView).detailLine).toContain("Muse Spark Open · 4-bit · on my own computer");
    expect(screen.getByRole("button", { name: "Precision" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Where" })).toBeTruthy();
  });

  it("does not ask for a prompt on a hosted model", () => {
    promptWindow("p2");
    expect(screen.queryByRole("button", { name: "Precision" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Where" })).toBeNull();
  });

  it("saves the size from the menu, keeping where", () => {
    const { props } = promptWindow("p1");
    fireEvent.keyDown(screen.getByRole("button", { name: "Precision" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "8-bit" }));
    expect(props.onModelRun).toHaveBeenCalledWith("p1", { precision: "8-bit", where: "computer" });
  });

  it("takes an Other size of up to 20 characters", () => {
    const { props } = promptWindow("p1", null);
    fireEvent.keyDown(screen.getByRole("button", { name: "Precision" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Other" }));
    const field = screen.getByRole("textbox", { name: "Precision: Other" }) as HTMLInputElement;
    expect(field.maxLength).toBe(20);
    fireEvent.change(field, { target: { value: "Q5_K_M" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onModelRun).toHaveBeenCalledWith("p1", { precision: "Q5_K_M" });
  });

  it("clears the run when both are taken off", () => {
    const { props } = promptWindow("p1", { where: "server" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Where" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Not said" }));
    expect(props.onModelRun).toHaveBeenCalledWith("p1", null);
  });

  it("asks for an agent that runs in Ollama, and writes it on Save", () => {
    const props = agentWindow("a1");
    fireEvent.keyDown(screen.getByRole("button", { name: "Precision" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "8-bit" }));
    expect(props.onModelRun).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
    expect(props.onModelRun).toHaveBeenCalledWith("a1", { precision: "8-bit", where: "computer" });
  });
});

describe("the model line elsewhere", () => {
  it("is in the List's agent card", () => {
    render(
      <MemoryRouter>
        <BuildList phone={false} steps={buildSteps(tree())} dividers={new Map()} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("container-eyebrow").textContent).toContain("Muse Spark Open · 4-bit · on my own computer");
  });

  it("is in What you need and in Copy for AI", () => {
    const t = tree();
    const steps = readerSteps(t, null);
    const tools = whatYouNeed(steps, t, null).find((group) => group.key === "tools");
    expect(tools?.rows.map((row) => row.title)).toContain("Muse Spark Open · 4-bit · on my own computer");
    expect(stepsMarkdown({ title: "T" }, steps)).toContain("Muse Spark Open · 4-bit · on my own computer");
  });

  it("is the model alone for a build that said nothing", () => {
    const t = tree(null);
    const tools = whatYouNeed(readerSteps(t, null), t, null).find((group) => group.key === "tools");
    expect(tools?.rows.map((row) => row.title)).toContain("Muse Spark Open");
    expect(tools?.rows.map((row) => row.title).join()).not.toContain("4-bit");
  });
});

// SV-27 Part 4: the new fields, under "More about how it was served"; Where offers the build's Host tiles by name; Split shows
// only when the chosen host has two or more GPUs.
describe("SV-27 P4: how it was served", () => {
  const withHost = (gpus: number): NodeTree[] => [
    ...tree({ precision: "Q4_K_M", host: "h1" }),
    node("h1", "host", { machine: "workstation", name: "Workstation", always_on: true, ...(gpus > 0 ? { gpus: [{ model: "RTX 5090", count: gpus, vram_gb: 32 }] } : null) }, 4),
  ];
  function hostWindow(gpus: number) {
    const t = withHost(gpus);
    const steps = buildSteps(t);
    const view = resolveView({ selectedId: "p1", steps, groups: [], tree: t, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined });
    const handlers = { onModel: vi.fn(), onModelRun: vi.fn(), onAddUse: vi.fn(), onAttach: vi.fn(), onRemoveUse: vi.fn(), onAddMade: vi.fn(), onRemoveMade: vi.fn(), onFields: vi.fn() };
    render(<FullPromptWindow steps={steps} openId="p1" mode="maker" onClose={vi.fn()} onTitle={vi.fn()} details={() => view as PromptView} handlers={handlers} />);
    return { handlers, view: view as PromptView };
  }

  it("saves each new key from its field", () => {
    const { props } = promptWindow("p1");
    fireEvent.click(screen.getByRole("button", { name: "More about how it was served" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Weights format" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "GGUF" }));
    expect(props.onModelRun).toHaveBeenLastCalledWith("p1", { ...RUN, weights_format: "GGUF" });
    const typed = (name: string, value: string) => {
      const field = screen.getByRole("textbox", { name });
      fireEvent.change(field, { target: { value } });
      fireEvent.keyDown(field, { key: "Enter" });
    };
    typed("Parameter count", "32B");
    expect(props.onModelRun).toHaveBeenLastCalledWith("p1", expect.objectContaining({ parameters: "32B" }));
    typed("Context length", "32768");
    expect(props.onModelRun).toHaveBeenLastCalledWith("p1", expect.objectContaining({ context_length: 32768 }));
    typed("Inference engine", "llama.cpp");
    expect(props.onModelRun).toHaveBeenLastCalledWith("p1", expect.objectContaining({ engine: "llama.cpp" }));
    typed("Draft model (speculative decoding)", "Qwen 0.5B");
    expect(props.onModelRun).toHaveBeenLastCalledWith("p1", expect.objectContaining({ draft_model: "Qwen 0.5B" }));
  });

  it("offers the Host tile by name under Where, and the line names its GPUs", () => {
    const { view } = hostWindow(2);
    expect(view.detailLine).toContain("Muse Spark Open · Q4_K_M · 2 × RTX 5090");
    fireEvent.keyDown(screen.getByRole("button", { name: "Where" }), { key: "Enter" });
    expect(screen.getByRole("menuitemradio", { name: "Workstation" })).toBeTruthy();
  });

  it("shows Split across GPUs only for a host with two or more GPUs", () => {
    hostWindow(2);
    fireEvent.click(screen.getByRole("button", { name: "More about how it was served" }));
    expect(screen.getByRole("button", { name: "Split across GPUs" })).toBeTruthy();
    cleanup();
    hostWindow(1);
    fireEvent.click(screen.getByRole("button", { name: "More about how it was served" }));
    expect(screen.queryByRole("button", { name: "Split across GPUs" })).toBeNull();
  });
});
