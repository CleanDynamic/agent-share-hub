ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;

CREATE UNIQUE INDEX IF NOT EXISTS content_items_slug_unique
  ON public.content_items (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_items_visibility_idx
  ON public.content_items (visibility);