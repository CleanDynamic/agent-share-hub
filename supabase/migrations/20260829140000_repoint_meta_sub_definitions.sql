-- =============================================================================
-- NeoScale — meta-bounty sub-definitions repointed at bounties, and closed to
-- the new path (NS-P48)
-- =============================================================================
-- One table, two columns, one transaction. meta_bounty_sub_definitions stops
-- holding content_items ids in meta_bounty_id and spawned_bounty_id and holds
-- public.bounties ids in both, resolved through the legacy_item_id mapping
-- NS-P45's backfill wrote and NS-P46 and NS-P47 have each read once.
--
--   meta_bounty_id      -> bounties(id)  ON DELETE CASCADE   (as today)
--   spawned_bounty_id   -> bounties(id)  ON DELETE SET NULL  (as today)
--
-- Both delete actions are the ones the table already carried against
-- content_items, and section 5 reads each one and asserts it before dropping
-- the constraint rather than re-adding an action on faith. The end-to-end
-- behaviour is unchanged one level of indirection further out: content_items ->
-- bounties is itself ON DELETE CASCADE (NS-P45), so deleting a legacy meta
-- still deletes its sub-definitions, and deleting a spawned bounty still leaves
-- the sub-definition standing with spawned_bounty_id NULL.
--
-- AND THEN THE TABLE STOPS TAKING NEW WORK. This is the half of NS-P48 that is
-- not a repoint. Decision 7 of the series preamble: under the record model a
-- meta-bounty is one build with several gap nodes, so a sub-definition has no
-- forward meaning — a gap node IS the sub-bounty, `bounties.gap_node_id` is
-- already the header for it (NS-P45), and `solutions.slot_kind = 'node'` is
-- already how an answer names one (NS-P46). The whole mechanism exists. This
-- table is the generation-2 shape of the same idea and it dissolves forward.
--
-- So section 10 admits a new sub-definition only when its parent bounty is a
-- LEGACY one — `bounties.legacy_item_id IS NOT NULL`. A bounty that lives on a
-- build cannot acquire sub-definitions, from any client, in any role. That is
-- stated twice on purpose and the two statements are not redundant:
--
--   * the INSERT policy carries it, which is where the prompt puts it and
--     where a PostgREST client meets it;
--   * a BEFORE INSERT OR UPDATE OF meta_bounty_id trigger carries it too,
--     because row level security does not bind `service_role` and the code
--     NS-P50 writes may not be a browser — `supabase/functions/seed-ecosystem/
--     index.ts` is already an example of a service-role writer of this table.
--     The trigger is what makes "the new path will not create sub-definitions
--     at all" a fact about the database rather than a fact about the client.
--
-- The trigger also fires on UPDATE OF meta_bounty_id, which the prompt does not
-- ask for and which closes the obvious way round the INSERT rule: file the row
-- against a legacy meta, then move it. No existing row is affected — every one
-- of them is legacy, and section 1 proves it before anything moves.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
-- `meta_bounty_pledges` is NS-P49's, in full: its `meta_bounty_id` still keys
-- content_items, its `sub_definition_id` still keys this table (that foreign
-- key is untouched — no sub-definition id changes here), and none of its
-- policies are read or rewritten. Nothing here reads or writes a pledge.
-- Section 12 hands NS-P49 the mappings it will want.
--
-- ONE TRANSACTION, no BEGIN, for the reason there is none in any other file in
-- this directory: the Supabase CLI applies each migration in one. The table is
-- small — four rows on the harness this was verified against, and the live
-- project carries three content_items bounties in total (NS-P44's measurement)
-- — so the ACCESS EXCLUSIVE locks the two foreign-key swaps take are held for a
-- moment on a table nothing is reading.
-- =============================================================================


-- =============================================================================
-- 1. Preflight — what NS-P48 must not proceed without
-- =============================================================================
-- The prompt's "verify before you start" checks, asserted here rather than run
-- by hand, for NS-P46's reason: here is the only place they can be answered
-- authoritatively — as the migration role, seeing every row, on whatever
-- database this actually runs against. A failure aborts the whole transaction
-- and names what it found.
--
-- The orphan check is the one with teeth, and it is asked separately of each
-- column because they fail differently. A meta_bounty_id with no header is a
-- row that cannot be repointed at all; a spawned_bounty_id with no header is a
-- row whose pointer would have to be dropped on the floor. Neither is something
-- to decide silently, so both raise with the unmapped ids named.
DO $$
DECLARE
  _orphans INTEGER;
  _missing TEXT;
BEGIN
  IF to_regclass('public.bounties') IS NULL THEN
    RAISE EXCEPTION 'NS-P48 preflight: public.bounties does not exist'
      USING HINT = 'Apply 20260828140000_bounties_header_table.sql (NS-P45) first.';
  END IF;

  IF to_regclass('public.meta_bounty_sub_definitions') IS NULL THEN
    RAISE EXCEPTION 'NS-P48 preflight: public.meta_bounty_sub_definitions does not exist'
      USING HINT = 'This migration repoints it. Re-read the table list before continuing.';
  END IF;

  -- The backfill has run. Without this, a database carrying legacy bounties and
  -- an empty bounties table would sail through the orphan checks below only
  -- because there are no rows to orphan, and then repoint everything to NULL.
  IF NOT EXISTS (
    SELECT 1 FROM public.bounties WHERE legacy_item_id IS NOT NULL
  ) AND EXISTS (
    SELECT 1 FROM public.content_items WHERE post_type = 'bounty'
  ) THEN
    RAISE EXCEPTION 'NS-P48 preflight: public.bounties holds no legacy rows but content_items does'
      USING HINT = 'The NS-P45 backfill has not run. Repointing now would orphan every sub-definition.';
  END IF;

  -- (1) This migration is not re-runnable, and it says so BEFORE the orphan
  --     checks below. After a successful run those columns hold bounties ids,
  --     which no bounties.legacy_item_id equals — so a second run would trip
  --     the orphan check and report "no bounties header" for every row, which
  --     is true and useless. The honest answer to a re-run is that it has
  --     already been applied.
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.meta_bounty_sub_definitions'::regclass
      AND attname = 'legacy_meta_item_id'
      AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'NS-P48 preflight: meta_bounty_sub_definitions.legacy_meta_item_id already exists'
      USING HINT = 'NS-P48 has already been applied to this database.';
  END IF;

  -- (2) Every meta_bounty_id maps to a header.
  SELECT count(*), string_agg(DISTINCT s.meta_bounty_id::TEXT, ', ')
    INTO _orphans, _missing
  FROM public.meta_bounty_sub_definitions s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = s.meta_bounty_id
  );

  IF _orphans > 0 THEN
    RAISE EXCEPTION
      'NS-P48 preflight: % sub-definitions have a meta_bounty_id with no bounties header. Unmapped ids: %',
      _orphans, _missing
      USING HINT = 'Each id is a content_items row that is not post_type = ''bounty''. Decide what those rows belong to before repointing.';
  END IF;

  -- (3) Every non-null spawned_bounty_id maps to a header.
  SELECT count(*), string_agg(DISTINCT s.spawned_bounty_id::TEXT, ', ')
    INTO _orphans, _missing
  FROM public.meta_bounty_sub_definitions s
  WHERE s.spawned_bounty_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = s.spawned_bounty_id
    );

  IF _orphans > 0 THEN
    RAISE EXCEPTION
      'NS-P48 preflight: % sub-definitions have a spawned_bounty_id with no bounties header. Unmapped ids: %',
      _orphans, _missing
      USING HINT = 'A spawned bounty that is not post_type = ''bounty'' has no header to move to. Repointing would drop the pointer.';
  END IF;

  -- (4) The updated_at trigger section 4 switches off around its writes is
  --     where it is expected to be. DISABLE TRIGGER on a name that is not there
  --     is an error, and a confusing one to meet halfway through a repoint.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.meta_bounty_sub_definitions'::regclass
      AND tgname = 'trg_meta_bounty_sub_definitions_updated'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P48 preflight: trg_meta_bounty_sub_definitions_updated is not on public.meta_bounty_sub_definitions'
      USING HINT = 'Sections 4 and 6 switch it off so the repoint does not claim every sub-definition was edited today.';
  END IF;

  RAISE NOTICE 'NS-P48 preflight: public.meta_bounty_sub_definitions — 0 orphans on both columns';
