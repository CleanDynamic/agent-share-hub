/* UI-P73 — the build page's steps, as `BuildView` takes them.

   DEV ONLY. The three builds the boards draw: B1 the bakery homepage (four
   sessions, a file, a tool), B3 the weekly research team (a team of four
   agents) and B4 the fox poster (one typed prompt). Each is a placed tree and
   its `builds.making`, put through the same functions the page uses
   (`readerSteps.ts`), so the dev page shows what a reader would be given. */

import { buildCounts, readerMap, readerResults, readerSteps, whatYouNeed, type ReaderMedia } from "@/lib/build/readerSteps";
import type { Making } from "@/lib/build/making";
import type { NodeTree } from "@/lib/build/types";
import type { BuildStepsView } from "@/pages/site/build/buildModel";
import { SHAPES } from "./shapes";

/** CA-04 P7: "one-sitting" and "runs-on-github" are the shapes of the same names (src/dev/fixtures/shapes.ts). */
export type BuildStepsSample = "list" | "team" | "one" | "one-sitting" | "runs-on-github";


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
    source_ref: session ? { source: "transcript", session_id: "x", index: 0, import_session_id: session } : null,
    ...over,
    payload: { text, ...((over.payload as object) ?? {}) },
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
  prompt("p1", 1, "Write a one-page brand brief for a neighbourhood bakery called Crumb. Warm, plain, no clichés. Cover who comes in, what they buy, and how the shop should sound.", "s1", { title: "Brand brief" }),
  prompt("p2", 2, "Write homepage copy from this brief: a hero line, three sections and opening hours. Keep every section under 80 words.", "s2", {
    title: "Homepage copy",
    payload: { uses: [{ kind: "output", node_id: "p1" }] },
  }),
  prompt("p3", 3, "Suggest a five-colour palette for a warm bakery brand. Give hex values and say what each one is for.", "s3", { title: "Palette" }),
  prompt(
    "p4",
    4,
    "Build the homepage from this copy and this palette. Follow CLAUDE.md. Stack: Next.js with the App Router and Tailwind, no other UI libraries. One page, app/page.tsx, with its parts in components/home/. Hero: the full first screen. The hero line from the copy, set large in the display font. The opening hours under it in a smaller line. One button, \"See today's bakes\", that scrolls to the first section. Sections: one for the bread, one for the pastries and one for the coffee, each with its own heading and a short line. Keep the page under 300 lines of markup.",
    "s4",
    {
      title: "Build the homepage",
      payload: {
        uses: [
          { kind: "output", node_id: "p2" },
          { kind: "output", node_id: "p3" },
          { kind: "file", node_id: "f1" },
        ],
      },
    },
  ),
  prompt("p5", 5, "Deploy it to Vercel and give me the link.", "s4"),
  node("f1", { position: 6, type: "document", payload: { title: "CLAUDE.md", media_id: "m-claude" } }),
  node("v1", { position: 7, type: "prerequisite", title: "Vercel", payload: { requirement: "an account" } }),
  node("r1", { position: 8, type: "result", payload: { summary: "crumb-bakery.vercel.app", url: "https://crumb-bakery.vercel.app", uses: [{ kind: "output", node_id: "p5" }] } }),
];

/* ── B3: the team ── */

const teamMaking: Making = {
  excluded_models: [],
  sessions: [{ id: "s1", started_at: "2026-09-29T09:00:00Z", client: "claude-code", model: "claude-opus-5-5", prompts: 2, turns: 4 }],
};

