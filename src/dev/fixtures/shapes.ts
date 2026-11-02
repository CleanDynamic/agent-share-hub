/* CA-02 P9 — five shapes of AI use, as build trees the composer's pure functions take.

   DEV ONLY. Each shape is a placed `NodeTree`, written with only the node types and payload keys that exist after
   CA-02 Parts 1 to 7, exactly as the composer saves them:

   1. alone      One prompt in Claude on Opus 5.5, and its result.
   2. retrieval  One prompt in Gemini Notebook that uses two documents, and its result.
   3. agent      One agent in Hermes Agent on Opus 5.5 (main) and Haiku 5.5 (other), allowed Gmail and GitHub Copilot
                 as integration nodes, with two prompts inside, and its result.
   4. team       A team led by an agent in Claude Code (Fable 5.1, with Sonnet 5.5 acting), with three agents for
                 research, build and review, each feeding the one result.
   5. code       Two prompts in Cursor, two code steps (app.ts, the entrypoint, and schema.sql), a manual step
                 "Deployed to Vercel", and the result.
   6. team-checks  CA-03 P9, a team that checks itself: a lead in Claude Code (Fable 5.1 plans, Sonnet 5.5 acts) and
                 three agents for Research, Build and Review side by side, Review sent round again until the review
                 has no changes, Build allowed Gmail and Google Sheets and remembering what it reviewed, a code step
                 order-form.tsx, a check that passed 14 of 14, and one result.

   The views (`shapeListProps`, `shapeMapProps`, `shapeDetailsProps`) are derived the way SandboxPage derives them,
   so `/dev/kit/pages/sandbox?build=shape-<key>` draws them for a screenshot. */

import type { Json } from "@/integrations/supabase/types";
import { sessionsMetaOf, type Making } from "@/lib/build/making";
import { runsWhenLine, type WorkflowEvent } from "@/lib/build/runsFrom";
import { setupItemsOf } from "@/lib/build/setup";
import { buildSteps, FILE_TYPE, madeFilesOf, nestRefusal, RESULT_TYPE, resultFactsOf, resultHoldsWord, sessionGroups, TOOL_TYPE, usesOf, type Step } from "@/lib/build/graph";
import type { MapPieceLike } from "@/lib/build/sessionMap";
import type { MapFixture } from "@/dev/fixtures/sandbox";
import type { NodeTree, NodeType } from "@/lib/build/types";
import type { BuildListProps } from "@/pages/site/compose/BuildList";
import type { DetailsPanelProps } from "@/pages/site/compose/DetailsPanel";
import { dividers, type ListResult } from "@/pages/site/compose/buildListModel";
import { pieces, resolveView } from "@/pages/site/compose/detailsView";
import { sourceFiles, sourceSessions } from "@/pages/site/compose/sourcesModel";

export type ShapeKey = "alone" | "retrieval" | "agent" | "team" | "code" | "team-checks" | "one-sitting" | "runs-on-github" | "everything";

export const SHAPE_KEYS: readonly ShapeKey[] = ["alone", "retrieval", "agent", "team", "code", "team-checks", "one-sitting", "runs-on-github", "everything"];

export interface Shape {
  key: ShapeKey;
  title: string;
  tree: NodeTree[];
  /** The node Details shows for a screenshot. */
  selected: string;
  /** CA-04 P7: builds.making, for the sessions made in the composer and what they carry. */
  making?: Making;
}

const BUILD = "shape-build";

/** A placed node, as getNodeTree returns it. */
function node(id: string, type: string, payload: Record<string, unknown>, position: number, extra: { parent?: string; title?: string | null; children?: NodeTree[] } = {}): NodeTree {
  return {
    id,
    build_id: BUILD,
    parent_id: extra.parent ?? null,
    type,
    title: extra.title ?? null,
    note: null,
    payload: payload as Json,
    position,
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-19T09:00:00Z",
    children: extra.children ?? [],
  } as NodeTree;
}

const out = (id: string) => ({ kind: "output", node_id: id });
const file = (id: string) => ({ kind: "file", node_id: id });

/* ── 1. a model alone ── */

const alone: NodeTree[] = [
  node("a-p1", "prompt", { text: "Write a two-line poem about a fox in the snow, for the back of a postcard.", tool: "claude", model: "Opus 5.5" }, 1),
  node("a-r1", "result", { summary: "A two-line poem for the postcard", uses: [out("a-p1")] }, 2),
];

