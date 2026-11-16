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
  IF random() < 0.02 THEN
    DELETE FROM public.edge_rate_limits WHERE expires_at < now();
  END IF;
  RETURN _hits <= _limit;
END $$;

REVOKE EXECUTE ON FUNCTION public.edge_rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.edge_rate_limit_hit(text, integer, integer) TO service_role;