END $$;


-- =============================================================================
-- 2. The rollback net — the old value of every row, before anything moves
-- =============================================================================
-- One map table, holding both content_items ids each row carried before this
-- migration, exactly as NS-P46's two and NS-P47's four do. It makes the repoint
-- reversible with a join and no guesswork.
--
-- NAMED FOR ITS FAMILY, NOT FOR THE PROMPT. NS-P48 asked for
-- `_ns_migration_map_meta_subs`; this is `ns_p48_migration_map_meta_subs`,
-- with the prompt's two column names kept verbatim. The six map tables NS-P46
-- and NS-P47 left behind are all `ns_pNN_migration_map_<what>`, they are listed
-- as a set in docs/retired-surfaces.md, and NS-P56 drops them as a set — a
-- seventh table with a different shape of name is a seventh thing to remember.
-- The leading underscore would also have been the only identifier in this
-- schema that starts with one, which PostgREST exposes just the same.
--
-- THE ORDER OF A REVERSAL:
--
--   1. DROP TRIGGER trg_mbsd_freeze_to_legacy   ON public.meta_bounty_sub_definitions;
--      DROP TRIGGER trg_mbsd_legacy_item_ids    ON public.meta_bounty_sub_definitions;
--   2. drop the two foreign keys added in section 8
--   3. ALTER TABLE public.meta_bounty_sub_definitions
--        DISABLE TRIGGER trg_meta_bounty_sub_definitions_updated;
--
--      UPDATE public.meta_bounty_sub_definitions s
--      SET meta_bounty_id    = m.old_meta_bounty_id,
--          spawned_bounty_id = m.old_spawned_bounty_id
--      FROM public.ns_p48_migration_map_meta_subs m
--      WHERE m.id = s.id;
--
--      ALTER TABLE public.meta_bounty_sub_definitions
--        ENABLE TRIGGER trg_meta_bounty_sub_definitions_updated;
--   4. restore both foreign keys against content_items(id) — meta_bounty_id
--      ON DELETE CASCADE, spawned_bounty_id ON DELETE SET NULL — and the three
--      author policies from
--      20260504084620_bb398253-4045-4962-a742-191dc1992943.sql, then drop the
--      two legacy_* columns and their indexes
--
-- The data is the part that cannot be reconstructed from a file, which is why
-- it is the part that gets a table.
--
-- KEPT UNTIL NS-P56 SIGNS OFF, with the other six. Dropping them is a separate,
-- explicit decision.
CREATE TABLE public.ns_p48_migration_map_meta_subs AS
SELECT
  id,
  meta_bounty_id    AS old_meta_bounty_id,
  spawned_bounty_id AS old_spawned_bounty_id
