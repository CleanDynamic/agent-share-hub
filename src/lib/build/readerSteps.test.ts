// UI-P72 — reader steps, What you need, Copy for AI. The fixtures are the boards:
// B1 the bakery homepage, B3 the weekly research team, B4 the fox poster.

import { describe, expect, it, vi } from "vitest";

vi.mock("./nodes", () => ({ upsertNode: vi.fn(), getNodeTree: vi.fn(), reorderNodes: vi.fn(), deleteNode: vi.fn() }));
vi.mock("./nodeTypes", () => ({ getNodeType: vi.fn() }));
vi.mock("./media", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./media")>()),
  mediaUrl: (m: { path: string }) => `https://files.test/${m.path}`,
}));

import type { Making } from "./making";
import { buildCounts, readerResults, readerSteps, stepsMarkdown, whatYouNeed, type ReaderMedia } from "./readerSteps";
import type { NodeTree } from "./types";

const node = (id: string, over: Partial<NodeTree>): NodeTree =>
  ({
    id,
    build_id: "b",
    parent_id: null,
    position: 1,
    type: "prompt",
    title: null,
    note: null,
    payload: {},
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-07T09:00:00.000Z",
    children: [],
    ...over,
  }) as NodeTree;

const prompt = (id: string, position: number, text: string, session: string | null, over: Partial<NodeTree> = {}) =>
  node(id, {
    position,
    payload: { text, ...(over.payload as object) },
    source_ref: session ? { source: "transcript", session_id: "x", index: 0, import_session_id: session } : null,
    ...over,
    ...(over.payload ? { payload: { text, ...(over.payload as object) } } : null),
  });

const media = new Map<string, ReaderMedia>([
  ["m-claude", { id: "m-claude", bucket: "build-media", path: "b/claude.md", kind: "file", bytes: 1228 }],
  ["m-tpl", { id: "m-tpl", bucket: "build-media", path: "b/template.md", kind: "file", bytes: 819 }],
]);

/* ── B1: the bakery ── */

const bakeryMaking: Making = {
  excluded_models: [],
  sessions: [
    { id: "s1", started_at: "2026-10-03T09:00:00Z", client: "chatgpt", model: "gpt-6-astra", prompts: 1, turns: 2 },
    { id: "s2", started_at: "2026-10-04T09:00:00Z", client: "claude", model: "claude-opus-5-5", prompts: 1, turns: 2 },
    { id: "s3", started_at: "2026-10-04T12:00:00Z", client: "gemini", model: "gemini-4-argon", prompts: 1, turns: 2 },
    { id: "s4", started_at: "2026-10-06T09:00:00Z", client: "claude-code", model: "claude-sonnet-5-5", prompts: 2, turns: 4 },
  ],
};

const bakery = (): NodeTree[] => [
  prompt("p1", 1, "Write a one-page brand brief.", "s1", { title: "Brand brief" }),
  prompt("p2", 2, "Write homepage copy from this brief.", "s2", { title: "Homepage copy", payload: { uses: [{ kind: "output", node_id: "p1" }] } }),
  prompt("p3", 3, "Suggest a palette.", "s3", { title: "Palette" }),
  prompt("p4", 4, "Build the homepage. Follow CLAUDE.md.", "s4", {
    title: "Build the homepage",
    payload: {
      uses: [
        { kind: "output", node_id: "p2" },
        { kind: "output", node_id: "p3" },
        { kind: "file", node_id: "f1" },
      ],
      dismissed: ["file:f9"],
    },
  }),
  prompt("p5", 5, "Deploy it to Vercel.", "s4"),
  node("f1", { position: 6, type: "document", payload: { title: "CLAUDE.md", media_id: "m-claude" } }),
  node("v1", { position: 7, type: "prerequisite", title: "Vercel", payload: { requirement: "an account" } }),
  node("r1", { position: 8, type: "result", payload: { summary: "crumb-bakery.vercel.app", url: "https://crumb-bakery.vercel.app", uses: [{ kind: "output", node_id: "p5" }] } }),
];

