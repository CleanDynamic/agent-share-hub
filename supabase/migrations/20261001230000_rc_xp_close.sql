-- =============================================================================
-- RC-P25 — nobody can call award_xp from the app
-- =============================================================================
-- THE HOLE. public.award_xp(_user_id, _amount, _reason, _source_type,
-- _source_id, _metadata) is SECURITY DEFINER. 20260629162842 granted it to
-- `authenticated`, and a function created in public is also open to `anon` and
-- PUBLIC by the project's default privileges. Its one check is that _user_id is
-- the caller, so any signed-in reader could write any amount of XP to
-- themselves, as often as they liked, for any reason. XP-DESIGN.md: "Nobody can
-- award XP to themselves."
--
-- WHAT THIS DOES. It finds every overload of public.award_xp in pg_proc when it
-- runs, not from the repository: the live database has drifted from the
-- migration files before, and a second overload left open would leave the hole
-- open. Each one has EXECUTE revoked from PUBLIC, anon and authenticated
-- ⟦supabase-postgres-best-practices › references/security-privileges.md⟧. It
-- then reads the privileges back through role membership, and if anon or
-- authenticated can still execute any overload it stops with "RC-P25: ..." and
-- every revoke in the block is rolled back.
--
-- WHAT IT LEAVES ALONE.
--   * The function is not dropped. claim_challenge, also SECURITY DEFINER and
--     owned by the same role, calls it, and a drop would break that function.
--   * service_role keeps EXECUTE: it is the server's own role, and it can write
--     xp_events directly anyway.
--   * It is the next migration (20261001240000) that adds the one writer of XP,
--     rc_grant_xp, which nothing but the database's own triggers can call.
--
-- WHAT THIS DOES NOT CLOSE, AND IS NOT ASKED TO. Two other paths to an XP number
-- exist in the repository's definitions, and both are named in the RC-P25 diary
-- entry for the owner to decide: public.user_progress still lets its owner
-- update their own row (xp_total and level included), and claim_challenge still
-- pays out a daily_challenges row the owner may edit, though nothing in the
-- repository creates such a row.
-- =============================================================================

DO $$
DECLARE
  _fn      record;
  _role    text;
  _revoked integer := 0;
BEGIN
  FOR _fn IN
    SELECT p.oid,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'award_xp'
     ORDER BY p.oid
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      _fn.proname, _fn.args
    );
    _revoked := _revoked + 1;

    -- has_function_privilege follows membership and PUBLIC, so this also
    -- catches a grant that reaches the API roles some other way.
    FOREACH _role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(_role::name, _fn.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'RC-P25: % can still execute public.award_xp(%); nothing was changed', _role, _fn.args;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'RC-P25: EXECUTE revoked from PUBLIC, anon and authenticated on % overload(s) of public.award_xp', _revoked;
END
$$;
