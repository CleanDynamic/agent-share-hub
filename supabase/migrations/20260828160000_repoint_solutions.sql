-- =============================================================================
-- NeoScale — solutions and the acceptance log repointed at bounties (NS-P46)
-- =============================================================================
-- One transaction. Two populated tables change what their bounty_id MEANS: it
-- stops being a content_items id and becomes a public.bounties id, resolved
-- through the legacy_item_id mapping NS-P45's backfill wrote.
--
-- Nothing is deleted, and the old value of every repointed row is kept — see
-- section 2. The legacy read path stays alive: a shim column carries the
-- content_items id each row used to hold, so a legacy bounty page can still
-- find its solutions by the id in its route. NS-P50 rewires those readers and
-- drops the shim; until then it is load-bearing, and every client-side use of
-- it is flagged `// NS-P46 shim` so that removal is a grep, not an audit.
--
-- WHY THE ORDER IN THIS FILE IS THE ORDER IT IS
-- Three things must happen before the repointing UPDATE can run at all, and
-- each of them would abort it if left in place:
--   * trg_validate_solution_bounty asks content_items whether the NEW bounty_id
--     is a post_type='bounty' row. After the UPDATE it is a bounties id, so the
--     trigger would reject every row it is asked about. Dropped first (§5).
--   * solutions_bounty_id_fkey points at content_items. The new value is not a
--     content_items id, so the constraint would reject every row. Dropped
--     before the UPDATE, re-added afterwards against bounties (§6, §9).
--   * trg_solutions_updated_at stamps now() on every UPDATE. A migration that
--     rewrites a foreign key has no business claiming every solution on the
--     platform was edited today. Switched off around the writes (§4, §7).
--
-- ONE TRANSACTION. There is no BEGIN in this file, for the same reason there is
-- none in any other migration in this directory: the Supabase CLI applies a
-- migration inside a transaction of its own, and a nested BEGIN here would
-- commit that outer transaction early rather than open a new one. Applied by
-- hand it needs psql --single-transaction. Atomicity is not optional — a
-- half-applied repoint leaves solutions pointing at content_items ids with no
-- foreign key behind them.
--
-- LOCK SCOPE. Every ALTER TABLE here takes ACCESS EXCLUSIVE on solutions or
-- solution_acceptance_log for the length of the transaction, and ADD FOREIGN
-- KEY additionally scans the table it constrains. That is acceptable because
-- both tables are small (tens of rows on the live project, and this is a
-- one-shot deploy-time migration, not a routine write). It is stated rather
-- than assumed: if either table is ever in the millions before this runs, the
-- FK additions in §9 want ADD CONSTRAINT ... NOT VALID followed by a separate
-- VALIDATE CONSTRAINT in its own transaction, which takes a weaker lock.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
-- solution_votes and solution_comments both foreign-key solutions(id), not
-- content_items, so the repoint does not reach their columns and §1 asserts it
-- rather than trusting it. ONE policy on solution_comments is rewritten anyway
-- (§14) and the reason is spelled out there: it reads content_items through
-- solutions.bounty_id, so leaving it alone would not leave it working. The
-- discussion tables (bounty_discussion_comments and friends) are NS-P47's, and
-- nothing here reads or writes them.
-- =============================================================================


-- =============================================================================
-- 1. Preflight — the four checks NS-P46 must not proceed without
-- =============================================================================
-- These are the "verify before you start" checks, asserted here rather than run
-- by hand, because here is the only place they can be answered authoritatively:
-- as the migration role, seeing every row, on whatever database this actually
-- runs against. A failure aborts the whole transaction and names what it found.
--
-- Check 2 is the one with teeth. The orphan set SHOULD be empty by
-- construction — NS-P45 wrote a header for every content_items row with
-- post_type = 'bounty', and trg_validate_solution_bounty required exactly that
-- of every bounty_id — but that trigger only ever fired on INSERT and on
-- UPDATE OF bounty_id. A content item that was a bounty when the solution was
-- written and had its post_type changed afterwards was never re-checked, and is
-- the one shape of orphan this history can produce. If any exist, this raises
-- with their ids and nothing is committed.
DO $$
DECLARE
  _missing        TEXT;
  _orphan_count   INTEGER;