/* ── 2. retrieval ── */

const retrieval: NodeTree[] = [
  node("r-f1", "document", { title: "lease-2024.pdf", summary: "The flat's lease" }, 1),
  node("r-f2", "document", { title: "tenancy-guide.pdf", summary: "The council's guide for tenants" }, 2),
  node("r-p1", "prompt", { text: "Using the lease and the council's guide, list what the landlord must fix and how fast.", tool: "gemini-notebook", uses: [file("r-f1"), file("r-f2")] }, 3),
  node("r-r1", "result", { summary: "What the landlord must fix, with the clause for each", uses: [out("r-p1")] }, 4),
];

/* ── 3. an agent with tools ── */

const agent: NodeTree[] = [
  node("g-t1", "integration", { service: "Gmail" }, 1),
  node("g-t2", "integration", { service: "GitHub Copilot" }, 2),
  node(
    "g-a1",
    "agent_config",
    {
      system_prompt: "Read new issue emails, open a matching GitHub issue, and reply with its link.",
      model: "Opus 5.5",
      harness: "hermes-agent",
      models: [
        { model: "Opus 5.5", role: "main" },
        { model: "Haiku 5.5", role: "other" },
      ],
      tools: [{ tool_ref: "g-t1" }, { tool_ref: "g-t2" }],
      runs: { how: "event", detail: "a new issue email" },
    },
    3,
    {
      title: "Issue triage",
      children: [
        node("g-p1", "prompt", { text: "Label the issue bug, idea or question before you open it." }, 1, { parent: "g-a1" }),
        node("g-p2", "prompt", { text: "Keep each reply to one line with the link." }, 2, { parent: "g-a1" }),
      ],
    },
  ),
  node("g-r1", "result", { summary: "Issues opened from email, each with a reply", uses: [out("g-a1")] }, 4),
];

/* ── 4. several agents ── */

const lead = node(
  "t-lead",
  "agent_config",
  {
    system_prompt: "Plan the landing page and hand each part to the right agent.",
    model: "Fable 5.1",
    harness: "claude-code",
    models: [
      { model: "Fable 5.1", role: "main" },
      { model: "Sonnet 5.5", role: "acts" },
    ],
  },
  1,
  { parent: "t-team", title: "Lead" },
);
const member = (id: string, position: number, title: string, text: string, model: string, from: string) =>
  node(id, "agent_config", { system_prompt: text, model, harness: "claude-code", uses: [out(from)] }, position, { parent: "t-team", title });

const team: NodeTree[] = [
  node("t-team", "team", {}, 1, {
    title: "Landing page team",
    children: [
      lead,
      member("t-research", 2, "Research", "Find three landing pages like ours and what they lead with.", "Opus 5.5", "t-lead"),
      member("t-build", 3, "Build", "Build the page from the plan and the research.", "Sonnet 5.5", "t-research"),
      member("t-review", 4, "Review", "Check the page against the plan and list what to fix.", "Haiku 5.5", "t-build"),
    ],
  }),
  node("t-r1", "result", { summary: "The landing page, with its research and its review", uses: [out("t-research"), out("t-build"), out("t-review")] }, 2),
];

/* ── 5. mostly code ── */

const APP_TS = `import { serve } from "./server";
import { schema } from "./schema";

export async function main() {
  const db = await schema.connect(process.env.DATABASE_URL);
  serve({ port: 8080, db });
}

main();
`;

const SCHEMA_SQL = `create table bookings (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  name text not null
);
`;

const code: NodeTree[] = [
  node("c-p1", "prompt", { text: "Plan a small booking app: one table, one endpoint, deployed on Vercel.", tool: "cursor", model: "Opus 5" }, 1),
  node("c-p2", "prompt", { text: "Write the server and the schema from the plan.", tool: "cursor", model: "Composer 2.5", uses: [out("c-p1")] }, 2),
  node("c-c1", "code", { source: APP_TS, language: "ts", filename: "app.ts", entrypoint: true, tool: "cursor", model: "Composer 2.5", uses: [out("c-p2")] }, 3),
  node("c-c2", "code", { source: SCHEMA_SQL, language: "sql", filename: "schema.sql", tool: "cursor", model: "Composer 2.5", uses: [out("c-p2")] }, 4),
  node("c-m1", "manual_step", { tool: "vercel", text: "Deployed to Vercel", uses: [out("c-c1"), out("c-c2")] }, 5),
  node("c-r1", "result", { summary: "The booking app, live", url: "https://bookings.example.com", uses: [out("c-m1")] }, 6),
];

