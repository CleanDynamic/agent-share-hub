import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AddAgentDialog, AGENT_DIALOG_COPY, DEFAULT_AGENT_MODEL, START_CHOICES, type AddAgentDialogProps } from "./AddAgentDialog";
import { withHarness } from "./AgentSetupFields";
import { fieldNames, fieldNamed } from "./optionalKit";

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

const rowOf = (name: string) => fieldNamed(name);
const openRow = (name: string) => void fieldNamed(name);
const names = () => fieldNames();
const add = () => screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
const status = () => screen.getByTestId("modal-status").textContent;

/** CA-03: a row's role is a menu: open it and read its choices. The menu stays open for a pick. */
function roleChoices(name: string): (string | null)[] {
  fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
  return screen.getAllByRole("menuitemradio").map((item) => item.textContent);
}

describe("the Add dialog", () => {
  it("is the shared frame with a real radio group: a single agent, or a multi-agent team, a single agent chosen to start", () => {
    open();
    expect(screen.getByRole("dialog", { name: "Add an agent" })).toBeTruthy();
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("Autonomous model with instructions and tools");
    expect(screen.getByRole("radiogroup", { name: "Type" })).toBeTruthy();
    const one = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.one) });
    const team = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) });
    expect(AGENT_DIALOG_COPY.one).toBe("Single agent");
    expect(AGENT_DIALOG_COPY.team).toBe("Multi-agent team");
    expect(one.getAttribute("aria-checked")).toBe("true");
    expect(team.getAttribute("aria-checked")).toBe("false");
    expect(document.body.textContent).not.toMatch(/One agent|A team of agents|Add an agent or a team/);
  });

  it("is 560 wide", () => {
    open();
    expect(screen.getByTestId("add-agent-dialog").style.width).toBe("560px");
  });

  it("shows Name and Models up front and keeps everything else in Optional, closed, in order, ten fields for a team and nine for a single agent", () => {
    open();
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Models" })).toBeTruthy();
    expect(screen.getByTestId("optional-count").textContent).toBe("9 fields");
    expect(screen.getByTestId("optional-toggle").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("System instructions")).toBeNull();
    expect(names()).toEqual(["System instructions", "Available tools", "Trigger", "Harness", "Memory", "Helpers", "Limits", "Output and destination", "Sample run"]);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    expect(names().at(-1)).toBe("Orchestration pattern");
    expect(screen.getByTestId("optional-count").textContent).toBe("10 fields");
  });

  it("puts the default title in the name's placeholder, and saves an empty name as null, with Add ready on the default model", () => {
    const props = open();
    const name = screen.getByLabelText("Name") as HTMLInputElement;
    expect(name.placeholder).toBe("Agent 4");
    expect(name.value).toBe("");
    expect(status()).toBe("Required fields complete");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: DEFAULT_AGENT_MODEL, harness: null, tools: [] });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("trims the name and passes the chosen model", () => {
    const props = open();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  Order checker " } });
    fireEvent.keyDown(screen.getByRole("button", { name: `model ${DEFAULT_AGENT_MODEL}` }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Opus 5.5" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: "Order checker", model: "Opus 5.5", harness: null, tools: [] });
  });

  it("changes the placeholder to Team {n} for a team, and is titled for the agent that leads it", () => {
    const props = open();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).placeholder).toBe("Team 4");
    expect(screen.getByRole("dialog", { name: "The agent that leads the team" })).toBeTruthy();
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "team", name: null, model: DEFAULT_AGENT_MODEL, harness: null, tools: [] });
  });

  it("disables the team and says why while the team type is not live", () => {
    open({ teamsAvailable: false });
    const team = screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }) as HTMLInputElement;
    expect(team.disabled).toBe(true);
    expect(screen.getByText("Not available yet")).toBeTruthy();
  });

  it("closes on Cancel without adding", () => {
    const props = open();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    open();
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.queryByTestId("add-agent-dialog")).toBeNull();
    expect(add()).toBeTruthy();
  });

  it("draws nothing while closed", () => {
    open({ open: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the host platform, its models and its tools (CA-02 P5)", () => {
  const pickHarness = (query: string, row: string | RegExp) => {
    openRow("Harness");
    fireEvent.click((screen.getAllByRole("button", { name: "Harness" }).at(-1) as HTMLElement));
    fireEvent.change(screen.getByRole("combobox", { name: "Find a tool" }), { target: { value: query } });
    fireEvent.click(screen.getByRole("option", { name: row }));
  };
  const openModel = (name: string | RegExp) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });

  it("has no default for Harness (it asks), and an unchosen host takes any model", () => {
    open();
    openRow("Harness");
    expect((screen.getAllByRole("button", { name: "Harness" }).at(-1) as HTMLElement).textContent).toBe("Select a harness");
    openModel(`model ${DEFAULT_AGENT_MODEL}`);
    expect(screen.getByRole("menuitem", { name: "Other model…" })).toBeTruthy();
    expect(screen.getByRole("menuitemradio", { name: "Grok 4.7" })).toBeTruthy();
  });

  it("offers a fixed host's models, and keeps one it offers when it is chosen", () => {
    const props = open();
    pickHarness("claude code", "Claude Code");
    openModel(`model ${DEFAULT_AGENT_MODEL}`);
    expect(screen.queryByRole("menuitemradio", { name: "Grok 4.7" })).toBeNull();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Fable 5.1" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: "Fable 5.1", harness: "claude-code", tools: [] });
  });

  it("clears a model the host does not offer and waits for one to be picked, saying what is required", () => {
    const props = open();
    pickHarness("codex", "Codex");
    expect(screen.getByTestId("agent-model-cleared").textContent).toBe(`${DEFAULT_AGENT_MODEL} not on Codex. Cleared.`);
    expect(add().disabled).toBe(true);
    expect(status()).toBe("Required: Models");
    openModel("model");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "GPT-6.1 Sol" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ model: "GPT-6.1 Sol", harness: "codex" }));
  });

  it("shows a hidden host's note and saves its own name as the model", () => {
    const props = open();
    pickHarness("manus", "Manus");
    expect(screen.getByText("Manus picks its own model")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^model/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a model" })).toBeNull();
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: "Manus", harness: "manus", tools: [] });
  });

  it("adds models with roles from the host, at most four, the first always Primary", () => {
    const props = open();
    pickHarness("claude code", "Claude Code");
    openModel(`model ${DEFAULT_AGENT_MODEL}`);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Fable 5.1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    expect(screen.getByTestId("agent-model-main").textContent).toBe("Primary");
    expect(roleChoices("Role of model 2")).toEqual(["plans", "acts", "other"]);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "acts" }));
    expect(screen.getByRole("button", { name: "Role of model 2" }).textContent).toBe("acts");
    expect(add().disabled).toBe(true);
    openModel("model 2");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Sonnet 5.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    expect(screen.getAllByTestId("agent-model-row")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Add a model" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove model 4" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove model 3" }));
    fireEvent.click(add());
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

  it("offers the default roles without a host", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add a model" }));
    expect(roleChoices("Role of model 2")).toEqual(["plans", "acts", "reviews", "other"]);
  });

  it("keeps one row for a host that names tiers, and clears a model that is not one", () => {
    // No host in the registry has tiers today (v0 and Bolt are not agents); the rule still holds for one.
    const start = { harness: null, models: [{ model: "Opus 5.5", role: "main" }, { model: "Haiku 5.5", role: "plans" }], tools: [] };
    const { value, cleared } = withHarness(start, "v0");
    expect(value.models).toEqual([{ model: null, role: "main" }]);
    expect(cleared).toBe("Opus 5.5 not on v0. Cleared.");
  });

  it("lists the available tools as removable chips", () => {
    const props = open();
    openRow("Available tools");
    const pickTool = (query: string, row: string | RegExp) => {
      fireEvent.click(screen.getByRole("button", { name: "Available tools" }));
      fireEvent.change(screen.getByRole("combobox", { name: "Find an app" }), { target: { value: query } });
      fireEvent.click(screen.getByRole("option", { name: row }));
    };
    pickTool("gmail", "Gmail");
    pickTool("vercel", "Vercel");
    pickTool("gmail", "Gmail");
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Gmail", "Vercel"]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Vercel" }));
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ tools: ["gmail"] }));
  });

  it("opens with Add as an agent's tool and text, the instructions held in their Optional row", () => {
    const props = open({ seed: { harness: "hermes-agent", instructions: "Triage my inbox" } });
    expect(screen.getByTestId("optional-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(rowOf("Harness").textContent).toContain("Hermes Agent");
    expect((within(rowOf("System instructions")).getByRole("textbox") as HTMLTextAreaElement).value).toBe("Triage my inbox");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({ kind: "agent", name: null, model: DEFAULT_AGENT_MODEL, harness: "hermes-agent", tools: [], instructions: "Triage my inbox" });
  });

  it("works the same in the bottom sheet on a phone", () => {
    phone = true;
    const props = open();
    pickHarness("manus", "Manus");
    expect(screen.getByText("Manus picks its own model")).toBeTruthy();
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ model: "Manus", harness: "manus" }));
  });
});

