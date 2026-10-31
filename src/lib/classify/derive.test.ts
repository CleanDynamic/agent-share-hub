import { describe, expect, it } from "vitest";

import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import { deriveClassification, languageNamedIn, type DeriveBuild } from "./derive";
import type { Facet } from "./taxonomy";

let counter = 0;
const node = (type: string, payload: Record<string, unknown> = {}, children: NodeTree[] = [], over: Record<string, unknown> = {}): NodeTree => {
  counter += 1;
  const id = `n${counter}`;
  const made = { id, build_id: "b1", type, title: null, payload, position: counter, parent_id: null, source_ref: null, is_gap: false, created_at: "2026-10-22T00:00:00Z", children, ...over } as unknown as NodeTree;
  for (const child of children) (child as unknown as { parent_id: string }).parent_id = id;
  return made;
};
const prompt = (text = "Write the intro", extra: Record<string, unknown> = {}) => node("prompt", { text, ...extra });
const agent = (extra: Record<string, unknown> = {}, children: NodeTree[] = []) => node("agent_config", { system_prompt: "You help.", ...extra }, children);
const code = (source = "const a = 1;", language = "typescript") => node("code", { source, language });
const result = (extra: Record<string, unknown> = {}) => node("result", { summary: "It works", ...extra });
const tool = (service: string, extra: Record<string, unknown> = {}) => node("integration", { service, ...extra });
const file = (title: string, extra: Record<string, unknown> = {}) => node("document", { title, ...extra });
const check = () => node("eval_run", { tested: "Does it answer?" });
const decision = (extra: Record<string, unknown> = {}) => node("decision", { provider: "x", model: "y", questions: [{ id: "team", type: "yesno", instructions: "Is it urgent?" }], ...extra });

const run = (tree: NodeTree[], build: DeriveBuild = {}) => deriveClassification(buildSteps(tree), { tree, ...build });
const values = (tree: NodeTree[], facet: Facet, build: DeriveBuild = {}) => run(tree, build).derived[facet]?.values ?? [];

describe("deriveClassification: What was built", () => {
  it("reads a deployed result or a link as a Web app, with the tile it came from", () => {
    const r = result({ url: "https://example.com", kind: "deployed" });
    const got = run([prompt(), r]).derived.built;
    expect(got?.values).toContain("web-app");
    expect(got?.from).toContain(r.id);
    expect(values([prompt(), result({ url: "https://example.com" })], "built")).toContain("web-app");
  });

  it("reads picture and video results as Image set and Video", () => {
    const pic = result({ media_id: "m1" });
    const vid = result({ media_id: "m2" });
    const kinds = new Map([["m1", "image" as const], ["m2", "video" as const]]);
    const got = run([prompt(), pic, vid], { mediaKinds: kinds }).derived.built?.values;
    expect(got).toEqual(expect.arrayContaining(["image-set", "video"]));
  });

  it("reads a text result as a Document or report and a table as a Spreadsheet or data model", () => {
    expect(values([prompt(), result()], "built")).toContain("document-or-report");
    expect(values([prompt(), result({ media_id: "m1", file_name: "sales.csv", file_mime: "text/csv", file_size: 10 })], "built")).toContain("spreadsheet-or-data-model");
    expect(values([prompt(), result({ metric: "accuracy 0.9" })], "built")).toContain("spreadsheet-or-data-model");
  });

  it("reads a trained model result as a Fine-tuned model", () => {
    expect(values([result({ kind: "trained-model", base_model: "llama", method: "LoRA" })], "built")).toContain("fine-tuned-model");
  });

  it("reads a dataset tile as a Dataset", () => {
    expect(values([file("ratings.csv")], "built")).toContain("dataset");
    expect(values([file("notes.txt")], "built")).not.toContain("dataset");
  });

  it("reads a single agent as an Autonomous agent and a team as a Multi-agent system", () => {
    expect(values([agent()], "built")).toContain("autonomous-agent");
    expect(values([node("team", {}, [agent(), agent()])], "built")).toContain("multi-agent-system");
  });

  it("reads Decision tiles as an AI feature in a product", () => {
    expect(values([decision()], "built")).toContain("ai-feature-in-a-product");
  });

  it("reads MCP with a repository made in this build as an MCP server", () => {
    const tree = [tool("github", { created: true }), tool("Slack", { connection: "mcp" })];
    expect(values(tree, "built")).toContain("mcp-server");
    expect(values([tool("github"), tool("Slack", { connection: "mcp" })], "built")).not.toContain("mcp-server");
  });

  it("reads a trigger with a tool as an Automation workflow", () => {
    const tree = [agent({ runs: { how: "schedule" } }), tool("Slack")];
    expect(values(tree, "built")).toContain("automation-workflow");
  });

  it("reads only prompts with a system prompt or variables as a Prompt library", () => {
    expect(values([prompt("Hello {{name}}"), prompt("Bye")], "built")).toContain("prompt-library");
    expect(values([prompt("Hello"), prompt("Bye")], "built")).not.toContain("prompt-library");
    expect(values([prompt("Hello {{name}}"), code()], "built")).not.toContain("prompt-library");
  });

  it("reads Code tiles with no deployed result as a Script or tool", () => {
    expect(values([code()], "built")).toContain("script-or-tool");
    expect(values([code(), result({ url: "https://example.com" })], "built")).not.toContain("script-or-tool");
  });
});

