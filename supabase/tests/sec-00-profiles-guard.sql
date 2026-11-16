-- =============================================================================
-- Security step 0: a member cannot raise their own privileges. Acceptance checks.
-- =============================================================================
--   1. a member cannot change is_admin, is_curator or is_creator on their own row by update
--   2. a member who inserts their own profile gets all three as false, whatever they sent
--   3. a member can still edit their own name and bio, and cannot edit anyone else's
--   4. the own-row update policy has a WITH CHECK, so a row cannot be moved to another id
--   5. an admin cannot flip flags by a direct update either; only through admin_set_curator
--   6. admin_set_curator refuses a member and works for an admin, writing one admin_audit row
--   7. admin_audit: no member can read or write it; nobody, admin or service role, can update or delete it
--   8. the service role (and the dashboard's role) can still change the flags directly
--
-- USAGE
--   psql "$DATABASE_URL" -f supabase/tests/sec-00-profiles-guard.sql
-- Self-contained: it makes its own users. One transaction, ended by ROLLBACK, so nothing is left behind.
-- Every check raises on failure. Locally: supabase/tests/local/run.sh <migration> -- <this file>.
-- =============================================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
BEGIN;
\ir ux04-helpers.sql

CREATE FUNCTION pg_temp.as_service() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  EXECUTE 'SET LOCAL ROLE service_role';
END $$;

-- Three people: a member, another member, an admin. A fourth id with no profile yet, for the insert check.
\o /dev/null
SELECT set_config('t.member', gen_random_uuid()::text, true),
       set_config('t.other',  gen_random_uuid()::text, true),
       set_config('t.admin',  gen_random_uuid()::text, true),
       set_config('t.fresh',  gen_random_uuid()::text, true);
\o

INSERT INTO auth.users (id, email, aud, role)
SELECT u::uuid, 'sec00-' || u || '@example.invalid', 'authenticated', 'authenticated'
FROM unnest(ARRAY[current_setting('t.member'), current_setting('t.other'), current_setting('t.admin'), current_setting('t.fresh')]) AS u;
-- The sign-up trigger makes each profile; make sure of it, then take the fresh one away again.
INSERT INTO public.profiles (id, username, display_name)
SELECT id, 'sec00_' || left(id::text, 8), 'Sec00' FROM auth.users WHERE email LIKE 'sec00-%@example.invalid'
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.profiles WHERE id = current_setting('t.fresh')::uuid;
UPDATE public.profiles SET is_admin = true WHERE id = current_setting('t.admin')::uuid;

-- 1. A member and their own flags.
SELECT pg_temp.as_user(current_setting('t.member')::uuid);
SELECT pg_temp.refused('1a member sets own is_admin',   format('UPDATE public.profiles SET is_admin = true WHERE id = %L', current_setting('t.member')));
SELECT pg_temp.refused('1b member sets own is_curator', format('UPDATE public.profiles SET is_curator = true WHERE id = %L', current_setting('t.member')));
SELECT pg_temp.refused('1c member sets own is_creator', format('UPDATE public.profiles SET is_creator = true WHERE id = %L', current_setting('t.member')));
SELECT pg_temp.refused('1d member sets a flag with a name change', format('UPDATE public.profiles SET display_name = %L, is_admin = true WHERE id = %L', 'X', current_setting('t.member')));
-- Sending a flag at its current value is not a change, so a form that posts the whole row still saves.
SELECT pg_temp.affects('1e member resends own flags unchanged', format('UPDATE public.profiles SET is_admin = false, is_curator = false, is_creator = false WHERE id = %L', current_setting('t.member')), 1);

-- 2. Insert.
SELECT pg_temp.as_user(current_setting('t.fresh')::uuid);
SELECT pg_temp.affects('2a member inserts own profile claiming every flag',
  format('INSERT INTO public.profiles (id, username, is_admin, is_curator, is_creator) VALUES (%L, %L, true, true, true)', current_setting('t.fresh'), 'sec00_fresh'), 1);
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('2b the inserted row has every flag false',
  (SELECT NOT (is_admin OR is_curator OR is_creator) FROM public.profiles WHERE id = current_setting('t.fresh')::uuid));

-- 3. Ordinary edits still work.
SELECT pg_temp.as_user(current_setting('t.member')::uuid);
SELECT pg_temp.affects('3a member edits own name and bio', format('UPDATE public.profiles SET display_name = %L, bio = %L WHERE id = %L', 'New name', 'New bio', current_setting('t.member')), 1);
SELECT pg_temp.affects('3b member cannot edit another member', format('UPDATE public.profiles SET bio = %L WHERE id = %L', 'Hijack', current_setting('t.other')), 0);

-- 4. The policy's WITH CHECK.
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('4 own-row update policy has WITH CHECK (auth.uid() = id)',
  (SELECT pg_get_expr(polwithcheck, polrelid) LIKE '%auth.uid()%= id%'
   FROM pg_policy WHERE polrelid = 'public.profiles'::regclass AND polname = 'Users can update their own profile'));

-- 5. An admin, directly.
SELECT pg_temp.as_user(current_setting('t.admin')::uuid);
SELECT pg_temp.refused('5a admin sets own is_curator directly', format('UPDATE public.profiles SET is_curator = true WHERE id = %L', current_setting('t.admin')));
SELECT pg_temp.refused('5b admin clears own is_admin directly', format('UPDATE public.profiles SET is_admin = false WHERE id = %L', current_setting('t.admin')));

-- 6. admin_set_curator.
SELECT pg_temp.as_user(current_setting('t.member')::uuid);
SELECT pg_temp.refused('6a member calls admin_set_curator on themselves', format('SELECT public.admin_set_curator(%L, true)', current_setting('t.member')));
SELECT pg_temp.as_user(current_setting('t.admin')::uuid);
SELECT pg_temp.affects('6b0 admin calls admin_set_curator', format('SELECT public.admin_set_curator(%L, true)', current_setting('t.other')), 1);
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('6b admin made the other member a curator, application approved',
  (SELECT is_curator AND curator_application_status = 'approved' FROM public.profiles WHERE id = current_setting('t.other')::uuid));
SELECT pg_temp.expect('6c one audit row: who, what, which row',
  (SELECT count(*) = 1 FROM public.admin_audit
   WHERE actor_id = current_setting('t.admin')::uuid AND action = 'set_curator'
     AND target_table = 'profiles' AND target_id = current_setting('t.other') AND details = '{"value": true}'::jsonb));
SELECT pg_temp.as_user(current_setting('t.admin')::uuid);
SELECT pg_temp.affects('6d0 admin calls admin_set_curator to remove', format('SELECT public.admin_set_curator(%L, false)', current_setting('t.other')), 1);
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('6d admin removed the curator flag', (SELECT NOT is_curator FROM public.profiles WHERE id = current_setting('t.other')::uuid));
SELECT pg_temp.as_user(current_setting('t.admin')::uuid);
SELECT pg_temp.refused('6e admin_set_curator on a profile that does not exist', format('SELECT public.admin_set_curator(%L, true)', gen_random_uuid()));

-- 7. admin_audit is append-only and admins-only to read.
SELECT pg_temp.as_user(current_setting('t.member')::uuid);
SELECT pg_temp.expect('7a member reads no audit rows', (SELECT count(*) = 0 FROM public.admin_audit));
SELECT pg_temp.refused('7b member inserts an audit row', format('INSERT INTO public.admin_audit (actor_id, action) VALUES (%L, %L)', current_setting('t.member'), 'forged'));
SELECT pg_temp.as_user(current_setting('t.admin')::uuid);
SELECT pg_temp.expect('7c admin reads the audit rows', (SELECT count(*) >= 2 FROM public.admin_audit WHERE actor_id = current_setting('t.admin')::uuid));
SELECT pg_temp.refused('7d admin updates an audit row', 'UPDATE public.admin_audit SET action = ''x''');
SELECT pg_temp.refused('7e admin deletes an audit row', 'DELETE FROM public.admin_audit');
SELECT pg_temp.as_service();
SELECT pg_temp.refused('7f service role updates an audit row', 'UPDATE public.admin_audit SET action = ''x''');
SELECT pg_temp.refused('7g service role deletes an audit row', 'DELETE FROM public.admin_audit');
SELECT pg_temp.refused('7h service role truncates the audit table', 'TRUNCATE public.admin_audit');
-- The trigger holds even for a role that has every privilege (the connecting role here owns the table).
SELECT pg_temp.as_admin();
SELECT pg_temp.refused_with('7i owner deletes an audit row', 'DELETE FROM public.admin_audit', 'append-only');
SELECT pg_temp.refused_with('7j owner truncates the audit table', 'TRUNCATE public.admin_audit', 'append-only');

-- 8. The service role, and the connecting (dashboard) role.
SELECT pg_temp.as_service();
SELECT pg_temp.affects('8a service role sets is_curator', format('UPDATE public.profiles SET is_curator = true WHERE id = %L', current_setting('t.member')), 1);
SELECT pg_temp.affects('8b service role sets is_admin',   format('UPDATE public.profiles SET is_admin = true WHERE id = %L', current_setting('t.member')), 1);
SELECT pg_temp.as_admin();
SELECT pg_temp.affects('8c dashboard role clears is_admin', format('UPDATE public.profiles SET is_admin = false WHERE id = %L', current_setting('t.member')), 1);

\echo 'sec-00: every check passed'
ROLLBACK;
