DO $$
DECLARE
  _tbl          TEXT;
  _missing      TEXT;
  _orphans      INTEGER;
  _reaction_fks INTEGER;
BEGIN
  IF to_regclass('public.bounties') IS NULL THEN
    RAISE EXCEPTION 'NS-P47 preflight: public.bounties does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bounties WHERE legacy_item_id IS NOT NULL
  ) AND EXISTS (
    SELECT 1 FROM public.content_items WHERE post_type = 'bounty'
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: public.bounties holds no legacy rows but content_items does';
  END IF;
  IF to_regclass('public.ns_p46_migration_map_solutions') IS NULL
     OR to_regclass('public.ns_p46_migration_map_acceptance_log') IS NULL THEN
    RAISE EXCEPTION 'NS-P47 preflight: NS-P46 rollback map tables are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.solutions'::regclass
      AND attname = 'legacy_bounty_item_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: solutions.legacy_bounty_item_id is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_legacy_bounty_item_id'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: public.set_legacy_bounty_item_id() is missing';
  END IF;
  FOREACH _tbl IN ARRAY ARRAY[
    'bounty_discussion_comments',
    'bounty_comment_last_read',
    'bounty_deadline_extensions',
    'bounty_author_review'
  ]
  LOOP
    IF to_regclass('public.' || _tbl) IS NULL THEN
      RAISE EXCEPTION 'NS-P47 preflight: public.% does not exist', _tbl;
    END IF;
    EXECUTE format(
      'SELECT count(*), string_agg(DISTINCT t.bounty_id::TEXT, '', '')
         FROM public.%I t
        WHERE NOT EXISTS (
          SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = t.bounty_id
        )', _tbl)
    INTO _orphans, _missing;
    IF _orphans > 0 THEN
      RAISE EXCEPTION
        'NS-P47 preflight: % rows in public.% have no bounties header. Unmapped bounty_id values: %',
        _orphans, _tbl, _missing;
    END IF;
    RAISE NOTICE 'NS-P47 preflight: public.% — 0 orphans', _tbl;
  END LOOP;
  SELECT count(*) INTO _reaction_fks
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.bounty_comment_reactions'::regclass
    AND c.confrelid = 'public.bounty_discussion_comments'::regclass;
  IF _reaction_fks <> 1 THEN
    RAISE EXCEPTION
      'NS-P47 preflight: bounty_comment_reactions does not foreign-key bounty_discussion_comments exactly once (found %)',
      _reaction_fks;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.bounty_comment_reactions'::regclass
      AND c.confrelid = 'public.content_items'::regclass
  ) THEN
    RAISE EXCEPTION
      'NS-P47 preflight: bounty_comment_reactions has a direct foreign key to content_items';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bounty_discussion_comments'::regclass
      AND tgname = 'trg_bdc_updated_at' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: trg_bdc_updated_at is not on public.bounty_discussion_comments';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bounty_author_review'::regclass
      AND tgname = 'trg_bounty_author_review_updated' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: trg_bounty_author_review_updated is not on public.bounty_author_review';
  END IF;
  RAISE NOTICE 'NS-P47 preflight passed';
END $$;

CREATE TABLE public.ns_p47_migration_map_bounty_discussion_comments AS
SELECT id, bounty_id AS old_bounty_id
FROM public.bounty_discussion_comments;
CREATE TABLE public.ns_p47_migration_map_bounty_deadline_extensions AS
SELECT id, bounty_id AS old_bounty_id
FROM public.bounty_deadline_extensions;
CREATE TABLE public.ns_p47_migration_map_bounty_author_review AS
SELECT id, bounty_id AS old_bounty_id
FROM public.bounty_author_review;
CREATE TABLE public.ns_p47_migration_map_bounty_comment_last_read AS
SELECT bounty_id AS old_bounty_id, user_id
FROM public.bounty_comment_last_read;

ALTER TABLE public.ns_p47_migration_map_bounty_discussion_comments
  ADD CONSTRAINT ns_p47_migration_map_bounty_discussion_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p47_migration_map_bounty_deadline_extensions
  ADD CONSTRAINT ns_p47_migration_map_bounty_deadline_extensions_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p47_migration_map_bounty_author_review
  ADD CONSTRAINT ns_p47_migration_map_bounty_author_review_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p47_migration_map_bounty_comment_last_read
  ADD CONSTRAINT ns_p47_migration_map_bounty_comment_last_read_pkey PRIMARY KEY (old_bounty_id, user_id);

ALTER TABLE public.ns_p47_migration_map_bounty_discussion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p47_migration_map_bounty_deadline_extensions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p47_migration_map_bounty_author_review        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p47_migration_map_bounty_comment_last_read    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ns_p47_migration_map_bounty_discussion_comments FROM anon, authenticated;
REVOKE ALL ON public.ns_p47_migration_map_bounty_deadline_extensions  FROM anon, authenticated;
REVOKE ALL ON public.ns_p47_migration_map_bounty_author_review        FROM anon, authenticated;
REVOKE ALL ON public.ns_p47_migration_map_bounty_comment_last_read    FROM anon, authenticated;
GRANT ALL ON public.ns_p47_migration_map_bounty_discussion_comments TO service_role;
GRANT ALL ON public.ns_p47_migration_map_bounty_deadline_extensions TO service_role;
GRANT ALL ON public.ns_p47_migration_map_bounty_author_review TO service_role;
GRANT ALL ON public.ns_p47_migration_map_bounty_comment_last_read TO service_role;

ALTER TABLE public.bounty_discussion_comments
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;
ALTER TABLE public.bounty_comment_last_read
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;
ALTER TABLE public.bounty_deadline_extensions
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;
ALTER TABLE public.bounty_author_review
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE INDEX idx_bdc_legacy_bounty_item
  ON public.bounty_discussion_comments (legacy_bounty_item_id, created_at)
  WHERE legacy_bounty_item_id IS NOT NULL;
CREATE INDEX idx_bclr_legacy_bounty_item
  ON public.bounty_comment_last_read (legacy_bounty_item_id, user_id)
  WHERE legacy_bounty_item_id IS NOT NULL;
CREATE INDEX idx_bde_legacy_bounty_item
  ON public.bounty_deadline_extensions (legacy_bounty_item_id)
  WHERE legacy_bounty_item_id IS NOT NULL;
CREATE INDEX idx_bar_legacy_bounty_item
  ON public.bounty_author_review (legacy_bounty_item_id, author_id)
  WHERE legacy_bounty_item_id IS NOT NULL;

ALTER TABLE public.bounty_discussion_comments DISABLE TRIGGER trg_bdc_updated_at;
ALTER TABLE public.bounty_author_review DISABLE TRIGGER trg_bounty_author_review_updated;

UPDATE public.bounty_discussion_comments SET legacy_bounty_item_id = bounty_id;
UPDATE public.bounty_comment_last_read   SET legacy_bounty_item_id = bounty_id;
UPDATE public.bounty_deadline_extensions SET legacy_bounty_item_id = bounty_id;
UPDATE public.bounty_author_review       SET legacy_bounty_item_id = bounty_id;

DO $$
DECLARE
  _tbl    TEXT;
  _name   TEXT;
  _action "char";
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'public.bounty_discussion_comments',
    'public.bounty_comment_last_read',
    'public.bounty_deadline_extensions',
    'public.bounty_author_review'
  ]
  LOOP
    SELECT c.conname, c.confdeltype INTO _name, _action
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = _tbl::regclass
      AND c.confrelid = 'public.content_items'::regclass
      AND c.conkey = ARRAY[(
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = _tbl::regclass AND a.attname = 'bounty_id'
      )]::SMALLINT[];
    IF _name IS NULL THEN
      RAISE EXCEPTION 'NS-P47: no bounty_id -> content_items foreign key found on %', _tbl;
    END IF;
    IF _action <> 'c' THEN
      RAISE EXCEPTION
        'NS-P47: % carried ON DELETE % on bounty_id, not CASCADE', _tbl, _action;
    END IF;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', _tbl, _name);
    RAISE NOTICE 'NS-P47: dropped % on %', _name, _tbl;
  END LOOP;