describe("deriveClassification: Role of AI and Autonomy", () => {
  it("is Made with AI for prompts alone", () => {
    expect(values([prompt()], "role")).toEqual(["made-with-ai"]);
  });

  it("is Runs on AI for a Decision, a scheduled agent, or a deployed result with an agent", () => {
    expect(values([decision()], "role")).toEqual(["runs-on-ai"]);
    expect(values([agent({ runs: { how: "event" } })], "role")).toEqual(["runs-on-ai"]);
    expect(values([agent(), result({ url: "https://x.example", kind: "deployed" })], "role")).toEqual(["runs-on-ai"]);
  });

  it("is Both when it also produced results from prompts", () => {
    const p = prompt();
    const r = result({ uses: [{ kind: "output", node_id: p.id }] });
    expect(values([p, decision(), r], "role")).toEqual(["both"]);
  });

  it("has no autonomy values with nothing built, You do each step with no agents", () => {
    expect(values([], "autonomy")).toEqual([]);
    expect(values([prompt()], "autonomy")).toEqual(["you-do-each-step"]);
  });

  it("reads agents by trigger and guard", () => {
    expect(values([agent()], "autonomy")).toEqual(["ai-suggests-and-you-approve"]);
    // SV-27 P8: a step cap is not an approval gate; a Limits line that names approvals is.
    expect(values([agent({ runs: { how: "schedule" }, limits: { steps: 5 } })], "autonomy")).toEqual(["fully-autonomous"]);
    expect(values([agent({ runs: { how: "schedule" }, limits: ["Ask before sending"] })], "autonomy")).toEqual(["ai-acts-with-approval-gates"]);
    expect(values([agent({ runs: { how: "schedule" }, approvals: true })], "autonomy")).toEqual(["ai-acts-with-approval-gates"]);
    expect(values([agent({ runs: { how: "event" } })], "autonomy")).toEqual(["fully-autonomous"]);
  });
});

