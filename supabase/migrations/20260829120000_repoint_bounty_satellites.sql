-- =============================================================================
-- NeoScale — the remaining bounty satellites repointed at bounties (NS-P47)
-- =============================================================================
-- One transaction. Four populated tables change what their bounty_id MEANS: it
-- stops being a content_items id and becomes a public.bounties id, resolved
-- through the legacy_item_id mapping NS-P45's backfill wrote and NS-P46 first
-- read. The recipe is NS-P46's, repeated per table: snapshot, shim, drop the
-- old foreign key, UPDATE through the mapping, assert, re-key at bounties,
-- rewrite every policy that asked content_items a question about this column.
--
--   bounty_discussion_comments   bounty_id -> bounties(id)  ON DELETE CASCADE
--   bounty_comment_last_read     bounty_id -> bounties(id)  ON DELETE CASCADE
--   bounty_deadline_extensions   bounty_id -> bounties(id)  ON DELETE CASCADE
--   bounty_author_review         bounty_id -> bounties(id)  ON DELETE CASCADE
--
-- Every one of the four carried ON DELETE CASCADE against content_items and
-- carries ON DELETE CASCADE against bounties. The end-to-end behaviour is
-- unchanged, one level of indirection further out: content_items -> bounties is
-- itself ON DELETE CASCADE (NS-P45), so deleting a legacy content item still
-- removes its discussion, its read marks, its extensions and its review notes.
--
-- TWO TABLES NAMED BY THE PROMPT ARE NOT REPOINTED, AND THE REASONS DIFFER.
--
-- bounty_comment_reactions is INDIRECT and was expected to be: its only foreign
-- key is comment_id -> bounty_discussion_comments(id) ON DELETE CASCADE. It
-- holds no content_items id, no policy on it names content_items, and no client
-- query against it carries a bounty id — reactToComment and the reaction read
-- in getDiscussionThread both filter on comment_id. There is nothing in it to
-- repoint and nothing in it to shim. Section 1 asserts that rather than
-- trusting it, and section 9 says what it inherits from the comments table.
--
-- bounty_me_too is GENERATION 1, and is excluded by a rule this series already
-- wrote down. docs/retired-surfaces.md, "The rule NS-P45 through NS-P49 must
-- follow": generation-1 tables are not repointed and not dropped, and nothing
-- in NS-P45-P49 may add a foreign key to any of them. It is also not there —
-- NS-P44 measured bounty_responses, bounty_me_too and
-- bounty_response_verifications answering PGRST205 against the project in
-- supabase/config.toml, with an invented table name run as a control coming
-- back identical, and content_items.bounty_me_too_count answering 42703. It is
-- absent from src/integrations/supabase/types.ts for the same reason, which is
-- why its one caller writes `.from("bounty_me_too" as any)` — and that caller,
-- src/pages/ContentDetail.legacy.tsx, is on no route and imported by no module.
-- An UPDATE naming it would not repoint an empty table; it would abort this
-- migration with 42P01 on the database that matters. Section 10 does what can
-- be done for it without repointing it: the counter dual-write, installed only
-- where there is something to install it on.
--
-- ONE TRANSACTION. There is no BEGIN in this file, for the reason there is none
-- in any other migration in this directory: the Supabase CLI applies each file
-- in one. The four tables are small — the largest, bounty_discussion_comments,
-- answers a count of 0 in NS-P44's measurement — so the ACCESS EXCLUSIVE locks
-- the foreign key swaps take are held for a moment on tables nothing is
-- reading. If any of them is ever in the millions before this runs, the FK
-- additions in section 8 want ADD CONSTRAINT ... NOT VALID followed by a
-- separate VALIDATE CONSTRAINT in its own transaction, which takes a weaker
-- lock.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
-- solutions and solution_acceptance_log are done (NS-P46). The meta tables —
-- meta_bounty_pledges, meta_bounty_sub_definitions — are NS-P48's, and pledges
-- are NS-P49's; nothing here reads or writes either. No UI file changes in this
-- commit; the data-layer callers that read these tables by the old id are moved
-- onto the shim columns in the commit that follows, and every one of them is
-- flagged `// NS-P47 shim` so NS-P50 removes them with a grep rather than an
-- audit.
-- =============================================================================


-- =============================================================================
-- 1. Preflight — what NS-P47 must not proceed without
-- =============================================================================
-- The "verify before you start" checks, asserted here rather than run by hand,
-- because here is the only place they can be answered authoritatively: as the
-- migration role, seeing every row, on whatever database this actually runs
-- against. A failure aborts the whole transaction and names what it found.
--
-- The orphan checks are the ones with teeth, and they are per-table because the
-- prompt asks for a per-table answer. Unlike solutions, none of these four ever
-- had a trigger asserting that its bounty_id was a post_type='bounty' row — so
-- where NS-P46 had one shape of orphan to worry about, these have every shape:
-- any row whose bounty_id names a content item that is not a bounty, or is not
-- there at all, has no header to move to. Each raises with the unmapped ids.
DO $$
DECLARE
  _tbl          TEXT;
  _missing      TEXT;
  _orphans      INTEGER;
  _reaction_fks INTEGER;
