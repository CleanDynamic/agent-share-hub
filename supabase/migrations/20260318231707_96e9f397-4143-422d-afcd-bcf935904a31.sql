
-- Add new columns to content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS draft_saved_at timestamptz,
  ADD COLUMN IF NOT EXISTS draft_name text;

-- Add constraint for draft_name max length
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_draft_name_max_length CHECK (char_length(draft_name) <= 100);

-- RLS policies for drafts
CREATE POLICY "Creators can view their own drafts"
  ON public.content_items FOR SELECT TO authenticated
  USING (creator_id = auth.uid() AND status = 'draft');

CREATE POLICY "Creators can update their own drafts"
  ON public.content_items FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() AND status = 'draft')
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can delete their own drafts"
  ON public.content_items FOR DELETE TO authenticated
  USING (creator_id = auth.uid() AND status = 'draft');

-- Create draft_autosave_log table
CREATE TABLE public.draft_autosave_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  saved_at timestamptz NOT NULL DEFAULT now(),
  field_changed text
);

ALTER TABLE public.draft_autosave_log ENABLE ROW LEVEL SECURITY;

-- Creator can view their own autosave logs
CREATE POLICY "Creators can view own autosave logs"
  ON public.draft_autosave_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.content_items
      WHERE content_items.id = draft_autosave_log.content_id
        AND content_items.creator_id = auth.uid()
    )
  );

-- System/authenticated can insert autosave logs for own content
CREATE POLICY "Creators can insert own autosave logs"
  ON public.draft_autosave_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.content_items
      WHERE content_items.id = draft_autosave_log.content_id
        AND content_items.creator_id = auth.uid()
    )
  );