/* ── 6. a team that checks itself (CA-03 P9) ── */

const ORDER_FORM_TSX = `import { useState } from "react";

export function OrderForm({ price }: { price: number }) {
  const [loaves, setLoaves] = useState(1);
  const total = Math.round(loaves * price * 100) / 100;
  return <output>{total.toFixed(2)}</output>;
}
`;

const checksLead = node(
  "k-lead",
  "agent_config",
  {
    system_prompt: "Plan the order page and hand research, build and review to the three agents at once.",
    model: "Fable 5.1",
    harness: "claude-code",
    models: [
      { model: "Fable 5.1", role: "main" },
      { model: "Sonnet 5.5", role: "acts" },
    ],
  },
  1,
  { parent: "k-team", title: "Lead" },
);

const teamChecks: NodeTree[] = [
  node("k-t1", "integration", { service: "Gmail" }, 1),
  node("k-t2", "integration", { service: "Google Sheets" }, 2),
  node("k-team", "team", { runs: { how: "parallel", count: 3 } }, 3, {
    title: "Bakery order page team",
    children: [
      checksLead,
      node("k-research", "agent_config", { system_prompt: "Find how three bakeries take orders online and what they ask for.", model: "Opus 5.5", harness: "claude-code", uses: [out("k-lead")] }, 2, { parent: "k-team", title: "Research" }),
      node(
        "k-build",
        "agent_config",
        {
          system_prompt: "Build the order form from the plan, and send each order to the shop's sheet and inbox.",
          model: "Sonnet 5.5",
          harness: "claude-code",
          tools: [{ tool_ref: "k-t1" }, { tool_ref: "k-t2" }],
          memory: "which page sections it already reviewed",
          uses: [out("k-lead")],
        },
        3,
        { parent: "k-team", title: "Build" },
      ),
      node(
        "k-review",
        "agent_config",
        {
          system_prompt: "Review the order page against the plan and list what to change.",
          model: "Haiku 5.5",
          harness: "claude-code",
          runs: { how: "until", detail: "the review has no changes · at most 3 times" },
          uses: [out("k-lead")],
        },
        4,
        { parent: "k-team", title: "Review" },
      ),
    ],
  }),
  node("k-c1", "code", { source: ORDER_FORM_TSX, language: "tsx", filename: "order-form.tsx", entrypoint: true, tool: "claude-code", model: "Sonnet 5.5", uses: [out("k-team")] }, 4),
  node(
    "k-check",
    "eval_run",
    {
      tested: "Places a test order for 2 sourdough loaves",
      passing: "The total shows £9.00",
      on_fail: "The total showed £8.99. The Build agent fixed the rounding and ran it again.",
      passed: 14,
      total: 14,
      run_at: "2026-10-12",
      uses: [out("k-c1")],
    },
    5,
  ),
  node("k-r1", "result", { summary: "The bakery's order page, taking orders", uses: [out("k-c1")] }, 6),
];

/* ── 7. one sitting, then agents (CA-04 P7) ──
   Session 1 in Claude: three prompts, order-form.tsx sent with prompt 2 and menu.pdf sent with the code. Session 2 in
   Claude Code: a setup (CLAUDE.md, the skill order-forms, the server github with two tools, the rule "After a tool
   runs: npm test"), a goal reached in 12 turns, and a team. */

const S1 = "typed-0b1c2d3e-0000-4000-8000-000000000001";
const S2 = "typed-0b1c2d3e-0000-4000-8000-000000000002";

const oneSittingMaking: Making = {
  sessions: [],
  excluded_models: [],
  sessions_meta: {
    [S1]: { tool: "claude", model: "Opus 5.5", date: "2026-10-12" },
    [S2]: { tool: "claude-code", model: "Sonnet 5.5", date: "2026-10-14", goal: { condition: "the order form passes its tests", atMost: 40, reached: "reached", turns: 12 } },
  },
};

const orderFile = node("o-f1", "document", { title: "menu.pdf", summary: "The bakery's menu, with prices" }, 1, { parent: "o-c1" });
const orderCode = node(
  "o-c1",
  "code",
  { source: "export function OrderForm() {\n  return <form>{/* loaves, a total */}</form>;\n}", language: "tsx", filename: "order-form.tsx" },
  1,
  { parent: "o-p2", children: [orderFile] },
);

