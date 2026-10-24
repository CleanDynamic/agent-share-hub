// CA-21 P0: "Moving": the fixture the build page is moved on.
//
//   Part 1 holds Session 1 (Prompts 1 to 3 and a team of two agents) and Session 2 (an agent, a tool, a decision, a manual step
//   and a file). Part 2 is empty. Numbers label the parts. DEV ONLY.

import type { Json } from "@/integrations/supabase/types";
import { buildSteps, sessionGroups, type SessionGroup, type Step } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "@/lib/build/making";
import type { NodeTree } from "@/lib/build/types";

const key = (n: number) => `typed-0c21c21c-0000-4000-8000-0000000000a${n}`;
export const CA21_S = [key(1), key(2)] as const;
export const CA21_A = "ws-0c21c21c-0000-4000-8000-0000000000b1";
export const CA21_B = "ws-0c21c21c-0000-4000-8000-0000000000b2";

export const ca21Making: Making = {
  sessions: [],
  excluded_models: [],
  session_order: [...CA21_S],
  workstreams: [{ key: CA21_A }, { key: CA21_B }],
  part_labels: "numbers",
  sessions_meta: {
    [CA21_S[0]]: { tool: "claude", model: "Opus 5.5", date: "2026-10-19", title: "Plan the order page", workstream: CA21_A },
    [CA21_S[1]]: { tool: "claude-code", model: "Sonnet 5.5", date: "2026-10-20", title: "Build it", workstream: CA21_A },
  },
};

const BUILD = "ca21-build";

function node(id: string, type: string, payload: Record<string, unknown>, position: number, extra: { title?: string | null; parent?: string; children?: NodeTree[] } = {}): NodeTree {
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
    created_at: "2026-10-20T09:00:00Z",
    children: extra.children ?? [],
  } as NodeTree;
}

const prompt = (id: string, session: string, text: string, position: number) => node(id, "prompt", { text, tool: "claude", model: "Opus 5.5", session }, position);
const agent = (id: string, parent: string, title: string, text: string, position: number) => node(id, "agent_config", { system_prompt: text, model: "Sonnet 5.5", harness: "claude-code" }, position, { parent, title });

export const ca21Tree: NodeTree[] = [
  prompt("c21-p1", CA21_S[0], "Plan an order page for a bakery: a menu, a basket and a pick-up time.", 1),
  prompt("c21-p2", CA21_S[0], "List the screens, in the order a customer meets them.", 2),
  prompt("c21-p3", CA21_S[0], "Write the words on each screen, short and warm.", 3),
  node("c21-team", "team", { session: CA21_S[0] }, 4, { title: "Support team", children: [agent("c21-a1", "c21-team", "Lead", "Plan the answers to customer questions.", 1), agent("c21-a2", "c21-team", "Writer", "Write each answer in two lines.", 2)] }),
  node("c21-agent", "agent_config", { system_prompt: "Answer customers from the menu and the opening hours.", model: "Sonnet 5.5", harness: "claude-code", session: CA21_S[1] }, 5, { title: "Order helper" }),
  node("c21-tool", "integration", { service: "Gmail", step: true, session: CA21_S[1] }, 6),
  node("c21-decision", "decision", { name: "Route", questions: [{ id: "team", type: "choice", instructions: "Which team answers?", options: [{ key: "orders" }, { key: "refunds" }] }], session: CA21_S[1] }, 7),
  node("c21-manual", "manual_step", { tool: "vercel", text: "Put the order page live on the bakery's domain.", session: CA21_S[1] }, 8, { title: "Go live" }),
  node("c21-file", "document", { title: "menu.pdf", summary: "This week's menu", step: true, session: CA21_S[1] }, 9),
];

/** The build as the composer reads it. */
export function ca21Build(): { tree: NodeTree[]; steps: Step[]; groups: SessionGroup[]; making: Making } {
  const steps = buildSteps(ca21Tree);
  const groups = sessionGroups(steps, ca21Making.sessions, ca21Making.session_tools ?? {}, sessionsMetaOf(ca21Making), sessionOrderOf(ca21Making));
  return { tree: ca21Tree, steps, groups, making: ca21Making };
}
