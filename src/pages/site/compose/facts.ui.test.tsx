// CA-05 P2 — session facts on screen: Session Details saves them; the List and the build page say them under the head.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
const save = () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tree = [{ id: "p", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "Build it.", session: "typed-a" }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] } as NodeTree];
const meta = (extra: Record<string, unknown>) => ({ "typed-a": { tool: "claude-code", date: "2026-10-12", ...extra } });

const session = (over: Partial<SessionView> = {}): SessionView => ({ kind: "session", key: "typed-a", number: 1, tool: "Claude Code", model: "", date: "12 Oct", inBuild: 1, total: 1, status: "ready", checklist: [], ...over });
const mount = (view: SessionView, onSessionExtras = vi.fn()) => {
  render(<SessionDialog view={view} onClose={vi.fn()} handlers={{ onSessionExtras: onSessionExtras, onRename: vi.fn(), onModel: vi.fn(), onAddUse: vi.fn(), onRemoveUse: vi.fn(), onRuns: vi.fn(), onRemoveInside: vi.fn(), onToggleSessionPrompt: vi.fn(), onDownload: vi.fn(), onFields: vi.fn(), onAddPicture: vi.fn(), onUseAsCover: vi.fn() }} />);
  return onSessionExtras;
};

const renderList = (sessionsMeta: Record<string, unknown>) => {
  const steps = buildSteps(tree);
  const groups = sessionGroups(steps, [], {}, sessionsMeta as never);
  render(
    <MemoryRouter>
      <BuildList phone={false} steps={steps} dividers={dividers(steps, groups)} names={{}} suggestions={[]} intoResult={new Set()} results={[]} selectedId={null} onSelect={vi.fn()} onRename={vi.fn()} onMove={vi.fn()} onRemove={vi.fn()} onAccept={vi.fn()} onDismiss={vi.fn()} onAddPrompt={vi.fn(async () => true)} onAddAgentPrompt={vi.fn(async () => true)} onAddAgentTo={vi.fn()} />
    </MemoryRouter>,
  );
};

const renderPage = (sessionsMeta: Record<string, unknown>) => {
  const steps = readerSteps(tree, { sessions: [], excluded_models: [], sessions_meta: sessionsMeta as never });
  const view = { steps, results: [], need: [], counts: "", map: { groups: [], files: [], tools: [], results: [] }, mapAvailable: false, onCopy: vi.fn(), resolveMedia: () => undefined, otherBody: () => null, focus: null } as unknown as BuildStepsView;
  render(
    <MemoryRouter>
      <StepsList view={view} phone={false} announce={() => undefined} />
    </MemoryRouter>,
  );
};

describe("Session window › What it cost, Show readers and How did you work?", () => {
  it("saves a cost in pounds, labelled with the rest of the entry kept", () => {
    const onSessionExtras = mount(session({ extras: { background: true } }));
    const field = screen.getByRole("textbox", { name: "What it cost" });
    fireEvent.change(field, { target: { value: "3.4" } });
    fireEvent.blur(field);
    save();
    expect(onSessionExtras).toHaveBeenCalledWith("typed-a", { background: true, cost: 3.4, currency: "GBP" });
  });

  it("refuses a cost that is not a number", () => {
    const onSessionExtras = mount(session());
    const field = screen.getByRole("textbox", { name: "What it cost" });
    fireEvent.change(field, { target: { value: "lots" } });
    fireEvent.blur(field);
    save();
    expect(onSessionExtras).not.toHaveBeenCalled();
    expect(screen.getByText(/Cost is a number/)).toBeTruthy();
  });

  it("has Show readers off by default, and turns it on", () => {
    const onSessionExtras = mount(session({ extras: { cost: 2, currency: "GBP" } }));
    const box = screen.getByRole("checkbox", { name: "Show readers" }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    save();
    expect(onSessionExtras).toHaveBeenCalledWith("typed-a", { cost: 2, currency: "GBP", showCost: true });
  });

  it("asks How did you work? and saves In the background", () => {
    const onSessionExtras = mount(session());
    expect((screen.getByRole("radio", { name: "Supervised" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Background" }));
    save();
    expect(onSessionExtras).toHaveBeenCalledWith("typed-a", { background: true });
  });
});

describe("the line under the session head", () => {
  it("is absent when nothing is set", () => {
    renderList(meta({}));
    expect(screen.queryByTestId("facts-line")).toBeNull();
    cleanup();
    renderPage(meta({}));
    expect(screen.queryByTestId("facts-line")).toBeNull();
  });

  it("shows the maker everything in the List", () => {
    renderList(meta({ words: 150_000, cost: 3.4, currency: "GBP", tokens: 1_200_000, cached: 9, background: true }));
    expect(screen.getByTestId("facts-line").textContent).toBe(
      "Long session, about 150,000 words. Smaller models may not read it all at once. · Cost about £3.40 and 1.2 million tokens · Later runs cost less, because the start is reused. · Ran in the background",
    );
  });

  it("keeps the cost from readers by default, and shows it once Show readers is on", () => {
    renderPage(meta({ words: 150_000, cost: 3.4, currency: "GBP", background: true }));
    expect(screen.getByTestId("facts-line").textContent).toBe("Long session, about 150,000 words. Smaller models may not read it all at once. · Ran in the background");
    cleanup();
    renderPage(meta({ cost: 3.4, currency: "GBP", showCost: true }));
    expect(screen.getByTestId("facts-line").textContent).toBe("Cost about £3.40");
  });
});
