-- 1. REBLOGS table
CREATE TABLE public.reblogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  reblogger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_post_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  parent_reblog_id UUID REFERENCES public.reblogs(id) ON DELETE SET NULL,
  root_original_post_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  text TEXT CHECK (text IS NULL OR char_length(text) <= 500),
  media_kind TEXT NOT NULL DEFAULT 'none' CHECK (media_kind IN ('none','image','video')),
  media_url TEXT,
  media_thumbnail_url TEXT,
  is_self_reblog BOOLEAN NOT NULL DEFAULT false,
  reblog_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  bookmark_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CHECK ((media_kind = 'none' AND media_url IS NULL) OR (media_kind <> 'none' AND media_url IS NOT NULL))
);

CREATE INDEX idx_reblogs_reblogger_created ON public.reblogs(reblogger_id, created_at DESC);
CREATE INDEX idx_reblogs_original_created ON public.reblogs(original_post_id, created_at DESC);
CREATE INDEX idx_reblogs_parent_created ON public.reblogs(parent_reblog_id, created_at DESC);
CREATE INDEX idx_reblogs_root_created ON public.reblogs(root_original_post_id, created_at DESC);
CREATE INDEX idx_reblogs_active ON public.reblogs(created_at DESC) WHERE deleted_at IS NULL;

-- 2. Add reblog_count to content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS reblog_count INT NOT NULL DEFAULT 0;

-- 3. REBLOG_LIKES
CREATE TABLE public.reblog_likes (
  reblog_id UUID NOT NULL REFERENCES public.reblogs(id) ON DELETE CASCADE,
  liker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reblog_id, liker_id)
);

-- 4. REBLOG_BOOKMARKS
CREATE TABLE public.reblog_bookmarks (
  reblog_id UUID NOT NULL REFERENCES public.reblogs(id) ON DELETE CASCADE,
  bookmarker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (reblog_id, bookmarker_id)
);

-- 5. Allow 'reblog' on primitive_comments.anchor_type (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='primitive_comments') THEN
    ALTER TABLE public.primitive_comments DROP CONSTRAINT IF EXISTS primitive_comments_anchor_type_check;
    ALTER TABLE public.primitive_comments
      ADD CONSTRAINT primitive_comments_anchor_type_check
      CHECK (anchor_type IN ('post','stage','block','slide','solution','reblog'));
  END IF;
END $$;

-- 6. BEFORE INSERT: self-reblog flag, root default, rate limits
CREATE OR REPLACE FUNCTION public.reblogs_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  original_author UUID;
  recent_self_count INT;
  recent_total_count INT;
BEGIN
  SELECT creator_id INTO original_author
  FROM public.content_items WHERE id = NEW.original_post_id;

  NEW.is_self_reblog := (NEW.reblogger_id = original_author);

  IF NEW.root_original_post_id IS NULL THEN
    NEW.root_original_post_id := NEW.original_post_id;
  END IF;

  SELECT count(*) INTO recent_self_count
  FROM public.reblogs
  WHERE reblogger_id = NEW.reblogger_id
    AND original_post_id = NEW.original_post_id
    AND created_at > now() - interval '1 day'
    AND deleted_at IS NULL;
  IF recent_self_count >= 1 THEN
    RAISE EXCEPTION 'You can only reblog the same post once per 24 hours'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO recent_total_count
  FROM public.reblogs
  WHERE reblogger_id = NEW.reblogger_id
    AND created_at > now() - interval '1 day';
  IF recent_total_count >= 50 THEN
    RAISE EXCEPTION 'Reblog rate limit exceeded (50 per 24 hours)'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER reblogs_before_insert_trg
  BEFORE INSERT ON public.reblogs
  FOR EACH ROW EXECUTE FUNCTION public.reblogs_before_insert();