FROM public.meta_bounty_sub_definitions;

-- CREATE TABLE AS makes no key. The primary key is what makes the rollback
-- UPDATE an index lookup rather than a nested loop over a sequential scan, and
-- it asserts one map row per source row while the table is written.
ALTER TABLE public.ns_p48_migration_map_meta_subs
  ADD CONSTRAINT ns_p48_migration_map_meta_subs_pkey PRIMARY KEY (id);

-- An operator table, not a product table. It sits in public because that is
-- where the table it mirrors sits and a rollback should not have to hunt for
-- it — which means PostgREST exposes it and Supabase's default grants reach it.
-- RLS with no policy at all denies every role that goes through the API; the
-- service role bypasses RLS, so an operator can still read it. The REVOKE is
-- belt and braces: RLS already denies, and a future policy written in haste
-- should still find no privilege behind it.
ALTER TABLE public.ns_p48_migration_map_meta_subs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ns_p48_migration_map_meta_subs FROM anon, authenticated;

COMMENT ON TABLE public.ns_p48_migration_map_meta_subs IS
  'NS-P48 rollback net: meta_bounty_sub_definitions.id -> the two content_items ids its meta_bounty_id and spawned_bounty_id held before the repoint. No RLS policy, on purpose — operator access only. Kept until NS-P56 signs off; see docs/retired-surfaces.md.';


-- =============================================================================
-- 3. The shim columns — what keeps the legacy meta surfaces alive
-- =============================================================================
-- A SHIM GOES WHERE A CLIENT CARRIES THE OLD ID, and this table has two such
-- places. Grepped across the four readers the prompt names, plus the one
-- component that turns a sub-definition into a link:
--
--   meta_bounty_id     filtered by a content_items id in all four readers —
--                      ActiveCompetitionsSection.fetchSubBounties
--                      (`.in("meta_bounty_id", metaIds)`, where metaIds are the
--                      content_items ids of the home strip's meta bounties, and
--                      the result is grouped back by that same column),
--                      queryBlueprints.expandBountySearchIds
--                      (`.select("meta_bounty_id")`, whose rows are then
--                      OR-included into a content_items id filter),
--                      getMetaBountyState and pledgeToSubBounty
--                      (`.eq("meta_bounty_id", metaBountyId)`, the id
--                      /content/:id routes on)
--
--   spawned_bounty_id  never filtered, and dereferenced anyway:
--                      getMetaBountyState returns it as `spawnedBountyId`, and
--                      MetaBountyBody navigates to `/content/${id}` with it.
--                      That route takes a content_items id. A bounties id there
--                      renders a 404 on a bounty that exists, which is the
--                      quiet kind of wrong this series keeps refusing.
--                      ActiveCompetitionsSection and pledgeToSubBounty read the
--                      same column for truthiness only ("spawned" vs
--                      "funding"), and truthiness survives the repoint — but a
--                      column cannot be half-shimmed, and one of its three
--                      readers needs the old value.
--
-- NOT AUTHORED BY ANY CLIENT. Section 9 derives both from the columns they
-- shadow on every write, so neither can drift from the mapping and a client
-- cannot hang a sub-definition on a meta-bounty page it does not belong to by
-- writing the wrong value.
--
-- ON DELETE SET NULL on both, for NS-P46's reason: deleting a content item
-- already removes or clears these rows the long way round — content_items ->
-- bounties (legacy_item_id, CASCADE) -> here (CASCADE on the meta, SET NULL on
-- the spawn) — and a second, shorter delete path for the same event would be a
-- way for the two to disagree, not a safety net.
ALTER TABLE public.meta_bounty_sub_definitions
  ADD COLUMN legacy_meta_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL,
  ADD COLUMN legacy_spawned_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.meta_bounty_sub_definitions.legacy_meta_item_id IS
  'NS-P48 shim. The content_items id this row''s meta_bounty_id held before the repoint, derived from bounties.legacy_item_id by trg_mbsd_legacy_item_ids on every write. NULL for a bounty that lives on a build — which, while the section 10 freeze holds, means never. The home ActiveCompetitions strip, the discover free-text expansion, getMetaBountyState and pledgeToSubBounty all read sub-definitions by this column; NS-P50 rewires them and drops it.';
