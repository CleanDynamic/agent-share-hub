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

REVOKE ALL ON FUNCTION public.rebuild_tree(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rebuild_tree(UUID, INT) TO anon, authenticated;

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