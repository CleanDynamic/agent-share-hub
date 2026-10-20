// CA-05 P5 — sessions at the same time on screen: Session Details names them and the copy of the code; the List and
// the build page say it under the head.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps, sessionGroups } from "@/lib/build/graph";
import { readerSteps } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";
import { StepsList } from "@/pages/site/build/BuildSteps";
import type { BuildStepsView } from "@/pages/site/build/buildModel";

import { BuildList } from "./BuildList";
import { dividers } from "./buildListModel";
import { DetailsPanel, type SessionView } from "./DetailsPanel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const prompt = (id: string, position: number, session: string): NodeTree =>
  ({ id, build_id: "b", parent_id: null, position, type: "prompt", title: null, note: null, payload: { text: `Do ${id}.`, session }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as NodeTree;
const tree = [prompt("p1", 1, "typed-a"), prompt("p2", 2, "typed-b"), prompt("p3", 3, "typed-c")];
const meta = {
  "typed-a": { tool: "claude-code", date: "2026-10-12" },
  "typed-b": { tool: "claude-code", date: "2026-10-12", parallelWith: ["typed-c"], ownCopy: "fix-totals" },
  "typed-c": { tool: "claude-code", date: "2026-10-12", parallelWith: ["typed-b"] },
};

const session = (over: Partial<SessionView> = {}): SessionView => ({ kind: "session", key: "typed-b", number: 2, tool: "Claude Code", model: "", date: "12 Oct", inBuild: 1, total: 1, status: "ready", checklist: [], ...over });
const OTHERS = [
  { key: "typed-a", label: "Session 1 · Claude Code" },
  { key: "typed-c", label: "Session 3 · Claude Code" },
];
function mount(view: SessionView) {
  const onSessionExtras = vi.fn();
  const onSessionTogether = vi.fn();
  render(<DetailsPanel phone={false} view={view} onSessionExtras={onSessionExtras} onSessionTogether={onSessionTogether} onRename={vi.fn()} onModel={vi.fn()} onAddUse={vi.fn()} onRemoveUse={vi.fn()} onRuns={vi.fn()} onRemoveInside={vi.fn()} onToggleSessionPrompt={vi.fn()} onDownload={vi.fn()} onFields={vi.fn()} onAddPicture={vi.fn()} onUseAsCover={vi.fn()} />);
  return { onSessionExtras, onSessionTogether };
}

describe("Session Details › Ran at the same time as, Own copy of the code", () => {
  it("lists the other sessions and allows more than one", () => {
    const { onSessionTogether } = mount(session({ others: OTHERS, extras: { parallelWith: ["typed-c"] } }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Ran at the same time as" }), { key: "Enter" });
    const items = screen.getAllByRole("menuitemcheckbox");
    expect(items.map((item) => item.textContent)).toEqual(["Session 1 · Claude Code", "Session 3 · Claude Code"]);
    expect(items[1].getAttribute("aria-checked")).toBe("true");
    fireEvent.click(items[0]);
    expect(onSessionTogether).toHaveBeenCalledWith("typed-b", ["typed-c", "typed-a"]);
  });

  it("has no menu when the build has no other session", () => {
    mount(session());
    expect(screen.queryByRole("button", { name: "Ran at the same time as" })).toBeNull();
  });

  it("saves the name of the copy and keeps the rest of the entry", () => {
    const { onSessionExtras } = mount(session({ extras: { cost: 2, currency: "GBP" } }));
    const field = screen.getByRole("textbox", { name: "Own copy of the code" });
    fireEvent.change(field, { target: { value: "fix-totals" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSessionExtras).toHaveBeenCalledWith("typed-b", { cost: 2, currency: "GBP", ownCopy: "fix-totals" });
  });
});

describe("the line under the head", () => {
  it("is in the List and on the build page", () => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, [], {}, meta as never);
    render(
      <MemoryRouter>
        <BuildList phone={false} steps={steps} dividers={dividers(steps, groups)} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} focusAdd={0} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId("together-line").map((line) => line.textContent)).toEqual(["At the same time as Session 3 · own copy: fix-totals", "At the same time as Session 2"]);
    cleanup();
    const view = { steps: readerSteps(tree, { sessions: [], excluded_models: [], sessions_meta: meta as never }), results: [], need: [], counts: "", map: { groups: [], files: [], tools: [], results: [] }, mapAvailable: false, onCopy: vi.fn(), resolveMedia: () => undefined, otherBody: () => null, focus: null } as unknown as BuildStepsView;
    render(
      <MemoryRouter>
        <StepsList view={view} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getAllByTestId("together-line")[0].textContent).toBe("At the same time as Session 3 · own copy: fix-totals");
  });

  it("is absent when no session is marked", () => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, [], {}, { "typed-a": meta["typed-a"], "typed-b": { tool: "claude-code", date: "2026-10-12" }, "typed-c": { tool: "claude-code", date: "2026-10-12" } } as never);
    render(
      <MemoryRouter>
        <BuildList phone={false} steps={steps} dividers={dividers(steps, groups)} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} focusAdd={0} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId("together-line")).toBeNull();
  });
});