COMMENT ON COLUMN public.meta_bounty_sub_definitions.legacy_spawned_item_id IS
  'NS-P48 shim. As legacy_meta_item_id, for spawned_bounty_id. Read by getMetaBountyState, whose caller navigates to /content/:id with it — a content_items route. NS-P50 drops it.';

-- The three reads that filter on the meta shim all order by position, so the
-- index carries the pair — the same reasoning NS-P47 used to give
-- idx_bdc_legacy_bounty_item its created_at.
--
-- Partial on both: a build-backed row has no legacy id and has no business in
-- an index that only ever answers an equality lookup. (While the freeze holds
-- there are no build-backed rows at all, so the predicate costs nothing and
-- earns its keep the day NS-P50 relaxes it.)
CREATE INDEX idx_mbsd_legacy_meta_item
  ON public.meta_bounty_sub_definitions (legacy_meta_item_id, position)
  WHERE legacy_meta_item_id IS NOT NULL;

-- Nothing filters on this one. It is indexed because it is a foreign key with
-- ON DELETE SET NULL and Postgres does not index a foreign key for you: without
-- it, deleting any content item sequentially scans this table looking for rows
-- to clear.
CREATE INDEX idx_mbsd_legacy_spawned_item
  ON public.meta_bounty_sub_definitions (legacy_spawned_item_id)
  WHERE legacy_spawned_item_id IS NOT NULL;


-- =============================================================================
-- 4. Populate the shims, while the real columns still hold the ids they copy
-- =============================================================================
-- Before the repoint the two pairs are the same values, so this is a straight
-- copy and needs no join. It runs before section 6 for exactly that reason.
--
-- The updated_at trigger goes off first and comes back on in section 6. A
-- migration that rewrites a foreign key has no business claiming every
-- sub-definition on the platform was edited today, and this is the first write
-- that would.
ALTER TABLE public.meta_bounty_sub_definitions
  DISABLE TRIGGER trg_meta_bounty_sub_definitions_updated;

UPDATE public.meta_bounty_sub_definitions
SET legacy_meta_item_id    = meta_bounty_id,
    legacy_spawned_item_id = spawned_bounty_id;


-- =============================================================================
-- 5. The old foreign keys come off
-- =============================================================================
-- Found by shape rather than by name, for NS-P46's reason: the names are almost
-- certainly the ones Postgres generated —
-- meta_bounty_sub_definitions_meta_bounty_id_fkey and its sibling — but a
-- constraint that was ever dropped and re-added by hand carries whatever name
-- that hand chose, and a migration that hard-codes a name fails on the database
-- that needs it most. The lookup is exact: the one foreign key on this table
-- whose single column is the one named and whose target is content_items.
--
-- The delete action each one carried is read and asserted on the way past.
-- meta_bounty_id is expected to be 'c' (CASCADE) and spawned_bounty_id 'n'
-- (SET NULL); section 8 re-adds exactly those. An unexpected action means the
-- table is not the shape this migration was written against, and re-adding the
-- expected one would silently change what a delete does.
DO $$
DECLARE
  _col    TEXT;
  _want   "char";
  _name   TEXT;
  _action "char";
