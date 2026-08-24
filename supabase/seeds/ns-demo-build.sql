-- =============================================================================
-- NeoScale — demo build seed (NS-P03)
-- =============================================================================
-- ONE complete, representative build record: a published 'app' build with a
-- twelve-node tree three levels deep, two tray nodes, and an eighteen-event
-- sequence across four phases.
--
-- THIS IS A SEED, NOT A MIGRATION. It lives in supabase/seeds/ deliberately.
-- Do not move it into supabase/migrations/ — it inserts sample rows against a
-- creator id you supply, and it deletes and re-inserts itself on every run.
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<a profiles.id uuid> \
--     -f supabase/seeds/ns-demo-build.sql
--
-- The creator id must be an existing public.profiles row (builds.creator_id
-- references it). Any real account works; the demo does not care whose it is.
--
-- RE-RUNNABLE: the script deletes the build with this slug first. build_nodes
-- and build_events cascade from builds, so one delete clears everything.
--
-- ROW COUNTS the acceptance check expects:
--   builds        1
--   build_nodes  14  (12 placed + 2 in the tray)
--   build_events 18  (ordinals 1-18, two of them hidden)
--
-- Every payload below matches the schema its node_types row declares, in the
-- six-field-type dialect seeded by NS-P02.
-- =============================================================================

\if :{?creator_id}
\else
  \echo 'ERROR: pass a creator id, e.g. -v creator_id=00000000-0000-0000-0000-000000000000'
  \quit
\endif

\set ON_ERROR_STOP on

BEGIN;

-- Fixed ids, so the seed is addressable and re-runnable.
\set build_id       '11111111-0000-4000-8000-000000000001'
\set slug           'inbox-triage-agent-demo'

-- events
\set ev1 '11111111-1000-4000-8000-000000000001'
\set ev2 '11111111-1000-4000-8000-000000000002'
\set ev3 '11111111-1000-4000-8000-000000000003'
\set ev4 '11111111-1000-4000-8000-000000000004'
\set ev5 '11111111-1000-4000-8000-000000000005'
\set ev6 '11111111-1000-4000-8000-000000000006'
\set ev7 '11111111-1000-4000-8000-000000000007'
\set ev8 '11111111-1000-4000-8000-000000000008'
\set ev9 '11111111-1000-4000-8000-000000000009'
\set ev10 '11111111-1000-4000-8000-00000000000a'
\set ev11 '11111111-1000-4000-8000-00000000000b'
\set ev12 '11111111-1000-4000-8000-00000000000c'
\set ev13 '11111111-1000-4000-8000-00000000000d'
\set ev14 '11111111-1000-4000-8000-00000000000e'
\set ev15 '11111111-1000-4000-8000-00000000000f'
\set ev16 '11111111-1000-4000-8000-000000000010'
\set ev17 '11111111-1000-4000-8000-000000000011'
\set ev18 '11111111-1000-4000-8000-000000000012'

-- placed nodes — level 1
\set n_live_app     '11111111-2000-4000-8000-000000000001'
\set n_agent        '11111111-2000-4000-8000-000000000002'
\set n_dataset      '11111111-2000-4000-8000-000000000003'
\set n_result       '11111111-2000-4000-8000-000000000004'
\set n_breakage     '11111111-2000-4000-8000-000000000005'
\set n_gap          '11111111-2000-4000-8000-000000000006'
-- placed nodes — level 2
\set n_system       '11111111-2000-4000-8000-000000000007'
\set n_tool         '11111111-2000-4000-8000-000000000008'
\set n_retrieval    '11111111-2000-4000-8000-000000000009'
\set n_eval         '11111111-2000-4000-8000-00000000000a'
-- placed nodes — level 3
\set n_prompt       '11111111-2000-4000-8000-00000000000b'
\set n_code         '11111111-2000-4000-8000-00000000000c'
-- tray nodes — position IS NULL
\set n_tray_shot    '11111111-2000-4000-8000-00000000000d'
\set n_tray_note    '11111111-2000-4000-8000-00000000000e'


-- =============================================================================
-- 0. Guards
-- =============================================================================
-- psql does not interpolate :variables inside a dollar-quoted body, so the
-- creator id is handed to the guard through a session setting instead.
SELECT set_config('ns.creator_id', :'creator_id', true);