BEGIN
  -- (1) The NS-P45 mapping exists.
  IF to_regclass('public.bounties') IS NULL THEN
    RAISE EXCEPTION 'NS-P46 preflight: public.bounties does not exist'
      USING HINT = 'Apply 20260828140000_bounties_header_table.sql (NS-P45) first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.bounties WHERE legacy_item_id IS NOT NULL
  ) AND EXISTS (
    SELECT 1 FROM public.content_items WHERE post_type = 'bounty'
  ) THEN
    RAISE EXCEPTION 'NS-P46 preflight: public.bounties holds no legacy rows but content_items does'
      USING HINT = 'The NS-P45 backfill has not run. Repointing now would orphan every child row.';
  END IF;

  -- (2) Every solutions.bounty_id and every solution_acceptance_log.bounty_id
  --     resolves to a bounties header. Orphans are named, not counted.
  SELECT count(*), string_agg(DISTINCT s.bounty_id::TEXT, ', ')
    INTO _orphan_count, _missing
  FROM public.solutions s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = s.bounty_id
  );
  IF _orphan_count > 0 THEN
    RAISE EXCEPTION
      'NS-P46 preflight: % solutions rows have no bounties header. Unmapped bounty_id values: %',
      _orphan_count, _missing
      USING HINT = 'Each id is a content_items row that is no longer post_type = ''bounty''. Decide what those solutions belong to before repointing.';
  END IF;

  SELECT count(*), string_agg(DISTINCT l.bounty_id::TEXT, ', ')
    INTO _orphan_count, _missing
  FROM public.solution_acceptance_log l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = l.bounty_id
  );
  IF _orphan_count > 0 THEN
    RAISE EXCEPTION
      'NS-P46 preflight: % solution_acceptance_log rows have no bounties header. Unmapped bounty_id values: %',
      _orphan_count, _missing;
  END IF;

  -- (3) solution_votes and solution_comments point at solutions, not at
  --     content_items. Asserted because "they need no change" is a claim about
  --     the database, and this is where it is cheap to prove.
  IF (
    SELECT count(DISTINCT c.conrelid)
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid IN ('public.solution_votes'::regclass, 'public.solution_comments'::regclass)
      AND c.confrelid = 'public.solutions'::regclass
  ) <> 2 THEN
    RAISE EXCEPTION
      'NS-P46 preflight: solution_votes and solution_comments do not both foreign-key public.solutions'
      USING HINT = 'NS-P46 assumes they are untouched by the repoint. Re-read them before continuing.';
  END IF;

  -- (4) The trigger this migration replaces is where it is expected to be —
  --     and so is the updated_at trigger §4 switches off around its writes,
  --     because DISABLE TRIGGER on a name that is not there is an error, and a
  --     confusing one to meet halfway through a repoint.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solutions'::regclass
      AND tgname = 'trg_validate_solution_bounty'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P46 preflight: trg_validate_solution_bounty is not on public.solutions'
      USING HINT = 'Something already changed this table. Re-read it before repointing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solutions'::regclass
      AND tgname = 'trg_solutions_updated_at'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P46 preflight: trg_solutions_updated_at is not on public.solutions'
      USING HINT = 'Section 4 disables it by name around the repoint.';
  END IF;

  RAISE NOTICE 'NS-P46 preflight passed: mapping present, zero orphans, child FKs and trigger as expected';
END $$;


-- =============================================================================
-- 2. The rollback net — the old value of every row, before anything moves
-- =============================================================================
-- Two tables, each one row per repointed row, holding the content_items id that
-- row carried before this migration. They make the repoint reversible with a
-- join and no guesswork, in the same way NS-P45's legacy_item_id makes it
-- performable with one.
--
-- THE ORDER OF A REVERSAL, which is not obvious and was run end to end before
-- being written down. The data UPDATE is step 3, not step 1: the triggers this
-- migration adds read bounties for the value being written, so a rollback that
-- starts with the UPDATE is rejected by the validator this same file installed.
--
--   1. DROP TRIGGER trg_validate_solution_slot ON public.solutions;
--      DROP TRIGGER trg_solutions_legacy_bounty_item ON public.solutions;
--      DROP TRIGGER trg_sal_legacy_bounty_item ON public.solution_acceptance_log;
--   2. drop bounties_accepted_solution_id_fkey, then both bounty_id foreign
--      keys added in §9
--   3. ALTER TABLE public.solutions DISABLE TRIGGER trg_solutions_updated_at;
--
--      UPDATE public.solutions s
--      SET bounty_id = m.old_bounty_id
--      FROM public.ns_p46_migration_map_solutions m
--      WHERE m.id = s.id;
--
--      (and the same for solution_acceptance_log against its map table)
--
--      ALTER TABLE public.solutions ENABLE TRIGGER trg_solutions_updated_at;
--   4. restore the two foreign keys, the slot_kind CHECK, the trigger and the
--      policies from 20260503132953_dde1ba26-d63c-44c1-9d6c-4ddfd98e2231.sql,
--      and drop the two legacy_bounty_item_id columns
--
-- The data is the part that cannot be reconstructed from a file, which is why
-- it is the part that gets a table.
--
-- KEPT UNTIL NS-P56 SIGNS OFF. Recorded in docs/retired-surfaces.md alongside
-- everything else this series is holding open. Dropping them is a separate,
-- explicit decision.
CREATE TABLE public.ns_p46_migration_map_solutions AS
SELECT id, bounty_id AS old_bounty_id
FROM public.solutions;

