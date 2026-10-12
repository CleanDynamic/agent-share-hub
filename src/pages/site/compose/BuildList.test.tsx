import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps } from "@/dev/fixtures/sandbox";

import { BuildList, type BuildListProps } from "./BuildList";
import { agentEyebrow, dividers, isClamped } from "./buildListModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function list(over: Partial<BuildListProps> = {}) {
  const props: BuildListProps = {
    ...sandboxListProps("bakery"),
    onSelect: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onRemove: vi.fn(),
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
    onAddPrompt: vi.fn(() => Promise.resolve(true)),
    ...over,
  };
  render(<BuildList {...props} />);
  return props;
}

describe("session dividers", () => {
  it("fall where the session changes, once per run", () => {
    const props = sandboxListProps("bakery");
    expect([...props.dividers.keys()]).toEqual(["1", "3", "4"]);
    expect(props.dividers.get("3")).toMatchObject({ number: 2, tool: "Claude Code" });
    list();
    expect(screen.getAllByRole("separator").map((el) => el.getAttribute("aria-label"))).toEqual([
      "Session 1 · Claude",
      "Session 2 · Claude Code",
      "Session 3 · ChatGPT",
    ]);
  });

  it("is empty for a build with no steps", () => {
    expect(dividers([], []).size).toBe(0);
  });
});

describe("step cards", () => {
  it("draws a default title in the quiet colour and a typed one in the strong colour", () => {
    list();
    const card = (name: RegExp) => screen.getByRole("group", { name });
    const quiet = within(card(/^Prompt 2:/)).getByRole("heading", { level: 3 });
    const named = within(card(/^Prompt 1:/)).getByRole("heading", { level: 3 });
    expect(quiet.textContent).toBe("Prompt 2");
    // A default title is marked, and drawn at weight 500 in `--text2` (the colour itself is not readable in jsdom).
    expect(quiet.getAttribute("data-default-title")).toBe("true");
    expect(quiet.getAttribute("style")).toMatch(/font-weight:\s*500/);
    expect(named.getAttribute("data-default-title")).toBeNull();
    expect(named.getAttribute("style")).toMatch(/font-weight:\s*600/);
    expect(named.textContent).toBe("Homepage copy");
  });

  it("shows Show full prompt only when the text is clamped", () => {
    list();
    expect(screen.queryByText("Show full prompt")).toBeNull();
    cleanup();
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(42);
    list();
    expect(screen.getAllByText("Show full prompt").length).toBeGreaterThan(0);
    expect(isClamped({ scrollHeight: 42, clientHeight: 42 })).toBe(false);
    expect(isClamped({ scrollHeight: 63, clientHeight: 42 })).toBe(true);
  });

  it("selects on click and shows the inputs, a suggestion with Accept and Dismiss, and where it goes", () => {
    const props = list();
    fireEvent.click(screen.getByRole("group", { name: /^Prompt 3:/ }));
    expect(props.onSelect).toHaveBeenCalledWith("p3");
    expect(screen.getByText("Output of 2 · Prompt 2")).toBeTruthy();
    expect(screen.getByText("menu.pdf")).toBeTruthy();
    expect(screen.getByText(/Output of 1 · Homepage copy · 38 words match/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(props.onAccept).toHaveBeenCalledWith(props.suggestions[0]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(props.onDismiss).toHaveBeenCalledWith(props.suggestions[0]);
  });

  it("opens the full prompt on double click and Enter, when it can", () => {
    const onOpenPrompt = vi.fn();
    list({ onOpenPrompt });
    const card = screen.getByRole("group", { name: /^Prompt 2:/ });
    fireEvent.doubleClick(card);
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onOpenPrompt).toHaveBeenCalledTimes(2);
    expect(onOpenPrompt).toHaveBeenCalledWith("p2");
  });

  it("renames in place: Enter saves, Esc cancels", async () => {
    const props = list();
    const openRename = async () => {
      const trigger = screen.getByRole("button", { name: "Prompt 2 options" });
      fireEvent.keyDown(trigger, { key: "Enter" });
      fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
      return screen.findByLabelText("Title of prompt 2");
    };
    const input = await openRename();
    fireEvent.change(input, { target: { value: "Page build" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("p2", "Page build");
    await waitFor(() => expect(screen.queryByLabelText("Title of prompt 2")).toBeNull());
  });

  it("offers Move up and Move down, none past either end", async () => {
    const props = list();
    const trigger = screen.getByRole("button", { name: "Prompt 1 options" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const up = await screen.findByRole("menuitem", { name: "Move up" });
    expect(up.getAttribute("aria-disabled") ?? up.getAttribute("data-disabled")).not.toBeNull();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move down" }));
    expect(props.onMove).toHaveBeenCalledWith("p1", 1);
  });
});

describe("the add field", () => {
  it("adds on Enter, not on Shift+Enter, and clears once saved", async () => {
    const props = list();
    const field = screen.getByPlaceholderText("Paste or type a prompt…") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Add a footer" } });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(props.onAddPrompt).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onAddPrompt).toHaveBeenCalledWith({ text: "Add a footer", tool: null, model: null });
    await waitFor(() => expect(field.value).toBe(""));
  });

  it("keeps the words when the write fails", async () => {
    list({ onAddPrompt: vi.fn(() => Promise.resolve(false)) });
    const field = screen.getByPlaceholderText("Paste or type a prompt…") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Keep me" } });
    fireEvent.click(screen.getByRole("button", { name: "Add prompt" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add prompt" })).toBeTruthy());
    expect(field.value).toBe("Keep me");
  });

  it("takes the cursor when asked", () => {
    const props = sandboxListProps("fox");
    const { rerender } = render(<BuildList {...props} focusAdd={0} />);
    rerender(<BuildList {...props} focusAdd={1} />);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Paste or type a prompt…"));
  });
});

describe("agent eyebrow", () => {
  it("names the prompts it was made in, when known", () => {
    expect(agentEyebrow(["1", "2"], "Opus 5.5")).toBe("Agent · made in prompts 1 and 2 · Opus 5.5");
    expect(agentEyebrow([], null)).toBe("Agent");
  });
});
