-- =============================================================================
-- Auth hardening (security prompt 7)
-- =============================================================================
-- G1. get_email_by_username runs as its owner and reads auth.users, and every
-- role could call it, so any visitor could read a member's email address from
-- their username. Sign-in is by email only now and nothing in the app calls it,
-- so EXECUTE is taken from PUBLIC, anon and authenticated. service_role keeps
-- it. The function itself is not dropped or changed.
--
-- The live database has drifted from this folder (RULES.md section 8), so the
-- function is found in the catalogue, by name and every overload, and a
-- database that does not have it is skipped with a notice.
--
-- Apply exactly as written. Then run the Supabase security advisor.
-- =============================================================================

DO $$
DECLARE
  fn regprocedure;
  found boolean := false;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_email_by_username'
  LOOP
    found := true;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
  IF NOT found THEN
    RAISE NOTICE 'get_email_by_username is not in this database; nothing to revoke';
  END IF;
END $$;
