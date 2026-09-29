-- =============================================================================
-- RC-P15 — likes, saves and comments on builds, and builds in collections
-- =============================================================================
-- WHAT IT ADDS. Phase 3 moved discovery onto builds, but every social table
-- still points at legacy posts: user_saves.content_id is NOT NULL,
-- collection_items.item_kind knows no 'build', and primitive_comments anchors
-- only to legacy surfaces. This migration gives builds their own:
--
--   build_likes      one row per (build, reader); readable by everyone who can
--                    read the build
--   build_saves      one row per (build, reader); readable only by the reader
--   build_comments   a comment on a build, optionally on one of its parts
--                    (node_id), optionally a reply (parent_id), one level deep
--   builds           like_count, comment_count, save_count, kept by triggers
--   collection_items a build_id column, so a collection can hold a build
--
-- It changes no existing column, policy or trigger. user_saves and
-- primitive_comments are untouched (legacy, removed later).
--
-- ONE ADDITION BEYOND THE PROMPT'S LIST, STATED PLAINLY: build_comments carries
-- a second foreign key on author_id, to public.profiles(id)
-- (build_comments_author_profile_fkey), beside the one to auth.users(id) the
-- prompt names. PostgREST embeds only along foreign keys between exposed
-- tables, and auth.users is not exposed, so without it a comment's author name
-- and avatar would cost a request of their own on every page of comments;
-- RC-P17 budgets the whole comments section at two requests. Every account has
-- a profiles row (handle_new_user), and profiles.id itself cascades from
-- auth.users, so the second key refuses nothing the first allows.
--
-- COUNTS ARE INCREMENTED, NOT RECOUNTED, and never fall below zero
-- (GREATEST(..., 0)). A like, a save and a comment each arrive and leave as
-- whole rows, so there is no in-place change for an increment to miss, which is
-- what made build_reproductions recount (20260825140100). The one in-place
-- change that moves a count is a comment being hidden or shown, and the comment
-- trigger fires on UPDATE OF is_hidden for exactly that. The counter UPDATEs
-- touch builds, so trg_builds_updated_at moves builds.updated_at with them, as
-- the reproduction and rebuild counters already do.
--
-- SECURITY. The three counters are SECURITY DEFINER: a reader who likes a build
-- may not update it, and the count is the database's to keep, not the
-- reader's. The comment check is SECURITY INVOKER: it reads the node and the
-- parent comment as the writer, so a writer cannot attach a comment to a node
-- or reply to a comment they cannot see. EXECUTE on every trigger function is
-- revoked from PUBLIC, anon and authenticated; trigger firing does not consult
-- EXECUTE (see 20260827140000), so the triggers are unaffected. Every policy
-- reads the caller as (select auth.uid()) ⟦supabase-postgres-best-practices ›
-- references/security-rls-performance.md⟧.
--
-- GRANTS REPLACE THE PLATFORM DEFAULTS. Tables created in public are granted
-- ALL to anon and authenticated by default privileges, so each new table is
-- revoked first and then granted exactly what its policies serve
-- ⟦references/security-privileges.md⟧: anon reads likes and comments and
-- nothing else; authenticated reads, adds and removes its own likes, saves and
-- comments, and may UPDATE a comment's body and edited_at only. Hiding a
-- comment is an admin action (RC-P17b), never a column a reader can write.
--
-- THE CHECK TO RUN once applied: L-P15-2 (the RLS proof), which ends in
-- ROLLBACK and changes nothing.
-- =============================================================================


-- =============================================================================
-- a. build_likes
-- =============================================================================
-- The primary key's leading column indexes build_id, which serves the per-build
-- reads, the RLS check and ON DELETE CASCADE from builds; user_id gets its own
-- index, newest first, for "my likes" and the cascade from auth.users
-- ⟦references/schema-foreign-key-indexes.md⟧.
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


-- =============================================================================
-- b. build_saves
-- =============================================================================
-- The same shape and indexes as build_likes. (user_id, created_at DESC) is
-- also the keyset the Library's "Saved" list pages on.
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