DO $guard$
DECLARE
  v_creator uuid := current_setting('ns.creator_id')::uuid;
  v_types   int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_creator) THEN
    RAISE EXCEPTION 'creator_id % is not an existing public.profiles row', v_creator;
  END IF;

  SELECT count(*) INTO v_types FROM public.node_types;
  IF v_types <> 26 THEN
    RAISE EXCEPTION 'node_types holds % rows, expected 26 - run the NS-P02 migration first', v_types;
  END IF;
END $guard$;

-- Clear any previous run. Nodes and events cascade from builds.
DELETE FROM public.builds WHERE slug = :'slug' OR id = :'build_id'::uuid;


-- =============================================================================
-- 1. The build header
-- =============================================================================
-- hero_node_id is set in section 4, once the node it points at exists.
INSERT INTO public.builds (
  id, creator_id, slug, title, outcome, shape, status,
  made_for, made_with, live_url, repo_url,
  cost_setup, cost_monthly, currency, time_to_first_result,
  completeness, reproduction_count,
  last_confirmed_at, last_confirmed_model,
  monetisation_type, donation_enabled,
  created_at, published_at
) VALUES (
  :'build_id'::uuid,
  :'creator_id'::uuid,
  :'slug',
  'Inbox triage agent that files a week of email in four minutes',
  'Sorts a full inbox into reply / delegate / archive and drafts the replies, so a Monday morning that used to take ninety minutes takes four.',
  'app',
  'published',
  ARRAY['founder','operations manager','solo consultant'],
  ARRAY['Claude Opus 4.5','Gmail API','Supabase','Vercel'],
  'https://inbox-triage.demo.neoscaleai.com',
  'https://github.com/neoscale-demo/inbox-triage-agent',
  0,
  18.40,
  'GBP',
  35,
  86,
  4,
  '2026-08-14T09:12:00Z',
  'claude-opus-4-5',
  'free',
  true,
  '2026-07-28T08:40:00Z',
  '2026-08-15T17:05:00Z'
);


-- =============================================================================
-- 2. The event sequence — 18 events, ordinals 1-18, four phases, mixed visibility
-- =============================================================================
-- Inserted before the nodes because build_nodes.event_id points at these.
-- build_events.produced_node_id points the other way and is set in section 5.
--
-- Eight kept, eight folded, two hidden. The two hidden events are the whole
-- point of the visibility column and the reason getEvents filters in the query
-- rather than in the caller: nothing below carrying 'hidden' may ever appear in
-- a network response for the public build page, whatever the page then renders.
--
-- Ordinals are dense and 1-based, and occurred_at rises with the ordinal, so a
-- replay scrubber reading the sequence in ordinal order also reads it in time
-- order.
INSERT INTO public.build_events
  (id, build_id, ordinal, occurred_at, kind, phase, phase_title, visibility, payload)
VALUES

-- --- phase 1: getting a model to read the inbox at all ----------------------
(:'ev1'::uuid, :'build_id'::uuid, 1, '2026-07-28T08:41:00Z', 'note', 1,
 'Reading the inbox', 'kept', '{
   "text": "Started from the actual problem: 340 unread, most of it not for me. Wanted a triage pass I could trust enough not to re-read."
 }'::jsonb),

(:'ev9'::uuid, :'build_id'::uuid, 2, '2026-07-28T08:52:00Z', 'note', 1,
 'Reading the inbox', 'folded', '{
   "text": "Labelled sixty of my own emails by hand before writing a single prompt. Without the labels there is nothing to argue with when the model disagrees with me."
 }'::jsonb),

(:'ev10'::uuid, :'build_id'::uuid, 3, '2026-07-28T09:10:00Z', 'prompt', 1,
 'Reading the inbox', 'folded', '{
   "text": "Sort this email into one of: urgent, reply, delegate, read later, archive. Explain your reasoning.",
   "model": "claude-opus-4-5",
   "note": "Five categories was one argument with myself too many. Urgent and reply were the same pile, and read later was where everything went to die."
 }'::jsonb),

(:'ev2'::uuid, :'build_id'::uuid, 4, '2026-07-28T09:26:00Z', 'prompt', 1,
 'Reading the inbox', 'kept', '{
   "text": "Classify this email into exactly one of: reply, delegate, archive. Answer with the label and one sentence of reasoning.",
   "model": "claude-opus-4-5",
   "note": "First working classifier. 60 hand-labelled emails, 41 right."
 }'::jsonb),

