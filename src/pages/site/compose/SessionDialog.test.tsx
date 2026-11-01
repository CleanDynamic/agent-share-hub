// CA-18 P2: the Session modal: its sections, and its writes through the handlers Details used.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tileView } from "@/dev/fixtures/detailsKinds";

import type { DetailsHandlers, SessionView } from "./DetailsPanel";
import { SessionDialog } from "./SessionDialog";
import { openOptional } from "./optionalKit";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const NAMES = ["onSessionTool", "onSessionMeta", "onSessionGoal", "onSessionExtras", "onSessionTogether", "onAddToSetup", "onNotShared", "onToggleSessionPrompt"] as const;
const handlers = () => Object.fromEntries(NAMES.map((name) => [name, vi.fn()])) as unknown as DetailsHandlers & Record<(typeof NAMES)[number], ReturnType<typeof vi.fn>>;

function view(): SessionView {
  const base = tileView("session", "full") as SessionView;
  return { ...base, editable: { tool: "claude-code", date: "2026-10-08" }, checklist: [{ ordinal: 0, label: "Fix the mobile layout", stepId: "p3" }, { ordinal: 1, label: "Add a footer", stepId: null }], total: 2 };
}

function open(over: Partial<SessionView> = {}, h = handlers()) {
  const onClose = vi.fn();
  const v = { ...view(), ...over };
  render(<SessionDialog view={v} handlers={h} inBuild={[]} onClose={onClose} />);
  return { h, onClose, v };
}

const dialog = () => screen.getByRole("dialog");
const save = () => fireEvent.click(within(dialog()).getByRole("button", { name: "Save" }));
const calls = (h: ReturnType<typeof handlers>) => NAMES.flatMap((name) => h[name].mock.calls.map((args) => [name, ...args]));

describe("the Session modal", () => {
  it("is the tile frame: Edit above the session's own line, Save, and its sections in order", () => {
    open();
    expect(screen.getByTestId("modal-eyebrow").textContent).toBe("Edit");
    expect(screen.getByRole("dialog", { name: "Session 2 · Claude Code" })).toBeTruthy();
    openOptional();
    const text = dialog().textContent ?? "";
    const order = ["Harness and model", "Date", "Worked until", "What it cost", "Started with", "Own copy of the code", "Ran alongside", "Setup", "Prompts shared"].map((label) => text.indexOf(label));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order]).toEqual([...order].sort((a, b) => a - b));
  });

  it("writes the date through onSessionMeta", () => {
    const { h } = open();
    const field = within(dialog()).getByPlaceholderText("2026-10-12");
    fireEvent.change(field, { target: { value: "2026-10-09" } });
    fireEvent.blur(field);
    expect(h.onSessionMeta).not.toHaveBeenCalled();
    save();
    expect(calls(h)).toEqual([["onSessionMeta", "s2", { date: "2026-10-09" }]]);
  });

  it("says a day that is not one, and does not write it", () => {
    const { h } = open();
    const field = within(dialog()).getByPlaceholderText("2026-10-12");
    fireEvent.change(field, { target: { value: "9 October" } });
    fireEvent.blur(field);
    expect(screen.getByText("Format: 2026-10-12")).toBeTruthy();
    save();
    expect(calls(h)).toEqual([]);
  });

  it("writes what it worked until through onSessionGoal, the whole goal", () => {
    const { h } = open({ goal: undefined });
    const condition = within(dialog()).getByRole("textbox", { name: "The condition" });
    fireEvent.change(condition, { target: { value: "the tests pass" } });
    fireEvent.blur(condition);
    save();
    expect(calls(h)).toEqual([["onSessionGoal", "s2", { condition: "the tests pass" }]]);
  });

  it("takes a goal off with null", () => {
    const { h } = open({ goal: { condition: "the tests pass", atMost: 40 } });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Remove goal" }));
    save();
    expect(calls(h)).toEqual([["onSessionGoal", "s2", null]]);
  });

  it("writes cost and the command it started with as one whole entry through onSessionExtras", () => {
    const { h } = open({ extras: { background: true } });
    const cost = within(dialog()).getByRole("textbox", { name: "What it cost" });
    fireEvent.change(cost, { target: { value: "3.40" } });
    fireEvent.blur(cost);
    const started = within(dialog()).getByRole("textbox", { name: "Started with" });
    fireEvent.change(started, { target: { value: "claude -p" } });
    fireEvent.blur(started);
    save();
    expect(h.onSessionExtras).toHaveBeenCalledTimes(1);
    expect(h.onSessionExtras).toHaveBeenCalledWith("s2", { background: true, cost: 3.4, currency: "GBP", startedWith: "claude -p" });
  });

  it("marks a setup item Not shared (onNotShared), and ticks a prompt (onToggleSessionPrompt)", () => {
    const { h, v } = open({ setup: [{ id: "su1", kind: "Skill", name: "Brand skill", description: null, notShared: false }] });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Keep private: Brand skill" }));
    fireEvent.click(within(within(dialog()).getByRole("group", { name: "Prompts in this session" })).getAllByRole("checkbox")[1]);
    save();
    expect(calls(h)).toEqual(
      expect.arrayContaining([
        ["onNotShared", "su1"],
        ["onToggleSessionPrompt", v, expect.objectContaining({ ordinal: 1 }), true],
      ]),
    );
    expect(calls(h)).toHaveLength(2);
  });

  it("Add to setup opens the file picker at once: it adds files, it is not a draft", () => {
    const { h } = open({ setup: [{ id: "su1", kind: "Skill", name: "Brand skill", description: null, notShared: false }] });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Add to setup" }));
    expect(h.onAddToSetup).toHaveBeenCalledWith("s2");
  });

  it("Cancel and Escape write nothing", () => {
    const { h, onClose } = open();
    const field = within(dialog()).getByPlaceholderText("2026-10-12");
    fireEvent.change(field, { target: { value: "2026-10-09" } });
    fireEvent.blur(field);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(calls(h)).toEqual([]);
    expect(onClose).toHaveBeenCalled();
  });

  it("a session whose client names its tool shows it and does not offer to change it", () => {
    open({ editable: undefined });
    expect(within(dialog()).queryByPlaceholderText("2026-10-12")).toBeNull();
    expect(within(dialog()).getByText("Claude Code")).toBeTruthy();
  });
});
