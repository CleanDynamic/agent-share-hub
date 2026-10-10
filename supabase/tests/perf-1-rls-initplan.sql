-- =============================================================================
-- buildgallery — RLS reads the caller once per statement (PERF-1)
-- =============================================================================
-- Proves 20261001290000_rls_initplan.sql took effect on the database it is run
-- against. It reads the catalogue and nothing else:
--
--   1. no policy in public or storage calls auth.uid() bare, so none
--      re-evaluates the caller for every row
--   2. no policy calls is_admin(<the caller>) unwrapped, so none runs the
--      admin check, a SECURITY DEFINER function, once per row
--
-- A policy the migration could not alter (it says which, in a WARNING) is
-- named here too, by table and policy, with the expression that still costs.
--
-- USAGE
--   psql "$DATABASE_URL" -f supabase/tests/perf-1-rls-initplan.sql
--
-- The whole script runs inside one transaction and ends in ROLLBACK, and it
-- writes nothing. Every check raises on failure, so a run that reaches
-- "ALL CHECKS PASSED" has passed all of them.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- --- 1 and 2 -----------------------------------------------------------------
DO $$
DECLARE
  _p      RECORD;
  _bad    INTEGER := 0;
  _total  INTEGER;
  _bare   CONSTANT TEXT := '(?<!SELECT )\mauth\.uid\(\)';
  _admin  CONSTANT TEXT := '(?<!SELECT )\m(public\.)?is_admin\(\( SELECT auth\.uid\(\) AS uid\)\)';
BEGIN
  SELECT count(*) INTO _total
  FROM pg_policies
  WHERE schemaname IN ('public', 'storage');

  FOR _p IN
    SELECT schemaname, tablename, policyname,
           coalesce(qual, '') AS using_expr,
           coalesce(with_check, '') AS check_expr
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
    ORDER BY schemaname, tablename, policyname
  LOOP
    IF (_p.using_expr || ' ' || _p.check_expr) ~ _bare
       OR (_p.using_expr || ' ' || _p.check_expr) ~ _admin THEN
      _bad := _bad + 1;
      RAISE NOTICE 'still per row: %.% "%"  USING %  WITH CHECK %',
        _p.schemaname, _p.tablename, _p.policyname,
        nullif(_p.using_expr, ''), nullif(_p.check_expr, '');
    END IF;
  END LOOP;

  IF _bad > 0 THEN
    RAISE EXCEPTION
      'CHECK 1-2 FAILED: % of % policies still call auth.uid() bare or is_admin(<the caller>) unwrapped (listed above)',
      _bad, _total;
  END IF;

  RAISE NOTICE 'checks 1-2 passed: all % policies in public and storage read the caller and the admin check once per statement', _total;
END
$$;

\echo 'ALL CHECKS PASSED'

ROLLBACK;
