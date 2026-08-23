-- =============================================================================
-- NeoScale — demo build seed
-- =============================================================================
-- A seed, NOT a migration. It must never live in supabase/migrations/.
--
--   psql "$DATABASE_URL" -v creator_id=<profile uuid> -f supabase/seeds/ns-demo-build.sql
--
-- The creator id must be an existing public.profiles.id. Run it as a role that
-- bypasses RLS (postgres / service_role); the policies are written for end
-- users, not for seeding.
--
-- Re-runnable: it deletes any build already holding the demo slug first, and
-- the build_id cascades take its nodes and events with it. Nothing outside the
-- demo slug is touched.
--
-- What it inserts:
--   1  build   — shape 'app', status 'published'
--   14 nodes   — 12 placed across all six categories and three levels deep,
--                plus 2 in the tray (position IS NULL)
--   8  events  — ordinals 1-8 over two phases, one 'breakage', mixed visibility
-- =============================================================================

\set ON_ERROR_STOP on

\set build_id      '''d0000000-0000-4000-8000-00000000b001'''
\set n_live_app    '''d0000000-0000-4000-8000-0000000000a1'''
\set n_agent       '''d0000000-0000-4000-8000-0000000000a2'''
\set n_prompt      '''d0000000-0000-4000-8000-0000000000a3'''
\set n_code        '''d0000000-0000-4000-8000-0000000000a4'''
\set n_tool        '''d0000000-0000-4000-8000-0000000000a5'''
\set n_schema      '''d0000000-0000-4000-8000-0000000000a6'''
\set n_dataset     '''d0000000-0000-4000-8000-0000000000a7'''
\set n_retrieval   '''d0000000-0000-4000-8000-0000000000a8'''
\set n_result      '''d0000000-0000-4000-8000-0000000000a9'''
\set n_comparison  '''d0000000-0000-4000-8000-0000000000aa'''
\set n_breakage    '''d0000000-0000-4000-8000-0000000000ab'''
\set n_gap         '''d0000000-0000-4000-8000-0000000000ac'''
\set n_tray_shot   '''d0000000-0000-4000-8000-0000000000ad'''
\set n_tray_note   '''d0000000-0000-4000-8000-0000000000ae'''
\set e1            '''d0000000-0000-4000-8000-0000000000e1'''
\set e2            '''d0000000-0000-4000-8000-0000000000e2'''
\set e3            '''d0000000-0000-4000-8000-0000000000e3'''
\set e4            '''d0000000-0000-4000-8000-0000000000e4'''
\set e5            '''d0000000-0000-4000-8000-0000000000e5'''
\set e6            '''d0000000-0000-4000-8000-0000000000e6'''
\set e7            '''d0000000-0000-4000-8000-0000000000e7'''
\set e8            '''d0000000-0000-4000-8000-0000000000e8'''

BEGIN;

DELETE FROM public.builds WHERE slug = 'ns-demo-clause-checker';

-- =============================================================================
-- The build
-- =============================================================================
INSERT INTO public.builds (
  id, creator_id, slug, title, outcome, shape, status,
  made_for, made_with, live_url, repo_url,
  cost_setup, cost_monthly, currency, time_to_first_result,
  completeness, reproduction_count, last_confirmed_at, last_confirmed_model,
  monetisation_type, donation_enabled, published_at
) VALUES (
  :build_id::uuid,
  :'creator_id'::uuid,
  'ns-demo-clause-checker',
  'Clause Checker',
  'Reads a supplier contract and flags the clauses a small firm should not sign as written.',
  'app',
  'published',
  ARRAY['lawyer', 'founder', 'operations'],
  ARRAY['claude-sonnet-4-5', 'supabase', 'react', 'pgvector'],
  'https://clause-checker.example.dev',
  'https://github.com/example/clause-checker',
  0, 18.40, 'GBP', 35,
  78, 0,
  now() - interval '9 days',
  'claude-sonnet-4-5',
  'free',
  true,
  now() - interval '11 days'
);

-- =============================================================================
-- Events — inserted before the nodes so nodes can point at them
-- =============================================================================
-- Phase 1: getting a first extraction. Phase 2: making it reliable.
INSERT INTO public.build_events (id, build_id, ordinal, occurred_at, kind, phase, phase_title, visibility, payload) VALUES
(:e1::uuid, :build_id::uuid, 1, now() - interval '21 days', 'prompt', 1, 'Getting a first extraction', 'kept', '{
  "text": "Here is a supplier contract. List every clause that assigns unlimited liability to the supplier, and quote the clause text.",
  "model": "claude-sonnet-4-5",
  "outcome": "Found 3 of the 5 clauses a solicitor had marked. Missed both indemnity clauses."
}'::jsonb),

