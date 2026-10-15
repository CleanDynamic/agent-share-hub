// UI-P90 — "Before you send it" in the refined look, from the dev fixture's step 4: the same rows, words and names as
// `BeforeYouSend`, as rows 48 high on the module's hairline.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildStepsFixture } from "@/dev/fixtures/buildSteps";

import { BeforeYouSend } from "./BeforeYouSend";

const steps = buildStepsFixture("list").steps;
const step4 = steps.find((entry) => entry.step.number === "4");
if (!step4) throw new Error("the list sample has a step 4");

describe("BeforeYouSend", () => {
  it("says each paste-in and attachment, and goes to the step a paste-in came from", () => {
    const onSelect = vi.fn();
    render(<BeforeYouSend entry={step4} toolOf={() => "Claude"} onSelect={onSelect} />);
    const section = screen.getByRole("region", { name: "Before you send it" });
    expect(within(section).getByRole("heading", { name: "Before you send it" })).toBeTruthy();
    const rows = within(section).getAllByTestId("before-row");
    expect(rows).toHaveLength(step4.pasteIns.length + step4.attach.length);
    for (const row of rows) expect(row.style.minHeight).toBe("48px");
    expect(within(section).getByText("Paste what step 2 gave you")).toBeTruthy();
    expect(within(section).getByText("Attach CLAUDE.md")).toBeTruthy();
    expect(within(section).getByRole("link", { name: "Download CLAUDE.md" })).toBeTruthy();
    fireEvent.click(within(section).getByRole("button", { name: "Go to step 2" }));
    expect(onSelect).toHaveBeenCalledWith(step4.pasteIns[0].stepId);
    expect(section.querySelector("svg.lucide")).toBeNull();
  });

  it("draws nothing for a step with nothing to paste or attach", () => {
    const step1 = steps.find((entry) => entry.step.number === "1");
    if (!step1) throw new Error("the list sample has a step 1");
    const { container } = render(<BeforeYouSend entry={step1} toolOf={() => null} onSelect={() => undefined} />);
    expect(container.innerHTML).toBe("");
  });
});
