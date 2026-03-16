
-- ============================================================
-- TABLE: content_blocks
-- ============================================================
CREATE TABLE public.content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  position integer NOT NULL,
  block_type text NOT NULL,
  text_content text,
  formatting jsonb,
  file_url text,
  file_name text,
  file_size_bytes integer,
  image_url text,
  image_description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_blocks ENABLE ROW LEVEL SECURITY;

-- Public can view blocks of approved content
CREATE POLICY "Public can view blocks of approved content"
  ON public.content_blocks FOR SELECT TO public
  USING (content_id IN (SELECT id FROM public.content_items WHERE status = 'approved'));

-- Creators can insert blocks on own content
CREATE POLICY "Creators can insert own content blocks"
  ON public.content_blocks FOR INSERT TO authenticated
  WITH CHECK (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

-- Creators can update blocks on own content
CREATE POLICY "Creators can update own content blocks"
  ON public.content_blocks FOR UPDATE TO authenticated
  USING (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

-- Creators can delete blocks on own content
CREATE POLICY "Creators can delete own content blocks"
  ON public.content_blocks FOR DELETE TO authenticated
  USING (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

-- ============================================================
-- TABLE: block_variations
-- ============================================================
CREATE TABLE public.block_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.content_blocks(id) ON DELETE CASCADE,
  variation_label text NOT NULL,
  variation_type text NOT NULL,
  text_content text,
  formatting jsonb,
  file_url text,
  file_name text,
  image_url text,
  image_description text,
  position integer NOT NULL
);

ALTER TABLE public.block_variations ENABLE ROW LEVEL SECURITY;

-- Public can view variations of approved content blocks
CREATE POLICY "Public can view variations of approved content"
  ON public.block_variations FOR SELECT TO public
  USING (block_id IN (
    SELECT cb.id FROM public.content_blocks cb
    JOIN public.content_items ci ON ci.id = cb.content_id
    WHERE ci.status = 'approved'
  ));

-- Creators can insert variations on own content blocks
CREATE POLICY "Creators can insert own block variations"
  ON public.block_variations FOR INSERT TO authenticated
  WITH CHECK (block_id IN (
    SELECT cb.id FROM public.content_blocks cb
    JOIN public.content_items ci ON ci.id = cb.content_id
    WHERE ci.creator_id = auth.uid()
  ));

-- Creators can update variations on own content blocks
CREATE POLICY "Creators can update own block variations"
  ON public.block_variations FOR UPDATE TO authenticated
  USING (block_id IN (
    SELECT cb.id FROM public.content_blocks cb
    JOIN public.content_items ci ON ci.id = cb.content_id
    WHERE ci.creator_id = auth.uid()
  ));

-- Creators can delete variations on own content blocks
CREATE POLICY "Creators can delete own block variations"
  ON public.block_variations FOR DELETE TO authenticated
  USING (block_id IN (
    SELECT cb.id FROM public.content_blocks cb
    JOIN public.content_items ci ON ci.id = cb.content_id
    WHERE ci.creator_id = auth.uid()
  ));

-- ============================================================
-- TABLE: projects
-- ============================================================
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL,
  description text NOT NULL,
  cover_image_url text,
  status text NOT NULL DEFAULT 'pending',
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Public can view approved projects, creators see own, admins see all
CREATE POLICY "Public can view approved projects"
  ON public.projects FOR SELECT TO public
  USING (status = 'approved' OR creator_id = auth.uid() OR is_admin(auth.uid()));

-- Creators can insert own projects
CREATE POLICY "Creators can insert own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- Creators can update own projects
CREATE POLICY "Creators can update own projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (creator_id = auth.uid());

-- Admins can update any project (for status changes)
CREATE POLICY "Admins can update any project"
  ON public.projects FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- ============================================================
-- TABLE: project_components
-- ============================================================
CREATE TABLE public.project_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position integer NOT NULL,
  component_type text NOT NULL,
  linked_content_id uuid REFERENCES public.content_items(id),
  inline_content_id uuid REFERENCES public.content_items(id),
  show_on_browse boolean NOT NULL DEFAULT false,
  component_label text,
  component_note text
);

ALTER TABLE public.project_components ENABLE ROW LEVEL SECURITY;

-- Public can view components of approved projects
CREATE POLICY "Public can view components of approved projects"
  ON public.project_components FOR SELECT TO public
  USING (project_id IN (SELECT id FROM public.projects WHERE status = 'approved'));

-- Creators can insert components on own projects
CREATE POLICY "Creators can insert own project components"
  ON public.project_components FOR INSERT TO authenticated
  WITH CHECK (project_id IN (SELECT id FROM public.projects WHERE creator_id = auth.uid()));

-- Creators can update components on own projects
CREATE POLICY "Creators can update own project components"
  ON public.project_components FOR UPDATE TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE creator_id = auth.uid()));

-- Creators can delete components on own projects
CREATE POLICY "Creators can delete own project components"
  ON public.project_components FOR DELETE TO authenticated
  USING (project_id IN (SELECT id FROM public.projects WHERE creator_id = auth.uid()));

-- ============================================================
-- ALTER: user_saves — add project_id column
-- ============================================================
ALTER TABLE public.user_saves
  ADD COLUMN project_id uuid REFERENCES public.projects(id);