const oneSitting: NodeTree[] = [
  node("o-p1", "prompt", { text: "Plan an order page for a small bakery: what it asks for and what it shows.", tool: "claude", model: "Opus 5.5", session: S1 }, 1),
  node("o-p2", "prompt", { text: "Build the form from this, with the prices on the menu.", tool: "claude", model: "Opus 5.5", session: S1 }, 2, { children: [orderCode] }),
  node("o-p3", "prompt", { text: "Write the line under the total that says when the order is ready.", tool: "claude", model: "Opus 5.5", session: S1 }, 3),
  node("o-x1", "document", { title: "CLAUDE.md", setup: { session: S2, kind: "instructions" } }, 4),
  node("o-x2", "document", { title: "SKILL.md", path: "order-forms/SKILL.md", setup: { session: S2, kind: "skill" }, skill: { name: "order-forms", description: "Builds an order form for a small shop, with a total that always adds up." } }, 5),
  node(
    "o-x3",
    "integration",
    {
      service: "github",
      setup: { session: S2, kind: "server" },
      server: { type: "http", url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: "${Authorization}" } },
      connection: "mcp",
      runs_at: "web",
      tools_used: { create_pull_request: 2, get_file_contents: 9 },
    },
    6,
  ),
  node("o-x4", "code", { source: "npm test", language: "bash", setup: { session: S2, kind: "rule" }, rule: { when: "After a tool runs" } }, 7),
  node("o-team", "team", { session: S2 }, 8, {
    title: "Order page team",
    children: [
      node("o-lead", "agent_config", { system_prompt: "Plan the order page work and hand it out.", model: "Sonnet 5.5", harness: "claude-code" }, 1, { parent: "o-team", title: "Lead" }),
      node("o-build", "agent_config", { system_prompt: "Build what the lead hands you, with the tests passing.", model: "Sonnet 5.5", harness: "claude-code", uses: [out("o-lead")] }, 2, { parent: "o-team", title: "Build" }),
    ],
  }),
  node("o-r1", "result", { summary: "The bakery's order page", uses: [out("o-team")] }, 9),
];

/* ── 8. runs on GitHub (CA-04 P7): a session from a workflow file, running when a pull request is opened. ── */

const G1 = "typed-0b1c2d3e-0000-4000-8000-000000000003";

const WORKFLOW = [
  "name: Claude review",
  "on:",
  "  pull_request:",
  "    types: [opened]",
  "jobs:",
  "  review:",
  "    runs-on: ubuntu-latest",
  "    steps:",
  "      - uses: anthropics/claude-code-action@v1",
  "        with:",
  '          prompt: "Review this pull request for bugs and say what to fix."',
  "",
].join("\n");

const onGithubMaking: Making = { sessions: [], excluded_models: [], sessions_meta: { [G1]: { tool: "claude-code", date: "2026-10-16" } } };

const onGithub: NodeTree[] = [
  node(
    "w-x1",
    "code",
    {
      source: WORKFLOW,
      language: "yaml",
      filename: "claude.yml",
      setup: { session: G1, kind: "workflow" },
      workflow: { events: [{ name: "pull_request", types: ["opened"] }], prompt: "Review this pull request for bugs and say what to fix." },
    },
    1,
  ),
  node("w-p1", "prompt", { text: "Review this pull request for bugs and say what to fix.", session: G1 }, 2),
];

/* ── 9. everything at once (CA-05 P11) ──
   Every item of CA-04 and CA-05 in one build, saved the way the composer saves it.

   Session 1, Claude, 12 Oct: a welcome email with two words a reader changes, code sent with it, a long session
   (150,000 words) that cost £3.40 and 1.2 million tokens with the start reused, shown to readers, run in the
   background. Session 2, Claude Code, 14 Oct, at the same time as session 3: started with a command, in its own copy
   of the code, with a setup (instructions, a skill read only when needed, a server that needs a sign-in, a rule), a
   goal, an agent on Ollama that tidies its notes, an agent that checks and changes its checklist each round, and a
   check with a test file, 40 cases and three runs. Session 3, Claude Code: a workflow and a prompt. Session 4,
   Ollama: a prompt on Muse Spark Open at 4-bit on the maker's computer. The result is a trained model.

   NOT HERE: the chat marked as summarised and the helpers a session started. The formats on disk do not record
   them (design/audits/composer/ca-05/p4-not-in-the-file.md), so nothing is drawn for them. */