CREATE TABLE public.ns_p46_migration_map_acceptance_log AS
SELECT id, bounty_id AS old_bounty_id
FROM public.solution_acceptance_log;

-- CREATE TABLE AS makes no key. The primary key is what makes the rollback
-- UPDATE above an index lookup rather than a nested loop over a sequential
-- scan, and it asserts one map row per source row while the table is written.
ALTER TABLE public.ns_p46_migration_map_solutions
  ADD CONSTRAINT ns_p46_migration_map_solutions_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p46_migration_map_acceptance_log
  ADD CONSTRAINT ns_p46_migration_map_acceptance_log_pkey PRIMARY KEY (id);

-- These are operator tables, not product tables. They sit in public because
-- that is where the tables they mirror sit and a rollback should not have to
-- hunt for them — which means PostgREST exposes them and Supabase's default
-- grants reach them. RLS with no policy at all denies every role that goes
-- through the API; the service role bypasses RLS, so an operator can still read
-- them. The REVOKE is belt and braces: RLS already denies, and a future policy
-- written in haste should still find no privilege behind it.
ALTER TABLE public.ns_p46_migration_map_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p46_migration_map_acceptance_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ns_p46_migration_map_solutions FROM anon, authenticated;
REVOKE ALL ON public.ns_p46_migration_map_acceptance_log FROM anon, authenticated;

COMMENT ON TABLE public.ns_p46_migration_map_solutions IS
  'NS-P46 rollback net: solutions.id -> the content_items id its bounty_id held before the repoint. No RLS policy, on purpose — operator access only. Kept until NS-P56 signs off; see docs/retired-surfaces.md.';
COMMENT ON TABLE public.ns_p46_migration_map_acceptance_log IS
  'NS-P46 rollback net: solution_acceptance_log.id -> the content_items id its bounty_id held before the repoint. No RLS policy, on purpose — operator access only. Kept until NS-P56 signs off; see docs/retired-surfaces.md.';


-- =============================================================================
-- 3. The shim column — what keeps the legacy read path alive
-- =============================================================================
-- The legacy bounty page routes on a content_items id and asks "which solutions
-- belong to this bounty?". After §7 that id is not in solutions.bounty_id any
-- more. The alternatives were a compatibility view (a second name for the same
-- rows, with its own RLS story) or making every legacy caller resolve the id
-- through bounties first (a round trip added to every page load, on a path that
-- is being deleted in NS-P50 anyway). This is the third option: keep the old id
-- on the row, in a column that says exactly what it is and has a date on it.
--
-- NOT AUTHORED BY ANY CLIENT. §10 derives it from bounty_id on every write, so
-- it cannot drift from the mapping and a client cannot hang a solution on a
-- bounty page it does not belong to by writing the wrong value here.
--
-- ON DELETE SET NULL rather than CASCADE: deleting a content item already
-- removes these rows the long way round — content_items -> bounties
-- (legacy_item_id, ON DELETE CASCADE) -> solutions (bounty_id, ON DELETE
-- CASCADE) — and a second, shorter delete path for the same event would be a
-- way for the two to disagree, not a safety net.
ALTER TABLE public.solutions
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;

