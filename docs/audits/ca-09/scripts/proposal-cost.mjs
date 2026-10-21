// CA-09 Part 4: what the Drafts and composer session reads cost Postgres when `proposal` is large.
//
// Builds public.import_sessions on a local Postgres 16 exactly as 20260917120000_import_sessions.sql does (columns,
// the (user_id, status, created_at DESC) index, RLS "readable by their owner" with (select auth.uid()), the grant to
// `authenticated`), fills it with Miles's shape (20 sessions, proposals 20 kB to 5 MB, the importer's envelope:
// events + nodes + summary) and 2,000 other people's sessions, then runs the three reads the site makes, as
// PostgREST builds them, as the `authenticated` role. Each read is run 15 times; the median is reported.
//
// Usage: PGURL=postgres://postgres@localhost:55432/postgres node docs/audits/ca-09/scripts/proposal-cost.mjs [pglz|lz4]
// Read-only towards anything real: it creates and drops its own database `ca09_sessions` on the local server.
import postgres from "postgres";
import { write } from "./lib.mjs";

const compression = process.argv[2] ?? "pglz";
const admin = postgres(process.env.PGURL ?? "postgres://postgres@127.0.0.1:55432/postgres", { onnotice: () => {} });
await admin.unsafe("DROP DATABASE IF EXISTS ca09_sessions");
await admin.unsafe("CREATE DATABASE ca09_sessions");
await admin.end();
const sql = postgres((process.env.PGURL ?? "postgres://postgres@127.0.0.1:55432/postgres").replace(/\/[^/]*$/, "/ca09_sessions"), { onnotice: () => {}, max: 1 });

const MILES = "0b0b0b0b-0000-4000-8000-000000000001";
await sql.unsafe(`
  DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
  GRANT USAGE ON SCHEMA auth TO authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
  SET default_toast_compression = '${compression}';
  CREATE TABLE public.import_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, client text, source_hint text, fingerprint text,
    content_hash text, status text NOT NULL DEFAULT 'open', chunk_count integer NOT NULL DEFAULT 0, expected_chunks integer,
    total_chars integer NOT NULL DEFAULT 0, declared_turns integer, declared_chars integer, reader_id text, detection_reason text,
    proposal jsonb, secret_findings jsonb, error text, target_build_id uuid, build_id uuid, model text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days');
  CREATE INDEX idx_import_sessions_user_status_created ON public.import_sessions (user_id, status, created_at DESC);
  CREATE INDEX idx_import_sessions_build ON public.import_sessions (build_id);
  ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Import sessions are readable by their owner" ON public.import_sessions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
  GRANT SELECT ON public.import_sessions TO authenticated;
`);

/** The importer's envelope at about `bytes`: events (one per user turn) and nodes that carry the prompt again. */
function envelope(bytes, seed) {
  // Words of random letters from a seeded generator: compresses about as badly as a real conversation (gzip ~2×),
  // where repeated words would compress 50× and hide the cost.
  let state = 1 + seed;
  const rand = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const word = () => Array.from({ length: 2 + Math.floor(rand() * 8) }, () => "etaoinshrdlcumwfgypbvkjxqz"[Math.floor(rand() * rand() * 26)]).join("");
  const say = (n) => Array.from({ length: n }, word).join(" ");
  const events = [];
  const nodes = [];
  let size = 0;
  for (let i = 0; size < bytes; i++) {
    const text = say(220);
    const reply = say(500);
    events.push({ kind: "prompt", ordinal: i, occurred_at: null, payload: { text, reply }, source_ref: { session_id: "s", turn_index: i * 2, start_line: i * 40, end_line: i * 40 + 39 } });
    nodes.push({ local_id: `n${i}`, type: "prompt", title: null, note: null, payload: { text }, source_ref: { session_id: "s", turn_index: i * 2 }, inferred: false, inferred_reason: null });
    size += text.length * 2 + reply.length + 320;
  }
  return { events, nodes, warnings: [], summary: { session_id: "s", source_hint: null, detected_format: "claude-code", detected_labels: { user: ["user"], assistant: ["assistant"] }, turn_count: events.length * 2, user_turn_count: events.length, assistant_turn_count: events.length, event_count: events.length, node_count: nodes.length, character_count: size, line_count: events.length * 40, proposed_title: null, proposed_outcome: null } };
}

const MB = [0.04, 0.12, 1.2, 0.025, 0.3, 2.5, 0.06, 0.08, 3.8, 0.02, 0.15, 5.0, 0.045, 0.09, 0.2, 0.03, 0.07, 0.11, 0.055, 0.035];
const STATUS = ["parsed", "claimed", "parsed", "claimed", "parsed", "claimed", "parsed", "claimed", "parsed", "claimed", "expired", "claimed", "parsed", "claimed", "expired", "claimed", "parsed", "claimed", "expired", "claimed"];
for (let i = 0; i < MB.length; i++) {
  await sql`INSERT INTO public.import_sessions (user_id, client, status, proposal, created_at) VALUES (${MILES}, 'claude-code', ${STATUS[i]}, ${sql.json(envelope(MB[i] * 1e6, i))}, now() - ${`${i} days`}::interval)`;
}
// Everyone else: 2,000 sessions of about 80 kB, so the index, not a scan, has to find Miles's.
const other = sql.json(envelope(80e3, 99));
await sql.unsafe(`INSERT INTO public.import_sessions (user_id, client, status, proposal, created_at)
  SELECT gen_random_uuid(), 'claude', (ARRAY['parsed','claimed','expired'])[1 + (g % 3)], $1::jsonb, now() - (g || ' minutes')::interval FROM generate_series(1, 2000) g`, [other]);
