// Acceptance cover for the portable build file (NS-P06).
//
// The fixture mirrors supabase/seeds/ns-demo-build.sql — the same twelve-node
// tree three levels deep, the same two tray nodes, the same eight events with
// one hidden — so what these assertions prove about the fixture is what a
// reader gets when they export the seeded build.

import { describe, expect, it } from "vitest";
import type { BuildRecord } from "@/lib/build";
import { PORTABLE_FORMAT_VERSION, toMarkdown, toPortable } from "@/lib/build/portable";

const ORIGIN = "https://neoscaleai.test";
const EXPORTED_AT = new Date("2026-08-23T10:00:00.000Z");

const id = {
  liveApp: "11111111-2000-4000-8000-000000000001",
  agent: "11111111-2000-4000-8000-000000000002",
  dataset: "11111111-2000-4000-8000-000000000003",
  result: "11111111-2000-4000-8000-000000000004",
  prereq: "11111111-2000-4000-8000-000000000005",
  system: "11111111-2000-4000-8000-000000000007",
  tool: "11111111-2000-4000-8000-000000000008",
  retrieval: "11111111-2000-4000-8000-000000000009",
  evalRun: "11111111-2000-4000-8000-00000000000a",
  prompt: "11111111-2000-4000-8000-00000000000b",
  code: "11111111-2000-4000-8000-00000000000c",
  trayShot: "11111111-2000-4000-8000-00000000000d",
  trayNote: "11111111-2000-4000-8000-00000000000e",
};

interface NodeSpec {
  id: string;
  type: string;
  title: string;
  note?: string | null;
  position: number | null;
  parent?: string | null;
  payload?: Record<string, unknown>;
  children?: NodeSpec[];
}

function node(spec: NodeSpec) {
  return {
    id: spec.id,
    build_id: "11111111-0000-4000-8000-000000000001",
    parent_id: spec.parent ?? null,
    position: spec.position,
    type: spec.type,
    title: spec.title,
    note: spec.note ?? null,
    payload: spec.payload ?? {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-07-28T08:40:00Z",
    children: (spec.children ?? []).map(node),
  };
}

const nodeTypes = [
  { key: "live_app", label: "Live app", category: "artefact", colour: "#F59E0B", icon: "Globe", renderer: "artefact", copyable: false, is_active: true, sort: 2,
    schema: { fields: [{ key: "url", label: "URL", type: "string", format: "url" }, { key: "credentials_note", label: "Credentials note", type: "text" }] } },
  { key: "agent_config", label: "Agent configuration", category: "configuration", colour: "#7C3AED", icon: "Bot", renderer: "agent_config", copyable: true, is_active: true, sort: 2,
    schema: { fields: [
      { key: "system_prompt", label: "System prompt", type: "text", required: true },
      { key: "model", label: "Model", type: "string", required: true },
      { key: "tools", label: "Tools", type: "list", of: [{ key: "tool_ref", label: "Tool", type: "string", format: "node_id" }] },
      { key: "guardrails", label: "Guardrails", type: "list", of: [{ key: "rule", label: "Rule", type: "string" }] },
    ] } },
  { key: "system_prompt", label: "System prompt", category: "instruction", colour: "#E8571A", icon: "ScrollText", renderer: "instruction", copyable: true, is_active: true, sort: 2,
    schema: { fields: [{ key: "text", label: "System prompt", type: "text", required: true }, { key: "model", label: "Model", type: "string" }] } },
  { key: "prompt", label: "Prompt", category: "instruction", colour: "#E8571A", icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1,
    schema: { fields: [
      { key: "text", label: "Prompt text", type: "text", required: true },
      { key: "output_ref", label: "Output", type: "string", format: "node_id" },
    ] } },
  { key: "tool_definition", label: "Tool definition", category: "configuration", colour: "#22C55E", icon: "Wrench", renderer: "configuration", copyable: true, is_active: true, sort: 3,
    schema: { fields: [{ key: "name", label: "Name", type: "string", required: true }, { key: "parameters", label: "Parameters", type: "text" }] } },
  { key: "code", label: "Code", category: "artefact", colour: "#F59E0B", icon: "Code2", renderer: "artefact", copyable: true, is_active: true, sort: 1,
    schema: { fields: [
      { key: "language", label: "Language", type: "enum", options: ["ts", "python"] },
      { key: "source", label: "Source", type: "text", required: true },
      { key: "filename", label: "Filename", type: "string" },
    ] } },
  { key: "dataset", label: "Dataset", category: "data", colour: "#3B82F6", icon: "Database", renderer: "data", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "description", label: "Description", type: "text", required: true }, { key: "record_count", label: "Record count", type: "number" }] } },
  { key: "retrieval_config", label: "Retrieval configuration", category: "data", colour: "#3B82F6", icon: "Search", renderer: "data", copyable: true, is_active: true, sort: 2,
    schema: { fields: [{ key: "strategy", label: "Strategy", type: "string", required: true }, { key: "top_k", label: "Top K", type: "number" }] } },
  { key: "result", label: "Result", category: "evidence", colour: "#2EC4B6", icon: "BarChart3", renderer: "evidence", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "summary", label: "Summary", type: "text", required: true }, { key: "media_id", label: "Media", type: "string", format: "media_id" }] } },
  { key: "eval_run", label: "Eval run", category: "evidence", colour: "#2EC4B6", icon: "Gauge", renderer: "evidence", copyable: false, is_active: true, sort: 3,
    schema: { fields: [{ key: "harness", label: "Harness", type: "string" }, { key: "dataset_ref", label: "Dataset", type: "string", format: "node_id" }, { key: "score", label: "Score", type: "number" }] } },
  { key: "prerequisite", label: "Prerequisite", category: "narrative", colour: "#9CA3AF", icon: "ListChecks", renderer: "narrative", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "requirement", label: "Requirement", type: "text", required: true }, { key: "why", label: "Why it is needed", type: "text" }] } },
  { key: "screenshot", label: "Screenshot", category: "evidence", colour: "#2EC4B6", icon: "Camera", renderer: "evidence", copyable: false, is_active: true, sort: 4,
    schema: { fields: [{ key: "media_id", label: "Media", type: "string", format: "media_id", required: true }] } },
  { key: "note", label: "Note", category: "narrative", colour: "#9CA3AF", icon: "StickyNote", renderer: "narrative", copyable: false, is_active: true, sort: 1,
    schema: { fields: [{ key: "body", label: "Note", type: "text", required: true }] } },
];