describe("readerSteps — B1 the bakery", () => {
  const steps = readerSteps(bakery(), bakeryMaking, media);

  it("starts each session with a new chat", () => {
    expect(steps[0].chat).toMatchObject({ kind: "new", headline: "New chat in ChatGPT", detail: "GPT-6 Astra · session 1 · 3 Oct" });
    expect(steps[3].chat).toMatchObject({ kind: "new", headline: "New chat in Claude Code", detail: "Sonnet 5.5 · session 4 · 6 Oct" });
  });
  it("pastes in what an earlier step gave", () => {
    expect(steps[1].pasteIns).toEqual([{ stepId: "p1", number: "1", title: "Brand brief", text: "what step 1 gave you" }]);
  });
  it("step 4 pastes in 2 and 3 and attaches CLAUDE.md with its size and download", () => {
    expect(steps[3].pasteIns.map((p) => p.number)).toEqual(["2", "3"]);
    expect(steps[3].attach).toEqual([
      { id: "f1", name: "CLAUDE.md", mediaId: "m-claude", bytes: 1228, size: "1.2 KB", download: "https://files.test/b/claude.md" },
    ]);
  });
  it("step 5 is sent in the same chat as step 4", () => {
    expect(steps[4].chat).toEqual({ kind: "same", step: "4", text: "Send in the same chat as step 4" });
  });
  it("never reads dismissed suggestions", () => {
    expect(JSON.stringify(steps)).not.toContain("f9");
  });

  it("What you need: tools and models, files, time", () => {
    const need = whatYouNeed(steps, bakery(), bakeryMaking, media);
    expect(need.map((g) => g.key)).toEqual(["tools", "files", "time"]);
    expect(need[0].rows).toEqual([
      { title: "ChatGPT", detail: "GPT-6 Astra · step 1" },
      { title: "Claude", detail: "Opus 5.5 · step 2" },
      { title: "Gemini 4 Argon", detail: "step 3" },
      { title: "Claude Code", detail: "Sonnet 5.5 · steps 4–5" },
      { title: "Vercel", detail: "an account" },
    ]);
    expect(need[1].rows).toEqual([{ title: "CLAUDE.md", detail: "step 4 · 1.2 KB", download: "https://files.test/b/claude.md" }]);
    expect(need[2].rows).toEqual([{ title: "4 sessions over 3 days", detail: "3–6 Oct" }]);
  });

  it("the heading counts what is there", () => {
    expect(buildCounts(steps)).toBe("4 sessions · 5 prompts · 1 file · 3–6 Oct");
  });

  it("Copy for AI text, whole", () => {
    const md = stepsMarkdown({ title: "Bakery homepage", outcome: "A homepage for a bakery." }, steps, readerResults(bakery(), media));
    expect(md).toMatchInlineSnapshot(`
      "# Bakery homepage

      A homepage for a bakery.

      Repeat this build in 5 steps.

      ## Step 1 · Brand brief

      New chat in ChatGPT (GPT-6 Astra).

      \`\`\`
      Write a one-page brand brief.
      \`\`\`

      ## Step 2 · Homepage copy

      New chat in Claude (Opus 5.5).

      Paste in what step 1 gave you (Brand brief).

      \`\`\`
      Write homepage copy from this brief.
      \`\`\`

      ## Step 3 · Palette

      New chat (Gemini 4 Argon).

      \`\`\`
      Suggest a palette.
      \`\`\`

      ## Step 4 · Build the homepage

      New chat in Claude Code (Sonnet 5.5).

      Paste in what step 2 gave you (Homepage copy).
      Paste in what step 3 gave you (Palette).
      Attach CLAUDE.md: https://files.test/b/claude.md.

      \`\`\`
      Build the homepage. Follow CLAUDE.md.
      \`\`\`

      ## Step 5 · Prompt 5

      Send in the same chat as step 4.

      \`\`\`
      Deploy it to Vercel.
      \`\`\`

      ## Result

      https://crumb-bakery.vercel.app (from step 5)
      "
    `);
  });

  it("a text with its own code fence still appears whole", () => {
    const tree = [prompt("p1", 1, "Run:\n```sh\nls\n```\ndone", "s1")];
    const md = stepsMarkdown({ title: "T" }, readerSteps(tree, bakeryMaking));
    expect(md).toContain("````\nRun:\n```sh\nls\n```\ndone\n````");
  });
});

/* ── B3: the team ── */

const teamMaking: Making = {
  excluded_models: [],
  sessions: [{ id: "s1", started_at: "2026-09-29T09:00:00Z", client: "claude-code", model: "claude-opus-5-5", prompts: 2, turns: 4 }],
};

