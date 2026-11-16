-- =============================================================================
-- Part A, G5: backup codes. Acceptance checks.
-- =============================================================================
--   1. replace_backup_codes stores a new set and voids every earlier code of that member
--   2. backup_code_candidates gives the unused codes of that member only (salt and hash, never a code)
--   3. spend_backup_code spends a code once: the first time it marks the session verified, the second time it is refused
--   4. a member's code cannot be spent for another member, nor on another member's session
--   5. backup_codes_left counts the unused codes
--   6. session_is_recovered is true for that session of that member only, and goes when the session ends
--   7. no member or visitor can read the tables or call the functions: only the service role (mfa-recovery)
--
-- USAGE
--   psql "$DATABASE_URL" -f supabase/tests/sec-a05-backup-codes.sql
-- Self-contained. One transaction, ended by ROLLBACK. The hashes here are stand-ins: the function makes real ones.
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
       set_config('t.s_ada', gen_random_uuid()::text, true),
       set_config('t.s_bob', gen_random_uuid()::text, true);
\o

INSERT INTO auth.users (id, email, aud, role)
SELECT u::uuid, 'a05-' || u || '@example.invalid', 'authenticated', 'authenticated'
FROM unnest(ARRAY[current_setting('t.ada'), current_setting('t.bob')]) AS u;
INSERT INTO auth.sessions (id, user_id) VALUES
  (current_setting('t.s_ada')::uuid, current_setting('t.ada')::uuid),
  (current_setting('t.s_bob')::uuid, current_setting('t.bob')::uuid);

RESET ROLE;
SET LOCAL ROLE service_role;

-- 1. A first set, then a second that voids it.
SELECT public.replace_backup_codes(current_setting('t.ada')::uuid,
  ARRAY(SELECT 'salt-a' || g FROM generate_series(1, 10) g), ARRAY(SELECT 'hash-a' || g FROM generate_series(1, 10) g));
SELECT pg_temp.expect('1a ten codes stored', public.backup_codes_left(current_setting('t.ada')::uuid) = 10);
SELECT public.replace_backup_codes(current_setting('t.ada')::uuid,
  ARRAY(SELECT 'salt-b' || g FROM generate_series(1, 10) g), ARRAY(SELECT 'hash-b' || g FROM generate_series(1, 10) g));
SELECT pg_temp.expect('1b the new set replaced the old: still ten, none of the first',
  public.backup_codes_left(current_setting('t.ada')::uuid) = 10
  AND NOT EXISTS (SELECT 1 FROM public.backup_code_candidates(current_setting('t.ada')::uuid) c WHERE c.code_hash LIKE 'hash-a%'));
SELECT pg_temp.refused('1c a set must be ten salts and ten hashes',
  format('SELECT public.replace_backup_codes(%L, ARRAY[''s''], ARRAY[''h''])', current_setting('t.ada')));
SELECT public.replace_backup_codes(current_setting('t.bob')::uuid,
  ARRAY(SELECT 'salt-c' || g FROM generate_series(1, 10) g), ARRAY(SELECT 'hash-c' || g FROM generate_series(1, 10) g));

-- 2. Candidates.
SELECT pg_temp.expect('2a Ada''s candidates are hers only, salt and hash',
  (SELECT count(*) = 10 AND bool_and(c.code_hash LIKE 'hash-b%') FROM public.backup_code_candidates(current_setting('t.ada')::uuid) c));

-- 3. Spending once.
SELECT set_config('t.code', (SELECT c.id::text FROM public.backup_code_candidates(current_setting('t.ada')::uuid) c ORDER BY c.id LIMIT 1), true);
SELECT pg_temp.expect('3a spending it the first time works',
  public.spend_backup_code(current_setting('t.ada')::uuid, current_setting('t.code')::bigint, current_setting('t.s_ada')::uuid));
SELECT pg_temp.expect('3b it marked Ada''s session verified',
  public.session_is_recovered(current_setting('t.s_ada')::uuid, current_setting('t.ada')::uuid));
SELECT pg_temp.expect('3c spending it again is refused',
  NOT public.spend_backup_code(current_setting('t.ada')::uuid, current_setting('t.code')::bigint, current_setting('t.s_ada')::uuid));
SELECT pg_temp.expect('3d it is no longer a candidate',
  NOT EXISTS (SELECT 1 FROM public.backup_code_candidates(current_setting('t.ada')::uuid) c WHERE c.id = current_setting('t.code')::bigint));

-- 4. Not across members.
SELECT set_config('t.bobcode', (SELECT c.id::text FROM public.backup_code_candidates(current_setting('t.bob')::uuid) c ORDER BY c.id LIMIT 1), true);
SELECT pg_temp.expect('4a Bob''s code cannot be spent as Ada',
  NOT public.spend_backup_code(current_setting('t.ada')::uuid, current_setting('t.bobcode')::bigint, current_setting('t.s_ada')::uuid));
SELECT pg_temp.expect('4b Bob''s code cannot be spent on Ada''s session',
  NOT public.spend_backup_code(current_setting('t.bob')::uuid, current_setting('t.bobcode')::bigint, current_setting('t.s_ada')::uuid));
SELECT pg_temp.expect('4c and it is still Bob''s to use', public.backup_codes_left(current_setting('t.bob')::uuid) = 10);
SELECT pg_temp.expect('4d Bob''s session is not marked', NOT public.session_is_recovered(current_setting('t.s_bob')::uuid, current_setting('t.bob')::uuid));
SELECT pg_temp.expect('4e Ada''s mark does not count for Bob', NOT public.session_is_recovered(current_setting('t.s_ada')::uuid, current_setting('t.bob')::uuid));

-- 5. Counting.
SELECT pg_temp.expect('5 nine left for Ada', public.backup_codes_left(current_setting('t.ada')::uuid) = 9);

-- 6. The mark goes with the session.
SELECT pg_temp.as_admin();
DELETE FROM auth.sessions WHERE id = current_setting('t.s_ada')::uuid;
SET LOCAL ROLE service_role;
SELECT pg_temp.expect('6 Ada''s session ended, and its mark with it',
  NOT public.session_is_recovered(current_setting('t.s_ada')::uuid, current_setting('t.ada')::uuid));

-- 7. Not on the API.
SELECT pg_temp.as_user(current_setting('t.ada')::uuid);
SELECT pg_temp.refused('7a a member reads the codes table', 'SELECT * FROM public.mfa_backup_codes');
SELECT pg_temp.refused('7b a member reads the marks table', 'SELECT * FROM public.mfa_recovered_sessions');
SELECT pg_temp.refused('7c a member lists candidates', format('SELECT * FROM public.backup_code_candidates(%L)', current_setting('t.ada')));
SELECT pg_temp.refused('7d a member spends a code', format('SELECT public.spend_backup_code(%L, 1, %L)', current_setting('t.ada'), current_setting('t.s_ada')));
SELECT pg_temp.refused('7e a member replaces codes', format('SELECT public.replace_backup_codes(%L, ARRAY[]::text[], ARRAY[]::text[])', current_setting('t.ada')));
SELECT pg_temp.refused('7f a member marks a session', format('SELECT public.session_is_recovered(%L, %L)', current_setting('t.s_ada'), current_setting('t.ada')));
SELECT pg_temp.as_admin();
SET LOCAL ROLE anon;
SELECT pg_temp.refused('7g a visitor counts codes', format('SELECT public.backup_codes_left(%L)', current_setting('t.ada')));

\echo 'sec-a05: every check passed'
ROLLBACK;
