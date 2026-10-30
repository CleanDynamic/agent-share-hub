CREATE TABLE IF NOT EXISTS public.build_likes (
  build_id   uuid        NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (build_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_build_likes_user_created
  ON public.build_likes (user_id, created_at DESC);

COMMENT ON TABLE public.build_likes IS
  'RC-P15. One like per (build, reader). Readable wherever the build is readable; written and removed only by the reader. builds.like_count follows it by trigger.';

CREATE TABLE IF NOT EXISTS public.build_saves (
  build_id   uuid        NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (build_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_build_saves_user_created
  ON public.build_saves (user_id, created_at DESC);

COMMENT ON TABLE public.build_saves IS
  'RC-P15. One save per (build, reader). Private: only the reader reads, writes and removes their own. builds.save_count follows it by trigger.';

CREATE TABLE IF NOT EXISTS public.build_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id   uuid        NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  node_id    uuid        NULL REFERENCES public.build_nodes(id) ON DELETE SET NULL,
  parent_id  uuid        NULL REFERENCES public.build_comments(id) ON DELETE CASCADE,
  author_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  is_hidden  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at  timestamptz NULL,
  CONSTRAINT build_comments_author_profile_fkey
    FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_build_comments_build_created
  ON public.build_comments (build_id, created_at);

CREATE INDEX IF NOT EXISTS idx_build_comments_node
  ON public.build_comments (node_id)
  WHERE node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_build_comments_parent
  ON public.build_comments (parent_id)
  WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_build_comments_author
  ON public.build_comments (author_id);

COMMENT ON TABLE public.build_comments IS
  'RC-P15. A comment on a build, optionally on one of its parts (node_id), optionally a reply (parent_id, one level deep). Hidden comments are read only by their author and admins. builds.comment_count counts the rows that are not hidden.';

CREATE OR REPLACE FUNCTION public.validate_build_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _node_build    uuid;
  _parent_build  uuid;
  _parent_parent uuid;
BEGIN
  IF NEW.node_id IS NOT NULL THEN
    SELECT n.build_id INTO _node_build
      FROM public.build_nodes n
     WHERE n.id = NEW.node_id;

    IF _node_build IS DISTINCT FROM NEW.build_id THEN
      RAISE EXCEPTION 'build_comments: node % is not a part of build %', NEW.node_id, NEW.build_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT c.build_id, c.parent_id INTO _parent_build, _parent_parent
      FROM public.build_comments c
     WHERE c.id = NEW.parent_id;

    IF _parent_build IS DISTINCT FROM NEW.build_id THEN
      RAISE EXCEPTION 'build_comments: parent % is not a comment on build %', NEW.parent_id, NEW.build_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF _parent_parent IS NOT NULL THEN
      RAISE EXCEPTION 'build_comments: parent % is itself a reply', NEW.parent_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_build_comment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_build_comments_validate ON public.build_comments;
CREATE TRIGGER trg_build_comments_validate
BEFORE INSERT OR UPDATE ON public.build_comments
FOR EACH ROW EXECUTE FUNCTION public.validate_build_comment();

ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS like_count    int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS save_count    int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.sync_build_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.builds
       SET like_count = GREATEST(like_count + 1, 0)
     WHERE id = NEW.build_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.builds
       SET like_count = GREATEST(like_count - 1, 0)
     WHERE id = OLD.build_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_build_save_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.builds
       SET save_count = GREATEST(save_count + 1, 0)
     WHERE id = NEW.build_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.builds
       SET save_count = GREATEST(save_count - 1, 0)
     WHERE id = OLD.build_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_build_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.is_hidden THEN
      UPDATE public.builds
         SET comment_count = GREATEST(comment_count + 1, 0)
       WHERE id = NEW.build_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF NOT OLD.is_hidden THEN
      UPDATE public.builds
         SET comment_count = GREATEST(comment_count - 1, 0)
       WHERE id = OLD.build_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_hidden AND NOT NEW.is_hidden THEN
      UPDATE public.builds
         SET comment_count = GREATEST(comment_count + 1, 0)
       WHERE id = NEW.build_id;
    ELSIF NOT OLD.is_hidden AND NEW.is_hidden THEN
      UPDATE public.builds
         SET comment_count = GREATEST(comment_count - 1, 0)
       WHERE id = NEW.build_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_build_like_count()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_build_save_count()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_build_comment_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_build_likes_count ON public.build_likes;
CREATE TRIGGER trg_build_likes_count
AFTER INSERT OR DELETE ON public.build_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_build_like_count();

DROP TRIGGER IF EXISTS trg_build_saves_count ON public.build_saves;
CREATE TRIGGER trg_build_saves_count
AFTER INSERT OR DELETE ON public.build_saves
FOR EACH ROW EXECUTE FUNCTION public.sync_build_save_count();

DROP TRIGGER IF EXISTS trg_build_comments_count ON public.build_comments;
CREATE TRIGGER trg_build_comments_count
AFTER INSERT OR DELETE OR UPDATE OF is_hidden ON public.build_comments
FOR EACH ROW EXECUTE FUNCTION public.sync_build_comment_count();

ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS build_id uuid NULL REFERENCES public.builds(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_collection_items_build
  ON public.collection_items (build_id)
  WHERE build_id IS NOT NULL;

ALTER TABLE public.collection_items
  ALTER COLUMN content_id DROP NOT NULL;

DO $$
DECLARE
  _kind_attnum smallint;
  _conname     text;
  _dropped     int := 0;
BEGIN
  SELECT a.attnum INTO _kind_attnum
    FROM pg_attribute a
   WHERE a.attrelid = 'public.collection_items'::regclass
     AND a.attname = 'item_kind'
     AND NOT a.attisdropped;

  IF _kind_attnum IS NULL THEN
    RAISE EXCEPTION 'RC-P15: collection_items has no item_kind column; nothing was changed';
  END IF;

  FOR _conname IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.collection_items'::regclass
       AND c.contype = 'c'
       AND c.conkey = ARRAY[_kind_attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.collection_items DROP CONSTRAINT %I', _conname);
    _dropped := _dropped + 1;
  END LOOP;

  IF _dropped = 0 THEN
    RAISE EXCEPTION 'RC-P15: no check constraint on collection_items.item_kind was found; nothing was changed. Constraints on collection_items: %',
      (SELECT string_agg(c.conname, ', ' ORDER BY c.conname)
         FROM pg_constraint c
        WHERE c.conrelid = 'public.collection_items'::regclass);
  END IF;

  ALTER TABLE public.collection_items
    ADD CONSTRAINT collection_items_item_kind_check
    CHECK (item_kind IS NULL OR item_kind IN ('build','blueprint','blog','bounty','stage','block'));

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint c
     WHERE c.conrelid = 'public.collection_items'::regclass
       AND c.conname = 'collection_items_build_matches_kind'
  ) THEN
    ALTER TABLE public.collection_items
      ADD CONSTRAINT collection_items_build_matches_kind
      CHECK ((item_kind = 'build') = (build_id IS NOT NULL));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_collection_items_collection_build
  ON public.collection_items (collection_id, build_id)
  WHERE build_id IS NOT NULL;

ALTER TABLE public.build_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_saves    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Likes follow build readability" ON public.build_likes;
CREATE POLICY "Likes follow build readability"
  ON public.build_likes FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_likes.build_id));

DROP POLICY IF EXISTS "Readers add their own likes" ON public.build_likes;
CREATE POLICY "Readers add their own likes"
  ON public.build_likes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers remove their own likes" ON public.build_likes;
CREATE POLICY "Readers remove their own likes"
  ON public.build_likes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers read their own saves" ON public.build_saves;
CREATE POLICY "Readers read their own saves"
  ON public.build_saves FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers add their own saves" ON public.build_saves;
CREATE POLICY "Readers add their own saves"
  ON public.build_saves FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers remove their own saves" ON public.build_saves;
CREATE POLICY "Readers remove their own saves"
  ON public.build_saves FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

REVOKE ALL ON public.build_saves FROM anon;

DROP POLICY IF EXISTS "Comments follow build readability" ON public.build_comments;
CREATE POLICY "Comments follow build readability"
  ON public.build_comments FOR SELECT
  TO anon, authenticated
  USING (
    (
      NOT is_hidden
      OR author_id = (select auth.uid())
      OR public.is_admin((select auth.uid()))
    )
    AND EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_comments.build_id)
  );

DROP POLICY IF EXISTS "Readers comment as themselves on published builds" ON public.build_comments;
CREATE POLICY "Readers comment as themselves on published builds"
  ON public.build_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.builds b
       WHERE b.id = build_comments.build_id
         AND b.status <> 'draft'
    )
  );

DROP POLICY IF EXISTS "Authors edit their own comments" ON public.build_comments;
CREATE POLICY "Authors edit their own comments"
  ON public.build_comments FOR UPDATE
  TO authenticated
  USING (author_id = (select auth.uid()))
  WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authors and admins delete comments" ON public.build_comments;
CREATE POLICY "Authors and admins delete comments"
  ON public.build_comments FOR DELETE
  TO authenticated
  USING (
    author_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );

REVOKE ALL ON public.build_likes, public.build_saves, public.build_comments
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.build_likes, public.build_comments TO anon;

GRANT SELECT, INSERT, DELETE ON public.build_likes, public.build_saves TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.build_comments TO authenticated;
GRANT UPDATE (body, edited_at) ON public.build_comments TO authenticated;