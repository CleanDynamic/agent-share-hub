import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StepKey } from "@/lib/tools/registry";

import { ToolPicker } from "./ToolPicker";

afterEach(cleanup);

function Harness({ initial = null, onChange = () => undefined, allowNone = false, step = "manual" }: { initial?: string | null; onChange?: (value: string | null) => void; allowNone?: boolean; step?: StepKey }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ToolPicker
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      inBuild={["Midjourney"]}
      allowNone={allowNone}
      label="Tool"
      phone={false}
      step={step}
    />
  );
}

const trigger = () => screen.getByRole("button", { name: "Tool" });
const find = () => screen.getByRole("combobox", { name: "Find a tool" });

describe("ToolPicker", () => {
  it('shows "Pick a tool" and then the chosen tool\'s name', () => {
    render(<Harness />);
    expect(trigger().textContent).toBe("Pick a tool");
    cleanup();
    render(<Harness initial="lovable" />);
    expect(trigger().textContent).toBe("Lovable");
    expect(trigger().querySelector("img[data-mark='lovable-color']")).toBeTruthy();
  });

  it("picks by keyboard alone and puts focus in the field first", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    expect(document.activeElement).toBe(find());
    expect(screen.getByRole("option", { name: /Midjourney/ })).toBeTruthy();
    fireEvent.keyDown(find(), { key: "ArrowDown" });
    fireEvent.keyDown(find(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("chatgpt");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("types to find and hands back a typed name trimmed", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.change(find(), { target: { value: " Photoshop " } });
    fireEvent.keyDown(find(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("Photoshop");
    expect(trigger().textContent).toBe("Photoshop");
  });

  it("offers No tool only with allowNone, and hands back null", () => {
    const onChange = vi.fn();
    render(<Harness initial="lovable" allowNone onChange={onChange} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(find(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(null);
    cleanup();
    render(<Harness />);
    fireEvent.click(trigger());
    expect(screen.queryByRole("option", { name: "No tool" })).toBeNull();
  });

  it("closes on Esc and gives focus back to the trigger", async () => {
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.keyDown(find(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  it("draws a tool that does not fit the step as unavailable, with where it goes (CA-02)", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} step="prompt" />);
    fireEvent.click(trigger());
    fireEvent.change(find(), { target: { value: "gmail" } });
    const gmail = screen.getByRole("option", { name: /Gmail/ });
    expect(gmail.getAttribute("aria-disabled")).toBe("true");
    expect(gmail.textContent).toContain("Add it with Add › Tool");
    fireEvent.click(gmail);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("still lets a tool that runs prompts by itself be picked on a prompt", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} step="prompt" />);
    fireEvent.click(trigger());
    fireEvent.change(find(), { target: { value: "hermes" } });
    const hermes = screen.getByRole("option", { name: /Hermes Agent/ });
    expect(hermes.getAttribute("aria-disabled")).toBeNull();
    expect(hermes.textContent).toContain("Hermes Agent runs prompts by itself. Add it as an agent.");
    fireEvent.click(hermes);
    expect(onChange).toHaveBeenCalledWith("hermes-agent");
  });
});