await sql.unsafe("ANALYZE public.import_sessions");

const [{ stored }] = await sql`SELECT pg_size_pretty(pg_total_relation_size('public.import_sessions')) AS stored`;
const sizes = await sql`SELECT round(avg(pg_column_size(proposal))) AS avg_stored, max(pg_column_size(proposal)) AS max_stored, round(avg(octet_length(proposal::text))) AS avg_text, max(octet_length(proposal::text)) AS max_text FROM public.import_sessions WHERE user_id = ${MILES}`;

const SESSION_COLUMNS = `"id", "client", "model", "target_build_id", "build_id", "created_at",
  "proposal"->'events'->0->'payload'->>'text' AS "first_prompt",
  "proposal"->'summary'->'user_turn_count' AS "user_turns",
  "proposal"->'summary'->'assistant_turn_count' AS "assistant_turns"`;
/** The shape PostgREST 12 sends: a CTE over the table, json_agg over it. */
const pgrst = (columns, where, order = `"created_at" DESC`) => `
  WITH pgrst_source AS (SELECT ${columns} FROM "public"."import_sessions" WHERE ${where} ORDER BY ${order} LIMIT 50 OFFSET 0)
  SELECT null::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), '[]')::text AS body FROM (SELECT * FROM pgrst_source) _postgrest_t`;

const READS = {
  "Drafts: waiting sessions (listSessions, parsed)": pgrst(SESSION_COLUMNS, `"status" = ANY ('{parsed}'::text[])`),
  "Drafts: all sessions (listSessions, parsed+claimed)": pgrst(SESSION_COLUMNS, `"status" = ANY ('{parsed,claimed}'::text[])`),
  "Composer: library (listLibrarySessions)": pgrst(`${SESSION_COLUMNS}, "status"`, `"status" = ANY ('{parsed,claimed,expired}'::text[]) AND NOT ("proposal" IS NULL)`),
  "Control: same rows, no proposal paths": pgrst(`"id", "client", "model", "target_build_id", "build_id", "created_at", "status"`, `"status" = ANY ('{parsed,claimed,expired}'::text[]) AND NOT ("proposal" IS NULL)`),
  "Fix A: one detoast per row (paths from one jsonb)": pgrst(`"id", "client", "model", "target_build_id", "build_id", "created_at", "status", p->'events'->0->'payload'->>'text' AS first_prompt, p->'summary'->'user_turn_count' AS user_turns, p->'summary'->'assistant_turn_count' AS assistant_turns`, `"status" = ANY ('{parsed,claimed,expired}'::text[]) AND NOT ("proposal" IS NULL)`).replace(`FROM "public"."import_sessions"`, `FROM "public"."import_sessions" CROSS JOIN LATERAL (SELECT "proposal" AS p OFFSET 0) j`),
};

async function timed(query) {
  const runs = [];
  let plan = null;
  await sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE authenticated`);
    await tx.unsafe(`SELECT set_config('request.jwt.claim.sub', '${MILES}', true)`);
    for (let i = 0; i < 16; i++) {
      const t = process.hrtime.bigint();
      const rows = await tx.unsafe(query);
      const ms = Number(process.hrtime.bigint() - t) / 1e6;
      if (i > 0) runs.push({ ms, count: Number(rows[0].page_total), bytes: rows[0].body.length });
    }
    plan = (await tx.unsafe(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${query}`)).map((r) => r["QUERY PLAN"]).join("\n");
  });
  runs.sort((a, b) => a.ms - b.ms);
  return { medianMs: Number(runs[Math.floor(runs.length / 2)].ms.toFixed(1)), minMs: Number(runs[0].ms.toFixed(1)), maxMs: Number(runs[runs.length - 1].ms.toFixed(1)), rows: runs[0].count, responseBytes: runs[0].bytes, plan };
}

console.log(sizes[0]);
const results = { compression, server: (await sql`SELECT version()`)[0].version, table: stored, milesProposals: sizes[0], reads: {} };
for (const [name, query] of Object.entries(READS)) {
  results.reads[name] = await timed(query);
  console.log(`${compression} ${name.padEnd(52)} median ${String(results.reads[name].medianMs).padStart(7)} ms  rows ${results.reads[name].rows}  body ${results.reads[name].responseBytes} B`);
}
const mbRead = (await sql`SELECT sum(octet_length(proposal::text)) / 1e6 AS mb FROM public.import_sessions WHERE user_id = ${MILES} AND status IN ('parsed','claimed','expired')`)[0].mb;
results.libraryProposalMb = Number(Number(mbRead).toFixed(2));
results.msPerMbPerPath = Number(((results.reads["Composer: library (listLibrarySessions)"].medianMs - results.reads["Control: same rows, no proposal paths"].medianMs) / (results.libraryProposalMb * 3)).toFixed(2));
console.log(`proposal MB read by the library query: ${results.libraryProposalMb}; cost ${results.msPerMbPerPath} ms per MB per path`);
write(`measurements/proposal-cost-${compression}.json`, results);
await sql.end();
