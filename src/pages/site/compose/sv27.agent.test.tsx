// SV-27 Part 5: the agent and team fields. Framework, compatible models, model routing, How did it run?'s background and ongoing
// with channels, approvals, sandbox, roles, the handoff and group chat patterns, tool permissions and the Deployment line.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { agentFieldsOf, agentFieldsRefusal, approvalsPatch, compatibleLine } from "@/lib/build/agentFields";
import { deploymentLineOf, deploymentLineText, deploymentTilesOf, refOf } from "@/lib/build/deployment";
import { duplicateTiles } from "@/lib/build/duplicate";
import { buildSteps, parseRuns, runsLabel } from "@/lib/build/graph";
import { sandboxShown } from "@/lib/build/harnessFacts";
import { AGENT_PATTERN_LABEL, AGENT_PATTERN_LINE, AGENT_PATTERNS, cleanExtras, patternOf } from "@/lib/build/tileExtras";
import type { BuildSnapshot } from "@/lib/build/buildSnapshot";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { deriveClassification } from "@/lib/classify/derive";

import { AgentRuntimeFields, DeploymentLine } from "./AgentRuntimeFields";
import { RUNS_CHOICES, RUNS_HELP } from "./detailsModel";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const node = (id: string, position: number, type: string, payload: Record<string, unknown>, parent: string | null = null): NodeTree =>
  ({ id, build_id: "b1", type, title: null, note: null, payload, position, parent_id: parent, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as unknown as NodeTree;

const fields = (props: Partial<Parameters<typeof AgentRuntimeFields>[0]> = {}) => {
  const onExtras = vi.fn();
  render(<AgentRuntimeFields id="a1" kind="agent" phone={false} fields={{}} harness={null} tools={[]} inTeam={false} deployment={[]} onExtras={onExtras} {...props} />);
  return onExtras;
};
const choose = (menu: string, option: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: menu }), { key: "Enter" });
  fireEvent.click(screen.getByRole("menuitemradio", { name: option }));
};
const type = (name: string, value: string) => {
  const field = screen.getByRole("textbox", { name });
  fireEvent.change(field, { target: { value } });
  fireEvent.keyDown(field, { key: "Enter" });
};

describe("Framework", () => {
  it("shows only for an agent built in code, and saves", () => {
    const onExtras = fields({ harness: null, builtInCode: true });
    choose("Framework", "LangGraph");
    expect(onExtras).toHaveBeenCalledWith("a1", { framework: "langgraph" });
    expect(screen.getByText("A harness runs an agent for you. A framework is a library you build one with.")).toBeTruthy();
    cleanup();
    fields({ harness: "openclaw" });
    expect(screen.queryByRole("button", { name: "Framework" })).toBeNull();
    expect(cleanExtras("agent_config", { framework: "langgraph" })).toEqual({ framework: "langgraph" });
  });
});

describe("Model routing", () => {
  it("saves each mode; a router requires a router", () => {
    expect(cleanExtras("agent_config", { model_routing: { mode: "fixed" } })).toEqual({ model_routing: null });
    expect(cleanExtras("agent_config", { model_routing: { mode: "maker_switches", rule: "cheapest open model that week" } })).toEqual({ model_routing: { mode: "maker_switches", rule: "cheapest open model that week" } });
    expect(cleanExtras("agent_config", { model_routing: { mode: "router", router: "openrouter", rule: "cheapest" } })).toEqual({ model_routing: { mode: "router", router: "openrouter", rule: "cheapest" } });
    expect(() => cleanExtras("agent_config", { model_routing: { mode: "router" } })).toThrow("Name the router");
    expect(() => cleanExtras("agent_config", { model_routing: { mode: "maker_switches", rule: "x".repeat(121) } })).toThrow("120");
  });

  it("asks for the router before it writes", () => {
    const onExtras = fields();
    choose("Model routing", "Chosen by a router");
    expect(onExtras).not.toHaveBeenCalled();
    type("Router", "openrouter");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { model_routing: { mode: "router", router: "openrouter" } });
  });
});

