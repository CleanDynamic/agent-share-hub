
ALTER TABLE public.content_blocks ADD COLUMN IF NOT EXISTS external_file_url text;
ALTER TABLE public.content_blocks ADD COLUMN IF NOT EXISTS github_url text;
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS estimated_read_minutes integer;
