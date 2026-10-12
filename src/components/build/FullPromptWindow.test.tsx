import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { FullPromptWindow, neighbours, windowPrompts, type FullPromptWindowProps } from "./FullPromptWindow";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const list = sandboxListProps("bakery");

function open(openId: string, over: Partial<FullPromptWindowProps> = {}) {
  const props: FullPromptWindowProps = {
    steps: list.steps,
    names: list.names,
    openId,
    mode: "maker",
    onTitle: vi.fn(),
    onNavigate: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<FullPromptWindow {...props} />);
  return props;
}

describe("moving between prompts", () => {
  it("has no previous at the first prompt and no next at the last", () => {
    const prompts = windowPrompts(list.steps);
    const first = prompts[0].id;
    const last = prompts[prompts.length - 1].id;
    expect(neighbours(prompts, first).previous).toBeNull();
    expect(neighbours(prompts, first).next).not.toBeNull();
    expect(neighbours(prompts, last).next).toBeNull();
    expect(neighbours(prompts, "nope")).toEqual({ previous: null, next: null });
  });

  it("← and → go to the neighbours, and do nothing at either end", () => {
    const props = open("p3");
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(props.onNavigate).toHaveBeenLastCalledWith("p4");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(props.onNavigate).toHaveBeenLastCalledWith("p2");
  });

  it("leaves out the previous button at the first prompt, and the arrows do nothing there", () => {
    const props = open("p1");
    expect(screen.queryByRole("button", { name: /^Previous prompt/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Next prompt/ })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(props.onNavigate).not.toHaveBeenCalled();
  });

  it("leaves out the next button at the last prompt", () => {
    const prompts = windowPrompts(list.steps);
    open(prompts[prompts.length - 1].id);
    expect(screen.queryByRole("button", { name: /^Next prompt/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Previous prompt/ })).toBeTruthy();
  });

  it("does not move while the title field has focus", () => {
    const props = open("p3");
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "ArrowRight" });
    expect(props.onNavigate).not.toHaveBeenCalled();
  });
});

describe("the title", () => {
  it("saves on Enter and on blur", () => {
    const props = open("p3");
    const field = screen.getByLabelText("Title");
    fireEvent.change(field, { target: { value: "Mobile fixes" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onTitle).toHaveBeenLastCalledWith("p3", "Mobile fixes");
    fireEvent.change(field, { target: { value: "Mobile fixes 2" } });
    fireEvent.blur(field);
    expect(props.onTitle).toHaveBeenLastCalledWith("p3", "Mobile fixes 2");
  });

  it("saves an empty title as the default (an empty string, which the page turns back into the default)", () => {
    const props = open("p3");
    const field = screen.getByLabelText("Title") as HTMLInputElement;
    expect(field.placeholder).toBe("Prompt 3");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(props.onTitle).toHaveBeenCalledWith("p3", "");
  });

  it("is a heading, with no field, for a reader", () => {
    open("p3", { mode: "reader", onTitle: undefined });
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.getByRole("heading", { name: "Fix the mobile layout" })).toBeTruthy();
    expect(screen.getByText("Before you send it")).toBeTruthy();
  });
});

describe("the window", () => {
  it("heads itself 'Prompt n of N · full prompt', shows the facts, the words and the uses", () => {
    open("p3");
    expect(screen.getByText("Prompt 3 of 5 · full prompt")).toBeTruthy();
    expect(screen.getByText("19 words")).toBeTruthy();
    expect(screen.getByText("Output of 2 · Prompt 2")).toBeTruthy();
    expect(screen.getByText("menu.pdf")).toBeTruthy();
    expect(screen.getByText("Esc closes · ← → move between prompts")).toBeTruthy();
  });

  it("puts focus on the text box", async () => {
    open("p3");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("full-prompt-text")));
  });

  it("copies the text and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    open("p3");
    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("The menu grid overflows")));
    await waitFor(() => expect(screen.getAllByRole("status").some((el) => el.textContent === "Copied")).toBe(true));
  });

  it("closes with Done and with Close, and stays shut for an id that is not a prompt", () => {
    const props = open("p3");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    cleanup();
    open("nope");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
