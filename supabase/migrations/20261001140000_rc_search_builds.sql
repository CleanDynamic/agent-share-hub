-- =============================================================================
-- RC-P07 — search_build_ids: one search, over builds
-- =============================================================================
-- WRITTEN IN THIS SESSION FROM THE PROMPT'S SPECIFICATION. RC-P07 step 2 says
-- to create this file "with exactly" a SQL block the prompt did not carry: its
-- placeholder, {{SQL_P07}}, arrived unfilled. What is below implements the
-- prompt's own "SEARCH, EXACTLY" paragraph, the Lovable message L-P07-1
-- (enable pg_trgm, three indexes, one read-only function) and the report's
-- checks (SECURITY INVOKER; the caller's id is never read bare). The owner
-- reviews it before L-P07-1 is sent; nothing in this series applies a
-- migration.
--
-- WHAT IT SEARCHES. builds.title, builds.outcome, builds.made_for,
-- builds.made_with and build_nodes.title, for builds whose status is published
-- or gallery. A node counts only when it is placed in the record (position IS
-- NOT NULL): a node with no position is unassigned material in the compose
-- tray, which is never rendered publicly, so its title must not make a build
-- findable either.
--
-- THE QUERY, AS THE CLIENT SENDS IT AND AS THIS FUNCTION RE-READS IT. Runs of
-- whitespace become one space, the ends are trimmed, it is cut to 80
-- characters, and below 2 characters it is no query at all: the function
-- returns no rows. The browser applies the same rules (normaliseQuery in
-- src/lib/build/search.ts); they are applied again here because a caller that
-- skipped them must not be able to ask for more than the rules allow. The
-- reader's text is matched literally: %, _ and \ are escaped, so a query of
-- "100%" looks for those four characters rather than for "100" followed by
-- anything.
--
-- THE ORDER is the gallery's evidence order: reproduction_count descending,
-- then published_at descending (never-published last), then id, which only
-- breaks exact ties so that the same query always returns the same list. At
-- most 200 ids, whatever max_results asks for.
--
-- WHY TRIGRAMS AND NOT tsvector
-- ⟦supabase-postgres-best-practices › references/advanced-full-text-search.md⟧
-- was considered and not used: titles are short and readers type partial
-- words — "agen" for "agent", "triag" for "triage" — which a tsvector matches
-- poorly. ILIKE with a leading wildcard matches them exactly, and a trigram GIN
-- index is the index type that serves ILIKE with a leading wildcard
-- ⟦references/query-index-types.md⟧.
--
-- THE THREE INDEXES serve the three text arms: builds.title, builds.outcome
-- and build_nodes.title. Each arm is its own branch of a UNION so the planner
-- can use each index on its own; an OR across all five fields would make one
-- unindexable arm drag the whole query to a scan. made_for and made_with are
-- short arrays of short tags, matched element by element in a scan of the
-- published builds — nothing at today's size, and the arm to index first if
-- the gallery grows past it. The builds indexes are partial on the same status
-- test the query uses, and the node index on the same position test, so the
-- planner can prove each one covers its arm.
--
-- SECURITY INVOKER ⟦references/security-rls-basics.md⟧: row-level security
-- decides what a reader can find. The function adds its own status test on
-- top, so a creator searching never sees their own drafts come back, but it
-- never widens what the caller could read for themselves. It never reads the
-- caller's id itself. STABLE; search_path pinned empty, every name qualified.
--
-- IT WRITES NOTHING. The extension and the indexes are the only objects it
-- creates besides the function. CREATE INDEX takes a short lock on builds and
-- build_nodes; both are small (Q7: 9 builds, 13 nodes).
--
-- THE CHECK TO RUN once applied (L-P07-1):
--   select count(*) from public.search_build_ids('ab');
-- =============================================================================


-- =============================================================================
-- 1. pg_trgm
-- =============================================================================
-- In the extensions schema, as this project installs pg_cron and pg_net.
-- IF NOT EXISTS keeps a copy already installed elsewhere where it is; section
-- 2 finds whichever schema it is in.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;


-- =============================================================================
-- 2. The three trigram indexes
-- =============================================================================
-- The operator class is qualified with the schema the extension actually lives
-- in, read from the catalogue, so this is correct whether pg_trgm was just
-- created in extensions or was already installed somewhere else.
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


-- =============================================================================
-- 3. search_build_ids
-- =============================================================================
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


-- =============================================================================
-- 4. Grants
-- =============================================================================
-- Readers search signed out as well as signed in, so both roles may call it;
-- row-level security, not the grant, is what keeps the answer honest.
REVOKE ALL ON FUNCTION public.search_build_ids(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_build_ids(TEXT, INT) TO anon, authenticated;
