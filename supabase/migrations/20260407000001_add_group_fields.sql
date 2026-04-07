-- Add group_id and group_title to content_blocks for Group block support.
-- Groups bind related blocks together under a shared TOC entry.
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS group_id TEXT;
ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS group_title TEXT;
