-- UX-04 Part 2: posts, replies and what they carry.
--
-- A POST is the one object people make in OpenBuilds: words, media, work, or any mix. A REPLY is a post with a parent. posts holds
-- both; root_id is the root's id on every row (a root's own id), set by a trigger at every depth, so one thread is one index range.
--
-- WHAT IS HERE
--   posts             the words, the optional build and step it is about, a reward (roots only), tags, pin and hide marks.
--   post_spaces       the spaces a ROOT post is in. A reply belongs to its root's spaces and has no rows.
--   post_attachments  work (build, part, session, step) or media. Published work is referenced; work from a DRAFT is a copy in
--                     `snapshot` taken at attach time (the client makes it as SV-17's snapshots are made: forkRules.methodOf for
--                     a step, addSession's rules for a session). Attaching never makes a draft readable: a reader gets the
--                     copy, never the draft. The authorship rule (a reply attaches only your own work) is the next migration.
--   post_mentions     who a post mentions, written with the post by its author.
--   builds.allow_as_post_source   the maker's opt-out (default true).
--   create_post(jsonb)            writes a post with its spaces, attachments and mentions in ONE transaction (see below).
--
-- WHO CAN DO WHAT
--   * Anyone reads posts that are not hidden. The author, the root post's author and the moderators of the root's spaces also
--     read hidden ones (the root author is included so that what they hide they can unhide).
--   * An author writes and edits their own posts. Nobody deletes one from the client: no DELETE grant.
--   * Posting into a space checks who_can_post: a root post's space rows are refused where the author may not post, and a reply is
--     refused where the author may not post in any of the root's spaces.
--   * A reward is refused unless every space the post is in allows rewards.
--   * Only the root post's author or the root's space moderators set pinned_by or hidden_by, and only as themselves. Every other
--     column is the author's alone. A post's author, parent and root never change.
--   * Policies cannot see which column an update changes, so posts_guard_update does: it is the column-level half of the policy.
--
-- WHY create_post. A post may have an empty body only when it has an attachment. The two are separate requests through PostgREST,
-- so the rule is a deferred constraint that fires at commit, and the post and its attachments have to be one transaction. This
-- function is that transaction. It is SECURITY INVOKER: every policy and trigger below still applies to each insert.
--
-- THE HELPERS answer only about the caller (auth.uid()), so they leak nothing. They are SECURITY DEFINER because a policy on
-- posts that read posts or post_spaces under the caller's rights would recurse; they set search_path, and anon and authenticated
-- may call them (a policy has to).
--
-- INDEXES for the thread, the author and the space reads are in 20261107170000_ux04_feed.sql with the plans that need them. This file
-- adds only the foreign-key indexes the cascades read.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The replies under one post, oldest first:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.openbuild_posts WHERE root_id = '<a root id>' ORDER BY created_at LIMIT 100;
--      SHOULD SHOW: an Index Scan on idx_posts_root_created (20261107170000), no Sort, no Seq Scan on posts.
--   2. The posts about one build:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.openbuild_posts WHERE about_build_id = '<a build id>' LIMIT 100;
--      SHOULD SHOW: an Index Scan or Bitmap Index Scan on idx_posts_about_build, no Seq Scan on posts.

-- 1. The maker's opt-out ------------------------------------------------------------------------------------------------------

ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS allow_as_post_source boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.builds.allow_as_post_source IS
  'UX-04. False when the maker does not let other people start a post from this build. Read by the post attachment trigger.';

-- 2. posts --------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.posts_tags_ok(tags text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(cardinality(tags), 0) <= 5
     AND NOT EXISTS (SELECT 1 FROM unnest(tags) t WHERE t IS NULL OR char_length(t) NOT BETWEEN 1 AND 30);
$$;

CREATE TABLE IF NOT EXISTS public.openbuild_posts (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id       uuid          NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  root_id         uuid          NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  body            text          NOT NULL DEFAULT '',
  about_build_id  uuid          NULL REFERENCES public.builds(id) ON DELETE SET NULL,
  about_node_id   uuid          NULL REFERENCES public.build_nodes(id) ON DELETE SET NULL,
  reward_gbp      numeric(10,2) NULL,
  still_open      boolean       NOT NULL DEFAULT false,
  tags            text[]        NOT NULL DEFAULT '{}',
  closes_at       timestamptz   NULL,
  pinned_by       uuid          NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  pinned_at       timestamptz   NULL,
  hidden_by       uuid          NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  hidden_reason   text          NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT posts_body_length CHECK (char_length(body) <= 10000),
  CONSTRAINT posts_reward_roots_only CHECK (reward_gbp IS NULL OR (parent_id IS NULL AND reward_gbp >= 0)),
  CONSTRAINT posts_tags_check CHECK (public.posts_tags_ok(tags)),
  CONSTRAINT posts_hidden_reason_length CHECK (hidden_reason IS NULL OR char_length(hidden_reason) <= 500)
);

-- 3. post_spaces --------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.post_spaces (
  post_id  uuid NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, space_id)
);

-- 4. post_attachments ---------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.post_attachments (
  post_id      uuid     NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  position     smallint NOT NULL,
  kind         text     NOT NULL,
  build_id     uuid     NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  node_id      uuid     NULL REFERENCES public.build_nodes(id) ON DELETE CASCADE,
  part_key     text     NULL,
  session_key  text     NULL,
  media_path   text     NULL,
  media_kind   text     NULL,
  snapshot     jsonb    NULL,
  PRIMARY KEY (post_id, position),
  CONSTRAINT post_attachments_position_check CHECK (position BETWEEN 0 AND 19),
  CONSTRAINT post_attachments_kind_check CHECK (kind IN ('build', 'part', 'session', 'step', 'media')),
  CONSTRAINT post_attachments_media_kind_check CHECK (media_kind IS NULL OR media_kind IN ('image', 'video', 'file')),
  -- one check per kind says which columns it needs. A part is what the composer calls a part: a group of sessions, kept in
  -- builds.making.workstreams under a key (src/lib/build/workstreams.ts), so it is named by part_key and not by a node. (SV-17's
  -- saved "part" is a tile with children; that one is a step with children here and is attached as a step.)
  CONSTRAINT post_attachments_build_columns CHECK (kind <> 'build' OR (build_id IS NOT NULL AND node_id IS NULL AND session_key IS NULL AND media_path IS NULL)),
  CONSTRAINT post_attachments_part_columns CHECK (kind <> 'part' OR (build_id IS NOT NULL AND part_key IS NOT NULL AND node_id IS NULL AND session_key IS NULL AND media_path IS NULL)),
  CONSTRAINT post_attachments_step_columns CHECK (kind <> 'step' OR (build_id IS NOT NULL AND node_id IS NOT NULL AND session_key IS NULL AND media_path IS NULL)),
  CONSTRAINT post_attachments_session_columns CHECK (kind <> 'session' OR (build_id IS NOT NULL AND session_key IS NOT NULL AND node_id IS NULL AND media_path IS NULL)),
  CONSTRAINT post_attachments_media_columns CHECK (kind <> 'media' OR (media_path IS NOT NULL AND media_kind IS NOT NULL AND build_id IS NULL AND node_id IS NULL AND session_key IS NULL AND snapshot IS NULL)),
  CONSTRAINT post_attachments_snapshot_size CHECK (snapshot IS NULL OR pg_column_size(snapshot) <= 262144)
);

-- "Posts started from this build" and the cascade from builds.
CREATE INDEX IF NOT EXISTS idx_post_attachments_build ON public.post_attachments (build_id, post_id) WHERE build_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_post_attachments_node ON public.post_attachments (node_id) WHERE node_id IS NOT NULL;

-- 5. post_mentions ------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.post_mentions (
  post_id uuid NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_mentions_user ON public.post_mentions (user_id);

-- 6. Helpers that answer only about the caller ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.viewer_moderates_post(_root uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.post_spaces ps
      JOIN public.space_members m ON m.space_id = ps.space_id
     WHERE ps.post_id = _root
       AND m.user_id = (select auth.uid())
       AND m.role = 'moderator'
  );
$$;

CREATE OR REPLACE FUNCTION public.viewer_owns_root(_root uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.openbuild_posts r WHERE r.id = _root AND r.author_id = (select auth.uid()));
$$;

-- Spaces and their members are readable by everyone, so this needs no more than the caller's rights.
CREATE OR REPLACE FUNCTION public.viewer_can_post_in(_space uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces s
     WHERE s.id = _space
       AND (
         s.who_can_post = 'anyone'
         OR EXISTS (SELECT 1 FROM public.space_members m WHERE m.space_id = s.id AND m.user_id = (select auth.uid()))
       )
  );
$$;

-- Used by the write policies below. They read post_spaces, and a policy on posts that read post_spaces under the caller's rights would
-- recurse (post_spaces' own policy reads posts), so they run with the owner's.
CREATE OR REPLACE FUNCTION public.viewer_can_reply_in(_root uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.post_spaces ps
     WHERE ps.post_id = _root AND NOT public.viewer_can_post_in(ps.space_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.post_spaces_allow_rewards(_post uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.post_spaces ps JOIN public.spaces s ON s.id = ps.space_id
     WHERE ps.post_id = _post AND NOT s.rewards_allowed
  );
$$;

-- 7. posts: root_id, and what an update may change ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.posts_set_root()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.root_id := NEW.id;
  ELSE
    SELECT p.root_id INTO NEW.root_id FROM public.openbuild_posts p WHERE p.id = NEW.parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That topic or reply is gone.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.posts_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := (select auth.uid());
BEGIN
  IF (NEW.author_id, NEW.parent_id, NEW.root_id, NEW.created_at) IS DISTINCT FROM (OLD.author_id, OLD.parent_id, OLD.root_id, OLD.created_at) THEN
    RAISE EXCEPTION 'The author and place of a topic or reply cannot change.';
  END IF;

  -- No signed-in user: the service role or an admin connection. Row level security does not apply to them either.
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF (NEW.body, NEW.tags, NEW.about_build_id, NEW.about_node_id, NEW.reward_gbp, NEW.still_open, NEW.closes_at)
     IS DISTINCT FROM (OLD.body, OLD.tags, OLD.about_build_id, OLD.about_node_id, OLD.reward_gbp, OLD.still_open, OLD.closes_at) THEN
    IF _uid <> OLD.author_id THEN
      RAISE EXCEPTION 'Only the author can edit a topic or reply.';
    END IF;
    NEW.updated_at := clock_timestamp();
  END IF;

  IF (NEW.pinned_by, NEW.hidden_by, NEW.hidden_reason) IS DISTINCT FROM (OLD.pinned_by, OLD.hidden_by, OLD.hidden_reason) THEN
    IF NOT (public.viewer_owns_root(OLD.root_id) OR public.viewer_moderates_post(OLD.root_id)) THEN
      RAISE EXCEPTION 'Only the topic''s author or a moderator can pin or hide it.';
    END IF;
    IF (NEW.pinned_by IS DISTINCT FROM OLD.pinned_by AND NEW.pinned_by IS NOT NULL AND NEW.pinned_by <> _uid)
       OR (NEW.hidden_by IS DISTINCT FROM OLD.hidden_by AND NEW.hidden_by IS NOT NULL AND NEW.hidden_by <> _uid) THEN
      RAISE EXCEPTION 'You can pin or hide only as yourself.';
    END IF;
    IF NEW.pinned_by IS DISTINCT FROM OLD.pinned_by THEN
      NEW.pinned_at := CASE WHEN NEW.pinned_by IS NULL THEN NULL ELSE now() END;
    END IF;
    IF NEW.hidden_by IS NULL THEN
      NEW.hidden_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- A post with no words must carry something. Checked at commit, so the post and its attachments can arrive in one transaction.
CREATE OR REPLACE FUNCTION public.posts_need_body_or_attachment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF btrim(NEW.body) = '' AND NOT EXISTS (SELECT 1 FROM public.post_attachments a WHERE a.post_id = NEW.id) THEN
    RAISE EXCEPTION 'A topic or reply needs words or something attached.';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.posts_set_root() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posts_guard_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.posts_need_body_or_attachment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.viewer_moderates_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_owns_root(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_can_post_in(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viewer_moderates_post(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.viewer_owns_root(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.viewer_can_post_in(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.viewer_can_reply_in(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.post_spaces_allow_rewards(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.viewer_can_reply_in(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.post_spaces_allow_rewards(uuid) TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_posts_set_root ON public.openbuild_posts;
CREATE TRIGGER trg_posts_set_root
BEFORE INSERT ON public.openbuild_posts
FOR EACH ROW EXECUTE FUNCTION public.posts_set_root();

DROP TRIGGER IF EXISTS trg_posts_guard_update ON public.openbuild_posts;
CREATE TRIGGER trg_posts_guard_update
BEFORE UPDATE ON public.openbuild_posts
FOR EACH ROW EXECUTE FUNCTION public.posts_guard_update();

DROP TRIGGER IF EXISTS trg_posts_need_body_or_attachment ON public.openbuild_posts;
CREATE CONSTRAINT TRIGGER trg_posts_need_body_or_attachment
AFTER INSERT OR UPDATE OF body ON public.openbuild_posts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.posts_need_body_or_attachment();

-- Foreign keys the cascades read, and the reads about a build.
CREATE INDEX IF NOT EXISTS idx_posts_parent ON public.openbuild_posts (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_about_build ON public.openbuild_posts (about_build_id) WHERE about_build_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_about_node ON public.openbuild_posts (about_node_id) WHERE about_node_id IS NOT NULL;

-- 8. Grants, then policies ----------------------------------------------------------------------------------------------------

ALTER TABLE public.openbuild_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.openbuild_posts, public.post_spaces, public.post_attachments, public.post_mentions FROM anon, authenticated, service_role;
GRANT SELECT ON public.openbuild_posts, public.post_spaces, public.post_attachments, public.post_mentions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.openbuild_posts TO authenticated;
GRANT SELECT, INSERT ON public.post_spaces, public.post_attachments, public.post_mentions TO authenticated;
GRANT ALL ON public.openbuild_posts, public.post_spaces, public.post_attachments, public.post_mentions TO service_role;

DROP POLICY IF EXISTS "Anyone reads posts that are not hidden" ON public.openbuild_posts;
CREATE POLICY "Anyone reads posts that are not hidden"
  ON public.openbuild_posts FOR SELECT
  TO anon, authenticated
  USING (
    hidden_by IS NULL
    OR author_id = (select auth.uid())
    OR public.viewer_owns_root(root_id)
    OR public.viewer_moderates_post(root_id)
  );

-- root_id in the check is the one the trigger set: a reply is refused where its author may not post in any of the root's spaces.
DROP POLICY IF EXISTS "Authors write their own posts" ON public.openbuild_posts;
CREATE POLICY "Authors write their own posts"
  ON public.openbuild_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND pinned_by IS NULL
    AND hidden_by IS NULL
    AND (parent_id IS NULL OR public.viewer_can_reply_in(root_id))
  );

-- Which rows a user may update. Which COLUMNS is posts_guard_update's.
DROP POLICY IF EXISTS "Authors edit, owners and moderators pin and hide" ON public.openbuild_posts;
CREATE POLICY "Authors edit, owners and moderators pin and hide"
  ON public.openbuild_posts FOR UPDATE
  TO authenticated
  USING (
    author_id = (select auth.uid())
    OR public.viewer_owns_root(root_id)
    OR public.viewer_moderates_post(root_id)
  )
  WITH CHECK (
    (
      author_id = (select auth.uid())
      OR public.viewer_owns_root(root_id)
      OR public.viewer_moderates_post(root_id)
    )
    AND (reward_gbp IS NULL OR public.post_spaces_allow_rewards(id))
  );

DROP POLICY IF EXISTS "Space rows follow their post" ON public.post_spaces;
CREATE POLICY "Space rows follow their post"
  ON public.post_spaces FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = post_spaces.post_id));

-- Only a root post, only by its author, only where they may post, and a reward only where the space allows one.
DROP POLICY IF EXISTS "Authors put their root post in a space" ON public.post_spaces;
CREATE POLICY "Authors put their root post in a space"
  ON public.post_spaces FOR INSERT
  TO authenticated
  WITH CHECK (
    public.viewer_can_post_in(space_id)
    AND EXISTS (
      SELECT 1 FROM public.openbuild_posts p
       WHERE p.id = post_spaces.post_id
         AND p.author_id = (select auth.uid())
         AND p.parent_id IS NULL
         AND (
           p.reward_gbp IS NULL
           OR EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = post_spaces.space_id AND s.rewards_allowed)
         )
    )
  );

DROP POLICY IF EXISTS "Attachments follow their post" ON public.post_attachments;
CREATE POLICY "Attachments follow their post"
  ON public.post_attachments FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = post_attachments.post_id));

DROP POLICY IF EXISTS "Authors attach to their own post" ON public.post_attachments;
CREATE POLICY "Authors attach to their own post"
  ON public.post_attachments FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = post_attachments.post_id AND p.author_id = (select auth.uid())));

DROP POLICY IF EXISTS "Mentions follow their post" ON public.post_mentions;
CREATE POLICY "Mentions follow their post"
  ON public.post_mentions FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = post_mentions.post_id));

DROP POLICY IF EXISTS "Authors mention from their own post" ON public.post_mentions;
CREATE POLICY "Authors mention from their own post"
  ON public.post_mentions FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = post_mentions.post_id AND p.author_id = (select auth.uid())));

-- 9. create_post --------------------------------------------------------------------------------------------------------------
-- p: { parent_id?, body?, about_build_id?, about_node_id?, reward_gbp?, still_open?, tags?, closes_at?,
--      space_ids?: [uuid], attachments?: [{ kind, build_id?, node_id?, part_key?, session_key?, media_path?, media_kind?, snapshot? }],
--      mention_ids?: [uuid] }
-- The author is the caller. Returns the new post's id. Everything is one transaction: a refusal anywhere leaves nothing behind.

CREATE OR REPLACE FUNCTION public.create_post(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := (select auth.uid());
  _id  uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to start a topic or reply.';
  END IF;

  INSERT INTO public.openbuild_posts (author_id, parent_id, body, about_build_id, about_node_id, reward_gbp, still_open, tags, closes_at)
  VALUES (
    _uid,
    nullif(p ->> 'parent_id', '')::uuid,
    coalesce(p ->> 'body', ''),
    nullif(p ->> 'about_build_id', '')::uuid,
    nullif(p ->> 'about_node_id', '')::uuid,
    nullif(p ->> 'reward_gbp', '')::numeric,
    coalesce((p ->> 'still_open')::boolean, false),
    ARRAY(SELECT jsonb_array_elements_text(p -> 'tags')),
    nullif(p ->> 'closes_at', '')::timestamptz
  )
  RETURNING id INTO _id;

  INSERT INTO public.post_spaces (post_id, space_id)
  SELECT DISTINCT _id, s::uuid FROM jsonb_array_elements_text(coalesce(p -> 'space_ids', '[]'::jsonb)) s;

  INSERT INTO public.post_attachments (post_id, position, kind, build_id, node_id, part_key, session_key, media_path, media_kind, snapshot)
  SELECT _id, (a.ord - 1)::smallint, a.v ->> 'kind',
         nullif(a.v ->> 'build_id', '')::uuid, nullif(a.v ->> 'node_id', '')::uuid,
         nullif(a.v ->> 'part_key', ''), nullif(a.v ->> 'session_key', ''),
         nullif(a.v ->> 'media_path', ''), nullif(a.v ->> 'media_kind', ''),
         nullif(a.v -> 'snapshot', 'null'::jsonb)
    FROM jsonb_array_elements(coalesce(p -> 'attachments', '[]'::jsonb)) WITH ORDINALITY AS a(v, ord);

  INSERT INTO public.post_mentions (post_id, user_id)
  SELECT DISTINCT _id, m::uuid FROM jsonb_array_elements_text(coalesce(p -> 'mention_ids', '[]'::jsonb)) m;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_post(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_post(jsonb) TO authenticated, service_role;

COMMENT ON TABLE public.openbuild_posts IS
  'UX-04. A post or, with a parent, a reply. root_id is the thread''s root (its own id for a root), set by trigger.';
COMMENT ON TABLE public.post_attachments IS
  'UX-04. Work or media on a post. Published work is referenced; work from a draft is a copy in snapshot. The attachment trigger enforces who may attach what.';
