// CA-04 P4 — the session setup on screen: Session Details' Setup, Setup {n} on the List's head, the build page's
// session head, Copy for AI, and Download as a menu.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps, sessionGroups } from "@/lib/build/graph";
import { buildCounts, readerMap, readerResults, readerSteps, stepsMarkdown, whatYouNeed } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";
import type { BuildStepsView } from "@/pages/site/build/buildModel";
import { StepsList } from "@/pages/site/build/BuildSteps";

import { BuildList } from "./BuildList";
import { dividers } from "./buildListModel";
import { DetailsPanel, type DetailsPanelProps, type SessionView } from "./DetailsPanel";
import { resolveView } from "./detailsView";
import { sourceSessions } from "./sourcesModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, type: string, payload: Record<string, unknown>, position: number): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;

const META = { "typed-a": { tool: "claude", date: "2026-10-12" }, "typed-b": { tool: "claude-code", date: "2026-10-14" } };
const making = { sessions: [], excluded_models: [], sessions_meta: META };

function tree(): NodeTree[] {
  return [
    node("p1", "prompt", { text: "Plan it.", session: "typed-a" }, 1),
    node("p2", "prompt", { text: "Build it.", session: "typed-b" }, 2),
    node("x1", "document", { title: "CLAUDE.md", media_id: "m1", setup: { session: "typed-b", kind: "instructions" } }, 3),
    node("x2", "document", { title: "SKILL.md", setup: { session: "typed-b", kind: "skill" }, skill: { name: "order-forms", description: "Order forms that add up." }, not_shared: true }, 4),
    node("x3", "integration", { service: "github", setup: { session: "typed-b", kind: "server" }, server: { url: "https://api.example.com/mcp", headers: { Authorization: "${Authorization}" } }, connection: "mcp", runs_at: "web" }, 5),
    node("x4", "code", { source: "npm test", language: "bash", setup: { session: "typed-b", kind: "rule" }, rule: { when: "After a tool runs" } }, 6),
  ];
}

function details(over: Partial<DetailsPanelProps>) {
  const props: DetailsPanelProps = {
    phone: false,
    view: null,
    onRename: vi.fn(),
    onModel: vi.fn(),
    onAddUse: vi.fn(),
    onRemoveUse: vi.fn(),
    onRuns: vi.fn(),
    onRemoveInside: vi.fn(),
    onToggleSessionPrompt: vi.fn(),
    onDownload: vi.fn(),
    onFields: vi.fn(),
    onAddPicture: vi.fn(),
    onUseAsCover: vi.fn(),
    ...over,
  };
  render(<DetailsPanel {...props} />);
  return props;
}

function ctx() {
  const t = tree();
  const steps = buildSteps(t);
  const groups = sessionGroups(steps, [], {}, META);
  return { t, steps, groups, base: { steps, groups, tree: t, sources: sourceSessions(groups, steps), sourceFiles: [], promptsState: () => ({ prompts: [], error: false }), intoResult: new Set<string>(), media: () => undefined } };
}