const record = {
  build: {
    id: "11111111-0000-4000-8000-000000000001",
    creator_id: "22222222-0000-4000-8000-000000000001",
    slug: "inbox-triage-agent-demo",
    title: "Inbox triage agent that files a week of email in four minutes",
    outcome: "Sorts a full inbox into reply / delegate / archive and drafts the replies.",
    shape: "app",
    status: "published",
    made_for: ["founder", "operations manager"],
    made_with: ["Claude Opus 4.5", "Gmail API"],
    live_url: "https://inbox-triage.demo.neoscaleai.com",
    repo_url: "https://github.com/neoscale-demo/inbox-triage-agent",
    hero_node_id: id.liveApp,
    cost_setup: 0,
    cost_monthly: 18.4,
    currency: "GBP",
    time_to_first_result: 35,
    completeness: 86,
    reproduction_count: 4,
    last_confirmed_at: "2026-08-14T09:12:00Z",
  },
  tree: [
    node({ id: id.liveApp, type: "live_app", title: "The running agent", position: 0, note: "Sign in with a Google account.",
      payload: { url: "https://inbox-triage.demo.neoscaleai.com", credentials_note: "Google sign-in with read scopes." } }),
    node({ id: id.agent, type: "agent_config", title: "Triage agent configuration", position: 1,
      payload: {
        system_prompt: "You triage a professional inbox.\nYou never send.",
        model: "claude-opus-4-5",
        tools: [{ tool_ref: id.tool }, { tool_ref: id.trayShot }],
        guardrails: [{ rule: "Never send. Drafts only." }],
      },
      children: [
        node({ id: id.system, type: "system_prompt", title: "Triage system prompt", position: 0, parent: id.agent,
          payload: { text: "Classify into exactly one of: reply, delegate, archive.", model: "claude-opus-4-5" },
          children: [
            node({ id: id.prompt, type: "prompt", title: "Per-email classify call", position: 0, parent: id.system,
              payload: { text: "Thread summary:\n{{thread_summary}}\n\nClassify.", output_ref: id.result } }),
          ] }),
        node({ id: id.tool, type: "tool_definition", title: "fetch_thread_context", position: 1, parent: id.agent,
          payload: { name: "fetch_thread_context", parameters: '{ "thread_id": { "type": "string" } }' },
          children: [
            node({ id: id.code, type: "code", title: "fetch_thread_context implementation", position: 0, parent: id.tool,
              payload: { language: "ts", filename: "src/tools/fetchThreadContext.ts", source: "export async function fetchThreadContext(id: string) {\n  return gmail.get(id);\n}" } }),
          ] }),
      ] }),
    node({ id: id.dataset, type: "dataset", title: "Hand-labelled triage set", position: 2,
      payload: { description: "60 real emails, labelled by hand.", record_count: 60 },
      children: [
        node({ id: id.retrieval, type: "retrieval_config", title: "Voice-matching retrieval", position: 0, parent: id.dataset,
          payload: { strategy: "hybrid", top_k: 5 } }),
      ] }),
    node({ id: id.result, type: "result", title: "Ninety minutes down to four", position: 3,
      payload: { summary: "Four weeks of Monday mornings, measured with a stopwatch.", media_id: "/media/monday.png" },
      children: [
        node({ id: id.evalRun, type: "eval_run", title: "Classifier accuracy", position: 0, parent: id.result,
          payload: { harness: "promptfoo", dataset_ref: id.dataset, score: 0.9667 } }),
      ] }),
    node({ id: id.prereq, type: "prerequisite", title: "A Google Workspace account", position: 4,
      payload: { requirement: "Gmail API access with read and compose scopes.", why: "The agent reads threads and writes drafts." } }),
  ],
  tray: [
    node({ id: id.trayShot, type: "screenshot", title: "Triage view, second draft", position: null, payload: { media_id: "shots/v2.png" } }),
    node({ id: id.trayNote, type: "note", title: "Cost note, unfinished", position: null, payload: { body: "Rough spend maths." } }),
  ],
  events: [
    { id: "33333333-0000-4000-8000-000000000001", build_id: "b", ordinal: 2, occurred_at: "2026-07-28T09:26:00Z", kind: "prompt", phase: 1, phase_title: "Reading the inbox", visibility: "kept", produced_node_id: null, created_at: "", payload: { text: "Classify this email into exactly one of: reply, delegate, archive.", model: "claude-opus-4-5" } },
    { id: "33333333-0000-4000-8000-000000000002", build_id: "b", ordinal: 1, occurred_at: "2026-07-28T08:41:00Z", kind: "note", phase: 1, phase_title: "Reading the inbox", visibility: "kept", produced_node_id: null, created_at: "", payload: { text: "Started from the actual problem: 340 unread." } },
    { id: "33333333-0000-4000-8000-000000000003", build_id: "b", ordinal: 3, occurred_at: "2026-08-08T16:44:00Z", kind: "note", phase: 2, phase_title: "Drafting and shipping", visibility: "hidden", produced_node_id: null, created_at: "", payload: { text: "Scratch: keeping the account details out of the public record." } },
  ],
  nodeTypes,
} as unknown as BuildRecord;

