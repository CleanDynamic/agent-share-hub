// UI-P94 — the full prompt window in the refined look (`refined/{dusk,noon}/prompt-window.html`), rendered with the
// dev fixture under `?look=refined`: the same names, keys and handlers as the current look, then what the board draws.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { FullPromptWindow, type FullPromptWindowProps } from "./FullPromptWindow";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: /min-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
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
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
      <FullPromptWindow {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("the refined window does what the window does", () => {
  it("moves with ← and →, but not from the title field", () => {
    const props = open("p3");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(props.onNavigate).toHaveBeenLastCalledWith("p4");
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "ArrowLeft" });
    expect(props.onNavigate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /^Previous prompt/ }));
    expect(props.onNavigate).toHaveBeenLastCalledWith("p2");
  });

  it("saves the title on Enter and on blur", () => {
    const props = open("p3");
    const field = screen.getByLabelText("Title");
    fireEvent.change(field, { target: { value: "Mobile fixes" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onTitle).toHaveBeenLastCalledWith("p3", "Mobile fixes");
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(props.onTitle).toHaveBeenLastCalledWith("p3", "");
  });

  it("heads itself, puts focus on the text, lists the uses, and closes with Done and Close", async () => {
    const props = open("p3");
    expect(screen.getByRole("dialog", { name: "Prompt 3 of 5" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId("full-prompt-text")));
    expect(screen.getByText("19 words")).toBeTruthy();
    expect(screen.getByText("Output of 2 · Prompt 2")).toBeTruthy();
    expect(screen.getByText("Esc Close · ← → Previous or next prompt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("copies the text and says so", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    open("p3");
    fireEvent.click(screen.getByRole("button", { name: "Copy prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("The menu grid overflows")));
  });

  it("is a heading for a reader, with Before you send it", () => {
    open("p3", { mode: "reader", onTitle: undefined });
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(screen.getByRole("heading", { name: "Fix the mobile layout" })).toBeTruthy();
    expect(screen.getByText("Before you send it")).toBeTruthy();
  });
});

describe("the refined window as the board draws it", () => {
  it("is the window recipe, 760 wide, radius 12, padding 20px 24px", () => {
    open("p3");
    const dialog = screen.getByTestId("full-prompt-window");
    expect(dialog.style.width).toBe("760px");
    expect(dialog.style.borderRadius).toBe("12px");
    expect(dialog.style.padding).toBe("20px 24px");
    expect(dialog.style.boxShadow).toBe("var(--window-shadow)");
  });

  it("heads with the title, one grey line, and square 28 Previous, Next and Close", () => {
    open("p3");
    const line = screen.getByTestId("full-prompt-line");
    expect(line.style.fontSize).toBe("13px");
    for (const name of [/^Previous prompt/, /^Next prompt/, "Close"]) {
      const button = screen.getByRole("button", { name });
      expect(button.style.width).toBe("28px");
      expect(button.style.height).toBe("28px");
    }
    expect(screen.getByRole("button", { name: "Rename prompt" })).toBeTruthy();
  });

  it("puts the title at 15/500 and the text in a well 320 high at 14.5/25 with no fade", () => {
    open("p3");
    const title = screen.getByLabelText("Title");
    expect(title.style.fontSize).toBe("15px");
    const text = screen.getByTestId("full-prompt-text");
    expect(text.style.height).toBe("320px");
    expect(text.style.fontSize).toBe("14.5px");
    expect(text.style.lineHeight).toBe("25px");
    expect(screen.queryByTestId("full-prompt-fade")).toBeNull();
  });

  it("draws Copy prompt as a secondary 28 with no icon, and Done as the one primary, 30 high", () => {
    open("p3");
    const copy = screen.getByRole("button", { name: "Copy prompt" });
    expect(copy.getAttribute("data-variant")).toBe("secondary");
    expect(copy.style.height).toBe("28px");
    expect(copy.querySelector("svg")).toBeNull();
    const done = screen.getByRole("button", { name: "Done" });
    expect(done.getAttribute("data-variant")).toBe("primary");
    expect(done.style.height).toBe("30px");
    expect(within(screen.getByRole("dialog")).getAllByRole("button").filter((button) => button.getAttribute("data-variant") === "primary")).toHaveLength(1);
  });
});
