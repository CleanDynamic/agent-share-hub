import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RunsWhenField } from "./RunsWhenField";
import type { RunsWhenView } from "./runtimeView";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => cleanup());

const view = (over: Partial<RunsWhenView> = {}): RunsWhenView => ({
  current: null,
  currentLabel: null,
  broken: null,
  decisions: [
    {
      id: "d",
      label: "3 · team",
      questions: [{ id: "team", choices: [{ label: "billing", is: ["billing"] }, { label: "support", is: ["support"] }] }],
    },
  ],
  ...over,
});

describe("Runs when (CA-13 P3)", () => {
  it("says so when there is no decision above to branch on", () => {
    render(<RunsWhenField view={view({ decisions: [] })} phone={false} onChange={vi.fn()} />);
    expect(screen.getByText(/Add a decision above this step first/)).toBeTruthy();
  });

  it("shows 'Always' while no condition is set, then the stored words once one is", () => {
    const { rerender } = render(<RunsWhenField view={view()} phone={false} onChange={vi.fn()} />);
    expect(screen.getByText("Always")).toBeTruthy();
    rerender(<RunsWhenField view={view({ current: { decision: "d", question: "team", is: ["billing"] }, currentLabel: "Runs when team is billing" })} phone={false} onChange={vi.fn()} />);
    expect(screen.getByText("Runs when team is billing")).toBeTruthy();
  });

  it("offers the decision, then its question, then the value, and sets the condition", async () => {
    const onChange = vi.fn();
    render(<RunsWhenField view={view()} phone={false} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Decision" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "3 · team" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Question" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "team" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Value" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "support" }));
    expect(onChange).toHaveBeenCalledWith({ decision: "d", question: "team", is: ["support"] });
  });

  it("clears the condition with Always", async () => {
    const onChange = vi.fn();
    render(<RunsWhenField view={view({ current: { decision: "d", question: "team", is: ["billing"] }, currentLabel: "Runs when team is billing" })} phone={false} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Decision" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Always" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("says in words when the decision was removed", () => {
    render(<RunsWhenField view={view({ decisions: [], current: { decision: "gone", question: "team", is: ["billing"] }, currentLabel: "Runs when team is billing", broken: "That decision is no longer in the build." })} phone={false} onChange={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("That decision is no longer in the build.");
  });
});
