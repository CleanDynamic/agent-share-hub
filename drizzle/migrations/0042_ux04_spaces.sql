-- 1. spaces ------------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.spaces (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text        NOT NULL UNIQUE,
  name             text        NOT NULL,
  description      text        NOT NULL DEFAULT '',
  rules            text        NOT NULL DEFAULT '',
  creator_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  who_can_post     text        NOT NULL DEFAULT 'anyone',
  post_order       text        NOT NULL DEFAULT 'newest',
  default_view     text        NOT NULL DEFAULT 'thread',
  rewards_allowed  boolean     NOT NULL DEFAULT true,
  reactions        text[]      NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spaces_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 40),
  CONSTRAINT spaces_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  CONSTRAINT spaces_description_length CHECK (char_length(description) <= 280),
  CONSTRAINT spaces_rules_length CHECK (char_length(rules) <= 2000),
  CONSTRAINT spaces_who_can_post_check CHECK (who_can_post IN ('anyone', 'members', 'invite')),
  CONSTRAINT spaces_post_order_check CHECK (post_order IN ('newest', 'most_replied', 'pinned_first')),
  CONSTRAINT spaces_default_view_check CHECK (default_view IN ('thread', 'wall')),
  CONSTRAINT spaces_reactions_check CHECK (reactions <@ ARRAY['dislike', 'rating']::text[])
);

-- The creator's foreign key has its own index (the cascade from profiles reads it).
CREATE INDEX IF NOT EXISTS idx_spaces_creator ON public.spaces (creator_id);

-- 2. space_members -----------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.space_members (
  space_id   uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'member',
  invited    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id),
  CONSTRAINT space_members_role_check CHECK (role IN ('member', 'moderator'))
);

-- "The spaces a reader belongs to", and the cascade from profiles.
CREATE INDEX IF NOT EXISTS idx_space_members_user ON public.space_members (user_id);

-- 3. The creator is the first moderator --------------------------------------------------------------------------------------
-- SECURITY DEFINER: the row is written for the creator by the database, not by a policy. It sets search_path and nobody calls it.

CREATE OR REPLACE FUNCTION public.spaces_add_creator_as_moderator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.space_members (space_id, user_id, role, invited)
  VALUES (NEW.id, NEW.creator_id, 'moderator', false)
  ON CONFLICT (space_id, user_id) DO NOTHING;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.spaces_add_creator_as_moderator() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_spaces_add_creator_as_moderator ON public.spaces;
CREATE TRIGGER trg_spaces_add_creator_as_moderator
AFTER INSERT ON public.spaces
FOR EACH ROW EXECUTE FUNCTION public.spaces_add_creator_as_moderator();

-- 4. Grants, then policies ---------------------------------------------------------------------------------------------------

REVOKE ALL ON public.spaces FROM anon, authenticated, service_role;
GRANT SELECT ON public.spaces TO anon;
GRANT SELECT, INSERT, UPDATE ON public.spaces TO authenticated;
GRANT ALL ON public.spaces TO service_role;

REVOKE ALL ON public.space_members FROM anon, authenticated, service_role;
GRANT SELECT ON public.space_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.space_members TO authenticated;
GRANT ALL ON public.space_members TO service_role;

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads spaces" ON public.spaces;
CREATE POLICY "Anyone reads spaces"
  ON public.spaces FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Readers create spaces as themselves" ON public.spaces;
CREATE POLICY "Readers create spaces as themselves"
  ON public.spaces FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = (select auth.uid()));

-- creator_id in the check as well, so the creator cannot hand the space to someone else by an update.
DROP POLICY IF EXISTS "Creators update their spaces" ON public.spaces;
CREATE POLICY "Creators update their spaces"
  ON public.spaces FOR UPDATE
  TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

DROP POLICY IF EXISTS "Anyone reads space members" ON public.space_members;
CREATE POLICY "Anyone reads space members"
  ON public.space_members FOR SELECT
  TO anon, authenticated
  USING (true);

-- A user joins as themselves, as a plain member, and not into an invite space.
DROP POLICY IF EXISTS "Readers join as themselves" ON public.space_members;
CREATE POLICY "Readers join as themselves"
  ON public.space_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND role = 'member'
    AND invited = false
    AND EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_members.space_id AND s.who_can_post <> 'invite')
  );

-- A moderator invites: a plain member row, marked invited, for someone else.
DROP POLICY IF EXISTS "Moderators invite" ON public.space_members;
CREATE POLICY "Moderators invite"
  ON public.space_members FOR INSERT
  TO authenticated
  WITH CHECK (
    role = 'member'
    AND invited = true
    AND EXISTS (
      SELECT 1 FROM public.space_members m
      WHERE m.space_id = space_members.space_id
        AND m.user_id = (select auth.uid())
        AND m.role = 'moderator'
    )
  );

-- Only the creator changes a role. A moderator does not.
DROP POLICY IF EXISTS "Creators change roles" ON public.space_members;
CREATE POLICY "Creators change roles"
  ON public.space_members FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_members.space_id AND s.creator_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_members.space_id AND s.creator_id = (select auth.uid())));

DROP POLICY IF EXISTS "Members leave as themselves" ON public.space_members;
CREATE POLICY "Members leave as themselves"
  ON public.space_members FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

COMMENT ON TABLE public.spaces IS
  'UX-04. A user-made place for posts. Its settings (who can post, order, default view, rewards, extra reactions) are its creator''s. Not a filter set.';
COMMENT ON TABLE public.space_members IS
  'UX-04. Who belongs to a space. role moderator pins and hides posts. invited = true means a moderator wrote the row.';