BEGIN
  FOREACH _col IN ARRAY ARRAY['meta_bounty_id', 'spawned_bounty_id']
  LOOP
    _want := CASE _col WHEN 'meta_bounty_id' THEN 'c' ELSE 'n' END;

    SELECT c.conname, c.confdeltype INTO _name, _action
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid = 'public.meta_bounty_sub_definitions'::regclass
      AND c.confrelid = 'public.content_items'::regclass
      AND c.conkey = ARRAY[(
        SELECT a.attnum FROM pg_attribute a
        WHERE a.attrelid = 'public.meta_bounty_sub_definitions'::regclass
          AND a.attname = _col
      )]::SMALLINT[];

    IF _name IS NULL THEN
      RAISE EXCEPTION
        'NS-P48: no % -> content_items foreign key found on public.meta_bounty_sub_definitions', _col
        USING HINT = 'Preflight passed, so the table exists. Its foreign key is not the shape this migration was written against.';
    END IF;

    IF _action <> _want THEN
      RAISE EXCEPTION
        'NS-P48: % carried ON DELETE %, not %', _col, _action, _want
        USING HINT = 'Section 8 re-adds the expected action. Preserve the action this column actually had instead.';
    END IF;

    EXECUTE format(
      'ALTER TABLE public.meta_bounty_sub_definitions DROP CONSTRAINT %I', _name);
    RAISE NOTICE 'NS-P48: dropped % on meta_bounty_sub_definitions.%', _name, _col;
  END LOOP;
END $$;


-- =============================================================================
-- 6. The repoint
-- =============================================================================
-- One UPDATE per column, each joined on the mapping. Rows whose id has no
-- header are not silently skipped — section 1 proved there are none, and
-- section 7 proves it again from the other side once the writes have happened.
--
-- Two statements rather than one because the second is conditional: a row with
-- spawned_bounty_id NULL must stay NULL, and a single UPDATE joining both
-- columns would drop every unspawned row out of the join and leave its
-- meta_bounty_id unrepointed.
--
-- Both are re-runnable: after the first pass the columns hold bounties ids,
-- which no bounties.legacy_item_id equals, so a second run matches nothing.
UPDATE public.meta_bounty_sub_definitions s
SET meta_bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = s.meta_bounty_id;

UPDATE public.meta_bounty_sub_definitions s
SET spawned_bounty_id = b.id
FROM public.bounties b
WHERE s.spawned_bounty_id IS NOT NULL
  AND b.legacy_item_id = s.spawned_bounty_id;

ALTER TABLE public.meta_bounty_sub_definitions
  ENABLE TRIGGER trg_meta_bounty_sub_definitions_updated;


-- =============================================================================
-- 7. The repoint assertion
-- =============================================================================
-- Five facts, checked from the data rather than assumed from the statements
-- above: no row was lost, no row was gained, every meta_bounty_id now names a
-- bounties row, every spawn pointer that was set is still set and now names a
-- bounties row, and both shims agree with the mapping they were derived from.
--
-- The last is the one a wrong answer hides behind. If a shim disagreed with its
-- mapping the home strip would group a sub-definition under the wrong meta
-- bounty — a silent wrong answer, which is worse than an error. Checked here
-- once for the rows this migration wrote; section 9 keeps it true for every row
-- written after it.
DO $$
DECLARE
  _now INTEGER;
  _was INTEGER;
  _bad INTEGER;
BEGIN
  SELECT count(*) INTO _now FROM public.meta_bounty_sub_definitions;
  SELECT count(*) INTO _was FROM public.ns_p48_migration_map_meta_subs;
  IF _now <> _was THEN
    RAISE EXCEPTION
      'NS-P48: row count moved on public.meta_bounty_sub_definitions — % before, % after', _was, _now;
  END IF;

  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  WHERE NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = s.meta_bounty_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION
      'NS-P48: % sub-definitions do not resolve to a bounties row after the repoint', _bad;
  END IF;

  -- A spawn pointer that was set must still be set. This is the failure a
  -- careless single-statement repoint produces, and it is invisible from the
  -- count: the row survives, and its sub-bounty stops being reachable.
  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  JOIN public.ns_p48_migration_map_meta_subs m ON m.id = s.id
  WHERE (m.old_spawned_bounty_id IS NULL) <> (s.spawned_bounty_id IS NULL);
  IF _bad > 0 THEN
    RAISE EXCEPTION
      'NS-P48: % sub-definitions gained or lost a spawned_bounty_id in the repoint', _bad;
  END IF;

  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  WHERE s.spawned_bounty_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = s.spawned_bounty_id);
  IF _bad > 0 THEN
    RAISE EXCEPTION
      'NS-P48: % spawned_bounty_id values do not resolve to a bounties row after the repoint', _bad;
  END IF;

  SELECT count(*) INTO _bad
  FROM public.meta_bounty_sub_definitions s
  JOIN public.bounties bm ON bm.id = s.meta_bounty_id
  LEFT JOIN public.bounties bs ON bs.id = s.spawned_bounty_id
  WHERE s.legacy_meta_item_id    IS DISTINCT FROM bm.legacy_item_id
     OR s.legacy_spawned_item_id IS DISTINCT FROM bs.legacy_item_id;
  IF _bad > 0 THEN
    RAISE EXCEPTION
      'NS-P48: % sub-definitions have a legacy shim that disagrees with their bounty', _bad;
  END IF;

  RAISE NOTICE
    'NS-P48: public.meta_bounty_sub_definitions — % rows repointed at public.bounties, both shims agree on all of them', _now;
