
-- Add columns to content_blocks
ALTER TABLE public.content_blocks
  ADD COLUMN IF NOT EXISTS use_instructions text,
  ADD COLUMN IF NOT EXISTS sub_blocks jsonb,
  ADD COLUMN IF NOT EXISTS formatting_type text NOT NULL DEFAULT 'paragraph';

-- Add columns to content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS what_to_expect_blocks jsonb,
  ADD COLUMN IF NOT EXISTS other_tool_name text;

-- Add column to revenue_splits
ALTER TABLE public.revenue_splits
  ADD COLUMN IF NOT EXISTS is_contested boolean NOT NULL DEFAULT false;

-- Create collab_split_contests table
CREATE TABLE public.collab_split_contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  contestant_id uuid NOT NULL REFERENCES public.profiles(id),
  original_percentage numeric(5,2) NOT NULL,
  proposed_percentage numeric(5,2) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collab_split_contests ENABLE ROW LEVEL SECURITY;

-- RLS: Contestant can insert own rows
CREATE POLICY "Contestant can insert own contests"
  ON public.collab_split_contests FOR INSERT
  TO authenticated
  WITH CHECK (contestant_id = auth.uid());

-- RLS: Contestant can select own rows
CREATE POLICY "Contestant can select own contests"
  ON public.collab_split_contests FOR SELECT
  TO authenticated
  USING (contestant_id = auth.uid());

-- RLS: Uploader (set_by on revenue_splits) can select contests on their content
CREATE POLICY "Uploader can select contests"
  ON public.collab_split_contests FOR SELECT
  TO authenticated
  USING (content_id IN (
    SELECT content_id FROM public.revenue_splits WHERE set_by = auth.uid()
  ));

-- RLS: Uploader can update status
CREATE POLICY "Uploader can update contest status"
  ON public.collab_split_contests FOR UPDATE
  TO authenticated
  USING (content_id IN (
    SELECT content_id FROM public.revenue_splits WHERE set_by = auth.uid()
  ));

-- RLS: Admin full access
CREATE POLICY "Admin full access to contests"
  ON public.collab_split_contests FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
