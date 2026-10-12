import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxListProps, sandboxManualFixture, sandboxTeamFixture } from "@/dev/fixtures/sandbox";

import { BuildList, type BuildListProps } from "./BuildList";
import { agentEyebrow, dividers, isClamped, madeIn } from "./buildListModel";

vi.mock("@/lib/build/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/media")>()), getMediaById: vi.fn(() => Promise.resolve(null)) }));

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
    onAddAgentPrompt: vi.fn(() => Promise.resolve(true)),
    onAddAgentTo: vi.fn(),
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

describe("agents and teams (UI-P69)", () => {
  it("names the steps in an agent's output uses in its header, and leaves the phrase out when it has none", () => {
    const base = sandboxListProps("bakery");
    const agent = base.steps.find((step) => step.id === "a5")!;
    expect(madeIn(agent, base.steps)).toEqual([]);
    expect(madeIn({ uses: [{ kind: "output", node_id: "p1" }, { kind: "file", node_id: "f1" }, { kind: "output", node_id: "p2" }] }, base.steps)).toEqual(["1", "2"]);
    expect(madeIn({ uses: [{ kind: "output", node_id: "gone" }] }, base.steps)).toEqual([]);

    const withUses = { ...agent, uses: [{ kind: "output" as const, node_id: "p1" }, { kind: "output" as const, node_id: "p2" }] };
    list({ steps: base.steps.map((step) => (step.id === "a5" ? withUses : step)) });
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Agent · made in prompts 1 and 2 · Opus 5.5");
  });

  it("draws an agent without 'made in' when it uses no step", () => {
    list();
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Agent · Opus 5.5");
  });

  it("shows an agent's instructions first, and adds a prompt to it from a ghost row", async () => {
    const props = list();
    const card = screen.getByRole("group", { name: /^Agent 5:/ });
    expect(within(card).getByText("Check the menu and reply with any item that has no price.")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Add a prompt to this agent" }));
    const field = screen.getByLabelText("Add a prompt to agent 5") as HTMLTextAreaElement;
    // No tool or model chips: the agent's model applies.
    expect(within(screen.getByTestId("agent-prompt-field")).queryByText("model")).toBeNull();
    expect(screen.getByTestId("agent-prompt-field").textContent).not.toMatch(/pick a tool/);
    fireEvent.change(field, { target: { value: "Also flag items over ten pounds." } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(props.onAddAgentPrompt).toHaveBeenCalledWith("a5", "Also flag items over ten pounds."));
    await waitFor(() => expect(screen.queryByTestId("agent-prompt-field")).toBeNull());
  });

  it("keeps the field open when the prompt was not saved, and closes it on Esc", async () => {
    const props = list({ onAddAgentPrompt: vi.fn(() => Promise.resolve(false)) });
    fireEvent.click(screen.getByRole("button", { name: "Add a prompt to this agent" }));
    const field = screen.getByLabelText("Add a prompt to agent 5");
    fireEvent.change(field, { target: { value: "Try this" } });
    fireEvent.keyDown(field, { key: "Enter" });
    await waitFor(() => expect(props.onAddAgentPrompt).toHaveBeenCalled());
    expect(screen.getByTestId("agent-prompt-field")).toBeTruthy();
    fireEvent.keyDown(field, { key: "Escape" });
    expect(screen.queryByTestId("agent-prompt-field")).toBeNull();
  });

  it("draws a team's agents as inner cards headed 'Agent · {title} · {model}' with a runs chip", () => {
    const { list: props } = sandboxTeamFixture();
    list({ ...props });
    const card = screen.getByRole("group", { name: /^Team 3:/ });
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Team · made in prompt 2");
    const inner = within(card).getAllByTestId("inner-card");
    expect(inner).toHaveLength(4);
    expect(inner[1].textContent).toContain("Agent · Writer · Opus 5.5");
    expect(inner[1].textContent).toContain("Runs several at once · 3");
    expect(inner[2].textContent).toContain("Repeats until a condition is met · approved");
  });

  it("adds an agent to a team from a ghost row", () => {
    const { list: props } = sandboxTeamFixture();
    const onAddAgentTo = vi.fn();
    list({ ...props, onAddAgentTo });
    fireEvent.click(screen.getByRole("button", { name: "Add an agent to this team" }));
    expect(onAddAgentTo).toHaveBeenCalledWith("t3");
  });

  it("offers 'Show its 2 prompts' only on an agent that has prompts of its own, and opens one agent's at a time", () => {
    const { list: props } = sandboxTeamFixture();
    // Give the researcher prompts of its own as well.
    const steps = props.steps.map((step) =>
      step.id !== "t3"
        ? step
        : {
            ...step,
            children: step.children.map((child) =>
              child.id === "t3a"
                ? { ...child, children: [{ ...child.children[0] ?? child, id: "t3a:instructions", number: "3.1.1", defaultTitle: "Instructions", children: [] }, { ...child, id: "t3a-p2", kind: "prompt" as const, number: "3.1.2", text: "Cite where each came from.", children: [] }] }
                : child,
            ),
          },
    );
    list({ ...props, steps });
    expect(screen.getAllByRole("button", { name: /^Show its/ }).map((el) => el.textContent)).toEqual(["Show its prompt", "Show its 2 prompts"]);
    expect(screen.queryAllByTestId("inner-prompt")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Show its 2 prompts" }));
    expect(screen.getAllByTestId("inner-prompt").map((el) => el.textContent)).toEqual([expect.stringContaining("Keep every section under sixty words."), expect.stringContaining("Finish with one clear way to order.")]);

    fireEvent.click(screen.getByRole("button", { name: "Show its prompt" }));
    // Opening the other closes the first.
    expect(screen.getAllByTestId("inner-prompt")).toHaveLength(1);
    expect(screen.getByTestId("inner-prompt").textContent).toContain("Cite where each came from.");
    expect(screen.getByRole("button", { name: "Hide its prompt" })).toBeTruthy();
  });
});

describe("a manual step (UI-P70)", () => {
  // The fixture's own handlers are no-ops; `list` supplies the spies.
  const manualList = (over: Partial<BuildListProps> = {}) => {
    const { onSelect, onRename, onMove, onRemove, onAccept, onDismiss, onAddPrompt, ...rest } = sandboxManualFixture().list;
    void [onSelect, onRename, onMove, onRemove, onAccept, onDismiss, onAddPrompt];
    return list({ ...rest, ...over });
  };
  const card = () => screen.getByRole("group", { name: /^Manual step 3:/ });

  it("is its own kind of card, headed 'Manual step · {tool} · added by maker'", () => {
    manualList();
    // The colours resolve in a browser, not here: the tier-3 spec reads them.
    expect(card().getAttribute("data-kind")).toBe("manual");
    expect(screen.getByTestId("manual-eyebrow").textContent).toBe("Manual step · Figma · added by maker");
    expect(within(card()).getByRole("heading", { level: 3 }).textContent).toBe("Manual step 3");
    expect(within(card()).getByRole("heading", { level: 3 }).getAttribute("data-default-title")).toBe("true");
  });

  it("shows its line unclamped, its Uses chips, and '1 screenshot' with a thumbnail", () => {
    manualList();
    const line = within(card()).getByText(/Laid out the hero/);
    expect(line.getAttribute("style")).not.toMatch(/line-clamp/);
    expect(within(card()).getByText("Output of 2 · Prompt 2")).toBeTruthy();
    expect(within(card()).getByText("1 screenshot")).toBeTruthy();
  });

  it("has no screenshot line when it has no picture", () => {
    const fixture = sandboxManualFixture().list;
    manualList({ steps: fixture.steps.map((step) => (step.id === "m3" ? { ...step, mediaId: null } : step)) });
    expect(within(card()).queryByText("1 screenshot")).toBeNull();
  });

  it("has Rename, Move up, Move down and Remove, and no 'Read all of it'", async () => {
    const props = manualList();
    fireEvent.keyDown(screen.getByRole("button", { name: "Manual step 3 options" }), { key: "Enter" });
    expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Rename", "Move up", "Move down", "Remove"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Move up" }));
    expect(props.onMove).toHaveBeenCalledWith("m3", -1);
  });

  it("removes, and cannot move up from the first step or down from the last", async () => {
    const props = manualList();
    fireEvent.keyDown(screen.getByRole("button", { name: "Manual step 3 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove" }));
    expect(props.onRemove).toHaveBeenCalledWith("m3");
    cleanup();
    const fixture = sandboxManualFixture().list;
    const only = fixture.steps.filter((step) => step.id === "m3");
    list({ steps: only, dividers: new Map(), intoResult: new Set(), selectedId: null });
    fireEvent.keyDown(screen.getByRole("button", { name: "Manual step 3 options" }), { key: "Enter" });
    expect((await screen.findByRole("menuitem", { name: "Move up" })).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("menuitem", { name: "Move down" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("renames in place: Enter saves", async () => {
    const props = manualList();
    fireEvent.keyDown(screen.getByRole("button", { name: "Manual step 3 options" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const field = await screen.findByLabelText("Title of manual step 3");
    fireEvent.change(field, { target: { value: "Hero in Figma" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onRename).toHaveBeenCalledWith("m3", "Hero in Figma");
  });

  it("takes the next number: the prompt after it shows as 4 and uses its output", () => {
    manualList();
    expect(screen.getByRole("group", { name: /^Prompt 4:/ })).toBeTruthy();
    expect(within(screen.getByRole("group", { name: /^Prompt 4:/ })).getByText("Output of 3 · Manual step 3")).toBeTruthy();
  });
});