BEGIN
  -- (1) NS-P45's mapping exists and NS-P46's shims are in place. Both are
  --     restated rather than assumed: this migration reads the same mapping
  --     NS-P46 read, and a database where NS-P46 has not run is a database
  --     where the recipe below has not been proven once.
  IF to_regclass('public.bounties') IS NULL THEN
    RAISE EXCEPTION 'NS-P47 preflight: public.bounties does not exist'
      USING HINT = 'Apply 20260828140000_bounties_header_table.sql (NS-P45) first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bounties WHERE legacy_item_id IS NOT NULL
  ) AND EXISTS (
    SELECT 1 FROM public.content_items WHERE post_type = 'bounty'
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: public.bounties holds no legacy rows but content_items does'
      USING HINT = 'The NS-P45 backfill has not run. Repointing now would orphan every child row.';
  END IF;

  IF to_regclass('public.ns_p46_migration_map_solutions') IS NULL
     OR to_regclass('public.ns_p46_migration_map_acceptance_log') IS NULL THEN
    RAISE EXCEPTION 'NS-P47 preflight: NS-P46 rollback map tables are missing'
      USING HINT = 'Apply 20260828160000_repoint_solutions.sql (NS-P46) first. Its maps are kept until NS-P56.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.solutions'::regclass
      AND attname = 'legacy_bounty_item_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: solutions.legacy_bounty_item_id is missing'
      USING HINT = 'NS-P46''s shim is load-bearing until NS-P50 and this migration reuses its derivation trigger.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_legacy_bounty_item_id'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: public.set_legacy_bounty_item_id() is missing'
      USING HINT = 'Section 9 attaches NS-P46''s derivation function to four more tables rather than writing a second copy of the same rule.';
  END IF;

  -- (2) Each of the four tables exists, and every bounty_id in it resolves to a
  --     bounties header. Reported per table, and the first failure stops the
  --     migration with the offending ids named.
  FOREACH _tbl IN ARRAY ARRAY[
    'bounty_discussion_comments',
    'bounty_comment_last_read',
    'bounty_deadline_extensions',
    'bounty_author_review'
  ]
  LOOP
    IF to_regclass('public.' || _tbl) IS NULL THEN
      RAISE EXCEPTION 'NS-P47 preflight: public.% does not exist', _tbl
        USING HINT = 'This migration repoints it. Re-read the table list before continuing.';
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
        _orphans, _tbl, _missing
        USING HINT = 'Each id is a content_items row that is not post_type = ''bounty''. Decide what those rows belong to before repointing.';
    END IF;

    RAISE NOTICE 'NS-P47 preflight: public.% — 0 orphans', _tbl;
  END LOOP;

  -- (3) bounty_comment_reactions is INDIRECT. The prompt expected it and this
  --     is where the expectation gets checked: exactly one foreign key, to the
  --     comments table, and none at all to content_items.
  SELECT count(*) INTO _reaction_fks
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.conrelid = 'public.bounty_comment_reactions'::regclass
    AND c.confrelid = 'public.bounty_discussion_comments'::regclass;

  IF _reaction_fks <> 1 THEN
    RAISE EXCEPTION
      'NS-P47 preflight: bounty_comment_reactions does not foreign-key bounty_discussion_comments exactly once (found %)',
      _reaction_fks
      USING HINT = 'NS-P47 assumes reactions reach a bounty only through a comment. Re-read the table before continuing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.bounty_comment_reactions'::regclass
      AND c.confrelid = 'public.content_items'::regclass
  ) THEN
    RAISE EXCEPTION
      'NS-P47 preflight: bounty_comment_reactions has a direct foreign key to content_items'
      USING HINT = 'It was recorded as indirect. It is not, so it needs repointing and this migration does not do it.';
  END IF;

  -- (4) The two updated_at triggers section 5 switches off around its writes
  --     are where they are expected to be. DISABLE TRIGGER on a name that is
  --     not there is an error, and a confusing one to meet halfway through a
  --     repoint.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bounty_discussion_comments'::regclass
      AND tgname = 'trg_bdc_updated_at' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: trg_bdc_updated_at is not on public.bounty_discussion_comments'
      USING HINT = 'Section 5 disables it by name so the repoint does not stamp every comment as edited today.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bounty_author_review'::regclass
      AND tgname = 'trg_bounty_author_review_updated' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P47 preflight: trg_bounty_author_review_updated is not on public.bounty_author_review'
      USING HINT = 'Section 5 disables it by name around the repoint.';
  END IF;

  RAISE NOTICE 'NS-P47 preflight passed: mapping present, NS-P46 shims in place, zero orphans in all four tables, reactions indirect';
END $$;


