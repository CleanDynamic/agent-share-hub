// CA-22 P0: "Motion": the fixture the build page's sixteen moments are shown on.
//
//   Part 1 holds Session 1 (Prompts 1 to 4, Prompt 2 holding a nested prompt) and Session 2 (an agent and a manual step).
//   Part 2 holds Session 3 (one prompt).
//   A post whose linked words point at Prompt 3.
//
// `?tiles=300` (the dev page) adds a long session of prompts for the smoothness measures. DEV ONLY.

import type { Json } from "@/integrations/supabase/types";
import { buildSteps, sessionGroups, type SessionGroup, type Step } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "@/lib/build/making";
import type { NodeTree } from "@/lib/build/types";

const key = (n: number) => `typed-0c22c22c-0000-4000-8000-0000000000a${n}`;
export const CA22_S = [key(1), key(2), key(3)] as const;
export const CA22_A = "ws-0c22c22c-0000-4000-8000-0000000000b1";
export const CA22_B = "ws-0c22c22c-0000-4000-8000-0000000000b2";
export const CA22_LONG = key(9);

export const ca22Making: Making = {
  sessions: [],
  excluded_models: [],
  session_order: [...CA22_S],
  workstreams: [{ key: CA22_A }, { key: CA22_B }],
  part_labels: "numbers",
  sessions_meta: {
    [CA22_S[0]]: { tool: "claude", model: "Opus 5.5", date: "2026-10-19", title: "Plan the order page", workstream: CA22_A },
    [CA22_S[1]]: { tool: "claude-code", model: "Sonnet 5.5", date: "2026-10-20", title: "Build it", workstream: CA22_A },
    [CA22_S[2]]: { tool: "claude", model: "Opus 5.5", date: "2026-10-21", title: "Check it", workstream: CA22_B },
  },
};

const BUILD = "ca22-build";

export function node(id: string, type: string, payload: Record<string, unknown>, position: number, extra: { title?: string | null; parent?: string; children?: NodeTree[] } = {}): NodeTree {
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
    created_at: "2026-10-21T09:00:00Z",
    children: extra.children ?? [],
  } as NodeTree;
}

export const prompt = (id: string, session: string, text: string, position: number, children: NodeTree[] = []): NodeTree =>
  node(id, "prompt", { text, tool: "claude", model: "Opus 5.5", session }, position, { children });

export const ca22Tree: NodeTree[] = [
  prompt("c22-p1", CA22_S[0], "Plan an order page for a bakery: a menu, a basket and a pick-up time.", 1),
  prompt("c22-p2", CA22_S[0], "List the screens, in the order a customer meets them.", 2, [
    { ...prompt("c22-p2n", CA22_S[0], "Keep each screen to one idea.", 1), parent_id: "c22-p2" } as NodeTree,
  ]),
  prompt("c22-p3", CA22_S[0], "Write the words on each screen, short and warm.", 3),
  prompt("c22-p4", CA22_S[0], "Check the words against the menu.", 4),
  node("c22-agent", "agent_config", { system_prompt: "Answer customers from the menu and the opening hours.", model: "Sonnet 5.5", harness: "claude-code", session: CA22_S[1] }, 5, { title: "Order helper" }),
  node("c22-manual", "manual_step", { tool: "vercel", text: "Put the order page live on the bakery's domain.", session: CA22_S[1] }, 6, { title: "Go live" }),
  prompt("c22-p5", CA22_S[2], "Try the page on a phone and write down what is hard to tap.", 7),
];

/** The post: "Start with the plan, then the words." with "the words" linked to Prompt 3. */
export const ca22Post = () => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Start with the plan, then " },
        { type: "text", text: "the words", marks: [{ type: "ref", attrs: { to: "node:c22-p3" } }] },
        { type: "text", text: "." },
      ],
    },
  ],
});

/** `count` more prompts in one long session, for the smoothness measures. */
export function ca22Long(count: number): NodeTree[] {
  return Array.from({ length: count }, (_, at) => prompt(`c22-long-${at + 1}`, CA22_LONG, `Prompt ${at + 1} of the long session: write one more screen of the order page.`, 100 + at));
}

export function ca22Build(extra = 0): { tree: NodeTree[]; steps: Step[]; groups: SessionGroup[]; making: Making } {
  const tree = [...ca22Tree, ...ca22Long(extra)];
  const making: Making = extra > 0 ? { ...ca22Making, session_order: [...CA22_S, CA22_LONG], sessions_meta: { ...ca22Making.sessions_meta, [CA22_LONG]: { tool: "claude", model: "Opus 5.5", date: "2026-10-22", title: "A long session", workstream: CA22_B } } } : ca22Making;
  const steps = buildSteps(tree);
  const groups = sessionGroups(steps, making.sessions, making.session_tools ?? {}, sessionsMetaOf(making), sessionOrderOf(making));
  return { tree, steps, groups, making };
}