const E1 = "typed-0b1c2d3e-0000-4000-8000-000000000004";
const E2 = "typed-0b1c2d3e-0000-4000-8000-000000000005";
const E3 = "typed-0b1c2d3e-0000-4000-8000-000000000006";
const E4 = "typed-0b1c2d3e-0000-4000-8000-000000000007";

const EMAIL = "Write a welcome email for Ada's Bakery and sign it Ada.";
const BAKERY_AT = EMAIL.indexOf("Ada's Bakery");
const SIGN_AT = EMAIL.lastIndexOf("Ada");

const everythingMaking: Making = {
  sessions: [],
  excluded_models: [],
  sessions_meta: {
    [E1]: { tool: "claude", model: "Opus 5.5", date: "2026-10-12", words: 150_000, cost: 3.4, currency: "GBP", tokens: 1_200_000, cached: 900_000, showCost: true, background: true },
    [E2]: {
      tool: "claude-code",
      model: "Sonnet 5.5",
      date: "2026-10-14",
      goal: { condition: "the order form passes its tests", atMost: 40, reached: "reached", turns: 12 },
      startedWith: "claude --model opus --permission-mode plan --worktree fix-totals --max-turns 8",
      parallelWith: [E3],
      ownCopy: "fix-totals",
    },
    [E3]: { tool: "claude-code", model: "Sonnet 5.5", date: "2026-10-14", parallelWith: [E2], ownCopy: "fix-receipts" },
    [E4]: { tool: "ollama", model: "Muse Spark Open", date: "2026-10-16" },
  },
};

const everythingFile = node("e-f1", "document", { title: "menu.pdf", summary: "The bakery's menu, with prices" }, 1, { parent: "e-c1" });
const everythingCode = node("e-c1", "code", { source: "export const Welcome = () => null;", language: "tsx", filename: "welcome.tsx" }, 1, { parent: "e-p1", children: [everythingFile] });
const casesFile = node("e-tf", "document", { title: "cases.csv", media_id: "m-cases", rows: 40 }, 1, { parent: "e-chk" });
const trainedFile = node("e-tr", "document", { title: "ratings.csv", media_id: "m-ratings", rows: 1200 }, 1, { parent: "e-r1" });