-- =============================================================================
-- 2. The rollback net — the old value of every row, before anything moves
-- =============================================================================
-- One map table per repointed table, holding the content_items id that row
-- carried before this migration, exactly as NS-P46's two do. They make the
-- repoint reversible with a join and no guesswork.
--
-- THE ORDER OF A REVERSAL, which is the same shape as NS-P46's and differs in
-- one place — the last_read map is keyed on the OLD id, because that table has
-- no surrogate key and its primary key is the pair being rewritten:
--
--   1. DROP TRIGGER trg_bdc_legacy_bounty_item      ON public.bounty_discussion_comments;
--      DROP TRIGGER trg_bclr_legacy_bounty_item     ON public.bounty_comment_last_read;
--      DROP TRIGGER trg_bde_legacy_bounty_item      ON public.bounty_deadline_extensions;
--      DROP TRIGGER trg_bar_legacy_bounty_item      ON public.bounty_author_review;
--   2. drop the four bounty_id foreign keys added in section 8
--   3. ALTER TABLE public.bounty_discussion_comments DISABLE TRIGGER trg_bdc_updated_at;
--      ALTER TABLE public.bounty_author_review DISABLE TRIGGER trg_bounty_author_review_updated;
--
--      UPDATE public.bounty_discussion_comments t
--      SET bounty_id = m.old_bounty_id
--      FROM public.ns_p47_migration_map_bounty_discussion_comments m
--      WHERE m.id = t.id;
--
--      (the same for bounty_deadline_extensions and bounty_author_review, each
--       against its own map, joined on id)
--
--      UPDATE public.bounty_comment_last_read t
--      SET bounty_id = m.old_bounty_id
--      FROM public.ns_p47_migration_map_bounty_comment_last_read m
--      JOIN public.bounties b ON b.legacy_item_id = m.old_bounty_id
--      WHERE t.bounty_id = b.id AND t.user_id = m.user_id;
--
--      ALTER TABLE public.bounty_author_review ENABLE TRIGGER trg_bounty_author_review_updated;
--      ALTER TABLE public.bounty_discussion_comments ENABLE TRIGGER trg_bdc_updated_at;
--   4. restore the four foreign keys against content_items(id) ON DELETE
--      CASCADE and the policies from
--      20260503132953_dde1ba26-d63c-44c1-9d6c-4ddfd98e2231.sql (discussion,
--      last_read) and 20260504084620_bb398253-4045-4962-a742-191dc1992943.sql
--      (author_review, deadline_extensions), then drop the four
--      legacy_bounty_item_id columns
--
-- The data is the part that cannot be reconstructed from a file, which is why
-- it is the part that gets a table.
--
-- KEPT UNTIL NS-P56 SIGNS OFF, with NS-P46's two. Dropping them is a separate,
-- explicit decision.
CREATE TABLE public.ns_p47_migration_map_bounty_discussion_comments AS
SELECT id, bounty_id AS old_bounty_id
FROM public.bounty_discussion_comments;

CREATE TABLE public.ns_p47_migration_map_bounty_deadline_extensions AS
SELECT id, bounty_id AS old_bounty_id
FROM public.bounty_deadline_extensions;

CREATE TABLE public.ns_p47_migration_map_bounty_author_review AS
SELECT id, bounty_id AS old_bounty_id
FROM public.bounty_author_review;

-- No surrogate key on this one: its primary key IS (bounty_id, user_id), and
-- bounty_id is the column being rewritten. The map is therefore keyed on the
-- pair as it was, which is what identifies the row before the UPDATE and what
-- the reversal above joins back through the mapping.
CREATE TABLE public.ns_p47_migration_map_bounty_comment_last_read AS
SELECT bounty_id AS old_bounty_id, user_id
FROM public.bounty_comment_last_read;

-- CREATE TABLE AS makes no key. Each primary key is what makes the rollback
-- UPDATE an index lookup rather than a nested loop over a sequential scan, and
-- it asserts one map row per source row while the table is written.
ALTER TABLE public.ns_p47_migration_map_bounty_discussion_comments
  ADD CONSTRAINT ns_p47_migration_map_bounty_discussion_comments_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p47_migration_map_bounty_deadline_extensions
  ADD CONSTRAINT ns_p47_migration_map_bounty_deadline_extensions_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p47_migration_map_bounty_author_review
  ADD CONSTRAINT ns_p47_migration_map_bounty_author_review_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p47_migration_map_bounty_comment_last_read
  ADD CONSTRAINT ns_p47_migration_map_bounty_comment_last_read_pkey PRIMARY KEY (old_bounty_id, user_id);

