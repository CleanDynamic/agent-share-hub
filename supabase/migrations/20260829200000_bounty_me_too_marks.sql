-- =============================================================================
-- NeoScale — "I need this too", as a row (NS-P52)
-- =============================================================================
-- One table, one trigger, four policies, two indexes. Nothing that exists is
-- altered except bounties.me_too_count, which is written by the trigger below
-- and by nothing else.
--
-- WHY THIS TABLE EXISTS AT ALL
-- The gap panel NS-P52 puts on the build page offers a reader one action that
-- is not "solve it": saying they need it too. There was nowhere to put that.
--
--   * public.bounty_me_too is GENERATION 1. It is keyed on content_items(id),
--     it answers PGRST205 against the project NS-P44 measured, and
--     docs/retired-surfaces.md states the rule NS-P45 through NS-P49 followed
--     and this migration keeps: a generation-1 table is neither repointed nor
--     dropped, and nothing may add a foreign key to one. So it is not extended,
--     not read and not written here.
--   * bounties.me_too_count is a denormalised counter carried over from
--     content_items.bounty_me_too_count, and its own table comment says
--     "whatever maintains it after NS-P50 owns it, not the client". This is
--     that thing. The UPDATE policy on bounties admits the author and admins
--     only — which is right, and which means the one person who must not be
--     able to inflate this number is the only person who could have written it.
--
-- THE ROW IS THE FACT AND THE COUNTER IS DERIVED. A mark is one row per person
-- per bounty, so the same reader clicking twice is an upsert conflict rather
-- than a second vote, and the counter is recomputed from the rows by trigger.
-- =============================================================================


-- =============================================================================
-- 1. The table
-- =============================================================================
-- NO SURROGATE KEY. The natural key IS the rule — one mark per person per
-- bounty — so it is the primary key, and there is no id column for a second
-- row with the same pair to hide behind. That is the same shape NS-P45's
-- idx_bounties_gap_unique takes for the same reason.
--
-- bounty_id leads the key because every read this table serves filters it:
-- "the marks on these bounties", for a page of gap panels. user_id follows and
-- gets its own index below.
CREATE TABLE IF NOT EXISTS public.bounty_me_too_marks (
  bounty_id  UUID NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (bounty_id, user_id)
);

COMMENT ON TABLE public.bounty_me_too_marks IS
  'One row per person per bounty: "I need this too". Keyed at public.bounties, unlike the generation-1 bounty_me_too which is keyed at content_items and is untouched. bounties.me_too_count is maintained from these rows by trg_bounty_me_too_count.';

-- The other direction: "everything this person marked", and the index the
-- ON DELETE CASCADE from profiles needs so deleting an account does not scan
-- this table. The primary key already serves the bounty_id direction.
CREATE INDEX IF NOT EXISTS idx_bounty_me_too_marks_user
  ON public.bounty_me_too_marks (user_id);


-- =============================================================================
-- 2. The counter, maintained from the rows
-- =============================================================================
-- SECURITY DEFINER because the write it performs is an UPDATE on bounties,
-- whose policy admits the author and admins only. The person marking is by
-- definition not the author — an author who needed their own gap solved would
-- not have filed it as a question — so under the caller's own rights this
-- UPDATE would silently affect zero rows and the counter would never move.
--
-- The function reads NOTHING from the caller and takes no argument: it is
-- attached to one table by one trigger and can only ever recount the bounty
-- named by the row that fired it. search_path is pinned empty and every
-- reference is schema-qualified, so no search path a caller sets can put a
-- different bounties in front of this one.
--
-- RECOUNTED, NOT INCREMENTED. `SET me_too_count = me_too_count + 1` drifts the
-- first time a row is deleted twice, restored from a backup, or inserted by a
-- migration; a count over an indexed primary-key prefix is exact every time and
-- costs one index scan over a handful of rows.
CREATE OR REPLACE FUNCTION public.recount_bounty_me_too()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _bounty UUID := COALESCE(NEW.bounty_id, OLD.bounty_id);
BEGIN
  UPDATE public.bounties b
  SET me_too_count = (
    SELECT count(*)
    FROM public.bounty_me_too_marks m
    WHERE m.bounty_id = _bounty
  )
  WHERE b.id = _bounty;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.recount_bounty_me_too() IS
  'Recomputes bounties.me_too_count from bounty_me_too_marks after a mark is added or removed. SECURITY DEFINER: the marker is not the bounty author, and the UPDATE policy on bounties admits only the author.';