END $$;


-- =============================================================================
-- 8. The new foreign keys
-- =============================================================================
-- CASCADE on the meta, SET NULL on the spawn — the two actions section 5 read
-- off the old constraints and asserted before dropping them. The chains they
-- now sit in are worth stating:
--
--   deleting a legacy meta content item -> its bounties header (CASCADE,
--   NS-P45) -> its sub-definitions (CASCADE, here). Unchanged end to end.
--
--   deleting a spawned bounty's content item -> its header (CASCADE) -> the
--   sub-definition's spawned_bounty_id goes NULL (SET NULL, here) and the row
--   survives. Unchanged end to end, and the definition of the ask outliving the
--   attempt to answer it — the same asymmetry NS-P45 wrote into
--   bounties.meta_parent_id.
ALTER TABLE public.meta_bounty_sub_definitions
  ADD CONSTRAINT meta_bounty_sub_definitions_meta_bounty_id_fkey
  FOREIGN KEY (meta_bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;

ALTER TABLE public.meta_bounty_sub_definitions
  ADD CONSTRAINT meta_bounty_sub_definitions_spawned_bounty_id_fkey
  FOREIGN KEY (spawned_bounty_id) REFERENCES public.bounties(id) ON DELETE SET NULL;

-- Neither column has ever been indexed — the table was created in May with a
-- primary key and nothing else — so until now every "the subs of this meta"
-- read sequentially scanned it, and after this migration every cascade from
-- bounties would too. Postgres does not index a foreign key for you.
--
-- The pair (meta_bounty_id, position) is the shape all four readers ask for
-- once NS-P50 rewires them off the shim, and its leading column is what the
-- cascade needs, so one index serves both. The spawn index is a plain partial
-- one: nothing reads by it, it exists for the SET NULL lookup.
CREATE INDEX idx_mbsd_meta_bounty
  ON public.meta_bounty_sub_definitions (meta_bounty_id, position);

CREATE INDEX idx_mbsd_spawned_bounty
  ON public.meta_bounty_sub_definitions (spawned_bounty_id)
  WHERE spawned_bounty_id IS NOT NULL;


-- =============================================================================
-- 9. The shims stay true — derived, never authored
-- =============================================================================
-- NS-P46 wrote this rule as a function and NS-P47 reused it: whatever the real
-- column points at, the legacy column is that bounty's legacy_item_id.
-- public.set_legacy_bounty_item_id() cannot be reused here — it reads
-- NEW.bounty_id and writes NEW.legacy_bounty_item_id, and this table has
-- neither. The column names are that function's contract, and renaming this
-- table's columns to borrow it would rename a live client's filter for the sake
-- of not writing eleven lines.
--
-- So this is its own function, with the same properties and the same
-- justifications: SECURITY DEFINER because the derivation must be a fact about
-- the data rather than about who is looking — bounties carries an RLS SELECT
-- policy that hides bounties on other people's draft builds, and without the
-- definer right this would store NULL for a row that really does have a header,
-- silently, which is exactly the drift the shim exists to prevent. search_path
-- is pinned EMPTY and every reference schema-qualified, so no search path a
-- caller sets can put a different bounties in front of this one. It takes no
-- argument: it reads the row that fired it and cannot be pointed at anything
-- else.
--
-- Both columns in one function because they are one rule applied twice, and a
-- second function would be a second place for it to drift.
CREATE OR REPLACE FUNCTION public.set_meta_sub_legacy_item_ids()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT b.legacy_item_id INTO NEW.legacy_meta_item_id
  FROM public.bounties b
  WHERE b.id = NEW.meta_bounty_id;

  IF NEW.spawned_bounty_id IS NULL THEN
    NEW.legacy_spawned_item_id := NULL;
  ELSE
    SELECT b.legacy_item_id INTO NEW.legacy_spawned_item_id
    FROM public.bounties b
    WHERE b.id = NEW.spawned_bounty_id;
  END IF;

  RETURN NEW;
END;
$$;

-- A function RETURNING trigger cannot be called directly, so this REVOKE closes
-- no hole that is open today. It is here because the definer right is the thing
-- worth being conservative with, and a later refactor that gives this function
-- a callable signature would otherwise inherit EXECUTE from PUBLIC silently.
-- Trigger firing does not consult EXECUTE, so the trigger below is unaffected.
REVOKE EXECUTE ON FUNCTION public.set_meta_sub_legacy_item_ids()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.set_meta_sub_legacy_item_ids() IS
  'NS-P48 shim. Keeps legacy_meta_item_id and legacy_spawned_item_id equal to their bounty''s legacy_item_id on meta_bounty_sub_definitions. Dropped with the columns in NS-P50.';

-- UPDATE OF the two source columns, not UPDATE: the derived values can only
-- change when the columns they are derived from change. That also keeps the
-- trigger off the edit path — retitling a sub-definition or moving its position
-- has no reason to re-resolve two ids that cannot have moved.
CREATE TRIGGER trg_mbsd_legacy_item_ids
  BEFORE INSERT OR UPDATE OF meta_bounty_id, spawned_bounty_id
  ON public.meta_bounty_sub_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_meta_sub_legacy_item_ids();


-- =============================================================================
-- 10. Closed to the new path
-- =============================================================================
-- A sub-definition may only ever be filed against a LEGACY bounty. Under the
-- record model the forward shape of "a meta-bounty with several sub-bounties"
-- is one build with several gap nodes: `build_nodes.is_gap` names the gap
-- (NS-P36), `bounties.gap_node_id` is the header for it (NS-P45), and
-- `solutions.slot_kind = 'node'` is how an answer names it (NS-P46). A
-- sub-definition row would be a fourth way to say the same thing, and the one
-- that cannot be rendered by /b2/:slug.
--
-- ENFORCED IN TWO PLACES, and the pair is not redundant. The INSERT policy in
-- section 11 is where a PostgREST client meets the rule. This trigger is where
-- everything else does — `service_role` bypasses row level security entirely,
-- and `supabase/functions/seed-ecosystem/index.ts` is already a service-role
-- writer of this table. The prompt's requirement is that NS-P50's code cannot
-- regress this; NS-P50's code may well be an edge function, so the rule has to
-- hold below RLS, not only inside it.
--
-- SECURITY DEFINER and search_path EMPTY for section 9's reasons, and one more
-- that is specific to a guard: a validator that says "no" for reasons the
-- caller cannot see — because the bounty it is asking about is hidden from the
-- caller by the bounties SELECT policy — is worse than no validator at all.
--
-- The message names the bounty and says what to do instead, because the person
-- who meets it is most likely writing NS-P50.
CREATE OR REPLACE FUNCTION public.assert_meta_sub_definition_is_legacy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bounties b
    WHERE b.id = NEW.meta_bounty_id
      AND b.legacy_item_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'meta_bounty_sub_definitions is closed to the new path: bounty % is not a legacy bounty', NEW.meta_bounty_id
      USING ERRCODE = 'check_violation',
            HINT = 'Under the build record a sub-bounty is a gap node — add a build_nodes row with is_gap = true and give it a bounties header via gap_node_id. Sub-definitions survive read-only for metas that predate NS-P45.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assert_meta_sub_definition_is_legacy()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.assert_meta_sub_definition_is_legacy() IS
  'NS-P48. Refuses a sub-definition whose parent bounty is not a legacy one (bounties.legacy_item_id IS NULL). Enforced below RLS so that service-role writers are bound by it too. Dissolves with the table.';

-- INSERT, and UPDATE OF meta_bounty_id. The second is not in the prompt and
-- closes the way round the first: file the row against a legacy meta, then move
-- it onto a build-backed bounty. No existing row is affected — section 1 proved
-- every one of them maps to a legacy header before anything moved.
CREATE TRIGGER trg_mbsd_freeze_to_legacy
  BEFORE INSERT OR UPDATE OF meta_bounty_id
  ON public.meta_bounty_sub_definitions
  FOR EACH ROW EXECUTE FUNCTION public.assert_meta_sub_definition_is_legacy();

COMMENT ON TABLE public.meta_bounty_sub_definitions IS
  'LEGACY, READ-ONLY FORWARD (NS-P48). One row per sub-bounty of a generation-2 meta bounty. Since NS-P48 both id columns hold public.bounties ids, and no row may be filed against a bounty that lives on a build — under the record model that shape is a gap node (build_nodes.is_gap) with its own bounties header, not a row here. Existing rows stay readable, editable and deletable by their meta''s author.';


-- =============================================================================
-- 11. Row level security, restated through bounties
-- =============================================================================
-- All three author policies asked content_items a question about a
-- meta_bounty_id that is not a content_items id any more. Each would have
-- answered "no row" for every row on the platform — the author would quietly
-- lose the ability to edit or remove their own sub-definitions, and the insert
-- would refuse a write that ought to succeed. They are rewritten to ask
-- bounties, which knows both kinds of home.
--
-- NOTHING HERE CHANGES WHO CAN DO WHAT, except the INSERT freeze the prompt
-- asks for. bounties.author_id is the backfilled copy of content_items
-- .creator_id for every legacy row (NS-P45 section 6), so "the author" names
-- the same person before and after.
--
-- The old predicate was `meta_bounty_id IN (SELECT id FROM content_items WHERE
-- creator_id = auth.uid())` — a subquery over EVERY content item that person
-- owns, re-planned per statement, and evaluated with a bare auth.uid() that
-- re-evaluates per row. EXISTS against the one bounty in question is the same
-- question asked of one indexed row, with the call wrapped.

-- SELECT is `USING (true)` and is not restated. It names no table and no user,
-- so the repoint does not reach it and there is nothing in it to rewrite —
-- the same call NS-P47 made for "Public can read deadline extensions". It is
-- worth NS-P50 knowing that a public read of this table will start carrying
-- rows about bounties on unpublished builds the day the freeze in section 10 is
-- relaxed; today the freeze makes that impossible.

-- INSERT — the author's own bounty, AND that bounty must be a legacy one.
-- The second half is the freeze, stated exactly as the prompt states it:
-- legacy_item_id IS NOT NULL. It deliberately does NOT also require
-- b.is_meta — the policy it replaces never required the parent to be a meta, or
-- even to be a bounty, and a legacy meta whose bounty_is_meta was never set
-- would silently stop accepting rows. Tightening that would be a behaviour
-- change dressed as a rewrite, and it is not what closes the new path.
DROP POLICY IF EXISTS "Meta bounty author can insert sub definitions" ON public.meta_bounty_sub_definitions;
CREATE POLICY "Meta bounty author can insert sub definitions"
  ON public.meta_bounty_sub_definitions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = meta_bounty_id
        AND b.author_id = (select auth.uid())
        AND b.legacy_item_id IS NOT NULL
    )
  );

