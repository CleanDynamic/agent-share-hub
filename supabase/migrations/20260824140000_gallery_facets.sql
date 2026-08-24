-- =============================================================================
-- NeoScale — the gallery's filter facets (NS-P19)
-- =============================================================================
-- One function. No table, no policy, no change to anything that already exists.
--
-- WHAT IT IS FOR
-- The gallery is filtered by Made for (a role) and Made with (a tool). Those
-- two filters are the answer to a sparse launch: they turn one broad platform
-- into many dense ones, so they sit in the primary position rather than behind
-- a menu — and a filter in the primary position has to know its own options
-- before the reader picks anything.
--
-- Both columns are TEXT[], so the distinct values are not a column anyone can
-- select. Working them out in the browser would mean reading every gallery
-- build's arrays back to count them, which is the fifteen-query pattern in a
-- different hat, and it would still only ever see the page that happened to
-- load. This does it in one round trip, over exactly the set of builds the
-- gallery itself would show.
--
-- WHY THE THRESHOLDS ARE AN ARGUMENT
-- Gallery membership is `completeness >= the threshold for this shape`, and
-- those thresholds are DERIVED from the shape rule table in
-- src/lib/build/signals.ts. TypeScript is where that table lives, so the
-- numbers are passed in on every call rather than duplicated here. A copy in
-- SQL is a copy that goes stale the first time a weight changes.
--
-- SECURITY INVOKER, deliberately. The function reads builds and
-- ai_tools_registry through the caller's own row level security: an anonymous
-- reader counts published builds, an admin counts what an admin can see, and
-- nobody's draft is counted for anybody. A SECURITY DEFINER function here
-- would leak the shape of unpublished work through its counts.
-- =============================================================================


CREATE OR REPLACE FUNCTION public.gallery_facets(thresholds JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT b.made_for, b.made_with
    FROM public.builds b
    WHERE b.status IN ('published', 'gallery')
      AND (
        -- editorial promotion, included whatever the record scores
        b.status = 'gallery'
        -- 101 is unreachable on purpose: a shape the caller did not send a
        -- threshold for is excluded rather than admitted by default, which
        -- keeps these counts in step with the gallery query, which likewise
        -- only ever names the shapes it knows.
        OR b.completeness >= COALESCE((thresholds ->> b.shape)::int, 101)
      )
  ),
  roles AS (
    SELECT btrim(role) AS value, count(*)::int AS count
    FROM visible, unnest(COALESCE(visible.made_for, '{}')) AS role
    WHERE btrim(role) <> ''
    GROUP BY btrim(role)
  ),
  tools AS (
    SELECT btrim(tool) AS value, count(*)::int AS count
    FROM visible, unnest(COALESCE(visible.made_with, '{}')) AS tool
    WHERE btrim(tool) <> ''
    GROUP BY btrim(tool)
  )
  SELECT jsonb_build_object(
    'roles',
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'value', r.value,
                   'count', r.count,
                   -- a role is free text a creator typed; there is no registry
                   -- of roles to give it a nicer name than the one they chose
                   'label', NULL,
                   'logo_url', NULL
                 )
                 ORDER BY r.count DESC, r.value ASC
               )
        FROM roles r
      ),
      '[]'::jsonb
    ),
    'tools',
    COALESCE(
      (
        SELECT jsonb_agg(
                 jsonb_build_object(
                   'value', t.value,
                   'count', t.count,
                   'label', reg.name,
                   'logo_url', reg.logo_url
                 )
                 ORDER BY t.count DESC, t.value ASC
               )
        FROM tools t
        -- WHERE A MATCH EXISTS. made_with holds what the creator typed, which
        -- is what the gallery query filters on, so the join only ever supplies
        -- a display name and a logo. An unmatched tool is still offered as a
        -- filter under the creator's own spelling.
        LEFT JOIN LATERAL (
          SELECT reg_inner.name, reg_inner.logo_url
          FROM public.ai_tools_registry reg_inner
          WHERE lower(reg_inner.name) = lower(t.value)
             OR lower(COALESCE(reg_inner.slug, '')) = lower(t.value)
          ORDER BY reg_inner.is_official DESC, reg_inner.name ASC
          LIMIT 1
        ) reg ON TRUE
      ),
      '[]'::jsonb
    )
  );
$$;

COMMENT ON FUNCTION public.gallery_facets(JSONB) IS
  'Distinct made_for and made_with values across the builds the gallery shows, with counts and registry display names for tools. Thresholds are passed in from src/lib/build/gallery.ts, where they are derived from the shape rule table.';

GRANT EXECUTE ON FUNCTION public.gallery_facets(JSONB) TO anon, authenticated;
