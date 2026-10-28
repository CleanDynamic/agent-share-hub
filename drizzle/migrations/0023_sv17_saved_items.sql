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

CREATE UNIQUE INDEX IF NOT EXISTS uniq_saved_items_owner_source
  ON public.saved_items (user_id, kind, coalesce(build_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(ref, ''));

CREATE INDEX IF NOT EXISTS idx_saved_items_user_kind_used
  ON public.saved_items (user_id, kind, last_used_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_items_collection_ref
  ON public.saved_items (ref)
  WHERE kind = 'collection';

CREATE INDEX IF NOT EXISTS idx_saved_items_build
  ON public.saved_items (build_id)
  WHERE build_id IS NOT NULL;

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.saved_items FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_items TO authenticated;
GRANT ALL ON public.saved_items TO service_role;

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

COMMENT ON TABLE public.saved_items IS
  'SV-17. A part, session, step, request, filter set or public collection a reader kept, as a snapshot. Private: only the reader reads, writes and removes their own. Builds are in build_saves.';

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

CREATE INDEX IF NOT EXISTS idx_build_nodes_source_node
  ON public.build_nodes ((source_ref ->> 'node_id'))
  WHERE source_ref ->> 'node_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_build_nodes_source_import_session
  ON public.build_nodes ((source_ref ->> 'import_session_id'))
  WHERE source_ref ->> 'import_session_id' IS NOT NULL;

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