ALTER TABLE public.solution_acceptance_log
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.solutions.legacy_bounty_item_id IS
  'NS-P46 shim. The content_items id this solution''s bounty_id held before the repoint, derived from bounties.legacy_item_id by trg_solutions_legacy_bounty_item on every write. NULL for a bounty that lives on a build. The legacy bounty page reads solutions by this column; NS-P50 rewires those readers and drops it.';
COMMENT ON COLUMN public.solution_acceptance_log.legacy_bounty_item_id IS
  'NS-P46 shim. As solutions.legacy_bounty_item_id. Read by the provenance panel and by the profile zone, which also embeds content_items through solution_acceptance_log_legacy_bounty_item_id_fkey. NS-P50 rewires both and drops it.';

-- Every shim read filters on this column, so it is indexed like the column it
-- stands in for. Partial: a build-backed row has no legacy id and has no
-- business in an index that only ever answers an equality lookup.
CREATE INDEX idx_solutions_legacy_bounty_item
  ON public.solutions (legacy_bounty_item_id)
  WHERE legacy_bounty_item_id IS NOT NULL;

CREATE INDEX idx_sal_legacy_bounty_item
  ON public.solution_acceptance_log (legacy_bounty_item_id)
  WHERE legacy_bounty_item_id IS NOT NULL;


-- =============================================================================
-- 4. Populate the shim, while bounty_id still holds the id it is a copy of
-- =============================================================================
-- Before the repoint the two are the same value, so this is a straight copy and
-- needs no join. It runs before §7 for exactly that reason.
ALTER TABLE public.solutions DISABLE TRIGGER trg_solutions_updated_at;

UPDATE public.solutions SET legacy_bounty_item_id = bounty_id;
UPDATE public.solution_acceptance_log SET legacy_bounty_item_id = bounty_id;


-- =============================================================================
-- 5. The old validation trigger comes off
-- =============================================================================
-- It has to go before the UPDATE in §7 rather than after it: it reads
-- content_items for the NEW bounty_id, which after the repoint is a bounties
-- id, so every row would be rejected on the way through.
--
-- The function goes with it. Nothing else calls it (a function RETURNING
-- trigger cannot be called directly) and leaving it behind would leave a
-- SECURITY DEFINER function on the database whose only remaining purpose is to
-- be attached to something by mistake.
DROP TRIGGER IF EXISTS trg_validate_solution_bounty ON public.solutions;
DROP FUNCTION IF EXISTS public.validate_solution_bounty();


-- =============================================================================
-- 6. The old foreign keys come off
-- =============================================================================
-- Found by shape rather than by name. The names are almost certainly the ones
-- Postgres generated in May — solutions_bounty_id_fkey and
-- solution_acceptance_log_bounty_id_fkey — but a constraint that was ever
-- dropped and re-added by hand carries whatever name that hand chose, and a
-- migration that hard-codes a name fails on the database that needs it most.
-- The lookup is exact: the one foreign key on this table whose single column is
-- bounty_id and whose target is content_items.
DO $$
DECLARE
  _tbl  TEXT;
  _name TEXT;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY['public.solutions', 'public.solution_acceptance_log']
  LOOP
    SELECT c.conname INTO _name
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = _tbl::regclass
      AND c.confrelid = 'public.content_items'::regclass
      AND c.conkey = ARRAY[(
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = _tbl::regclass AND a.attname = 'bounty_id'
      )]::SMALLINT[];

    IF _name IS NULL THEN
      RAISE EXCEPTION 'NS-P46: no bounty_id -> content_items foreign key found on %', _tbl
        USING HINT = 'Preflight passed, so the table exists. Its foreign key is not the shape this migration was written against.';
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', _tbl, _name);
    RAISE NOTICE 'NS-P46: dropped % on %', _name, _tbl;
  END LOOP;
END $$;


-- =============================================================================
-- 7. The repoint
-- =============================================================================
-- One UPDATE per table, joined on the mapping. Rows whose bounty_id has no
-- header are not silently skipped — §1 proved there are none, and §8 proves it
-- again from the other side once the writes have happened.
UPDATE public.solutions s
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = s.bounty_id;

UPDATE public.solution_acceptance_log l
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = l.bounty_id;

ALTER TABLE public.solutions ENABLE TRIGGER trg_solutions_updated_at;


