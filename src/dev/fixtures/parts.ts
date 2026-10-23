// CA-17 P7 — "Two parts": a tenant portal built in Part A and a support agent in Part B, which starts after Session 2.
//
// The prompt's table names the sessions S1, S2, S4 and "Triage" but not the third session of Part A, and its order would
// put Part B's sessions between Part A's (one session order cannot do that), so the sessions are numbered in the one
// order the build keeps: Part A holds Sessions 1 to 3, Part B holds Sessions 4 and 5. Differences from the board are
// listed in the report. DEV ONLY.

import type { Json } from "@/integrations/supabase/types";
import { buildSteps, sessionGroups, type SessionGroup, type Step } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "@/lib/build/making";
import type { ThreadDoc } from "@/lib/build/thread";
import type { NodeTree } from "@/lib/build/types";

const key = (n: number) => `typed-0b1c2d3e-0000-4000-8000-0000000000a${n}`;
export const PARTS_S = [key(1), key(2), key(3), key(4), key(5)] as const;
export const PARTS_A = "ws-0b1c2d3e-0000-4000-8000-0000000000b1";
export const PARTS_B = "ws-0b1c2d3e-0000-4000-8000-0000000000b2";

export const PARTS_COLOURS = { a: "#8FBFB8", b: "#D98C8C", s2: "#7FA7D9", s4: "#7FB88A", s5: "#B79AD6" } as const;

export const partsMaking: Making = {
  sessions: [],
  excluded_models: [],
  session_order: [...PARTS_S],
  workstreams: [
    { key: PARTS_A, name: "Tenant portal", colour: PARTS_COLOURS.a },
    { key: PARTS_B, name: "Support agent", colour: PARTS_COLOURS.b, startsAfter: PARTS_S[1] },
  ],
  part_labels: "letters",
  map: { on: true, direction: "horizontal", onBuildPage: true },
  sessions_meta: {
    [PARTS_S[0]]: { tool: "claude", model: "Opus 5.5", date: "2026-10-12", title: "Plan the portal", workstream: PARTS_A },
    [PARTS_S[1]]: { tool: "claude-code", model: "Sonnet 5.5", date: "2026-10-13", title: "Build the portal", colour: PARTS_COLOURS.s2, workstream: PARTS_A },
    [PARTS_S[2]]: { tool: "claude-code", model: "Sonnet 5.5", date: "2026-10-14", title: "Fix the sign-in", workstream: PARTS_A },
    [PARTS_S[3]]: { tool: "claude", model: "Opus 5.5", date: "2026-10-14", title: "Support inbox", colour: PARTS_COLOURS.s4, workstream: PARTS_B },
    [PARTS_S[4]]: { tool: "claude-code", model: "Sonnet 5.5", date: "2026-10-15", title: "Triage", colour: PARTS_COLOURS.s5, workstream: PARTS_B },
  },
};

const BUILD = "parts-build";

function node(id: string, type: string, payload: Record<string, unknown>, position: number, children: NodeTree[] = [], parent?: string): NodeTree {
  return {
    id,
    build_id: BUILD,
    parent_id: parent ?? null,
    type,
    title: null,
    note: null,
    payload: payload as Json,
    position,
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-19T09:00:00Z",
    children,
  } as NodeTree;
}

const out = (id: string) => ({ kind: "output", node_id: id });
const prompt = (id: string, session: string, text: string, position: number, uses: unknown[] = [], tool = "claude") =>
  node(id, "prompt", { text, tool, model: tool === "claude" ? "Opus 5.5" : "Sonnet 5.5", session, ...(uses.length ? { uses } : null) }, position);

const rules = node("pt-f1", "document", { title: "support-rules.md", summary: "What the agent may answer, and what it hands to a person" }, 1, [], "pt-p6");

export const partsTree: NodeTree[] = [
  prompt("pt-p1", PARTS_S[0], "Plan a portal where tenants pay rent, see repairs and message the landlord.", 1),
  prompt("pt-p2", PARTS_S[0], "List the screens, in the order a tenant meets them.", 2, [out("pt-p1")]),
  prompt("pt-p3", PARTS_S[1], "Build the sign-in and the rent page from the list of screens.", 3, [out("pt-p2")], "claude-code"),
  prompt("pt-p4", PARTS_S[1], "Add the repairs page, with a photo upload.", 4, [out("pt-p3")], "claude-code"),
  prompt("pt-p5", PARTS_S[2], "The sign-in loops when the link is opened twice. Fix it.", 5, [out("pt-p4")], "claude-code"),
  node("pt-p6", "prompt", { text: "Write the agent that answers tenants from the support rules.", tool: "claude", model: "Opus 5.5", session: PARTS_S[3], uses: [out("pt-p4")] }, 6, [rules]),
  prompt("pt-p7", PARTS_S[4], "Sort each message into repairs, rent or other, and say how sure you are.", 7, [out("pt-p6")], "claude-code"),
  node("pt-r1", "result", { summary: "A portal with an agent that answers tenants", uses: [out("pt-p7")] }, 8),
];

const ref = (to: string) => [{ type: "ref", attrs: { to } }];
const words = (text: string) => ({ type: "text", text });
const linked = (text: string, to: string) => ({ type: "text", text, marks: ref(to) });

/** The post: the second part, the second session and a tile. */
export const partsPost: ThreadDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        words("The portal came first, and the "),
        linked("support agent", `workstream:${PARTS_B}`),
        words(" followed once "),
        linked("session 2", `session:${PARTS_S[1]}`),
        words(" had the repairs page. The "),
        linked("repairs prompt", "node:pt-p4"),
        words(" is the one the agent reads."),
      ],
    },
  ],
} as unknown as ThreadDoc;

/** The build as the composer reads it. */
export function partsBuild(): { tree: NodeTree[]; steps: Step[]; groups: SessionGroup[]; making: Making } {
  const steps = buildSteps(partsTree);
  const groups = sessionGroups(steps, partsMaking.sessions, partsMaking.session_tools ?? {}, sessionsMetaOf(partsMaking), sessionOrderOf(partsMaking));
  return { tree: partsTree, steps, groups, making: partsMaking };
}
