-- UX-04 Part 4: likes and the reactions a space switches on.
--
-- post_likes follows build_likes (20261001180000): one row per (post, reader), readable wherever the post is, written and removed
-- only by the reader, and a stored count kept by trigger. build_likes keeps builds.like_count, so posts gets openbuild_posts.like_count the
-- same way, and a read of a post's likes never has to count rows.
--
-- post_reactions are the extras a space can switch on (spaces.reactions): 'dislike' (no value) and 'rating' (1 to 5). One row per
-- (post, reader, kind). A trigger refuses a kind the post's spaces have not all switched on: a reply is judged by its root's
-- spaces, and a post in no space takes no extra reactions. "Every space" is the stricter reading of "the post's spaces", as it is
-- for rewards (20261107130000). Counts and averages are read, not stored: nothing asks for them yet.
--
-- saved_items: the kind check also allows 'post', and nothing else about saves changes. SAVES STAY PRIVATE (SV-17): saved_items
-- keeps its owner-only policies, and nothing here adds a count or a read of who saved a post. The existing list of kinds is read from
-- the live check and kept, so a kind the repository does not know about is not dropped; the block stops, naming the problem, if it
-- cannot find the check or if a row holds a kind the new check would refuse.
--
-- Notifications for a like are Part 5 (20261107160000).
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The reactions on one post:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT user_id, kind, value FROM public.post_reactions WHERE post_id = '<a post id>' LIMIT 200;
--      SHOULD SHOW: an Index Scan on post_reactions_pkey, no Seq Scan on post_reactions.
--   2. A reader's likes, newest first:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT post_id FROM public.post_likes WHERE user_id = '<a reader>' ORDER BY created_at DESC LIMIT 50;
--      SHOULD SHOW: an Index Scan on idx_post_likes_user_created, no Sort, no Seq Scan on post_likes.

-- 1. post_likes ----------------------------------------------------------------------------------------------------------------

ALTER TABLE public.openbuild_posts
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id    uuid        NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_created ON public.post_likes (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_post_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.openbuild_posts SET like_count = GREATEST(like_count + 1, 0) WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- a like removed by the cascade from its post finds no post row here, which is right
    UPDATE public.openbuild_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_post_like_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_post_like_count();

-- 2. post_reactions -----------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.post_reactions (
  post_id    uuid        NOT NULL REFERENCES public.openbuild_posts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind       text        NOT NULL,
  value      smallint    NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id, kind),
  CONSTRAINT post_reactions_kind_value CHECK (
    (kind = 'dislike' AND value IS NULL) OR (kind = 'rating' AND value IS NOT NULL AND value BETWEEN 1 AND 5)
  )
);

CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON public.post_reactions (user_id);

-- SECURITY DEFINER: it reads post_spaces under the owner's rights, as the write policies' helpers do (see 20261107130000).
CREATE OR REPLACE FUNCTION public.check_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _root uuid;
BEGIN
  SELECT p.root_id INTO _root FROM public.openbuild_posts p WHERE p.id = NEW.post_id;
  IF NOT FOUND THEN
    RETURN NEW; -- the foreign key refuses it
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.post_spaces ps WHERE ps.post_id = _root)
     OR EXISTS (
        SELECT 1 FROM public.post_spaces ps
        JOIN public.spaces s ON s.id = ps.space_id
        WHERE ps.post_id = _root AND NOT (NEW.kind = ANY (s.reactions))
     ) THEN
    RAISE EXCEPTION '% are not switched on here.', CASE NEW.kind WHEN 'rating' THEN 'Ratings' ELSE 'Dislikes' END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_post_reaction() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_check_post_reaction ON public.post_reactions;
CREATE TRIGGER trg_check_post_reaction
BEFORE INSERT OR UPDATE ON public.post_reactions
FOR EACH ROW EXECUTE FUNCTION public.check_post_reaction();

-- 3. Grants, then policies ----------------------------------------------------------------------------------------------------

REVOKE ALL ON public.post_likes, public.post_reactions FROM anon, authenticated, service_role;
GRANT SELECT ON public.post_likes, public.post_reactions TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_likes, public.post_reactions TO service_role;

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