-- UPDATE — no WITH CHECK, exactly as before: for UPDATE, Postgres reuses the
-- USING expression when WITH CHECK is absent, so an author may move a row
-- between their own bounties and no further. Adding one would be a behaviour
-- change dressed as a rewrite. The freeze trigger in section 10 is what stops
-- that move landing on a build-backed bounty.
DROP POLICY IF EXISTS "Meta bounty author can update sub definitions" ON public.meta_bounty_sub_definitions;
CREATE POLICY "Meta bounty author can update sub definitions"
  ON public.meta_bounty_sub_definitions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = meta_bounty_sub_definitions.meta_bounty_id
        AND b.author_id = (select auth.uid())
    )
  );

-- DELETE — unchanged in meaning. An author may still remove a sub-definition
-- from their own meta, legacy or not; the table is closed to NEW rows, not
-- frozen against its own author. Deleting the last legacy meta's last
-- sub-definition is how this table empties.
DROP POLICY IF EXISTS "Meta bounty author can delete sub definitions" ON public.meta_bounty_sub_definitions;
CREATE POLICY "Meta bounty author can delete sub definitions"
  ON public.meta_bounty_sub_definitions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = meta_bounty_sub_definitions.meta_bounty_id
        AND b.author_id = (select auth.uid())
    )
  );


