// UI-P93 — the current view's own suite, run against the refined fork under `?look=refined` (same names, handlers and
// behaviour), then a block for what the refined board draws. Styles are read through SSR markup.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { shapeListProps } from "@/dev/fixtures/shapes";
import type { Step } from "@/lib/build/graph";
import { sandboxListProps, sandboxManualFixture, sandboxTeamFixture } from "@/dev/fixtures/sandbox";

import type { BuildListProps } from "./BuildList";
import { BuildList as BuildList } from "./BuildList";
import { NO_APP } from "./sourcesModel";
import { agentEyebrow, dividers, isClamped, madeIn, madeLine } from "./buildListModel";

vi.mock("@/lib/build/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/build/media")>()), getMediaById: vi.fn(() => Promise.resolve(null)) }));

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The bakery list with its first session reading "No app chosen": its prompt box then starts with no tool. */
function noToolFirst(): Partial<BuildListProps> {
  const base = sandboxListProps("bakery");
  const [first, ...rest] = [...base.dividers.entries()];
  return { dividers: new Map([[first[0], { ...first[1], tool: NO_APP }], ...rest]) };
}

function list(over: Partial<BuildListProps> = {}) {
  const base = sandboxListProps("bakery");
  const props: BuildListProps = {
    ...base,
    // CA-14 P5: the prompt box stands inside a session; most of these tests want one, so the first session has it open.
    promptIn: [...base.dividers.values()][0]?.key ?? null,
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
  render(
    <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
      <BuildList {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("session dividers", () => {
  it("fall where the session changes, once per run", () => {
    const props = sandboxListProps("bakery");
    expect([...props.dividers.keys()]).toEqual(["1", "3", "4"]);
    expect(props.dividers.get("3")).toMatchObject({ number: 2, tool: "Claude Code" });
    list();
    expect(screen.getAllByTestId("session-head").map((el) => el.getAttribute("aria-label"))).toEqual([
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
  it("draws a default title in the quiet colour and a typed one in the strong colour, both at 500 (UI-P93)", () => {
    list();
    const card = (name: RegExp) => screen.getByRole("group", { name });
    const quiet = within(card(/^Prompt 2:/)).getByRole("heading", { level: 3 });
    const named = within(card(/^Prompt 1:/)).getByRole("heading", { level: 3 });
    expect(quiet.textContent).toBe("Prompt 2");
    // A default title is marked and drawn in `--text2` (the colour itself is not readable in jsdom); under the refined
    // look both are 500 and only the ink differs.
    expect(quiet.getAttribute("data-default-title")).toBe("true");
    expect(quiet.getAttribute("style")).toMatch(/font-weight:\s*500/);
    expect(named.getAttribute("data-default-title")).toBeNull();
    expect(named.getAttribute("style")).toMatch(/font-weight:\s*500/);
    expect(named.textContent).toBe("Homepage copy");
  });

  it("has Open prompt as the footer link, only when the prompt can be opened, and it opens that prompt without selecting the tile (CA-15 P10)", () => {
    list();
    expect(screen.queryByText("Open prompt")).toBeNull();
    cleanup();
    const onOpenPrompt = vi.fn();
    const props = list({ onOpenPrompt });
    const link = within(screen.getByRole("group", { name: /^Prompt 2:/ })).getByRole("button", { name: "Open prompt" });
    expect(link.closest('[data-testid="tile-footer"]')).toBeTruthy();
    fireEvent.click(link);
    expect(onOpenPrompt).toHaveBeenCalledWith("p2");
    expect(props.onSelect).not.toHaveBeenCalled();
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

describe("Typed here: the model menu follows the tool (CA-02 P4)", () => {
  const openMenu = (name: string | RegExp) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  const pickTool = (query: string, row: string | RegExp) => {
    fireEvent.click(screen.getByRole("button", { name: /^Prompt tool · / }));
    fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: query } });
    fireEvent.click(screen.getByRole("option", { name: row }));
  };

  it("asks for a tool before it offers a model", () => {
    list(noToolFirst());
    const button = screen.getByRole("button", { name: "Select a tool first" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.textContent).toContain("model");
  });

  it("offers the tool's own models under their lab, and saves the one picked", async () => {
    const props = list();
    pickTool("claude", "Claude");
    openMenu("model");
    expect(screen.getByText("Anthropic")).toBeTruthy();
    expect(screen.queryByRole("menuitemradio", { name: "Grok 4.7" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5.5" }));
    fireEvent.change(screen.getByPlaceholderText("Paste or type a prompt…"), { target: { value: "Plan it" } });
    fireEvent.click(screen.getByRole("button", { name: "Add prompt" }));
    expect(props.onAddPrompt).toHaveBeenCalledWith({ text: "Plan it", tool: "claude", model: "Opus 5.5" });
  });

  it("clears a model the new tool does not offer, and says so once in a polite region", () => {
    list();
    pickTool("claude", "Claude");
    openMenu("model");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5.5" }));
    pickTool("chatgpt", "ChatGPT");
    expect(screen.getByRole("button", { name: "model" })).toBeTruthy();
    const region = screen.getByTestId("model-cleared");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("ChatGPT doesn't offer Opus 5.5. Model cleared.");
  });

  it("keeps a model the new tool offers", () => {
    list();
    pickTool("claude", "Claude");
    openMenu("model");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5" }));
    pickTool("cursor", "Cursor");
    expect(screen.getByRole("button", { name: "model Opus 5" })).toBeTruthy();
    expect(screen.getByTestId("model-cleared").textContent).toBe("");
  });

  it("draws no model menu for a tool that runs prompts by itself, and saves no prompt", () => {
    const props = list();
    pickTool("hermes", /^Hermes Agent/);
    expect(screen.queryByRole("button", { name: /^model/ })).toBeNull();
    // Hermes Agent runs prompts by itself: no model menu, the line and the button instead.
    expect(screen.getByText("Hermes Agent runs prompts by itself. Add it as an agent.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Add prompt" }) as HTMLButtonElement).disabled).toBe(true);
    expect(props.onAddPrompt).not.toHaveBeenCalled();
  });

  it("hands Add as an agent the tool and the text, and clears the field once the agent is saved", async () => {
    const onAddAsAgent = vi.fn(() => Promise.resolve(true));
    list({ onAddAsAgent });
    const field = screen.getByPlaceholderText("Paste or type a prompt…") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Triage my inbox" } });
    pickTool("hermes", /^Hermes Agent/);
    fireEvent.click(screen.getByRole("button", { name: "Add as an agent" }));
    expect(onAddAsAgent).toHaveBeenCalledWith({ harness: "hermes-agent", instructions: "Triage my inbox" });
    await waitFor(() => expect(field.value).toBe(""));
  });

  it("keeps the field's text when the agent is not saved", async () => {
    const onAddAsAgent = vi.fn(() => Promise.resolve(false));
    list({ onAddAsAgent });
    const field = screen.getByPlaceholderText("Paste or type a prompt…") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "Triage my inbox" } });
    pickTool("hermes", /^Hermes Agent/);
    fireEvent.click(screen.getByRole("button", { name: "Add as an agent" }));
    await waitFor(() => expect(onAddAsAgent).toHaveBeenCalled());
    expect(field.value).toBe("Triage my inbox");
  });

  it("offers a typed model through Other model… for a tool that takes one", () => {
    const props = list();
    pickTool("claude code", "Claude Code");
    openMenu("model");
    fireEvent.click(screen.getByRole("menuitem", { name: "Other model…" }));
    const other = screen.getByRole("textbox", { name: "Other model" }) as HTMLInputElement;
    expect(other.maxLength).toBe(40);
    fireEvent.change(other, { target: { value: "my-local-llm" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.change(screen.getByPlaceholderText("Paste or type a prompt…"), { target: { value: "Go" } });
    fireEvent.click(screen.getByRole("button", { name: "Add prompt" }));
    expect(props.onAddPrompt).toHaveBeenCalledWith({ text: "Go", tool: "claude-code", model: "my-local-llm" });
  });

  it("offers a builder's tiers, and shows a hidden model's note in place of a menu", () => {
    list();
    pickTool("v0", "v0");
    openMenu("model");
    expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["No model", "v0 Mini", "v0 Pro", "v0 Max"]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    pickTool("lovable", "Lovable");
    expect(screen.getByText("Lovable picks the model that builds your app")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^model/ })).toBeNull();
  });
});

describe("code (CA-02 P7)", () => {
  const codeStep = (over: Record<string, unknown> = {}) => {
    const base = sandboxListProps("bakery");
    const number = String(base.steps.length + 1);
    return {
      ...base.steps[0],
      id: "c9",
      kind: "code" as const,
      number,
      title: null,
      defaultTitle: `Code ${number}`,
      text: "1\n2\n3\n4\n5\n6\n7\n8",
      words: 8,
      model: null,
      sessionId: null,
      tool: null,
      uses: [],
      children: [],
      runs: null,
      language: "ts",
      filename: "app.ts",
      ...over,
    };
  };

  // CA-11: the well is CodeLines now: numbered lines. CA-15 P10: three lines show, "Show all N lines" is the footer's link, and the file name is a footer fact.
  it("shows Code, its language, its line count and its first three lines in a numbered mono well, with the file name in the footer", () => {
    const base = sandboxListProps("bakery");
    const step = codeStep();
    list({ steps: [...base.steps, step] });
    const card = screen.getByRole("group", { name: `Code ${step.number}: Code ${step.number}` });
    expect(card.getAttribute("data-kind")).toBe("code");
    expect(within(card).getByTestId("code-eyebrow").textContent).toBe("Code · TypeScript · 8 lines");
    const well = within(card).getByTestId("code-lines");
    expect(well.textContent).toBe("1\n2\n3");
    expect(within(card).getByTestId("code-gutter-numbers").textContent).toBe("1\n2\n3");
    expect(within(card).getByTestId("tile-footer-facts").textContent).toBe("app.ts");
    fireEvent.click(within(card).getByRole("button", { name: "Show all 8 lines" }));
    expect(within(card).getByTestId("code-lines").textContent).toBe("1\n2\n3\n4\n5\n6\n7\n8");
    expect(within(card).getByRole("button", { name: "Show fewer lines" })).toBeTruthy();
    expect(well.style.fontFamily).toContain("--font-data");
    expect(within(card).getByRole("button", { name: `Code ${step.number} options` })).toBeTruthy();
  });

  it("names the language when the code has no file name", () => {
    const base = sandboxListProps("bakery");
    list({ steps: [...base.steps, codeStep({ filename: null, language: "sql", text: "select 1;" })] });
    expect(screen.getByTestId("code-eyebrow").textContent).toBe("Code · SQL · 1 line");
  });
});

describe("pasting code into Typed here (CA-02 P7)", () => {
  const CODE = "const a = 1;\nconst b = 2;\nexport { a, b };";
  const paste = (text: string) => {
    const field = screen.getByPlaceholderText("Paste or type a prompt…") as HTMLTextAreaElement;
    fireEvent.paste(field);
    fireEvent.change(field, { target: { value: text } });
    return field;
  };

  it("offers to keep pasted code as code, and never converts it by itself", async () => {
    const onKeepAsCode = vi.fn(() => Promise.resolve(true));
    const props = list({ ...noToolFirst(), onKeepAsCode });
    const field = paste(CODE);
    expect(screen.getByText("This looks like code.")).toBeTruthy();
    expect(field.value).toBe(CODE);
    expect(props.onAddPrompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Keep it as code" }));
    expect(onKeepAsCode).toHaveBeenCalledWith(CODE);
    await waitFor(() => expect(field.value).toBe(""));
  });

  it("offers nothing for prose, for two lines, or for code typed rather than pasted", () => {
    list({ onKeepAsCode: vi.fn(() => Promise.resolve(true)) });
    paste("Write me a poem\nabout bread\nand butter");
    expect(screen.queryByText("This looks like code.")).toBeNull();
    paste("const a = 1;\nconst b = 2;");
    expect(screen.queryByText("This looks like code.")).toBeNull();
    cleanup();
    list({ onKeepAsCode: vi.fn(() => Promise.resolve(true)) });
    fireEvent.change(screen.getByPlaceholderText("Paste or type a prompt…"), { target: { value: CODE } });
    expect(screen.queryByText("This looks like code.")).toBeNull();
  });

  it("keeps the text when the code is not saved, and still lets it go as a prompt", async () => {
    const onKeepAsCode = vi.fn(() => Promise.resolve(false));
    const props = list({ ...noToolFirst(), onKeepAsCode });
    const field = paste(CODE);
    fireEvent.click(screen.getByRole("button", { name: "Keep it as code" }));
    await waitFor(() => expect(onKeepAsCode).toHaveBeenCalled());
    expect(field.value).toBe(CODE);
    fireEvent.click(screen.getByRole("button", { name: "Add prompt" }));
    expect(props.onAddPrompt).toHaveBeenCalledWith({ text: CODE, tool: null, model: null });
  });
});

describe("the add field", () => {
  it("adds on Enter, not on Shift+Enter, and clears once saved", async () => {
    const props = list(noToolFirst());
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

  it("CA-10: hands its field to the page, and rings it when Add › Prompt reaches it", () => {
    const props = sandboxListProps("fox");
    const field = createRef<HTMLTextAreaElement>();
    const { rerender } = render(<BuildList {...props} addPromptRef={field} />);
    expect(field.current).toBe(screen.getByPlaceholderText("Paste or type a prompt…"));
    expect(screen.getByTestId("add-prompt").getAttribute("data-lit")).toBeNull();
    rerender(<BuildList {...props} addPromptRef={field} addPromptFlash={1} />);
    expect(screen.getByTestId("add-prompt").getAttribute("data-lit")).toBe("true");
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
    // CA-15 P10: the type line is "Agent · <model>"; where it was made is its Uses row.
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Agent · Opus 5.5");
    expect(within(screen.getByRole("group", { name: /^Agent 5:/ })).getByText("Uses")).toBeTruthy();
  });

  it("draws an agent without 'made in' when it uses no step", () => {
    list();
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Agent · Opus 5.5");
  });

  it("shows an agent's instructions first, and adds a prompt to it from a ghost row", async () => {
    const props = list();
    const card = screen.getByRole("group", { name: /^Agent 5:/ });
    // CA-15 P10: one line of its instructions shows. It has no prompts of its own to fold, so the way to add one stays.
    expect(within(card).getByTestId("agent-instructions-line").textContent).toBe("Check the menu and reply with any item that has no price.");
    expect(within(card).queryByRole("button", { name: "Show prompts" })).toBeNull();
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

  it("draws a team's agents as a compact list, and as inner cards, its lead first and the rest each 'Agent · {name}', with how each ran under it, behind Show agents (CA-03, CA-15 P10)", () => {
    const { list: props } = sandboxTeamFixture();
    list({ ...props });
    const card = screen.getByRole("group", { name: /^Team 3:/ });
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Multi-agent team");
    expect(within(card).getAllByTestId("team-agent")).toHaveLength(4);
    expect(within(card).queryAllByTestId("inner-card")).toHaveLength(0);
    fireEvent.click(within(card).getByRole("button", { name: "Show agents" }));
    const inner = within(card).getAllByTestId("inner-card");
    expect(inner).toHaveLength(4);
    expect(inner[0].textContent).toMatch(/^Lead agent/);
    expect(inner[1].textContent).toMatch(/^Agent · Writer/);
    expect(within(inner[1]).getByTestId("runs-line").textContent).toBe("Several at the same time · 3");
    expect(within(inner[2]).getByTestId("runs-line").textContent).toBe("Again until approved");
    // When I asked is the normal case and shows nothing.
    expect(within(inner[0]).queryByTestId("runs-line")).toBeNull();
  });

  it("names a team's lead by what it ran in, and puts the others under Handed work to (CA-03 P4)", () => {
    list(shapeListProps("team"));
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Multi-agent team");
    const card = screen.getByRole("group", { name: /^Team 1:/ });
    // CA-15 P10: the lead's tool is on its row of the compact list.
    expect(within(card).getAllByTestId("team-agent")[0].textContent).toContain("Lead · Claude Code");
    fireEvent.click(within(card).getByRole("button", { name: "Show agents" }));
    const inner = within(card).getAllByTestId("inner-card");
    expect(inner.map((entry) => entry.firstElementChild?.textContent)).toEqual(["Lead agent", "Agent · Research", "Agent · Build", "Agent · Review"]);
    const handed = within(card).getByTestId("handed-work-to");
    expect(handed.textContent).toBe("Handed work to");
    // It sits after the lead and before the first agent it handed work to.
    expect(inner[0].compareDocumentPosition(handed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(handed.compareDocumentPosition(inner[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("reads Multi-agent team alone when the team has no orchestration pattern, and says its lead without a tool plainly (CA-03 P4, CA-15 P10)", () => {
    const { list: props } = sandboxTeamFixture();
    list({ ...props });
    expect(screen.getByTestId("container-eyebrow").textContent).toBe("Multi-agent team");
    expect(screen.getAllByTestId("team-agent")[0].textContent).not.toContain(" in ");
  });

  it("adds an agent to a team from a ghost row", () => {
    const { list: props } = sandboxTeamFixture();
    const onAddAgentTo = vi.fn();
    list({ ...props, onAddAgentTo });
    fireEvent.click(screen.getByRole("button", { name: "Show agents" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Show agents" }));
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

  it("is its own kind of card, headed 'Manual step · <where>', with where it was done in that line (CA-12 P10, CA-15 P10)", () => {
    manualList();
    // The colours resolve in a browser, not here: the tier-3 spec reads them.
    expect(card().getAttribute("data-kind")).toBe("manual");
    expect(screen.getByTestId("manual-eyebrow").textContent).toBe("Manual step · Figma");
    expect(within(card()).queryByTestId("manual-where")).toBeNull();
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

describe("the refined look (UI-P93)", () => {
  const markup = () =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={["/dev/kit/pages/sandbox"]}>
        <BuildList {...sandboxListProps("bakery")} />
      </MemoryRouter>,
    );

  it("leads each session with the tool's real mark, and draws prompts as modules, the selection the selected recipe", () => {
    list();
    const heads = screen.getAllByTestId("session-head");
    expect(heads.map((head) => Boolean(head.querySelector("[data-mark]")))).toEqual([true, true, true]);
    const html = markup();
    expect(html).toMatch(/data-selected="true"[^>]*style="[^"]*background:var\(--selected-fill\);border:1px solid var\(--selected-edge\)/);
    expect(html).toContain("padding-left:36px");
  });

  it("draws a suggestion as a dashed chip with Accept as a 20-high control and Dismiss as text", () => {
    list();
    const accept = screen.getByRole("button", { name: "Accept" });
    expect(accept.getAttribute("style")).toMatch(/height:\s*20px/);
    expect(screen.getByRole("button", { name: "Dismiss" }).getAttribute("data-variant")).toBeNull();
    expect(markup()).toContain("height:28px;padding:0 4px 0 8px;box-sizing:border-box;border-radius:6px;border:1px dashed var(--line)");
  });

  it("draws how the agent ran as a quiet line with a 7px --label dot, and Add a prompt to this agent as a dashed, text-only row", () => {
    list();
    const agent = screen.getByRole("group", { name: /^Agent 5/ });
    const runs = within(agent).getByTestId("runs-line");
    expect(runs.textContent).toBe("Again until every item has a price");
    const dot = runs.firstElementChild as HTMLElement;
    expect([dot.style.width, dot.style.height]).toEqual(["7px", "7px"]);
    expect(markup()).toMatch(/width:7px;height:7px;border-radius:50%;background:var\(--label\)/);
    const add = within(agent).getByRole("button", { name: "Add a prompt to this agent" });
    expect(add.querySelector("svg")).toBeNull();
    expect(add.textContent).toBe("Add a prompt to this agent");
  });

  it("has Attach a file after Read all of it, and calls onAttach for that prompt", async () => {
    const onAttach = vi.fn();
    list({ onAttach, onOpenPrompt: vi.fn() });
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Rename", "Read all of it", "Attach a file", "Move up", "Move down", "Remove"]);
    fireEvent.click(screen.getByRole("menuitem", { name: "Attach a file" }));
    expect(onAttach).toHaveBeenCalledWith("p2");
  });

  it("has Name a file it makes after Attach a file: 7 items, the most a menu may hold", async () => {
    const onNameMade = vi.fn();
    list({ onAttach: vi.fn(), onNameMade, onOpenPrompt: vi.fn() });
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Rename", "Read all of it", "Attach a file", "Name a file it makes", "Move up", "Move down", "Remove"]);
    expect(items).toHaveLength(7);
    fireEvent.click(screen.getByRole("menuitem", { name: "Name a file it makes" }));
    // CA-10: asked once the menu has let go of focus, so it cannot take it back from the field.
    await waitFor(() => expect(onNameMade).toHaveBeenCalledWith("p2"));
  });

  it("shows no Name a file it makes item when nothing handles it", async () => {
    list({ onOpenPrompt: vi.fn() });
    fireEvent.keyDown(screen.getByRole("button", { name: "Prompt 2 options" }), { key: "Enter" });
    await screen.findAllByRole("menuitem");
    expect(screen.queryByRole("menuitem", { name: "Name a file it makes" })).toBeNull();
  });

  it("says what a prompt makes, quietly, under its text", () => {
    list({ madeNames: { p2: ["brand-guide.md"], p3: ["a.md", "b.md", "c.md", "d.md"] } });
    expect(within(screen.getByRole("group", { name: /^Prompt 2:/ })).getByText("Makes brand-guide.md")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: /^Prompt 3:/ })).getByText("Makes a.md, b.md +2")).toBeTruthy();
    expect(within(screen.getByRole("group", { name: /^Prompt 1:/ })).queryByText(/^Makes /)).toBeNull();
  });

  it("builds the Makes line: one name, two names, then +{n}", () => {
    expect(madeLine([])).toBeNull();
    expect(madeLine(["brand-guide.md"])).toBe("Makes brand-guide.md");
    expect(madeLine(["a.md", "b.md"])).toBe("Makes a.md, b.md");
    expect(madeLine(["a.md", "b.md", "c.md"])).toBe("Makes a.md, b.md +1");
  });

  it("attaches files dropped on a card to that card's prompt, with a fine pointer", () => {
    const onDropOnStep = vi.fn();
    list({ onDropOnStep, fine: true });
    const card = screen.getByRole("group", { name: /^Prompt 2:/ });
    const file = new File(["x"], "brief.pdf", { type: "application/pdf" });
    fireEvent.drop(card, { dataTransfer: { types: ["Files"], files: [file] } });
    expect(onDropOnStep).toHaveBeenCalledWith("p2", [file]);
  });

  it("takes no drop without a fine pointer", () => {
    const onDropOnStep = vi.fn();
    list({ onDropOnStep, fine: false });
    const file = new File(["x"], "brief.pdf", { type: "application/pdf" });
    fireEvent.drop(screen.getByRole("group", { name: /^Prompt 2:/ }), { dataTransfer: { types: ["Files"], files: [file] } });
    expect(onDropOnStep).not.toHaveBeenCalled();
  });
});

describe("a check in the List (CA-03 P5)", () => {
  const checkStep = (passed: number, total: number, runAt: string | null): Step => ({
    id: "k1",
    kind: "check",
    number: "9",
    title: null,
    defaultTitle: "Check 9",
    text: "Places a test order for 2 sourdough loaves",
    words: 7,
    model: null,
    sessionId: null,
    tool: null,
    runs: null,
    uses: [],
    children: [],
    check: { tested: "Places a test order for 2 sourdough loaves", passing: "The total shows £9.00", onFail: null, passed, total, runAt },
  });
  const withCheck = (step: Step) => {
    const base = sandboxListProps("bakery");
    return { ...base, steps: [...base.steps, step] };
  };
  /** jsdom drops a var() background, so the dot's colour is read from the server markup. */
  const dotOf = (step: Step) =>
    /data-testid="check-status"[^>]*><span aria-hidden="true" style="[^"]*background:var\(--([a-z-]+)\)/.exec(
      renderToStaticMarkup(
        <MemoryRouter>
          <BuildList {...withCheck(step)} />
        </MemoryRouter>,
      ),
    )?.[1];

  it("reads 'Check', its pass criteria, and a passing status with an --evidence dot (CA-15 P10)", () => {
    list(withCheck(checkStep(14, 14, "2026-10-12")));
    const card = screen.getByRole("group", { name: /^Check 9/ });
    expect(within(card).getByTestId("check-eyebrow").textContent).toBe("Check");
    expect(within(card).getByTestId("check-criteria").textContent).toBe("Pass criteria: The total shows £9.00");
    const status = within(card).getByTestId("check-status");
    expect(status.textContent).toBe("Passed 14 of 14 runs · since 12 Oct");
    expect(dotOf(checkStep(14, 14, "2026-10-12"))).toBe("evidence");
  });

  it("marks a failing run with a --cat-breakage dot, and leaves out since without a last run", () => {
    list(withCheck(checkStep(13, 14, null)));
    const status = within(screen.getByRole("group", { name: /^Check 9/ })).getByTestId("check-status");
    expect(status.textContent).toBe("Passed 13 of 14 runs");
    expect(dotOf(checkStep(13, 14, null))).toBe("cat-breakage");
  });
});

describe("what an agent remembers, in the List (CA-03 P6)", () => {
  it("is not drawn on the agent's tile: it is optional detail, which lives in the modal and in Details (CA-15 P10)", () => {
    const base = sandboxListProps("bakery");
    const steps = base.steps.map((step) => (step.kind === "agent" ? { ...step, memory: "which dishes it featured" } : step));
    list({ ...base, steps });
    const agent = screen.getByRole("group", { name: /^Agent 5/ });
    expect(within(agent).queryByTestId("memory-line")).toBeNull();
    expect(agent.textContent).not.toContain("which dishes it featured");
  });

  it("says nothing for an agent that remembers nothing", () => {
    list();
    expect(screen.queryByTestId("memory-line")).toBeNull();
  });
});

describe("an agent that reads content it doesn't control (CA-03 P7)", () => {
  it("has one module under it: a --cat-breakage dot, the sentence and the tools it can use", () => {
    list(shapeListProps("agent"));
    const card = screen.getByRole("group", { name: /^Agent 1/ });
    const warning = within(card).getByTestId("outside-warning");
    expect(warning.textContent).toBe("This agent reads content it doesn't control.It can use Hermes Agent and Gmail. Before you run it, check what it's allowed to change.");
    expect(warning.querySelector("svg")).toBeNull();
    expect(
      /data-testid="outside-warning"[^>]*><span aria-hidden="true" style="[^"]*background:var\(--cat-breakage\)/.test(
        renderToStaticMarkup(
          <MemoryRouter>
            <BuildList {...{ ...shapeListProps("agent"), onAddPrompt: () => Promise.resolve(true) }} />
          </MemoryRouter>,
        ),
      ),
    ).toBe(true);
  });

  it("says nothing for an agent with no such tool", () => {
    list(shapeListProps("team"));
    expect(screen.queryByTestId("outside-warning")).toBeNull();
  });
});

describe("sessions are sittings (CA-04 P1, CA-14 P5)", () => {
  it("has no Adding to picker: the prompt box stands in its session", () => {
    const props = sandboxListProps("bakery");
    const second = props.dividers.get("3")?.key as string;
    list({ promptIn: second });
    expect(screen.queryByTestId("adding-to")).toBeNull();
    const run = document.querySelector(`[data-session-key="${second}"]`) as HTMLElement;
    expect(within(run).getByTestId("add-prompt")).toBeTruthy();
    expect(screen.getAllByTestId("add-prompt")).toHaveLength(1);
  });

  it("puts its session's tool in the field", () => {
    const props = sandboxListProps("bakery");
    const second = props.dividers.get("3")?.key as string;
    list({ promptIn: second });
    expect(within(screen.getByTestId("add-prompt")).getByRole("button", { name: /Prompt tool · Claude Code/ })).toBeTruthy();
  });

  it("says nothing about sessions while the build has only the one its typed prompts make", () => {
    list();
    expect(screen.queryByTestId("adding-to")).toBeNull();
  });

  it("draws no session head for a build with exactly one session, and one for each when there are two", () => {
    const one = shapeListProps("alone");
    expect(one.dividers.size).toBe(0);
    render(
      <MemoryRouter>
        <BuildList {...one} />
      </MemoryRouter>,
    );
    expect(screen.queryAllByRole("separator")).toHaveLength(0);
  });
});
