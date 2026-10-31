// SV-26 P3: a composer window's code is fetched on the first hover or focus of a control, before idle, once.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { lazyWindow, useWarmWindowsOnIntent } from "./lazyWindow";

const load = vi.fn(() => Promise.resolve({ default: () => <div>The window</div> }));
lazyWindow<{ open: boolean }>(load, (p) => p.open);

function Composer() {
  useWarmWindowsOnIntent();
  return (
    <div>
      <p>Some text</p>
      <button type="button">Add</button>
    </div>
  );
}

describe("warming the composer's windows on intent", () => {
  it("fetches nothing for a hover on plain text, then every window once on a control's hover or focus", () => {
    render(<Composer />);
    fireEvent.pointerOver(screen.getByText("Some text"));
    expect(load).not.toHaveBeenCalled();
    fireEvent.pointerOver(screen.getByRole("button", { name: "Add" }));
    expect(load).toHaveBeenCalledTimes(1);
    fireEvent.focusIn(screen.getByRole("button", { name: "Add" }));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
