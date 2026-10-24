// CA-20: a draft with three sessions, a team, a made file and a reference group, and a post that links to some of them.
//
//   Session 1 (typed-ca20-a): prompt P1 "Write the login page" (coloured? no), prompt P2 "Add the order form"
//   Session 2 (typed-ca20-b): team T "Support team" holding agents G1, G2, G3; prompt P3 "Check the orders" that makes the file
//                             F "orders.csv" (a made file); prompt P4 "Read the orders" that uses F
//   Session 3 (typed-ca20-c): empty
//   Group: "Login flow" (#7FA7D9) holds P1 and P3
//   Post: "the login" links to P1, "the support team" links to T

import { DRAFT } from "./ca20Harness";

export const ca20Id = (n: number) => `0c1c1c1c-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const KEY_A = "typed-ca20-a";
export const KEY_B = "typed-ca20-b";
export const KEY_C = "typed-ca20-c";
export const IDS = { p1: ca20Id(1), p2: ca20Id(2), team: ca20Id(3), g1: ca20Id(4), g2: ca20Id(5), g3: ca20Id(6), p3: ca20Id(7), p4: ca20Id(8), file: ca20Id(9) } as const;
export const GROUP_ID = "rg-ca20-login";

type Row = Record<string, unknown>;

const node = (id: string, position: number, type: string, payload: Record<string, unknown>, parent: string | null = null, title: string | null = null): Row => ({
  id,
  build_id: DRAFT,
  parent_id: parent,
  position,
  type,
  title,
  note: null,
  payload,
  source_ref: null,
  event_id: null,
  is_gap: false,
  created_at: "2026-10-20T10:00:00Z",
});

const text = (value: string, to?: string) => ({ type: "text", text: value, ...(to ? { marks: [{ type: "ref", attrs: { to } }] } : null) });

/** The post: "Start with the login and the support team." with both linked. */
export const postDoc = () => ({
  type: "doc",
  content: [{ type: "paragraph", content: [text("Start with "), text("the login", `node:${IDS.p1}`), text(" and "), text("the support team", `node:${IDS.team}`), text(".")] }],
});

/** Seeds the draft `DRAFT` of the audit backend. */
export function seedCa20(rows: Record<string, Row[]>): void {
  const build = rows.builds.find((row) => row.id === DRAFT) as Row;
  build.title = "CA-20 draft";
  build.post_doc = postDoc();
  build.making = {
    sessions_meta: {
      [KEY_A]: { tool: "claude-code", date: "2026-10-20" },
      [KEY_B]: { tool: "claude-code", date: "2026-10-21", title: "Support" },
      [KEY_C]: { tool: null, date: "2026-10-22" },
    },
    session_order: [KEY_A, KEY_B, KEY_C],
    reference_groups: [{ id: GROUP_ID, colour: "#7FA7D9", name: "Login flow", members: [`node:${IDS.p1}`, `node:${IDS.p3}`] }],
  };
  rows.build_nodes.push(
    node(IDS.p1, 0, "prompt", { text: "Write the login page", session: KEY_A }),
    node(IDS.p2, 1, "prompt", { text: "Add the order form", session: KEY_A, colour: "#D97F7F" }),
    node(IDS.team, 2, "team", { session: KEY_B }),
    node(IDS.g1, 0, "agent_config", { system_prompt: "Answer billing questions", model: "claude-sonnet-5-5" }, IDS.team),
    node(IDS.g2, 1, "agent_config", { system_prompt: "Answer account questions", model: "claude-sonnet-5-5" }, IDS.team),
    node(IDS.g3, 2, "agent_config", { system_prompt: "Hand over to a person", model: "claude-sonnet-5-5" }, IDS.team),
    node(IDS.p3, 3, "prompt", { text: "Check the orders", session: KEY_B, effort: "high" }),
    node(IDS.p4, 4, "prompt", { text: "Read the orders", session: KEY_B, uses: [{ kind: "file", node_id: IDS.file }] }),
    node(IDS.file, 5, "document", { title: "orders.csv", made_by: IDS.p3 }),
  );
  rows.build_sessions.push(
    { id: ca20Id(101), build_id: DRAFT, session_key: KEY_A, import_id: null, position: 0, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
    { id: ca20Id(102), build_id: DRAFT, session_key: KEY_B, import_id: null, position: 1, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
    { id: ca20Id(103), build_id: DRAFT, session_key: KEY_C, import_id: null, position: 2, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
  );
}
