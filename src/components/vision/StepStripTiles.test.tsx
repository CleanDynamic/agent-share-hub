import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StepStripTiles } from "./StepStripTiles";

const tiles = [
  { id: "a", number: "3", kind: "Code", title: "Rubric", open: false },
  { id: "b", number: "4", kind: "Prompt", title: "Scorer", open: true },
];

describe("StepStripTiles", () => {
  it("draws the open step as a dashed slot with its title (the requests page)", () => {
    render(<StepStripTiles tiles={tiles} />);
    const open = document.querySelector('[data-ui="dashed-slot"]') as HTMLElement;
    expect(open.textContent).toBe("4 · Prompt · openScorer");
  });

  it("draws the open step labelled over Still open when asked (the post card)", () => {
    render(<StepStripTiles tiles={tiles} openLabel="Still open" />);
    const open = document.querySelector('[data-ui="dashed-slot"]') as HTMLElement;
    expect(open.textContent).toBe("4 · PromptStill open");
  });

  it("makes each tile a button when it can be picked, pressed for the open one", () => {
    const onPick = vi.fn();
    render(<StepStripTiles tiles={tiles} openLabel="Still open" onPick={onPick} />);
    expect(screen.getByRole("button", { name: "4 · Prompt, Scorer" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "3 · Code, Rubric" }));
    expect(onPick).toHaveBeenCalledWith("a");
  });

  it("draws nothing for no steps", () => {
    const { container } = render(<StepStripTiles tiles={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
