// SV-07: the faked backend the composer runs on in the SV-07 tests and the SV-07 browser recordings (`fakeSupabase.ts`): the
// chats the maker adds, and the slow, out-of-order writes and late, stale reads the recording saw. No React, no DOM.

import type { Delay, Row } from "@/lib/build/__audit__/fakeSupabase";

/** The chats the maker adds, one prompt each, besides the backend's own. */
export const CHATS = ["Poster", "Menu", "Prices", "Hours", "Signs", "Flyer"].map((name, at) => ({ id: `0e0e0e0e-0000-4000-8000-0000000001${String(at).padStart(2, "0")}`, name }));

/** A small, fixed sequence of numbers, so the replay's delays are the same every run. */
function delays(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return 100 + (state % 700);
  };
}

/** Every write takes 100 to 800 ms; reads of the build are answered with the data as it was when they were asked, later. */
export function slowBackend(): Delay[] {
  const next = delays(7);
  const slow = (method: string, path: RegExp, stale = false): Delay => ({ method, path, stale, get delayMs() { return next(); } });
  return [
    slow("PATCH", /^\/rest\/v1\//),
    slow("POST", /^\/rest\/v1\/(?!rpc)/),
    slow("DELETE", /^\/rest\/v1\//),
    slow("GET", /^\/rest\/v1\/(builds|build_nodes|build_sessions)\?/, true),
  ];
}

/** SV-07 P7: the first chat imported a second time: the same transcript (its hash), a day older, so it lists after it. */
export const TWIN = { id: "0e0e0e0e-0000-4000-8000-000000000199", of: CHATS[0] };

export function seed(rows: Record<string, Row[]>) {
  const template = rows.import_sessions[0];
  const chat = (id: string, name: string, created: string) => {
    const proposal = JSON.parse(JSON.stringify(template.proposal)) as { events: { payload: { text: string }; source_ref: { session_id: string } }[]; summary: { session_id: string } };
    proposal.events[0].payload.text = `Make the ${name.toLowerCase()} for the bakery.`;
    proposal.events[0].source_ref.session_id = id;
    proposal.summary.session_id = id;
    rows.import_sessions.push({ ...template, id, client: "claude", status: "parsed", proposal, created_at: created, content_hash: `hash-${name.toLowerCase()}` });
  };
  for (const { id, name } of CHATS) chat(id, name, "2026-10-10T10:00:00Z");
  chat(TWIN.id, TWIN.of.name, "2026-10-09T10:00:00Z");
  // A continued Claude Code chat: its first turn is the summary of the chat before, its second the first real prompt.
  chat(CONTINUED.id, CONTINUED.name, "2026-10-08T10:00:00Z");
  const continued = rows.import_sessions.find((row) => row.id === CONTINUED.id) as Row;
  const proposal = continued.proposal as { events: Record<string, unknown>[]; summary: Record<string, unknown> };
  const [first] = proposal.events as { payload: { text: string }; source_ref: Record<string, unknown>; ordinal?: number }[];
  proposal.events = [
    { ...first, payload: { text: CONTINUED.summary } },
    { ...first, ordinal: 2, payload: { text: `Make the ${CONTINUED.name.toLowerCase()} for the bakery.` }, source_ref: { ...first.source_ref, index: 3 } },
  ];
  proposal.summary = { ...proposal.summary, user_turn_count: 2, assistant_turn_count: 2 };
  continued.client = "claude-code";
}

/** SV-07 P7: a Claude Code chat continued from an earlier one, whose summary becomes a Summary tile. */
export const CONTINUED = {
  id: "0e0e0e0e-0000-4000-8000-000000000198",
  name: "Window signs",
  summary: "This session is being continued from a previous conversation that ran out of context. The conversation is summarized below: the bakery's poster and menu are done, the prices are agreed, and the window signs are next.",
};
