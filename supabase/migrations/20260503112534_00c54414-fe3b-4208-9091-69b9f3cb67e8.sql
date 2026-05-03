-- 1. PRIMITIVE_COMMENTS
CREATE TABLE public.primitive_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_type TEXT NOT NULL CHECK (anchor_type IN ('post','stage','block','slide','solution')),
  anchor_id UUID NOT NULL,
  parent_comment_id UUID REFERENCES public.primitive_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body JSONB NOT NULL DEFAULT '{}'::jsonb,
  body_text TEXT NOT NULL DEFAULT '',
  is_edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pc_anchor ON public.primitive_comments(anchor_type, anchor_id, created_at DESC);
CREATE INDEX idx_pc_parent ON public.primitive_comments(parent_comment_id);
CREATE INDEX idx_pc_author ON public.primitive_comments(author_id, created_at DESC);

ALTER TABLE public.primitive_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are readable by everyone"
  ON public.primitive_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment"
  ON public.primitive_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author can edit within 5 minutes"
  ON public.primitive_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id AND created_at > now() - interval '5 minutes')
  WITH CHECK (auth.uid() = author_id);

CREATE OR REPLACE FUNCTION public.can_delete_primitive_comment(_comment_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.primitive_comments c
    LEFT JOIN public.content_items ci
      ON c.anchor_type = 'post' AND ci.id = c.anchor_id
    WHERE c.id = _comment_id
      AND (c.author_id = _user_id OR ci.creator_id = _user_id)
  );
$$;

CREATE POLICY "Author or post owner can delete"
  ON public.primitive_comments FOR DELETE
  TO authenticated
  USING (public.can_delete_primitive_comment(id, auth.uid()));

CREATE TRIGGER pc_set_updated_at
  BEFORE UPDATE ON public.primitive_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- 2. PRIMITIVE_COMMENT_REACTIONS
CREATE TABLE public.primitive_comment_reactions (
  comment_id UUID NOT NULL REFERENCES public.primitive_comments(id) ON DELETE CASCADE,
  reactor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, reactor_id, reaction)
);
CREATE INDEX idx_pcr_comment ON public.primitive_comment_reactions(comment_id);

ALTER TABLE public.primitive_comment_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions readable by everyone"
  ON public.primitive_comment_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add own reactions"
  ON public.primitive_comment_reactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reactor_id);
CREATE POLICY "Users can remove own reactions"
  ON public.primitive_comment_reactions FOR DELETE
  TO authenticated USING (auth.uid() = reactor_id);

-- 3. READING_PROGRESS
CREATE TABLE public.reading_progress (
  reader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  last_progress_pct INT NOT NULL DEFAULT 0 CHECK (last_progress_pct BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  first_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reader_id, post_id)
);
CREATE INDEX idx_rp_post ON public.reading_progress(post_id);

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Readers see own progress"
  ON public.reading_progress FOR SELECT
  TO authenticated USING (auth.uid() = reader_id);
CREATE POLICY "Readers insert own progress"
  ON public.reading_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reader_id);
CREATE POLICY "Readers update own progress"
  ON public.reading_progress FOR UPDATE
  TO authenticated USING (auth.uid() = reader_id)
  WITH CHECK (auth.uid() = reader_id);

-- 4. POST_VIEW_LOG
CREATE TABLE public.post_view_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  referrer TEXT,
  user_agent TEXT,
  is_bot_or_crawler BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_pvl_post ON public.post_view_log(post_id, viewed_at DESC);
CREATE INDEX idx_pvl_viewer ON public.post_view_log(viewer_id, viewed_at DESC);

ALTER TABLE public.post_view_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a view"
  ON public.post_view_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Post author or admin can read views"
  ON public.post_view_log FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = post_view_log.post_id AND ci.creator_id = auth.uid()
    )
  );

-- 5. AI_EXPORT_LOG
CREATE TABLE public.ai_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  exporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  format TEXT NOT NULL CHECK (format IN ('markdown','pdf','plain','ai-pdf','json','copy-json')),
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ael_post ON public.ai_export_log(post_id, exported_at DESC);

ALTER TABLE public.ai_export_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log an export"
  ON public.ai_export_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Post author or admin can read exports"
  ON public.ai_export_log FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = ai_export_log.post_id AND ci.creator_id = auth.uid()
    )
  );

-- 6. content_items new columns
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS canonical_export_payload JSONB,
  ADD COLUMN IF NOT EXISTS ai_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS ai_pdf_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reading_completion_count INT NOT NULL DEFAULT 0;