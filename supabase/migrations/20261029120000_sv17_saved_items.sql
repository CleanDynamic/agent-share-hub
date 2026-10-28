-- SV-17: saved items below build size, and collection kinds.
--
-- A reader can keep a part, a session, a step, a request or a filter set, not only a build. Builds stay in build_saves, so
-- builds.save_count keeps working. A public collection can be kept too (kind 'collection'), which is what "saved by n" counts.
--
-- PRIVATE TO THE SAVER. saved_items has an owner-only policy for every command and no grant for anon, so nobody else reads a
-- row, the source's maker included.
--
-- GRANTS ARE EXPLICIT. The table is revoked from anon and authenticated, then authenticated is granted exactly the four
-- verbs its policies serve, as 20260917120000 does; nothing relies on the platform's default privileges.
--
-- user_id REFERENCES public.profiles(id), as builds.creator_id and collections.owner_id do, not the auth schema. A profile
-- is made for every account (handle_new_user) and cascades from it, so a deleted account still removes its saved items. The one thing others may see is a count of how many readers kept a public collection,
-- through collection_saved_by_count, which returns numbers and no row.
--
-- A SAVED COPY OUTLIVES ITS SOURCE. build_id is ON DELETE SET NULL, so a removed build leaves the snapshot usable.
-- (SV-19 reports what happens when a maker deletes their account; this does not decide it.)
--
-- A DRAFT'S CONTENT CAN'T BE SAVED. The insert policy refuses a build_id whose build is a draft. The subquery runs under the
-- saver's own rights, so a build they can't read is refused too.
--
-- USED IN. A tile put in a build from a saved part or step carries the source tile's id in source_ref->>'node_id' (SV-18 writes
-- it); a tile from a session carries source_ref->>'import_session_id' (already written). saved_items_used_in() counts, for the
-- caller's own saved items, the builds with such a tile. It is SECURITY INVOKER, so a build the caller can't read isn't counted.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The Library list of one kind, newest use first:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id, kind, build_id, ref, last_used_at FROM public.saved_items
--      WHERE user_id = '<a reader with saved items>' AND kind = 'step' ORDER BY last_used_at DESC LIMIT 25;
--      SHOULD SHOW: an Index Scan on idx_saved_items_user_kind_used, no Sort, no Seq Scan on saved_items.
--   2. Used in, for one reader:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.saved_items_used_in();
--      SHOULD SHOW: Index Scans or Bitmap Index Scans on idx_build_nodes_source_node and idx_build_nodes_source_import_session
--      for the joins, no Seq Scan on build_nodes.
--   3. Saved by, for one page of collections:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.collection_saved_by_count(ARRAY['<a public collection id>']::uuid[]);
--      SHOULD SHOW: an Index Scan on idx_saved_items_collection_ref, no Seq Scan on saved_items.

-- 1. saved_items -----------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.saved_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind           text        NOT NULL,
  build_id       uuid        NULL REFERENCES public.builds(id) ON DELETE SET NULL,
  ref            text        NULL,
  snapshot       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  source_version text        NULL,
  note           text        NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_used_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_items_kind_check CHECK (kind IN ('part','session','step','request','filter_set','collection')),
  CONSTRAINT saved_items_note_length CHECK (note IS NULL OR char_length(note) <= 2000)
);

-- One row per (reader, kind, build, ref). build_id and ref are null for some kinds, and null never equals null in a unique
-- constraint, so the index compares what they stand for.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_saved_items_owner_source
  ON public.saved_items (user_id, kind, coalesce(build_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(ref, ''));

CREATE INDEX IF NOT EXISTS idx_saved_items_user_kind_used
  ON public.saved_items (user_id, kind, last_used_at DESC);

-- Backs "saved by n" on a public collection: the saves of one collection, whoever made them.
CREATE INDEX IF NOT EXISTS idx_saved_items_collection_ref
  ON public.saved_items (ref)
  WHERE kind = 'collection';

CREATE INDEX IF NOT EXISTS idx_saved_items_build
  ON public.saved_items (build_id)
  WHERE build_id IS NOT NULL;

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Readers read their own saved items" ON public.saved_items;
CREATE POLICY "Readers read their own saved items"
  ON public.saved_items FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers add their own saved items" ON public.saved_items;
CREATE POLICY "Readers add their own saved items"
  ON public.saved_items FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (
      build_id IS NULL
      OR EXISTS (SELECT 1 FROM public.builds b WHERE b.id = saved_items.build_id AND b.status <> 'draft')
    )
  );

-- A reader changes their own note and last use, and the snapshot when they take a newer version (SV-19). Never the owner.
DROP POLICY IF EXISTS "Readers change their own saved items" ON public.saved_items;
CREATE POLICY "Readers change their own saved items"
  ON public.saved_items FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers remove their own saved items" ON public.saved_items;
CREATE POLICY "Readers remove their own saved items"
  ON public.saved_items FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

REVOKE ALL ON public.saved_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;

COMMENT ON TABLE public.saved_items IS
  'SV-17. A part, session, step, request, filter set or public collection a reader kept, as a snapshot. Private: only the reader reads, writes and removes their own. Builds are in build_saves.';

