-- =============================================================================
-- UX-04: topic_reads. Acceptance checks.
-- =============================================================================
--   1. a reader writes and changes only their own mark
--   2. nobody else reads it, signed in or not (a signed-out reader reads no row)
--   3. the mark is replaced, not repeated
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v member_id=<profiles.id> -v stranger_id=<profiles.id> \
--     -f supabase/tests/ux04-p8-topic-reads.sql
-- Three different existing profiles. One transaction, ended by ROLLBACK. Every check raises on failure.
-- =============================================================================

\if :{?stranger_id}
\else
  \echo 'ERROR: pass -v creator_id, member_id and stranger_id (three different profiles.id uuids)'
  \quit
\endif
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
BEGIN;
\ir ux04-helpers.sql

SELECT pg_temp.as_user(:'creator_id');
SELECT public.create_post('{"body":"a topic"}') AS root \gset

SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.affects('1a a reader marks a topic read', format($q$INSERT INTO public.topic_reads (user_id, root_id) VALUES (%L, %L)$q$, :'member_id', :'root'), 1);
SELECT pg_temp.refused('1b a reader cannot mark for someone else', format($q$INSERT INTO public.topic_reads (user_id, root_id) VALUES (%L, %L)$q$, :'stranger_id', :'root'));
SELECT pg_temp.affects('3 the mark is replaced by an upsert',
  format($q$INSERT INTO public.topic_reads (user_id, root_id, seen_at) VALUES (%L, %L, now() + interval '1 hour') ON CONFLICT (user_id, root_id) DO UPDATE SET seen_at = EXCLUDED.seen_at$q$, :'member_id', :'root'), 1);
SELECT pg_temp.expect('3b (still one row)', (SELECT count(*) FROM public.topic_reads WHERE root_id = :'root') = 1);

SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.expect('2a another reader sees nothing', NOT EXISTS (SELECT 1 FROM public.topic_reads));
SELECT pg_temp.affects('2b and changes nothing', format($q$UPDATE public.topic_reads SET seen_at = now() WHERE root_id = %L$q$, :'root'), 0);
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.expect('2c the topic''s author does not see who read it', NOT EXISTS (SELECT 1 FROM public.topic_reads));
RESET ROLE; SET LOCAL ROLE anon;
SELECT pg_temp.expect('2d a signed-out reader reads no row', NOT EXISTS (SELECT 1 FROM public.topic_reads));

ROLLBACK;
\echo 'ALL CHECKS PASSED'
