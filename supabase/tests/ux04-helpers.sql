-- Helpers the UX-04 checks share. Included with \ir; nothing here is left behind (pg_temp, and the scripts end in ROLLBACK).
--   pg_temp.as_user(uuid)              act as that signed-in user (row level security applies)
--   pg_temp.as_admin()                 act as the connecting role again
--   pg_temp.refused(label, sql)        the statement must raise (a policy, a check or a trigger); the message is shown
--   pg_temp.refused_with(label, sql, text)  the same, and the message must contain the text
--   pg_temp.affects(label, sql, n)     the statement must change exactly n rows (a policy that filters a row changes none)
--   pg_temp.expect(label, ok)          a plain assertion
CREATE FUNCTION pg_temp.as_user(u uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;

CREATE FUNCTION pg_temp.as_admin() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

CREATE FUNCTION pg_temp.refused(label text, stmt text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE _msg text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _msg = MESSAGE_TEXT;
    RAISE NOTICE 'ok   % (refused: %)', label, _msg;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL % (was not refused)', label;
END $$;

CREATE FUNCTION pg_temp.refused_with(label text, stmt text, needle text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE _msg text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _msg = MESSAGE_TEXT;
    IF position(needle in _msg) = 0 THEN
      RAISE EXCEPTION 'FAIL % (refused with "%", expected it to contain "%")', label, _msg, needle;
    END IF;
    RAISE NOTICE 'ok   % (refused: %)', label, _msg;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL % (was not refused)', label;
END $$;

CREATE FUNCTION pg_temp.affects(label text, stmt text, n integer) RETURNS void LANGUAGE plpgsql AS $$
DECLARE _rows integer;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS _rows = ROW_COUNT;
  IF _rows <> n THEN RAISE EXCEPTION 'FAIL % (changed % rows, expected %)', label, _rows, n; END IF;
  RAISE NOTICE 'ok   % (% rows)', label, _rows;
END $$;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAIL %', label; END IF;
  RAISE NOTICE 'ok   %', label;
END $$;
