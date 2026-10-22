// CA-14: the draft the screenshots are taken of, written into the CA-09 stand-in over its REST door.
//   Session 1  typed here, 3 tiles
//   Session 2  imported, 66 prompts
//   Session 3  started fresh (no app, no tiles)
// Prints the draft's id. Run after `standin.sh start`; `--reset` first puts the stand-in's data back.
import { randomUUID } from "node:crypto";
import { API, resetData, session } from "../../ca-09/scripts/lib.mjs";

const tokens = (await session()).access_token;
const headers = { "content-type": "application/json", apikey: "ca09-publishable-placeholder", authorization: `Bearer ${tokens}`, prefer: "return=representation" };
const post = async (table, rows) => {
  const res = await fetch(`${API}/rest/v1/${table}`, { method: "POST", headers, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
};

if (process.argv.includes("--reset")) await resetData();

const WORDS = "add a router that sends each request to the right handler and keep the table of routes in one place".split(" ");
const sentence = (n, seed) => WORDS.map((_, i) => WORDS[(seed * 3 + i) % WORDS.length]).slice(0, n).join(" ");
const today = new Date().toISOString().slice(0, 10);
const typed = `typed-${randomUUID()}`;
const fresh = `typed-${randomUUID()}`;
const imported = randomUUID();

const [build] = await post("builds", [{ id: randomUUID(), creator_id: "0b0b0b0b-0000-4000-8000-000000000001", slug: `ca14-${Date.now()}`, title: "Router and planning", status: "draft", shape: "other", made_for: [], made_with: [], making: { sessions_meta: { [typed]: { tool: "claude", date: today }, [fresh]: { tool: null, date: today }, [imported]: { tool: null, date: "" } } } }]);

const events = Array.from({ length: 66 }, (_, i) => ({ kind: "prompt", ordinal: i, payload: { text: `${sentence(14, i)}.`, response_summary: sentence(10, i + 1) }, source_ref: { index: i * 2 } }));
await post("import_sessions", [{ id: imported, user_id: "0b0b0b0b-0000-4000-8000-000000000001", client: "claude-code", model: "claude-sonnet", status: "claimed", build_id: build.id, proposal: { events, summary: { user_turn_count: 66, assistant_turn_count: 66, models: ["claude-sonnet"] }, source: { client: "claude-code" } }, total_chars: 20000, declared_chars: 20000, declared_turns: 132, chunk_count: 1, expected_chunks: 1, content_hash: `ca14-${imported}`, fingerprint: `ca14-${imported}`, secret_findings: [] }]);

const tile = (position, text, session, extra = {}) => ({ id: randomUUID(), build_id: build.id, parent_id: null, position, type: "prompt", title: null, payload: { text, tool: "claude", model: "claude-sonnet", session }, source_ref: extra.source_ref ?? null, is_gap: false });
const nodes = [
  ...[0, 1, 2].map((i) => tile(i, `Plan the router: ${sentence(12, i)}.`, typed)),
  ...events.map((event, i) => tile(3 + i, event.payload.text, imported, { source_ref: { ...event.source_ref, import_session_id: imported } })),
];
await post("build_nodes", nodes);
await post("build_sessions", [
  { build_id: build.id, session_key: typed, import_id: null, position: 0, collapsed: false },
  { build_id: build.id, session_key: imported, import_id: imported, position: 1, collapsed: false },
  { build_id: build.id, session_key: fresh, import_id: null, position: 2, collapsed: false },
]);
console.log(build.id);