(:e2::uuid, :build_id::uuid, 2, now() - interval '20 days', 'prompt', 1, 'Getting a first extraction', 'folded', '{
  "text": "Same contract. This time work clause by clause in order, and for each one say whether it caps liability, and quote the sentence you decided from.",
  "model": "claude-sonnet-4-5",
  "outcome": "Clause-by-clause pass caught both indemnity clauses. Slower, but complete."
}'::jsonb),

(:e3::uuid, :build_id::uuid, 3, now() - interval '19 days', 'breakage', 1, 'Getting a first extraction', 'kept', '{
  "symptom": "Contracts over about 40 pages came back with the last third missing entirely.",
  "cause": "The whole document was going in as one message and silently hitting the context ceiling.",
  "resolution": "Split on clause headings and ran each chunk separately, then merged the findings."
}'::jsonb),

(:e4::uuid, :build_id::uuid, 4, now() - interval '18 days', 'milestone', 1, 'Getting a first extraction', 'kept', '{
  "title": "Matched the solicitor markup on all five test contracts",
  "detail": "First run where the flagged set matched the human markup end to end, with no clause invented."
}'::jsonb),

(:e5::uuid, :build_id::uuid, 5, now() - interval '15 days', 'prompt', 2, 'Making it reliable', 'folded', '{
  "text": "Return your findings as JSON matching this schema. Every finding must carry the exact quoted clause text and its heading number. Do not summarise.",
  "model": "claude-sonnet-4-5",
  "outcome": "Structured output. Downstream rendering stopped needing a parser."
}'::jsonb),

(:e6::uuid, :build_id::uuid, 6, now() - interval '14 days', 'note', 2, 'Making it reliable', 'hidden', '{
  "body": "Working note to self: the retrieval step is over-tuned to this one supplier template. Revisit before anyone else runs this."
}'::jsonb),

(:e7::uuid, :build_id::uuid, 7, now() - interval '12 days', 'milestone', 2, 'Making it reliable', 'kept', '{
  "title": "42 of 48 on the regression set",
  "detail": "Six misses, all on clauses that span a page break. Logged as the open gap."
}'::jsonb),

(:e8::uuid, :build_id::uuid, 8, now() - interval '11 days', 'deploy', 2, 'Making it reliable', 'kept', '{
  "url": "https://clause-checker.example.dev",
  "detail": "Netlify front end, Supabase edge function for the extraction pass."
}'::jsonb);

-- =============================================================================
-- Placed nodes — 12, three levels deep
-- =============================================================================
-- Level 1: live_app, agent_config, dataset, result, breakage, gap
-- Level 2: prompt + tool_definition (under agent_config), retrieval_config
--          (under dataset), comparison_table (under result)
-- Level 3: code (under prompt), data_schema (under tool_definition)

INSERT INTO public.build_nodes (id, build_id, parent_id, position, type, title, note, event_id, is_gap, payload) VALUES

-- L1 ---------------------------------------------------------------------
(:n_live_app::uuid, :build_id::uuid, NULL, 0, 'live_app', 'Clause Checker',
 'Paste a contract, get the flagged clauses back with the text quoted. No sign-in on the demo.',
 :e8::uuid, false, '{
  "url": "https://clause-checker.example.dev",
  "embeddable": true,
  "credentials_note": "The demo runs read-only against a sample contract. No account needed."
}'::jsonb),

(:n_agent::uuid, :build_id::uuid, NULL, 1, 'agent_config', 'Extraction agent',
 NULL, :e5::uuid, false, '{
  "system_prompt": "You are a contracts analyst. You read supplier agreements clause by clause and flag terms a small firm should not sign as written. You never paraphrase a clause you are flagging: you quote it. If a clause is ambiguous you say so rather than guessing.",
  "model": "claude-sonnet-4-5",
  "temperature": 0,
  "max_tokens": 4096,
  "top_p": 1,
  "tools": [
    {"tool_ref": "d0000000-0000-4000-8000-0000000000a5"}
  ],
  "memory": "None. Each contract is a fresh run so one document cannot colour the next.",
  "guardrails": [
    {"rule": "Never output a clause reference that does not appear verbatim in the source."},
    {"rule": "Never give legal advice. Flag and quote, do not recommend."},
    {"rule": "If the document is not a contract, stop and say so."}
  ],
  "test_passing": 42,
  "test_total": 48,
  "test_run_at": "2026-08-11T09:20:00Z"
}'::jsonb),

