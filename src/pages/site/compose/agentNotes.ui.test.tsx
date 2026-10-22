// CA-05 P9 — what an agent tidies and what changes each round: Details writes them, the List and the build page say them.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("@/lib/build/nodes", () => ({ upsertNode: (...a: unknown[]) => upsertNode(...a), getNodeTree: vi.fn(), reorderNodes: vi.fn(), deleteNode: vi.fn() }));

import { buildSteps, changesEachRoundClause, setAgentNotes, stepRunsLabel } from "@/lib/build/graph";
import { readerSteps, stepsMarkdown } from "@/lib/build/readerSteps";
import type { BuildNode, NodeTree } from "@/lib/build/types";

import { BuildList } from "./BuildList";
import { DetailsPanel, type DetailsPanelProps } from "./DetailsPanel";
import { resolveView } from "./detailsView";

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, type: string, payload: Record<string, unknown>, position: number): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;

const UNTIL = { how: "until", detail: "until the review has no changes · at most 3 times" };
const agent = (extra: Record<string, unknown> = {}, runs: Record<string, unknown> | null = UNTIL): NodeTree[] => [
  node("a1", "agent_config", { system_prompt: "Review the draft.", model: "Opus 5.5", memory: "which claims it checked", ...(runs ? { runs } : null), ...extra }, 1),
];

describe("what an agent reads", () => {
  it("reads both lines, trimmed, from the payload", () => {
    const [step] = buildSteps(agent({ memory_tidy: "  Every Sunday, keeps the 50 most useful notes ", changes_each_round: "its checklist" }));
    expect(step.memoryTidy).toBe("Every Sunday, keeps the 50 most useful notes");
    expect(step.changesEachRound).toBe("its checklist");
    const [plain] = buildSteps(agent());
    expect(plain.memoryTidy).toBeUndefined();
    expect(plain.changesEachRound).toBeUndefined();
  });

  it("says the run line, then what it changes, only for an agent that runs until a condition was met", () => {
    const [step] = buildSteps(agent({ changes_each_round: "its checklist" }));
    expect(stepRunsLabel(step)).toBe("Again until the review has no changes · at most 3 times · changes its checklist each round");
    const [once] = buildSteps(agent({ changes_each_round: "its checklist" }, null));
    expect(stepRunsLabel(once)).toBe("");
    const [parallel] = buildSteps(agent({ changes_each_round: "its checklist" }, { how: "parallel", count: 3 }));
    expect(stepRunsLabel(parallel)).toBe("Several at the same time · 3");
    expect(stepRunsLabel(buildSteps(agent())[0])).toBe("Again until the review has no changes · at most 3 times");
  });

  it("lowers a determiner so the clause reads on, and nothing else", () => {
    expect(changesEachRoundClause("Its own review checklist")).toBe("changes its own review checklist each round");
    expect(changesEachRoundClause("CLAUDE.md")).toBe("changes CLAUDE.md each round");
    expect(changesEachRoundClause("The brief")).toBe("changes the brief each round");
    expect(changesEachRoundClause("Anthropic's guide")).toBe("changes Anthropic's guide each round");
  });
});

describe("writing them", () => {
  const row = (payload: Record<string, unknown>): BuildNode => ({ ...agent(payload)[0], children: undefined }) as unknown as BuildNode;
  it("keeps what is left out, and takes a line off with an empty string", async () => {
    await setAgentNotes(row({ memory_tidy: "old", changes_each_round: "its checklist" }), { memoryTidy: "New way" });
    expect(upsertNode.mock.calls[0][0].payload).toMatchObject({ memory_tidy: "New way", changes_each_round: "its checklist" });
    await setAgentNotes(row({ memory_tidy: "old", changes_each_round: "its checklist" }), { changesEachRound: "" });
    expect(upsertNode.mock.calls[1][0].payload.changes_each_round).toBeUndefined();
    expect(upsertNode.mock.calls[1][0].payload.memory_tidy).toBe("old");
  });
  it("refuses more than 120 characters, and a node that is not an agent", async () => {
    await expect(setAgentNotes(row({}), { memoryTidy: "x".repeat(121) })).rejects.toThrow(/120/);
    await expect(setAgentNotes(row({}), { changesEachRound: "x".repeat(121) })).rejects.toThrow(/120/);
    await expect(setAgentNotes({ ...row({}), type: "prompt" } as BuildNode, { memoryTidy: "x" })).rejects.toThrow(/agent/);
    expect(upsertNode).not.toHaveBeenCalled();
  });
});