-- Operator tables, not product tables, exactly as NS-P46's are. They sit in
-- public because that is where the tables they mirror sit and a rollback should
-- not have to hunt for them — which means PostgREST exposes them and Supabase's
-- default grants reach them. RLS with no policy at all denies every role that
-- goes through the API; the service role bypasses RLS, so an operator can still
-- read them. The REVOKE is belt and braces: RLS already denies, and a future
-- policy written in haste should still find no privilege behind it.
ALTER TABLE public.ns_p47_migration_map_bounty_discussion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p47_migration_map_bounty_deadline_extensions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p47_migration_map_bounty_author_review        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p47_migration_map_bounty_comment_last_read    ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ns_p47_migration_map_bounty_discussion_comments FROM anon, authenticated;
REVOKE ALL ON public.ns_p47_migration_map_bounty_deadline_extensions  FROM anon, authenticated;
REVOKE ALL ON public.ns_p47_migration_map_bounty_author_review        FROM anon, authenticated;
REVOKE ALL ON public.ns_p47_migration_map_bounty_comment_last_read    FROM anon, authenticated;

COMMENT ON TABLE public.ns_p47_migration_map_bounty_discussion_comments IS
  'NS-P47 rollback net: bounty_discussion_comments.id -> the content_items id its bounty_id held before the repoint. No RLS policy, on purpose — operator access only. Kept until NS-P56 signs off; see docs/retired-surfaces.md.';
COMMENT ON TABLE public.ns_p47_migration_map_bounty_deadline_extensions IS
  'NS-P47 rollback net: bounty_deadline_extensions.id -> the content_items id its bounty_id held before the repoint. Operator access only. Kept until NS-P56.';
COMMENT ON TABLE public.ns_p47_migration_map_bounty_author_review IS
  'NS-P47 rollback net: bounty_author_review.id -> the content_items id its bounty_id held before the repoint. Operator access only. Kept until NS-P56.';
COMMENT ON TABLE public.ns_p47_migration_map_bounty_comment_last_read IS
  'NS-P47 rollback net: (old_bounty_id, user_id) for every read mark, keyed on the pair as it was because this table has no surrogate key. Operator access only. Kept until NS-P56.';


-- =============================================================================
-- 3. The shim columns — what keeps the legacy read path alive
-- =============================================================================
-- The legacy bounty page routes on a content_items id. src/pages/ContentDetail
-- .tsx passes `post.id` — that id — as `bountyId` into every one of these
-- readers, and each of them filters a satellite on it. After section 6 that id
-- is not in bounty_id any more.
--
-- A SHIM GOES WHERE A CLIENT QUERY FILTERS BY THE OLD ID, and all four of these
-- tables have one. Grepped per table across src/lib/bounty-solver/ and
-- src/lib/bounty-competition/ (the bounty data layer; src/components/bounty*/
-- holds no query of its own — every component reaches these tables through
-- those modules):
--
--   bounty_discussion_comments   getDiscussionThread (the thread itself),
--                                getBountyAnalytics (discussion engagement,
--                                top commenters), extendBountyDeadline (the
--                                notification fan-out), and realtime.ts's
--                                `bounty_id=eq.${bountyId}` channel filter
--   bounty_comment_last_read     getDiscussionThread (the unread marker)
--   bounty_deadline_extensions   getBountyAnalytics (the extension timeline)
--   bounty_author_review         getBountyAnalytics (which solutions are
--                                already triaged)
--
-- The realtime filter is the one that settles the design. A Postgres changes
-- filter is a single column comparison evaluated by the replication stream — it
-- cannot join, so there is no version of it that resolves an id through
-- bounties. Either the old id is on the row or the legacy thread stops
-- updating live. It is on the row.
--
-- NOT AUTHORED BY ANY CLIENT. Section 9 derives each one from bounty_id on
-- every write, so it cannot drift from the mapping and a client cannot hang a
-- comment on a bounty page it does not belong to by writing the wrong value.
--
-- ON DELETE SET NULL rather than CASCADE, for NS-P46's reason: deleting a
-- content item already removes these rows the long way round — content_items ->
-- bounties (legacy_item_id, CASCADE) -> here (bounty_id, CASCADE) — and a
-- second, shorter delete path for the same event would be a way for the two to
-- disagree, not a safety net.
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

COMMENT ON COLUMN public.bounty_discussion_comments.legacy_bounty_item_id IS
  'NS-P47 shim. The content_items id this comment''s bounty_id held before the repoint, derived from bounties.legacy_item_id by trg_bdc_legacy_bounty_item on every write. NULL for a bounty that lives on a build. The legacy bounty page reads the thread by this column and subscribes to it by this column; NS-P50 rewires those readers and drops it.';
COMMENT ON COLUMN public.bounty_comment_last_read.legacy_bounty_item_id IS
  'NS-P47 shim. As bounty_discussion_comments.legacy_bounty_item_id. Read by getDiscussionThread to find the viewer''s read mark. NS-P50 drops it.';
COMMENT ON COLUMN public.bounty_deadline_extensions.legacy_bounty_item_id IS
  'NS-P47 shim. As bounty_discussion_comments.legacy_bounty_item_id. Read by getBountyAnalytics for the extension timeline. NS-P50 drops it.';
COMMENT ON COLUMN public.bounty_author_review.legacy_bounty_item_id IS
  'NS-P47 shim. As bounty_discussion_comments.legacy_bounty_item_id. Read by getBountyAnalytics to skip solutions the author has already triaged. NS-P50 drops it.';

