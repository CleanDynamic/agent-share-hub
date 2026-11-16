-- UX-15 follow-up: signed-out visitors can read Home, search and profiles again.
--
-- WHAT BROKE. 20261111120000_ux15_settings_blocking.sql added NOT public.is_blocked_between(...) to get_build_feed,
-- search_build_ids and profile_reader_view (behind get_profile_feed and get_profile_side). All four are granted to anon and run as
-- the caller, but is_blocked_between was revoked from anon, so every signed-out call failed with
-- "permission denied for function is_blocked_between" (42501). Checked on the live project on 2026-11-16.
--
-- WHAT THIS DOES. Gives is_blocked_between one more first case: a signed-out request (the anon role) gets false, since a person
-- who is not signed in has blocked no one and no one can have blocked them. Then grants it to anon. Without that first case a grant
-- would let anon ask about any pair, because a call with no auth.uid() falls through to the real lookup (that path exists for
-- triggers and jobs run by the service role); with it, anon learns nothing. Every other case is unchanged, word for word.
--
-- ALSO: PUTS BACK THE PROFILE'S BLOCK CHECK. On 2026-11-16 the UX-10 file was applied again after UX-15 (Lovable's
-- drizzle/migrations/0061_ux10_profile_feed.sql), and its CREATE OR REPLACE of profile_reader_view replaced the version UX-15 had
-- patched, so a blocked person could open the blocker's profile again. The block below is UX-15's own patch, copied unchanged: it
-- adds the check if it is missing and does nothing if it is there. If UX-10 is ever applied again, apply this file after it.
--
-- Changes no row. Correct whether or not it already ran; running it twice changes nothing.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied, in the SQL editor:
--   SET ROLE anon; SELECT public.is_blocked_between(gen_random_uuid(), gen_random_uuid()); RESET ROLE;
--   SHOULD SHOW: false, with no permission error.
--   As a signed-out visitor, open Home, search for anything and open any profile: each loads.
--   SELECT position('is_blocked_between' in pg_get_functiondef('public.profile_reader_view(text)'::regprocedure)) > 0;
--   SHOULD SHOW: true.

CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL THEN false
    -- A signed-out visitor has blocked no one and cannot be blocked, and learns nothing about anyone else's blocks.
    WHEN (select auth.role()) = 'anon' THEN false
    -- Only about a pair the caller is in. A signed-in stranger learns nothing. No signed-in user (a trigger run by the service role,
    -- a cron job) may ask about any pair.
    WHEN (select auth.uid()) IS NOT NULL AND (select auth.uid()) NOT IN (a, b) THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_blocks ub WHERE ub.blocker_id = a AND ub.blocked_id = b)
      OR EXISTS (SELECT 1 FROM public.user_blocks ub WHERE ub.blocker_id = b AND ub.blocked_id = a)
  END
$$;

REVOKE ALL ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO anon, authenticated, service_role;

-- The profile's block check (copied unchanged from 20261111120000_ux15_settings_blocking.sql).
DO $patch$
DECLARE
  _fn   regprocedure := to_regprocedure('public.profile_reader_view(text)');
  _def  text;
  _olds text[] := ARRAY[
      $o$   WHERE lower(p.username) = lower(ltrim(btrim(p_username), '@'))
     AND (
$o$
  ];
  _news text[] := ARRAY[
      $n$   WHERE lower(p.username) = lower(ltrim(btrim(p_username), '@'))
     AND NOT public.is_blocked_between((select auth.uid()), p.id)
     AND (
$n$
  ];
  _cnts int[]  := ARRAY[1];
  _i    int;
  _n    int;
BEGIN
  IF _fn IS NULL THEN
    RAISE EXCEPTION 'UX-15: profile_reader_view (public.profile_reader_view(text)) was not found; nothing was changed';
  END IF;
  _def := pg_get_functiondef(_fn);
  IF position('is_blocked_between' in _def) > 0 THEN
    RETURN; -- already patched: running this twice changes nothing
  END IF;
  FOR _i IN 1 .. array_length(_olds, 1) LOOP
    _n := (length(_def) - length(replace(_def, _olds[_i], ''))) / length(_olds[_i]);
    IF _n <> _cnts[_i] THEN
      RAISE EXCEPTION 'UX-15: profile_reader_view no longer has the text patch % (found % times, expected %); nothing was changed', _i, _n, _cnts[_i];
    END IF;
    _def := replace(_def, _olds[_i], _news[_i]);
  END LOOP;
  EXECUTE _def;
END;
$patch$;
