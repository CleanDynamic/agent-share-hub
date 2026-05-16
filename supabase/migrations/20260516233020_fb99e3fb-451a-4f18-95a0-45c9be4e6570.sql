ALTER TABLE public.primitive_comments
  ADD COLUMN IF NOT EXISTS reply_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_pc_parent_created
  ON public.primitive_comments (parent_comment_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_pc_anchor_toplevel
  ON public.primitive_comments (anchor_type, anchor_id, created_at DESC)
  WHERE parent_comment_id IS NULL;

CREATE OR REPLACE FUNCTION public.primitive_comments_reply_count_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_comment_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE public.primitive_comments
         SET reply_count = reply_count + 1
       WHERE id = NEW.parent_comment_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.parent_comment_id IS NOT NULL THEN
      IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        UPDATE public.primitive_comments
           SET reply_count = GREATEST(reply_count - 1, 0)
         WHERE id = NEW.parent_comment_id;
      ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        UPDATE public.primitive_comments
           SET reply_count = reply_count + 1
         WHERE id = NEW.parent_comment_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_comment_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
      UPDATE public.primitive_comments
         SET reply_count = GREATEST(reply_count - 1, 0)
       WHERE id = OLD.parent_comment_id;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_pc_reply_count_sync ON public.primitive_comments;
CREATE TRIGGER trg_pc_reply_count_sync
AFTER INSERT OR UPDATE OF deleted_at OR DELETE ON public.primitive_comments
FOR EACH ROW EXECUTE FUNCTION public.primitive_comments_reply_count_sync();

UPDATE public.primitive_comments p
   SET reply_count = sub.cnt
  FROM (
    SELECT parent_comment_id, COUNT(*) AS cnt
      FROM public.primitive_comments
     WHERE parent_comment_id IS NOT NULL
       AND deleted_at IS NULL
     GROUP BY parent_comment_id
  ) sub
 WHERE p.id = sub.parent_comment_id;