-- =============================================================================
-- 8. The repoint assertion
-- =============================================================================
-- Three facts, checked from the data rather than assumed from the statements
-- above: no row was lost, no row was gained, and every bounty_id now names a
-- bounties row. The first two are why the map tables are compared by count
-- rather than eyeballed — they were written before the UPDATEs and are the only
-- record of what "unchanged" means.
DO $$
DECLARE
  _sol_now   INTEGER;
  _sol_was   INTEGER;
  _log_now   INTEGER;
  _log_was   INTEGER;
  _unresolved INTEGER;
BEGIN
  SELECT count(*) INTO _sol_now FROM public.solutions;
  SELECT count(*) INTO _sol_was FROM public.ns_p46_migration_map_solutions;
  SELECT count(*) INTO _log_now FROM public.solution_acceptance_log;
  SELECT count(*) INTO _log_was FROM public.ns_p46_migration_map_acceptance_log;

  IF _sol_now <> _sol_was OR _log_now <> _log_was THEN
    RAISE EXCEPTION
      'NS-P46: row counts moved. solutions % -> %, acceptance log % -> %',
      _sol_was, _sol_now, _log_was, _log_now;
  END IF;

  SELECT count(*) INTO _unresolved
  FROM public.solutions s
  WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = s.bounty_id);
  IF _unresolved > 0 THEN
    RAISE EXCEPTION 'NS-P46: % solutions rows do not resolve to a bounties row after the repoint', _unresolved;
  END IF;

  SELECT count(*) INTO _unresolved
  FROM public.solution_acceptance_log l
  WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = l.bounty_id);
  IF _unresolved > 0 THEN
    RAISE EXCEPTION 'NS-P46: % acceptance log rows do not resolve to a bounties row after the repoint', _unresolved;
  END IF;

  -- The shim has to agree with the mapping on every row, or the legacy page
  -- reads the wrong bounty's solutions — a silent wrong answer, which is worse
  -- than an error. Checked here once for the rows this migration wrote; §10
  -- keeps it true for every row written after it.
  SELECT count(*) INTO _unresolved
  FROM public.solutions s
  JOIN public.bounties b ON b.id = s.bounty_id
  WHERE s.legacy_bounty_item_id IS DISTINCT FROM b.legacy_item_id;
  IF _unresolved > 0 THEN
    RAISE EXCEPTION 'NS-P46: % solutions rows have a legacy_bounty_item_id that disagrees with their bounty', _unresolved;
  END IF;

  RAISE NOTICE 'NS-P46: % solutions and % acceptance log rows repointed at public.bounties', _sol_now, _log_now;
END $$;


-- =============================================================================
-- 9. The new foreign keys
-- =============================================================================
-- solutions CASCADEs, because a solution is an answer to a question and there
-- is nothing left of it once the question is gone. This is the same action the
-- old constraint carried, one level of indirection further out.
ALTER TABLE public.solutions
  ADD CONSTRAINT solutions_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;

-- The acceptance log RESTRICTs, because it is the append-only record of who
-- solved what and a deletion that quietly takes it with it is exactly the thing
-- an append-only log exists to prevent. Also unchanged from the old constraint.
--
-- The chain that action sits in is worth stating: content_items -> bounties is
-- ON DELETE CASCADE, and bounties -> this table is RESTRICT, so deleting a
-- content item that has an accepted solution still fails, exactly as it did
-- when this table pointed at content_items directly. The error now names
-- bounties rather than solution_acceptance_log; the outcome is the same.
ALTER TABLE public.solution_acceptance_log
  ADD CONSTRAINT solution_acceptance_log_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE RESTRICT;

-- Both bounty_id columns are already indexed and stay indexed:
-- idx_solutions_bounty_slot_status leads with bounty_id, and idx_sal_bounty is
-- a plain index on it. The cascade and the restrict check both use them.


-- =============================================================================
-- 10. The shim stays true — derived, never authored
-- =============================================================================
-- One function, attached to both tables, because it is one rule: whatever
-- bounty_id points at, legacy_bounty_item_id is that bounty's legacy_item_id.
-- It reads NEW.bounty_id and writes NEW.legacy_bounty_item_id and can do
-- nothing else, which is what makes it safe to attach to two tables.
--
-- SECURITY DEFINER for the reason NS-P45's gap trigger is: bounties carries an
-- RLS SELECT policy, and a derivation that resolves differently depending on
-- who is writing is not a derivation. search_path is pinned empty and every
-- reference is schema-qualified, so no caller's search path can put a different
-- bounties in front of this one.
CREATE OR REPLACE FUNCTION public.set_legacy_bounty_item_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT b.legacy_item_id INTO NEW.legacy_bounty_item_id
  FROM public.bounties b
  WHERE b.id = NEW.bounty_id;

  -- No row means the foreign key is about to reject this write anyway. Leaving
  -- the column NULL rather than raising here keeps the error the caller sees as
  -- the accurate one: a foreign key violation naming bounty_id.
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_legacy_bounty_item_id()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.set_legacy_bounty_item_id() IS
  'NS-P46 shim. Keeps legacy_bounty_item_id equal to the bounty''s legacy_item_id on solutions and solution_acceptance_log. Dropped with the columns in NS-P50.';

