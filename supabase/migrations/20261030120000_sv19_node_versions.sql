-- SV-19: a node knows when its content last changed.
--
-- Library shows `Edited` when a saved step's source changed after it was saved. That needs a version on each node, and
-- build_nodes had only created_at. This adds updated_at, and a trigger that moves it when the node's CONTENT changes.
--
-- WHAT COUNTS AS A CHANGE. type, title, note, payload. Moving a node (position, parent_id) does not move the version, so
-- re-ordering a build never reads as an edit of every step in it. Undo writes rows back with their original ids; if that
-- restores different content it is an update and the version moves, which is correct.
--
-- EXISTING ROWS take created_at, so nothing already saved reads as edited because of this migration. saved_items.source_version
-- (text, already there) holds the timestamp as ISO text; rows saved before this migration have null and read as unchanged.
--
-- The trigger function is a plain (SECURITY INVOKER) function: it only sets a column on the row being written, reads no other
-- row, and needs no rights the writer lacks. search_path is pinned all the same.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (no new index; the reads are by primary key and by build_id):
--   1. The versions of several steps:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id, updated_at FROM public.build_nodes WHERE id = ANY (ARRAY['<id>','<id>']::uuid[]) LIMIT 100;
--      SHOULD SHOW: an Index Scan or Bitmap Index Scan on build_nodes_pkey, no Seq Scan on build_nodes.
--   2. The versions of one build's nodes (a saved part's tree):
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id, parent_id, updated_at FROM public.build_nodes WHERE build_id = '<a build id>' LIMIT 2000;
--      SHOULD SHOW: an Index Scan on the build_id index, no Seq Scan on build_nodes.

ALTER TABLE public.build_nodes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Rows that have no stamp yet take their creation time. The trigger does not exist yet, so this moves nothing else.
UPDATE public.build_nodes SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE public.build_nodes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.build_nodes ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.build_nodes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.type, NEW.title, NEW.note, NEW.payload) IS DISTINCT FROM (OLD.type, OLD.title, OLD.note, OLD.payload) THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.build_nodes_touch_updated_at() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_build_nodes_touch_updated_at ON public.build_nodes;
CREATE TRIGGER trg_build_nodes_touch_updated_at
  BEFORE UPDATE ON public.build_nodes
  FOR EACH ROW EXECUTE FUNCTION public.build_nodes_touch_updated_at();

COMMENT ON COLUMN public.build_nodes.updated_at IS
  'SV-19. When the node''s type, title, note or payload last changed. Moving it does not change it.';
