
-- 1. Create library_folders table
CREATE TABLE public.library_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 50),
  emoji text CHECK (emoji IS NULL OR char_length(emoji) <= 4),
  position integer NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS on library_folders
ALTER TABLE public.library_folders ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies for library_folders
CREATE POLICY "Users can select own folders" ON public.library_folders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own folders" ON public.library_folders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own folders" ON public.library_folders
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own folders" ON public.library_folders
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 4. Add folder_id column to user_library
ALTER TABLE public.user_library
  ADD COLUMN folder_id uuid REFERENCES public.library_folders(id) ON DELETE SET NULL;

-- 5. Add project_id column to user_library (for saving projects too)
ALTER TABLE public.user_library
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- 6. Migrate user_saves data into user_library
INSERT INTO public.user_library (user_id, content_id, added_at)
SELECT user_id, content_id, saved_at
FROM public.user_saves
WHERE content_id IS NOT NULL
ON CONFLICT DO NOTHING;
