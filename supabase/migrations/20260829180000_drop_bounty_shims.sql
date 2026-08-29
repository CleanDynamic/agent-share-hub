-- =============================================================================
-- NeoScale — dropping the NS-P46, NS-P47 and NS-P48 shim columns (NS-P50)
-- =============================================================================
-- Eight columns, eight indexes, seven triggers and two functions. No table is
-- created or dropped, no foreign key that carries data moves, and no policy
-- changes: everything here exists only because a repoint had to be reversible
-- and a live page had to keep working while it was.
--
-- WHAT A SHIM COLUMN WAS. A legacy bounty page routes on a content_items id.
-- NS-P46 through NS-P48 moved every satellite's bounty_id onto public.bounties,
-- so a read starting from that route param would have matched nothing — which
-- looks exactly like a bounty nobody has answered, not like a bug. Each of
-- those migrations added a derived column carrying the old id, kept equal to
-- bounties.legacy_item_id by a trigger, and moved the affected reads onto it.
--
-- WHY THEY GO NOW. The mapping they duplicate is one indexed lookup away, in
-- the column it belongs to. Every reader was rewired onto it in the commit
-- before this one — resolveBountyByLegacyItem in src/lib/bounty/resolveLegacy
-- .ts, memoised per session — so what is left is a derived copy of a fact,
-- maintained by six triggers on the write path of every solution, comment,
-- read mark, extension and triage note in the product, and read by nothing.
-- A second place a fact can live is a second place it can be wrong.
--
-- WHAT STAYS, AND UNTIL WHEN.
--   * The seven ns_p4*_migration_map_* tables. They are the only record of the
--     pre-repoint values and the input to every rollback; docs/retired-
--     surfaces.md keeps them until NS-P56 signs off. Dropping them is a
--     different decision from dropping these columns, and this migration does
--     not take it.
--   * trg_mbsd_freeze_to_legacy and assert_meta_sub_definition_is_legacy().
--     NS-P48 said it plainly: the freeze is the decision, not the scaffolding.
--     A sub-definition still may not be filed against a bounty on a build.
--   * Every bounty_* column on content_items, and the whole legacy read path.
--     Unchanged, per the rule NS-P44 recorded.
--
-- WHAT THIS COSTS. One extra round trip, once per session per legacy bounty,
-- on the first read of its page. That is the honest price of not keeping a
-- derived column, and it is paid on a path that is being retired.
--
-- WHAT ROLLBACK LOOKS LIKE AFTER THIS. The rollbacks in section 2 of the three
-- repoint migrations read the map tables, not these columns, so they are
-- unaffected. Re-creating the shims themselves means re-running the relevant
-- section of the migration that added them — section 3 of NS-P46, section 4 of
-- NS-P47, section 3 of NS-P48 — each of which is written to be re-runnable and
-- re-derives every value from bounties.legacy_item_id.
-- =============================================================================


