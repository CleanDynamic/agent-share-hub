// SV-28 P7: Show setup prompt: the text read-only, its character count and the same copy action.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { chiefOfStaffTree } from "@/dev/fixtures/deployment/chief-of-staff";
import { setupPromptOf } from "@/lib/build/setupPrompt";
import { wordCount } from "@/lib/build/graph";

import { SetupPromptWindow } from "./SetupPromptWindow";

describe("SetupPromptWindow", () => {
  it("shows the text, its word count (F60), Rebuild in, and copies the same text", () => {
    const onCopy = vi.fn();
    render(<SetupPromptWindow id="cs-t1" tree={chiefOfStaffTree} name="Agency team" onCopy={onCopy} onClose={() => undefined} />);
    const text = setupPromptOf("cs-t1", { tree: chiefOfStaffTree }, "claude-code").text;
    expect(screen.getByTestId("setup-prompt-text").textContent).toBe(text);
    expect(screen.getByTestId("setup-prompt-count").textContent).toBe(`${wordCount(text).toLocaleString("en-GB")} words`);
    expect(screen.getByRole("button", { name: "Rebuild in" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy setup prompt" }));
    expect(onCopy).toHaveBeenCalledWith(text);
  });

  it("draws nothing without an agent or a team", () => {
    const { container } = render(<SetupPromptWindow id={null} tree={chiefOfStaffTree} onCopy={() => undefined} onClose={() => undefined} />);
    expect(container.textContent).toBe("");
  });
});
