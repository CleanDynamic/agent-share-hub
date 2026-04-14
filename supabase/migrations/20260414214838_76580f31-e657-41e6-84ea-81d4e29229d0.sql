ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS article_body JSONB;