-- UPDATE OF bounty_id, not UPDATE: the derived value can only change when
-- bounty_id changes, and solutions is updated on every vote (the counter
-- triggers on solution_votes write to it). A trigger on every UPDATE would put
-- a bounties lookup on the voting path to recompute a value that cannot have
-- moved.
CREATE TRIGGER trg_solutions_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();

CREATE TRIGGER trg_sal_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.solution_acceptance_log
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();


-- =============================================================================
-- 11. slot_kind learns the new path's word for a slot
-- =============================================================================
-- 'stage' and 'block' are the two kinds of hole a legacy content_items bounty
-- could have. A build has neither; it has nodes, and NS-P36 gave build_nodes an
-- is_gap flag so one of them can be the hole. 'node' is that third kind.
--
-- Dropped by shape for the same reason §6 does: the name is almost certainly
-- solutions_slot_kind_check, and almost certainly is not good enough.
DO $$
DECLARE
  _name TEXT;
BEGIN
  -- Every check constraint on this table that mentions the column, not just the
  -- first one found: a table that picked up a second slot_kind check along the
  -- way would otherwise keep it, and the kept one still says ('stage','block').
  FOR _name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.contype = 'c'
      AND c.conrelid = 'public.solutions'::regclass
      AND pg_get_constraintdef(c.oid) ILIKE '%slot_kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.solutions DROP CONSTRAINT %I', _name);
    RAISE NOTICE 'NS-P46: dropped % on public.solutions', _name;
  END LOOP;
END $$;

ALTER TABLE public.solutions
  ADD CONSTRAINT solutions_slot_kind_check
  CHECK (slot_kind IN ('stage', 'block', 'node'));

-- solution_acceptance_log.slot_kind is a plain TEXT column with no CHECK and
-- keeps none. It is a record of what a solution's slot_kind WAS at the moment
-- it was accepted, and a log that can be invalidated by a later change to the
-- live table's vocabulary is not a log.


-- =============================================================================
-- 12. The new validation trigger
-- =============================================================================
-- The old one asked one question: is this bounty_id a bounty? The foreign key
-- added in §9 now answers that, so this one asks the question the foreign key
-- cannot — whether the SLOT makes sense for the bounty it is filed against:
--
--   slot_kind = 'node'      slot_id must be a build_nodes row that belongs to
--                           the bounty's build and has is_gap = true. A node
--                           that is not a gap is not an invitation to solve
--                           anything, and a gap in someone else's build is not
--                           this bounty's gap.
--
--   slot_kind = 'stage'     the bounty must be a legacy one (legacy_item_id
--   slot_kind = 'block'     IS NOT NULL). Stages and blocks are positions in a
--                           content_items stage_grids blob; a build-backed
--                           bounty has no such blob and no such positions.
--
-- Stated the other way round, which is the rule NS-P50 inherits: a new-path
-- bounty accepts node slots only, and a legacy bounty accepts stage and block
-- slots only. Neither half is expressible as a CHECK constraint — both read
-- another table — so both live here.
--
-- SECURITY DEFINER, search_path pinned empty, every reference schema-qualified:
-- validation must be a fact about the data and not about who is looking at it.
-- bounties and build_nodes both carry RLS SELECT policies that hide draft
-- builds from everyone but their creator; without the definer right this
-- function would reject a perfectly good row whenever the writer is an admin or
-- an edge function acting for one, because EXISTS came back false for a row
-- that is really there.
CREATE OR REPLACE FUNCTION public.validate_solution_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _build_id       UUID;
  _legacy_item_id UUID;