const everything: NodeTree[] = [
  node(
    "e-p1",
    "prompt",
    {
      text: EMAIL,
      tool: "claude",
      model: "Opus 5.5",
      session: E1,
      changes: [
        { start: BAKERY_AT, end: BAKERY_AT + "Ada's Bakery".length },
        { start: SIGN_AT, end: SIGN_AT + 3 },
      ],
    },
    1,
    { children: [everythingCode] },
  ),
  node("e-p2", "prompt", { text: "Make it shorter, and keep the sign-off.", tool: "claude", model: "Opus 5.5", session: E1 }, 2),
  node("e-x1", "document", { title: "CLAUDE.md", setup: { session: E2, kind: "instructions", loaded: "start" } }, 3),
  node("e-x2", "document", { title: "SKILL.md", path: "order-forms/SKILL.md", setup: { session: E2, kind: "skill", loaded: "when-needed" }, skill: { name: "order-forms", description: "Builds an order form for a small shop, with a total that always adds up." } }, 4),
  node(
    "e-x3",
    "integration",
    { service: "github", setup: { session: E2, kind: "server", loaded: "start" }, server: { type: "http", url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: "${Authorization}" } }, connection: "mcp", runs_at: "web", tools_used: { create_pull_request: 2 } },
    5,
  ),
  node("e-x4", "code", { source: "npm test", language: "bash", setup: { session: E2, kind: "rule", loaded: "start" }, rule: { when: "After a tool runs" } }, 6),
  node(
    "e-a1",
    "agent_config",
    {
      system_prompt: "Greet each customer by name, using what you remember of their last order.",
      model: "Muse Spark Open",
      harness: "ollama",
      modelRun: { precision: "4-bit", where: "computer" },
      memory: "Each customer's last order, in a notes file",
      memory_tidy: "Every Sunday, keeps the 50 most useful notes",
      session: E2,
    },
    7,
    { title: "Greeter" },
  ),
  node(
    "e-a2",
    "agent_config",
    {
      system_prompt: "Review the greeting against the checklist and list what to change.",
      model: "Sonnet 5.5",
      harness: "claude-code",
      runs: { how: "until", detail: "the review has no changes · at most 3 times" },
      changes_each_round: "its checklist",
      uses: [out("e-a1")],
      session: E2,
    },
    8,
    { title: "Reviewer" },
  ),
  node(
    "e-chk",
    "eval_run",
    {
      tested: "Greets 40 customers by name",
      passing: "Every greeting names the customer",
      on_fail: "Three greetings had the wrong name. The Reviewer fixed the checklist and it ran again.",
      passed: 40,
      total: 40,
      run_at: "2026-10-15",
      runs: [
        { at: "2026-10-13", passed: 31, total: 40 },
        { at: "2026-10-14", passed: 37, total: 40 },
        { at: "2026-10-15", passed: 40, total: 40 },
      ],
      uses: [out("e-a2")],
      session: E2,
    },
    9,
    { children: [casesFile] },
  ),
  node(
    "e-w1",
    "code",
    {
      source: WORKFLOW,
      language: "yaml",
      filename: "claude.yml",
      setup: { session: E3, kind: "workflow", loaded: "start" },
      workflow: { events: [{ name: "pull_request", types: ["opened"] }], prompt: "Review this pull request for bugs and say what to fix." },
    },
    10,
  ),
  node("e-p3", "prompt", { text: "Review this pull request for bugs and say what to fix.", tool: "claude-code", model: "Sonnet 5.5", session: E3 }, 11),
  node("e-p4", "prompt", { text: "Say hello to a new customer in one line.", tool: "ollama", model: "Muse Spark Open", modelRun: { precision: "4-bit", where: "computer" }, session: E4 }, 12),
  node("e-r1", "result", { summary: "Bakery greeter v2", kind: "trained-model", base_model: "muse-spark-open", method: "Rated answers, ranked by me", uses: [out("e-a2")] }, 13, { children: [trainedFile] }),
];

export const SHAPES: Readonly<Record<ShapeKey, Shape>> = {
  alone: { key: "alone", title: "A fox postcard poem", tree: alone, selected: "a-p1" },
  retrieval: { key: "retrieval", title: "What the landlord must fix", tree: retrieval, selected: "r-p1" },
  agent: { key: "agent", title: "Issue triage from email", tree: agent, selected: "g-a1" },
  team: { key: "team", title: "A landing page by a team", tree: team, selected: "t-lead" },
  code: { key: "code", title: "A booking app", tree: code, selected: "c-c1" },
  "team-checks": { key: "team-checks", title: "A bakery order page that checks itself", tree: teamChecks, selected: "k-build" },
  "one-sitting": { key: "one-sitting", title: "A bakery order page, one sitting then agents", tree: oneSitting, selected: S2, making: oneSittingMaking },
  "runs-on-github": { key: "runs-on-github", title: "A pull request reviewer on GitHub", tree: onGithub, selected: G1, making: onGithubMaking },
  everything: { key: "everything", title: "Everything at once", tree: everything, selected: E2, making: everythingMaking },
};

/** Every node of a tree, parents first. */
export const allNodes = (tree: readonly NodeTree[]): NodeTree[] => tree.flatMap((entry) => [entry, ...allNodes(entry.children ?? [])]);

/**
 * The registry rows these shapes need, transcribed from 20260823130000_node_type_registry_seed.sql and
 * 20261001300000_sandbox_node_types.sql (fields only where a renderer reads them). The registry's colour is left out:
 * the card's hue comes from its category token (BG-P05), and a hex here would be a raw colour in src/.
 */
