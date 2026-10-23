// CA-04 P6 — Worked until on screen: the Session window saves it (CA-18: Details only reads it now); the List and the build page say it under the head.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSteps, sessionGroups } from "@/lib/build/graph";
import { readerSteps } from "@/lib/build/readerSteps";
import type { NodeTree } from "@/lib/build/types";
import { StepsList } from "@/pages/site/build/BuildSteps";
import type { BuildStepsView } from "@/pages/site/build/buildModel";

import { BuildList } from "./BuildList";
import { dividers } from "./buildListModel";
import type { SessionView } from "./DetailsPanel";
import { SessionDialog } from "./SessionDialog";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const goal = { condition: "the order form passes its tests", atMost: 40, reached: "reached" as const, turns: 12 };
const META = { "typed-a": { tool: "claude-code", date: "2026-10-12", goal } };
const tree = [{ id: "p", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "Build it.", session: "typed-a" }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] } as NodeTree];

const session = (over: Partial<SessionView> = {}): SessionView => ({ kind: "session", key: "typed-a", number: 1, tool: "Claude Code", model: "", date: "12 Oct", inBuild: 1, total: 1, status: "ready", checklist: [], ...over });
const mount = (view: SessionView, onSessionGoal = vi.fn()) => {
  render(<SessionDialog view={view} onClose={vi.fn()} handlers={{ onSessionGoal, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn() }} />);
  return onSessionGoal;
};
const save = () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

describe("Session window › Worked until", () => {
  it("saves the condition word for word, when Save is pressed", () => {
    const onSessionGoal = mount(session());
    const condition = screen.getByRole("textbox", { name: "The condition" });
    fireEvent.change(condition, { target: { value: "the order form passes its tests" } });
    fireEvent.blur(condition);
    expect(onSessionGoal).not.toHaveBeenCalled();
    save();
    expect(onSessionGoal).toHaveBeenCalledWith("typed-a", { condition: "the order form passes its tests" });
  });

  it("asks Was it reached?, refuses turns outside 1 to 500, and takes the goal off", () => {
    const onSessionGoal = mount(session({ goal: { condition: "x" } }));
    fireEvent.click(screen.getByRole("radio", { name: "Reached" }));
    const most = screen.getByRole("textbox", { name: "At most" });
    fireEvent.change(most, { target: { value: "900" } });
    fireEvent.blur(most);
    expect(screen.getByText("Turns are whole numbers from 1 to 500.")).toBeTruthy();
    fireEvent.change(most, { target: { value: "40" } });
    fireEvent.blur(most);
    save();
    // Held until Save, and written once with what the goal had become.
    expect(onSessionGoal).toHaveBeenCalledTimes(1);
    expect(onSessionGoal).toHaveBeenLastCalledWith("typed-a", { condition: "x", reached: "reached", atMost: 40 });
  });

  it("takes the goal off with null", () => {
    const onSessionGoal = mount(session({ goal: { condition: "x" } }));
    fireEvent.click(screen.getByRole("button", { name: "Take the goal off" }));
    save();
    expect(onSessionGoal).toHaveBeenLastCalledWith("typed-a", null);
  });
});

describe("the line under the session head", () => {
  it("is in the List, its dot the evidence colour once reached", () => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, [], {}, META);
    render(
      <MemoryRouter>
        <BuildList phone={false} steps={steps} dividers={dividers(steps, groups)} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} />
      </MemoryRouter>,
    );
    const line = screen.getByTestId("goal-line");
    expect(line.textContent).toBe("Worked until the order form passes its tests · at most 40 turns · reached in 12");
    // jsdom drops a custom property from `background`; the markup says it.
    const html = renderToStaticMarkup(<MemoryRouter><BuildList phone={false} steps={steps} dividers={dividers(steps, groups)} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} /></MemoryRouter>);
    expect(html).toMatch(/data-testid="goal-line"[^>]*><span aria-hidden="true" style="[^"]*background:var\(--evidence\)/);
  });

  it("is on the build page", () => {
    const steps = readerSteps(tree, { sessions: [], excluded_models: [], sessions_meta: META });
    const view = { steps, results: [], need: [], counts: "", map: { groups: [], files: [], tools: [], results: [] }, mapAvailable: false, onCopy: vi.fn(), resolveMedia: () => undefined, otherBody: () => null, focus: null } as unknown as BuildStepsView;
    render(
      <MemoryRouter>
        <StepsList view={view} phone={false} announce={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("goal-line").textContent).toBe("Worked until the order form passes its tests · at most 40 turns · reached in 12");
  });
});
