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

    FOREACH _role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(_role::name, _fn.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'RC-P25: % can still execute public.award_xp(%); nothing was changed', _role, _fn.args;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'RC-P25: EXECUTE revoked from PUBLIC, anon and authenticated on % overload(s) of public.award_xp', _revoked;
END
$$;