(:'ev11'::uuid, :'build_id'::uuid, 5, '2026-07-28T17:30:00Z', 'note', 1,
 'Reading the inbox', 'folded', '{
   "text": "41 of 60 written down as the baseline. Every number after this one is measured against the same set, so a change that only looks better does not count."
 }'::jsonb),

(:'ev3'::uuid, :'build_id'::uuid, 6, '2026-07-29T11:02:00Z', 'breakage', 1,
 'Reading the inbox', 'kept', '{
   "symptom": "Every thread longer than about forty messages came back as archive, including ones that were plainly waiting on me.",
   "cause": "The whole thread was being pasted in and the newest message ended up buried past the point the model was actually weighting.",
   "resolution": "Send the last three messages plus a generated thread summary instead of the raw thread."
 }'::jsonb),

-- --- phase 2: making it read the newest message ------------------------------
(:'ev12'::uuid, :'build_id'::uuid, 7, '2026-07-29T12:20:00Z', 'note', 2,
 'Making it read the newest message', 'folded', '{
   "text": "First instinct was a bigger context window. It made it worse: more thread, same burial, twice the spend."
 }'::jsonb),

(:'ev13'::uuid, :'build_id'::uuid, 8, '2026-07-29T14:05:00Z', 'prompt', 2,
 'Making it read the newest message', 'kept', '{
   "text": "Here is a summary of the thread, then the three most recent messages newest first. Classify on the newest message and use the summary only for context.",
   "model": "claude-opus-4-5",
   "note": "The ordering is the whole fix. Newest first, and say out loud which part to decide on."
 }'::jsonb),

(:'ev4'::uuid, :'build_id'::uuid, 9, '2026-07-29T15:48:00Z', 'milestone', 2,
 'Making it read the newest message', 'kept', '{
   "text": "Classifier at 91% on the 60-case set after the thread-window fix. Good enough to start drafting replies against."
 }'::jsonb),

-- --- phase 3: drafting in my own voice ---------------------------------------
(:'ev5'::uuid, :'build_id'::uuid, 10, '2026-08-02T10:15:00Z', 'prompt', 3,
 'Drafting in my own voice', 'folded', '{
   "text": "Draft a reply in my voice. Match the register of my last five replies to this person. Never invent a commitment, a date or a number.",
   "model": "claude-opus-4-5",
   "note": "The register instruction is what stopped the drafts reading like a press release."
 }'::jsonb),

(:'ev14'::uuid, :'build_id'::uuid, 11, '2026-08-03T09:40:00Z', 'breakage', 3,
 'Drafting in my own voice', 'kept', '{
   "symptom": "Three drafts in one morning promised a delivery date that existed nowhere in the thread. One of them was to a client.",
   "cause": "Voice matching retrieves my own previous replies, and my previous replies are full of dates. The model read the retrieved examples as facts about this thread rather than as samples of how I write.",
   "resolution": "The retrieved replies are labelled as style samples in the prompt, and a check now refuses any draft carrying a date or a figure that does not appear in the thread it is answering."
 }'::jsonb),

(:'ev15'::uuid, :'build_id'::uuid, 12, '2026-08-03T16:12:00Z', 'prompt', 3,
 'Drafting in my own voice', 'folded', '{
   "text": "The five replies below are STYLE SAMPLES. Take the register from them and nothing else. Any date, figure or commitment must appear in the thread you are answering, quoted from it.",
   "model": "claude-opus-4-5",
   "note": "Shouting STYLE SAMPLES in capitals is not elegant and it is what worked."
 }'::jsonb),

(:'ev6'::uuid, :'build_id'::uuid, 13, '2026-08-05T13:30:00Z', 'note', 3,
 'Drafting in my own voice', 'folded', '{
   "text": "Tried a cheaper model for the classify step and kept the expensive one for drafting. Saved about 60% of the spend for a two-point accuracy drop."
 }'::jsonb),

(:'ev16'::uuid, :'build_id'::uuid, 14, '2026-08-14T09:12:00Z', 'milestone', 3,
 'Drafting in my own voice', 'kept', '{
   "text": "58 of 60 on the hand-labelled set with the guardrail in place, and no invented date in two weeks of drafts."
 }'::jsonb),

