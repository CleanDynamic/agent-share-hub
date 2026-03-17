
-- ============================================================
-- 1. NEW COLUMNS on content_items
-- ============================================================
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS verification_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS fork_of_content_id uuid REFERENCES public.content_items(id),
  ADD COLUMN IF NOT EXISTS fork_of_creator_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS fork_count integer NOT NULL DEFAULT 0;

-- ============================================================
-- 2. collections
-- ============================================================
CREATE TABLE public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 80),
  description text CHECK (description IS NULL OR char_length(description) <= 200),
  is_public boolean NOT NULL DEFAULT true,
  slug text UNIQUE,
  follower_count integer NOT NULL DEFAULT 0,
  item_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view public collections" ON public.collections FOR SELECT TO public USING (is_public = true OR owner_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "Owner can insert collections" ON public.collections FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update own collections" ON public.collections FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner can delete own collections" ON public.collections FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- ============================================================
-- 3. collection_items
-- ============================================================
CREATE TABLE public.collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  added_by uuid NOT NULL REFERENCES public.profiles(id),
  position integer NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 120),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, content_id)
);
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view items in public collections" ON public.collection_items FOR SELECT TO public USING (collection_id IN (SELECT id FROM public.collections WHERE is_public = true) OR is_admin(auth.uid()));
CREATE POLICY "Collection owner can insert items" ON public.collection_items FOR INSERT TO authenticated WITH CHECK (collection_id IN (SELECT id FROM public.collections WHERE owner_id = auth.uid()));
CREATE POLICY "Collection owner can delete items" ON public.collection_items FOR DELETE TO authenticated USING (collection_id IN (SELECT id FROM public.collections WHERE owner_id = auth.uid()));

-- ============================================================
-- 4. collection_follows
-- ============================================================
CREATE TABLE public.collection_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  followed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (follower_id, collection_id)
);
ALTER TABLE public.collection_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view collection follows" ON public.collection_follows FOR SELECT TO public USING (true);
CREATE POLICY "Users can follow collections" ON public.collection_follows FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Users can unfollow collections" ON public.collection_follows FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- ============================================================
-- 5. learning_paths
-- ============================================================
CREATE TABLE public.learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id),
  title text NOT NULL CHECK (char_length(title) <= 100),
  description text NOT NULL CHECK (char_length(description) <= 300),
  difficulty_range text,
  estimated_time_minutes integer,
  is_platform_curated boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  follower_count integer NOT NULL DEFAULT 0,
  completion_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved paths" ON public.learning_paths FOR SELECT TO public USING (status = 'approved' OR creator_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "Creator can insert paths" ON public.learning_paths FOR INSERT TO authenticated WITH CHECK (creator_id = auth.uid());
CREATE POLICY "Creator can update own paths" ON public.learning_paths FOR UPDATE TO authenticated USING (creator_id = auth.uid() OR is_admin(auth.uid()));

-- ============================================================
-- 6. learning_path_steps
-- ============================================================
CREATE TABLE public.learning_path_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  position integer NOT NULL,
  step_label text,
  step_note text CHECK (step_note IS NULL OR char_length(step_note) <= 200)
);
ALTER TABLE public.learning_path_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view steps" ON public.learning_path_steps FOR SELECT TO public USING (true);
CREATE POLICY "Path creator can insert steps" ON public.learning_path_steps FOR INSERT TO authenticated WITH CHECK (path_id IN (SELECT id FROM public.learning_paths WHERE creator_id = auth.uid()));
CREATE POLICY "Path creator can update steps" ON public.learning_path_steps FOR UPDATE TO authenticated USING (path_id IN (SELECT id FROM public.learning_paths WHERE creator_id = auth.uid()));
CREATE POLICY "Path creator can delete steps" ON public.learning_path_steps FOR DELETE TO authenticated USING (path_id IN (SELECT id FROM public.learning_paths WHERE creator_id = auth.uid()));