describe("deriveClassification: Techniques", () => {
  const tech = (tree: NodeTree[]) => values(tree, "technique");

  it("finds a Prompt chain from two prompts and Prompt variables from placeholders", () => {
    expect(tech([prompt(), prompt()])).toContain("prompt-chain");
    expect(tech([prompt()])).not.toContain("prompt-chain");
    expect(tech([prompt("Hi {{name}}")])).toContain("prompt-variables");
    expect(tech([prompt("Hi", { variables: ["name"] })])).toContain("prompt-variables");
  });

  it("finds a System prompt from agent instructions", () => {
    expect(tech([agent()])).toContain("system-prompt");
  });

  it("finds Few-shot examples on a Decision", () => {
    expect(tech([decision({ examples: [{ in: "a", out: "b" }] })])).toContain("few-shot-examples");
    expect(tech([decision()])).not.toContain("few-shot-examples");
  });

  it("finds Retrieval (RAG) when a dataset says it is for retrieval or has chunking", () => {
    expect(tech([file("docs.csv", { use: "retrieval" })])).toContain("retrieval-rag");
    expect(tech([file("docs.csv", { chunk_size: 500 })])).toContain("retrieval-rag");
    expect(tech([file("docs.csv")])).not.toContain("retrieval-rag");
  });

  it("finds Long documents when files are sent with a prompt", () => {
    const p = prompt();
    const f = file("brief.pdf");
    (f as unknown as { parent_id: string }).parent_id = p.id;
    p.children = [f];
    expect(tech([p])).toContain("long-documents");
  });

  it("finds Memory, Tool use, MCP and Multi-agent orchestration", () => {
    expect(tech([agent({ memory: "Keeps a list" })])).toContain("memory");
    expect(tech([tool("Slack")])).toContain("tool-use");
    expect(tech([agent({ tools: [{ tool_ref: "x" }] })])).toContain("tool-use");
    expect(tech([tool("Slack", { connection: "mcp" })])).toContain("mcp");
    expect(tech([agent(), agent()])).toContain("multi-agent-orchestration");
    expect(tech([agent()])).not.toContain("multi-agent-orchestration");
  });

  it("finds Human approval steps from approvals or a manual trigger", () => {
    expect(tech([agent({ approvals: true, runs: { how: "schedule" } })])).toContain("human-approval-steps");
    expect(tech([agent()])).toContain("human-approval-steps");
    expect(tech([agent({ runs: { how: "schedule" } })])).not.toContain("human-approval-steps");
  });

  it("finds Structured output, Classification and Extraction from Decisions and shapes", () => {
    expect(tech([decision()])).toEqual(expect.arrayContaining(["structured-output", "classification"]));
    expect(tech([prompt("x", { output_shape: { kind: "json", fields: [] } })])).toContain("structured-output");
    expect(tech([decision({ questions: [{ id: "q", type: "choice", instructions: "Extract the name", options: [{ key: "a" }, { key: "b" }] }] })])).toContain("extraction");
  });

  it("finds Fine-tuning, Evaluations and Guardrails", () => {
    expect(tech([result({ kind: "trained-model" })])).toContain("fine-tuning");
    expect(tech([check()])).toContain("evaluations");
    expect(tech([agent({ limits: { steps: 3 } })])).toContain("guardrails");
  });

  it("never adds Browser use, Computer use, Code execution or Embeddings", () => {
    const all = tech([prompt(), prompt(), agent({ limits: { a: 1 } }, []), code(), tool("Slack", { connection: "mcp" }), check(), decision()]);
    for (const id of ["browser-use", "computer-use", "code-execution", "embeddings"]) expect(all).not.toContain(id);
  });
});

describe("deriveClassification: Modality", () => {
  const modality = (tree: NodeTree[], build: DeriveBuild = {}) => values(tree, "modality", build);

  it("gives Text to text for prompts and Text to code for code", () => {
    expect(modality([prompt(), code()])).toEqual(expect.arrayContaining(["text-to-text", "text-to-code"]));
  });

  it("gives Text to image and Text to video for those results", () => {
    const kinds = new Map([["m1", "image" as const], ["m2", "video" as const]]);
    expect(modality([result({ media_id: "m1" }), result({ media_id: "m2" })], { mediaKinds: kinds })).toEqual(expect.arrayContaining(["text-to-image", "text-to-video"]));
  });

  it("gives Image to text for an image sent with a prompt, and Speech to text for audio", () => {
    const p = prompt();
    const img = file("photo.png");
    const wav = file("call.mp3");
    for (const f of [img, wav]) (f as unknown as { parent_id: string }).parent_id = p.id;
    p.children = [img, wav];
    expect(modality([p])).toEqual(expect.arrayContaining(["image-to-text", "speech-to-text"]));
  });

  it("gives Document to data for a table result with a document, and Data to report for a report with a dataset", () => {
    expect(modality([file("form.pdf"), result({ media_id: "m", file_name: "out.csv", file_mime: "text/csv" })])).toContain("document-to-data");
    expect(modality([file("sales.csv"), result()])).toContain("data-to-report");
  });
});

