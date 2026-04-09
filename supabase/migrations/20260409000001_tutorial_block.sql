ALTER TABLE content_blocks
  ADD COLUMN IF NOT EXISTS tutorial_media TEXT,
  ADD COLUMN IF NOT EXISTS tutorial_media_url TEXT,
  ADD COLUMN IF NOT EXISTS tutorial_carousel_urls JSONB,
  ADD COLUMN IF NOT EXISTS tutorial_text TEXT,
  ADD COLUMN IF NOT EXISTS tutorial_ref_block_id TEXT;
