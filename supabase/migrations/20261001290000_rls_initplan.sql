-- =============================================================================
-- buildgallery — RLS: read the caller once per statement, not once per row
-- =============================================================================
-- neoscale-performance, cause 1. A policy that calls auth.uid() bare has it
-- evaluated again for every row a statement touches. Written as
-- (select auth.uid()) it is an initplan: evaluated once per statement, then
-- reused. Within a statement the two are the same value (auth.uid() is STABLE;
-- it reads the request's JWT claim), so what each policy admits does not
-- change, only how often it asks.
--
-- THE ADMIN CHECK GOES THE SAME WAY. is_admin(<the caller>) is a SECURITY
-- DEFINER function, which Postgres never inlines, so wrapping only its
-- argument still runs one function call, and the query inside it, per row.
-- Its argument is the caller and nothing else, so its answer is the same for
-- every row of a statement, and (select is_admin((select auth.uid()))) asks
-- once. Only that exact call is wrapped: a function given a column, such as
-- is_thread_member(thread_id, ...), depends on the row and is left per row.
--
-- Measured on a local Postgres 16 holding these policy shapes, 300,000 rows,
-- count(*) as a signed-in non-admin, median of seven:
--   published OR user_id = auth.uid()                     259 ms ->  17 ms
--   status = 'approved' OR creator_id = auth.uid()
--     OR is_admin(auth.uid())               (content_items) 1268 ms ->  27 ms
--   status <> 'draft' OR creator_id = (select auth.uid())
--     OR public.is_admin((select auth.uid()))      (builds)  692 ms ->  23 ms
-- and all 72 reads and writes checked for anon, two users and an admin
-- answered exactly as before. A second run rewrites nothing.
-- supabase/tests/perf-1-rls-initplan.sql checks the live result.
--
-- CORRECT IN BOTH WORLDS. The live database has drifted from these files, so
-- this restates no policy. It reads every policy in public and storage from
-- the catalogue as it stands, wraps only the bare calls in its USING and
-- WITH CHECK expressions, and leaves its name, command, roles and every other
-- word as they were. A call already wrapped is left alone, so a second run
-- changes nothing.
--
-- NOTHING HERE CAN FAIL THE MIGRATION. Each policy is altered in its own
-- subtransaction under a short lock timeout. One that cannot be altered (on a
-- table this role does not own, or behind a lock it cannot get in time) is
-- named in a WARNING and left exactly as it was.
-- =============================================================================

DO $$
DECLARE
  _p         RECORD;
  _using     TEXT;
  _check     TEXT;
  _sql       TEXT;
  _rewritten INTEGER := 0;
  _left      INTEGER := 0;
  -- A call to auth.uid() that is not already the body of a scalar subquery.
  -- The replacement is written the way pg_get_expr prints a wrapped call, so
  -- the admin pattern below matches the old and the new alike.
  _bare  CONSTANT TEXT := '(?<!SELECT )\mauth\.uid\(\)';
  _uid   CONSTANT TEXT := '( SELECT auth.uid() AS uid)';
  -- is_admin(<the wrapped caller>), schema-qualified or not, not yet wrapped.
  _admin CONSTANT TEXT := '(?<!SELECT )\m((?:public\.)?is_admin)\(\( SELECT auth\.uid\(\) AS uid\)\)';
  _admin_wrapped CONSTANT TEXT := '( SELECT \1(( SELECT auth.uid() AS uid)) AS is_admin)';
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  FOR _p IN
    SELECT n.nspname                                   AS schema_name,
           c.relname                                   AS table_name,
           pol.polname                                 AS policy_name,
           pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'storage')
    ORDER BY n.nspname, c.relname, pol.polname
  LOOP
    _using := regexp_replace(regexp_replace(_p.using_expr, _bare, _uid, 'g'), _admin, _admin_wrapped, 'g');
    _check := regexp_replace(regexp_replace(_p.check_expr, _bare, _uid, 'g'), _admin, _admin_wrapped, 'g');
    CONTINUE WHEN _using IS NOT DISTINCT FROM _p.using_expr
             AND _check IS NOT DISTINCT FROM _p.check_expr;

    _sql := format('ALTER POLICY %I ON %I.%I', _p.policy_name, _p.schema_name, _p.table_name);
    IF _using IS DISTINCT FROM _p.using_expr THEN
      _sql := _sql || format(' USING (%s)', _using);
    END IF;
    IF _check IS DISTINCT FROM _p.check_expr THEN
      _sql := _sql || format(' WITH CHECK (%s)', _check);
    END IF;

    BEGIN
      EXECUTE _sql;
      _rewritten := _rewritten + 1;
    EXCEPTION WHEN OTHERS THEN
      _left := _left + 1;
      RAISE WARNING 'RLS initplan: policy "%" on %.% left as it was (%)',
        _p.policy_name, _p.schema_name, _p.table_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'RLS initplan: % policies now read the caller and the admin check once per statement; % left as they were',
    _rewritten, _left;
END
$$;
