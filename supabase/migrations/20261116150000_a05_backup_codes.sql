-- =============================================================================
-- Part A, G5: backup codes
-- =============================================================================
-- At enrolment a member is shown ten one-time backup codes, once. One code
-- stands in for the authenticator's code once, then it is spent. Making a new
-- set voids the old one.
--
-- WHERE THE CODES ARE. Only as salted hashes: each row has its own random salt
-- and SHA-256(salt || code), made in the mfa-recovery edge function, which also
-- compares in constant time. No code is ever stored or logged.
--
-- WHAT A SPENT CODE DOES. Supabase Auth raises a session to aal2 only when an
-- authenticator's code is checked, so a backup code cannot. Instead, spending
-- one records that ONE session in mfa_recovered_sessions, and the database's
-- check for a member with a factor (G3, aal_ok) accepts aal2 OR a recorded
-- session. The mark goes when the session ends (foreign key, ON DELETE
-- CASCADE), and a code is spent and its session marked in one statement, so a
-- code cannot be spent twice even by two requests at once.
--
-- WHO. Both tables: row level security on, no policy, nothing granted to
-- PUBLIC, anon or authenticated. The functions: the service role only, so the
-- member is always the one in the edge function's verified token.
--
-- Safe to run twice; drops nothing; objects found in the catalogue.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.mfa_backup_codes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  salt text NOT NULL CHECK (length(salt) BETWEEN 1 AND 128),
  code_hash text NOT NULL CHECK (length(code_hash) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS mfa_backup_codes_unused ON public.mfa_backup_codes (user_id) WHERE used_at IS NULL;

ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mfa_backup_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mfa_backup_codes TO service_role;

CREATE TABLE IF NOT EXISTS public.mfa_recovered_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recovered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_recovered_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mfa_recovered_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.mfa_recovered_sessions TO service_role;

-- The mark goes with its session. If this database will not let the owner
-- reference auth.sessions, the mark is still checked against auth.sessions on
-- every read (session_is_recovered), so an ended session never counts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.mfa_recovered_sessions'::regclass AND conname = 'mfa_recovered_sessions_session_fk'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.mfa_recovered_sessions
                 ADD CONSTRAINT mfa_recovered_sessions_session_fk
                 FOREIGN KEY (session_id) REFERENCES auth.sessions (id) ON DELETE CASCADE';
    EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
      RAISE WARNING 'a05: could not tie mfa_recovered_sessions to auth.sessions (%); session_is_recovered still checks the session exists', SQLERRM;
    END;
  END IF;
END $$;

-- A new set of ten for one member; every earlier code of theirs is voided.
CREATE OR REPLACE FUNCTION public.replace_backup_codes(_user_id uuid, _salts text[], _hashes text[])
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF _user_id IS NULL OR coalesce(array_length(_salts, 1), 0) <> 10 OR coalesce(array_length(_hashes, 1), 0) <> 10 THEN
    RAISE EXCEPTION 'replace_backup_codes: a set is ten salts and ten hashes' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.mfa_backup_codes WHERE user_id = _user_id;
  INSERT INTO public.mfa_backup_codes (user_id, salt, code_hash)
  SELECT _user_id, s, h FROM unnest(_salts, _hashes) AS pair (s, h);
END $$;

-- The member's unused codes, as salt and hash, for the edge function to compare.
CREATE OR REPLACE FUNCTION public.backup_code_candidates(_user_id uuid)
RETURNS TABLE (id bigint, salt text, code_hash text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, c.salt, c.code_hash
  FROM public.mfa_backup_codes AS c
  WHERE c.user_id = _user_id AND c.used_at IS NULL
  ORDER BY c.id
$$;

-- Spend one code of this member on one of their sessions. True if it was unused
-- and is now spent, and the session is marked. One statement each way.
CREATE OR REPLACE FUNCTION public.spend_backup_code(_user_id uuid, _code_id bigint, _session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _spent integer;
BEGIN
  IF _user_id IS NULL OR _code_id IS NULL OR _session_id IS NULL THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.sessions s WHERE s.id = _session_id AND s.user_id = _user_id) THEN
    RETURN false;
  END IF;
  UPDATE public.mfa_backup_codes SET used_at = now()
  WHERE id = _code_id AND user_id = _user_id AND used_at IS NULL;
  GET DIAGNOSTICS _spent = ROW_COUNT;
  IF _spent = 0 THEN
    RETURN false;
  END IF;
  INSERT INTO public.mfa_recovered_sessions (session_id, user_id) VALUES (_session_id, _user_id)
  ON CONFLICT (session_id) DO UPDATE SET recovered_at = now() WHERE public.mfa_recovered_sessions.user_id = _user_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.backup_codes_left(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer FROM public.mfa_backup_codes WHERE user_id = _user_id AND used_at IS NULL
$$;

-- True when this session of this member was verified with a backup code and has
-- not ended. G3's aal_ok and mfa-recovery read it.
CREATE OR REPLACE FUNCTION public.session_is_recovered(_session_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _session_id IS NOT NULL AND _user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.mfa_recovered_sessions r
    JOIN auth.sessions s ON s.id = r.session_id AND s.user_id = r.user_id
    WHERE r.session_id = _session_id AND r.user_id = _user_id
  )
$$;

-- When it was marked, for mfa-recovery's ten-minute window on removing a lost authenticator.
CREATE OR REPLACE FUNCTION public.session_recovered_at(_session_id uuid, _user_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.recovered_at
  FROM public.mfa_recovered_sessions r
  JOIN auth.sessions s ON s.id = r.session_id AND s.user_id = r.user_id
  WHERE r.session_id = _session_id AND r.user_id = _user_id
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.replace_backup_codes(uuid, text[], text[])',
    'public.backup_code_candidates(uuid)',
    'public.spend_backup_code(uuid, bigint, uuid)',
    'public.backup_codes_left(uuid)',
    'public.session_is_recovered(uuid, uuid)',
    'public.session_recovered_at(uuid, uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
