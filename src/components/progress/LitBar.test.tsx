// RC-P27 / UI-P09 — the progress bar is light, never type: a StripedBar in --lit.
//
// The claims: the fill is --lit stripes on a --bar-base field, nothing is
// written on the bar, it says its value to assistive technology as the text
// beside it does, and it fills only that share of its width.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LitBar } from "./LitBar";

describe("the bar's paint", () => {

  it("gives its value as the text beside it does, and fills that share of the width", () => {
    const { container } = render(
      <LitBar value={169} max={242} label="Progress to level 4" valueText="169 of 242 XP" />,
    );

    const bar = screen.getByRole("progressbar", { name: "Progress to level 4" });
    expect(bar.getAttribute("aria-valuenow")).toBe("169");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("242");
    expect(bar.getAttribute("aria-valuetext")).toBe("169 of 242 XP");
    expect((container.querySelector("[data-striped-fill]") as HTMLElement).style.width).toBe("69.8%");
  });

  it("keeps its test id, defaulting to lit-bar", () => {
    const { rerender } = render(<LitBar value={1} max={3} label="x" valueText="1 of 3" />);
    expect(screen.getByTestId("lit-bar")).toBeTruthy();
    rerender(<LitBar value={1} max={3} label="x" valueText="1 of 3" data-testid="mine" />);
    expect(screen.getByTestId("mine")).toBeTruthy();
  });
});
