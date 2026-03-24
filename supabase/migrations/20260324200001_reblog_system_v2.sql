-- REBLOG SYSTEM V2
-- New columns on content_items for the rebuilt reblog feature.
-- Old columns (reblog_of_content_id, reblog_of_collection_id, reblog_of_project_id,
-- quoted_reblog_id, reblog_comment) are left in place for data safety but are
-- no longer written to by the new system.

-- is_reblog: true when this post is a reblog of another post
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS is_reblog boolean NOT NULL DEFAULT false;

-- reblog_of_id: the original post this reblog quotes (content_items only)
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS reblog_of_id uuid REFERENCES content_items(id) ON DELETE SET NULL;

-- reblog_thread_count: number of blocks beyond the first in this reblog
-- Updated by trigger when blocks are inserted/deleted
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS reblog_thread_count integer NOT NULL DEFAULT 0;

-- reblog_count: how many times this post has been reblogged
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS reblog_count integer NOT NULL DEFAULT 0;

-- post_category: top-level category for reblog composer (blog/blueprint/bounty)
-- Already added in 20260324000001_restructure_post_categories.sql — skip if exists
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS post_category text DEFAULT 'blueprint';

-- Index for looking up reblogs of a post
CREATE INDEX IF NOT EXISTS idx_content_items_reblog_of_id
  ON content_items(reblog_of_id)
  WHERE reblog_of_id IS NOT NULL;

-- ── Trigger: maintain reblog_count on original post ───────────

CREATE OR REPLACE FUNCTION update_reblog_count_on_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_reblog = true AND NEW.reblog_of_id IS NOT NULL THEN
    UPDATE content_items
    SET reblog_count = reblog_count + 1
    WHERE id = NEW.reblog_of_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_reblog_count_on_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_reblog = true AND OLD.reblog_of_id IS NOT NULL THEN
    UPDATE content_items
    SET reblog_count = GREATEST(reblog_count - 1, 0)
    WHERE id = OLD.reblog_of_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reblog_count_insert ON content_items;
CREATE TRIGGER trg_reblog_count_insert
  AFTER INSERT ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_reblog_count_on_insert();

DROP TRIGGER IF EXISTS trg_reblog_count_delete ON content_items;
CREATE TRIGGER trg_reblog_count_delete
  AFTER DELETE ON content_items
  FOR EACH ROW EXECUTE FUNCTION update_reblog_count_on_delete();