describe("Details", () => {
  function details(extra: Record<string, unknown> = {}, runs: Record<string, unknown> | null = UNTIL) {
    const tree = agent(extra, runs);
    const view = resolveView({ selectedId: "a1", steps: buildSteps(tree), groups: [], tree, sources: [], sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined });
    const props: DetailsPanelProps = { phone: false, view, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn(), onAgentSetup: vi.fn(), onAgentNotes: vi.fn() };
    render(<DetailsPanel {...props} />);
    return props;
  }

  it("asks How it tidies its notes under Memory, up to 120 characters", () => {
    const props = details();
    const well = screen.getByRole("textbox", { name: "How it tidies its notes" }) as HTMLInputElement;
    expect(well.placeholder).toBe("Every Sunday, keeps the 50 most useful notes");
    expect(well.maxLength).toBe(120);
    fireEvent.change(well, { target: { value: "Every Sunday, keeps the 50 most useful notes" } });
    fireEvent.keyDown(well, { key: "Enter" });
    expect(props.onAgentNotes).toHaveBeenCalledWith("a1", { memoryTidy: "Every Sunday, keeps the 50 most useful notes" });
    const remembers = screen.getByRole("textbox", { name: "Memory" });
    expect(remembers.compareDocumentPosition(well) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("asks What it changes each round only for an agent that runs again until a condition was met", () => {
    const props = details();
    const well = screen.getByRole("textbox", { name: "What it changes each round" }) as HTMLInputElement;
    expect(well.placeholder).toBe("Its own review checklist");
    fireEvent.change(well, { target: { value: "its checklist" } });
    fireEvent.keyDown(well, { key: "Enter" });
    expect(props.onAgentNotes).toHaveBeenCalledWith("a1", { changesEachRound: "its checklist" });
    cleanup();
    details({}, null);
    expect(screen.queryByRole("textbox", { name: "What it changes each round" })).toBeNull();
  });
});

describe("the lines", () => {
  const list = (tree: NodeTree[]) =>
    render(
      <MemoryRouter>
        <BuildList phone={false} steps={buildSteps(tree)} dividers={new Map()} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} />
      </MemoryRouter>,
    );

  it("puts the tidy line second, under the memory line, and the changes after the run line", () => {
    list(agent({ memory_tidy: "Every Sunday, keeps the 50 most useful notes", changes_each_round: "its checklist" }));
    const memory = screen.getByTestId("memory-line");
    const tidy = screen.getByTestId("memory-tidy-line");
    expect(tidy.textContent).toBe("Tidies its notes: Every Sunday, keeps the 50 most useful notes");
    expect(memory.compareDocumentPosition(tidy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId("runs-line").textContent).toBe("Again until the review has no changes · at most 3 times · changes its checklist each round");
  });

  it("shows neither for an agent that says neither", () => {
    list(agent());
    expect(screen.queryByTestId("memory-tidy-line")).toBeNull();
    expect(screen.getByTestId("runs-line").textContent).not.toContain("each round");
  });

  it("is in the build page's data and Copy for AI", () => {
    const tree = agent({ changes_each_round: "its checklist" });
    const [entry] = readerSteps(tree, null);
    expect(entry.runs).toBe("Again until the review has no changes · at most 3 times · changes its checklist each round");
    expect(stepsMarkdown({ title: "T" }, [entry])).toContain("changes its checklist each round");
  });
});
