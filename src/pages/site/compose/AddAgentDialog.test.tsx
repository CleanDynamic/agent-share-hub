import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddAgentDialog, AGENT_DIALOG_COPY, DEFAULT_AGENT_MODEL, type AddAgentDialogProps } from "./AddAgentDialog";
import { withHarness } from "./AgentSetupFields";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: phone && /max-width/.test(query),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(over: Partial<AddAgentDialogProps> = {}) {
  const props: AddAgentDialogProps = { open: true, onOpenChange: vi.fn(), nextNumber: 4, teamsAvailable: true, onAdd: vi.fn(), ...over };
  render(<AddAgentDialog {...props} />);
  return props;
}

/** CA-03: a row's role is a menu: open it and read its choices. The menu stays open for a pick. */
function roleChoices(name: string): (string | null)[] {
  fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  return screen.getAllByRole("menuitemradio").map((item) => item.textContent);
}

describe("the Add dialog", () => {
  it("is a dialog with a real radio group: one agent, or a team of agents, one agent chosen to start", () => {
    open();
    expect(screen.getByRole("dialog", { name: AGENT_DIALOG_COPY.title })).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "What to add" });
    expect(group).toBeTruthy();
    // CA-03: the segmented radio group, as the List and Map switch is drawn: its radios say which is chosen.
    const one = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.one) });
    const team = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) });
    expect(one.getAttribute("aria-checked")).toBe("true");
    expect(team.getAttribute("aria-checked")).toBe("false");
  });

  it("is 420 wide", () => {
    open();
    expect(screen.getByTestId("add-agent-dialog").style.width).toBe("420px");
  });

  it("puts the default title in the name's placeholder, and saves an empty name as null", () => {
    const props = open();
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.placeholder).toBe("Agent 4");
    expect(name.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: DEFAULT_AGENT_MODEL, harness: null, tools: [] });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("trims the name and passes the chosen model", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Order checker " } });
    fireEvent.keyDown(screen.getByRole("button", { name: `model ${DEFAULT_AGENT_MODEL}` }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: "Order checker", model: "Opus 5.5", harness: null, tools: [] });
  });

  it("changes the placeholder to Team {n} for a team, and is titled for the agent that leads it", () => {
    const props = open();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).placeholder).toBe("Team 4");
    expect(screen.getByRole("dialog", { name: "The agent that leads the team" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "team", name: null, model: DEFAULT_AGENT_MODEL, harness: null, tools: [] });
  });

  it("disables the team and says why while the team type is not live", () => {
    open({ teamsAvailable: false });
    const team = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }) as HTMLInputElement;
    expect(team.disabled).toBe(true);
    expect(screen.getByText("Teams need the Deploy queue item from UI-P61.")).toBeTruthy();
  });

  it("closes on Cancel without adding", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is a bottom sheet on a phone, with 44-tall buttons", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-agent-dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("draws nothing while closed", () => {
    open({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("what the agent runs in, its models and its tools (CA-02 P5)", () => {
  const pickHarness = (query: string, row: string | RegExp) => {
    fireEvent.click(screen.getByRole("button", { name: "Runs in" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: query } });
    fireEvent.click(screen.getByRole("option", { name: row }));
  };
  const openModel = (name: string | RegExp) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });

  it("has no default for Runs in (it asks), and an unchosen harness takes any model", () => {
    open();
    const runsIn = screen.getByRole("button", { name: "Runs in" });
    expect(runsIn.textContent).toBe("Pick a tool");
    openModel(`model ${DEFAULT_AGENT_MODEL}`);
    expect(screen.getByRole("menuitem", { name: "Other model…" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: "Grok 4.7" })).toBeTruthy();
  });

  it("offers a fixed harness's models, and keeps one it offers when it is chosen", () => {
    const props = open();
    pickHarness("claude code", "Claude Code");
    openModel(`model ${DEFAULT_AGENT_MODEL}`);
    expect(screen.queryByRole("menuitemradio", { name: "Grok 4.7" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Fable 5.1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: "Fable 5.1", harness: "claude-code", tools: [] });
  });

  it("clears a model the harness does not offer and waits for one to be picked", () => {
    const props = open();
    pickHarness("codex", "Codex");
    expect(screen.getByTestId("agent-model-cleared").textContent).toBe(`Codex doesn't offer ${DEFAULT_AGENT_MODEL}. Model cleared.`);
    const add = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    openModel("model");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "GPT-6.1 Sol" }));
    fireEvent.click(add);
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ model: "GPT-6.1 Sol", harness: "codex" }));
  });

  it("shows a hidden harness's note and saves its own name as the model", () => {
    const props = open();
    pickHarness("manus", "Manus");
    expect(screen.getByText("Manus picks its own model")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^model/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a model" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: "Manus", harness: "manus", tools: [] });
  });

  it("adds models with roles from the harness, at most four, the first always main", () => {
    const props = open();
    pickHarness("claude code", "Claude Code");
    openModel(`model ${DEFAULT_AGENT_MODEL}`);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Fable 5.1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    expect(roleChoices("Role of model 2")).toEqual(["plans", "acts", "other"]);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "acts" }));
    expect(screen.getByRole("button", { name: "Role of model 2" }).textContent).toBe("acts");
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
    openModel("model 2");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Sonnet 5.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    expect(screen.getAllByTestId("agent-model-row")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Add a model" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove model 4" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove model 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({
      kind: "agent",
      name: null,
      model: "Fable 5.1",
      models: [
        { model: "Fable 5.1", role: "main" },
        { model: "Sonnet 5.5", role: "acts" },
      ],
      harness: "claude-code",
      tools: [],
    });
  });

  it("offers the default roles without a harness", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    expect(roleChoices("Role of model 2")).toEqual(["plans", "acts", "reviews", "other"]);
  });

  it("keeps one row for a harness that names tiers, and clears a model that is not one", () => {
    // No harness in the registry has tiers today (v0 and Bolt are not agents); the rule still holds for one.
    const start = { harness: null, models: [{ model: "Opus 5.5", role: "main" }, { model: "Haiku 5.5", role: "plans" }], tools: [] };
    const { value, cleared } = withHarness(start, "v0");
    expect(value.models).toEqual([{ model: null, role: "main" }]);
    expect(cleared).toBe("v0 doesn't offer Opus 5.5. Model cleared.");
  });

  it("lists the tools it can use as removable chips", () => {
    const props = open();
    const pickTool = (query: string, row: string | RegExp) => {
      fireEvent.click(screen.getByRole("button", { name: "Tools it can use" }));
      fireEvent.change(screen.getByRole("combobox", { name: "Find an app" }), { target: { value: query } });
      fireEvent.click(screen.getByRole("option", { name: row }));
    };
    pickTool("gmail", "Gmail");
    pickTool("vercel", "Vercel");
    pickTool("gmail", "Gmail");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Gmail", "Vercel"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Vercel" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ tools: ["gmail"] }));
  });

  it("opens with Add as an agent's tool and text", () => {
    const props = open({ seed: { harness: "hermes-agent", instructions: "Triage my inbox" } });
    expect(screen.getByRole("button", { name: "Runs in" }).textContent).toBe("Hermes Agent");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: DEFAULT_AGENT_MODEL, harness: "hermes-agent", tools: [], instructions: "Triage my inbox" });
  });

  it("works the same in the bottom sheet on a phone", () => {
    phone = true;
    const props = open();
    pickHarness("manus", "Manus");
    expect(screen.getByText("Manus picks its own model")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ model: "Manus", harness: "manus" }));
  });
});