const team = (): NodeTree[] => {
  const agent = (id: string, position: number, title: string, model: string, text: string, payload: object = {}) =>
    node(id, { parent_id: "tm", position, type: "agent_config", title, payload: { system_prompt: text, model, ...payload } });
  return [
    prompt("p1", 1, "Set up a team of agents that writes me a one-page brief every Monday on what changed in UK battery storage that week.", "s1", { title: "Team setup" }),
    prompt("p2", 2, "Every claim needs a source link. If one is missing, send it back.", "s1", { title: "Source rule" }),
    node("tm", {
      position: 3,
      type: "team",
      title: "Research team",
      source_ref: { source: "transcript", session_id: "x", index: 0, import_session_id: "s1" },
      payload: { runs: { how: "schedule", detail: "Mondays 07:00" }, uses: [{ kind: "output", node_id: "p1" }, { kind: "output", node_id: "p2" }] },
      children: [
        agent("a1", 1, "Lead", "claude-sonnet-5-5", "Split this week's topic into three questions. Give one to each researcher."),
        agent("a2", 2, "Researcher", "claude-haiku-5-5", "Answer your question with sources from this week only.", {
          runs: { how: "parallel", count: 3 },
          uses: [{ kind: "output", node_id: "a1" }, { kind: "tool", node_id: "t1" }],
        }),
        agent("a3", 3, "Writer", "claude-opus-5-5", "Combine the three answers into one page. Keep every source link.", {
          uses: [{ kind: "output", node_id: "a2" }, { kind: "file", node_id: "f1" }, { kind: "output", node_id: "a4" }],
        }),
        agent("a4", 4, "Checker", "claude-haiku-5-5", "Check every claim has a working source. Send anything missing back to the writer.", {
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

/* ── B4: one typed prompt ── */

const foxMaking: Making = { sessions: [], excluded_models: [] };
const fox = (): NodeTree[] => [
  prompt("p1", 1, "A fox in loose watercolour, cream paper, one orange wash, lots of white space. Portrait, poster size.", null, { title: "Fox poster", payload: { tool: "chatgpt" } }),
  node("r1", { position: 2, type: "result", payload: { summary: "fox-poster.png", uses: [{ kind: "output", node_id: "p1" }] } }),
];

const SAMPLES: Record<BuildStepsSample, { tree: () => NodeTree[]; making: Making; title: string; outcome: string }> = {
  list: { tree: bakery, making: bakeryMaking, title: "Bakery homepage", outcome: "A homepage for a neighbourhood bakery, from brand brief to live site, made across four AI tools." },
  team: { tree: team, making: teamMaking, title: "Weekly research brief", outcome: "A team of agents that writes a one-page brief every Monday." },
  one: { tree: fox, making: foxMaking, title: "Watercolour fox poster", outcome: "A poster-size fox in loose watercolour, made with one prompt." },
  "one-sitting": {
    tree: () => SHAPES["one-sitting"].tree,
    making: SHAPES["one-sitting"].making as Making,
    title: SHAPES["one-sitting"].title,
    outcome: "An order page planned in one sitting in Claude, then built by a team in Claude Code.",
  },
  "runs-on-github": {
    tree: () => SHAPES["runs-on-github"].tree,
    making: SHAPES["runs-on-github"].making as Making,
    title: SHAPES["runs-on-github"].title,
    outcome: "Claude Code reviews each pull request when it is opened.",
  },
};

/**
 * The steps for one of the boards. The Map is UI-P74, so `mapAvailable` only decides whether the switch shows.
 * `extra` adds placed nodes after the sample's own (CA-03 P5: a check).
 */
export function buildStepsFixture(which: BuildStepsSample = "list", extra: readonly NodeTree[] = []): BuildStepsView & { title: string; outcome: string } {
  const { tree: make, making, title, outcome } = SAMPLES[which];
  const tree = [...make(), ...extra];
  const steps = readerSteps(tree, making, media);
  return {
    title,
    outcome,
    steps,
    results: readerResults(tree, media),
    need: whatYouNeed(steps, tree, making, media),
    counts: buildCounts(steps),
    map: readerMap(tree, making, media),
    mapAvailable: making.sessions.length >= 2 || steps.some((entry) => entry.step.kind === "agent" || entry.step.kind === "team"),
    onCopy: async () => true,
    resolveMedia: () => undefined,
    otherBody: () => null,
    focus: null,
  };
}

