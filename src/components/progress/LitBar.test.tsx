// RC-P27 / UI-P09 — the progress bar is light, never type: a StripedBar in --lit.
//
// The claims: the fill is --lit stripes on a --bar-base field, nothing is
// written on the bar, it says its value to assistive technology as the text
// beside it does, and it fills only that share of its width.

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LitBar } from "./LitBar";

const html = (value: number, max: number) =>
  renderToStaticMarkup(<LitBar value={value} max={max} label="Run three builds" valueText={`${value} of ${max}`} />);

describe("the bar's paint", () => {
  it("is --lit stripes over --bar-base stripes, and writes nothing on it", () => {
    const markup = html(2, 3);
    expect(markup).toContain("repeating-linear-gradient(-60deg, var(--lit) 0 2.5px, transparent 2.5px 6px)");
    expect(markup).toContain("repeating-linear-gradient(-60deg, var(--bar-base) 0 2.5px, transparent 2.5px 6px)");
    expect(markup).not.toContain("--recess");
    const host = document.createElement("div");
    host.innerHTML = markup;
    expect(host.querySelector('[role="progressbar"]')?.textContent).toBe("");
  });

  it("is a 8px striped bar", () => {
    const markup = html(1, 3);
    expect(markup).toContain('data-ui="striped-bar"');
    expect(markup).toContain("height:8px");
  });

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

  it("never fills past its track or below nothing", () => {
    const { container, rerender } = render(<LitBar value={5} max={3} label="Done" valueText="3 of 3" />);
    const fill = () => container.querySelector("[data-striped-fill]") as HTMLElement;
    expect(fill().style.width).toBe("100%");
    rerender(<LitBar value={-2} max={3} label="Done" valueText="0 of 3" />);
    expect(fill().style.width).toBe("0%");
  });

  it("keeps its test id, defaulting to lit-bar", () => {
    const { rerender } = render(<LitBar value={1} max={3} label="x" valueText="1 of 3" />);
    expect(screen.getByTestId("lit-bar")).toBeTruthy();
    rerender(<LitBar value={1} max={3} label="x" valueText="1 of 3" data-testid="mine" />);
    expect(screen.getByTestId("mine")).toBeTruthy();
  });
});