END $$;

UPDATE public.bounty_discussion_comments t
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = t.bounty_id;
UPDATE public.bounty_comment_last_read t
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = t.bounty_id;
UPDATE public.bounty_deadline_extensions t
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = t.bounty_id;
UPDATE public.bounty_author_review t
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = t.bounty_id;

ALTER TABLE public.bounty_author_review ENABLE TRIGGER trg_bounty_author_review_updated;
ALTER TABLE public.bounty_discussion_comments ENABLE TRIGGER trg_bdc_updated_at;

DO $$
DECLARE
  _tbl    TEXT;
  _now    INTEGER;
  _was    INTEGER;
  _bad    INTEGER;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'bounty_discussion_comments',
    'bounty_comment_last_read',
    'bounty_deadline_extensions',
    'bounty_author_review'
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', _tbl) INTO _now;
    EXECUTE format('SELECT count(*) FROM public.%I', 'ns_p47_migration_map_' || _tbl) INTO _was;
    IF _now <> _was THEN
      RAISE EXCEPTION 'NS-P47: row count moved on public.% — % before, % after', _tbl, _was, _now;
    END IF;
    EXECUTE format(
      'SELECT count(*) FROM public.%I t
        WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = t.bounty_id)', _tbl)
    INTO _bad;
    IF _bad > 0 THEN
      RAISE EXCEPTION 'NS-P47: % rows in public.% do not resolve to a bounties row after the repoint', _bad, _tbl;
    END IF;
    EXECUTE format(
      'SELECT count(*) FROM public.%I t
         JOIN public.bounties b ON b.id = t.bounty_id
        WHERE t.legacy_bounty_item_id IS DISTINCT FROM b.legacy_item_id', _tbl)
    INTO _bad;
    IF _bad > 0 THEN
      RAISE EXCEPTION
        'NS-P47: % rows in public.% have a legacy_bounty_item_id that disagrees with their bounty', _bad, _tbl;
    END IF;
    RAISE NOTICE 'NS-P47: public.% — % rows repointed', _tbl, _now;
  END LOOP;
END $$;

ALTER TABLE public.bounty_discussion_comments
  ADD CONSTRAINT bounty_discussion_comments_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;
ALTER TABLE public.bounty_comment_last_read
  ADD CONSTRAINT bounty_comment_last_read_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;
ALTER TABLE public.bounty_deadline_extensions
  ADD CONSTRAINT bounty_deadline_extensions_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;
ALTER TABLE public.bounty_author_review
  ADD CONSTRAINT bounty_author_review_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;

CREATE INDEX idx_bounty_author_review_bounty
  ON public.bounty_author_review (bounty_id, author_id);

CREATE TRIGGER trg_bdc_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.bounty_discussion_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();
CREATE TRIGGER trg_bclr_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.bounty_comment_last_read
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();
CREATE TRIGGER trg_bde_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.bounty_deadline_extensions
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();
CREATE TRIGGER trg_bar_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.bounty_author_review
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();

DROP POLICY IF EXISTS "Public can read discussion on published bounties" ON public.bounty_discussion_comments;
CREATE POLICY "Public can read discussion on published bounties"
  ON public.bounty_discussion_comments FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_discussion_comments.bounty_id
        AND (
          (
            b.legacy_item_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.content_items ci
              WHERE ci.id = b.legacy_item_id
                AND ci.status = 'approved'
            )
          )
          OR (
            b.build_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM public.builds bl
              WHERE bl.id = b.build_id
                AND bl.status <> 'draft'
            )
          )
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated can post discussion" ON public.bounty_discussion_comments;
CREATE POLICY "Authenticated can post discussion"
  ON public.bounty_discussion_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Author can edit discussion within 5 minutes" ON public.bounty_discussion_comments;
