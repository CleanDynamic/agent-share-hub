-- SV-23 Part 1: stored counts on builds.
--
-- step_count, part_count, agent_count are written by the composer with the classification facets (1.5 seconds after the tiles stop
-- changing), from the same functions the composer counts with (buildSteps, sessionGroups, the stored parts), so a stored count is the
-- number the composer shows. session_count already exists (20261001280000_sessions_and_making.sql); it is added here only if it is
-- missing, and its one writer becomes the same composer write. NULL in the three new columns means "not written yet": an existing
-- build gets its counts the next time it is saved, and a range filter leaves a build with no count out.
--
-- builds_count_spread(): how many published builds sit at each value of Steps and Sessions (a value above the cap is counted at the cap),
-- for the filter panel's histograms. One request, at most ~85 rows. SECURITY INVOKER: it reads what the caller may read.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (as any reader):
--   1. The Steps range filter, as the Builds list asks it:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.builds
--        WHERE status IN ('published', 'gallery') AND step_count >= 5 AND step_count <= 30 LIMIT 50;
--      SHOULD SHOW: a Bitmap or Index Scan on idx_builds_step_count; no Seq Scan on builds once the table is large.
--   2. The Sessions range filter:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.builds
--        WHERE status IN ('published', 'gallery') AND session_count >= 2 LIMIT 50;
--      SHOULD SHOW: a Bitmap or Index Scan on idx_builds_session_count.
--   3. The spread:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.builds_count_spread();
--      SHOULD SHOW: an Index Only Scan (or Index Scan) on idx_builds_step_count and idx_builds_session_count feeding a GroupAggregate or
--      HashAggregate; no Sort of the whole table.
--   If any shows a Seq Scan on a table of more than a few thousand rows, send the plan back.

ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS step_count    integer,
  ADD COLUMN IF NOT EXISTS part_count    integer,
  ADD COLUMN IF NOT EXISTS agent_count   integer,
  ADD COLUMN IF NOT EXISTS session_count integer NOT NULL DEFAULT 0;

DO $$
DECLARE
  _c RECORD;
BEGIN
  FOR _c IN
    SELECT * FROM (VALUES
      ('builds_step_count_check',  'CHECK (step_count IS NULL OR step_count >= 0)'),
      ('builds_part_count_check',  'CHECK (part_count IS NULL OR part_count >= 0)'),
      ('builds_agent_count_check', 'CHECK (agent_count IS NULL OR agent_count >= 0)')
    ) AS v(name, ddl)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.builds'::regclass AND conname = _c.name
    ) THEN
      EXECUTE format('ALTER TABLE public.builds ADD CONSTRAINT %I %s', _c.name, _c.ddl);
    END IF;
  END LOOP;
END $$;

COMMENT ON COLUMN public.builds.step_count IS
  'Top-level steps, as the composer counts them (buildSteps). NULL until the composer has saved the build once after SV-23.';
COMMENT ON COLUMN public.builds.part_count IS
  'Parts (workstreams) of the build, as the composer stores them. NULL until saved after SV-23.';
COMMENT ON COLUMN public.builds.agent_count IS
  'Agent steps anywhere in the build. NULL until saved after SV-23.';

-- The range filters only ever read published builds.
CREATE INDEX IF NOT EXISTS idx_builds_step_count
  ON public.builds (step_count)
  WHERE status IN ('published', 'gallery') AND step_count IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_builds_session_count
  ON public.builds (session_count)
  WHERE status IN ('published', 'gallery');

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
$$;

REVOKE ALL ON FUNCTION public.builds_count_spread() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.builds_count_spread() TO anon, authenticated, service_role;