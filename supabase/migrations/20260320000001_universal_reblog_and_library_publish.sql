-- ============================================================
-- PART 1: Universal Reblog — extend content_items
-- ============================================================

-- Add reblog support columns to content_items
ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS is_reblog boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reblog_comment text,
  ADD COLUMN IF NOT EXISTS reblog_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reblog_of_content_id uuid REFERENCES content_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reblog_of_collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reblog_of_project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quoted_reblog_id uuid REFERENCES content_items(id) ON DELETE SET NULL;

-- Index for fast reblog count lookups
CREATE INDEX IF NOT EXISTS idx_content_items_reblog_of_content
  ON content_items(reblog_of_content_id) WHERE reblog_of_content_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_reblog_of_collection
  ON content_items(reblog_of_collection_id) WHERE reblog_of_collection_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_items_reblog_of_project
  ON content_items(reblog_of_project_id) WHERE reblog_of_project_id IS NOT NULL;

-- ============================================================
-- PART 2: Library Folders → Publish as Collection
-- ============================================================

-- Link a library folder to a published collection
ALTER TABLE library_folders
  ADD COLUMN IF NOT EXISTS published_collection_id uuid REFERENCES collections(id) ON DELETE SET NULL;