describe("Compatible models", () => {
  it("save and show with their label, never as a result", () => {
    const onExtras = fields();
    fireEvent.click(screen.getByRole("button", { name: "Add compatible models" }));
    type("Add compatible models", "GPT, Gemini");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { compatible_models: ["GPT", "Gemini"] });
    expect(compatibleLine(["GPT", "Gemini"])).toBe("The maker says it also works with: GPT, Gemini");
    expect(() => cleanExtras("agent_config", { compatible_models: Array.from({ length: 9 }, (_, at) => `m${at}`) })).toThrow("8 max");
  });

  it("are ignored by Classification", () => {
    const plain = [node("a1", 1, "agent_config", { system_prompt: "You help.", model: "opus-5-5" })];
    const claimed = [node("a1", 1, "agent_config", { system_prompt: "You help.", model: "opus-5-5", compatible_models: ["gpt-6-1-sol", "gemini-3-8-flash"] })];
    expect(deriveClassification(buildSteps(claimed), { tree: claimed }).derived).toEqual(deriveClassification(buildSteps(plain), { tree: plain }).derived);
  });
});

describe("How did it run?", () => {
  it("offers background and ongoing under More ways it ran", () => {
    expect(RUNS_CHOICES.find((choice) => choice.how === "background")).toMatchObject({ label: "All the time, as a background service", more: true });
    expect(RUNS_CHOICES.find((choice) => choice.how === "ongoing")).toMatchObject({ label: "Keeps working on an ongoing goal", more: true });
    expect(RUNS_HELP.notRunsWhen).toBe("Runs when decides which branch runs. How did it run? says what starts the agent.");
  });

  it("reads background and ongoing with their details, and older values as before", () => {
    expect(parseRuns({ how: "background", detail: "messages on Telegram", channels: ["c1"] })).toEqual({ how: "background", detail: "messages on Telegram", channels: ["c1"] });
    expect(parseRuns({ how: "ongoing", detail: "Keep my launch on track" })).toEqual({ how: "ongoing", detail: "Keep my launch on track" });
    expect(parseRuns({ how: "schedule", detail: "Weekdays 07:30" })).toEqual({ how: "schedule", detail: "Weekdays 07:30" });
    expect(parseRuns({ how: "goal" })).toEqual({ how: "goal" });
    // Channels only where a message can start it.
    expect(parseRuns({ how: "schedule", channels: ["c1"] })).toEqual({ how: "schedule" });
    expect(runsLabel({ how: "background", detail: "messages on Telegram" })).toBe("All the time, as a background service · messages on Telegram");
    expect(runsLabel({ how: "ongoing", detail: "Keep my launch on track" })).toBe("Keeps working on an ongoing goal · Keep my launch on track");
  });

  it("keeps a channel by node id, rewritten through Duplicate", () => {
    const rows = [node("a1", 0, "agent_config", { runs: { how: "event", detail: "a message", channels: ["c1"] } }), node("c1", 1, "channel", { provider: "telegram", starts_runs: true })] as unknown as BuildNode[];
    let n = 0;
    const { snapshot, ids } = duplicateTiles({ nodes: rows } as unknown as BuildSnapshot, ["a1", "c1"], () => `copy-${(n += 1)}`);
    const agent = snapshot.nodes.find((row) => row.id === ids[0]) as BuildNode;
    expect((agent.payload as { runs: { channels: string[] } }).runs.channels).toEqual([ids[1]]);
  });
});

describe("Approvals", () => {
  it("saves each mode; reviewer asks for a model; Not said stores nothing", () => {
    for (const mode of ["full", "risky", "every", "reviewer"] as const) expect(cleanExtras("agent_config", approvalsPatch(mode, "haiku-5-5"))).toEqual({ approval_mode: mode, reviewer_model: mode === "reviewer" ? "haiku-5-5" : null });
    expect(cleanExtras("agent_config", approvalsPatch(null))).toEqual({ approval_mode: null, reviewer_model: null });
    const onExtras = fields();
    choose("Approvals", "AI reviewer, then asks you when unsure");
    expect(screen.getByRole("textbox", { name: "Reviewer model" })).toBeTruthy();
    type("Reviewer model", "Haiku 5.5");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { reviewer_model: "Haiku 5.5" });
    choose("Approvals", "Not said");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { approval_mode: null, reviewer_model: null });
  });
});