const portable = toPortable(record, { origin: ORIGIN, exportedAt: EXPORTED_AT });
const json = JSON.stringify(portable, null, 2);

const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe("toPortable", () => {
  it("stamps the format version and an absolute source url", () => {
    expect(portable.neoscale_build).toBe(1);
    expect(portable.neoscale_build).toBe(PORTABLE_FORMAT_VERSION);
    expect(portable.source_url).toBe(`${ORIGIN}/b2/inbox-triage-agent-demo`);
    expect(portable.exported_at).toBe("2026-08-23T10:00:00.000Z");
  });

  it("carries the header the envelope declares, and no identifiers", () => {
    expect(portable.build).toEqual({
      title: record.build.title,
      outcome: record.build.outcome,
      shape: "app",
      made_for: ["founder", "operations manager"],
      made_with: ["Claude Opus 4.5", "Gmail API"],
      live_url: "https://inbox-triage.demo.neoscaleai.com",
      repo_url: "https://github.com/neoscale-demo/inbox-triage-agent",
      cost: { setup: 0, monthly: 18.4, currency: "GBP" },
      time_to_first_result: 35,
    });
    expect(Object.keys(portable.build)).not.toContain("id");
    expect(Object.keys(portable.build)).not.toContain("creator_id");
    expect(Object.keys(portable.build)).not.toContain("hero_node_id");
  });

  it("holds no uuid anywhere in the file", () => {
    expect(UUID_ANYWHERE.test(json)).toBe(false);
  });

  it("excludes every tray node", () => {
    expect(json).not.toContain("Triage view, second draft");
    expect(json).not.toContain("Cost note, unfinished");
  });

  it("numbers nodes by path, three levels deep", () => {
    expect(portable.nodes.map((n) => n.path)).toEqual(["1", "2", "3", "4", "5"]);
    const agent = portable.nodes[1];
    expect(agent.children.map((n) => n.path)).toEqual(["2.1", "2.2"]);
    expect(agent.children[0].children.map((n) => n.path)).toEqual(["2.1.1"]);
    expect(agent.children[0].children[0].title).toBe("Per-email classify call");
    expect(agent.children[0].children[0].children).toEqual([]);
  });

  it("replaces node references with the path they point at", () => {
    const agent = portable.nodes[1];
    // tools[0] points at the tool definition, which is node 2.2.
    expect((agent.payload.tools as { tool_ref: string | null }[])[0].tool_ref).toBe("2.2");
    // tools[1] points into the tray, which is not in the file at all.
    expect((agent.payload.tools as { tool_ref: string | null }[])[1].tool_ref).toBeNull();
    expect(agent.children[0].children[0].payload.output_ref).toBe("4");
    expect(portable.nodes[3].children[0].payload.dataset_ref).toBe("3");
  });

  it("makes media references absolute", () => {
    expect(portable.nodes[3].payload.media_id).toBe(`${ORIGIN}/media/monday.png`);
  });

  it("keeps notes, payload values and schema key order", () => {
    expect(portable.nodes[0].note).toBe("Sign in with a Google account.");
    expect(Object.keys(portable.nodes[1].payload)).toEqual([
      "system_prompt",
      "model",
      "tools",
      "guardrails",
    ]);
    expect(portable.nodes[2].payload.record_count).toBe(60);
  });

  it("drops hidden events and orders the rest by ordinal", () => {
    expect(portable.events.map((event) => event.ordinal)).toEqual([1, 2]);
    expect(json).not.toContain("out of the public record");
    expect(portable.events[0]).toEqual({
      ordinal: 1,
      kind: "note",
      phase_title: "Reading the inbox",
      payload: { text: "Started from the actual problem: 340 unread." },
    });
  });

  it("is stable: the same record exports byte for byte", () => {
    const again = toPortable(record, { origin: ORIGIN, exportedAt: EXPORTED_AT });
    expect(JSON.stringify(again)).toBe(JSON.stringify(portable));
  });

  it("parses back, which is what the downloaded file has to do", () => {
    const parsed = JSON.parse(json);
    expect(parsed.neoscale_build).toBe(1);
    expect(parsed.nodes[1].children[0].children[0].title).toBe("Per-email classify call");
  });
});

