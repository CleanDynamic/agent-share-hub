-- =============================================================================
-- G16: a member's sessions, listed and signed out one at a time. Acceptance checks.
-- =============================================================================
--   1. sessions_of_user lists that user's live sessions only: not another user's, not an expired one
--   2. each row carries id, created_at, last_active, user_agent and aal, and never an address or a token
--   3. revoke_user_session ends one session of that user and its refresh tokens, and no other
--   4. revoke_user_session cannot end another user's session, even given its id
--   5. neither function can be called by anon or authenticated: only the service role (the my-sessions function)
--
-- USAGE
--   psql "$DATABASE_URL" -f supabase/tests/sec-c16-my-sessions.sql
-- Self-contained: it makes its own users and sessions. One transaction, ended by ROLLBACK.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
BEGIN;
\ir ux04-helpers.sql

\o /dev/null
SELECT set_config('t.ada', gen_random_uuid()::text, true),
       set_config('t.bob', gen_random_uuid()::text, true),
       set_config('t.s1',  gen_random_uuid()::text, true),
       set_config('t.s2',  gen_random_uuid()::text, true),
       set_config('t.s3',  gen_random_uuid()::text, true),
       set_config('t.sb',  gen_random_uuid()::text, true);
\o

INSERT INTO auth.users (id, email, aud, role)
SELECT u::uuid, 'c16-' || u || '@example.invalid', 'authenticated', 'authenticated'
FROM unnest(ARRAY[current_setting('t.ada'), current_setting('t.bob')]) AS u;

-- Ada: two live sessions and one past its time-box. Bob: one.
INSERT INTO auth.sessions (id, user_id, created_at, updated_at, refreshed_at, user_agent, ip, aal, not_after) VALUES
  (current_setting('t.s1')::uuid, current_setting('t.ada')::uuid, now() - interval '3 days', now() - interval '1 day', now() - interval '2 hours', 'Mozilla/5.0 (Macintosh) Chrome/130', '203.0.113.7', 'aal1', null),
  (current_setting('t.s2')::uuid, current_setting('t.ada')::uuid, now() - interval '1 day',  now() - interval '1 hour', null,                      'Mozilla/5.0 (iPhone) Safari/605',   '203.0.113.8', 'aal2', null),
  (current_setting('t.s3')::uuid, current_setting('t.ada')::uuid, now() - interval '9 days', now() - interval '8 days', null,                      'old',                               '203.0.113.9', 'aal1', now() - interval '1 day'),
  (current_setting('t.sb')::uuid, current_setting('t.bob')::uuid, now() - interval '1 day',  now(),                    null,                      'Firefox',                           '198.51.100.1', 'aal1', null);
INSERT INTO auth.refresh_tokens (token, user_id, session_id) VALUES
  ('rt-1', current_setting('t.ada'), current_setting('t.s1')::uuid),
  ('rt-2', current_setting('t.ada'), current_setting('t.s2')::uuid),
  ('rt-b', current_setting('t.bob'), current_setting('t.sb')::uuid);

-- 1 and 2. Listing, as the service role.
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.expect('1a Ada sees her two live sessions only',
  (SELECT array_agg(s ->> 'id' ORDER BY s ->> 'id') FROM public.sessions_of_user(current_setting('t.ada')::uuid) AS s)
  = (SELECT array_agg(x ORDER BY x) FROM unnest(ARRAY[current_setting('t.s1'), current_setting('t.s2')]) AS x));
SELECT pg_temp.expect('1b Bob sees his one',
  (SELECT count(*) = 1 AND bool_and(s ->> 'id' = current_setting('t.sb')) FROM public.sessions_of_user(current_setting('t.bob')::uuid) AS s));
SELECT pg_temp.expect('1c newest activity first: s2 (an hour ago) before s1 (two hours ago)',
  (SELECT array_agg(s ->> 'id') FROM public.sessions_of_user(current_setting('t.ada')::uuid) AS s)
  = ARRAY[current_setting('t.s2'), current_setting('t.s1')]);
SELECT pg_temp.expect('2a each row has exactly id, created_at, last_active, user_agent, aal',
  (SELECT bool_and((SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(s) AS k) = ARRAY['aal', 'created_at', 'id', 'last_active', 'user_agent'])
   FROM public.sessions_of_user(current_setting('t.ada')::uuid) AS s));
SELECT pg_temp.expect('2b last_active is the latest of refreshed_at and updated_at',
  (SELECT (s ->> 'last_active')::timestamptz > now() - interval '3 hours' FROM public.sessions_of_user(current_setting('t.ada')::uuid) AS s WHERE s ->> 'id' = current_setting('t.s1')));

-- 3 and 4. Revoking.
SELECT pg_temp.expect('4a Ada cannot end Bob''s session by its id',
  public.revoke_user_session(current_setting('t.ada')::uuid, current_setting('t.sb')::uuid) = false);
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('4b Bob''s session and its token are still there',
  (SELECT count(*) = 1 FROM auth.sessions WHERE id = current_setting('t.sb')::uuid)
  AND (SELECT count(*) = 1 FROM auth.refresh_tokens WHERE session_id = current_setting('t.sb')::uuid));
SET LOCAL ROLE service_role;
SELECT pg_temp.expect('3a Ada ends her session s1',
  public.revoke_user_session(current_setting('t.ada')::uuid, current_setting('t.s1')::uuid) = true);
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('3b s1 and its refresh token are gone; s2 is untouched',
  (SELECT count(*) = 0 FROM auth.sessions WHERE id = current_setting('t.s1')::uuid)
  AND (SELECT count(*) = 0 FROM auth.refresh_tokens WHERE session_id = current_setting('t.s1')::uuid)
  AND (SELECT count(*) = 1 FROM auth.sessions WHERE id = current_setting('t.s2')::uuid));
SET LOCAL ROLE service_role;
SELECT pg_temp.expect('3c ending it again is false, not an error',
  public.revoke_user_session(current_setting('t.ada')::uuid, current_setting('t.s1')::uuid) = false);

-- 5. Not on the API for members or visitors.
SELECT pg_temp.as_user(current_setting('t.ada')::uuid);
SELECT pg_temp.refused('5a a member lists sessions directly', format('SELECT * FROM public.sessions_of_user(%L)', current_setting('t.ada')));
SELECT pg_temp.refused('5b a member revokes a session directly', format('SELECT public.revoke_user_session(%L, %L)', current_setting('t.ada'), current_setting('t.s2')));
SELECT pg_temp.as_admin();
SET LOCAL ROLE anon;
SELECT pg_temp.refused('5c a visitor lists sessions', format('SELECT * FROM public.sessions_of_user(%L)', current_setting('t.ada')));

\echo 'sec-c16: every check passed'
ROLLBACK;