describe("memory (CA-03 P6)", () => {
  it("is optional: one field, up to 200 characters (CA-15b: the board's one line)", () => {
    open();
    openRow("Memory");
    const field = screen.getByLabelText("Memory") as HTMLInputElement;
    expect(field.tagName).toBe("INPUT");
    expect(field.placeholder).toBe("Dishes already featured, stored in a notes file");
    expect(field.maxLength).toBe(200);
  });

  it("is saved with the agent when it says something, and left out when it is empty", () => {
    const props = open();
    openRow("Memory");
    const field = screen.getByLabelText("Memory");
    fireEvent.change(field, { target: { value: "  which page sections it already reviewed " } });
    fireEvent.blur(field);
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ memory: "which page sections it already reviewed" }));
    cleanup();
    const again = open();
    fireEvent.click(add());
    expect(vi.mocked(again.onAdd).mock.calls[0][0]).not.toHaveProperty("memory");
  });
});

describe("the trigger and the system instructions (CA-12 P11, CA-15 P7)", () => {
  it("reads Manual, Scheduled and Event", () => {
    expect(START_CHOICES.map((choice) => choice.label)).toEqual(["Manual", "Scheduled", "Event"]);
    open();
    openRow("Trigger");
    expect(within(screen.getByRole("radiogroup", { name: "Trigger" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Manual", "Scheduled", "Event"]);
  });

  it("System instructions is the largest field, 4 lines, asking what the agent is told to do", () => {
    open();
    openRow("System instructions");
    const box = (screen.getAllByLabelText("System instructions").at(-1) as HTMLElement) as HTMLTextAreaElement;
    expect(box.rows).toBe(4);
    expect(box.placeholder).not.toMatch(/^e\.g\./);
  });

  it("hands back the instructions and a schedule, and Built in code leaves the harness empty", () => {
    const props = open();
    openRow("System instructions");
    fireEvent.change((screen.getAllByLabelText("System instructions").at(-1) as HTMLElement), { target: { value: "Triage my inbox" } });
    openRow("Trigger");
    fireEvent.click(screen.getByRole("radio", { name: "Scheduled" }));
    fireEvent.change(screen.getByLabelText("Schedule"), { target: { value: "Mondays 07:00" } });
    openRow("Harness");
    fireEvent.click((screen.getAllByRole("button", { name: "Harness" }).at(-1) as HTMLElement));
    fireEvent.click(screen.getByRole("option", { name: "Built in code (no harness)" }));
    expect((screen.getAllByRole("button", { name: "Harness" }).at(-1) as HTMLElement).textContent).toBe("Built in code (no harness)");
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ instructions: "Triage my inbox", harness: null, runs: { how: "schedule", detail: "Mondays 07:00" } }));
  });

  it("an event trigger asks for the triggering event, and is stored as an event", () => {
    const props = open();
    openRow("Trigger");
    expect(screen.queryByLabelText("Triggering event")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Event" }));
    fireEvent.change(screen.getByLabelText("Triggering event"), { target: { value: " A new email arrives " } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith(expect.objectContaining({ runs: { how: "event", detail: "A new email arrives" } }));
  });

  it("an agent that is triggered manually has no runs", () => {
    const props = open();
    fireEvent.click(add());
    expect(vi.mocked(props.onAdd).mock.calls[0][0]).not.toHaveProperty("runs");
  });
});

describe("limits, output, sample run and orchestration pattern (CA-15 P7)", () => {
  it("hands back the limits one per line, the output, a trace link and a pasted transcript", () => {
    const props = open();
    openRow("Limits");
    fireEvent.change(screen.getByLabelText("Limits"), { target: { value: "Never sends email without approval\n\n Stops after 20 steps " } });
    openRow("Output and destination");
    fireEvent.change(screen.getByLabelText("Output and destination"), { target: { value: " A weekly summary in Slack " } });
    openRow("Sample run");
    fireEvent.change(screen.getByLabelText("Trace link"), { target: { value: "https://smith.langchain.com/o/x/runs/1" } });
    fireEvent.change(screen.getByLabelText("Sample transcript"), { target: { value: "User: hi\nAgent: hello" } });
    fireEvent.click(add());
    expect(props.onAdd).toHaveBeenCalledWith({
      kind: "agent",
      name: null,
      model: DEFAULT_AGENT_MODEL,
      harness: null,
      tools: [],
      limits: ["Never sends email without approval", "Stops after 20 steps"],
      output: "A weekly summary in Slack",
      sample: "User: hi\nAgent: hello",
      traceUrl: "https://smith.langchain.com/o/x/runs/1",
    });
  });

  it("refuses a trace link that is not https, in plain words, and adds nothing", () => {
    const props = open();
    openRow("Sample run");
    fireEvent.change(screen.getByLabelText("Trace link"), { target: { value: "http://example.com/run" } });
    fireEvent.click(add());
    expect(screen.getByRole("alert").textContent).toBe("A trace link starts with https://.");
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it("shows the orchestration pattern only for a team, with six choices, and never hands one back for a single agent", () => {
    const props = open();
    expect(screen.queryByText("Orchestration pattern")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    openRow("Orchestration pattern");
    const grid = screen.getByRole("group", { name: "Orchestration pattern" });
    expect(within(grid).getAllByRole("button").map((button) => button.textContent)).toEqual(["Sequential", "Lead with delegates", "Parallel then merged", "Writer and reviewer", "Agents hand off to each other", "Agents talk in one group chat"]);
    fireEvent.click(within(grid).getByRole("button", { name: "Parallel then merged" }));
    expect(within(grid).getByRole("button", { name: "Parallel then merged" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.one) }));
    fireEvent.click(add());
    expect(vi.mocked(props.onAdd).mock.calls[0][0]).not.toHaveProperty("pattern");
    cleanup();
    const team = open();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    openRow("Orchestration pattern");
    fireEvent.click(within(screen.getByRole("group", { name: "Orchestration pattern" })).getByRole("button", { name: "Writer and reviewer" }));
    fireEvent.click(add());
    expect(vi.mocked(team.onAdd).mock.calls[0][0]).toMatchObject({ kind: "team", pattern: "review" });
  });
});

describe("CA-13 · Deep Agents and supporting models in the Add dialog", () => {
  it("offers the Runtime models and services subcategory first under Harness, with Deep Agents and LangGraph in Agent frameworks", () => {
    open();
    openRow("Harness");
    fireEvent.click((screen.getAllByRole("button", { name: "Harness" }).at(-1) as HTMLElement));
    const rows = screen.getAllByRole("option").map((row) => row.textContent ?? "");
    expect(screen.getByText("Runtime models and services")).toBeTruthy();
    // "Built in code (no harness)", then the subcategory's own rows before any other tool.
    expect(rows.slice(0, 3)).toEqual(["Built in code (no harness)", "TypeSafe Jev", "ScaleDown Summarize"]);
    expect(screen.getAllByText("Agent frameworks").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LangChain Deep Agents").length).toBeGreaterThan(0);
    expect(screen.getAllByText("LangGraph").length).toBeGreaterThan(0);
  });

  it("asks for Supporting models, and hands them back", () => {
    const props = open();
    openRow("Helpers");
    fireEvent.click(screen.getByRole("button", { name: "Add a helper" }));
    fireEvent.change(screen.getByLabelText("When the history reaches"), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Add helper" }));
    expect(within(rowOf("Helpers")).getAllByTestId("optional-line")).toHaveLength(1);
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0].helpers).toEqual([{ provider: "scaledown", job: "summarize", trigger: { at: 0.8 } }]);
  });

  it("a team's supporting models go with it, for the agent that leads it", () => {
    const props = open();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(AGENT_DIALOG_COPY.team) }));
    openRow("Helpers");
    fireEvent.click(screen.getByRole("button", { name: "Add a helper" }));
    fireEvent.click(screen.getByRole("button", { name: "Add helper" }));
    fireEvent.click(add());
    expect((props.onAdd as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({ kind: "team", helpers: [{ provider: "scaledown", job: "summarize" }] });
  });
});
