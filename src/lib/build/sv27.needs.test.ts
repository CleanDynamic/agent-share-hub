// SV-27 Part 8: the tool registry's deployment providers, harness facts, What you need, Before you copy, and Classification.

import { describe, expect, it } from "vitest";

import { AI_TOOLS, TOOLS, providersFor, toolFor } from "@/lib/tools/registry";
import { deriveClassification } from "@/lib/classify/derive";
import { assistantTree } from "@/dev/fixtures/deployment/assistant";

import { BEFORE_COPY, beforeYouCopy, deploymentNeeds } from "./deploymentNeeds";
import { refOf } from "./deployment";
import { buildSteps } from "./graph";
import { harnessDefaultLine, harnessFacts, hostingLine, monthWord } from "./harnessFacts";
import type { NodeTree } from "./types";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>, children: NodeTree[] = []): NodeTree =>
  ({ id, build_id: "b1", type, title: null, note: null, payload, position, parent_id: null, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as unknown as NodeTree;

describe("the registry", () => {
  it("offers each new provider only on its kinds, and in no tool picker", () => {
    expect(providersFor("memory").map((tool) => tool.name)).toEqual(["Letta", "Mem0"]);
    expect(providersFor("channel").map((tool) => tool.name)).toEqual(expect.arrayContaining(["Telegram", "WhatsApp", "Slack"]));
    expect(providersFor("voice").map((tool) => tool.name)).toEqual(expect.arrayContaining(["ElevenLabs", "Hume"]));
    expect(providersFor("inference_server").map((tool) => tool.name)).toEqual(expect.arrayContaining(["Ollama", "LM Studio", "llama.cpp", "vLLM"]));
    expect(providersFor("engine").map((tool) => tool.name)).toEqual(["llama.cpp", "vLLM", "MLX"]);
    expect(providersFor("monitoring").map((tool) => tool.name)).toEqual(expect.arrayContaining(["Grafana", "Prometheus", "Langfuse", "LangSmith"]));
    expect(providersFor("knowledge_base").map((tool) => tool.name)).toEqual(expect.arrayContaining(["Obsidian", "Notion"]));
    expect(providersFor("router").map((tool) => tool.name)).toEqual(["OpenRouter"]);
    expect(providersFor("front_end").map((tool) => tool.name)).toEqual(expect.arrayContaining(["Claude Design", "Lovable"]));
    for (const name of ["Letta", "Telegram", "Grafana", "llama.cpp"]) expect(AI_TOOLS.some((tool) => tool.name === name)).toBe(false);
    expect(toolFor("llama-server")?.name).toBe("llama.cpp");
    expect(toolFor("crewai")?.group).toBe("runtime-frameworks");
    expect(toolFor("google-calendar")?.lists).toEqual(["app"]);
    expect(TOOLS.filter((tool) => tool.deploys && tool.logo !== null && ["letta", "mem0", "grafana"].includes(tool.id))).toEqual([]);
  });

  it("fills a harness fact only from its source, and says a vendor default as the vendor's, with its month", () => {
    expect(harnessFacts("openclaw")).toMatchObject({ name: "OpenClaw", defaults: { approval_mode: "full" }, checked: "2026-10", source: "https://docs.openclaw.ai/tools/exec-approvals" });
    expect(harnessFacts("openclaw")?.defaults?.sandbox).toBeUndefined();
    expect(harnessDefaultLine("openclaw")).toBe("OpenClaw's default: full access (its docs, October 2026)");
    expect(harnessFacts("hermes-agent")).toMatchObject({ defaults: { approval_mode: "reviewer" }, checked: "2026-10" });
    expect(harnessFacts("hermes-agent")?.defaults?.sandbox).toBeUndefined();
    expect(harnessDefaultLine("hermes-agent")).toBe("Hermes Agent's default: an AI reviewer, then asks you (its docs, October 2026)");
    // No hosting or licence is stated on either page, so neither is filled.
    expect(hostingLine("hermes-agent")).toBeNull();
    expect(harnessFacts("claude-code")).toBeNull();
    expect(monthWord("2026-10")).toBe("October 2026");
  });
});

const ASSISTANT: NodeTree[] = [
  node("a1", 0, "agent_config", { harness: "openclaw", approval_mode: "full", sandbox: "none", model_routing: { mode: "router", router: "openrouter" } }),
  node("a2", 1, "agent_config", { harness: "openclaw", approval_mode: "full" }),
  node("h1", 2, "host", { machine: "mini PC", name: "Mac Mini", always_on: true, agent: "a1", gpus: [{ model: "RTX 5090", count: 2, vram_gb: 32 }] }),
  node("c1", 3, "channel", { provider: "telegram", starts_runs: true, agent: "a1" }),
  node("c2", 4, "channel", { provider: "telegram", starts_runs: true, agent: "a2" }),
  node("m1", 5, "memory", { provider: "letta", agent: "a1" }),
  node("b1", 6, "billing", { provider: "stripe", model: "usage-based", unit: "1M tokens" }),
  node("k1", 7, "knowledge_base", { app: "obsidian", sync: "git" }),
  node("r1", 8, "relay", { joins: ["a1", "a2"], provider: "Agent Tincan", network: "tailscale", connects: [{ to: refOf("a1"), label: "x" }] }),
  node("s1", 9, "inference_server", { provider: "ollama" }),
  node("p1", 10, "prompt", { text: "Run", modelRun: { precision: "Q4_K_M", weights_format: "GGUF", engine: "llama-cpp" } }),
  node("sk", 11, "document", { title: "email-triage", setup: { agent: "a1", kind: "skill" }, origin: "registry", registry: "ClawHub", skill_name: "email-triage" }),
];

describe("What you need", () => {
  it("lists each item once, with the tiles that need it named", () => {
    const needs = deploymentNeeds(ASSISTANT);
    const titles = needs.map((need) => need.title);
    expect(titles).toEqual([
      "An always-on machine (Mac Mini)",
      "2 × RTX 5090 GPU with 32 GB VRAM each, or the same total VRAM",
      "Ollama installed on the host",
      "Obsidian installed",
      "A git repository for the notes",
      "A Letta account (`LETTA_API_KEY`)",
      "An Agent Tincan account",
      "A Tailscale account on every machine an agent runs on",
      "A Telegram account (`TELEGRAM_BOT_TOKEN`)",
      "A bot or number on Telegram for the agent",
      "A Stripe account set up for usage-based billing",
      "The model's weights (GGUF, Q4_K_M)",
      "The email-triage skill from ClawHub",
      "An OpenRouter account (`OPENROUTER_API_KEY`)",
    ]);
    expect(new Set(titles).size).toBe(titles.length);
    expect(needs.find((need) => need.title.startsWith("A Telegram"))?.steps).toEqual(["Telegram"]);
  });
});

describe("Before you copy", () => {
  it("says each warning once", () => {
    // SV-28 P6: OpenClaw reads outside content and full access can send or spend, so the crossing is said too, once.
    expect(beforeYouCopy(ASSISTANT)).toEqual([BEFORE_COPY.full, BEFORE_COPY.noSandbox, "Agent reads outside content and can send or spend, with no approval between."]);
    expect(beforeYouCopy([node("r1", 0, "relay", { joins: ["a", "b"], network: "public internet" })])).toEqual([BEFORE_COPY.publicRelay]);
    expect(beforeYouCopy([node("a1", 0, "agent_config", {})])).toEqual([]);
    // The assistant fixture leaves Approvals unset on OpenClaw, so its docs' default is said, as the vendor's.
    expect(beforeYouCopy(assistantTree)).toEqual(["OpenClaw runs actions without asking by default (its docs, October 2026)."]);
    // A maker who said an approval mode is not told the default.
    expect(beforeYouCopy([node("a1", 0, "agent_config", { harness: "openclaw", approval_mode: "risky" })])).toEqual([]);
  });
});

describe("Classification", () => {
  const derive = (tree: NodeTree[]) => deriveClassification(buildSteps(tree), { tree }).derived;

  it("adds deployment providers, engines and frameworks to Tools and stack, from their tiles", () => {
    const tree = [node("a1", 0, "agent_config", { framework: "langgraph", runs: { how: "background" } }), ...ASSISTANT.slice(2)];
    const stack = derive(tree).stack;
    const text = JSON.stringify(stack?.values);
    for (const value of ["letta", "telegram", "llama-cpp", "langgraph"]) expect(text).toContain(value);
    expect(stack?.from).toEqual(expect.arrayContaining(["m1", "c1", "p1", "a1"]));
  });

  it("gives each approval mode its Autonomy value", () => {
    const one = (mode: string) => derive([node("a1", 0, "agent_config", { approval_mode: mode, runs: { how: "schedule" } })]).autonomy?.values;
    expect(one("every")).toEqual(["ai-suggests-and-you-approve"]);
    expect(one("risky")).toEqual(["ai-acts-with-approval-gates"]);
    expect(one("reviewer")).toEqual(["ai-acts-with-approval-gates"]);
    expect(one("full")).toEqual(["fully-autonomous"]);
    expect(derive([node("a1", 0, "agent_config", { approval_mode: "reviewer" })]).oversight?.values).toContain("spot-checks");
    expect(derive([node("a1", 0, "agent_config", { approval_mode: "every" })]).oversight?.values).toContain("every-output-reviewed");
  });

  it("no longer reads a budget-only Limits line as an approval gate, and still reads one that names approvals", () => {
    const limits = (lines: string[]) => derive([node("a1", 0, "agent_config", { limits: lines, runs: { how: "schedule" } })]).autonomy?.values;
    expect(limits(["Budget £5 a day"])).toEqual(["fully-autonomous"]);
    expect(limits(["Ask before sending an email"])).toEqual(["ai-acts-with-approval-gates"]);
  });

  it("counts background and ongoing as started on their own", () => {
    expect(derive([node("a1", 0, "agent_config", { runs: { how: "background" } })]).autonomy?.values).toEqual(["fully-autonomous"]);
    expect(derive([node("a1", 0, "agent_config", { runs: { how: "ongoing", detail: "Keep it on track" } })]).autonomy?.values).toEqual(["fully-autonomous"]);
  });
});
