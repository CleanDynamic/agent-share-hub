// Acceptance cover for the Run it yourself tab (NS-P06).
//
// The fixture is the seeded build's shape: copyable and non-copyable nodes
// mixed through three levels, prerequisites nested rather than convenient,
// and a note on every node so that "no prose reaches this tab" is testable.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Build, NodeTree, NodeType } from "@/lib/build";
import { RunView } from "./RunView";

const nodeTypes = [
  { key: "live_app", label: "Live app", category: "artefact", colour: "#F59E0B", icon: "Globe", renderer: "artefact", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "url", label: "URL", type: "string", format: "url" }] } },
  { key: "agent_config", label: "Agent configuration", category: "configuration", colour: "#7C3AED", icon: "Bot", renderer: "agent_config", copyable: true, is_active: true, sort: 2,
    schema: { fields: [{ key: "system_prompt", label: "System prompt", type: "text", required: true }, { key: "model", label: "Model", type: "string" }] } },
  { key: "system_prompt", label: "System prompt", category: "instruction", colour: "#E8571A", icon: "ScrollText", renderer: "instruction", copyable: true, is_active: true, sort: 2,
    schema: { fields: [{ key: "text", label: "System prompt", type: "text", required: true }] } },
  { key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A", icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "text", label: "Prompt text", type: "text", required: true }] } },
  { key: "code", label: "Code", category: "artefact", colour: "#F59E0B", icon: "Code2", renderer: "artefact", copyable: true, is_active: true, sort: 1,
    schema: { fields: [{ key: "source", label: "Source", type: "text", required: true }] } },
  { key: "result", label: "Result", category: "evidence", colour: "#2EC4B6", icon: "BarChart3", renderer: "evidence", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "summary", label: "Summary", type: "text", required: true }] } },
  { key: "prerequisite", label: "Prerequisite", category: "narrative", colour: "#9CA3AF", icon: "ListChecks", renderer: "narrative", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "requirement", label: "Requirement", type: "text", required: true }] } },
  { key: "gap", label: "Gap", category: "narrative", colour: "#EF4444", icon: "CircleHelp", renderer: "gap", copyable: false, is_active: true, sort: 5,
    schema: { fields: [{ key: "problem", label: "Problem", type: "text", required: true }] } },
] as unknown as NodeType[];

interface Spec {
  id: string;
  type: string;
  title: string;
  payload?: Record<string, unknown>;
  children?: Spec[];
}

function node(spec: Spec, position = 0): NodeTree {
  return {
    id: spec.id,
    build_id: "b",
    parent_id: null,
    position,
    type: spec.type,
    title: spec.title,
    // Every node carries a note. None of them may reach the tab.
    note: `NOTE ${spec.id}: the creator explaining themselves.`,
    payload: spec.payload ?? {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-07-28T08:40:00Z",
    children: (spec.children ?? []).map((child, index) => node(child, index)),
  } as unknown as NodeTree;
}

const tree: NodeTree[] = [
  node({ id: "n1", type: "live_app", title: "The running agent", payload: { url: "https://x.test" } }, 0),
  node(
    {
      id: "n2",
      type: "agent_config",
      title: "Triage agent configuration",
      payload: { system_prompt: "You triage a professional inbox.", model: "claude-opus-4-5" },
      children: [
        {
          id: "n7",
          type: "system_prompt",
          title: "Triage system prompt",
          payload: { text: "Classify into exactly one of: reply, delegate, archive." },
          children: [
            { id: "n11", type: "prompt", title: "Per-email classify call", payload: { text: "Thread summary:\n{{thread_summary}}" } },
          ],
        },
        { id: "n8", type: "prerequisite", title: "A Google Workspace account", payload: { requirement: "Gmail API access with read and compose scopes." } },
      ],
    },
    1
  ),
  node({ id: "n4", type: "result", title: "Ninety minutes down to four", payload: { summary: "Measured with a stopwatch." } }, 2),
  node({ id: "n6", type: "gap", title: "Calendar-aware delegation", payload: { problem: "It cannot tell who to delegate to." } }, 3),
  node({ id: "n12", type: "code", title: "fetch_thread_context implementation", payload: { source: "export async function fetchThreadContext() {}" } }, 4),
];

const build = { id: "b", slug: "inbox-triage-agent-demo", title: "Inbox triage agent" } as unknown as Build;

function renderRun(nodes: NodeTree[] = tree) {
  return render(<RunView tree={nodes} nodeTypes={nodeTypes} build={build} />);
}

/** navigator.clipboard does not exist in jsdom. */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
  return writeText;
}