describe("deriveClassification: Build method", () => {
  const making = (sessions: { client: string | null }[], session_tools: Record<string, string> = {}) => ({ sessions: sessions.map((s, i) => ({ id: `s${i}`, model: null, prompts: 1, turns: 1, ...s })), excluded_models: [], session_tools });

  it("reads each session's app", () => {
    expect(values([prompt()], "method", { making: making([{ client: "chatgpt" }]) })).toEqual(["chat-assistant"]);
    expect(values([prompt()], "method", { making: making([{ client: "cursor" }, { client: "lovable" }]) })).toEqual(expect.arrayContaining(["ai-coding-agent", "app-builder"]));
    expect(values([prompt()], "method", { making: making([{ client: null }], { s0: "n8n" }) })).toEqual(["automation-platform"]);
    expect(values([prompt()], "method", { making: making([{ client: "ollama" }]) })).toEqual(["local-models"]);
  });

  it("reads the maker's own code as Direct API", () => {
    expect(values([agent({ harness: "" })], "method")).toContain("direct-api");
    expect(values([agent({ harness: "claude-code" })], "method")).toEqual(["ai-coding-agent"]);
  });
});

describe("deriveClassification: Human oversight", () => {
  it("is Every output reviewed when you do each step or approve", () => {
    expect(values([prompt()], "oversight")).toEqual(["every-output-reviewed"]);
    expect(values([agent()], "oversight")).toEqual(["every-output-reviewed"]);
  });

  it("is Spot checks when Check tiles exist and the AI acts", () => {
    expect(values([agent({ runs: { how: "schedule" }, limits: { a: 1 } }), check()], "oversight")).toEqual(["spot-checks"]);
  });

  it("is No review for Fully autonomous with no checks, and nothing for gated agents with no checks", () => {
    expect(values([agent({ runs: { how: "event" } })], "oversight")).toEqual(["no-review"]);
    expect(values([agent({ runs: { how: "schedule" }, approvals: true })], "oversight")).toEqual([]);
  });
});

describe("deriveClassification: Skill needed", () => {
  const skill = (tree: NodeTree[], build: DeriveBuild = {}) => values(tree, "skill", build);
  const longSource = Array.from({ length: 31 }, (_, i) => `line ${i}`).join("\n");

  it("is Writing code for a repository, a long Code tile, or custom code or CLI connection", () => {
    expect(skill([tool("github", { owned: true })])).toEqual(["writing-code"]);
    expect(skill([prompt()], { repo_url: "https://github.com/a/b" })).toEqual(["writing-code"]);
    expect(skill([code(longSource)])).toEqual(["writing-code"]);
    expect(skill([tool("My service", { connection: "code" })])).toEqual(["writing-code"]);
    expect(skill([tool("Some CLI", { connection: "cli" })])).toEqual(["writing-code"]);
  });

  it("is Some setup for API keys, an automation platform, MCP or short code", () => {
    expect(skill([code("print(1)", "python")])).toEqual(["some-setup"]);
    expect(skill([tool("Slack", { connection: "mcp" })])).toEqual(["some-setup"]);
    expect(skill([code("client = Client(api_key=KEY)", "python")])).toEqual(["some-setup"]);
    expect(skill([prompt()], { making: { sessions: [{ client: "zapier", prompts: 1, turns: 1, model: null }] } })).toEqual(["some-setup"]);
  });

  it("is No coding otherwise", () => {
    expect(skill([prompt()])).toEqual(["no-coding"]);
  });
});

describe("deriveClassification: Cost to run", () => {
  const cost = (tree: NodeTree[], build: DeriveBuild = {}) => values(tree, "cost", build);

  it("is Cost not stated with no entries", () => {
    expect(cost([prompt()])).toEqual(["cost-not-stated"]);
  });

  it("buckets a monthly running cost", () => {
    expect(cost([prompt()], { cost_monthly: 4 })).toEqual(["extra-usage-under-10-a-month"]);
    expect(cost([prompt()], { cost_monthly: 20 })).toEqual(["extra-usage-10-to-50-a-month"]);
    expect(cost([prompt()], { cost_monthly: 80 })).toEqual(["extra-usage-over-50-a-month"]);
  });

  it("reads a per-day run cost on a tile as a monthly estimate", () => {
    const a = agent({ run_cost: { per: "day", cost: 1, currency: "GBP", source: "maker" } });
    expect(cost([a])).toEqual(["extra-usage-10-to-50-a-month"]);
  });

  it("reads a paid Required plan on a Tool tile, and never gives Free plans are enough on its own", () => {
    expect(cost([tool("Notion", { required_plan: "Plus £8" })])).toEqual(["needs-a-paid-plan"]);
    expect(cost([tool("Notion", { required_plan: "Free" })])).toEqual(["cost-not-stated"]);
    expect(cost([prompt()])).not.toContain("free-plans-are-enough");
  });
});