-- 7. Counter triggers: content_items.reblog_count + parent reblog count
CREATE OR REPLACE FUNCTION public.reblogs_count_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.content_items SET reblog_count = reblog_count + 1 WHERE id = NEW.original_post_id;
    IF NEW.parent_reblog_id IS NOT NULL THEN
      UPDATE public.reblogs SET reblog_count = reblog_count + 1 WHERE id = NEW.parent_reblog_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE public.content_items SET reblog_count = GREATEST(reblog_count - 1, 0) WHERE id = NEW.original_post_id;
      IF NEW.parent_reblog_id IS NOT NULL THEN
        UPDATE public.reblogs SET reblog_count = GREATEST(reblog_count - 1, 0) WHERE id = NEW.parent_reblog_id;
      END IF;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE public.content_items SET reblog_count = reblog_count + 1 WHERE id = NEW.original_post_id;
      IF NEW.parent_reblog_id IS NOT NULL THEN
        UPDATE public.reblogs SET reblog_count = reblog_count + 1 WHERE id = NEW.parent_reblog_id;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER reblogs_count_sync_ins AFTER INSERT ON public.reblogs
  FOR EACH ROW EXECUTE FUNCTION public.reblogs_count_sync();
CREATE TRIGGER reblogs_count_sync_upd AFTER UPDATE OF deleted_at ON public.reblogs
  FOR EACH ROW EXECUTE FUNCTION public.reblogs_count_sync();

-- 8. like_count / bookmark_count triggers
CREATE OR REPLACE FUNCTION public.reblog_likes_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reblogs SET like_count = like_count + 1 WHERE id = NEW.reblog_id;
  ELSE
    UPDATE public.reblogs SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.reblog_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER reblog_likes_sync_ins AFTER INSERT ON public.reblog_likes
  FOR EACH ROW EXECUTE FUNCTION public.reblog_likes_sync();
CREATE TRIGGER reblog_likes_sync_del AFTER DELETE ON public.reblog_likes
  FOR EACH ROW EXECUTE FUNCTION public.reblog_likes_sync();

CREATE OR REPLACE FUNCTION public.reblog_bookmarks_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reblogs SET bookmark_count = bookmark_count + 1 WHERE id = NEW.reblog_id;
  ELSE
    UPDATE public.reblogs SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = OLD.reblog_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER reblog_bookmarks_sync_ins AFTER INSERT ON public.reblog_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.reblog_bookmarks_sync();
CREATE TRIGGER reblog_bookmarks_sync_del AFTER DELETE ON public.reblog_bookmarks
  FOR EACH ROW EXECUTE FUNCTION public.reblog_bookmarks_sync();

-- 9. updated_at trigger
CREATE TRIGGER reblogs_updated_at
  BEFORE UPDATE ON public.reblogs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. RLS
ALTER TABLE public.reblogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reblog_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reblog_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reblogs are public when not deleted" ON public.reblogs
  FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Reblogger can view own reblog including deleted" ON public.reblogs
  FOR SELECT TO authenticated USING (reblogger_id = auth.uid());
CREATE POLICY "Authenticated users can create reblogs" ON public.reblogs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reblogger_id);
CREATE POLICY "Reblogger can edit within 5 minutes" ON public.reblogs
  FOR UPDATE TO authenticated
  USING (auth.uid() = reblogger_id)
  WITH CHECK (auth.uid() = reblogger_id);

CREATE POLICY "Reblog likes readable by all" ON public.reblog_likes FOR SELECT USING (true);
CREATE POLICY "Users like reblogs" ON public.reblog_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = liker_id);
CREATE POLICY "Users unlike own" ON public.reblog_likes
  FOR DELETE TO authenticated USING (auth.uid() = liker_id);

CREATE POLICY "Reblog bookmarks owner-only read" ON public.reblog_bookmarks
  FOR SELECT TO authenticated USING (auth.uid() = bookmarker_id);
CREATE POLICY "Users bookmark reblogs" ON public.reblog_bookmarks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = bookmarker_id);
CREATE POLICY "Users remove own bookmark" ON public.reblog_bookmarks
  FOR DELETE TO authenticated USING (auth.uid() = bookmarker_id);

-- 11. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reblog-media', 'reblog-media', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Reblog media public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'reblog-media');
CREATE POLICY "Users upload own reblog media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reblog-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own reblog media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reblog-media' AND auth.uid()::text = (storage.foldername(name))[1]);