describe("RunView", () => {
  it("renders the copyable nodes as numbered steps and nothing else", () => {
    const { container } = renderRun();
    const steps = container.querySelectorAll('[data-visual-slot="build-run-step"]');

    expect(steps.length).toBe(4);
    expect([...steps].map((step) => step.getAttribute("data-node-type"))).toEqual([
      "agent_config",
      "system_prompt",
      "prompt",
      "code",
    ]);
    expect([...steps].map((step) => within(step as HTMLElement).getByRole("heading").textContent)).toEqual([
      "Step 1: Triage agent configuration",
      "Step 2: Triage system prompt",
      "Step 3: Per-email classify call",
      "Step 4: fetch_thread_context implementation",
    ]);

    // Not copyable: the hero, the result and the gap have no step of their own.
    expect(container.innerHTML).not.toContain("The running agent");
    expect(container.innerHTML).not.toContain("Ninety minutes down to four");
    expect(container.innerHTML).not.toContain("Calendar-aware delegation");
    expect(screen.getByText("4 steps")).toBeTruthy();
  });

  it("shows each step's copy text with a copy button", () => {
    const { container } = renderRun();
    expect(screen.getByText(/System prompt: You triage a professional inbox\./)).toBeTruthy();
    expect(screen.getByText("Classify into exactly one of: reply, delegate, archive.")).toBeTruthy();
    expect(container.querySelectorAll("pre").length).toBe(4);
    expect(screen.getAllByRole("button", { name: "Copy" }).length).toBe(4);
  });

  it("hoists prerequisites into an unnumbered checklist above the steps", () => {
    const { container } = renderRun();
    const checklist = container.querySelector('[data-visual-slot="build-run-prerequisites"]') as HTMLElement;
    const firstStep = container.querySelector('[data-visual-slot="build-run-step"]') as HTMLElement;

    expect(checklist).toBeTruthy();
    expect(within(checklist).getByText(/A Google Workspace account/)).toBeTruthy();
    expect(within(checklist).getByText(/Gmail API access with read and compose scopes\./)).toBeTruthy();
    expect(checklist.compareDocumentPosition(firstStep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // A prerequisite is not a numbered step, whatever its place in the tree.
    expect(checklist.querySelector("ol")).toBeNull();
    expect(firstStep.getAttribute("data-node-type")).toBe("agent_config");
  });

  it("shows no note anywhere on the tab", () => {
    const { container } = renderRun();
    expect(container.innerHTML).not.toContain("the creator explaining themselves");
  });

  it("copies the whole sequence as plain text with numbered headings", async () => {
    const writeText = stubClipboard();
    renderRun();

    fireEvent.click(screen.getByRole("button", { name: "Copy all steps" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());

    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain("Inbox triage agent");
    expect(text).toContain("Before you start\n- A Google Workspace account — Gmail API access");
    expect(text).toContain(
      "1. Triage agent configuration\nSystem prompt: You triage a professional inbox."
    );
    expect(text).toContain("2. Triage system prompt\nClassify into exactly one of");
    expect(text).toContain("3. Per-email classify call\nThread summary:");
    expect(text).toContain("4. fetch_thread_context implementation\nexport async function");

    // Plain text: no markup, and no prose.
    expect(text).not.toContain("```");
    expect(text).not.toContain("**");
    expect(text).not.toMatch(/^#/m);
    expect(text).not.toContain("the creator explaining themselves");
    expect(text.indexOf("1. Triage agent")).toBeLessThan(text.indexOf("2. Triage system"));
  });

  it("copies one step's text alone from its own button", async () => {
    const writeText = stubClipboard();
    const { container } = renderRun();
    const step = container.querySelectorAll('[data-visual-slot="build-run-step"]')[2] as HTMLElement;

    fireEvent.click(within(step).getByRole("button", { name: "Copy" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("Thread summary:\n{{thread_summary}}")
    );
  });

  it("says so when a build has nothing runnable in it", () => {
    renderRun([node({ id: "n4", type: "result", title: "A result", payload: { summary: "s" } })]);
    expect(screen.getByText(/Nothing in this build is runnable yet/)).toBeTruthy();
  });
});
