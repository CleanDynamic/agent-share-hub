// SV-28 Part 7: the setup prompt, assembled from the tiles with no model call.

import { describe, expect, it } from "vitest";

import { agentTeamTree } from "@/dev/fixtures/deployment/agent-team";
import { assistantTree } from "@/dev/fixtures/deployment/assistant";
import { chiefOfStaffTree } from "@/dev/fixtures/deployment/chief-of-staff";
import { selfHostedTree } from "@/dev/fixtures/deployment/self-hosted";
import { TOOLS } from "@/lib/tools/registry";

import { setupPromptOf, setupPromptRefusal, SETUP_PROMPT_COPY } from "./setupPrompt";
import { trustBoundaryOf } from "./trustBoundary";
import type { NodeTree } from "./types";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>, title: string | null = null, children: NodeTree[] = []): NodeTree => {
  const made = { id, build_id: "b", parent_id: null, position, type, title, payload, children } as unknown as NodeTree;
  for (const child of children) (child as unknown as { parent_id: string }).parent_id = id;
  return made;
};

describe("setupPromptOf: the fixtures", () => {
  it("the assistant", () => expect(setupPromptOf("as-a1", { tree: assistantTree }).text).toMatchSnapshot());
  it("the self-hosted team", () => expect(setupPromptOf("sh-t1", { tree: selfHostedTree }).text).toMatchSnapshot());
  it("the agent team", () => expect(setupPromptOf("at-t1", { tree: agentTeamTree }).text).toMatchSnapshot());
  it("the chief of staff", () => expect(setupPromptOf("cs-t1", { tree: chiefOfStaffTree }).text).toMatchSnapshot());
});

describe("setupPromptOf: what it says", () => {
  const cos = setupPromptOf("cs-t1", { tree: chiefOfStaffTree });

  it("gives the same text for the same input", () => {
    expect(setupPromptOf("cs-t1", { tree: chiefOfStaffTree })).toEqual(cos);
    expect(setupPromptOf("at-t1", { tree: agentTeamTree }).text).toBe(setupPromptOf("at-t1", { tree: agentTeamTree }).text);
  });

  it("lists jobs in step order with their deliverable, destination and approval", () => {
    const research = cos.text.indexOf("Research, job 2: Weekly market report. Deliver a report named Weekly market report to Google Drive, Research folder.");
    const operations = cos.text.indexOf("Operations, job 2: Pipeline sheet. Deliver a sheet named Weekly pipeline sheet to Google Sheets.");
    const sales = cos.text.indexOf("Sales, job 2: Client follow-up. Deliver a draft named Client follow-up email to Gmail. Wait for approval before delivering it.");
    expect(research).toBeGreaterThan(-1);
    expect(operations).toBeGreaterThan(research);
    expect(sales).toBeGreaterThan(operations);
  });

  it("writes a knowledge base note's template with its variables under Fill in", () => {
    expect(cos.text).toContain("Create a shared notes folder of markdown files in Obsidian, synced with git, that every agent reads. Add these notes:");
    expect(cos.text).toContain("{deal_name}, worth {deal_value}, next step on {next_date}.");
    expect(cos.variables.map((variable) => variable.name)).toEqual(expect.arrayContaining(["deal_name", "deal_value", "next_date", "agency_name", "client_name"]));
    expect(cos.text).toContain("Replace {deal_value} before running.");
  });

  it("says each trust boundary crossing once, under Before you run", () => {
    // Two: Research hands Gmail's content to Operations, and Operations reads Slack and can send in it.
    expect(trustBoundaryOf({ tree: chiefOfStaffTree })).toHaveLength(2);
    for (const line of ["Research reads outside content and passes work to Operations, which can send. Add an approval between them before running.", "Operations reads outside content and can send in Slack and Google Sheets. Add an approval before it acts."]) expect(cos.text.split(line)).toHaveLength(2);
  });

  it("says the Approval step before the step it holds back", () => {
    expect(setupPromptOf("cs-t1", { tree: chiefOfStaffTree.map((n) => (n.id === "cs-g1" ? ({ ...n, payload: { gate: { approves: "The client email draft", by: "maker", blocks: ["cs-a3"] } } } as NodeTree) : n)) }).text).toContain("wait for the maker to approve the client email draft.");
  });

  it("holds no Not shared item, secret value, deployment address or front end URL", () => {
    for (const [id, tree] of [["as-a1", assistantTree], ["sh-t1", selfHostedTree], ["at-t1", agentTeamTree], ["cs-t1", chiefOfStaffTree]] as const) {
      const { text, secrets } = setupPromptOf(id, { tree });
      expect(text).not.toMatch(/https?:\/\/(?!www\.plainenglish\.example)/);
      for (const secret of secrets) expect(text).toContain(`\${${secret}}`);
    }
    const assistant = setupPromptOf("as-a1", { tree: assistantTree });
    expect(assistant.text).not.toContain("assistant.example.com");
    expect(assistant.secrets).toEqual(expect.arrayContaining(["GMAIL_TOKEN", "GOOGLE_TOKEN"]));
    const hidden = [node("a", 0, "agent_config", { model: "m", system_prompt: "Help." }), node("d", 1, "document", { title: "secret-plan.md", setup: { agent: "a", kind: "instructions" }, not_shared: true }), node("s", 2, "integration", { service: "gmail", setup: { agent: "a", kind: "server" }, not_shared: true, server: { env: { TOKEN: "abc123secret" } } })];
    const out = setupPromptOf("a", { tree: hidden }).text;
    expect(out).not.toContain("secret-plan");
    expect(out).not.toContain("abc123secret");
    expect(out).not.toContain("TOKEN");
  });

  it("a vendor-hosted agent gives the goal form, and lists what does not carry over", () => {
    const tool = TOOLS.find((entry) => entry.id === "manus");
    const was = tool?.facts;
    if (tool) (tool as { facts?: unknown }).facts = { hosting: "vendor", checked: "2026-11", source: "https://example.com" };
    try {
      const tree = [node("v", 0, "agent_config", { harness: "manus", model: "m", system_prompt: "x", runs: { how: "ongoing", detail: "Find ten leads a week" }, tools: ["gmail"], tool_permissions: { gmail: "read" }, approval_mode: "every" }), node("k", 1, "document", { title: "leads", setup: { agent: "v", kind: "skill" }, skill: { name: "leads" } })];
      const out = setupPromptOf("v", { tree });
      expect(out.text).toBe("In Manus, set this goal: Find ten leads a week.\n\nConnect Gmail (read only).\n\nAsk before every action.");
      expect(out.notCarried).toEqual(["Skills: Manus is hosted by its vendor, so files are not set up by hand"]);
      expect(setupPromptRefusal("v", { tree: [node("v", 0, "agent_config", { harness: "manus" })] })).toBeNull();
    } finally {
      if (tool) (tool as { facts?: unknown }).facts = was;
    }
  });

  it("leaves out a section with nothing to say, and is off with no instructions", () => {
    const bare = [node("a", 0, "agent_config", { model: "opus-5-5", system_prompt: "Answer questions." })];
    expect(setupPromptOf("a", { tree: bare }).text).toBe("Model: Opus 5.5.\n\nGive it these instructions:\n\n```\nAnswer questions.\n```");
    expect(setupPromptRefusal("a", { tree: [node("a", 0, "agent_config", { model: "m", system_prompt: "" })] })).toBe(SETUP_PROMPT_COPY.needsInstructions);
    expect(SETUP_PROMPT_COPY.copied).toBe("Setup prompt copied");
  });
});