-- Each shim index mirrors the index that serves the same query on the column it
-- stands in for, so the legacy read path keeps the plan it had:
--
--   idx_bdc_bounty_created is (bounty_id, created_at) and getDiscussionThread
--   orders by created_at, so the shim gets the pair too.
--
--   bounty_comment_last_read's primary key is (bounty_id, user_id) and the read
--   filters on both, so the shim gets the pair.
--
--   bounty_author_review is read as (bounty_id, author_id) and the shim gets
--   that pair — see section 8 for the matching index on the real column, which
--   this table has never had.
--
-- All four are partial: a build-backed row has no legacy id and has no business
-- in an index that only ever answers an equality lookup.
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


-- =============================================================================
-- 4. Populate the shims, while bounty_id still holds the id they are a copy of
-- =============================================================================
-- Before the repoint the two are the same value, so this is a straight copy and
-- needs no join. It runs before section 6 for exactly that reason.
--
-- The two updated_at triggers go off first and come back on in section 6. A
-- migration that rewrites a foreign key has no business claiming every comment
-- on the platform was edited today, and this is the first write that would.
ALTER TABLE public.bounty_discussion_comments DISABLE TRIGGER trg_bdc_updated_at;
ALTER TABLE public.bounty_author_review DISABLE TRIGGER trg_bounty_author_review_updated;

UPDATE public.bounty_discussion_comments SET legacy_bounty_item_id = bounty_id;
UPDATE public.bounty_comment_last_read   SET legacy_bounty_item_id = bounty_id;
UPDATE public.bounty_deadline_extensions SET legacy_bounty_item_id = bounty_id;
UPDATE public.bounty_author_review       SET legacy_bounty_item_id = bounty_id;


-- =============================================================================
-- 5. The old foreign keys come off
-- =============================================================================
-- Found by shape rather than by name, for NS-P46's reason: the names are almost
-- certainly the ones Postgres generated — bounty_discussion_comments_bounty_id
-- _fkey and its three siblings — but a constraint that was ever dropped and
-- re-added by hand carries whatever name that hand chose, and a migration that
-- hard-codes a name fails on the database that needs it most. The lookup is
-- exact: the one foreign key on this table whose single column is bounty_id and
-- whose target is content_items.
--
-- The delete action each one carried is read and asserted on the way past. All
-- four are expected to be 'c' — CASCADE — and section 8 re-adds them that way;
-- an unexpected action means the table is not the shape this migration was
-- written against and re-adding CASCADE would silently change what a delete
-- does.
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
      RAISE EXCEPTION 'NS-P47: no bounty_id -> content_items foreign key found on %', _tbl
        USING HINT = 'Preflight passed, so the table exists. Its foreign key is not the shape this migration was written against.';
    END IF;

    IF _action <> 'c' THEN
      RAISE EXCEPTION
        'NS-P47: % carried ON DELETE % on bounty_id, not CASCADE', _tbl, _action
        USING HINT = 'Section 8 re-adds CASCADE. Preserve the action this table actually had instead.';
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', _tbl, _name);
    RAISE NOTICE 'NS-P47: dropped % on % (was ON DELETE CASCADE)', _name, _tbl;
  END LOOP;
END $$;


-- =============================================================================
-- 6. The repoint
-- =============================================================================
-- One UPDATE per table, joined on the mapping. Rows whose bounty_id has no
-- header are not silently skipped — section 1 proved there are none, and
-- section 7 proves it again from the other side once the writes have happened.
--
-- bounty_comment_last_read is a primary key update: its key is
-- (bounty_id, user_id) and bounty_id is what moves. That is safe because the
-- mapping is injective — idx_bounties_legacy_item_unique makes one header per
-- legacy item a fact — so two read marks cannot collide on the way through.
-- Section 7 checks the row count anyway, which is what would catch it if that
-- ever stopped being true.
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


-- =============================================================================
-- 7. The repoint assertion
-- =============================================================================
-- Three facts per table, checked from the data rather than assumed from the
-- statements above: no row was lost, no row was gained, and every bounty_id now
-- names a bounties row. The counts are compared against the map tables written
-- in section 2 — they were written before the UPDATEs and are the only record
-- of what "unchanged" means.
--
-- The fourth fact is the one a wrong answer hides behind: the shim has to agree
-- with the mapping on every row, or the legacy page reads another bounty's
-- discussion — a silent wrong answer, which is worse than an error. Checked
-- here once for the rows this migration wrote; section 9 keeps it true for
-- every row written after it.
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

    RAISE NOTICE 'NS-P47: public.% — % rows repointed at public.bounties, shim agrees on all of them', _tbl, _now;
  END LOOP;
END $$;


-- =============================================================================
-- 8. The new foreign keys
-- =============================================================================
-- All four CASCADE, which is the action all four carried against content_items
-- and which section 5 asserted before dropping them. The chain that action now
-- sits in is worth stating: content_items -> bounties is ON DELETE CASCADE
-- (NS-P45), and bounties -> each of these is ON DELETE CASCADE, so deleting a
-- legacy content item still takes its discussion, its read marks, its deadline
-- extensions and its private review notes with it, exactly as it did when these
-- tables pointed at content_items directly.
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