(:n_dataset::uuid, :build_id::uuid, NULL, 2, 'dataset', 'Marked-up contract set',
 NULL, NULL, false, '{
  "description": "48 supplier contracts, each already marked up by a solicitor, used as the regression set. Redacted before use.",
  "record_count": 48,
  "format": "pdf + jsonl markup",
  "source": "Contributed by two firms, redacted and used with written permission.",
  "sample": [
    {"record": "{\"contract_id\": \"c-014\", \"clause\": \"9.2\", \"flag\": \"unlimited_liability\", \"quote\": \"The Supplier shall indemnify the Customer against all losses howsoever arising.\"}"},
    {"record": "{\"contract_id\": \"c-021\", \"clause\": \"4.1\", \"flag\": \"auto_renewal\", \"quote\": \"This Agreement shall renew automatically for successive periods of twelve months.\"}"}
  ],
  "chunk_strategy": "one chunk per clause heading, parent heading kept in the chunk",
  "chunk_size": 900,
  "chunk_overlap": 120,
  "embedding_model": "text-embedding-3-small",
  "licence": "Private. Not redistributable."
}'::jsonb),

(:n_result::uuid, :build_id::uuid, NULL, 3, 'result', 'Regression run, 48 contracts',
 NULL, :e7::uuid, false, '{
  "summary": "42 of 48 contracts matched the solicitor markup exactly. All six misses were clauses split across a page break.",
  "metric": "exact markup match",
  "value": "42/48 (87.5%)",
  "media_id": null
}'::jsonb),

(:n_breakage::uuid, :build_id::uuid, NULL, 4, 'breakage', 'Long contracts lost their tail',
 'This one cost a week. Worth reading before you try the same shortcut.',
 :e3::uuid, false, '{
  "symptom": "Contracts over roughly 40 pages returned findings for the first two thirds only. No error, no warning, just a short answer.",
  "cause": "The whole document was being sent as a single message. Past the context ceiling the tail was dropped silently.",
  "resolution": "Split the document on clause headings and run each chunk separately, then merge. Added an assertion that every heading in the source appears in the merged output.",
  "attempts": 4,
  "event_start": 2,
  "event_end": 4
}'::jsonb),

(:n_gap::uuid, :build_id::uuid, NULL, 5, 'gap', 'Clauses split across a page break',
 NULL, :e7::uuid, true, '{
  "problem": "When a clause runs over a page break, the extractor treats the two halves as separate clauses and flags neither. Six of the 48 regression contracts fail this way.",
  "what_i_tried": "Overlapping chunks by 120 tokens, which helped short spills but not clauses that break mid-sentence. Tried stitching on trailing punctuation and got false joins between unrelated clauses.",
  "acceptance_criteria": "All 48 regression contracts match the solicitor markup, with no clause counted twice.",
  "reward_note": "Happy to hand over the marked-up set to anyone who wants to attack this."
}'::jsonb),

-- L2 ---------------------------------------------------------------------
(:n_prompt::uuid, :build_id::uuid, :n_agent::uuid, 0, 'prompt', 'Clause-by-clause pass',
 NULL, :e2::uuid, false, '{
  "text": "Work through {{contract}} clause by clause, in the order the clauses appear. For each clause return: the heading number, whether it caps or assigns liability, and the exact sentence you decided from, quoted. If a clause is ambiguous, mark it ambiguous rather than choosing. Return {{format}}.",
  "variables": [
    {"name": "contract", "description": "One clause-heading chunk of the contract", "example": "9.2 Indemnity. The Supplier shall indemnify..."},
    {"name": "format", "description": "Output shape requested from the caller", "example": "JSON matching the findings schema"}
  ],
  "model": "claude-sonnet-4-5",
  "params": "temperature 0, max_tokens 4096",
  "sent_at": "2026-08-03T14:05:00Z",
  "output_ref": "d0000000-0000-4000-8000-0000000000a9"
}'::jsonb),

(:n_tool::uuid, :build_id::uuid, :n_agent::uuid, 1, 'tool_definition', 'flag_clause',
 NULL, NULL, false, '{
  "name": "flag_clause",
  "description": "Records one problem clause. Called once per finding so each flag carries its own quoted evidence.",
  "parameters": "heading (string, required), flag (enum: unlimited_liability | auto_renewal | ip_assignment | notice_period | ambiguous), quote (string, required, verbatim from source), confidence (number 0-1)",
  "returns": "{ accepted: boolean, reason?: string } — rejects the call when the quote is not found verbatim in the chunk."
}'::jsonb),

