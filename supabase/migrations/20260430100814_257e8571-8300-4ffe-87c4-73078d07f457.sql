-- 1. Extend dm_threads
ALTER TABLE public.dm_threads
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'direct'
    CHECK (type IN ('direct', 'group', 'bounty', 'blueprint')),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS pinned_content_type TEXT
    CHECK (pinned_content_type IS NULL OR pinned_content_type IN ('bounty', 'blueprint')),
  ADD COLUMN IF NOT EXISTS pinned_content_id UUID
    REFERENCES public.content_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.dm_threads DROP CONSTRAINT IF EXISTS dm_threads_check;
ALTER TABLE public.dm_threads
  ALTER COLUMN participant_a DROP NOT NULL,
  ALTER COLUMN participant_b DROP NOT NULL;

ALTER TABLE public.dm_threads
  DROP CONSTRAINT IF EXISTS dm_threads_participant_a_participant_b_key;

CREATE UNIQUE INDEX IF NOT EXISTS dm_threads_direct_pair_unique
  ON public.dm_threads (participant_a, participant_b)
  WHERE type = 'direct';

CREATE INDEX IF NOT EXISTS dm_threads_type_idx ON public.dm_threads (type);
CREATE INDEX IF NOT EXISTS dm_threads_pinned_content_idx
  ON public.dm_threads (pinned_content_type, pinned_content_id)
  WHERE pinned_content_id IS NOT NULL;

-- 2. dm_thread_members
CREATE TABLE IF NOT EXISTS public.dm_thread_members (
  thread_id UUID NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS dm_thread_members_user_idx
  ON public.dm_thread_members (user_id);

ALTER TABLE public.dm_thread_members ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_thread_member(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_threads
     WHERE id = _thread_id
       AND (participant_a = _user_id OR participant_b = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.dm_thread_members
     WHERE thread_id = _thread_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_thread_admin(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dm_threads
     WHERE id = _thread_id AND created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.dm_thread_members
     WHERE thread_id = _thread_id AND user_id = _user_id AND is_admin = true
  );
$$;

CREATE POLICY "Members can view thread members"
  ON public.dm_thread_members FOR SELECT TO authenticated
  USING (public.is_thread_member(thread_id, auth.uid()));

CREATE POLICY "Thread admins can add members"
  ON public.dm_thread_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_thread_admin(thread_id, auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Members can update own membership flags"
  ON public.dm_thread_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Self or admin can leave or remove"
  ON public.dm_thread_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_thread_admin(thread_id, auth.uid()));

-- 3. Extend dm_messages
ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text'
    CHECK (kind IN ('text', 'content-share', 'system')),
  ADD COLUMN IF NOT EXISTS shared_content_type TEXT
    CHECK (shared_content_type IS NULL OR shared_content_type IN ('blueprint', 'stage', 'block')),
  ADD COLUMN IF NOT EXISTS shared_content_meta JSONB,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

UPDATE public.dm_messages
   SET body = text_content
 WHERE body IS NULL AND text_content IS NOT NULL;

CREATE INDEX IF NOT EXISTS dm_messages_kind_idx ON public.dm_messages (kind);
CREATE INDEX IF NOT EXISTS dm_messages_shared_content_idx
  ON public.dm_messages (shared_content_type, shared_content_id)
  WHERE shared_content_id IS NOT NULL;

-- 4. content_share_views
CREATE TABLE IF NOT EXISTS public.content_share_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS content_share_views_viewer_idx
  ON public.content_share_views (viewer_id);

ALTER TABLE public.content_share_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Viewer can log own view"
  ON public.content_share_views FOR INSERT TO authenticated
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Thread members can read share views"
  ON public.content_share_views FOR SELECT TO authenticated
  USING (
    message_id IN (
      SELECT id FROM public.dm_messages
       WHERE public.is_thread_member(thread_id, auth.uid())
    )
  );

-- 5. Refreshed RLS on dm_messages and dm_threads
DROP POLICY IF EXISTS "Senders can update their own messages" ON public.dm_messages;
DROP POLICY IF EXISTS "Users can see messages in their threads" ON public.dm_messages;
DROP POLICY IF EXISTS "Users can insert messages in their threads" ON public.dm_messages;

CREATE POLICY "Sender can edit own message within 5 minutes"
  ON public.dm_messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    AND sent_at > now() - interval '5 minutes'
  );

CREATE POLICY "Sender or thread admin can delete"
  ON public.dm_messages FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_thread_admin(thread_id, auth.uid())
  );

CREATE POLICY "Members can read thread messages"
  ON public.dm_messages FOR SELECT TO authenticated
  USING (public.is_thread_member(thread_id, auth.uid()));

CREATE POLICY "Members can insert messages"
  ON public.dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_thread_member(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can see their own threads" ON public.dm_threads;
DROP POLICY IF EXISTS "Users can update their own thread metadata" ON public.dm_threads;

CREATE POLICY "Members can see their threads"
  ON public.dm_threads FOR SELECT TO authenticated
  USING (public.is_thread_member(id, auth.uid()));

CREATE POLICY "Members can update thread metadata"
  ON public.dm_threads FOR UPDATE TO authenticated
  USING (public.is_thread_member(id, auth.uid()));