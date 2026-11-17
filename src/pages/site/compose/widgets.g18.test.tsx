// G18: the editor's composite widgets follow their ARIA pattern from the keyboard.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KeepLinkDialog } from "./referencePieces";

describe("G18: KeepLinkDialog's radio group", () => {
  const choices = [
    { key: "a", owner: "Login flow", words: "sign in", post: 1 },
    { key: "b", owner: "Code 4", words: "the token", post: 2 },
    { key: "c", owner: "Prompt 2", words: "the retry", post: 3 },
  ];

  it("is one Tab stop, and the arrows, Home and End move the choice and focus", () => {
    render(<KeepLinkDialog open title="Keep which link?" action="Keep" choices={choices} onPick={vi.fn()} onCancel={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1].getAttribute("aria-checked")).toBe("true");
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.keyDown(radios[1], { key: "End" });
    expect(document.activeElement).toBe(radios[2]);
    fireEvent.keyDown(radios[2], { key: "ArrowRight" });
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.keyDown(radios[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(radios[2]);
    fireEvent.keyDown(radios[2], { key: "Home" });
    expect(document.activeElement).toBe(radios[0]);
    expect(radios[0].getAttribute("aria-checked")).toBe("true");
  });
});