BEGIN
  SELECT b.build_id, b.legacy_item_id
    INTO _build_id, _legacy_item_id
  FROM public.bounties b
  WHERE b.id = NEW.bounty_id;

  IF NOT FOUND THEN
    -- Unreachable while the foreign key in §9 is in place, and stated anyway:
    -- everything below reads these two variables, and code that is correct on
    -- its own terms survives the constraint being dropped by a later hand.
    RAISE EXCEPTION 'solutions.bounty_id % is not a bounty', NEW.bounty_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF NEW.slot_kind = 'node' THEN
    IF _build_id IS NULL THEN
      RAISE EXCEPTION
        'solutions.slot_kind = ''node'' needs a build-backed bounty; bounty % is a legacy bounty', NEW.bounty_id
        USING ERRCODE = 'check_violation',
              HINT = 'A legacy content_items bounty has stage and block slots, not nodes.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.build_nodes n
      WHERE n.id = NEW.slot_id
        AND n.build_id = _build_id
        AND n.is_gap
    ) THEN
      RAISE EXCEPTION
        'solutions.slot_id % is not a gap node of build %', NEW.slot_id, _build_id
        USING ERRCODE = 'check_violation',
              HINT = 'The node must belong to the bounty''s build and have is_gap = true.';
    END IF;

  ELSE
    IF _legacy_item_id IS NULL THEN
      RAISE EXCEPTION
        'solutions.slot_kind = % needs a legacy bounty; bounty % lives on a build', NEW.slot_kind, NEW.bounty_id
        USING ERRCODE = 'check_violation',
              HINT = 'A bounty on a build accepts node slots only.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_solution_slot()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.validate_solution_slot() IS
  'Validates a solution''s slot against its bounty: node slots belong to a gap node of the bounty''s build, stage and block slots belong to a legacy bounty. Replaces validate_solution_bounty(), whose only question the bounty_id foreign key now answers.';

-- The three columns the validation reads, and no others. Deliberately narrower
-- than NS-P45's gap trigger, which fires on every UPDATE: solutions is written
-- on every vote by the counter triggers on solution_votes, and revalidating a
-- slot that cannot have moved would put two lookups on the voting path. The
-- cost of the narrower form is that a node which stops being a gap after a
-- solution was filed against it is not caught until the next write that names
-- it — which is the same bargain the trigger this replaces made, on a table
-- whose write pattern makes it the right one.
CREATE TRIGGER trg_validate_solution_slot
  BEFORE INSERT OR UPDATE OF bounty_id, slot_kind, slot_id ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.validate_solution_slot();


-- =============================================================================
-- 13. The foreign key NS-P45 deferred to this migration
-- =============================================================================
-- bounties.accepted_solution_id was left as a bare UUID in NS-P45 with a
-- comment saying this migration would constrain it, because at that point
-- solutions was still keyed the old way and wiring it would have locked in the
-- shape being replaced. It is wired now.
--
-- ON DELETE SET NULL: a bounty outlives the withdrawal of the solution it
-- accepted. The row that remains says "solved, and the answer is gone", which
-- is true and readable; a cascade would delete the bounty, and a restrict would
-- make an accepted solution undeletable for the rest of time.
ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_accepted_solution_id_fkey
  FOREIGN KEY (accepted_solution_id) REFERENCES public.solutions(id) ON DELETE SET NULL;

-- Postgres does not index a foreign key for you, and this one is read by every
-- delete of a solution to find the bounties rows it has to null out. Partial:
-- the column is NULL on every row today and on every bounty that has not been
-- solved, and those rows have nothing to contribute to an equality lookup.
CREATE INDEX idx_bounties_accepted_solution
  ON public.bounties (accepted_solution_id)
  WHERE accepted_solution_id IS NOT NULL;

COMMENT ON COLUMN public.bounties.accepted_solution_id IS
  'The accepted solution. Foreign-keyed to solutions(id) ON DELETE SET NULL by NS-P46. Nothing writes it yet — acceptance still runs through the legacy path until NS-P50.';


-- =============================================================================
-- 14. Row level security, restated through bounties
-- =============================================================================
-- Every policy below asked content_items a question about solutions.bounty_id.
-- That column is not a content_items id any more, so each of them would have
-- silently answered "no row" for every solution on the platform: solutions
-- invisible to the public, invisible to the bounty author, and unacceptable by
-- them. They are rewritten to ask bounties, which knows both kinds of home, so
-- the same question is answered for a legacy bounty and for one on a build.
--
-- The EXISTS on bounties is itself subject to the bounties SELECT policy, which
-- NS-P45 wrote to mirror each home's own visibility. Restating the home's
-- predicate underneath it is the pattern NS-P45 used against builds: the two
-- agree by construction, and a reader of this file can see what "published"
-- means without opening two other migrations.
--
-- (select auth.uid()) throughout, never bare auth.uid(): the bare form is
-- re-evaluated per row.

