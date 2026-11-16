-- =============================================================================
-- Security step 0, for the Supabase dashboard's SQL editor (no psql needed).
-- =============================================================================
-- The same checks as sec-00-profiles-guard.sql, as one block. Inside it, each
-- check switches to the role the API uses (anon, authenticated or service_role)
-- with that person's token claims, so the triggers and policies behave as they
-- do for a real request.
--
-- It ALWAYS ends with an error. That is on purpose: the error undoes
-- everything the block did (the test users, their profiles, the audit rows),
-- so nothing is left in the database.
--   All checks passed: the error reads  "sec-00: ALL CHECKS PASSED (everything rolled back on purpose)"
--   A check failed:    the error reads  "sec-00 FAIL <which check>: <why>"
-- The NOTICE lines above the error list each check.
-- =============================================================================
DO $$
DECLARE
  _member uuid := gen_random_uuid();
  _other  uuid := gen_random_uuid();
  _admin  uuid := gen_random_uuid();
  _fresh  uuid := gen_random_uuid();
  _msg text;
  _rows integer;
  _ok boolean;
  _check text;
BEGIN
  -- Test people. The sign-up trigger makes their profiles.
  INSERT INTO auth.users (id, email, aud, role)
  SELECT u, 'sec00-' || u || '@example.invalid', 'authenticated', 'authenticated'
  FROM unnest(ARRAY[_member, _other, _admin, _fresh]) AS u;
  INSERT INTO public.profiles (id, username, display_name)
  SELECT u, 'sec00_' || left(u::text, 8), 'Sec00' FROM unnest(ARRAY[_member, _other, _admin, _fresh]) AS u
  ON CONFLICT (id) DO NOTHING;
  DELETE FROM public.profiles WHERE id = _fresh;
  UPDATE public.profiles SET is_admin = true WHERE id = _admin;

  -- ---------------------------------------------------------------------------
  -- A member, as the API sees them.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _member, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  FOREACH _check IN ARRAY ARRAY['is_admin', 'is_curator', 'is_creator'] LOOP
    BEGIN
      EXECUTE format('UPDATE public.profiles SET %I = true WHERE id = %L', _check, _member);
      RAISE EXCEPTION 'sec-00 FAIL 1 member sets own %: it was allowed', _check;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'ok   1 member sets own % (refused)', _check;
    END;
  END LOOP;

  UPDATE public.profiles SET display_name = 'New name', bio = 'New bio' WHERE id = _member;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows <> 1 THEN RAISE EXCEPTION 'sec-00 FAIL 3a member edits own name and bio: % rows', _rows; END IF;
  RAISE NOTICE 'ok   3a member edits own name and bio';

  UPDATE public.profiles SET bio = 'Hijack' WHERE id = _other;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows <> 0 THEN RAISE EXCEPTION 'sec-00 FAIL 3b member edited another member: % rows', _rows; END IF;
  RAISE NOTICE 'ok   3b member cannot edit another member';

  BEGIN
    PERFORM public.admin_set_curator(_member, true);
    RAISE EXCEPTION 'sec-00 FAIL 6a member called admin_set_curator: it was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   6a member calls admin_set_curator (refused)';
  END;

  SELECT count(*) = 0 INTO _ok FROM public.admin_audit;
  IF NOT _ok THEN RAISE EXCEPTION 'sec-00 FAIL 7a member can read admin_audit'; END IF;
  RAISE NOTICE 'ok   7a member reads no audit rows';

  BEGIN
    INSERT INTO public.admin_audit (actor_id, action) VALUES (_member, 'forged');
    RAISE EXCEPTION 'sec-00 FAIL 7b member inserted an audit row';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   7b member inserts an audit row (refused)';
  END;

  -- A member creating their own profile, claiming every flag.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _fresh, 'role', 'authenticated')::text, true);
  INSERT INTO public.profiles (id, username, is_admin, is_curator, is_creator)
  VALUES (_fresh, 'sec00_fresh_' || left(_fresh::text, 8), true, true, true);
  PERFORM set_config('role', 'postgres', true);
  SELECT NOT (is_admin OR is_curator OR is_creator) INTO _ok FROM public.profiles WHERE id = _fresh;
  IF NOT _ok THEN RAISE EXCEPTION 'sec-00 FAIL 2 a member''s own insert kept a raised flag'; END IF;
  RAISE NOTICE 'ok   2 member''s own insert has every flag false';

  -- ---------------------------------------------------------------------------
  -- An admin, as the API sees them.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _admin, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  BEGIN
    UPDATE public.profiles SET is_curator = true WHERE id = _admin;
    RAISE EXCEPTION 'sec-00 FAIL 5 admin changed a flag by a direct update';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   5 admin changes a flag directly (refused)';
  END;

  PERFORM public.admin_set_curator(_other, true);
  SELECT count(*) = 1 INTO _ok FROM public.admin_audit
  WHERE actor_id = _admin AND action = 'set_curator' AND target_table = 'profiles' AND target_id = _other::text;
  IF NOT _ok THEN RAISE EXCEPTION 'sec-00 FAIL 6c no audit row for admin_set_curator (or the admin cannot read it)'; END IF;
  RAISE NOTICE 'ok   6b admin_set_curator works for an admin; 6c its audit row is there';

  BEGIN
    DELETE FROM public.admin_audit WHERE actor_id = _admin;
    RAISE EXCEPTION 'sec-00 FAIL 7e admin deleted an audit row';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   7e admin deletes an audit row (refused)';
  END;

  PERFORM set_config('role', 'postgres', true);
  SELECT is_curator AND curator_application_status = 'approved' INTO _ok FROM public.profiles WHERE id = _other;
  IF NOT _ok THEN RAISE EXCEPTION 'sec-00 FAIL 6b admin_set_curator did not set the flag'; END IF;

  -- ---------------------------------------------------------------------------
  -- The service role.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  PERFORM set_config('role', 'service_role', true);
  UPDATE public.profiles SET is_curator = false WHERE id = _other;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows <> 1 THEN RAISE EXCEPTION 'sec-00 FAIL 8 service role could not change a flag'; END IF;
  RAISE NOTICE 'ok   8 service role changes a flag';
  BEGIN
    DELETE FROM public.admin_audit WHERE actor_id = _admin;
    RAISE EXCEPTION 'sec-00 FAIL 7g service role deleted an audit row';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'ok   7g service role deletes an audit row (refused)';
  END;
  PERFORM set_config('role', 'postgres', true);

  RAISE EXCEPTION 'sec-00: ALL CHECKS PASSED (everything rolled back on purpose)';
END $$;
