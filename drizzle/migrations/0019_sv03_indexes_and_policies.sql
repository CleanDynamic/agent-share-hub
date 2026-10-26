CREATE INDEX IF NOT EXISTS idx_builds_creator_status_updated
  ON public.builds (creator_id, status, updated_at DESC);

CREATE OR REPLACE FUNCTION pg_temp.sv03_wrap_auth(expr text)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  -- A call that is not already the body of a (select ...): Postgres writes the wrapped form as "( SELECT auth.uid() AS uid)".
  SELECT regexp_replace(
           regexp_replace(expr, '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.uid\(\)', '(select auth.uid())', 'g'),
           '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.jwt\(\)', '(select auth.jwt())', 'g')
$f$;

DO $sv03$
DECLARE
  r record;
  wrapped_using text;
  wrapped_check text;
  statement text;
  changed integer := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') ~ 'auth\.(uid|jwt)\(\)' OR coalesce(with_check, '') ~ 'auth\.(uid|jwt)\(\)')
  LOOP
    wrapped_using := pg_temp.sv03_wrap_auth(r.qual);
    wrapped_check := pg_temp.sv03_wrap_auth(r.with_check);
    CONTINUE WHEN wrapped_using IS NOT DISTINCT FROM r.qual AND wrapped_check IS NOT DISTINCT FROM r.with_check;

    statement := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF r.qual IS NOT NULL THEN statement := statement || ' USING (' || wrapped_using || ')'; END IF;
    IF r.with_check IS NOT NULL THEN statement := statement || ' WITH CHECK (' || wrapped_check || ')'; END IF;
    EXECUTE statement;
    changed := changed + 1;
  END LOOP;
  RAISE NOTICE 'SV-03: % policies now call auth.uid() and auth.jwt() once per statement', changed;
END
$sv03$;