export const SHAPE_NODE_TYPES: readonly NodeType[] = [
  { key: "prompt", label: "Prompt", category: "instruction", icon: "MessageSquare", renderer: "prompt", copyable: true, is_active: true, sort: 1, schema: { fields: [{ key: "text", label: "Prompt text", type: "text", required: true }, { key: "model", label: "Model", type: "string" }] } },
  {
    key: "agent_config",
    label: "Agent configuration",
    category: "configuration",
    icon: "Bot",
    renderer: "agent_config",
    copyable: true,
    is_active: true,
    sort: 2,
    schema: { fields: [{ key: "system_prompt", label: "System prompt", type: "text", required: true }, { key: "model", label: "Model", type: "string", required: true }, { key: "tools", label: "Tools", type: "list", of: [{ key: "tool_ref", label: "Tool", type: "string", format: "node_id" }] }] },
  },
  { key: "integration", label: "Integration", category: "configuration", icon: "Plug", renderer: "configuration", copyable: false, is_active: true, sort: 4, schema: { fields: [{ key: "service", label: "Service", type: "string", required: true }, { key: "scopes", label: "Scopes", type: "string" }, { key: "notes", label: "Notes", type: "text" }] } },
  {
    key: "code",
    label: "Code",
    category: "artefact",
    icon: "Code2",
    renderer: "artefact",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "language", label: "Language", type: "enum", options: ["ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other"] }, { key: "source", label: "Source", type: "text", required: true }, { key: "filename", label: "Filename", type: "string" }, { key: "entrypoint", label: "Entrypoint", type: "boolean" }] },
  },
  { key: "document", label: "Document", category: "artefact", icon: "FileText", renderer: "artefact", copyable: false, is_active: true, sort: 5, schema: { fields: [{ key: "title", label: "Title", type: "string", required: true }, { key: "url", label: "URL", type: "string", format: "url" }, { key: "summary", label: "Summary", type: "text" }] } },
  { key: "result", label: "Result", category: "evidence", icon: "BarChart3", renderer: "evidence", copyable: false, is_active: true, sort: 1, schema: { fields: [{ key: "summary", label: "Summary", type: "text", required: true }, { key: "media_id", label: "Media", type: "string", format: "media_id" }] } },
  { key: "manual_step", label: "Manual step", category: "narrative", icon: "Hand", renderer: "narrative", copyable: false, is_active: true, sort: 6, schema: { fields: [{ key: "tool", label: "Tool", type: "string", required: true }, { key: "text", label: "What was done", type: "text", required: true }, { key: "media_id", label: "Picture", type: "string", format: "media_id" }] } },
  { key: "team", label: "Team", category: "configuration", icon: "Users", renderer: "configuration", copyable: true, is_active: true, sort: 6, schema: { fields: [] } },
  {
    key: "eval_run",
    label: "Eval run",
    category: "evidence",
    icon: "Gauge",
    renderer: "evidence",
    copyable: false,
    is_active: true,
    sort: 3,
    schema: { fields: [{ key: "harness", label: "Harness", type: "string" }, { key: "dataset_ref", label: "Dataset", type: "string", format: "node_id" }, { key: "score", label: "Score", type: "number" }, { key: "passed", label: "Passed", type: "number" }, { key: "total", label: "Total", type: "number" }, { key: "run_at", label: "Run at", type: "string", format: "timestamp" }] },
  },
] as unknown as NodeType[];

const noop = () => undefined;

const strOf = (payload: unknown, key: string): string | null => {
  const value = (payload as Record<string, unknown> | null)?.[key];
  return typeof value === "string" && value.trim() ? value : null;
};

/** The names, results and Goes into facts the List draws, read as SandboxPage reads them. */
function listFacts(tree: readonly NodeTree[], steps: readonly Step[]) {
  const names: Record<string, string> = {};
  const intoResult = new Set<string>();
  const results: ListResult[] = [];
  const numberOf = new Map(steps.flatMap((step) => [step, ...step.children]).map((step) => [step.id, step.number]));
  for (const entry of tree) {
    if (entry.type === FILE_TYPE) names[entry.id] = strOf(entry.payload, "title") ?? "Untitled file";
    else if (entry.type === TOOL_TYPE) names[entry.id] = strOf(entry.payload, "service") ?? "Tool";
    else if (entry.type === RESULT_TYPE) {
      const outputs = usesOf(entry).filter((use) => use.kind === "output");
      for (const use of outputs) intoResult.add(use.node_id);
      results.push({
        id: entry.id,
        title: strOf(entry.payload, "summary") ?? strOf(entry.payload, "url") ?? "Result",
        holds: resultHoldsWord(resultFactsOf(entry)),
        facts: resultFactsOf(entry),
        from: outputs[0] ? (numberOf.get(outputs[0].node_id) ?? null) : null,
      });
    }
  }
  return { names, intoResult, results };
}

/** CA-06 P7: a shape's tree, its making and its selection; another fixture (postLinks.ts) can hand its own. */
export type ShapeSource = Pick<Shape, "tree" | "making" | "selected">;

