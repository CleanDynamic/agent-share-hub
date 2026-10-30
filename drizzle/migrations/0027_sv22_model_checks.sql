CREATE TABLE IF NOT EXISTS public.model_releases (
  model_id    text PRIMARY KEY CHECK (char_length(model_id) BETWEEN 1 AND 80),
  released_on date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS model_releases_released_on_idx ON public.model_releases (released_on DESC);

ALTER TABLE public.model_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads model releases" ON public.model_releases;
CREATE POLICY "Anyone reads model releases" ON public.model_releases FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins add model releases" ON public.model_releases;
CREATE POLICY "Admins add model releases" ON public.model_releases FOR INSERT WITH CHECK (public.is_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins edit model releases" ON public.model_releases;
CREATE POLICY "Admins edit model releases" ON public.model_releases FOR UPDATE
  USING (public.is_admin((select auth.uid()))) WITH CHECK (public.is_admin((select auth.uid())));

DROP POLICY IF EXISTS "Admins remove model releases" ON public.model_releases;
CREATE POLICY "Admins remove model releases" ON public.model_releases FOR DELETE USING (public.is_admin((select auth.uid())));

REVOKE ALL ON public.model_releases FROM anon, authenticated, service_role;
GRANT SELECT ON public.model_releases TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.model_releases TO authenticated;
GRANT ALL ON public.model_releases TO service_role;

CREATE INDEX IF NOT EXISTS idx_builds_reproduced
  ON public.builds (last_confirmed_at DESC NULLS LAST)
  WHERE reproduction_count > 0 AND status IN ('published', 'gallery');

CREATE OR REPLACE FUNCTION public.model_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(btrim(raw)), '[[:space:]._-]+', '-', 'g'),
        '^-+|-+$', '', 'g'),
      '-[0-9]{8}$', ''),
    '^(claude|gpt|gemini)-', '')
$$;

CREATE OR REPLACE FUNCTION public.release_check()
RETURNS TABLE (model_id text, released_on date, works integer, fails integer, untested integer, next_slug text, bars jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH latest AS (
    SELECT r.model_id, r.released_on, public.model_key(r.model_id) AS k
    FROM public.model_releases r
    WHERE r.released_on <= current_date
    ORDER BY r.released_on DESC
    LIMIT 1
  ),
  per_build AS (
    SELECT b.id, b.slug, b.last_confirmed_at,
           CASE WHEN count(rr.id) FILTER (WHERE rr.worked) > 0 THEN 'works'
                WHEN count(rr.id) > 0 THEN 'fails'
                ELSE 'untested' END AS state,
           count(rr.id) AS runs
    FROM public.builds b
    CROSS JOIN latest l
    LEFT JOIN public.build_reproductions rr ON rr.build_id = b.id AND public.model_key(rr.model_used) = l.k
    WHERE b.reproduction_count > 0 AND b.status IN ('published', 'gallery')
    GROUP BY b.id, b.slug, b.last_confirmed_at
  ),
  shown AS (
    SELECT state, runs, last_confirmed_at,
           CASE state WHEN 'works' THEN 0 WHEN 'fails' THEN 1 ELSE 2 END AS rank
    FROM per_build
    ORDER BY rank, last_confirmed_at DESC NULLS LAST
    LIMIT 120
  )
  SELECT l.model_id,
         l.released_on,
         (SELECT count(*) FROM per_build WHERE state = 'works')::integer,
         (SELECT count(*) FROM per_build WHERE state = 'fails')::integer,
         (SELECT count(*) FROM per_build WHERE state = 'untested')::integer,
         (SELECT slug FROM per_build WHERE state = 'untested' ORDER BY last_confirmed_at DESC NULLS LAST LIMIT 1),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('s', state, 'n', runs) ORDER BY rank, last_confirmed_at DESC NULLS LAST), '[]'::jsonb) FROM shown)
  FROM latest l
$$;

REVOKE EXECUTE ON FUNCTION public.release_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_check() TO anon, authenticated, service_role;