describe("what it remembers (CA-03 P6)", () => {
  it("sits under Tools it can use: optional, one row growing to three, up to 200 characters", () => {
    open();
    const field = screen.getByLabelText("What it remembers") as HTMLTextAreaElement;
    expect(field.placeholder).toBe("Which dishes it featured, in a notes file it keeps");
    expect(field.maxLength).toBe(200);
    expect(field.rows).toBe(1);
    fireEvent.change(field, { target: { value: "x".repeat(120) } });
    expect(field.rows).toBe(3);
    const tools = screen.getByRole("group", { name: "Tools it can use" });
    expect(tools.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is saved with the agent when it says something, and left out when it is empty", () => {
    const props = open();
    const field = screen.getByLabelText("What it remembers");
    fireEvent.change(field, { target: { value: "  which page sections it already reviewed " } });
    fireEvent.blur(field);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ memory: "which page sections it already reviewed" }));
    cleanup();
    const again = open();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(vi.mocked(again.onAdd).mock.calls[0][0]).not.toHaveProperty("memory");
  });
});


describe("CA-12 P11: the dialog's order and what it asks", () => {
  it("asks in this order: Name, Instructions, Models, Tools it can use, How does it start?, Runs in, What it remembers", () => {
    open();
    const labels = ["Name", "Instructions", "Models", "Tools it can use", "How does it start?", "Runs in", "What it remembers"];
    const at = labels.map((label) => {
      const node = screen.getAllByText(label).find((el) => el.tagName === "LABEL" || el.tagName === "SPAN");
      return node as HTMLElement;
    });
    for (let i = 1; i < at.length; i += 1) expect(at[i - 1].compareDocumentPosition(at[i]) & Node.DOCUMENT_POSITION_FOLLOWING, labels[i]).toBeTruthy();
  });

  it("Instructions is the largest field, 6 lines, asking what the agent is told to do", () => {
    open();
    const box = screen.getByPlaceholderText("What this agent is told to do") as HTMLTextAreaElement;
    expect(box.rows).toBe(6);
  });

  it("hands back the instructions and how it starts, and Not sure leaves Runs in empty", () => {
    const props = open();
    fireEvent.change(screen.getByPlaceholderText("What this agent is told to do"), { target: { value: "Triage my inbox" } });
    fireEvent.click(screen.getByRole("radio", { name: "On a schedule" }));
    fireEvent.change(screen.getByLabelText("When, in a few words"), { target: { value: "Mondays 07:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Runs in" }));
    fireEvent.click(screen.getByRole("option", { name: "Not sure" }));
    expect(screen.getByRole("button", { name: "Runs in" }).textContent).toBe("Not sure");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ instructions: "Triage my inbox", harness: null, runs: { how: "schedule", detail: "Mondays 07:00" } }));
  });

  it("an agent that starts when asked has no runs", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(vi.mocked(props.onAdd).mock.calls[0][0]).not.toHaveProperty("runs");
  });
});

describe("CA-13 · Deep Agents and helpers in the Add dialog", () => {
  it("offers the Runtime models and services subcategory first under Runs in, with Deep Agents and LangGraph in Agent frameworks", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Runs in" }));
    const rows = screen.getAllByRole("option").map((row) => row.textContent ?? "");
    expect(screen.getByText("Runtime models and services")).toBeTruthy();
    // "Not sure", then the subcategory's own rows before any other tool.
    expect(rows.slice(0, 3)).toEqual(["Not sure", "TypeSafe Jev", "ScaleDown Summarize"]);
    expect(screen.getAllByText("Agent frameworks").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LangChain Deep Agents").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LangGraph").length).toBeGreaterThan(0);
  });

  it("asks for Helpers it used on an agent, and hands the helpers back", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Add a helper" }));
    fireEvent.change(screen.getByLabelText("When the history reaches"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Add this helper" }));
    fireEvent.click(screen.getByRole("button", { name: "Runs in" }));
    fireEvent.click(screen.getByRole("option", { name: /Not sure/ }));
    fireEvent.click(screen.getByRole("button", { name: AGENT_DIALOG_COPY.add }));
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].helpers).toEqual([{ provider: "scaledown", job: "summarize", trigger: { at: 0.8 } }]);
  });
});
