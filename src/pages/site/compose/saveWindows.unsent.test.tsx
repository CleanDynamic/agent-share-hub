import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LeaveWindow } from "./saveWindows";

const base = { open: true, onStay: vi.fn(), onLeave: vi.fn() };

describe("UX-01 P1: the leave window's unsent line", () => {
  it("shows one line per session, up to three, then 'and k more', without calling them 'saving'", () => {
    render(<LeaveWindow {...base} count={0} unsent={[1, 2, 3, 4, 5]} />);
    const lines = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(lines).toEqual(["Unsent prompt in Session 1", "Unsent prompt in Session 2", "Unsent prompt in Session 3", "and 2 more"]);
    expect(screen.queryByText("Changes still saving")).toBeNull();
  });
  it("keeps the saving count and adds the line beside it", () => {
    render(<LeaveWindow {...base} count={2} unsent={[2]} />);
    expect(screen.getByText("Changes still saving")).toBeTruthy();
    expect(screen.getByText("2 changes haven't saved. Leaving may lose them.")).toBeTruthy();
    expect(screen.getByText("Unsent prompt in Session 2")).toBeTruthy();
  });
});
