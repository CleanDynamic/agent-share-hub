// SV-27 Part 6: setup that belongs to an agent, context file templates and skill origins.

import { describe, expect, it } from "vitest";

import { methodOf } from "./forkRules";
import { buildSteps } from "./graph";
import { readerSetup, type ReaderSetupItem } from "./readerSteps";
import {
  agentSetupItemsOf,
  fillTemplate,
  isSetupPayload,
  movedSetupPayload,
  setupItemsOf,
  skillOriginLine,
  templateFrom,
  withSkillOrigin,
  withTemplate,
} from "./setup";
import { installLine, setupFolder } from "./setupFolder";
import type { NodeTree } from "./types";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>): NodeTree =>
  ({ id, build_id: "b1", type, title: null, note: null, payload, position, parent_id: null, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }) as unknown as NodeTree;

const TREE = [
  node("p1", 0, "prompt", { text: "Plan", session: "s1" }),
  node("a1", 1, "agent_config", { harness: "openclaw", session: "s1" }),
  node("i1", 2, "document", { title: "CLAUDE.md", url: "https://files.example/claude.md", setup: { session: "s1", kind: "instructions" } }),
  node("i2", 3, "document", { title: "AGENTS.md", url: "https://files.example/agents.md", setup: { agent: "a1", kind: "instructions" } }),
  node("k1", 4, "document", { title: "inbox-zero", setup: { agent: "a1", kind: "skill" }, skill: { name: "inbox-zero" }, origin: "agent", url: "https://files.example/skill.md" }),
  node("k2", 5, "document", { title: "email-triage", setup: { agent: "a1", kind: "skill" }, skill: { name: "email-triage" }, origin: "registry", registry: "ClawHub", skill_name: "email-triage" }),
  node("g1", 6, "integration", { service: "gmail", setup: { agent: "a1", kind: "server" }, server: { type: "stdio", command: "npx", args: ["gmail-mcp"], env: { GMAIL_TOKEN: "${GMAIL_TOKEN}" } } }),
];

const load = async () => new TextEncoder().encode("file");
const names = (entries: { path: string }[]) => entries.map((entry) => entry.path);

describe("setup can belong to an agent", () => {
  it("reads an agent's items apart from every session's, and takes no number", () => {
    expect(agentSetupItemsOf(TREE, "a1").map((item) => item.id)).toEqual(["i2", "k1", "k2", "g1"]);
    expect(setupItemsOf(TREE, "s1").map((item) => item.id)).toEqual(["i1"]);
    expect(buildSteps(TREE).map((step) => step.id)).toEqual(["p1", "a1"]);
    expect(isSetupPayload({ setup: { agent: "a1", kind: "skill" } })).toBe(true);
    expect(isSetupPayload({ setup: { agent: "", kind: "skill" } })).toBe(false);
  });

  it("reads an old session-owned item exactly as before", () => {
    const [item] = setupItemsOf([TREE[2]]);
    expect(item).toMatchObject({ id: "i1", session: "s1", agent: null, origin: null, template: null, variables: [] });
  });

  it("moves between a session and the agent as one payload, owned by exactly one", () => {
    const toAgent = movedSetupPayload(TREE[2].payload, { agent: "a1" });
    expect(toAgent.setup).toEqual({ kind: "instructions", agent: "a1" });
    expect(movedSetupPayload(toAgent, { session: "s2" }).setup).toEqual({ kind: "instructions", session: "s2" });
  });

  it("exports in the agent's folder and not a session's", async () => {
    const setup = readerSetup(TREE);
    const agentItems = setup.get("agent:a1") ?? [];
    expect(agentItems.map((item) => item.id)).toEqual(["i2", "k1", "k2", "g1"]);
    const folder = await setupFolder(agentItems, load);
    expect(names(folder.entries)).toEqual(["AGENTS.md", "SKILLS-TO-INSTALL.md", ".claude/skills/inbox-zero/SKILL.md", ".mcp.json"]);
    const sessionFolder = await setupFolder(setup.get("s1") ?? [], load);
    expect(names(sessionFolder.entries)).toEqual(["CLAUDE.md"]);
  });
});

describe("context file templates", () => {
  const text = "I am Sam. I run Sam's Bakery for local cafes.";
  const made = templateFrom(text, [
    { words: "Sam's Bakery", name: "your_business", description: "Your business's name" },
    { words: "Sam", name: "your_name", description: "Your first name" },
    { words: "local cafes", name: "your_clients", description: "Who you work for" },
  ]);

  it("turns selected words into {name} variables with descriptions", () => {
    expect(made.template).toBe("I am {your_name}. I run {your_business} for {your_clients}.");
    expect(made.variables.map((variable) => variable.name)).toEqual(["your_business", "your_name", "your_clients"]);
    expect(fillTemplate(made.template, { your_name: "Ana", your_business: "Ana's Garden" })).toBe("I am Ana. I run Ana's Garden for {your_clients}.");
    expect(() => templateFrom(text, [{ words: "nowhere", name: "x", description: "" }])).toThrow("not in the file");
    expect(() => templateFrom(text, [{ words: "Sam", name: "your name", description: "" }])).toThrow("letters, digits");
  });

  it("marks the original Not shared, so the published build shows the template and not the original", async () => {
    const payload = withTemplate(TREE[2].payload, made);
    expect(payload).toMatchObject({ template: made.template, variables: made.variables, not_shared: true });
    const tree = [node("i1", 0, "document", payload)];
    const [item] = readerSetup(tree).get("s1") ?? [];
    expect(item.download).toBeNull();
    expect(item.template).toBe(made.template);
    const folder = await setupFolder([item as ReaderSetupItem], load);
    expect(new TextDecoder().decode(folder.entries[0].data)).toBe(made.template);
  });

  it("travels in a fork as the template and its variables, not the original", () => {
    const copied = methodOf(withTemplate({ ...(TREE[2].payload as Record<string, unknown>), media_id: "m1" }, made)) as Record<string, unknown>;
    expect(copied.template).toBe(made.template);
    expect(copied.variables).toEqual(made.variables);
    expect(copied.media_id).toBeUndefined();
    expect(copied.url).toBeUndefined();
  });

  it("taking the template off leaves the rest", () => {
    expect(withTemplate(withTemplate(TREE[2].payload, made), null)).toMatchObject({ title: "CLAUDE.md", not_shared: true });
  });
});

describe("skill origin", () => {
  it("saves and shows each origin; unset shows none", () => {
    expect(withSkillOrigin({ title: "x" }, "maker")).toEqual({ title: "x", origin: "maker" });
    expect(withSkillOrigin({ title: "x" }, "agent")).toEqual({ title: "x", origin: "agent" });
    expect(withSkillOrigin({ title: "x" }, "registry", { registry: "ClawHub", skillName: "email-triage" })).toEqual({ title: "x", origin: "registry", registry: "ClawHub", skill_name: "email-triage" });
    expect(() => withSkillOrigin({}, "registry", { registry: "", skillName: "x" })).toThrow("Name the registry");
    expect(withSkillOrigin({ origin: "agent" }, null)).toEqual({});
    const items = agentSetupItemsOf(TREE, "a1");
    expect(items.map((item) => skillOriginLine(item))).toEqual([null, "Written by the agent", "From ClawHub", null]);
  });

  it("exports a registry skill with no files as its install line", () => {
    expect(installLine({ name: "email-triage", registry: "ClawHub", skillName: "email-triage" })).toBe("Install the email-triage skill from ClawHub.");
  });
});
