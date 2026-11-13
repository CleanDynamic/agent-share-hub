import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RunDialog } from "./RunDialog";

describe("RunDialog (the control-heights pass)", () => {
  it("draws its model field 32 high with 12 either side", () => {
    render(<RunDialog open onOpenChange={vi.fn()} creator={false} suggestions={[]} onSubmit={vi.fn()} />);
    const field = screen.getByLabelText("Which model did you run it on?");
    expect([field.style.height, field.style.padding]).toEqual(["32px", "0px 12px"]);
  });
});