(:n_retrieval::uuid, :build_id::uuid, :n_dataset::uuid, 0, 'retrieval_config', 'Clause retrieval',
 NULL, NULL, false, '{
  "strategy": "hybrid — pgvector cosine over clause chunks, plus a literal heading-number match",
  "top_k": 8,
  "reranker": "none, the heading match carries most of the weight",
  "filters": "contract_id = the document under review; excludes schedules and annexes unless the clause references one"
}'::jsonb),

(:n_comparison::uuid, :build_id::uuid, :n_result::uuid, 0, 'comparison_table', 'Whole document vs clause by clause',
 NULL, NULL, false, '{
  "columns": [
    {"key": "approach", "label": "Approach", "type": "string"},
    {"key": "matched", "label": "Contracts matched", "type": "number"},
    {"key": "invented", "label": "Invented clauses", "type": "number"},
    {"key": "seconds", "label": "Seconds per contract", "type": "number"}
  ],
  "rows": [
    {"cells": "Whole document in one message | 29 | 4 | 11"},
    {"cells": "Clause by clause, merged | 42 | 0 | 38"}
  ],
  "winner": "Clause by clause, merged",
  "method": "Same 48 contracts, same model and temperature, three runs each, median reported.",
  "n": 48
}'::jsonb),

-- L3 ---------------------------------------------------------------------
(:n_code::uuid, :build_id::uuid, :n_prompt::uuid, 0, 'code', 'Chunk on clause headings',
 NULL, :e3::uuid, false, '{
  "language": "ts",
  "source": "const HEADING = /^\\s*(\\d+(?:\\.\\d+)*)\\s+([A-Z][^\\n]{2,80})$/gm;\n\nexport function chunkByClause(text: string) {\n  const marks = [...text.matchAll(HEADING)];\n  return marks.map((m, i) => {\n    const start = m.index ?? 0;\n    const end = i + 1 < marks.length ? marks[i + 1].index ?? text.length : text.length;\n    return { heading: m[1], title: m[2].trim(), body: text.slice(start, end).trim() };\n  });\n}\n",
  "filename": "src/extract/chunkByClause.ts",
  "entrypoint": false
}'::jsonb),

(:n_schema::uuid, :build_id::uuid, :n_tool::uuid, 0, 'data_schema', 'Findings schema',
 NULL, :e5::uuid, false, '{
  "format": "json-schema draft 2020-12",
  "definition": "{\n  \"type\": \"object\",\n  \"required\": [\"contract_id\", \"findings\"],\n  \"properties\": {\n    \"contract_id\": {\"type\": \"string\"},\n    \"findings\": {\n      \"type\": \"array\",\n      \"items\": {\n        \"type\": \"object\",\n        \"required\": [\"heading\", \"flag\", \"quote\"],\n        \"properties\": {\n          \"heading\": {\"type\": \"string\"},\n          \"flag\": {\"enum\": [\"unlimited_liability\", \"auto_renewal\", \"ip_assignment\", \"notice_period\", \"ambiguous\"]},\n          \"quote\": {\"type\": \"string\"},\n          \"confidence\": {\"type\": \"number\", \"minimum\": 0, \"maximum\": 1}\n        }\n      }\n    }\n  }\n}"
}'::jsonb);

-- =============================================================================
-- Tray nodes — position IS NULL, unassigned material
-- =============================================================================
INSERT INTO public.build_nodes (id, build_id, parent_id, position, type, title, note, is_gap, payload) VALUES
(:n_tray_shot::uuid, :build_id::uuid, NULL, NULL, 'screenshot', 'Findings panel, mid-rebuild',
 'Not sure this is still what the panel looks like. Reshoot before placing.', false, '{
  "media_id": "ns-demo-findings-panel",
  "caption": "The findings panel part-way through the rebuild, before the quote column was added."
}'::jsonb),

(:n_tray_note::uuid, :build_id::uuid, NULL, NULL, 'note', 'Costs to check',
 NULL, false, '{
  "body": "The 18.40 monthly figure is one month of real usage at about 60 contracts. Worth re-checking once the page-break gap is fixed, since the retry pass is what costs."
}'::jsonb);

-- =============================================================================
-- Circular references, once both sides exist
-- =============================================================================
UPDATE public.builds
   SET hero_node_id = :n_live_app::uuid
 WHERE id = :build_id::uuid;

UPDATE public.build_events SET produced_node_id = :n_result::uuid    WHERE id = :e4::uuid;
UPDATE public.build_events SET produced_node_id = :n_code::uuid      WHERE id = :e3::uuid;
UPDATE public.build_events SET produced_node_id = :n_live_app::uuid  WHERE id = :e8::uuid;

COMMIT;

\echo 'seeded build ns-demo-clause-checker'
