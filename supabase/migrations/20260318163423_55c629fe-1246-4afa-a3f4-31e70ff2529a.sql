
-- CHANGE 1: Add visibility column
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'private';

-- Migrate existing data
UPDATE public.collections SET visibility = CASE WHEN is_public = true THEN 'public' ELSE 'private' END WHERE visibility = 'private' OR visibility IS NULL;

-- CHANGE 5: Add project_id column for companion collections
ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);
