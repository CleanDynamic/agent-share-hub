-- =============================================================================
-- NeoScale — one me-too counter, not two (NS-P54)
-- =============================================================================
-- ONE FUNCTION BODY CHANGES. No table, no column, no index, no policy, no
-- trigger, no row. `public.update_bounty_me_too_count()` stops writing
-- `content_items.bounty_me_too_count` and keeps writing `bounties.me_too_count`.
--
-- WHY THIS IS THE LAST STEP OF THE RETIREMENT AND NOT THE FIRST. NS-P47 made
-- this function a DUAL-WRITE on purpose and said so in its own comment and in
-- docs/retired-surfaces.md: the legacy counter was still the one the legacy
-- surfaces read, so both numbers were maintained from the same COUNT(*) and
-- could not drift. That was the right shape while both sides were live. NS-P54
-- ends it, because the client side of the repoint lands in the same commit:
-- BountyCard and the Discover me-too sort now read the bounties counter through
-- resolveBountyByLegacyItem, and nothing that a reader can reach depends on the
-- content_items column any more.
--
-- THE COLUMN IS NOT DROPPED, AND NOT ZEROED. It keeps whatever value it holds
-- the moment this runs. That is deliberate on both counts:
--
--   * Dropping it is out of scope for this series. content_items.bounty_* goes
--     when content_items itself goes — one operator decision, taken under
--     "Dropping any of this" in docs/retired-surfaces.md — not one column at a
--     time by a prompt that is retiring a form.
--   * Zeroing it would be a data change disguised as a schema change. A frozen
--     number that was true on the day it froze is a record; a zero is a claim
--     that nobody ever needed any of those bounties, which is false. Anything
--     still reading the column reads the last true value rather than a lie.
--
-- WHAT THIS DOES NOT TOUCH. `bounty_me_too_marks` and its own trigger
-- `trg_bounty_me_too_count` (20260829200000) — that is the NEW path's me-too,
-- keyed at bounties, and it already maintains one counter and only one.
-- `trg_update_bounty_me_too_count` on `public.bounty_me_too` stays attached
-- with the shape it has had since March: AFTER INSERT OR DELETE, FOR EACH ROW,
-- result discarded. Only the body it calls is replaced.
--
-- ON THE PROJECT THIS REPOSITORY POINTS AT, THIS IS A NO-OP THAT SAYS SO.
-- Measured 29 Aug 2026 through the publishable key: `content_items
-- .bounty_me_too_count` answers Postgres 42703 "column does not exist" and
-- `public.bounties` answers PGRST205, so neither side of the dual-write exists
-- there and NS-P47's own DO block already took its "nothing installed" branch.
-- The guards below take the same shape for the same reason: a migration that
-- assumes an object exists because a file in this directory creates it has
-- already been wrong twice in this series.
-- =============================================================================

