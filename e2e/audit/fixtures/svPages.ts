/* SV-03 — the rows `npm run audit:pages` adds to the audit harness: a draft with three sessions, a draft with nothing in
   it, and a saved build. Answered through filterRows, so a read by creator, status or id gets what PostgREST would give it. */

type Row = Record<string, unknown>;

export const SV_ME = "11111111-0000-4000-8000-000000000001";
export const SV_DRAFT_ID = "77777777-0000-4000-8000-000000000001";
export const SV_EMPTY_DRAFT_ID = "77777777-0000-4000-8000-000000000002";

const DAY = (n: number) => `2026-10-${String(n).padStart(2, "0")}T09:00:00.000Z`;

const draft = (id: string, title: string, day: number, sessions: number): Row => ({
  id,
  creator_id: SV_ME,
  slug: `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "build"}-${id.slice(-4)}`,
  title,
  outcome: null,
  shape: "other",
  status: "draft",
  made_for: [],
  made_with: sessions ? ["Claude"] : [],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  completeness: null,
  reproduction_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  parent_build_id: null,
  root_build_id: null,
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: DAY(day),
  updated_at: DAY(day),
  published_at: null,
  rebuild_note: null,
  rebuild_count: 0,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  solves_node_id: null,
  session_count: sessions,
  post_doc: { type: "doc", content: [{ type: "paragraph" }] },
  making: { sessions: [], sessions_meta: {}, workstreams: [] },
});

export const SV_DRAFTS: Row[] = [
  draft(SV_DRAFT_ID, "Inbox triage, second pass", 20, 3),
  draft(SV_EMPTY_DRAFT_ID, "", 18, 0),
  ...Array.from({ length: 6 }, (_, n) => draft(`77777777-0000-4000-8000-00000000001${n}`, `Draft ${n + 3}`, 10 + n, n % 3)),
];

export const SV_IMPORT_SESSIONS: Row[] = [1, 2, 3, 4].map((n) => ({
  id: `88888888-0000-4000-8000-00000000010${n}`,
  client: "claude-code",
  model: "claude-sonnet-4-5",
  target_build_id: null,
  build_id: n <= 3 ? SV_DRAFT_ID : null,
  status: n <= 3 ? "claimed" : "parsed",
  created_at: DAY(10 + n),
  first_prompt: `Session ${n}: sort the morning's email into three piles.`,
  user_turns: 4,
  assistant_turns: 4,
  proposal: { events: [{ payload: { text: `Session ${n}: sort the morning's email into three piles.` } }], summary: { user_turn_count: 4, assistant_turn_count: 4 } },
}));

export const SV_BUILD_SESSIONS: Row[] = [1, 2, 3].map((n) => ({
  build_id: SV_DRAFT_ID,
  session_key: `session-${n}`,
  import_id: `88888888-0000-4000-8000-00000000010${n}`,
  position: n - 1,
  collapsed: false,
}));

/** One saved build: the hero build of the harness, saved by ME. */
export const SV_SAVES = (buildId: string): Row[] => [{ build_id: buildId, user_id: SV_ME, created_at: DAY(21) }];
