// RC-P27 / Synth 15 — the progress bar: a Mint fill on the Raised track, nothing written on it.
//
// The claims: it says its value to assistive technology as the text beside it
// does, it fills only that share of its width, it is 6px by default and 4px
// under a challenge, and the paint is --brand-accent on --control.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LitBar } from "./LitBar";

describe("the bar's paint", () => {

  it("gives its value as the text beside it does, and fills that share of the width", () => {
    const { container } = render(
      <LitBar value={169} max={242} label="Challenge progress" valueText="169 of 242" />,
    );

    const bar = screen.getByRole("progressbar", { name: "Challenge progress" });
    expect(bar.getAttribute("aria-valuenow")).toBe("169");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("242");
    expect(bar.getAttribute("aria-valuetext")).toBe("169 of 242");
    expect((container.querySelector("[data-bar-fill]") as HTMLElement).style.width).toBe("69.8%");
    expect(bar.style.height).toBe("6px");
  });

  it("paints the Mint fill on the Raised track, 4px when asked", () => {
    const html = renderToStaticMarkup(<LitBar value={1} max={2} label="x" valueText="1 of 2" height={4} />);
    expect(html).toContain("background:var(--control)");
    expect(html).toContain("background:var(--brand-accent)");
    expect(html).toContain("height:4px");
  });

  it("keeps its test id, defaulting to lit-bar", () => {
    const { rerender } = render(<LitBar value={1} max={3} label="x" valueText="1 of 3" />);
    expect(screen.getByTestId("lit-bar")).toBeTruthy();
    rerender(<LitBar value={1} max={3} label="x" valueText="1 of 3" data-testid="mine" />);
    expect(screen.getByTestId("mine")).toBeTruthy();
  });
});
