
-- Add topics column to content_items
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}'::text[];

-- Create tool_compatibility table
CREATE TABLE public.tool_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  tool_version text,
  status text NOT NULL DEFAULT 'works' CHECK (status IN ('works', 'partial', 'broken')),
  verified_at timestamp with time zone NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES public.profiles(id),
  notes text
);

ALTER TABLE public.tool_compatibility ENABLE ROW LEVEL SECURITY;

-- Public can view all compatibility entries
CREATE POLICY "Public can view compatibility" ON public.tool_compatibility
  FOR SELECT TO public USING (true);

-- Authenticated users can insert compatibility entries
CREATE POLICY "Authenticated can insert compatibility" ON public.tool_compatibility
  FOR INSERT TO authenticated
  WITH CHECK (verified_by = auth.uid());

-- Users can update their own compatibility entries
CREATE POLICY "Users can update own compatibility" ON public.tool_compatibility
  FOR UPDATE TO authenticated
  USING (verified_by = auth.uid());

-- Users can delete their own compatibility entries
CREATE POLICY "Users can delete own compatibility" ON public.tool_compatibility
  FOR DELETE TO authenticated
  USING (verified_by = auth.uid());