describe("toMarkdown", () => {
  const markdown = toMarkdown(portable);

  it("leads with the title, the outcome and the facts", () => {
    expect(markdown.startsWith(`# ${record.build.title}\n`)).toBe(true);
    expect(markdown).toContain("**Outcome.** Sorts a full inbox");
    expect(markdown).toContain("- Made with: Claude Opus 4.5, Gmail API");
    expect(markdown).toContain(`- Source: ${ORIGIN}/b2/inbox-triage-agent-demo`);
  });

  it("puts prerequisites in a checklist before the steps", () => {
    const prerequisites = markdown.indexOf("## Before you start");
    const steps = markdown.indexOf("## Steps");
    expect(prerequisites).toBeGreaterThan(-1);
    expect(steps).toBeGreaterThan(prerequisites);
    expect(markdown).toContain("- [ ] **A Google Workspace account** — Gmail API access");
    // Hoisted out of the step sequence, not repeated in it.
    expect(markdown).not.toContain("## 5. A Google Workspace account");
  });

  it("heads every node by its path and fences code and prompt text", () => {
    expect(markdown).toContain("## 1. The running agent");
    expect(markdown).toContain("#### 2.1.1. Per-email classify call");
    expect(markdown).toContain("```ts\nexport async function fetchThreadContext");
    expect(markdown).toContain("Thread summary:\n{{thread_summary}}");
    expect(markdown).toContain("- Guardrails:\n  - Never send. Drafts only.");
  });

  it("prints a node reference as the path and the title it points at", () => {
    expect(markdown).toContain("- Tools:\n  - 2.2. fetch_thread_context\n");
    expect(markdown).toContain("- Output ref: 4. Ninety minutes down to four");
    expect(markdown).toContain("- Dataset ref: 3. Hand-labelled triage set");
  });

  it("closes with the event sequence and carries no identifiers", () => {
    expect(markdown).toContain("## How it was built");
    expect(markdown).toContain("1. Reading the inbox — note: Started from the actual problem");
    expect(markdown).not.toContain("out of the public record");
    expect(UUID_ANYWHERE.test(markdown)).toBe(false);
  });

  it("lengthens a fence rather than letting creator backticks close it", () => {
    const withFence = {
      ...portable,
      nodes: [
        {
          path: "1",
          type: "code",
          title: "Readme snippet",
          note: null,
          payload: { language: "md", source: "Run it:\n```bash\nnpm run dev\n```" },
          children: [],
        },
      ],
    };
    const out = toMarkdown(withFence);
    expect(out).toContain("````md\nRun it:\n```bash");
    expect(out.trimEnd().endsWith("````")).toBe(false);
  });

  it("says so plainly when a build lists no prerequisites", () => {
    const bare = toMarkdown({ ...portable, nodes: [], events: [] });
    expect(bare).toContain("Nothing is listed as a prerequisite.");
    expect(bare).toContain("This build has no nodes yet.");
  });
});
