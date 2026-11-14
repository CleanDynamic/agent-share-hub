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

-- =============================================================================
-- G10. A durable per-IP limit for the edge functions anyone can call.
-- =============================================================================
-- Each function counts calls per caller address in fixed windows. The key is
-- the function's name and a SHA-256 hash of the address, made in the function,
-- so no address is stored. Rows expire with their window and are cleared as
-- calls come in. Only the service role, inside the functions, reads or writes:
-- RLS is on with no policy, and nothing is granted to PUBLIC, anon or
-- authenticated.

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0 CHECK (hits >= 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX IF NOT EXISTS edge_rate_limits_expires_at ON public.edge_rate_limits (expires_at);

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.edge_rate_limits TO service_role;

-- Count one call in the bucket's current window; true while the count is within
-- the limit. One statement, so two calls at once cannot both read the old count.
CREATE OR REPLACE FUNCTION public.edge_rate_limit_hit(_bucket text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _start timestamptz;
  _hits integer;
BEGIN
  IF _bucket IS NULL OR length(_bucket) > 200 OR _limit IS NULL OR _limit < 1
     OR _window_seconds IS NULL OR _window_seconds < 1 OR _window_seconds > 86400 THEN
    RAISE EXCEPTION 'edge_rate_limit_hit: bad arguments';
  END IF;
  _start := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  INSERT INTO public.edge_rate_limits AS r (bucket, window_start, hits, expires_at)
  VALUES (_bucket, _start, 1, _start + make_interval(secs => _window_seconds))
  ON CONFLICT (bucket, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO _hits;
  -- About one call in fifty clears what has expired.
  IF random() < 0.02 THEN
    DELETE FROM public.edge_rate_limits WHERE expires_at < now();
  END IF;
  RETURN _hits <= _limit;
END $$;

REVOKE EXECUTE ON FUNCTION public.edge_rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edge_rate_limit_hit(text, integer, integer) TO service_role;
