// CA-27 P0: "Large builds": the fixture the build page's find, truncation, large-build and tablet checks run on.
//
//   300 tiles in 20 sessions over 3 parts, with long titles and long prompts. Some tiles are manual steps and files. The word
//   "sourdough" stands in exactly five tiles (Find shows "1 of 5"); "Cinnamon" is in a part's name, a session's title and an app's
//   name. `ca27Build()` is the build as the composer reads it. DEV ONLY.

import type { Json } from "@/integrations/supabase/types";
import { buildSteps, sessionGroups, type SessionGroup, type Step } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, storedWorkstreamsOf, type Making } from "@/lib/build/making";
import type { NodeTree } from "@/lib/build/types";

export const CA27_SESSIONS = 20;
export const CA27_TILES = 300;
/** The word that stands in five tiles. */
export const CA27_WORD = "sourdough";

const key = (n: number) => `typed-0c27c27c-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const CA27_S = Array.from({ length: CA27_SESSIONS }, (_, at) => key(at + 1));
export const CA27_P = ["ws-0c27c27c-0000-4000-8000-0000000000b1", "ws-0c27c27c-0000-4000-8000-0000000000b2", "ws-0c27c27c-0000-4000-8000-0000000000b3"] as const;

/** A title no column can hold on one line. */
export const LONG_TITLE = "Plan the whole weekend rota for the bakery, the two market stalls and the supplier deliveries, with a note on who covers early starts";
/** A prompt of several lines. */
export const LONG_PROMPT =
  "Write the order page for a bakery with three shops. Start from the menu, then the basket, then the pick-up time. Keep every screen to one idea, name each button with a verb, and say what happens next in the same breath. Where a loaf sells out before noon, say so on the menu line and offer the next best thing. Never ask for an account before the basket is full.";
/** One long word with no break in it. */
export const LONG_WORD = "wholegrainseededcountryryeloafwithmalteddurumwheatandtoastedsesameseedcrust".repeat(2);

const BUILD = "ca27-build";

function node(id: string, type: string, payload: Record<string, unknown>, position: number, title: string | null = null): NodeTree {
  return {
    id,
    build_id: BUILD,
    parent_id: null,
    type,
    title,
    note: null,
    payload: payload as Json,
    position,
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-21T09:00:00Z",
    children: [],
  } as NodeTree;
}

/** Which tiles hold the word: five, spread evenly over the build (and so over its parts), each a prompt. */
export function ca27Worded(tiles: number = CA27_TILES): number[] {
  return [0, 1, 2, 3, 4].map((k) => {
    let n = Math.floor((k * tiles) / 5) + 4;
    while (n % 7 === 0 || n % 10 === 0) n += 1;
    return n;
  });
}

/** The session key a tile number stands in. */
export const ca27SessionOf = (number: number, tiles: number = CA27_TILES): string => CA27_S[Math.floor((number - 1) / (tiles / CA27_SESSIONS))];

export function ca27Tree(tiles: number = CA27_TILES): NodeTree[] {
  const tree: NodeTree[] = [];
  const per = tiles / CA27_SESSIONS;
  const worded = new Set(ca27Worded(tiles));
  for (let at = 0; at < tiles; at += 1) {
    const session = CA27_S[Math.floor(at / per)];
    const number = at + 1;
    if (number % 10 === 0) tree.push(node(`c27-${number}`, "document", { title: `menu-week-${number / 10}-${LONG_WORD.slice(0, 30)}.pdf`, summary: `The menu for week ${number / 10}`, step: true, session }, number));
    else if (number % 7 === 0) tree.push(node(`c27-${number}`, "manual_step", { tool: "vercel", text: `Put page ${number} live on the bakery's domain. ${LONG_PROMPT}`, session }, number, number % 14 === 0 ? LONG_TITLE : null));
    else {
      const text = worded.has(number) ? `Prompt ${number}: draft the ${CA27_WORD} loaf page. ${LONG_PROMPT}` : `Prompt ${number}: ${LONG_PROMPT}`;
      tree.push(node(`c27-${number}`, "prompt", { text, tool: "claude", model: "Opus 5.5", session }, number, number % 3 === 0 ? `${LONG_TITLE} (${number})` : null));
    }
  }
  return tree;
}

export const ca27Making: Making = {
  sessions: [],
  excluded_models: [],
  session_order: [...CA27_S],
  workstreams: [
    { key: CA27_P[0], name: "Cinnamon rolls and the menu" },
    { key: CA27_P[1], name: LONG_TITLE },
    { key: CA27_P[2], name: "Launch" },
  ],
  part_labels: "numbers",
  sessions_meta: Object.fromEntries(
    CA27_S.map((s, at) => [
      s,
      {
        tool: at % 4 === 3 ? "claude-code" : "claude",
        model: at % 2 ? "Sonnet 5.5" : "Opus 5.5",
        date: `2026-10-${String(1 + at).padStart(2, "0")}`,
        title: at % 3 === 0 ? `${LONG_TITLE} ${at + 1}` : at === 5 ? "Cinnamon morning rolls" : `Session ${at + 1} work`,
        workstream: CA27_P[at < 7 ? 0 : at < 14 ? 1 : 2],
      },
    ]),
  ),
};

/** The build as the composer reads it. */
export function ca27Build(tiles: number = CA27_TILES): { tree: NodeTree[]; steps: Step[]; groups: SessionGroup[]; making: Making } {
  const tree = ca27Tree(tiles);
  const steps = buildSteps(tree);
  const groups = sessionGroups(steps, ca27Making.sessions, ca27Making.session_tools ?? {}, sessionsMetaOf(ca27Making), sessionOrderOf(ca27Making), storedWorkstreamsOf(ca27Making));
  return { tree, steps, groups, making: ca27Making };
}

/** Sources with long names: sessions, prompts, files and library rows no column can hold on one line. */
export function ca27Sources() {
  return {
    sessions: [
      { key: "s1", number: 1, tool: "Claude", detail: `Opus 5.5 · 3 Mar · ${LONG_TITLE}`, prompts: [{ id: "p1", number: "1", title: LONG_TITLE, isDefault: false }, { id: "p2", number: "2", title: LONG_WORD, isDefault: false }] },
      { key: "s2", number: 2, tool: "Claude Code with a name that goes on and on", detail: "Sonnet 5.5 · 4 Mar", prompts: [{ id: "p3", number: "3", title: "Build the page", isDefault: false }] },
    ],
    files: [{ id: "f1", name: `menu-week-1-${LONG_WORD}.pdf`, note: `opened in session 1, ${LONG_TITLE}` }],
    library: [{ id: "l1", label: `Claude ${LONG_TITLE}`, line: `1 Mar · 4 prompts · ${LONG_TITLE}`, adding: false, inThisDraft: false, alsoIn: `Also in ${LONG_TITLE}`, firstPrompt: null, date: "1 Mar", promptCount: 4, app: "Claude", appKnown: true, model: null, createdAt: "2026-03-01T10:00:00Z", draftCount: 0 }],
  };
}
