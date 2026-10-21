// CA-05 P8 — the model line on screen: Details asks how it was run for a model on your own computer, and the List,
// Details and What you need say it.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import { readerSteps, stepsMarkdown, whatYouNeed } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";

import { BuildList } from "./BuildList";
import { DetailsPanel, type DetailsPanelProps, type PromptView } from "./DetailsPanel";
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

function details(selectedId: string, over: Partial<DetailsPanelProps> = {}, run: Record<string, unknown> | null = RUN) {
  const t = tree(run);
  const steps = buildSteps(t);
  const view = resolveView({ selectedId, steps, groups: [], tree: t, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined });
  const props: DetailsPanelProps = { phone: false, view, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onModelRun: vi.fn(), onAgentSetup: vi.fn(), ...over };
  render(<DetailsPanel {...props} />);
  return { props, view };
}

describe("Details", () => {
  it("asks How it was run and Where for a prompt on Ollama, and says the model line", () => {
    const { view } = details("p1");
    expect((view as PromptView).detailLine).toContain("Muse Spark Open · 4-bit · on my own computer");
    expect(screen.getByRole("button", { name: "How it was run" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Where" })).toBeTruthy();
  });

  it("does not ask for a prompt on a hosted model", () => {
    details("p2");
    expect(screen.queryByRole("button", { name: "How it was run" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Where" })).toBeNull();
  });

  it("saves the size from the menu, keeping where", () => {
    const { props } = details("p1");
    fireEvent.keyDown(screen.getByRole("button", { name: "How it was run" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "8-bit" }));
    expect(props.onModelRun).toHaveBeenCalledWith("p1", { precision: "8-bit", where: "computer" });
  });

  it("takes an Other size of up to 20 characters", () => {
    const { props } = details("p1", {}, null);
    fireEvent.keyDown(screen.getByRole("button", { name: "How it was run" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Other" }));
    const field = screen.getByRole("textbox", { name: "How it was run: Other" }) as HTMLInputElement;
    expect(field.maxLength).toBe(20);
    fireEvent.change(field, { target: { value: "Q5_K_M" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onModelRun).toHaveBeenCalledWith("p1", { precision: "Q5_K_M" });
  });

  it("clears the run when both are taken off", () => {
    const { props } = details("p1", {}, { where: "server" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Where" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Not said" }));
    expect(props.onModelRun).toHaveBeenCalledWith("p1", null);
  });

  it("asks for an agent that runs in Ollama", () => {
    details("a1");
    expect(screen.getByRole("button", { name: "How it was run" })).toBeTruthy();
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