-- =============================================================================
-- 12. What NS-P49 and NS-P50 inherit
-- =============================================================================
-- FOR NS-P49, WHICH MOVES THE PLEDGES. meta_bounty_pledges is untouched by this
-- migration — not read, not written, not re-keyed, and its
-- sub_definition_id -> meta_bounty_sub_definitions(id) foreign key still holds
-- because no sub-definition id changed here. Two things are now on the table
-- that NS-P49 will want:
--
--   * `public.ns_p48_migration_map_meta_subs` is the id-level record of what
--     every sub-definition pointed at before today, so a pledge whose
--     meta_bounty_id needs resolving can be checked against the same
--     content_items id its sub-definition carried.
--   * `meta_bounty_sub_definitions.legacy_meta_item_id` is the same mapping,
--     live and derived, on the row itself. `meta_bounty_pledges.meta_bounty_id`
--     is today the same content_items id as its sub-definition's
--     legacy_meta_item_id, and after NS-P49 it should be the same bounties id
--     as its sub-definition's meta_bounty_id. That equality is the assertion
--     NS-P49's own section 7 wants, and it is available from this table without
--     touching content_items.
--
--   NS-P49 will also find that meta_bounty_pledges has an index on
--   meta_bounty_id but none on sub_definition_id, which both
--   ActiveCompetitionsSection and getMetaBountyState group by and
--   pledgeToSubBounty filters on. Not added here: it is a pledge index, on a
--   pledge table, in the prompt that owns it.
--
-- FOR NS-P50, WHICH REWIRES THE CLIENTS. `grep -rn "NS-P48 shim" src/` is the
-- complete list of what has to move before the two columns in section 3 can be
-- dropped. When the last one is rewired onto bounties directly, the columns,
-- their two indexes, public.set_meta_sub_legacy_item_ids() and
-- trg_mbsd_legacy_item_ids go with them.
--
-- The freeze in section 10 does NOT go with them. It is not a shim; it is the
-- decision that this table has no forward shape, and it is written into the
-- database so that a later prompt has to remove it on purpose rather than by
-- forgetting. When the last legacy meta is gone, the table drops whole, under
-- the operator decision in docs/retired-surfaces.md.