-- Three of the four already index bounty_id and stay indexed:
-- idx_bdc_bounty_created leads with it, bounty_comment_last_read's primary key
-- leads with it, and idx_deadline_extensions_bounty is a plain index on it.
--
-- bounty_author_review has never had one. Its only index is the UNIQUE
-- (solution_id, author_id) from May, which cannot serve a bounty_id lookup, so
-- until now every read of an author's triage list sequentially scanned the
-- table — and after this migration every cascade from bounties would too.
-- Postgres does not index a foreign key for you. The pair is the shape
-- getBountyAnalytics asks for (bounty_id AND author_id) and its leading column
-- is what the cascade needs, so one index serves both.
CREATE INDEX idx_bounty_author_review_bounty
  ON public.bounty_author_review (bounty_id, author_id);


-- =============================================================================
-- 9. The shims stay true — derived, never authored
-- =============================================================================
-- NS-P46 wrote this rule as a function: whatever bounty_id points at,
-- legacy_bounty_item_id is that bounty's legacy_item_id. It reads NEW.bounty_id
-- and writes NEW.legacy_bounty_item_id and can do nothing else, which is what
-- made it safe to attach to two tables then and to four more now.
--
-- REUSED RATHER THAN COPIED. public.set_legacy_bounty_item_id() is already
-- SECURITY DEFINER with search_path pinned empty, every reference
-- schema-qualified, and EXECUTE revoked from PUBLIC, anon and authenticated;
-- section 1 asserts it is there. A second function with the same body would be
-- a second place for the rule to drift, and NS-P50 would have two things to
-- drop instead of one. The column names are the contract, and all four tables
-- now use NS-P46's names for exactly that reason.
--
-- UPDATE OF bounty_id, not UPDATE, on all four: the derived value can only
-- change when bounty_id changes. On bounty_discussion_comments that also keeps
-- the trigger off the edit path — a comment edited within its five-minute
-- window updates body, not bounty_id, and has no reason to re-resolve a value
-- that cannot have moved.
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

COMMENT ON FUNCTION public.set_legacy_bounty_item_id() IS
  'NS-P46 shim, extended by NS-P47. Keeps legacy_bounty_item_id equal to the bounty''s legacy_item_id on solutions, solution_acceptance_log, bounty_discussion_comments, bounty_comment_last_read, bounty_deadline_extensions and bounty_author_review. Dropped with the columns in NS-P50.';


-- =============================================================================
-- 10. Row level security, restated through bounties
-- =============================================================================
-- Four policies below asked content_items a question about a bounty_id that is
-- not a content_items id any more. Each would have silently answered "no row"
-- for every row on the platform, which is the worst of the available failures:
-- the legacy thread would render empty rather than error, and the two author
-- policies would refuse a write that ought to succeed. They are rewritten to
-- ask bounties, which knows both kinds of home, so the same question is
-- answered for a legacy bounty and for one on a build.
--
-- The rest are rewritten only for the wrapped call. They never named
-- content_items, so the repoint does not reach them, but they are evaluated for
-- every row of every read of these tables and the bare form re-evaluates
-- auth.uid() for each of them. (select auth.uid()) throughout, never bare
-- auth.uid().
--
-- NOTHING HERE CHANGES WHO CAN DO WHAT. Each rewrite is the old predicate with
-- content_items reached through bounties instead of directly, and
-- bounties.author_id is the backfilled copy of content_items.creator_id for
-- every legacy row, so the two name the same people. Where a policy was loose
-- it stays loose — see the note on the discussion INSERT policy below.
-- Tightening one would be a behaviour change dressed as a rewrite, on a live
-- surface, in the migration that moves its foreign key.

-- --- bounty_discussion_comments ---------------------------------------------
-- The one that breaks. It asked whether the bounty_id is an approved
-- content_items row; it now asks bounties, and restates each home's own
-- visibility underneath — the pattern NS-P45 used against builds and NS-P46
-- used here. The EXISTS on bounties is itself subject to the bounties SELECT
-- policy, so the two agree by construction, and a reader of this file can see
-- what "published" means without opening two other migrations.
--
-- Note what is NOT added: a bounty author reading the discussion on their own
-- unapproved bounty. The old policy did not allow it (it required
-- ci.status = 'approved' of everyone, the author included) and this one does
-- not either.
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

-- Unchanged in meaning, rewritten for the wrapped call. This policy checks the
-- author and nothing else — it has never asked whether the bounty being posted
-- to is readable, and it still does not. What changed underneath it is that the
-- foreign key added in section 8 now makes a post to a bounty_id that is not a
-- bounty impossible, where before it only had to be a content item.
DROP POLICY IF EXISTS "Authenticated can post discussion" ON public.bounty_discussion_comments;
CREATE POLICY "Authenticated can post discussion"
  ON public.bounty_discussion_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = (select auth.uid()));

