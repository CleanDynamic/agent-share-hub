
-- Add columns to content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating numeric(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count integer NOT NULL DEFAULT 0;

-- content_ratings
CREATE TABLE public.content_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);
ALTER TABLE public.content_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view all ratings" ON public.content_ratings FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert own ratings" ON public.content_ratings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own ratings" ON public.content_ratings FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- content_comments
CREATE TABLE public.content_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  block_id uuid REFERENCES public.content_blocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) <= 500),
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view non-deleted comments" ON public.content_comments FOR SELECT TO public USING (is_deleted = false OR is_admin(auth.uid()));
CREATE POLICY "Users can insert own comments" ON public.content_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can soft-delete own comments" ON public.content_comments FOR UPDATE TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- comment_likes
CREATE TABLE public.comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.content_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view all likes" ON public.comment_likes FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert own likes" ON public.comment_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own likes" ON public.comment_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- content_views
CREATE TABLE public.content_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  viewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert views" ON public.content_views FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view all views" ON public.content_views FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- user_interactions
CREATE TABLE public.user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  interaction_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view all interactions" ON public.user_interactions FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert own interactions" ON public.user_interactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Function: update_content_rating_stats
CREATE OR REPLACE FUNCTION public.update_content_rating_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid uuid;
BEGIN
  _cid := COALESCE(NEW.content_id, OLD.content_id);
  UPDATE public.content_items
  SET avg_rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.content_ratings WHERE content_id = _cid), 0),
      rating_count = (SELECT COUNT(*) FROM public.content_ratings WHERE content_id = _cid)
  WHERE id = _cid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_rating_stats
AFTER INSERT OR UPDATE OR DELETE ON public.content_ratings
FOR EACH ROW EXECUTE FUNCTION public.update_content_rating_stats();

-- Function: update_comment_count
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid uuid;
BEGIN
  _cid := COALESCE(NEW.content_id, OLD.content_id);
  UPDATE public.content_items
  SET comment_count = (SELECT COUNT(*) FROM public.content_comments WHERE content_id = _cid AND is_deleted = false)
  WHERE id = _cid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_comment_count
AFTER INSERT OR UPDATE OR DELETE ON public.content_comments
FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();