DO $do$
BEGIN
  -- ---------------------------------------------------------------------------
  -- Guard 1 — generation 1 is not here.
  -- ---------------------------------------------------------------------------
  -- public.bounty_me_too is the March 2026 table (20260323000001_bounty_system
  -- .sql), authored and never applied. With no table there is no trigger, no
  -- function worth replacing, and no dual-write to end.
  IF to_regclass('public.bounty_me_too') IS NULL THEN
    RAISE NOTICE 'NS-P54: public.bounty_me_too is absent (generation 1, authored March 2026, never applied) — no dual-write to end, nothing changed.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Guard 2 — the trigger is not attached.
  -- ---------------------------------------------------------------------------
  -- Same reasoning NS-P47 gave: replacing a function nothing calls maintains
  -- nothing, and doing it silently would leave a WARNING-shaped fact unrecorded.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.bounty_me_too'::regclass
      AND tgname = 'trg_update_bounty_me_too_count'
      AND NOT tgisinternal
  ) THEN
    RAISE WARNING 'NS-P54: trg_update_bounty_me_too_count is not on public.bounty_me_too. Replacing the function would maintain nothing, so NS-P54 leaves it alone.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Guard 3 — the counter that would be left is not here either.
  -- ---------------------------------------------------------------------------
  -- THIS GUARD IS NEW, AND IT IS THE ONE THAT MATTERS. NS-P47 could afford not
  -- to check for public.bounties: if it was absent, the second UPDATE matched no
  -- row and the legacy leg carried the counter alone. After this migration the
  -- bounties leg is the ONLY leg, so installing it against a database without
  -- that table would turn every me-too write into a runtime error inside a
  -- SECURITY DEFINER trigger — which is worse than a stale number and much
  -- harder to trace. If the header table is not here, the dual-write stays.
  IF to_regclass('public.bounties') IS NULL THEN
    RAISE WARNING 'NS-P54: public.bounties is absent, so dropping the content_items leg would leave this trigger with nothing it can write. The dual-write is left in place; re-run this migration after 20260828140000_bounties_header_table.sql is applied.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------------------
  -- The replacement.
  -- ---------------------------------------------------------------------------
  -- CREATE OR REPLACE, so the trigger keeps firing and picks the new body up on
  -- its next call. SECURITY DEFINER for the reason NS-P47 stated and NS-P52
  -- restated: the UPDATE policy on bounties admits the author and admins only,
  -- and the person marking a me-too is by definition neither, so under the
  -- caller's own rights this UPDATE would affect zero rows silently.
  --
  -- search_path stays pinned empty and every reference stays schema-qualified,
  -- so no search path a caller sets can put a different bounties in front of
  -- this one.
  --
  -- STILL RECOUNTED, NOT INCREMENTED. `SET me_too_count = me_too_count + 1`
  -- drifts the first time a row is deleted twice, restored from a backup, or
  -- inserted by a migration; a count over the indexed content_id is exact every
  -- time. This is the property that made the dual-write safe and it is the same
  -- property that makes ending it safe: the surviving counter is not derived
  -- from the one that stopped moving.
  EXECUTE $ddl$
    CREATE OR REPLACE FUNCTION public.update_bounty_me_too_count()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = ''
    AS $fn$
    DECLARE
      _content_id UUID;
    BEGIN
      _content_id := COALESCE(NEW.content_id, OLD.content_id);

      -- THE ONLY LEG. Resolved through the NS-P45 mapping, which is why this
      -- needs no foreign key on bounty_me_too: the join is one-directional and
      -- a legacy item with no header simply matches no row.
      --
      -- NS-P54 removed the second UPDATE that stood here, against
      -- public.content_items(bounty_me_too_count). That column is not dropped
      -- and not zeroed; it keeps its last value, frozen.
      UPDATE public.bounties
      SET me_too_count = (
        SELECT count(*)
        FROM public.bounty_me_too
        WHERE content_id = _content_id
      )
      WHERE legacy_item_id = _content_id;

      RETURN NULL;
    END;
    $fn$;
  $ddl$;

  -- Restated rather than inherited. A function RETURNING trigger cannot be
  -- called directly, so this closes no hole that is open today; it is here so a
  -- later refactor that gives it a callable signature does not inherit EXECUTE
  -- from PUBLIC silently. Trigger firing does not consult EXECUTE, so the
  -- trigger is unaffected.
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_bounty_me_too_count() FROM PUBLIC, anon, authenticated';

  EXECUTE $c$
    COMMENT ON FUNCTION public.update_bounty_me_too_count() IS
      'NS-P54 single write. Maintains bounties.me_too_count ONLY, recomputed from bounty_me_too via bounties.legacy_item_id. The NS-P47 dual-write leg against content_items.bounty_me_too_count was removed here: that column is frozen at its last value, not dropped and not zeroed, and the surfaces that read it now resolve the bounties counter instead. bounty_me_too itself is still NOT repointed — it is a generation-1 table and docs/retired-surfaces.md forbids adding a foreign key to one.'
  $c$;

  RAISE NOTICE 'NS-P54: me-too now writes bounties.me_too_count only; content_items.bounty_me_too_count is frozen at its current value.';
END
$do$;
