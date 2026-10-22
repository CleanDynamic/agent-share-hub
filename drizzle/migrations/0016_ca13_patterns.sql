-- =============================================================================
-- buildgallery — the patterns a build uses (CA-13 Part 11)
-- =============================================================================
-- builds.patterns holds which of three patterns the build uses, worked out by the app from the build
-- itself (src/lib/build/patterns.ts) whenever its making stats are refreshed:
--   router             a Decision with at least one step that runs when it went a certain way
--   long-running       an agent with at least one helper, or a background session that ran over an hour
--   structured-output  a Decision, or any step with an answer shape
--
-- WHAT THIS DOES, AND NOTHING ELSE
--   1. adds builds.patterns text[] NOT NULL DEFAULT '{}', with a check that every value is one of the three;
--   2. adds a GIN index so the Gallery's pattern filter is cheap;
--   3. makes gallery_facets(thresholds jsonb) also return `patterns`: how many gallery builds use each, over the SAME
--      builds the shape facet counts (published or gallery, the shape's completeness threshold passed in by the caller).
--
-- THE LIVE gallery_facets IS NOT ASSUMED TO MATCH THE REPOSITORY'S COPY (the live database has drifted from the
-- migrations), so it is not rewritten. It is renamed once to gallery_facets_base, and gallery_facets becomes a thin wrapper that
-- returns the base's answer with `patterns` added. Signature, SECURITY INVOKER, STABLE, search_path and grants are kept.
--
-- Idempotent: every step checks before it acts, so a second run changes nothing. If gallery_facets does not exist at all
-- it stops with "CA-13: ..." and nothing is changed.

-- 1. The column and its check.
ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS patterns text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.builds'::regclass AND conname = 'builds_patterns_known'
  ) THEN
    ALTER TABLE public.builds
      ADD CONSTRAINT builds_patterns_known
      CHECK (patterns <@ ARRAY['router', 'long-running', 'structured-output']::text[]);
  END IF;
END $$;

-- 2. The index.
CREATE INDEX IF NOT EXISTS idx_builds_patterns ON public.builds USING gin (patterns);

-- 3. The facet.
DO $$
BEGIN
  IF to_regprocedure('public.gallery_facets_base(jsonb)') IS NULL THEN
    IF to_regprocedure('public.gallery_facets(jsonb)') IS NULL THEN
      RAISE EXCEPTION 'CA-13: public.gallery_facets(jsonb) does not exist; nothing was changed. Apply the NS-P19 facets migration first.';
    END IF;
    ALTER FUNCTION public.gallery_facets(jsonb) RENAME TO gallery_facets_base;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gallery_facets(thresholds jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.gallery_facets_base(thresholds)
    || jsonb_build_object(
         'patterns',
         COALESCE(
           (
             SELECT jsonb_agg(jsonb_build_object('value', p.value, 'count', p.count) ORDER BY p.count DESC, p.value ASC)
             FROM (
               SELECT pattern AS value, count(*)::int AS count
               FROM public.builds b, unnest(b.patterns) AS pattern
               WHERE b.status IN ('published', 'gallery')
                 AND (b.status = 'gallery' OR b.completeness >= COALESCE((thresholds ->> b.shape)::int, 101))
               GROUP BY pattern
             ) p
           ),
           '[]'::jsonb
         )
       );
$$;

COMMENT ON FUNCTION public.gallery_facets(jsonb) IS
  'The gallery filter facets: gallery_facets_base (made for, made with) plus how many gallery builds use each of the three patterns (CA-13).';

GRANT EXECUTE ON FUNCTION public.gallery_facets(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gallery_facets_base(jsonb) TO anon, authenticated;
