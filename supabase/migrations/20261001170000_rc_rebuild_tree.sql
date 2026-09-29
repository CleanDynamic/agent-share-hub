-- =============================================================================
-- RC-P14 — rebuild_tree: a build's family of rebuilds
-- =============================================================================
-- WHAT IT ANSWERS. The build whose id is `root`, and every published rebuild
-- below it, found by following builds.parent_build_id downward: its rebuilds,
-- their rebuilds, and so on. One row per build, with its depth under the root
-- (the root is 0) and the columns a family tree draws: slug, title, maker,
-- when it went live, how many reproduced it and the rebuilder's note.
--
-- WHAT IS IN THE FAMILY. Below the root, only builds whose status is published
-- or gallery: a draft fork is its forker's business and is drawn nowhere, the
-- same rule listRebuilds and the rebuild_count trigger apply, and the walk
-- does not continue through a draft. The root itself is returned whatever its
-- status, so a creator looking at their own draft's family sees the draft at
-- the top; row-level security still decides whether the caller may read it at
-- all.
--
-- ITS LIMITS. The walk stops 20 levels below the root, and no build is visited
-- twice on one path, so a parent_build_id cycle cannot make it loop. The order
-- is depth, then published_at (oldest first within a generation). At most 200
-- rows, whatever max_nodes asks for, and at least one.
--
-- SECURITY INVOKER ⟦supabase-postgres-best-practices ›
-- references/security-rls-basics.md⟧: the builds read policy decides what the
-- caller can see — every non-draft build, plus their own drafts — and the
-- function's status test narrows that; it never widens it. It never reads the
-- caller's id itself. STABLE; it writes nothing.
--
-- THE INDEX ⟦references/schema-foreign-key-indexes.md⟧. Each step of the walk
-- asks "which builds name THIS build as their parent", which is an index read
-- on builds(parent_build_id). NS-P36 created exactly that index as
-- idx_builds_parent_build (20260827140000_rebuild_columns.sql), and the live
-- database has drifted from these files before, so section 3 creates
-- idx_builds_parent only where no index on builds already leads with
-- parent_build_id: never a second copy of the same index, and never none.
--
-- THE CHECK TO RUN once applied:
--   select * from public.rebuild_tree((select id from public.builds
--     where status in ('published', 'gallery') order by rebuild_count desc limit 1));
-- =============================================================================


-- =============================================================================
-- 1. rebuild_tree
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rebuild_tree(
  root      UUID,
  max_nodes INT DEFAULT 200
)
RETURNS TABLE (
  id                 UUID,
  parent_build_id    UUID,
  depth              INT,
  slug               TEXT,
  title              TEXT,
  creator_id         UUID,
  published_at       TIMESTAMPTZ,
  reproduction_count INT,
  rebuild_note       TEXT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH RECURSIVE family AS (
    SELECT b.id,
           b.parent_build_id,
           0 AS depth,
           b.slug,
           b.title,
           b.creator_id,
           b.published_at,
           b.reproduction_count,
           b.rebuild_note,
           ARRAY[b.id] AS path
      FROM public.builds b
     WHERE b.id = rebuild_tree.root
    UNION ALL
    SELECT c.id,
           c.parent_build_id,
           f.depth + 1,
           c.slug,
           c.title,
           c.creator_id,
           c.published_at,
           c.reproduction_count,
           c.rebuild_note,
           f.path || c.id
      FROM public.builds c
      JOIN family f ON c.parent_build_id = f.id
     WHERE f.depth < 20
       AND c.status IN ('published', 'gallery')
       AND NOT c.id = ANY (f.path)
  )
  SELECT family.id,
         family.parent_build_id,
         family.depth,
         family.slug,
         family.title,
         family.creator_id,
         family.published_at,
         family.reproduction_count,
         family.rebuild_note
    FROM family
   ORDER BY family.depth, family.published_at
   LIMIT LEAST(GREATEST(rebuild_tree.max_nodes, 1), 200);
$$;

COMMENT ON FUNCTION public.rebuild_tree(UUID, INT) IS
  'A build''s family of rebuilds: the root build (whatever its status) and every published or gallery build below it by parent_build_id, at most 20 levels deep, ordered by depth then published_at, between 1 and 200 rows. SECURITY INVOKER — row-level security decides what the caller can see. Consumed by src/lib/build/lineage.ts.';


-- =============================================================================
-- 2. Grants
-- =============================================================================
-- The family is read signed out as well as signed in, so both roles may call
-- it; row-level security, not the grant, keeps the answer honest.
REVOKE ALL ON FUNCTION public.rebuild_tree(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_tree(UUID, INT) TO anon, authenticated;


-- =============================================================================
-- 3. The index the walk reads through
-- =============================================================================
-- Created only where no valid index on public.builds already has
-- parent_build_id as its first key column, which is the column the walk looks
-- up. Where one exists (NS-P36's idx_builds_parent_build), it serves the walk
-- and this section changes nothing.
DO $index$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = i.indrelid
       AND a.attnum = i.indkey[0]
     WHERE i.indrelid = 'public.builds'::regclass
       AND i.indisvalid
       AND a.attname = 'parent_build_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_builds_parent
      ON public.builds (parent_build_id)
      WHERE parent_build_id IS NOT NULL;
  END IF;
END
$index$;