-- --- phase 4: putting it in front of a real inbox ----------------------------
(:'ev7'::uuid, :'build_id'::uuid, 15, '2026-08-14T15:20:00Z', 'note', 4,
 'Putting it in front of a real inbox', 'hidden', '{
   "text": "Scratch: the OAuth consent screen took two days of review and has nothing to do with the build. Keeping the account details out of the public record."
 }'::jsonb),

(:'ev17'::uuid, :'build_id'::uuid, 16, '2026-08-15T09:05:00Z', 'note', 4,
 'Putting it in front of a real inbox', 'folded', '{
   "text": "Ran it alongside manual triage for two weeks before trusting it. It disagreed with me 11 times and it was right 4 of those."
 }'::jsonb),

(:'ev18'::uuid, :'build_id'::uuid, 17, '2026-08-15T11:40:00Z', 'note', 4,
 'Putting it in front of a real inbox', 'hidden', '{
   "text": "Scratch: the routing spreadsheet, with names and workloads on it. Useful to me, nobody else needs to read it."
 }'::jsonb),

(:'ev8'::uuid, :'build_id'::uuid, 18, '2026-08-15T17:02:00Z', 'deploy', 4,
 'Putting it in front of a real inbox', 'kept', '{
   "text": "Deployed to Vercel behind Google sign-in. Running on my own inbox daily since.",
   "url": "https://inbox-triage.demo.neoscaleai.com"
 }'::jsonb);

-- =============================================================================
-- 3. The node tree — 12 placed nodes, all six categories, three levels deep
-- =============================================================================
-- Level 1 (parent_id NULL, positions 0-5)
INSERT INTO public.build_nodes
  (id, build_id, parent_id, position, type, title, note, event_id, is_gap, payload, source_ref)
VALUES

-- artefact / live_app — the hero
(:'n_live_app'::uuid, :'build_id'::uuid, NULL, 0, 'live_app',
 'The running agent',
 'Sign in with a Google account. It reads, it never sends — drafts land in your drafts folder.',
 :'ev8'::uuid, false, '{
   "url": "https://inbox-triage.demo.neoscaleai.com",
   "embeddable": false,
   "credentials_note": "Google sign-in with read and compose scopes. Revoke it from your Google account permissions page at any time."
 }'::jsonb, NULL),

-- configuration / agent_config
(:'n_agent'::uuid, :'build_id'::uuid, NULL, 1, 'agent_config',
 'Triage agent configuration',
 'Two models: the cheap one classifies, the expensive one drafts.',
 NULL, false, '{
   "system_prompt": "You triage a professional inbox. You classify, you summarise, and you draft. You never send, never invent a commitment, and never assume a date that is not written down.",
   "model": "claude-opus-4-5",
   "temperature": 0.2,
   "max_tokens": 2048,
   "top_p": 0.95,
   "tools": [
     { "tool_ref": "11111111-2000-4000-8000-000000000008" }
   ],
   "memory": "Last five replies to each correspondent, kept for voice matching only. Rolled off after 90 days.",
   "guardrails": [
     { "rule": "Never send. Drafts only." },
     { "rule": "Never invent a date, a number or a commitment." },
     { "rule": "Anything mentioning legal, payroll or an offer goes to reply, never archive." }
   ],
   "test_passing": 58,
   "test_total": 60,
   "test_run_at": "2026-08-14T09:12:00Z"
 }'::jsonb, '{"source":"compose","session_id":"demo-seed","index":2}'::jsonb),

-- data / dataset
(:'n_dataset'::uuid, :'build_id'::uuid, NULL, 2, 'dataset',
 'Hand-labelled triage set',
 'Sixty of my own emails, labelled by hand before any model saw them.',
 NULL, false, '{
   "description": "60 real emails pulled from three months of my own inbox, each labelled reply / delegate / archive by hand before the classifier existed. Names and addresses replaced, wording left alone.",
   "record_count": 60,
   "format": "JSONL",
   "source": "My own Gmail account, exported via takeout",
   "sample": [
     { "record": "{\"from\":\"supplier\",\"subject\":\"Revised quote attached\",\"label\":\"reply\"}" },
     { "record": "{\"from\":\"newsletter\",\"subject\":\"This week in logistics\",\"label\":\"archive\"}" },
     { "record": "{\"from\":\"contractor\",\"subject\":\"Can you approve the invoice?\",\"label\":\"delegate\"}" }
   ],
   "chunk_strategy": "one email per record, thread summary appended",
   "chunk_size": 1200,
   "chunk_overlap": 0,
   "embedding_model": "text-embedding-3-small",
   "licence": "Not redistributable — private correspondence, pseudonymised"
 }'::jsonb, NULL),