const stepsOf = (key: ShapeKey, source: ShapeSource = SHAPES[key]) => {
  const { tree, making } = source;
  const steps = buildSteps(tree);
  return { tree, steps, groups: sessionGroups(steps, making?.sessions ?? [], making?.session_tools ?? {}, sessionsMetaOf(making)) };
};

/** CA-04 P4, P6: each session's setup count and when it runs, as SandboxPage reads them. */
export function sessionFacts(tree: readonly NodeTree[]) {
  const counts: Record<string, number> = {};
  const events = new Map<string, WorkflowEvent[]>();
  for (const item of setupItemsOf(tree)) {
    counts[item.session] = (counts[item.session] ?? 0) + 1;
    if (item.workflow?.events) events.set(item.session, [...(events.get(item.session) ?? []), ...item.workflow.events]);
  }
  return { counts, runsWhen: Object.fromEntries([...events].map(([key, list]) => [key, runsWhenLine(list)])) };
}

export function shapeListProps(key: ShapeKey, source: ShapeSource = SHAPES[key]): BuildListProps {
  const { tree, steps, groups } = stepsOf(key, source);
  const facts = listFacts(tree, steps);
  const { counts, runsWhen } = sessionFacts(tree);
  return {
    phone: false,
    steps,
    dividers: dividers(steps, groups, counts, runsWhen),
    names: facts.names,
    suggestions: [],
    intoResult: facts.intoResult,
    results: facts.results,
    selectedId: source.selected,
    onSelect: noop,
    onRename: noop,
    onMove: noop,
    onRemove: noop,
    onAccept: noop,
    onDismiss: noop,
    onAddPrompt: () => Promise.resolve(true),
    onAddAgentPrompt: () => Promise.resolve(true),
    onAddAgentTo: noop,
    // CA-04 P2: tiles move on the dev page as they do in the composer; nothing is written.
    onNest: () => Promise.resolve(true),
    canNest: (id, parentId) => nestRefusal(tree, id, parentId) === null,
    onOpenSetup: noop,
  };
}

export function shapeMapProps(key: ShapeKey, source: ShapeSource = SHAPES[key]): MapFixture {
  const { tree, steps, groups } = stepsOf(key, source);
  const all = pieces(tree, []);
  const made = madeFilesOf(tree);
  const files: MapPieceLike[] = all.files.map((entry) => ({ id: entry.id, name: entry.name, madeBy: made.get(entry.id) ?? null }));
  return { steps, groups, files, selectedId: source.selected };
}

/** Details for the shape's selected node, or for `selectedId`. */
export function shapeDetailsProps(key: ShapeKey, selectedId: string = SHAPES[key].selected, source: ShapeSource = SHAPES[key]): DetailsPanelProps {
  const { tree, steps, groups } = stepsOf(key, source);
  const facts = listFacts(tree, steps);
  const { counts, runsWhen } = sessionFacts(tree);
  const view = resolveView({
    selectedId,
    steps,
    groups,
    tree,
    sources: sourceSessions(groups, steps, [], {}, counts, runsWhen),
    sourceFiles: sourceFiles(tree, groups, steps),
    promptsState: () => ({ prompts: [], error: false }),
    intoResult: facts.intoResult,
    media: () => undefined,
  });
  return {
    phone: false,
    view,
    inBuild: [],
    onRename: noop,
    onModel: noop,
    onAddUse: noop,
    onRemoveUse: noop,
    onRuns: noop,
    onRemoveInside: noop,
    onToggleSessionPrompt: noop,
    onDownload: noop,
    onFields: noop,
    onAddPicture: noop,
    onUseAsCover: noop,
    onAgentSetup: noop,
    onInstructions: noop,
    // CA-04: the session, its setup, its goal and how a tool was connected are editable on the dev page; nothing is written.
    onSessionMeta: noop,
    onSessionGoal: noop,
    // CA-05: what a session carries, a check's runs, how a model was run, an agent's lines and a trained model's file.
    onSessionExtras: noop,
    onAddPlugin: noop,
    onSessionTogether: noop,
    onCheckRuns: noop,
    onModelRun: noop,
    onAgentNotes: noop,
    onTrainedOn: noop,
    onAddToSetup: noop,
    onNotShared: noop,
    onToolConnection: noop,
  };
}
