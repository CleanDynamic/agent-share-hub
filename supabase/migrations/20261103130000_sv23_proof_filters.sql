-- SV-23 Part 2: the Builds table's proof filters.
--
-- 1. builds.worked_models text[]: the model_key() of every model a run WORKED on (build_reproductions.worked and a model_used), kept by
--    a trigger on build_reproductions the way reproduction_count is (trg_build_reproduction_signals). "Works on model" is then one
--    filter in the Builds list's own request (`worked_models && '{opus-5-5}'`), with a GIN index. model_key() is SV-22's (and is
--    created here too if SV-22's migration has not been applied, with the same body).
-- 2. works_on_model_counts(): the panel's counts, one row per model key (builds with a worked run on it). Alongside the facets.
-- 3. builds_count_spread() is replaced to cover the five number filters (steps, sessions, reproductions, rebuilds, likes); a value
--    above the filter's cap is counted at the cap. Same shape as SV-23 Part 1's, so the page reads both the same way.
-- 4. Indexes for the range filters that read a column no index serves: reproduction_count, rebuild_count, like_count. (Last
--    confirmed within n days and Confirmed or stale read last_confirmed_at: idx_builds_reproduced covers them, since both are
--    over builds with reproduction_count > 0.)
--
-- Runs, 12 weeks needs no migration: the list embeds the last 12 weeks of build_reproductions rows (confirmed_at) of each build on the
-- page, in its own request.
--
-- Correct whether or not any of it already exists. Existing builds are filled in below (one UPDATE over builds that have a worked run).
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (as any reader):
--   1. Works on model, as the list asks it:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.builds
--        WHERE status IN ('published', 'gallery') AND worked_models && ARRAY['opus-5-5'] LIMIT 50;
--      SHOULD SHOW: a Bitmap Index Scan on idx_builds_worked_models; no Seq Scan once the table is large.
--   2. The panel's counts:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.works_on_model_counts();
--      SHOULD SHOW: a scan of builds with worked_models <> '{}' feeding a HashAggregate; fewer than 100 rows out.
--   3. Reproductions range:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.builds
--        WHERE status IN ('published', 'gallery') AND reproduction_count >= 3 AND reproduction_count <= 20 LIMIT 50;
--      SHOULD SHOW: an Index Scan or Bitmap Scan on idx_builds_reproduction_count.
--   4. Rebuilds and Likes: the same with rebuild_count (idx_builds_rebuild_count) and like_count (idx_builds_like_count).
--   5. The spread:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.builds_count_spread();
--      SHOULD SHOW: five aggregates, each over an Index Only Scan or Index Scan on its own index; at most ~230 rows out.
--   6. The trigger, once: insert and delete one run on a test build and read builds.worked_models before and after.
--   If any plan shows a Seq Scan on a table of more than a few thousand rows, send the plan back.

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

-- 1. worked_models --------------------------------------------------------------------------------------------------------------

ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS worked_models text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.builds.worked_models IS
  'model_key() of each model a run worked on. Kept by trg_build_worked_models; written by nothing else.';

CREATE INDEX IF NOT EXISTS idx_builds_worked_models
  ON public.builds USING gin (worked_models);

CREATE OR REPLACE FUNCTION public.refresh_build_worked_models()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _build_ids uuid[];
  _build_id  uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _build_ids := ARRAY[NEW.build_id];
  ELSIF TG_OP = 'DELETE' THEN
    _build_ids := ARRAY[OLD.build_id];
  ELSIF NEW.build_id IS DISTINCT FROM OLD.build_id THEN
    _build_ids := ARRAY[NEW.build_id, OLD.build_id];
  ELSE
    _build_ids := ARRAY[NEW.build_id];
  END IF;

  FOREACH _build_id IN ARRAY _build_ids
  LOOP
    UPDATE public.builds b
    SET worked_models = COALESCE((
      SELECT array_agg(DISTINCT public.model_key(r.model_used) ORDER BY public.model_key(r.model_used))
      FROM public.build_reproductions r
      WHERE r.build_id = _build_id
        AND r.worked
        AND r.model_used IS NOT NULL
        AND public.model_key(r.model_used) <> ''
    ), '{}')
    WHERE b.id = _build_id;
  END LOOP;

  RETURN NULL;
END;
$$;

-- Only the trigger runs it: nobody calls it, so nobody may.
REVOKE ALL ON FUNCTION public.refresh_build_worked_models() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_build_worked_models() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_build_worked_models ON public.build_reproductions;
CREATE TRIGGER trg_build_worked_models
AFTER INSERT OR UPDATE OR DELETE ON public.build_reproductions
FOR EACH ROW EXECUTE FUNCTION public.refresh_build_worked_models();

-- Builds that already have runs.
UPDATE public.builds b
SET worked_models = s.models
FROM (
  SELECT r.build_id, array_agg(DISTINCT public.model_key(r.model_used) ORDER BY public.model_key(r.model_used)) AS models
  FROM public.build_reproductions r
  WHERE r.worked AND r.model_used IS NOT NULL AND public.model_key(r.model_used) <> ''
  GROUP BY r.build_id
) s
WHERE b.id = s.build_id AND b.worked_models IS DISTINCT FROM s.models;

-- 2. The panel's counts -----------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.works_on_model_counts()
RETURNS TABLE (model_key text, builds integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT k, count(*)::integer
  FROM public.builds b, unnest(b.worked_models) AS k
  WHERE b.status IN ('published', 'gallery')
  GROUP BY k
  ORDER BY 2 DESC, 1
  LIMIT 100
$$;

REVOKE ALL ON FUNCTION public.works_on_model_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.works_on_model_counts() TO anon, authenticated, service_role;

-- 3. The spread, for all five number filters ----------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.builds_count_spread()
RETURNS TABLE (kind text, value integer, builds integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 'steps'::text, least(b.step_count, 60), count(*)::integer
  FROM public.builds b
  WHERE b.status IN ('published', 'gallery') AND b.step_count IS NOT NULL
  GROUP BY 2
  UNION ALL
  SELECT 'sessions'::text, least(b.session_count, 20), count(*)::integer
  FROM public.builds b
  WHERE b.status IN ('published', 'gallery')
  GROUP BY 2
  UNION ALL
  SELECT 'reproductions'::text, least(b.reproduction_count, 50), count(*)::integer
  FROM public.builds b
  WHERE b.status IN ('published', 'gallery')
  GROUP BY 2
  UNION ALL
  SELECT 'rebuilds'::text, least(b.rebuild_count, 20), count(*)::integer
  FROM public.builds b
  WHERE b.status IN ('published', 'gallery')
  GROUP BY 2
  UNION ALL
  SELECT 'likes'::text, least(b.like_count, 50), count(*)::integer
  FROM public.builds b
  WHERE b.status IN ('published', 'gallery')
  GROUP BY 2
$$;

REVOKE ALL ON FUNCTION public.builds_count_spread() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.builds_count_spread() TO anon, authenticated, service_role;

-- 4. Indexes for the range filters ---------------------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_builds_reproduction_count
  ON public.builds (reproduction_count)
  WHERE status IN ('published', 'gallery');
CREATE INDEX IF NOT EXISTS idx_builds_rebuild_count
  ON public.builds (rebuild_count)
  WHERE status IN ('published', 'gallery');
CREATE INDEX IF NOT EXISTS idx_builds_like_count
  ON public.builds (like_count)
  WHERE status IN ('published', 'gallery');