-- Readable wherever the post is: the EXISTS runs under the reader's own policies on posts. No UPDATE policy on likes.
DROP POLICY IF EXISTS "Likes follow post readability" ON public.post_likes;
CREATE POLICY "Likes follow post readability"
  ON public.post_likes FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = post_likes.post_id));

DROP POLICY IF EXISTS "Readers add their own post likes" ON public.post_likes;
CREATE POLICY "Readers add their own post likes"
  ON public.post_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers remove their own post likes" ON public.post_likes;
CREATE POLICY "Readers remove their own post likes"
  ON public.post_likes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Reactions follow post readability" ON public.post_reactions;
CREATE POLICY "Reactions follow post readability"
  ON public.post_reactions FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = post_reactions.post_id));

DROP POLICY IF EXISTS "Readers add their own reactions" ON public.post_reactions;
CREATE POLICY "Readers add their own reactions"
  ON public.post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers change their own reactions" ON public.post_reactions;
CREATE POLICY "Readers change their own reactions"
  ON public.post_reactions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers remove their own reactions" ON public.post_reactions;
CREATE POLICY "Readers remove their own reactions"
  ON public.post_reactions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- 4. saved_items can keep a post -----------------------------------------------------------------------------------------------
-- The check is found in the catalogue, as 20261031120000 found notifications' target check: every CHECK on saved_items whose only
-- column is kind. Its quoted values are read and kept, and 'post' is added. Rows are read first: a value the new check would refuse
-- stops the block and changes nothing.

DO $$
DECLARE
  _attnum  smallint;
  _conname text;
  _def     text;
  _kinds   text[];
  _refused text;
BEGIN
  SELECT a.attnum INTO _attnum
    FROM pg_attribute a
   WHERE a.attrelid = 'public.saved_items'::regclass AND a.attname = 'kind' AND NOT a.attisdropped;

  IF _attnum IS NULL THEN
    RAISE EXCEPTION 'UX-04: saved_items has no kind column; nothing was changed';
  END IF;

  SELECT c.conname, pg_get_constraintdef(c.oid) INTO _conname, _def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.saved_items'::regclass AND c.contype = 'c' AND c.conkey = ARRAY[_attnum]
   LIMIT 1;

  IF _conname IS NULL THEN
    RAISE EXCEPTION 'UX-04: saved_items has no check on kind; nothing was changed';
  END IF;

  SELECT array_agg(DISTINCT m[1]) INTO _kinds FROM regexp_matches(_def, '''([a-z_]+)''', 'g') AS m;
  IF _kinds IS NULL THEN
    RAISE EXCEPTION 'UX-04: could not read the kinds saved_items allows from %; nothing was changed', _def;
  END IF;
  _kinds := array_append(array_remove(_kinds, 'post'), 'post');

  SELECT string_agg(DISTINCT s.kind, ', ' ORDER BY s.kind) INTO _refused FROM public.saved_items s WHERE NOT (s.kind = ANY (_kinds));
  IF _refused IS NOT NULL THEN
    RAISE EXCEPTION 'UX-04: saved_items holds kinds the new check would refuse: %; nothing was changed', _refused;
  END IF;

  EXECUTE format('ALTER TABLE public.saved_items DROP CONSTRAINT %I', _conname);
  -- written as IN (...), the form the original is stored in, so that a later run reads the list the same way
  EXECUTE format('ALTER TABLE public.saved_items ADD CONSTRAINT saved_items_kind_check CHECK (kind IN (%s))',
                 (SELECT string_agg(quote_literal(k), ', ' ORDER BY k) FROM unnest(_kinds) k));
END;
$$;

COMMENT ON TABLE public.post_likes IS
  'UX-04. One like per (post, reader). Readable wherever the post is; written and removed only by the reader. openbuild_posts.like_count follows it by trigger.';
COMMENT ON TABLE public.post_reactions IS
  'UX-04. The extra reactions a space switches on: dislike, or a rating from 1 to 5. One per (post, reader, kind).';
