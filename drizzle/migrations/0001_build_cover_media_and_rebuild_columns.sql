-- 20260827120000_build_cover_media.sql
ALTER TABLE public.builds
  ADD COLUMN cover_media_id UUID NULL
    REFERENCES public.build_media(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.builds.cover_media_id IS
  'The image the creator chose for this build''s card (NS-P27). NULL means "no explicit choice" — resolveCover in src/lib/build/cover.ts then falls back to the hero node''s media, then to the first evidence media. Never assume a build without one has no card image.';

-- 20260827140000_rebuild_columns.sql
ALTER TABLE public.builds
  ADD COLUMN rebuild_note            TEXT NULL,
  ADD COLUMN rebuild_count           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN source_title_at_fork    TEXT NULL,
  ADD COLUMN source_handle_at_fork   TEXT NULL,
  ADD COLUMN solves_node_id          UUID NULL
    REFERENCES public.build_nodes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.builds.rebuild_note IS
  'The rebuilder''s account of what they changed and why. Set on the child, never on the source.';
COMMENT ON COLUMN public.builds.rebuild_count IS
  'Denormalised count of PUBLISHED children of this build. Maintained by trg_builds_rebuild_count_status and trg_builds_rebuild_count_delete — never write it from the client.';
COMMENT ON COLUMN public.builds.source_title_at_fork IS
  'The parent''s title as it read at fork time. Frozen on purpose: credit must survive the source being renamed or deleted.';
COMMENT ON COLUMN public.builds.source_handle_at_fork IS
  'The parent creator''s profiles.username as it read at fork time. Frozen for the same reason as source_title_at_fork.';
COMMENT ON COLUMN public.builds.solves_node_id IS
  'The gap node this build was published to fill, if any. Read by Phase B.';

UPDATE public.builds p
SET rebuild_count = c.published_children
FROM (
  SELECT
    b.parent_build_id,
    count(*)::INTEGER AS published_children
  FROM public.builds b
  WHERE b.parent_build_id IS NOT NULL
    AND b.status IN ('published', 'gallery')
  GROUP BY b.parent_build_id
) c
WHERE p.id = c.parent_build_id
  AND p.rebuild_count IS DISTINCT FROM c.published_children;

CREATE OR REPLACE FUNCTION public.sync_build_rebuild_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _was_published BOOLEAN;
  _is_published  BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.parent_build_id IS NOT NULL
       AND OLD.status IN ('published', 'gallery') THEN
      UPDATE public.builds
      SET rebuild_count = GREATEST(rebuild_count - 1, 0)
      WHERE id = OLD.parent_build_id;
    END IF;
    RETURN NULL;
  END IF;

  _was_published := OLD.status IN ('published', 'gallery');
  _is_published  := NEW.status IN ('published', 'gallery');

  IF _is_published AND NOT _was_published AND NEW.parent_build_id IS NOT NULL THEN
    UPDATE public.builds
    SET rebuild_count = rebuild_count + 1
    WHERE id = NEW.parent_build_id;
  ELSIF _was_published AND NOT _is_published AND OLD.parent_build_id IS NOT NULL THEN
    UPDATE public.builds
    SET rebuild_count = GREATEST(rebuild_count - 1, 0)
    WHERE id = OLD.parent_build_id;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_build_rebuild_count()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_builds_rebuild_count_status
AFTER UPDATE OF status ON public.builds
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  AND (OLD.parent_build_id IS NOT NULL OR NEW.parent_build_id IS NOT NULL)
)
EXECUTE FUNCTION public.sync_build_rebuild_count();

CREATE TRIGGER trg_builds_rebuild_count_delete
AFTER DELETE ON public.builds
FOR EACH ROW
WHEN (
  OLD.parent_build_id IS NOT NULL
  AND OLD.status IN ('published', 'gallery')
)
EXECUTE FUNCTION public.sync_build_rebuild_count();

CREATE INDEX idx_builds_parent_build
  ON public.builds (parent_build_id)
  WHERE parent_build_id IS NOT NULL;

CREATE INDEX idx_builds_solves_node
  ON public.builds (solves_node_id)
  WHERE solves_node_id IS NOT NULL;