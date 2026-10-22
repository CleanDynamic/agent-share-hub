-- =============================================================================
-- buildgallery — the classification of a build (CA-16 Part 2 and Part 8)
-- =============================================================================
-- builds.classification holds what the maker declared in the Classification Card, what the app read from the build's
-- tiles, and where the maker disputed a read value (src/lib/classify/types.ts). builds.facets is computed from it by
-- the app on every save, as `<facet>:<id>` strings (src/lib/classify/facets.ts); a Field value also carries every
-- ancestor, custom entries never appear, a disputed value replaces the derived one.
--
-- WHAT THIS DOES, AND NOTHING ELSE
--   1. adds builds.classification jsonb NOT NULL DEFAULT '{}' and builds.facets text[] NOT NULL DEFAULT '{}';
--   2. adds a GIN index on builds.facets, so the Gallery's `facets && ARRAY[...]` filters are cheap;
--   3. adds classification_facets(thresholds jsonb): how many gallery builds carry each facet value, over the SAME builds
--      gallery_facets counts (published or gallery, the shape's completeness threshold passed in by the caller). It is
--      modelled on gallery_facets in 20261021140000_ca13_patterns.sql: SQL, STABLE, SECURITY INVOKER, search_path
--      pinned, execute granted to anon and authenticated. It returns [{ "value": "field:ai-ml", "count": 12 }, ...];
--   4. adds the view classification_custom_entries (facet, text, count) for Miles to review the maker's own entries so
--      new values can join a later taxonomy version. It is granted to NO client role.
--
-- Nothing existing is changed: shape, made_for, made_with, patterns and the cost columns stay as they are.
-- Idempotent: IF NOT EXISTS and CREATE OR REPLACE throughout; a second run changes nothing.

-- 1. The columns.
ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS classification jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.builds ADD COLUMN IF NOT EXISTS facets text[] NOT NULL DEFAULT '{}';

-- 2. The index.
CREATE INDEX IF NOT EXISTS idx_builds_facets ON public.builds USING gin (facets);

-- 3. The facet counts.
CREATE OR REPLACE FUNCTION public.classification_facets(thresholds jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object('value', f.value, 'count', f.count) ORDER BY f.count DESC, f.value ASC)
      FROM (
        SELECT facet AS value, count(*)::int AS count
        FROM public.builds b, unnest(b.facets) AS facet
        WHERE b.status IN ('published', 'gallery')
          AND (b.status = 'gallery' OR b.completeness >= COALESCE((thresholds ->> b.shape)::int, 101))
        GROUP BY facet
      ) f
    ),
    '[]'::jsonb
  );
$$;

COMMENT ON FUNCTION public.classification_facets(jsonb) IS
  'How many gallery builds carry each classification facet value, as [{ value, count }] (CA-16). Same gallery predicate and thresholds as gallery_facets.';

GRANT EXECUTE ON FUNCTION public.classification_facets(jsonb) TO anon, authenticated;

-- 4. The maker's own entries, for review. Read-only, and not granted to any client role.
CREATE OR REPLACE VIEW public.classification_custom_entries AS
  SELECT facet, text, count(*)::int AS count
  FROM (
    SELECT f.key AS facet, e ->> 'custom' AS text
    FROM public.builds b,
         jsonb_each(COALESCE(b.classification -> 'declared', '{}'::jsonb)) AS f(key, value),
         jsonb_array_elements(CASE WHEN jsonb_typeof(f.value) = 'array' THEN f.value ELSE '[]'::jsonb END) AS e
    WHERE e ? 'custom'
    UNION ALL
    SELECT d.key AS facet, substring(v from 8) AS text
    FROM public.builds b,
         jsonb_each(COALESCE(b.classification -> 'derived', '{}'::jsonb)) AS d(key, value),
         jsonb_array_elements_text(COALESCE(d.value -> 'values', '[]'::jsonb)) AS v
    WHERE v LIKE 'custom:%'
  ) entries
  WHERE text IS NOT NULL AND text <> ''
  GROUP BY facet, text;

REVOKE ALL ON public.classification_custom_entries FROM PUBLIC;
REVOKE ALL ON public.classification_custom_entries FROM anon, authenticated;
COMMENT ON VIEW public.classification_custom_entries IS
  'The maker''s own classification entries, with how many builds use each (CA-16). For review in the SQL editor; granted to no client role.';