-- =============================================================================
-- 1. Preflight — the last moment the derived values can be checked
-- =============================================================================
-- Every shim column should equal its bounty's legacy_item_id. If one does not,
-- something wrote it directly and the triggers did not win, which is worth
-- knowing BEFORE the evidence is dropped rather than after. This aborts the
-- migration and names the table.
--
-- Skipped per table when the column is already absent, so a re-run of this
-- migration is a no-op rather than a failure.
DO $$
DECLARE
  _tbl  TEXT;
  _bad  INTEGER;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'solutions',
    'solution_acceptance_log',
    'bounty_discussion_comments',
    'bounty_comment_last_read',
    'bounty_deadline_extensions',
    'bounty_author_review'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = ('public.' || _tbl)::regclass
        AND attname = 'legacy_bounty_item_id'
        AND NOT attisdropped
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I t
         JOIN public.bounties b ON b.id = t.bounty_id
        WHERE t.legacy_bounty_item_id IS DISTINCT FROM b.legacy_item_id', _tbl)
      INTO _bad;

    IF _bad > 0 THEN
      RAISE EXCEPTION
        'NS-P50 preflight: % rows in public.% disagree with their bounty; investigate before the column is dropped', _bad, _tbl;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.meta_bounty_sub_definitions'::regclass
      AND attname = 'legacy_meta_item_id'
      AND NOT attisdropped
  ) THEN
    SELECT count(*) INTO _bad
    FROM public.meta_bounty_sub_definitions s
    JOIN public.bounties bm ON bm.id = s.meta_bounty_id
    LEFT JOIN public.bounties bs ON bs.id = s.spawned_bounty_id
    WHERE s.legacy_meta_item_id    IS DISTINCT FROM bm.legacy_item_id
       OR s.legacy_spawned_item_id IS DISTINCT FROM bs.legacy_item_id;

    IF _bad > 0 THEN
      RAISE EXCEPTION
        'NS-P50 preflight: % meta_bounty_sub_definitions rows disagree with their bounties', _bad;
    END IF;
  END IF;

  RAISE NOTICE 'NS-P50: shim values agree with their bounties; dropping';
END $$;


-- =============================================================================
-- 2. The derivation triggers
-- =============================================================================
-- Dropped BEFORE the columns, not with them. A trigger whose function writes a
-- column that no longer exists fails at the next write to the table, and the
-- window between the two statements is inside this transaction — but the order
-- is also what makes each step legible on its own, and it is the order the
-- three repoint migrations wrote down for their own rollbacks.
DROP TRIGGER IF EXISTS trg_solutions_legacy_bounty_item ON public.solutions;
DROP TRIGGER IF EXISTS trg_sal_legacy_bounty_item       ON public.solution_acceptance_log;
DROP TRIGGER IF EXISTS trg_bdc_legacy_bounty_item       ON public.bounty_discussion_comments;
DROP TRIGGER IF EXISTS trg_bclr_legacy_bounty_item      ON public.bounty_comment_last_read;
DROP TRIGGER IF EXISTS trg_bde_legacy_bounty_item       ON public.bounty_deadline_extensions;
DROP TRIGGER IF EXISTS trg_bar_legacy_bounty_item       ON public.bounty_author_review;
DROP TRIGGER IF EXISTS trg_mbsd_legacy_item_ids         ON public.meta_bounty_sub_definitions;

-- trg_mbsd_freeze_to_legacy is NOT dropped. It shares a table with the trigger
-- above and nothing else: it enforces NS-P48's decision that a sub-definition
-- may only be filed against a legacy bounty, and it reads
-- bounties.legacy_item_id directly rather than either shim column.


-- =============================================================================
-- 3. The derivation functions
-- =============================================================================
-- Only reachable through the triggers above, which are gone, so these are
-- unreferenced by the time they are dropped. No CASCADE: if either one still
-- has a dependent this should fail loudly rather than take it along.
DROP FUNCTION IF EXISTS public.set_legacy_bounty_item_id();
DROP FUNCTION IF EXISTS public.set_meta_sub_legacy_item_ids();


-- =============================================================================
-- 4. The indexes
-- =============================================================================
-- Postgres drops an index with its column, so these eight statements change
-- nothing on their own. They are here because an index that outlives its
-- column is the kind of thing that is silently wrong, and naming each one makes
-- the drop list checkable against the three migrations that created them.
DROP INDEX IF EXISTS public.idx_solutions_legacy_bounty_item;
DROP INDEX IF EXISTS public.idx_sal_legacy_bounty_item;
DROP INDEX IF EXISTS public.idx_bdc_legacy_bounty_item;
DROP INDEX IF EXISTS public.idx_bclr_legacy_bounty_item;
DROP INDEX IF EXISTS public.idx_bde_legacy_bounty_item;
DROP INDEX IF EXISTS public.idx_bar_legacy_bounty_item;
DROP INDEX IF EXISTS public.idx_mbsd_legacy_meta_item;
DROP INDEX IF EXISTS public.idx_mbsd_legacy_spawned_item;