-- evidence / result
(:'n_result'::uuid, :'build_id'::uuid, NULL, 3, 'result',
 'Ninety minutes down to four',
 NULL,
 :'ev4'::uuid, false, '{
   "summary": "Four weeks of Monday mornings, measured with a stopwatch. The 90 minutes was the average of the four Mondays before the agent existed; the 4 minutes is reviewing and sending what it drafted.",
   "metric": "Monday inbox time",
   "value": "90 min to 4 min",
   "media_id": null
 }'::jsonb, NULL),

-- narrative / breakage
(:'n_breakage'::uuid, :'build_id'::uuid, NULL, 4, 'breakage',
 'Long threads were all being archived',
 'The one failure that would have made this useless if I had not caught it.',
 :'ev3'::uuid, false, '{
   "symptom": "Any thread past roughly forty messages came back archive, including threads plainly waiting on a reply from me.",
   "cause": "The full thread was pasted into the prompt newest-last, so the message that actually mattered sat at the far end of a very long context and got weighted like background.",
   "resolution": "Stopped sending raw threads. The prompt now carries a generated thread summary plus the last three messages, newest first.",
   "attempts": 6,
   "event_start": 6,
   "event_end": 9
 }'::jsonb, NULL),

-- narrative / gap — is_gap true
(:'n_gap'::uuid, :'build_id'::uuid, NULL, 5, 'gap',
 'Calendar-aware delegation',
 NULL,
 NULL, true, '{
   "problem": "It cannot tell who to delegate to. It knows an email should be delegated and then hands it back to me to route, which is most of the time saved given straight back.",
   "what_i_tried": "A static routing table by keyword, which broke the first time somebody went on holiday. Then a prompt that reasoned over the team list, which confidently invented a colleague.",
   "acceptance_criteria": "Given a delegate-labelled email and a team calendar, it names one person who is working that week and can plausibly own it, and is right on 45 of 50 held-out cases.",
   "reward_note": "Happy to hand over the labelled routing set and co-credit whoever cracks it."
 }'::jsonb, NULL);

-- Level 2 (positions 0-1 under agent, 0 under dataset, 0 under result)
INSERT INTO public.build_nodes
  (id, build_id, parent_id, position, type, title, note, event_id, is_gap, payload, source_ref)
VALUES

-- instruction / system_prompt, under the agent config
(:'n_system'::uuid, :'build_id'::uuid, :'n_agent'::uuid, 0, 'system_prompt',
 'Triage system prompt',
 NULL,
 NULL, false, '{
   "text": "You triage a professional inbox.\n\nFor each email you receive a thread summary and the three most recent messages, newest first.\n\nClassify into exactly one of: reply, delegate, archive.\n\nRules that override everything else:\n- Anything about legal, payroll, an offer or a contract is reply. Never archive it.\n- If the newest message ends in a question addressed to the account owner, it is reply.\n- Never invent a date, a number or a commitment that is not written in the thread.\n\nAnswer with the label, then one sentence of reasoning. Nothing else.",
   "model": "claude-opus-4-5",
   "scope": "Every classify call. The drafting call carries its own prompt.",
   "version": "v4"
 }'::jsonb, NULL),

-- configuration / tool_definition, under the agent config
(:'n_tool'::uuid, :'build_id'::uuid, :'n_agent'::uuid, 1, 'tool_definition',
 'fetch_thread_context',
 'The tool that fixed the long-thread breakage.',
 :'ev13'::uuid, false, '{
   "name": "fetch_thread_context",
   "description": "Return a summary of a Gmail thread plus its three most recent messages, newest first. Replaces pasting the raw thread, which buried the message that mattered.",
   "parameters": "{ \"thread_id\": { \"type\": \"string\", \"required\": true }, \"message_limit\": { \"type\": \"integer\", \"default\": 3 } }",
   "returns": "{ \"summary\": string, \"messages\": [{ \"from\": string, \"sent_at\": string, \"body\": string }] }"
 }'::jsonb, NULL),