-- No WITH CHECK, exactly as before: for UPDATE, Postgres reuses the USING
-- expression when WITH CHECK is absent. Adding one would be a behaviour change
-- dressed as a rewrite.
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

-- --- bounty_comment_last_read -----------------------------------------------
-- Never named content_items: a read mark is private to the person who made it
-- and the policy says so and nothing else. Rewritten for the wrapped call only.
DROP POLICY IF EXISTS "User manages own last_read" ON public.bounty_comment_last_read;
CREATE POLICY "User manages own last_read"
  ON public.bounty_comment_last_read FOR ALL TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- --- bounty_deadline_extensions ---------------------------------------------
-- "Public can read deadline extensions" is USING (true). It names no table and
-- no user, so the repoint does not reach it and there is nothing in it to
-- rewrite; it is left exactly as it was. It is worth NS-P50 knowing that a
-- public log will start carrying rows about bounties on unpublished builds once
-- the new path writes to it — the same note NS-P46 left on the acceptance log.
--
-- The INSERT policy is the one that breaks: it resolved the author through
-- content_items by the id in bounty_id, and would have refused every extension
-- after the repoint.
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

-- --- bounty_author_review ---------------------------------------------------
-- Both halves of the old predicate are preserved: you wrote the review entry,
-- AND you own the bounty it is filed against. The second half is what read
-- content_items and what now reads bounties.
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

-- These two never named content_items — a review entry is private to its
-- author, and the author is the only person who may change or remove it.
-- Rewritten for the wrapped call only. markSolutionReviewStatus upserts on
-- (solution_id, author_id), so a repeat triage takes the ON CONFLICT DO UPDATE
-- path and is checked by this policy's USING and by the INSERT policy's
-- WITH CHECK above; both answer the same question about the same person.
DROP POLICY IF EXISTS "Author can update own review entries" ON public.bounty_author_review;
CREATE POLICY "Author can update own review entries"
  ON public.bounty_author_review FOR UPDATE TO authenticated
  USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Author can delete own review entries" ON public.bounty_author_review;
CREATE POLICY "Author can delete own review entries"
  ON public.bounty_author_review FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()));

-- --- bounty_comment_reactions: untouched, and why ---------------------------
-- Its three policies are "Public view comment reactions" USING (true), and an
-- insert and a delete keyed on reactor_id. None names content_items, none names
-- a bounty, and the table's only foreign key is comment_id, which this
-- migration does not move. There is nothing in it the repoint reaches.
--
-- What it inherits is worth writing down for NS-P50: a reaction is visible to
-- anyone, including a reaction on a comment that is not, because the SELECT
-- policy is USING (true) and does not join the comment. That was true before
-- this migration and is true after it. Rewriting it here would be a behaviour
-- change on a live surface in a migration that moves foreign keys, and it is
-- not this prompt's to make — but it is a real gap and NS-P50 should close it
-- when it rewires these tables.


