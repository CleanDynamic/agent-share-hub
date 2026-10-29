-- SV-22 Part 2: the model release check.
--
-- model_releases: the models and the day each was released, edited by admins only (public.is_admin, the check the builds policies
-- use). model_id is a registry id (src/lib/models/registry.ts), so the page names the model by the registry and a model the
-- registry does not know is shown by its id.
--
-- release_check(): for the newest release that has come out, over published builds with reproduction_count > 0, how many work on
-- it (a run on it with worked = true), how many fail (runs on it, none worked) and how many are not tested (no run on it), the
-- build to run next, and up to 120 bars. ONE request, no loop. A run's model_used is free text, so both sides are compared by
-- model_key(): the registry's own comparison (lower case, runs of space . _ - as one -, a trailing 8-digit date and a leading
-- claude-, gpt- or gemini- removed; src/lib/models/registry.ts modelKey). SECURITY INVOKER: it reads what the caller may read.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The check itself, with at least one row in model_releases:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.release_check();
--      SHOULD SHOW: an Index Scan on model_releases_released_on_idx for the newest release; for builds, a scan on the
--      reproduction_count > 0 builds only (idx_builds_reproduced) and, per build, an Index Scan on idx_build_reproductions_build
--      with model_key() as a Filter. No Seq Scan on build_reproductions. If it shows one, send the plan back.
--   2. The newest release:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT model_id, released_on FROM public.model_releases WHERE released_on <= current_date ORDER BY released_on DESC LIMIT 1;
--      SHOULD SHOW: an Index Scan Backward on model_releases_released_on_idx, no Sort.

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

-- Grants: revoke first, then grant. Reads for everyone; writes only reach a row through the admin policies above.
REVOKE ALL ON public.model_releases FROM anon, authenticated;
GRANT SELECT ON public.model_releases TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.model_releases TO authenticated;
GRANT ALL ON public.model_releases TO service_role;

-- Builds that someone has run: the check reads only these.
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
