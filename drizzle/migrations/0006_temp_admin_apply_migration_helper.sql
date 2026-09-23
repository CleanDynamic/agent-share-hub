CREATE OR REPLACE FUNCTION public.__tmp_apply_migration(sql_text TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;

REVOKE ALL ON FUNCTION public.__tmp_apply_migration(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.__tmp_apply_migration(TEXT) TO service_role;

COMMENT ON FUNCTION public.__tmp_apply_migration(TEXT) IS
  'TEMPORARY operator-only migration runner. service_role only; dropped immediately after the pending supabase/migrations backlog is applied.';