-- A function RETURNING trigger cannot be called directly, so this REVOKE closes
-- no hole that is open today. It is here for the reason NS-P45 gave for
-- assert_bounty_gap_node(): a later refactor that gives this function a
-- callable signature would otherwise inherit EXECUTE from PUBLIC silently.
REVOKE EXECUTE ON FUNCTION public.recount_bounty_me_too()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bounty_me_too_count ON public.bounty_me_too_marks;

-- AFTER, and FOR EACH ROW: the count has to be taken with the row's own change
-- already applied, and a statement-level trigger would not know which bounty to
-- recount. There is no UPDATE arm because there is nothing on this row to
-- update — the pair is the primary key, and moving a mark to another bounty is
-- a delete and an insert.
CREATE TRIGGER trg_bounty_me_too_count
AFTER INSERT OR DELETE ON public.bounty_me_too_marks
FOR EACH ROW
EXECUTE FUNCTION public.recount_bounty_me_too();


-- =============================================================================
-- 3. Row level security
-- =============================================================================
ALTER TABLE public.bounty_me_too_marks ENABLE ROW LEVEL SECURITY;

-- SELECT — a mark is exactly as readable as the bounty it is on. The EXISTS is
-- itself subject to the bounties SELECT policy, which is what makes the two
-- agree by construction: a bounty a reader cannot see has no marks they can
-- count. Same pattern as NS-P45's own read policy against builds.
--
-- No TO clause, so anonymous readers can count the marks on a public bounty.
-- Who marked it is readable too, and deliberately: "seven people need this"
-- with an unreadable list is a number nobody can check.
DROP POLICY IF EXISTS "Me-too marks are readable when their bounty is"
  ON public.bounty_me_too_marks;
CREATE POLICY "Me-too marks are readable when their bounty is"
  ON public.bounty_me_too_marks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_me_too_marks.bounty_id
    )
  );

-- INSERT — as yourself, on a bounty that is still asking. A mark on a solved
-- bounty is a vote for something that already happened, and the counter it
-- moves is read beside the word "open" on three surfaces.
--
-- (select auth.uid()) throughout, never bare auth.uid(): the bare form
-- re-evaluates per row.
DROP POLICY IF EXISTS "Readers mark their own me-too" ON public.bounty_me_too_marks;
CREATE POLICY "Readers mark their own me-too"
  ON public.bounty_me_too_marks FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = bounty_me_too_marks.bounty_id
        AND b.status = 'open'
    )
  );

-- DELETE — your own mark, whatever the bounty's status now. Taking back a mark
-- on a bounty that has since been solved is not a write anyone needs to be
-- protected from, and refusing it would strand the row.
DROP POLICY IF EXISTS "Readers remove their own me-too" ON public.bounty_me_too_marks;
CREATE POLICY "Readers remove their own me-too"
  ON public.bounty_me_too_marks FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- NO UPDATE POLICY, on purpose. Both columns are the primary key; there is
-- nothing on this row that can change without it becoming a different row, and
-- RLS denies what it does not permit.


-- =============================================================================
-- 4. Grants
-- =============================================================================
-- Stated rather than inherited from ALTER DEFAULT PRIVILEGES, so that this
-- table's reachability is readable in this file. RLS above is what decides
-- which rows each role sees; the grant only decides which verbs they may
-- attempt. anon gets SELECT alone — it has no auth.uid() and every write
-- policy names one.
GRANT SELECT ON public.bounty_me_too_marks TO anon, authenticated;
GRANT INSERT, DELETE ON public.bounty_me_too_marks TO authenticated;
