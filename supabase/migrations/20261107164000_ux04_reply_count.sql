-- UX-04: an exact reply count on the topic.
--
-- openbuild_posts.reply_count, on the topic's root entry, is the number of replies in the whole conversation: every row with that
-- root_id and a parent, at any depth, not hidden. It is what "N replies" on a card shows and what a space's most_replied order sorts
-- by. It is zero for an entry that is a reply and for a topic nobody answered; the page does not show a zero (UX-03 P8).
--
-- KEPT EXACT BY TRIGGER, on every way the number can change:
--   a reply is written        +1 (unless it arrives hidden, which the policy forbids, but a service writer could)
--   a reply is deleted        -1 (unless it was hidden: a hidden reply was not counted)
--   a reply is hidden         -1
--   a reply is unhidden       +1
-- A reply removed by the cascade from its topic finds no topic to update, which is right. The count never goes below zero.
--
-- The trigger function is SECURITY DEFINER (the replier cannot update someone else's topic), sets search_path, and nobody calls it.
-- Its write to the root touches only reply_count, so posts_guard_update (20261107130000) has nothing to refuse.
--
-- ONE-OFF BACKFILL: every topic's count is set from the rows that exist now. It writes a topic only when its count is wrong, so a
-- second run writes nothing. On an empty table it is nothing.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The backfill's read (what it counts), the one scan of replies:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT root_id, count(*) FROM public.openbuild_posts
--       WHERE parent_id IS NOT NULL AND hidden_by IS NULL GROUP BY root_id;
--      SHOULD SHOW: one scan of openbuild_posts (a Seq Scan is right for a one-off over every reply; an Index Only Scan on
--      idx_posts_replies_created also). Send the plan back if Execution Time passes a few seconds.
--   2. The trigger's write to a topic, by primary key:
--      EXPLAIN (ANALYZE, BUFFERS) UPDATE public.openbuild_posts SET reply_count = reply_count + 0 WHERE id = '<a topic id>';
--      SHOULD SHOW: an Index Scan on openbuild_posts_pkey, one row. (Run it inside BEGIN; ... ROLLBACK;)
--   3. A topic's replies, to check the count against:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM public.openbuild_posts WHERE root_id = '<a topic id>' AND parent_id IS NOT NULL AND hidden_by IS NULL;
--      SHOULD SHOW: an Index Scan or Index Only Scan on idx_posts_root_created (20261107170000), no Seq Scan.

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
