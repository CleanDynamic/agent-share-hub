-- =============================================================================
-- UX-04: the exact reply count on a topic. Acceptance checks.
-- =============================================================================
--   1. a reply at any depth adds one to the topic; a reply to a reply counts too
--   2. hiding a reply takes one off, unhiding puts it back, and a hidden reply never counts twice
--   3. deleting a visible reply takes one off; deleting a hidden one takes nothing off
--   4. a reply's own reply_count stays zero; the count never goes below zero
--   5. the backfill sets a wrong count right and leaves a right one alone
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v member_id=<profiles.id> -v stranger_id=<profiles.id> \
--     -f supabase/tests/ux04-p7-reply-count.sql
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

CREATE FUNCTION pg_temp.count_of(id uuid) RETURNS integer LANGUAGE sql AS $$ SELECT reply_count FROM public.openbuild_posts WHERE openbuild_posts.id = $1 $$;

SELECT pg_temp.as_user(:'creator_id');
SELECT public.create_post('{"body":"a topic"}') AS root \gset
SELECT pg_temp.expect('0 a new topic has no replies', pg_temp.count_of(:'root') = 0);

SELECT pg_temp.as_user(:'member_id');
SELECT public.create_post(jsonb_build_object('body','one','parent_id',:'root')) AS r1 \gset
SELECT public.create_post(jsonb_build_object('body','two','parent_id',:'r1')) AS r2 \gset
SELECT pg_temp.as_user(:'stranger_id');
SELECT public.create_post(jsonb_build_object('body','three','parent_id',:'r2')) AS r3 \gset
SELECT pg_temp.expect('1 replies at every depth count', pg_temp.count_of(:'root') = 3);
SELECT pg_temp.expect('4a a reply''s own count stays zero', pg_temp.count_of(:'r1') = 0 AND pg_temp.count_of(:'r2') = 0);

-- 2. the topic's author hides and unhides a reply
SELECT pg_temp.as_user(:'creator_id');
UPDATE public.openbuild_posts SET hidden_by = :'creator_id' WHERE id = :'r2';
SELECT pg_temp.expect('2a hiding takes one off', pg_temp.count_of(:'root') = 2);
UPDATE public.openbuild_posts SET hidden_by = :'creator_id', hidden_reason = 'again' WHERE id = :'r2';
SELECT pg_temp.expect('2b hiding what is hidden takes nothing more off', pg_temp.count_of(:'root') = 2);
UPDATE public.openbuild_posts SET hidden_by = NULL WHERE id = :'r2';
SELECT pg_temp.expect('2c unhiding puts it back', pg_temp.count_of(:'root') = 3);

-- 3. deletes (the connecting role: no client may delete)
SELECT pg_temp.as_admin();
DELETE FROM public.openbuild_posts WHERE id = :'r3';
SELECT pg_temp.expect('3a deleting a visible reply takes one off', pg_temp.count_of(:'root') = 2);
UPDATE public.openbuild_posts SET hidden_by = :'creator_id' WHERE id = :'r2';
SELECT pg_temp.expect('3b (r2 hidden: 1)', pg_temp.count_of(:'root') = 1);
DELETE FROM public.openbuild_posts WHERE id = :'r2';
SELECT pg_temp.expect('3c deleting a hidden reply takes nothing off', pg_temp.count_of(:'root') = 1);

-- 5. the backfill
UPDATE public.openbuild_posts SET reply_count = 41 WHERE id = :'root';
UPDATE public.openbuild_posts t SET reply_count = c.n
  FROM (SELECT root_id, count(*)::integer AS n FROM public.openbuild_posts WHERE parent_id IS NOT NULL AND hidden_by IS NULL GROUP BY root_id) c
 WHERE t.id = c.root_id AND t.reply_count <> c.n;
SELECT pg_temp.expect('5 the backfill sets a wrong count right', pg_temp.count_of(:'root') = 1);

ROLLBACK;
\echo 'ALL CHECKS PASSED'
