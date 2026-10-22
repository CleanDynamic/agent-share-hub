import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyClassification } from "@/lib/classify/facets";
import type { GapQuestion } from "@/lib/classify/derive";
import type { Classification } from "@/lib/classify/types";

import { CONFIRMED_FREE, ReadFromBuild } from "./ReadFromBuild";

afterEach(cleanup);

const base = (over: Partial<Classification> = {}): Classification => ({ ...emptyClassification(), ...over });

const QUESTION: GapQuestion = { id: "paid-plan-no-cost:n1", text: "A tool names a paid plan, but no cost is given.", action: "add-cost", actionLabel: "Add a cost", tileId: "n1" };

function mount(c: Classification, questions: GapQuestion[] = []) {
  const props = { onDispute: vi.fn(), onDismiss: vi.fn(), onSource: vi.fn(), onAction: vi.fn() };
  render(<ReadFromBuild classification={c} questions={questions} phone={false} now={() => "2026-10-22T10:00:00Z"} {...props} />);
  return props;
}

describe("ReadFromBuild", () => {
  it("lists every derived facet with its value, or Not stated", () => {
    mount(base({ derived: { built: { values: ["web-app"], from: ["n1"] }, skill: { values: ["no-coding"], from: [] } } }));
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(10);
    const built = document.querySelector("[data-facet='built']") as HTMLElement;
    expect(built.textContent).toContain("Web app");
    expect(within(built).getByText("Derived")).toBeTruthy();
    expect((document.querySelector("[data-facet='technique']") as HTMLElement).textContent).toContain("Not stated");
  });

  it("offers Dispute for oversight, skill, cost and what was built only, and Source only with a tile", () => {
    mount(base({ derived: { built: { values: ["web-app"], from: ["n1"] }, skill: { values: ["no-coding"], from: [] } } }));
    for (const name of ["Human oversight", "Skill needed", "Cost to run", "What was built"]) expect(screen.getByRole("button", { name: `Dispute ${name}` })).toBeTruthy();
    for (const name of ["Techniques", "Modality", "Role of AI", "Autonomy", "Tools and stack", "Build method"]) expect(screen.queryByRole("button", { name: `Dispute ${name}` })).toBeNull();
    expect(screen.getByRole("button", { name: "Source of What was built" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Source of Skill needed" })).toBeNull();
  });

  it("selects the source tile", () => {
    const props = mount(base({ derived: { built: { values: ["web-app"], from: ["n1", "n2"] } } }));
    fireEvent.click(screen.getByRole("button", { name: "Source of What was built" }));
    expect(props.onSource).toHaveBeenCalledWith("n1");
  });

  it("disputes a value with a reason, and the dispute carries its time", () => {
    const props = mount(base({ derived: { skill: { values: ["some-setup"], from: [] } } }));
    fireEvent.click(screen.getByRole("button", { name: "Dispute Skill needed" }));
    const use = screen.getByRole("button", { name: "Use this value" }) as HTMLButtonElement;
    expect(use.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Corrected value for Skill needed"), { target: { value: "no-coding" } });
    fireEvent.change(screen.getByLabelText("Reason for changing Skill needed"), { target: { value: "No code at all" } });
    fireEvent.click(use);
    expect(props.onDispute).toHaveBeenCalledWith("skill", { values: ["no-coding"], reason: "No code at all", at: "2026-10-22T10:00:00Z" });
  });

  it("confirms Free plans are enough with the reason Confirmed free, without typing it", () => {
    const props = mount(base({ derived: { cost: { values: ["cost-not-stated"], from: [] } } }));
    fireEvent.click(screen.getByRole("button", { name: "Dispute Cost to run" }));
    fireEvent.change(screen.getByLabelText("Corrected value for Cost to run"), { target: { value: "free-plans-are-enough" } });
    fireEvent.click(screen.getByRole("button", { name: "Use this value" }));
    expect(props.onDispute).toHaveBeenCalledWith("cost", { values: ["free-plans-are-enough"], reason: CONFIRMED_FREE, at: "2026-10-22T10:00:00Z" });
  });

  it("shows a disputed value as Stated by you with its reason, and Undo takes it back", () => {
    const props = mount(base({ derived: { skill: { values: ["some-setup"], from: ["n1"] } }, disputes: { skill: { values: ["no-coding"], reason: "No code at all", at: "x" } } }));
    const skill = document.querySelector("[data-facet='skill']") as HTMLElement;
    expect(skill.textContent).toContain("No coding");
    expect(within(skill).getByText("Stated by you")).toBeTruthy();
    expect(skill.textContent).toContain("Your reason: No code at all");
    fireEvent.click(screen.getByRole("button", { name: "Undo your change to Skill needed" }));
    expect(props.onDispute).toHaveBeenCalledWith("skill", null);
  });

  it("puts gap questions first, each with its action and Dismiss", () => {
    const props = mount(base(), [QUESTION]);
    const questions = screen.getByRole("region", { name: "Questions" });
    expect(questions.compareDocumentPosition(screen.getByRole("list", { name: "Read from your build" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(questions).getByRole("button", { name: "Add a cost" }));
    expect(props.onAction).toHaveBeenCalledWith("add-cost", QUESTION);
    fireEvent.click(within(questions).getByRole("button", { name: "Dismiss" }));
    expect(props.onDismiss).toHaveBeenCalledWith("paid-plan-no-cost:n1");
  });
});
