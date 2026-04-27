-- Helper for updated_at if not present
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  thread_id UUID NOT NULL,
  parent_comment_id UUID REFERENCES public.document_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  anchor_type TEXT NOT NULL,
  anchor_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_comments_doc ON public.document_comments(document_id);
CREATE INDEX idx_document_comments_thread ON public.document_comments(thread_id);

ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments on accessible documents"
ON public.document_comments
FOR SELECT
TO authenticated, anon
USING (
  document_id IN (
    SELECT id FROM public.content_items
    WHERE status = 'approved' OR creator_id = auth.uid()
  )
);

CREATE POLICY "Authors can insert own comments"
ON public.document_comments
FOR INSERT
TO authenticated
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can update own comments"
ON public.document_comments
FOR UPDATE
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Document creator can resolve any comment"
ON public.document_comments
FOR UPDATE
TO authenticated
USING (
  document_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid())
);

CREATE POLICY "Authors can delete own comments"
ON public.document_comments
FOR DELETE
TO authenticated
USING (author_id = auth.uid());

CREATE TRIGGER trg_document_comments_updated_at
BEFORE UPDATE ON public.document_comments
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.document_comments REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_comments;