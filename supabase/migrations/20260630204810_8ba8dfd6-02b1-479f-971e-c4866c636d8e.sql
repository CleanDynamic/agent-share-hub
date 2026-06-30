
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS cover_image_path    text,
  ADD COLUMN IF NOT EXISTS cover_image_focal_x real DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS cover_image_focal_y real DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS results             jsonb DEFAULT '[]'::jsonb;
