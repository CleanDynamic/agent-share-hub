import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToolPicker } from "./ToolPicker";

afterEach(cleanup);

function Harness({ initial = null, onChange = () => undefined, allowNone = false }: { initial?: string | null; onChange?: (value: string | null) => void; allowNone?: boolean }) {
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
});