-- =============================================================================
-- 5. The columns
-- =============================================================================
-- Plain DROP COLUMN, never CASCADE. Each column carries a foreign key to
-- content_items and the indexes above, and Postgres removes both with the
-- column; anything ELSE that depends on one — a view, a generated column, a
-- policy written after this file — should abort this migration rather than be
-- dropped without being named. Nothing in this repository is such a dependent:
-- no policy in any migration references a shim column, and there are no views
-- over these tables.
ALTER TABLE public.solutions                   DROP COLUMN IF EXISTS legacy_bounty_item_id;
ALTER TABLE public.solution_acceptance_log     DROP COLUMN IF EXISTS legacy_bounty_item_id;
ALTER TABLE public.bounty_discussion_comments  DROP COLUMN IF EXISTS legacy_bounty_item_id;
ALTER TABLE public.bounty_comment_last_read    DROP COLUMN IF EXISTS legacy_bounty_item_id;
ALTER TABLE public.bounty_deadline_extensions  DROP COLUMN IF EXISTS legacy_bounty_item_id;
ALTER TABLE public.bounty_author_review        DROP COLUMN IF EXISTS legacy_bounty_item_id;

ALTER TABLE public.meta_bounty_sub_definitions DROP COLUMN IF EXISTS legacy_meta_item_id;
ALTER TABLE public.meta_bounty_sub_definitions DROP COLUMN IF EXISTS legacy_spawned_item_id;


-- =============================================================================
-- 6. The table comments that promised these columns
-- =============================================================================
-- NS-P48 left a comment on meta_bounty_sub_definitions describing the shape it
-- had then. The freeze half of it is still true and is restated; the shim half
-- is not, and a comment that describes columns that are gone is worse than no
-- comment.
COMMENT ON TABLE public.meta_bounty_sub_definitions IS
  'LEGACY, READ-ONLY FORWARD (NS-P48). One row per sub-bounty of a generation-2 meta bounty. Both id columns hold public.bounties ids, and no row may be filed against a bounty that lives on a build — under the record model that shape is a gap node (build_nodes.is_gap) with its own bounties header, not a row here. Existing rows stay readable, editable and deletable by their meta''s author. NS-P50 dropped the two legacy_*_item_id shims: a caller that needs the content_items id resolves it from bounties.legacy_item_id.';


-- =============================================================================
-- 7. The assertion
-- =============================================================================
-- Everything named above is gone, and the two objects that share their tables
-- are not. A migration that half-applied would otherwise be discovered by the
-- next write to solutions rather than here.
DO $$
DECLARE
  _left INTEGER;
BEGIN
  SELECT count(*) INTO _left
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT a.attisdropped
    AND a.attname IN ('legacy_bounty_item_id', 'legacy_meta_item_id', 'legacy_spawned_item_id');
  IF _left > 0 THEN
    RAISE EXCEPTION 'NS-P50: % shim column(s) survived the drop', _left;
  END IF;

  SELECT count(*) INTO _left
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('set_legacy_bounty_item_id', 'set_meta_sub_legacy_item_ids');
  IF _left > 0 THEN
    RAISE EXCEPTION 'NS-P50: % derivation function(s) survived the drop', _left;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_mbsd_freeze_to_legacy' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'NS-P50: trg_mbsd_freeze_to_legacy is missing — the NS-P48 freeze is not scaffolding and must survive this migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'ns_p46_migration_map_solutions'
  ) THEN
    RAISE EXCEPTION
      'NS-P50: the NS-P46 rollback map is missing — the map tables stay until NS-P56';
  END IF;

  RAISE NOTICE 'NS-P50: eight shim columns, seven triggers and two functions dropped; the maps and the freeze remain';
END $$;
