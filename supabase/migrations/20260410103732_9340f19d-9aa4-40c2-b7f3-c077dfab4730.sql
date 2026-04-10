ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS evidence_media_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_media_type text DEFAULT 'written',
  ADD COLUMN IF NOT EXISTS evidence_caption text DEFAULT '';