-- data / retrieval_config, under the dataset
(:'n_retrieval'::uuid, :'build_id'::uuid, :'n_dataset'::uuid, 0, 'retrieval_config',
 'Voice-matching retrieval',
 'How the drafting step finds my previous replies to the same person.',
 NULL, false, '{
   "strategy": "hybrid — sender address exact match, then embedding similarity over subject and first paragraph",
   "top_k": 5,
   "reranker": "none, k is small enough that it made no measurable difference",
   "filters": "same correspondent, sent by me, within the last 12 months"
 }'::jsonb, NULL),

-- evidence / eval_run, under the result
(:'n_eval'::uuid, :'build_id'::uuid, :'n_result'::uuid, 0, 'eval_run',
 'Classifier accuracy, 14 August',
 NULL,
 :'ev16'::uuid, false, '{
   "harness": "promptfoo, run locally against the hand-labelled set",
   "dataset_ref": "11111111-2000-4000-8000-000000000003",
   "score": 0.9667,
   "passed": 58,
   "total": 60,
   "run_at": "2026-08-14T09:12:00Z"
 }'::jsonb, NULL);

-- Level 3 (under the system prompt, and under the tool definition)
INSERT INTO public.build_nodes
  (id, build_id, parent_id, position, type, title, note, event_id, is_gap, payload, source_ref)
VALUES

-- instruction / prompt, under the system prompt
(:'n_prompt'::uuid, :'build_id'::uuid, :'n_system'::uuid, 0, 'prompt',
 'Per-email classify call',
 'The message sent for each email, under the system prompt above.',
 :'ev2'::uuid, false, '{
   "text": "Thread summary:\n{{thread_summary}}\n\nMost recent messages, newest first:\n{{recent_messages}}\n\nToday is {{today}}. The account owner is {{owner_name}}.\n\nClassify.",
   "variables": [
     { "name": "thread_summary", "description": "Generated summary of the whole thread", "example": "Supplier chasing sign-off on a revised quote; owner has not replied in six days." },
     { "name": "recent_messages", "description": "The three newest messages, newest first", "example": "From: supplier — Just checking you saw the revised figure..." },
     { "name": "today", "description": "Current date, so relative dates resolve", "example": "2026-08-15" },
     { "name": "owner_name", "description": "Inbox owner, so the model knows who \"you\" is", "example": "Sam" }
   ],
   "model": "claude-opus-4-5",
   "params": "temperature 0.2, max_tokens 2048, top_p 0.95",
   "sent_at": "2026-07-28T09:26:00Z",
   "output_ref": "11111111-2000-4000-8000-000000000004"
 }'::jsonb, '{"source":"transcript","session_id":"demo-seed","index":7}'::jsonb),

-- artefact / code, under the tool definition
(:'n_code'::uuid, :'build_id'::uuid, :'n_tool'::uuid, 0, 'code',
 'fetch_thread_context implementation',
 'Start reading here if you are porting this to another mail provider.',
 NULL, false, '{
   "language": "ts",
   "filename": "src/tools/fetchThreadContext.ts",
   "entrypoint": true,
   "source": "import { gmail } from \"../gmail\";\nimport { summarise } from \"../summarise\";\n\nexport async function fetchThreadContext(threadId: string, messageLimit = 3) {\n  const thread = await gmail.users.threads.get({ userId: \"me\", id: threadId });\n  const messages = (thread.data.messages ?? []).map(toPlainMessage);\n\n  // Newest first. This ordering is the whole fix — the message that decides\n  // the label used to sit at the far end of a very long context.\n  const recent = messages.slice(-messageLimit).reverse();\n\n  return { summary: await summarise(messages), messages: recent };\n}"
 }'::jsonb, NULL);


-- =============================================================================
-- 4. The tray — 2 nodes, position IS NULL
-- =============================================================================
-- Captured but never placed. These prove the tray convention: getNodeTree
-- must not return them, and nothing public ever renders them.
INSERT INTO public.build_nodes
  (id, build_id, parent_id, position, type, title, note, event_id, is_gap, payload, source_ref)
VALUES

(:'n_tray_shot'::uuid, :'build_id'::uuid, NULL, NULL, 'screenshot',
 'Triage view, second draft',
 NULL,
 NULL, false, '{
   "media_id": "demo-media-triage-view-v2",
   "caption": "The triage list before the keyboard shortcuts went in. Superseded, not deleted."
 }'::jsonb, '{"source":"upload","session_id":"demo-seed","index":11}'::jsonb),

