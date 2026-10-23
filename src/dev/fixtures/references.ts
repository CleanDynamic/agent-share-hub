// CA-19 P8: "References": CA-17's "Two parts" (Part A: Sessions 1 to 3, Part B: Sessions 4 and 5, letters), with tiles
// of its own so the board's names line up (Data model is tile 2, Code 4, Check 5), and:
//
//   - the group "Login flow" in #7FB88A, holding Session 2, Code 4 and Check 5, with notes, linked to "Signing in by email
//     link" in post 2. Session 2 still has CA-17's old single colour stored: it shows the group's.
//   - a single colour #7FA7D9 on Data model, linked to "the data model" in post 1;
//   - the same colour on Landing page, unlinked;
//   - an unnamed group in #B79AD6 with two tiles (Prompts 7 and 8);
//   - an old post (post 3) with two links to Prompt 1.
//
// DEV ONLY.

import type { Json } from "@/integrations/supabase/types";
import { buildSteps, sessionGroups, type SessionGroup, type Step } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "@/lib/build/making";
import type { ReferenceGroup } from "@/lib/build/referenceGroups";
import type { ThreadDoc } from "@/lib/build/thread";
import type { NodeTree } from "@/lib/build/types";

import { PARTS_S, partsMaking } from "./parts";

export const REFS_COLOURS = { login: "#7FB88A", single: "#7FA7D9", plum: "#B79AD6" } as const;
export const REFS_LOGIN = "rg-0b1c2d3e-0000-4000-8000-0000000000c1";
export const REFS_PLUM = "rg-0b1c2d3e-0000-4000-8000-0000000000c2";

/** The notes the board gives Login flow: 112 characters. */
export const REFS_LOGIN_NOTES = "Session 2 builds sign-in by email link. Code 4 sends the link, and Check 5 proves a link opens once, only once.";

const groups: ReferenceGroup[] = [
  { id: REFS_LOGIN, colour: REFS_COLOURS.login, name: "Login flow", notes: REFS_LOGIN_NOTES, members: [`session:${PARTS_S[1]}`, "node:rf-c4", "node:rf-k5"] },
  { id: REFS_PLUM, colour: REFS_COLOURS.plum, members: ["node:rf-p7", "node:rf-p8"] },
];

export const referencesMaking: Making & { reference_groups: ReferenceGroup[] } = { ...partsMaking, reference_groups: groups };

const BUILD = "references-build";

function node(id: string, type: string, title: string | null, payload: Record<string, unknown>, position: number): NodeTree {
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
    created_at: "2026-10-19T09:00:00Z",
    children: [],
  } as NodeTree;
}

const prompt = (id: string, session: string, text: string, position: number, tool = "claude") => node(id, "prompt", null, { text, tool, model: tool === "claude" ? "Opus 5.5" : "Sonnet 5.5", session }, position);

export const referencesTree: NodeTree[] = [
  prompt("rf-p1", PARTS_S[0], "Plan a portal where tenants pay rent, see repairs and message the landlord.", 1),
  node("rf-m2", "manual_step", "Data model", { tool: "figma", text: "Drew the data model: tenants, leases, payments and repair requests.", session: PARTS_S[0], colour: REFS_COLOURS.single }, 2),
  prompt("rf-p3", PARTS_S[1], "Build sign-in by email link: one link, one sign-in, then it expires.", 3, "claude-code"),
  node("rf-c4", "code", "Send the link", { source: "export async function sendLink(email: string) {\n  return mail(email, await oneTimeLink(email));\n}", language: "ts", filename: "signin.ts", session: PARTS_S[1] }, 4),
  node("rf-k5", "eval_run", "Link opens once", { tested: "A sign-in link opened twice", passing: "The second open asks for a new link", session: PARTS_S[2] }, 5),
  node("rf-m6", "manual_step", "Landing page", { tool: "vercel", text: "Put the landing page a tenant meets after signing in live.", session: PARTS_S[2], colour: REFS_COLOURS.single }, 6),
  prompt("rf-p7", PARTS_S[3], "Write the agent that answers tenants from the support rules.", 7),
  prompt("rf-p8", PARTS_S[4], "Sort each message into repairs, rent or other, and say how sure you are.", 8, "claude-code"),
];

const ref = (to: string) => [{ type: "ref", attrs: { to } }];
const words = (text: string) => ({ type: "text", text });
const linked = (text: string, to: string) => ({ type: "text", text, marks: ref(to) });

/** Three posts: the data model linked, the login flow linked, and an old post with two links to Prompt 1. */
export const referencesPost: ThreadDoc = {
  type: "doc",
  content: [
    { type: "paragraph", content: [words("We drew "), linked("the data model", "node:rf-m2"), words(" first, then the screens a tenant meets.")] },
    { type: "postBreak" },
    { type: "paragraph", content: [linked("Signing in by email link", `group:${REFS_LOGIN}`), words(" took three sessions to get right.")] },
    { type: "postBreak" },
    { type: "paragraph", content: [words("It all started with "), linked("the plan", "node:rf-p1"), words(", and we kept going back to "), linked("the first prompt", "node:rf-p1"), words(".")] },
  ],
} as unknown as ThreadDoc;

/** The build as the composer reads it. */
export function referencesBuild(): { tree: NodeTree[]; steps: Step[]; groups: SessionGroup[]; making: Making } {
  const steps = buildSteps(referencesTree);
  const sessions = sessionGroups(steps, referencesMaking.sessions, referencesMaking.session_tools ?? {}, sessionsMetaOf(referencesMaking), sessionOrderOf(referencesMaking));
  return { tree: referencesTree, steps, groups: sessions, making: referencesMaking };
}
