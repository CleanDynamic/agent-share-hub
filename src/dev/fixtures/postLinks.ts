// CA-06 P7 — "A post with links": CA-04's "One sitting, then agents" build, with a check in its second session, three
// parts coloured by the maker, and a post that links two sessions, a prompt, a team's agent, the check and the code
// tile sent with a prompt, and one link to a tile that has been deleted.

import { buildSteps, sessionGroups, type SessionGroup, type Step } from "@/lib/build/graph";
import { sessionsMetaOf, type Making } from "@/lib/build/making";
import type { ThreadDoc } from "@/lib/build/thread";
import type { Json } from "@/integrations/supabase/types";
import type { NodeTree } from "@/lib/build/types";

import { SHAPES } from "./shapes";

const one = SHAPES["one-sitting"];

/** The two sessions' keys, as the one-sitting shape writes them. */
export const LINKS_S1 = Object.keys(one.making?.sessions_meta ?? {})[0] as string;
export const LINKS_S2 = Object.keys(one.making?.sessions_meta ?? {})[1] as string;

/** The three colours the maker chose: the second session, prompt 2 and the code sent with it. */
export const LINKS_COLOURS = { session: "#7FA7D9", prompt: "#C9A86B", code: "#B79AD6" } as const;

const colour = (entry: NodeTree, hex: string): NodeTree => ({ ...entry, payload: { ...(entry.payload as Record<string, unknown>), colour: hex } as Json });

function recolour(tree: readonly NodeTree[]): NodeTree[] {
  return tree.map((entry) => {
    const children = entry.children ? recolour(entry.children) : entry.children;
    const own = { ...entry, children } as NodeTree;
    if (entry.id === "o-p2") return colour(own, LINKS_COLOURS.prompt);
    if (entry.id === "o-c1") return colour(own, LINKS_COLOURS.code);
    return own;
  });
}

const check: NodeTree = {
  id: "o-k1",
  build_id: "fixture-build",
  parent_id: null,
  type: "eval_run",
  title: "Totals add up",
  note: null,
  payload: {
    tested: "The order form's total for every basket in cases.csv",
    passing: "Every total matches the menu to the penny",
    on_fail: "The rounding of a half loaf was off by a penny; fixed in the form.",
    passed: 40,
    total: 40,
    run_at: "2026-10-14",
    runs: [
      { at: "2026-10-14", passed: 40, total: 40 },
      { at: "2026-10-13", passed: 39, total: 40 },
    ],
    session: LINKS_S2,
  } as Json,
  position: 10,
  source_ref: null,
  event_id: null,
  is_gap: false,
  created_at: "",
  children: [],
} as unknown as NodeTree;

export const linksTree: NodeTree[] = [...recolour(one.tree), check];

export const linksMaking: Making = {
  ...(one.making as Making),
  sessions_meta: {
    ...(one.making?.sessions_meta ?? {}),
    [LINKS_S2]: { ...(one.making?.sessions_meta?.[LINKS_S2] ?? { tool: null, date: "" }), colour: LINKS_COLOURS.session },
  },
};

const ref = (to: string) => [{ type: "ref", attrs: { to } }];
const words = (text: string) => ({ type: "text", text });
const linked = (text: string, to: string) => ({ type: "text", text, marks: ref(to) });

/** The post: every kind of link, one coloured session, one plain one, and one to a tile that is gone. */
export const linksPost: ThreadDoc = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        words("We planned the page in one sitting, "),
        linked("session 1", `session:${LINKS_S1}`),
        words(", and the "),
        linked("form prompt", "node:o-p2"),
        words(" did the heavy lifting. The "),
        linked("order form code", "node:o-c1"),
        words(" came out of it whole."),
      ],
    },
    { type: "postBreak" },
    {
      type: "paragraph",
      content: [
        words("Then the agents took over in "),
        linked("session 2", `session:${LINKS_S2}`),
        words(": the "),
        linked("build agent", "node:o-build"),
        words(" wrote it and "),
        linked("the totals check", "node:o-k1"),
        words(" kept it honest. My "),
        linked("first sketch", "node:o-gone"),
        words(" is gone now."),
      ],
    },
  ],
} as unknown as ThreadDoc;

/** The build as the composer reads it. */
export function linksBuild(): { tree: NodeTree[]; steps: Step[]; groups: SessionGroup[]; making: Making } {
  const steps = buildSteps(linksTree);
  const groups = sessionGroups(steps, linksMaking.sessions, linksMaking.session_tools ?? {}, sessionsMetaOf(linksMaking));
  return { tree: linksTree, steps, groups, making: linksMaking };
}