describe("Sandbox", () => {
  it("saves each choice", () => {
    for (const sandbox of ["none", "container", "vm", "vendor"]) expect(cleanExtras("agent_config", { sandbox })).toEqual({ sandbox });
    const onExtras = fields();
    choose("Sandbox", "Container");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { sandbox: "container" });
  });

  it("shows the maker's choice first, and nothing for a harness with no facts", () => {
    expect(sandboxShown("container", "openclaw")).toBe("container");
    expect(sandboxShown(undefined, "claude-code")).toBeUndefined();
  });
});

describe("Roles in a team", () => {
  it("save on an agent inside a team and not on a lone agent", () => {
    expect(agentFieldsRefusal({ type: "agent_config", parent_id: "t1" }, { role: "Researcher" })).toBeNull();
    expect(agentFieldsRefusal({ type: "agent_config", parent_id: null }, { role: "Researcher" })).toBe("Only an agent in a team has a role.");
    expect(agentFieldsOf({ role: "Researcher" }).role).toBe("Researcher");
    const onExtras = fields({ inTeam: true });
    type("Role", "Researcher");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { role: "Researcher" });
    cleanup();
    fields({ inTeam: false });
    expect(screen.queryByRole("textbox", { name: "Role" })).toBeNull();
  });
});

describe("Team patterns", () => {
  it("save handoff and group", () => {
    expect(AGENT_PATTERNS).toEqual(["sequential", "lead", "parallel", "review", "handoff", "group"]);
    expect(cleanExtras("team", { pattern: "handoff" })).toEqual({ pattern: "handoff" });
    expect(cleanExtras("team", { pattern: "group" })).toEqual({ pattern: "group" });
    expect(patternOf("swarm")).toBeNull();
    expect(AGENT_PATTERN_LABEL.handoff).toBe("Agents hand off to each other");
    expect(AGENT_PATTERN_LINE.handoff).toBe("LangGraph calls this a swarm.");
    expect(AGENT_PATTERN_LABEL.group).toBe("Agents talk in one group chat");
  });
});

describe("Tool permissions", () => {
  it("save per chip", () => {
    const onExtras = fields({ tools: ["slack", "gmail"] });
    choose("Permission for Slack", "Read and write");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { tool_permissions: { slack: "write" } });
    choose("Permission for Gmail", "Read only");
    expect(onExtras).toHaveBeenLastCalledWith("a1", { tool_permissions: { slack: "write", gmail: "read" } });
    expect(cleanExtras("agent_config", { tool_permissions: { slack: "write", github: "nope" } })).toEqual({ tool_permissions: { slack: "write" } });
  });
});

describe("The Deployment line", () => {
  const tree = [
    node("a1", 0, "agent_config", {}),
    node("h1", 1, "host", { machine: "mini PC", name: "Mac Mini", agent: "a1" }),
    node("m1", 2, "memory", { provider: "Letta", agent: "a1" }),
    node("c1", 3, "channel", { provider: "Telegram", agent: "a1", starts_runs: true }),
    node("c2", 4, "channel", { provider: "WhatsApp", agent: "a1", starts_runs: true }),
    node("v1", 5, "voice", { provider: "elevenlabs", agent: "a1", mode: "tts" }),
    node("f1", 6, "live_app", { front_end_of: "a1", built_with: "Claude Design", connects: [{ to: refOf("a1"), label: "sends to" }] }),
  ];

  it("reads 'Mac Mini · Letta · Telegram, WhatsApp · ElevenLabs · Front end'", () => {
    expect(deploymentLineText(deploymentLineOf(deploymentTilesOf(tree), "a1"))).toBe("Mac Mini · Letta · Telegram, WhatsApp · ElevenLabs · Front end");
  });

  it("opens the right tile", () => {
    const onOpen = vi.fn();
    render(<DeploymentLine entries={deploymentLineOf(deploymentTilesOf(tree), "a1")} phone={false} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: "Open WhatsApp" }));
    expect(onOpen).toHaveBeenCalledWith("c2");
  });

  it("offers Add deployment when the agent has none", () => {
    const onAdd = vi.fn();
    render(<DeploymentLine entries={[]} phone={false} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Add deployment" }));
    expect(onAdd).toHaveBeenCalled();
  });
});