-- =============================================================================
-- c. build_comments
-- =============================================================================
-- node_id is SET NULL when the part is deleted, so the comment survives on the
-- build; parent_id CASCADEs, so a reply goes with the comment it answers.
-- Every foreign-key column has an index; node_id and parent_id are NULL on most
-- rows and are only ever looked up by value, so theirs are partial
-- ⟦references/query-partial-indexes.md⟧. (build_id, created_at) is the order
-- the section reads comments in.
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
  -- The embed key for the author's name and avatar; see the header.
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

-- The three rules a foreign key cannot state. Each message names identifiers
-- only, never the body ⟦neoscale-error-monitoring › Privacy⟧.
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
  -- A part belongs to exactly one build. A node the writer cannot read comes
  -- back as no row, and is refused the same way as a node of another build.
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

    -- A parent on another build, or one the writer cannot read.
    IF _parent_build IS DISTINCT FROM NEW.build_id THEN
      RAISE EXCEPTION 'build_comments: parent % is not a comment on build %', NEW.parent_id, NEW.build_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Replies are one level deep: a reply cannot be answered.
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


-- =============================================================================
-- d. builds: the three counts, and the triggers that keep them
-- =============================================================================
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
    -- A like removed by the cascade from its build finds no build row here,
    -- which is the right answer: there is nothing left to count against.
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

-- Counts only comments that are not hidden: a comment counts when it arrives
-- visible, stops counting when an admin hides it, counts again if it is shown,
-- and stops when it is deleted while visible. Replies count like any comment.
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


-- =============================================================================
-- e. collection_items can hold a build
-- =============================================================================
-- A build item carries build_id and no content_id, so content_id stops being
-- required; a legacy item keeps its content_id exactly as it was.
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS build_id uuid NULL REFERENCES public.builds(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_collection_items_build
  ON public.collection_items (build_id)
  WHERE build_id IS NOT NULL;

ALTER TABLE public.collection_items
  ALTER COLUMN content_id DROP NOT NULL;

-- The kind check is found in the catalogue rather than by name, because the
-- live name may differ from 20260501102008's: it is every CHECK on
-- collection_items whose only column is item_kind (the build-matches-kind
-- check below spans two columns and is never matched). Finding none stops the
-- migration, naming the table's constraints, and changes nothing; L-P15-1 asks
-- for exactly those names. A second run finds the check this block added and
-- replaces it with itself ⟦references/schema-constraints.md⟧.
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

  -- A build item and a build_id arrive together or not at all.
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

-- A build appears in a collection at most once.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_collection_items_collection_build
  ON public.collection_items (collection_id, build_id)
  WHERE build_id IS NOT NULL;


-- =============================================================================
-- f. Row level security ⟦references/security-rls-basics.md⟧
-- =============================================================================
ALTER TABLE public.build_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_saves    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.build_comments ENABLE ROW LEVEL SECURITY;

-- --- build_likes -------------------------------------------------------------
-- Readable wherever the build is: the EXISTS runs under the reader's own
-- policies on builds, so the builds policy decides. No UPDATE policy.
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

-- --- build_saves -------------------------------------------------------------
-- Private to the reader who saved. No UPDATE policy; anon has no grant at all.
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

-- --- build_comments ----------------------------------------------------------
-- A hidden comment is read by its author and admins only; every comment is
-- read only where its build is readable.
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

-- Comments go on builds that are out of draft, as their author.
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

-- The author edits their own words; the column grants below keep an edit to
-- body and edited_at.
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


-- =============================================================================
-- g. Grants ⟦references/security-privileges.md⟧
-- =============================================================================
-- The platform's default privileges grant ALL on a new public table to anon
-- and authenticated; a column grant narrows nothing while a table-wide grant
-- stands. So everything is revoked first, then granted exactly.
REVOKE ALL ON public.build_likes, public.build_saves, public.build_comments
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.build_likes, public.build_comments TO anon;

GRANT SELECT, INSERT, DELETE ON public.build_likes, public.build_saves TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.build_comments TO authenticated;
GRANT UPDATE (body, edited_at) ON public.build_comments TO authenticated;