const team = (): NodeTree[] => {
  const agent = (id: string, position: number, title: string, model: string, text: string, payload: object = {}) =>
    node(id, { parent_id: "tm", position, type: "agent_config", title, payload: { system_prompt: text, model, ...payload } });
  return [
    prompt("p1", 1, "Set up a team of agents.", "s1", { title: "Team setup" }),
    prompt("p2", 2, "Every claim needs a source link.", "s1", { title: "Source rule" }),
    node("tm", {
      position: 3,
      type: "team",
      title: "Research team",
      source_ref: { source: "transcript", session_id: "x", index: 0, import_session_id: "s1" },
      payload: { runs: { how: "schedule", detail: "Mondays 07:00" }, uses: [{ kind: "output", node_id: "p1" }, { kind: "output", node_id: "p2" }] },
      children: [
        agent("a1", 1, "Lead", "claude-sonnet-5-5", "Split the topic into three questions."),
        agent("a2", 2, "Researcher", "claude-haiku-5-5", "Answer with sources.", {
          runs: { how: "parallel", count: 3 },
          uses: [{ kind: "output", node_id: "a1" }, { kind: "tool", node_id: "t1" }],
        }),
        agent("a3", 3, "Writer", "claude-opus-5-5", "Combine the answers.", {
          uses: [{ kind: "output", node_id: "a2" }, { kind: "file", node_id: "f1" }, { kind: "output", node_id: "a4" }],
        }),
        agent("a4", 4, "Checker", "claude-haiku-5-5", "Check every claim.", {
          runs: { how: "until", detail: "every claim has a source" },
          uses: [{ kind: "output", node_id: "a3" }],
        }),
      ],
    }),
    node("f1", { position: 4, type: "document", payload: { title: "template.md", media_id: "m-tpl" } }),
    node("t1", { position: 5, type: "integration", payload: { service: "Web search" } }),
    node("r1", { position: 6, type: "result", payload: { summary: "brief-6-oct.pdf", uses: [{ kind: "output", node_id: "a4" }] } }),
  ];
};

describe("readerSteps — B3 the team", () => {
  const steps = readerSteps(team(), teamMaking, media);
  const [, , tm] = steps;

  it("says Uses inside an agent or a team, never Paste in", () => {
    const [lead, researcher, writer, checker] = tm.children;
    expect(lead.uses).toEqual([]);
    expect(researcher.uses).toEqual(["what 3.1 gives it", "Web search · tool"]);
    expect(writer.uses).toEqual(["what 3.2 gives it × 3", "template.md", "what 3.4 sends back"]);
    expect(checker.uses).toEqual(["what 3.3 gives it"]);
    expect(JSON.stringify(tm)).not.toMatch(/Paste in/);
  });
  it("carries its runs, where it was made and when it last ran", () => {
    expect(tm.runs).toBe("Runs on a schedule · Mondays 07:00");
    expect(tm.madeIn).toBe("made in steps 1 and 2");
    expect(tm.runsByItself).toBe("runs by itself · last run 29 Sep, 09:00");
  });
  it("the last agent of the loop goes into 3.3, until the condition, then the result", () => {
    expect(tm.children[3].goesInto).toEqual(["3.3, until every claim has a source", "then the result"]);
    expect(tm.children[0].goesInto).toEqual([]);
  });
  it("What you need: the columns row for row", () => {
    const need = whatYouNeed(steps, team(), teamMaking, media);
    expect(need.map((g) => g.key)).toEqual(["tools", "files", "runs"]);
    expect(need[0].rows).toEqual([
      { title: "Claude Code", detail: "Opus 5.5 · steps 1–2" },
      { title: "Sonnet 5.5", detail: "agent 3.1" },
      { title: "Haiku 5.5", detail: "agents 3.2 and 3.4" },
      { title: "Opus 5.5", detail: "agent 3.3" },
      { title: "Web search", detail: "tool · agent 3.2" },
    ]);
    expect(need[1].rows).toEqual([{ title: "template.md", detail: "agent 3.3 · 0.8 KB", download: "https://files.test/b/template.md" }]);
    expect(need[2].rows).toEqual([{ title: "On a schedule", detail: "Mondays 07:00 · 6 agents a run" }]);
  });
  it("the heading", () => {
    expect(buildCounts(steps)).toBe("1 session · 1 team · 4 agents · 2 prompts · 1 file · 29 Sep");
  });
  it("Copy for AI writes each sub-step with its uses and its whole text", () => {
    const md = stepsMarkdown({ title: "Weekly research brief" }, steps);
    expect(md).toContain("## Step 3 · Research team\n\nRuns on a schedule · Mondays 07:00 · made in steps 1 and 2.");
    expect(md).toContain("### 3.3 Writer · Opus 5.5\n\nUses what 3.2 gives it × 3, template.md and what 3.4 sends back.");
    expect(md).toContain("### 3.4 Checker · Haiku 5.5\n\nRepeats until a condition is met · every claim has a source.");
    expect(md).toContain("Goes into 3.3, until every claim has a source, then the result.");
    for (const text of ["Split the topic into three questions.", "Answer with sources.", "Combine the answers.", "Check every claim."]) {
      expect(md).toContain(text);
    }
  });
});