describe("Session Details › Setup", () => {
  it("lists the setup under Date: kind over name, a skill's description, a not shared row dashed", () => {
    const { base } = ctx();
    const view = resolveView({ ...base, selectedId: "typed-b" }) as SessionView;
    const props = details({ view, onAddToSetup: vi.fn(), onNotShared: vi.fn(), onSelect: vi.fn() });
    const section = screen.getByTestId("session-setup");
    const rows = within(section).getAllByTestId("setup-row");
    expect(rows.map((row) => row.textContent)).toEqual(["InstructionsCLAUDE.mdDon't share it", "MCP servergithubDon't share it", "Rulenpm testDon't share it", "Skillorder-formsOrder forms that add up.Not shared"]);
    // CA-05 P6: two quiet labels, because both have rows; a skill is read only when needed.
    expect(within(section).getAllByTestId("setup-loaded").map((group) => group.getAttribute("aria-label"))).toEqual(["At the start", "Only when needed"]);
    expect(rows[3].getAttribute("data-not-shared")).toBe("true");
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Don't share it" }));
    expect(props.onNotShared).toHaveBeenCalledWith("x1");
    fireEvent.click(within(section).getByRole("button", { name: "Add to setup" }));
    expect(props.onAddToSetup).toHaveBeenCalledWith("typed-b");
    fireEvent.click(within(rows[1]).getByRole("button", { name: /github/ }));
    expect(props.onSelect).toHaveBeenCalledWith("x3");
  });

  it("draws nothing for a session with no setup", () => {
    const { base } = ctx();
    details({ view: resolveView({ ...base, selectedId: "typed-a" }), onAddToSetup: vi.fn() });
    expect(screen.queryByTestId("session-setup")).toBeNull();
  });

  it("opens a setup item as a file, a tool or its rule", () => {
    const { base } = ctx();
    expect(resolveView({ ...base, selectedId: "x1" })).toMatchObject({ kind: "file", name: "CLAUDE.md", sentWithLine: "Setup · Instructions" });
    expect(resolveView({ ...base, selectedId: "x3" })).toMatchObject({ kind: "tool", service: "github" });
    expect(resolveView({ ...base, selectedId: "x4" })).toMatchObject({ kind: "code", source: "npm test", sentWithLine: "Setup · Rule · After a tool runs" });
  });

  it("is not a step, a file of the build or a tool a step can use", () => {
    const { steps, base } = ctx();
    expect(steps.map((step) => step.id)).toEqual(["p1", "p2"]);
    const prompt = resolveView({ ...base, selectedId: "p2" });
    expect(prompt && "options" in prompt ? prompt.options.map((option) => option.label) : []).toEqual(["Output of 1"]);
  });
});

describe("Setup {n} on the List's head", () => {
  it("selects the session and asks Details for its Setup", () => {
    const { steps, groups } = ctx();
    const onOpenSetup = vi.fn();
    render(
      <MemoryRouter>
        <BuildList phone={false} steps={steps} dividers={dividers(steps, groups, { "typed-b": 4 })} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} onOpenSetup={onOpenSetup} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Setup of session 1/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Setup of session 2: 4" }));
    expect(onOpenSetup).toHaveBeenCalledWith("typed-b");
  });
});

describe("the build page", () => {
  function view(): BuildStepsView {
    const t = tree();
    const steps = readerSteps(t, making);
    return { steps, results: readerResults(t), need: whatYouNeed(steps, t, making), counts: buildCounts(steps), map: readerMap(t, making), mapAvailable: false, onCopy: vi.fn(async () => true), resolveMedia: () => undefined, otherBody: () => null, focus: null };
  }

  it("gives a session with a setup a Setup button at the end of its head, closed until asked", () => {
    render(
      <MemoryRouter>
        <StepsList view={view()} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    const buttons = screen.getAllByRole("button", { name: "Setup" });
    expect(buttons).toHaveLength(1);
    expect(screen.queryByTestId("session-setup")).toBeNull();
    fireEvent.click(buttons[0]);
    const rows = within(screen.getByTestId("session-setup")).getAllByTestId("setup-row");
    expect(rows.map((row) => row.textContent)).toEqual(["InstructionsCLAUDE.md", "MCP servergithub", "RuleAfter a tool runs: npm test", "Skill · not sharedorder-formsOrder forms that add up."]);
    expect(within(screen.getByTestId("session-setup")).getAllByTestId("setup-loaded").map((group) => group.getAttribute("aria-label"))).toEqual(["At the start", "Only when needed"]);
    expect(screen.getByTestId("session-setup").style.marginLeft).toBe("28px");
  });

  it("starts the session in Copy for AI with its setup, and says the setup's secrets as placeholders only", () => {
    const md = stepsMarkdown({ title: "T" }, view().steps);
    expect(md).toContain("Before you start, put CLAUDE.md in your project folder.\nSkills: order-forms.\nMCP servers: github.\nRules: After a tool runs: npm test.");
    expect(md.indexOf("Skills: order-forms.")).toBeGreaterThan(md.indexOf("New chat in Claude Code"));
  });
});