(:'n_tray_note'::uuid, :'build_id'::uuid, NULL, NULL, 'note',
 'Cost note, unfinished',
 NULL,
 NULL, false, '{
   "body": "Rough spend maths for the two-model split — needs a full month before it is worth publishing."
 }'::jsonb, NULL);


-- =============================================================================
-- 5. The circular references, now that both sides exist
-- =============================================================================
UPDATE public.builds
   SET hero_node_id = :'n_live_app'::uuid
 WHERE id = :'build_id'::uuid;

UPDATE public.build_events
   SET produced_node_id = :'n_prompt'::uuid
 WHERE id = :'ev2'::uuid;

UPDATE public.build_events
   SET produced_node_id = :'n_code'::uuid
 WHERE id = :'ev3'::uuid;

UPDATE public.build_events
   SET produced_node_id = :'n_tool'::uuid
 WHERE id = :'ev13'::uuid;

UPDATE public.build_events
   SET produced_node_id = :'n_result'::uuid
 WHERE id = :'ev4'::uuid;

UPDATE public.build_events
   SET produced_node_id = :'n_eval'::uuid
 WHERE id = :'ev16'::uuid;

UPDATE public.build_events
   SET produced_node_id = :'n_live_app'::uuid
 WHERE id = :'ev8'::uuid;


-- =============================================================================
-- 6. Assert what the acceptance check asserts
-- =============================================================================
DO $$
DECLARE
  v_build_id  uuid := '11111111-0000-4000-8000-000000000001';
  v_nodes     int;
  v_placed    int;
  v_tray      int;
  v_events    int;
  v_hidden    int;
  v_breakage  int;
  v_produced  int;
  v_cats      int;
BEGIN
  SELECT count(*) INTO v_nodes  FROM public.build_nodes WHERE build_id = v_build_id;
  SELECT count(*) INTO v_placed FROM public.build_nodes WHERE build_id = v_build_id AND position IS NOT NULL;
  SELECT count(*) INTO v_tray   FROM public.build_nodes WHERE build_id = v_build_id AND position IS NULL;
  SELECT count(*) INTO v_events FROM public.build_events WHERE build_id = v_build_id;
  SELECT count(*) INTO v_hidden FROM public.build_events
   WHERE build_id = v_build_id AND visibility = 'hidden';
  SELECT count(*) INTO v_breakage FROM public.build_events
   WHERE build_id = v_build_id AND kind = 'breakage';
  SELECT count(*) INTO v_produced FROM public.build_events
   WHERE build_id = v_build_id AND produced_node_id IS NOT NULL;
  SELECT count(DISTINCT nt.category) INTO v_cats
    FROM public.build_nodes bn
    JOIN public.node_types nt ON nt.key = bn.type
   WHERE bn.build_id = v_build_id AND bn.position IS NOT NULL;

  IF v_nodes  <> 14 THEN RAISE EXCEPTION 'expected 14 build_nodes, got %',  v_nodes;  END IF;
  IF v_placed <> 12 THEN RAISE EXCEPTION 'expected 12 placed nodes, got %', v_placed; END IF;
  IF v_tray   <>  2 THEN RAISE EXCEPTION 'expected 2 tray nodes, got %',    v_tray;   END IF;
  IF v_events <> 18 THEN RAISE EXCEPTION 'expected 18 build_events, got %', v_events; END IF;
  -- The replay depends on all three: something to hide, something that
  -- broke, and events that point at what they produced.
  IF v_hidden   <  2 THEN RAISE EXCEPTION 'expected 2+ hidden events, got %', v_hidden; END IF;
  IF v_breakage <  1 THEN RAISE EXCEPTION 'expected a breakage event, got %', v_breakage; END IF;
  IF v_produced <  6 THEN RAISE EXCEPTION 'expected 6+ events with a produced node, got %', v_produced; END IF;
  IF v_cats   <>  6 THEN RAISE EXCEPTION 'expected all 6 categories, got %', v_cats;  END IF;

  RAISE NOTICE 'ns-demo-build: 1 build, % nodes (% placed, % tray), % events (% hidden, % breakage, % producing), % categories',
    v_nodes, v_placed, v_tray, v_events, v_hidden, v_breakage, v_produced, v_cats;
END $$;

COMMIT;

\echo 'Seeded build: inbox-triage-agent-demo'