-- --- solutions: who may read one --------------------------------------------
DROP POLICY IF EXISTS "Public can view non-draft solutions on published bounties" ON public.solutions;
CREATE POLICY "Public can view non-draft solutions on published bounties"
  ON public.solutions FOR SELECT TO public
  USING (
    status <> 'draft'
    AND EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = solutions.bounty_id
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

-- Unchanged in meaning, rewritten for the wrapped call: this one never asked
-- content_items anything, but it is evaluated for every row of every solutions
-- read and the bare form re-evaluates auth.uid() for each of them.
DROP POLICY IF EXISTS "Solver can view own solutions" ON public.solutions;
CREATE POLICY "Solver can view own solutions"
  ON public.solutions FOR SELECT TO authenticated
  USING (solver_id = (select auth.uid()));

-- bounties.author_id is the backfilled copy of content_items.creator_id for
-- every legacy row, so this is the same set of people the old policy named, and
-- it now also names the author of a bounty that lives on a build.
DROP POLICY IF EXISTS "Bounty author can view solutions" ON public.solutions;
CREATE POLICY "Bounty author can view solutions"
  ON public.solutions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = solutions.bounty_id
        AND b.author_id = (select auth.uid())
    )
  );

-- --- solutions: who may write one -------------------------------------------
DROP POLICY IF EXISTS "Solver can insert own solution" ON public.solutions;
CREATE POLICY "Solver can insert own solution"
  ON public.solutions FOR INSERT TO authenticated
  WITH CHECK (solver_id = (select auth.uid()));

DROP POLICY IF EXISTS "Solver can update own solution" ON public.solutions;
CREATE POLICY "Solver can update own solution"
  ON public.solutions FOR UPDATE TO authenticated
  USING (solver_id = (select auth.uid()))
  WITH CHECK (solver_id = (select auth.uid()));

-- No WITH CHECK, exactly as before: for UPDATE, Postgres reuses the USING
-- expression when WITH CHECK is absent, so the author may only leave a row on a
-- bounty they still own. Adding one would be a behaviour change dressed as a
-- rewrite.
DROP POLICY IF EXISTS "Bounty author can accept solutions" ON public.solutions;
CREATE POLICY "Bounty author can accept solutions"
  ON public.solutions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = solutions.bounty_id
        AND b.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Solver can delete own draft" ON public.solutions;
CREATE POLICY "Solver can delete own draft"
  ON public.solutions FOR DELETE TO authenticated
  USING (solver_id = (select auth.uid()) AND status = 'draft');

-- --- solution_comments: one policy, rewritten because it reads this column ---
-- solution_comments is otherwise untouched by NS-P46 — it foreign-keys
-- solutions(id), which §1 asserts and this migration does not move. Its SELECT
-- policy is a different matter: it joins content_items ON ci.id = s.bounty_id,
-- which after §7 matches nothing, so leaving it alone would not leave it
-- working. It would make every comment on every solution invisible to the
-- public, and the comment counts on the legacy bounty page read zero.
--
-- The discussion tables NS-P47 owns are elsewhere; this is the solutions
-- column's own blast radius, and it is repaired here rather than left for a
-- later prompt to discover.
DROP POLICY IF EXISTS "Public read solution comments on published bounties" ON public.solution_comments;
CREATE POLICY "Public read solution comments on published bounties"
  ON public.solution_comments FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM public.solutions s
      JOIN public.bounties b ON b.id = s.bounty_id
      WHERE s.id = solution_comments.solution_id
        AND s.status <> 'draft'
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

-- solution_acceptance_log keeps its one policy — "Public can read acceptance
-- log", USING (true) — untouched. It names no table and no user, so the repoint
-- does not reach it and there is nothing in it to rewrite. It is worth NS-P50
-- knowing that a public log will start carrying rows about bounties on
-- unpublished builds once the new path writes to it; tightening it is a
-- behaviour change on a live surface and belongs with the prompt that gives it
-- rows, not with the one that moves its foreign key.