-- ============================================================
-- 7. learning_path_progress
-- ============================================================
CREATE TABLE public.learning_path_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path_id uuid NOT NULL REFERENCES public.learning_paths(id) ON DELETE CASCADE,
  completed_step_ids uuid[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (user_id, path_id)
);
ALTER TABLE public.learning_path_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON public.learning_path_progress FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own progress" ON public.learning_path_progress FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own progress" ON public.learning_path_progress FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 8. content_verifications
-- ============================================================
CREATE TABLE public.content_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ai_tool_used text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_id, user_id)
);
ALTER TABLE public.content_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view verifications" ON public.content_verifications FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert own verifications" ON public.content_verifications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own verifications" ON public.content_verifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 9. content_tips
-- ============================================================
CREATE TABLE public.content_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) <= 300),
  upvote_count integer NOT NULL DEFAULT 0,
  ai_tool_context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
ALTER TABLE public.content_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view non-deleted tips" ON public.content_tips FOR SELECT TO public USING (is_deleted = false OR is_admin(auth.uid()));
CREATE POLICY "Users can insert tips" ON public.content_tips FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owner or admin can update tips" ON public.content_tips FOR UPDATE TO authenticated USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- ============================================================
-- 10. tip_upvotes
-- ============================================================
CREATE TABLE public.tip_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id uuid NOT NULL REFERENCES public.content_tips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tip_id, user_id)
);
ALTER TABLE public.tip_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view upvotes" ON public.tip_upvotes FOR SELECT TO public USING (true);
CREATE POLICY "Users can insert own upvotes" ON public.tip_upvotes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own upvotes" ON public.tip_upvotes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 11. content_versions
-- ============================================================
CREATE TABLE public.content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  version_number text NOT NULL,
  changelog text NOT NULL CHECK (char_length(changelog) <= 500),
  blocks_snapshot jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view versions" ON public.content_versions FOR SELECT TO public USING (true);
CREATE POLICY "Creator can insert versions" ON public.content_versions FOR INSERT TO authenticated WITH CHECK (content_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

-- ============================================================
-- 12. notifications
-- ============================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id),
  notification_type text NOT NULL,
  content_id uuid REFERENCES public.content_items(id),
  project_id uuid REFERENCES public.projects(id),
  collection_id uuid REFERENCES public.collections(id),
  metadata jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- 13. messages
-- ============================================================
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL CHECK (char_length(text) <= 1000),
  is_read boolean NOT NULL DEFAULT false,
  sent_at timestamptz NOT NULL DEFAULT now(),
  reply_to_enquiry_id uuid REFERENCES public.service_enquiries(id)
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own threads" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Recipient can mark as read" ON public.messages FOR UPDATE TO authenticated USING (recipient_id = auth.uid());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============================================================
-- 14. TRIGGERS
-- ============================================================

-- Verification count trigger
CREATE OR REPLACE FUNCTION public.update_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid uuid;
  _count integer;
BEGIN
  _cid := COALESCE(NEW.content_id, OLD.content_id);
  SELECT COUNT(*) INTO _count FROM public.content_verifications WHERE content_id = _cid;
  UPDATE public.content_items
  SET verification_count = _count,
      is_verified = (_count >= 5)
  WHERE id = _cid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_verification_status
AFTER INSERT OR DELETE ON public.content_verifications
FOR EACH ROW EXECUTE FUNCTION public.update_verification_status();

-- Tip upvote count trigger
CREATE OR REPLACE FUNCTION public.update_tip_upvotes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tid uuid;
BEGIN
  _tid := COALESCE(NEW.tip_id, OLD.tip_id);
  UPDATE public.content_tips
  SET upvote_count = (SELECT COUNT(*) FROM public.tip_upvotes WHERE tip_id = _tid)
  WHERE id = _tid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_update_tip_upvotes
AFTER INSERT OR DELETE ON public.tip_upvotes
FOR EACH ROW EXECUTE FUNCTION public.update_tip_upvotes();

-- Fork count trigger
CREATE OR REPLACE FUNCTION public.increment_fork_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fork_of_content_id IS NOT NULL THEN
    UPDATE public.content_items
    SET fork_count = fork_count + 1
    WHERE id = NEW.fork_of_content_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_fork_count
AFTER INSERT ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.increment_fork_count();