/* ── B4: one typed prompt, and the rest ── */

describe("readerSteps — B4 and the edges", () => {
  it("a typed prompt is a new chat in its own tool, with no model recorded", () => {
    const tree = [prompt("p1", 1, "A fox in loose watercolour.", null, { title: "Fox poster", payload: { tool: "chatgpt" } })];
    const [step] = readerSteps(tree, { sessions: [], excluded_models: [] });
    expect(step.chat).toMatchObject({ kind: "new", typed: true, headline: "New chat in ChatGPT", detail: "model not recorded · typed in by the maker" });
    const need = whatYouNeed([step], tree, { sessions: [], excluded_models: [] });
    expect(need).toEqual([{ key: "tools", label: "Tools and models", rows: [{ title: "ChatGPT", detail: "model not recorded · step 1" }] }]);
    expect(buildCounts([step])).toBe("1 prompt");
  });

  it("a manual step reads 'By hand in {tool}' with nothing to copy", () => {
    const tree = [node("m1", { position: 1, type: "manual_step", payload: { tool: "Figma", text: "Draw the logo", media_id: "m-x" } })];
    const [step] = readerSteps(tree, null);
    expect(step.manual).toEqual({ headline: "By hand in Figma", line: "Draw the logo", mediaId: "m-x" });
    expect(step.chat).toBeNull();
    expect(stepsMarkdown({ title: "T" }, [step])).toContain("By hand in Figma: Draw the logo.");
  });

  it("an old build with no id in making.sessions still groups by source_ref.import_session_id", () => {
    const tree = [prompt("p1", 1, "One.", "s1"), prompt("p2", 2, "Two.", "s1")];
    const old: Making = { sessions: [{ client: "claude", model: "claude-opus-5-5", prompts: 2, turns: 2 }], excluded_models: [] };
    const steps = readerSteps(tree, old);
    expect(steps[0].chat).toMatchObject({ kind: "new", session: 1, headline: "New chat", detail: "model not recorded · session 1" });
    expect(steps[1].chat).toMatchObject({ kind: "same", step: "1" });
  });

  it("a build with a system_prompt part lists it under Other parts, and the cover's evidence is not one", () => {
    const tree = [
      prompt("p1", 1, "One.", null, { payload: { tool: "claude" } }),
      node("sp", { position: 2, type: "system_prompt", title: "House style", payload: {} }),
      node("sh", { position: 3, type: "screenshot", title: "Shot", payload: {} }),
    ];
    const need = whatYouNeed(readerSteps(tree, null), tree, null);
    expect(need.find((g) => g.key === "other")).toEqual({ key: "other", label: "Other parts", rows: [{ id: "sp", title: "House style", detail: "system_prompt" }] });
  });

  it("leaves Time out for one session or no dates", () => {
    const tree = [prompt("p1", 1, "One.", "s1")];
    const one: Making = { sessions: [{ id: "s1", started_at: "2026-10-03T09:00:00Z", client: "claude", model: null, prompts: 1, turns: 1 }], excluded_models: [] };
    expect(whatYouNeed(readerSteps(tree, one), tree, one).some((g) => g.key === "time")).toBe(false);
    const undated: Making = { sessions: [{ client: "claude", model: null, prompts: 1, turns: 1 }, { client: "claude", model: null, prompts: 1, turns: 1 }], excluded_models: [] };
    expect(whatYouNeed(readerSteps(tree, undated), tree, undated).some((g) => g.key === "time")).toBe(false);
  });
});
