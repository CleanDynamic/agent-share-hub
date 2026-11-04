-- UX-04: an exact reply count on the topic.
--
-- Correct whether or not any of it already exists.

ALTER TABLE public.openbuild_posts
  ADD COLUMN IF NOT EXISTS reply_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_reply_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NOT NULL AND NEW.hidden_by IS NULL THEN
      UPDATE public.openbuild_posts SET reply_count = reply_count + 1 WHERE id = NEW.root_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.parent_id IS NOT NULL AND OLD.hidden_by IS NULL THEN
      UPDATE public.openbuild_posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = OLD.root_id;
    END IF;
  ELSIF NEW.parent_id IS NOT NULL THEN
    IF OLD.hidden_by IS NULL AND NEW.hidden_by IS NOT NULL THEN
      UPDATE public.openbuild_posts SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = NEW.root_id;
    ELSIF OLD.hidden_by IS NOT NULL AND NEW.hidden_by IS NULL THEN
      UPDATE public.openbuild_posts SET reply_count = reply_count + 1 WHERE id = NEW.root_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_reply_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_reply_count ON public.openbuild_posts;
CREATE TRIGGER trg_sync_reply_count
AFTER INSERT OR DELETE OR UPDATE OF hidden_by ON public.openbuild_posts
FOR EACH ROW EXECUTE FUNCTION public.sync_reply_count();

-- One-off backfill: set every topic's count from the rows that exist, writing only the topics that are wrong.
UPDATE public.openbuild_posts t
   SET reply_count = c.n
  FROM (
    SELECT root_id, count(*)::integer AS n
      FROM public.openbuild_posts
     WHERE parent_id IS NOT NULL AND hidden_by IS NULL
     GROUP BY root_id
  ) c
 WHERE t.id = c.root_id AND t.reply_count <> c.n;

COMMENT ON COLUMN public.openbuild_posts.reply_count IS
  'UX-04. Replies in the whole conversation (every depth), not hidden, on the topic''s root entry; zero elsewhere. Kept by trigger.';