-- =============================================================================
-- 11. The me-too counter — a dual-write, where there is anything to write
-- =============================================================================
-- WHAT bounty_me_too IS, AND WHY ITS FOREIGN KEY DOES NOT MOVE HERE. It is a
-- generation-1 table (March, 20260323000001_bounty_system.sql), and the rule
-- this series recorded in docs/retired-surfaces.md — "The rule NS-P45 through
-- NS-P49 must follow" — is that generation-1 tables are not repointed, not
-- dropped, and may not have a foreign key added to them by any of these
-- prompts. Its content_id keeps pointing at content_items, and it rides with
-- the frozen legacy read path until the operator retires content_items
-- entirely, which is the same decision that retires it.
--
-- It is also not on the database. NS-P44 measured bounty_me_too answering
-- PGRST205 against the project in supabase/config.toml, with an invented table
-- name run as a control answering identically, and content_items
-- .bounty_me_too_count answering 42703 from the planner. Nothing in
-- supabase/migrations/ drops either, so the March migration was authored and
-- never applied. On that database this whole section is a no-op that says so.
--
-- WHAT IS DONE ANYWAY, AND WHY IT IS NOT A REPOINT. The counter function is
-- replaced so that it maintains BOTH counters from the one me-too write:
-- content_items.bounty_me_too_count exactly as before, and bounties
-- .me_too_count in addition, resolved through bounties.legacy_item_id — the
-- same mapping every repoint in this file reads. No column changes, no
-- constraint is added to bounty_me_too, and its trigger keeps the shape it had
-- (AFTER INSERT OR DELETE, statement-level result discarded).
--
-- THIS IS A DUAL-WRITE AND IT IS DELIBERATE. Both counters are maintained from
-- the same statement and both stay correct. The content_items counter is the
-- one the legacy surfaces read — BountyCard.tsx, the me-too sort in Browse.tsx
-- and Discover.legacy.tsx — and it is not retired here. NS-P54 retires it, and
-- until it does, a me-too write moves two numbers on purpose. Reading either
-- gives the same answer because both are recomputed from the same COUNT(*)
-- rather than incremented, so they cannot drift apart even if one write is
-- replayed.
--
-- The rewrite also pins search_path, which the March function did not do. It is
-- SECURITY DEFINER, so an unpinned search_path lets any caller's path decide
-- which content_items it writes to; every reference in it was already
-- schema-qualified, so pinning changes nothing about what it does and closes
-- that door.
DO $do$
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL THEN
    RAISE NOTICE 'NS-P47: public.bounty_me_too is absent (generation 1, authored March 2026, never applied) — no counter to dual-write, nothing installed.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.content_items'::regclass
      AND attname = 'bounty_me_too_count'
      AND NOT attisdropped
  ) THEN
    RAISE WARNING 'NS-P47: public.bounty_me_too exists but content_items.bounty_me_too_count does not. The generation-1 counter trigger is already broken on this database; NS-P47 leaves it alone rather than papering over it.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bounty_me_too'::regclass
      AND tgname = 'trg_update_bounty_me_too_count'
      AND NOT tgisinternal
  ) THEN
    RAISE WARNING 'NS-P47: trg_update_bounty_me_too_count is not on public.bounty_me_too. Replacing the function would maintain nothing, so NS-P47 leaves it alone.';
    RETURN;
  END IF;

  -- CREATE OR REPLACE, so the existing trigger keeps firing and picks the new
  -- body up on its next call. The trigger itself is not touched.
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

      -- Counted once and written twice. Recomputed rather than incremented, so
      -- a replayed write cannot drift either counter away from the truth.
      SELECT count(*) INTO _count
      FROM public.bounty_me_too
      WHERE content_id = _content_id;

      -- THE LEGACY HALF, unchanged from March. Read by BountyCard.tsx and the
      -- me-too sorts. Retired by NS-P54, not here.
      UPDATE public.content_items
      SET bounty_me_too_count = _count
      WHERE id = _content_id;

      -- THE NEW HALF. Resolved through the NS-P45 mapping, which is why this
      -- needs no foreign key on bounty_me_too: the join is one-directional and
      -- a legacy item with no header simply matches no row.
      UPDATE public.bounties
      SET me_too_count = _count
      WHERE legacy_item_id = _content_id;

      RETURN NULL;
    END;
    $fn$;
  $ddl$;

  -- The function is SECURITY DEFINER and now writes a second table, so the
  -- privilege on it is worth being conservative with. A function RETURNING
  -- trigger cannot be called directly, so this closes no hole that is open
  -- today; it is here so a later refactor that gives it a callable signature
  -- does not inherit EXECUTE from PUBLIC silently. Trigger firing does not
  -- consult EXECUTE, so the trigger above is unaffected.
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_bounty_me_too_count() FROM PUBLIC, anon, authenticated';

  EXECUTE $c$
    COMMENT ON FUNCTION public.update_bounty_me_too_count() IS
      'NS-P47 dual-write. Maintains content_items.bounty_me_too_count (generation 1, read by the legacy surfaces, retired by NS-P54) AND bounties.me_too_count (resolved through bounties.legacy_item_id) from the same me-too write. Both are recomputed from COUNT(*), so they cannot drift. bounty_me_too itself is NOT repointed — it is a generation-1 table and docs/retired-surfaces.md forbids NS-P45-P49 from adding a foreign key to it.'
  $c$;

  -- Bring bounties.me_too_count into line with whatever generation 1 already
  -- holds, so the new counter does not sit at the NS-P45 backfill's value until
  -- the next me-too. On the database this migration is written for there are no
  -- rows and this updates nothing.
  UPDATE public.bounties b
  SET me_too_count = c.n
  FROM (
    SELECT content_id, count(*)::INTEGER AS n
    FROM public.bounty_me_too
    GROUP BY content_id
  ) c
  WHERE b.legacy_item_id = c.content_id
    AND b.me_too_count IS DISTINCT FROM c.n;

  RAISE NOTICE 'NS-P47: me-too counter now dual-writes content_items.bounty_me_too_count and bounties.me_too_count; bounty_me_too itself is unchanged and still keys content_items.';
END
$do$;


-- =============================================================================
-- 12. What NS-P50 inherits
-- =============================================================================
-- Four shim columns, all named legacy_bounty_item_id, all derived by
-- public.set_legacy_bounty_item_id(), all indexed partially, all read by the
-- legacy bounty page and by nothing else. With NS-P46's two that is six columns
-- on six tables and one function to drop together.
--
-- The four map tables in section 2 join NS-P46's two and are kept until NS-P56
-- signs off.
DO $$
BEGIN
  RAISE NOTICE 'NS-P47 complete: bounty_discussion_comments, bounty_comment_last_read, bounty_deadline_extensions and bounty_author_review now key public.bounties. bounty_comment_reactions reaches a bounty through a comment and was not repointed. bounty_me_too is generation 1 and was not repointed.';
END $$;
