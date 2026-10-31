// SV-26 P2: the tooltip works with no app-wide provider, and the sonner toaster mounted at idle still shows a toast raised
// before it arrived.

import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { describe, expect, it } from "vitest";

import { IdleSonner } from "./idleSonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

describe("the tooltip with no provider around the app", () => {
  it("draws on its own, bringing its own provider", async () => {
    render(
      <Tooltip open>
        <TooltipTrigger>Help</TooltipTrigger>
        <TooltipContent>Explains it</TooltipContent>
      </Tooltip>,
    );
    expect((await screen.findAllByText("Explains it")).length).toBeGreaterThan(0);
  });

  it("draws under a TooltipProvider, nested or not", async () => {
    render(
      <TooltipProvider>
        <TooltipProvider>
          <Tooltip open>
            <TooltipTrigger>Help</TooltipTrigger>
            <TooltipContent>Nested</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TooltipProvider>,
    );
    expect((await screen.findAllByText("Nested")).length).toBeGreaterThan(0);
  });
});

describe("the idle sonner toaster", () => {
  it("shows a toast raised before it mounted", async () => {
    act(() => {
      toast("Raised before the toaster");
    });
    render(<IdleSonner />);
    expect(await screen.findByText("Raised before the toaster")).toBeTruthy();
  });
});
