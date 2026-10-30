CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

DO $$
DECLARE
  trgm_schema TEXT;
BEGIN
  SELECT n.nspname INTO trgm_schema
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF trgm_schema IS NULL THEN
    RAISE EXCEPTION 'RC-P07: pg_trgm is not installed, so the search indexes cannot be built';
  END IF;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_builds_title_trgm ON public.builds '
    'USING gin (title %I.gin_trgm_ops) '
    'WHERE status IN (''published'', ''gallery'')',
    trgm_schema
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_builds_outcome_trgm ON public.builds '
    'USING gin (outcome %I.gin_trgm_ops) '
    'WHERE status IN (''published'', ''gallery'')',
    trgm_schema
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS idx_build_nodes_title_trgm ON public.build_nodes '
    'USING gin (title %I.gin_trgm_ops) '
    'WHERE position IS NOT NULL',
    trgm_schema
  );
END
$$;

CREATE OR REPLACE FUNCTION public.search_build_ids(
  q           TEXT,
  max_results INT DEFAULT 200
)
RETURNS TABLE (build_id UUID)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  needle  TEXT := pg_catalog.left(
                    pg_catalog.btrim(
                      pg_catalog.regexp_replace(COALESCE(q, ''), '\s+', ' ', 'g')
                    ),
                    80
                  );
  like_pattern TEXT;
  cap     INT := LEAST(GREATEST(COALESCE(max_results, 200), 0), 200);
BEGIN
  IF pg_catalog.char_length(needle) < 2 THEN
    RETURN;
  END IF;

  -- The reader's text, literally: backslash first, then the two wildcards.
  like_pattern := '%'
    || pg_catalog.replace(
         pg_catalog.replace(
           pg_catalog.replace(needle, '\', '\\'),
           '%', '\%'),
         '_', '\_')
    || '%';

  RETURN QUERY
  WITH hits AS (
    SELECT b.id
      FROM public.builds b
     WHERE b.status IN ('published', 'gallery')
       AND b.title ILIKE like_pattern
    UNION
    SELECT b.id
      FROM public.builds b
     WHERE b.status IN ('published', 'gallery')
       AND b.outcome ILIKE like_pattern
    UNION
    SELECT b.id
      FROM public.builds b
     WHERE b.status IN ('published', 'gallery')
       AND EXISTS (
             SELECT 1
               FROM pg_catalog.unnest(b.made_for || b.made_with) AS tag(v)
              WHERE tag.v ILIKE like_pattern
           )
    UNION
    SELECT n.build_id
      FROM public.build_nodes n
     WHERE n.position IS NOT NULL
       AND n.title ILIKE like_pattern
  )
  SELECT b.id
    FROM public.builds b
    JOIN hits h ON h.id = b.id
   WHERE b.status IN ('published', 'gallery')
   ORDER BY b.reproduction_count DESC, b.published_at DESC NULLS LAST, b.id
   LIMIT cap;
END;
$$;

COMMENT ON FUNCTION public.search_build_ids(TEXT, INT) IS
  'The one search: ids of published and gallery builds whose title, outcome, made-for, made-with or placed-node title contains the query, most reproduced first, then most recently published, at most 200. The query is trimmed, whitespace collapsed, cut to 80 characters and ignored below 2. SECURITY INVOKER — row-level security decides what a reader can find. Consumed by src/lib/build/search.ts.';

REVOKE ALL ON FUNCTION public.search_build_ids(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_build_ids(TEXT, INT) TO anon, authenticated;