-- 2. collection_items can hold them -----------------------------------------------------------------------------------------

ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS saved_item_id uuid NULL REFERENCES public.saved_items(id) ON DELETE CASCADE;
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS position integer NULL;
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS note text NULL;

CREATE INDEX IF NOT EXISTS idx_collection_items_saved_item
  ON public.collection_items (saved_item_id)
  WHERE saved_item_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_collection_items_collection_saved_item
  ON public.collection_items (collection_id, saved_item_id)
  WHERE saved_item_id IS NOT NULL;

-- The kind check is found in the catalogue, as 20261001180000 found it: every CHECK whose only column is item_kind. The new
-- one allows the five kinds a saved item can be on top of the six it allowed. Finding none stops the migration.
DO $$
DECLARE
  _kind_attnum smallint;
  _conname     text;
  _dropped     int := 0;
BEGIN
  SELECT a.attnum INTO _kind_attnum
    FROM pg_attribute a
   WHERE a.attrelid = 'public.collection_items'::regclass
     AND a.attname = 'item_kind'
     AND NOT a.attisdropped;

  IF _kind_attnum IS NULL THEN
    RAISE EXCEPTION 'SV-17: collection_items has no item_kind column; nothing was changed';
  END IF;

  FOR _conname IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.collection_items'::regclass
       AND c.contype = 'c'
       AND c.conkey = ARRAY[_kind_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.collection_items DROP CONSTRAINT %I', _conname);
    _dropped := _dropped + 1;
  END LOOP;

  IF _dropped = 0 THEN
    RAISE EXCEPTION 'SV-17: no check constraint on collection_items.item_kind was found; nothing was changed. Constraints on collection_items: %',
      (SELECT string_agg(c.conname, ', ' ORDER BY c.conname)
         FROM pg_constraint c
        WHERE c.conrelid = 'public.collection_items'::regclass);
  END IF;

  ALTER TABLE public.collection_items
    ADD CONSTRAINT collection_items_item_kind_check
    CHECK (item_kind IS NULL OR item_kind IN ('build','blueprint','blog','bounty','stage','block','part','session','step','request','filter_set'));

  -- A saved item and its row arrive together or not at all.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
     WHERE c.conrelid = 'public.collection_items'::regclass
       AND c.conname = 'collection_items_saved_item_matches_kind'
  ) THEN
    ALTER TABLE public.collection_items
      ADD CONSTRAINT collection_items_saved_item_matches_kind
      CHECK ((item_kind IN ('part','session','step','request','filter_set')) = (saved_item_id IS NOT NULL));
  END IF;
END;
$$;

-- 3. Used in -----------------------------------------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_build_nodes_source_node
  ON public.build_nodes ((source_ref ->> 'node_id'))
  WHERE source_ref ->> 'node_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_build_nodes_source_import_session
  ON public.build_nodes ((source_ref ->> 'import_session_id'))
  WHERE source_ref ->> 'import_session_id' IS NOT NULL;

-- For each of the caller's saved parts, steps and sessions, the number of other builds with a tile that came from it.
CREATE OR REPLACE FUNCTION public.saved_items_used_in()
RETURNS TABLE (saved_item_id uuid, builds integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT s.id, count(DISTINCT n.build_id)::integer
    FROM public.saved_items s
    JOIN public.build_nodes n
      ON n.source_ref ->> 'node_id' = s.ref
     AND s.kind IN ('part','step')
   WHERE s.user_id = (select auth.uid())
     AND n.build_id IS DISTINCT FROM s.build_id
   GROUP BY s.id
  UNION ALL
  SELECT s.id, count(DISTINCT n.build_id)::integer
    FROM public.saved_items s
    JOIN public.build_nodes n
      ON n.source_ref ->> 'import_session_id' = s.ref
     AND s.kind = 'session'
   WHERE s.user_id = (select auth.uid())
     AND n.build_id IS DISTINCT FROM s.build_id
   GROUP BY s.id
  LIMIT 1000
$$;

REVOKE EXECUTE ON FUNCTION public.saved_items_used_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saved_items_used_in() TO authenticated;

-- 4. Saved by ----------------------------------------------------------------------------------------------------------------

-- How many readers other than the owner kept each of these public collections. Numbers only, no row of anyone's. A collection
-- that isn't public, or isn't there, is absent from the answer.
CREATE OR REPLACE FUNCTION public.collection_saved_by_count(_collection_ids uuid[])
RETURNS TABLE (collection_id uuid, saved_by integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, count(s.id)::integer
    FROM public.collections c
    LEFT JOIN public.saved_items s
      ON s.kind = 'collection'
     AND s.ref = c.id::text
     AND s.user_id <> c.owner_id
   WHERE c.id = ANY (_collection_ids[1:100])
     AND c.is_public = true
   GROUP BY c.id
$$;

REVOKE EXECUTE ON FUNCTION public.collection_saved_by_count(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collection_saved_by_count(uuid[]) TO anon, authenticated;