CREATE POLICY "Author can edit discussion within 5 minutes"
  ON public.bounty_discussion_comments FOR UPDATE TO authenticated
  USING (
    author_id = (select auth.uid())
    AND created_at > now() - interval '5 minutes'
  );

DROP POLICY IF EXISTS "Author can delete own discussion" ON public.bounty_discussion_comments;
CREATE POLICY "Author can delete own discussion"
  ON public.bounty_discussion_comments FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "User manages own last_read" ON public.bounty_comment_last_read;
CREATE POLICY "User manages own last_read"
  ON public.bounty_comment_last_read FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Bounty author can insert extension" ON public.bounty_deadline_extensions;
CREATE POLICY "Bounty author can insert extension"
  ON public.bounty_deadline_extensions FOR INSERT TO authenticated
  WITH CHECK (
    extended_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_id
        AND b.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Author can read own review entries" ON public.bounty_author_review;
CREATE POLICY "Author can read own review entries"
  ON public.bounty_author_review FOR SELECT TO authenticated
  USING (
    author_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_author_review.bounty_id
        AND b.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Author can insert review on own bounty" ON public.bounty_author_review;
CREATE POLICY "Author can insert review on own bounty"
  ON public.bounty_author_review FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_id
        AND b.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Author can update own review entries" ON public.bounty_author_review;
CREATE POLICY "Author can update own review entries"
  ON public.bounty_author_review FOR UPDATE TO authenticated
  USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Author can delete own review entries" ON public.bounty_author_review;
CREATE POLICY "Author can delete own review entries"
  ON public.bounty_author_review FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()));

DO $do$
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL THEN
    RAISE NOTICE 'NS-P47: public.bounty_me_too is absent — no counter to dual-write, nothing installed.';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.content_items'::regclass
      AND attname = 'bounty_me_too_count'
      AND NOT attisdropped
  ) THEN
    RAISE WARNING 'NS-P47: public.bounty_me_too exists but content_items.bounty_me_too_count does not.';
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bounty_me_too'::regclass
      AND tgname = 'trg_update_bounty_me_too_count'
      AND NOT tgisinternal
  ) THEN
    RAISE WARNING 'NS-P47: trg_update_bounty_me_too_count is not on public.bounty_me_too.';
    RETURN;
  END IF;
  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION public.update_bounty_me_too_count()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $fn$
    DECLARE
      _content_id UUID;
      _count      INTEGER;
    BEGIN
      _content_id := COALESCE(NEW.content_id, OLD.content_id);
      SELECT count(*) INTO _count
      FROM public.bounty_me_too
      WHERE content_id = _content_id;
      UPDATE public.content_items
      SET bounty_me_too_count = _count
      WHERE id = _content_id;
      UPDATE public.bounties
      SET me_too_count = _count
      WHERE legacy_item_id = _content_id;
      RETURN NULL;
    END;
    $fn$;
  $ddl$;
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_bounty_me_too_count() FROM PUBLIC, anon, authenticated';
  UPDATE public.bounties b
  SET me_too_count = c.n
  FROM (
    SELECT content_id, count(*)::INTEGER AS n
    FROM public.bounty_me_too
    GROUP BY content_id
  ) c
  WHERE b.legacy_item_id = c.content_id
    AND b.me_too_count IS DISTINCT FROM c.n;
  RAISE NOTICE 'NS-P47: me-too counter now dual-writes.';
END
$do$;