describe("deriveClassification: Tools and stack", () => {
  it("matches session apps, tool tiles, agent models and code languages against the lists", () => {
    const m = { sessions: [{ id: "s0", client: "claude-code", model: null, prompts: 1, turns: 1 }], excluded_models: [] };
    const tree = [agent({ models: [{ model: "claude-sonnet-4", role: "main" }] }), tool("Supabase"), code("x", "python")];
    const got = run(tree, { making: m }).derived.stack?.values ?? [];
    expect(got).toEqual(expect.arrayContaining(["ai-applications.claude-code", "data-storage.supabase", "languages.python"]));
  });

  it("reads an agent's model name as its family", () => {
    const got = run([agent({ model: "claude-sonnet-4" })]).derived.stack?.values ?? [];
    expect(got).toContain("models.claude");
  });

  it("turns a name the lists do not know into a custom entry, with its tile", () => {
    const t = tool("Acme Orders");
    const got = run([t]).derived.stack;
    expect(got?.values).toContain("custom:Acme Orders");
    expect(got?.from).toContain(t.id);
  });
});

describe("deriveClassification: gap questions", () => {
  const ids = (tree: NodeTree[], build: DeriveBuild = {}) => run(tree, build).questions.map((q) => q.id);

  it("asks about a deployed result with no Code, Tool or GitHub repository tile", () => {
    const r = result({ url: "https://x.example", kind: "deployed" });
    expect(ids([prompt(), r])).toContain("deployed-no-source");
    expect(ids([prompt(), r, code()])).not.toContain("deployed-no-source");
    expect(ids([prompt(), r, tool("Slack")])).not.toContain("deployed-no-source");
    expect(ids([prompt(), r], { repo_url: "https://github.com/a/b" })).not.toContain("deployed-no-source");
    expect(run([prompt(), r]).questions[0].action).toBe("add-code");
  });

  it("asks about a scheduled agent with no result or run evidence", () => {
    const a = agent({ runs: { how: "schedule" } });
    expect(ids([a])).toContain(`trigger-no-run:${a.id}`);
    expect(ids([agent({ runs: { how: "schedule" } }), result()])).toEqual([]);
    expect(ids([agent()])).toEqual([]);
  });

  it("asks about a tool naming a paid plan with no cost entry", () => {
    const t = tool("Notion", { required_plan: "Plus £8" });
    expect(ids([t])).toContain(`paid-plan-no-cost:${t.id}`);
    expect(ids([t], { cost_monthly: 8 })).toEqual([]);
    expect(ids([t, agent({ build_cost: { cost: 3, currency: "GBP", source: "maker" } })])).toEqual([]);
  });

  it("asks about a language named in a prompt with no Code tile", () => {
    expect(ids([prompt("Write a Python script that renames files")])).toContain("language-no-code:python");
    expect(ids([prompt("Write a Python script"), code("x", "python")])).toEqual([]);
    expect(ids([prompt("Write a poem")])).toEqual([]);
  });

  it("leaves out a dismissed question", () => {
    expect(ids([prompt("Write a Python script")], { dismissed: ["language-no-code:python"] })).toEqual([]);
  });

  it("reads languages carefully", () => {
    expect(languageNamedIn("use TypeScript here")).toBe("TypeScript");
    expect(languageNamedIn("it went to go and get R&D")).toBeNull();
    expect(languageNamedIn("rewrite it in Go")).toBe("Go");
    expect(languageNamedIn("a C++ program")).toBe("C++");
    expect(languageNamedIn("learn Rust")).toBe("Rust");
    expect(languageNamedIn("the rust on the gate")).toBeNull();
  });
});

describe("deriveClassification: nothing built", () => {
  it("derives nothing and asks nothing from an empty build", () => {
    const got = run([]);
    expect(got.questions).toEqual([]);
    expect(Object.keys(got.derived).sort()).toEqual(["cost", "skill"]);
  });

  it("works from steps alone when there is no tree", () => {
    const tree = [prompt("hi"), prompt("there")];
    const got = deriveClassification(buildSteps(tree), {});
    expect(got.derived.technique?.values).toContain("prompt-chain");
  });
});
