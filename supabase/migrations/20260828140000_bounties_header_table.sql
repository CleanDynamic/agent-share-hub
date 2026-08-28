-- =============================================================================
-- NeoScale — the bounties header table, its guards, and the legacy backfill
-- (NS-P45)
-- =============================================================================
-- Schema only. One new table, three check constraints, two unique indexes, one
-- trigger function behind one trigger, three policies, five more indexes, and a
-- two-pass backfill. No existing table, column, function, policy or trigger is
-- touched, and no application code reads any of it yet.
--
-- WHAT THIS TABLE IS FOR
-- A bounty today is not a record. It is twelve columns bolted onto a
-- content_items row (bounty_status, bounty_tip_gbp, bounty_is_meta and the
-- rest), which means a bounty cannot exist anywhere else — and the whole point
-- of NS-P36's build_nodes.is_gap is that a bounty should be able to be a gap in
-- a build. This migration gives a bounty its own row, with exactly one home:
-- either a build (usually a named gap node inside it) or a legacy content item.
--
-- The child tables — solutions and friends — still foreign-key content_items,
-- and they are NOT repointed here. That is NS-P46 through NS-P49, and it needs
-- the mapping this migration's backfill creates: bounties.legacy_item_id is the
-- content_items id every child row already carries, so a child table repoints
-- with a join and no guesswork.
--
-- THE TWELVE LEGACY COLUMNS ARE NOT DROPPED. content_items keeps every one of
-- them and the live legacy read path keeps working off them, unchanged, per the
-- rule NS-P44 recorded in docs/retired-surfaces.md. This table runs alongside
-- until its replacement is proven.
--
-- SCHEMA DRIFT, AND WHY SECTION 6 READS THREE COLUMNS THROUGH JSONB
-- NS-P44 established, and this session re-measured, that
-- supabase/migrations/20260323000001_bounty_system.sql was authored in March
-- and never applied to the project this repository points at. Six of the twelve
-- legacy columns come from that migration and are therefore absent on the live
-- database while present in a database built from this migration history:
-- bounty_enabled, bounty_tip_gbp, bounty_solved_response_id,
-- bounty_me_too_count, bounty_closes_at, bounty_gap.
--
-- Three of those six are backfill inputs. A migration that names them directly
-- applies on a fresh history and fails on the live project with 42703; a
-- migration that skips them applies everywhere and silently loses data on the
-- history it was written against. Section 6 does neither: it reads those three
-- through to_jsonb(ci) ->> '<column>', which yields NULL for an absent column
-- and the stored value for a present one, so one statement is correct in both
-- worlds. Every other column it names exists in both. See section 6 for the
-- per-column detail.
-- =============================================================================


-- =============================================================================
-- 1. The table
-- =============================================================================
-- build_id and legacy_item_id are both nullable and exactly one is set — the
-- bounties_one_home constraint below makes that a fact rather than a
-- convention. There is no "type" discriminator column because there is nothing
-- a discriminator could say that the two home columns do not already say, and a
-- discriminator that can disagree with them is a bug waiting to be written.
CREATE TABLE public.bounties (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- HOME A: a build. ON DELETE CASCADE — a bounty is a part of the build it
  -- lives in, not an independent object that outlives it.
  build_id             UUID NULL REFERENCES public.builds(id) ON DELETE CASCADE,

  -- The gap node this bounty is the header for. NULL means a build-level bounty
  -- with no single node named as the gap. CASCADE for the same reason as
  -- build_id: deleting the gap deletes the ask. That is deliberately harsher
  -- than builds.solves_node_id, which is ON DELETE SET NULL — an ANSWER must
  -- survive its question being withdrawn, a QUESTION must not survive itself.
  gap_node_id          UUID NULL REFERENCES public.build_nodes(id) ON DELETE CASCADE,

  -- HOME B: a legacy content_items bounty. Every row section 6 writes has this
  -- set; nothing written after NS-P50 should.
  legacy_item_id       UUID NULL REFERENCES public.content_items(id) ON DELETE CASCADE,

  -- profiles, not auth.users: profiles is this codebase's canonical user record
  -- and its id IS the auth.users id. Matches content_items.creator_id and
  -- builds.creator_id, so the backfill is a straight copy.
  author_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  status               TEXT NOT NULL DEFAULT 'open',

  -- The reward, in pounds. NUMERIC, never float: this is money.
  reward_gbp           NUMERIC NULL,
  closes_at            TIMESTAMPTZ NULL,

  -- A meta bounty is a bounty whose solutions are themselves bounties. The flag
  -- and the parent pointer are carried over from content_items.bounty_is_meta /
  -- bounty_meta_parent_id and keep those semantics exactly.
  is_meta              BOOLEAN NOT NULL DEFAULT false,
  -- SET NULL, not CASCADE: deleting a meta parent orphans its children, it does
  -- not delete them. The children are real asks that people may already be
  -- working on.
  meta_parent_id       UUID NULL REFERENCES public.bounties(id) ON DELETE SET NULL,

  -- Deliberately a bare UUID with no foreign key. The solutions table still
  -- points at content_items and is not repointed until NS-P46, which is the
  -- migration that adds this constraint. Wiring it here would either fail
  -- (solutions is keyed the old way) or lock in the old shape.
  accepted_solution_id UUID NULL,

  me_too_count         INTEGER NOT NULL DEFAULT 0,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  solved_at            TIMESTAMPTZ NULL,

  -- 'expired' is new here. The legacy column allowed only open/closed/solved
  -- (content_items_bounty_status_check2), which left a bounty whose deadline
  -- has passed indistinguishable from one its author closed on purpose. The
  -- backfill never produces it — nothing in the legacy data can say it — so it
  -- arrives empty and is written first by whatever sweeps deadlines after
  -- NS-P50.
  CONSTRAINT bounties_status_check CHECK (
    status IN ('open', 'solved', 'closed', 'expired')
  ),

  -- EXACTLY ONE HOME. Not "at most one": a bounty with neither home is a row
  -- nothing can render and nothing can delete by cascade, which is worse than a
  -- rejected insert.
  CONSTRAINT bounties_one_home CHECK (
    (build_id IS NOT NULL AND legacy_item_id IS NULL)
    OR (build_id IS NULL AND legacy_item_id IS NOT NULL)
  ),

  -- A gap node without a build is incoherent, and the check is cheap. That the
  -- node actually belongs to THAT build and is actually a gap is not something
  -- a CHECK can know — a check constraint may not read another table — which is
  -- why section 3 exists.
  CONSTRAINT bounties_gap_needs_build CHECK (
    gap_node_id IS NULL OR build_id IS NOT NULL
  )
);

COMMENT ON TABLE public.bounties IS
  'One row per bounty: the header for a gap in a build, or for a legacy content_items bounty. Exactly one home per row (bounties_one_home). The twelve legacy bounty_* columns on content_items are NOT retired by this table — they stay live until the operator retires content_items.';
COMMENT ON COLUMN public.bounties.gap_node_id IS
  'The build_nodes row this bounty is the header for. Validated by trg_bounties_gap_node_valid: the node must belong to build_id and have is_gap = true.';
COMMENT ON COLUMN public.bounties.legacy_item_id IS
  'The content_items row this bounty was backfilled from. This is the join NS-P46 through NS-P49 repoint the child tables on: a child row carrying a content_items id finds its bounty here.';
COMMENT ON COLUMN public.bounties.accepted_solution_id IS
  'The accepted solution. Deliberately unconstrained until NS-P46 repoints solutions off content_items and adds the foreign key.';
COMMENT ON COLUMN public.bounties.me_too_count IS
  'Carried over from content_items.bounty_me_too_count. A denormalised counter — whatever maintains it after NS-P50 owns it, not the client.';


-- =============================================================================
-- 2. The two uniqueness rules
-- =============================================================================
-- ONE BOUNTY PER GAP. Partial, because a build-level bounty (gap_node_id NULL)
-- is not covered by the rule and a plain unique index would not enforce it
-- anyway — SQL treats NULLs as distinct, so every NULL row would be unique for
-- free while bloating the index.
--
-- build_id leads even though gap_node_id alone would be unique: gap_node_id is
-- already provably a node of build_id by section 3, so the pair carries no
-- extra risk, and leading with build_id makes this index serve
-- "the gaps of this build" lookups as well as the uniqueness rule.
CREATE UNIQUE INDEX idx_bounties_gap_unique
  ON public.bounties (build_id, gap_node_id)
  WHERE gap_node_id IS NOT NULL;

-- ONE HEADER PER LEGACY BOUNTY. This is also what makes section 6 re-runnable
-- and what makes the count assertion in section 7 meaningful: a second run
-- cannot double the table.
CREATE UNIQUE INDEX idx_bounties_legacy_item_unique
  ON public.bounties (legacy_item_id)
  WHERE legacy_item_id IS NOT NULL;


-- =============================================================================
-- 3. The gap validity trigger
-- =============================================================================
-- A gap node must belong to the build the bounty names, and must actually be a
-- gap. Neither fact is available to a CHECK constraint, so it is a trigger.
--
-- SECURITY DEFINER because validation must be a fact about the data, not about
-- who is looking at it. build_nodes carries an RLS SELECT policy that hides
-- nodes of other people's draft builds; without the definer right this function
-- would read that policy's answer and reject a perfectly valid row whenever the
-- writer is not the build's creator — an admin, or an edge function acting for
-- one — because EXISTS came back false for a node that is really there. A
-- validator that says "no" for reasons the caller cannot see is worse than no
-- validator at all.
--
-- search_path is pinned EMPTY and every reference is schema-qualified, so no
-- search path a caller sets can put a different build_nodes in front of this
-- one. The function takes no argument: it reads the row that fired it and
-- cannot be pointed at anything else.
CREATE OR REPLACE FUNCTION public.assert_bounty_gap_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- The trigger's WHEN clause already guarantees this, but a function that is
  -- correct on its own terms survives being attached to a second trigger later.
  IF NEW.gap_node_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.build_nodes n
    WHERE n.id = NEW.gap_node_id
      AND n.build_id = NEW.build_id
      AND n.is_gap
  ) THEN
    RAISE EXCEPTION
      'bounties.gap_node_id % is not a gap node of build %', NEW.gap_node_id, NEW.build_id
      USING ERRCODE = 'check_violation',
            HINT = 'The node must belong to build_id and have is_gap = true.';
  END IF;

  RETURN NEW;
END;
$$;

-- A function RETURNING trigger cannot be called directly, so this REVOKE closes
-- no hole that is open today. It is here because the definer right is the thing
-- worth being conservative with, and a later refactor that gives this function
-- a callable signature would otherwise inherit EXECUTE from PUBLIC silently.
-- Trigger firing does not consult EXECUTE, so the trigger below is unaffected.
REVOKE EXECUTE ON FUNCTION public.assert_bounty_gap_node()
  FROM PUBLIC, anon, authenticated;

-- Every UPDATE of a gap-bearing row, not just the ones that touch build_id or
-- gap_node_id. The pair can also stop being valid because the NODE moved: its
-- is_gap flipped false, or it was reparented to another build. Neither of those
-- is an UPDATE on this table, so nothing revalidates at the moment it happens
-- and a narrower `UPDATE OF build_id, gap_node_id` would let the stale row live
-- for good. Revalidating on every write turns it into a loud failure at the
-- next one instead. The cost is one indexed lookup per update of a bounty that
-- names a gap, which is the cheapest correct option available.
CREATE TRIGGER trg_bounties_gap_node_valid
BEFORE INSERT OR UPDATE ON public.bounties
FOR EACH ROW
WHEN (NEW.gap_node_id IS NOT NULL)
EXECUTE FUNCTION public.assert_bounty_gap_node();


-- =============================================================================
-- 4. Row level security
-- =============================================================================
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;

-- SELECT — a bounty is exactly as readable as the thing it hangs off. Both
-- halves restate their parent's own SELECT predicate rather than delegating to
-- it, which is the pattern build_nodes already uses against builds: the EXISTS
-- is itself subject to the parent's RLS, so the two agree by construction, and
-- writing the predicate out means a reader of this file can see what "readable"
-- means without opening two other migrations.
--
-- No TO clause, so this applies to anon as well as authenticated — a published
-- build's bounties are public, which is the point of a bounty.
--
-- (select auth.uid()) throughout, never bare auth.uid(): the bare form
-- re-evaluates per row.
CREATE POLICY "Bounties are readable when their home is"
  ON public.bounties FOR SELECT
  USING (
    (
      bounties.build_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.builds b
        WHERE b.id = bounties.build_id
          AND (
            b.status <> 'draft'
            OR b.creator_id = (select auth.uid())
            OR public.is_admin((select auth.uid()))
          )
      )
    )
    OR (
      bounties.legacy_item_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.content_items ci
        WHERE ci.id = bounties.legacy_item_id
          AND (
            ci.status = 'approved'
            OR ci.creator_id = (select auth.uid())
            OR public.is_admin((select auth.uid()))
          )
      )
    )
  );

-- INSERT — you may only file a bounty as yourself, and only against a home you
-- own. The second half is the one that matters: without it, author_id alone
-- would let anyone hang a bounty off anyone else's build, and it would render
-- there, because the read policy above asks about the HOME's visibility and not
-- about who wrote the row.
--
-- TO authenticated, because an author is by definition signed in and an
-- anonymous insert has no author_id it could pass.
CREATE POLICY "Authors and admins create bounties on their own work"
  ON public.bounties FOR INSERT TO authenticated
  WITH CHECK (
    (
      author_id = (select auth.uid())
      OR public.is_admin((select auth.uid()))
    )
    AND (
      public.is_admin((select auth.uid()))
      OR (
        build_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.builds b
          WHERE b.id = build_id
            AND b.creator_id = (select auth.uid())
        )
      )
      OR (
        -- The legacy half is stated for symmetry and is expected to stay
        -- unused: every legacy row this table will ever hold was written by
        -- section 6, which runs as the migration role and is not subject to
        -- policy. It is here so that a client cannot attach a header to someone
        -- else's legacy bounty in the window before content_items is retired.
        legacy_item_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.content_items ci
          WHERE ci.id = legacy_item_id
            AND ci.creator_id = (select auth.uid())
        )
      )
    )
  );

-- UPDATE — USING says which rows you may touch, WITH CHECK says what they may
-- look like when you have finished. Both are needed and they are not the same
-- question: USING alone would let an author hand their bounty to someone else
-- by rewriting author_id, or move it onto a build they do not own, because the
-- row was theirs at the moment they reached for it.
--
-- The WITH CHECK is deliberately the same predicate as the insert policy's,
-- word for word. One rule, stated once in two places: a row may only ever come
-- to rest on a home you own. bounties_one_home guarantees exactly one of the
-- two branches is live for any given row.
CREATE POLICY "Authors and admins update their bounties"
  ON public.bounties FOR UPDATE TO authenticated
  USING (
    author_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  )
  WITH CHECK (
    (
      author_id = (select auth.uid())
      OR public.is_admin((select auth.uid()))
    )
    AND (
      public.is_admin((select auth.uid()))
      OR (
        build_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.builds b
          WHERE b.id = build_id
            AND b.creator_id = (select auth.uid())
        )
      )
      OR (
        legacy_item_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.content_items ci
          WHERE ci.id = legacy_item_id
            AND ci.creator_id = (select auth.uid())
        )
      )
    )
  );

-- NO DELETE POLICY, ON PURPOSE. Nothing in the product deletes a bounty today,
-- and RLS denies what it does not permit, so the absence is the safe default
-- rather than an oversight. Deleting the home still removes the row: the two
-- home foreign keys are ON DELETE CASCADE and a referential action is not
-- filtered by policy. Whoever adds a delete affordance after NS-P50 adds the
-- policy with it.


-- =============================================================================
-- 5. Indexes
-- =============================================================================
-- The open-bounties board, and every deadline sweep: status first because it is
-- the equality, closes_at second because it is the range. Not partial — all
-- four statuses get browsed, and 'solved' is the archive people read most.
CREATE INDEX idx_bounties_status_closes
  ON public.bounties (status, closes_at);

-- "The bounties of this build", and the index Postgres needs to cascade a build
-- delete without scanning this table. Partial because build_id is NULL on every
-- legacy row and those rows have no business in an index that only ever answers
-- an equality lookup.
CREATE INDEX idx_bounties_build
  ON public.bounties (build_id)
  WHERE build_id IS NOT NULL;

-- The children of a meta bounty, and the ON DELETE SET NULL lookup when one is
-- deleted.
CREATE INDEX idx_bounties_meta_parent
  ON public.bounties (meta_parent_id)
  WHERE meta_parent_id IS NOT NULL;

-- "My bounties" on a profile, and the cascade when a profile is deleted.
-- Not partial: author_id is NOT NULL.
CREATE INDEX idx_bounties_author
  ON public.bounties (author_id);

-- Not in the NS-P45 index list, and added anyway: gap_node_id is a foreign key
-- with ON DELETE CASCADE, Postgres does not index a foreign key for you, and
-- idx_bounties_gap_unique above leads with build_id so it cannot serve a
-- gap_node_id lookup. Without this, every build_nodes delete sequentially scans
-- bounties — and node deletes are routine (every removal in the compose tray)
-- and multiplied (deleting a build cascades to all of its nodes, one scan
-- each). This is the same reasoning NS-P36 used for idx_builds_solves_node.
CREATE INDEX idx_bounties_gap_node
  ON public.bounties (gap_node_id)
  WHERE gap_node_id IS NOT NULL;

-- legacy_item_id needs no index of its own: idx_bounties_legacy_item_unique in
-- section 2 is a btree on exactly that column and serves both the uniqueness
-- rule and the cascade.


-- =============================================================================
-- 6. Backfill, pass 1 — one row per legacy bounty
-- =============================================================================
-- Every content_items row with post_type = 'bounty', with no filter on status:
-- a pending or rejected bounty is still a bounty, its children still point at
-- it, and NS-P46 needs a header for every id a child can carry. The read policy
-- in section 4 keeps the invisible ones invisible — a header for a non-approved
-- item is readable only by its author and admins, exactly as the item is.
--
-- WHERE NOT EXISTS makes the statement re-runnable rather than relying on the
-- unique index to raise; re-running it is then a no-op instead of an abort,
-- which matters because section 7 asserts the result.
--
-- COLUMN BY COLUMN, and which of them can be absent (see the file header):
--   legacy_item_id  <- ci.id
--   author_id       <- ci.creator_id      NOT NULL and FK'd to profiles already
--   status          <- ci.bounty_status   present everywhere; NULL and anything
--                                         outside the four allowed values map
--                                         to 'open', which is what the legacy
--                                         publish trigger did with a NULL
--   reward_gbp      <- ci.bounty_tip_gbp  ABSENT on the live project
--   closes_at       <- ci.bounty_closes_at ABSENT on the live project
--   is_meta         <- ci.bounty_is_meta  present everywhere
--   me_too_count    <- ci.bounty_me_too_count ABSENT on the live project
--   created_at      <- ci.created_at      preserved, never now()
--
-- The three absent ones are read through to_jsonb(ci) ->> '<column>', which
-- returns NULL for a key that is not in the row rather than failing to plan.
-- On a database built from this migration history all three resolve to their
-- stored values; on the live project all three resolve to NULL and the COALESCE
-- fallbacks below decide what happens next.
--
-- THE FALLBACKS ARE A DELIBERATE DIVERGENCE from a literal reading of NS-P45,
-- and they exist because the literal reading loses live data. The live project
-- has no bounty_tip_gbp and no bounty_closes_at, but it does have populated
-- bounty_reward_amount / bounty_reward_currency / bounty_reward_type and
-- bounty_deadline on the very same rows — the April shape of the same two
-- facts. Backfilling NULL over a £400 reward and a real deadline would hand
-- NS-P50 a table that is structurally perfect and factually empty. The reward
-- fallback is taken only when the legacy row says the reward is cash in
-- pounds, because the column being filled is named reward_gbp and a token
-- reward is not a number of pounds.
INSERT INTO public.bounties (
  legacy_item_id,
  author_id,
  status,
  reward_gbp,
  closes_at,
  is_meta,
  me_too_count,
  created_at
)
SELECT
  ci.id,
  ci.creator_id,
  CASE lower(COALESCE(ci.bounty_status, ''))
    WHEN 'open'    THEN 'open'
    WHEN 'solved'  THEN 'solved'
    WHEN 'closed'  THEN 'closed'
    WHEN 'expired' THEN 'expired'
    ELSE 'open'
  END,
  COALESCE(
    (to_jsonb(ci) ->> 'bounty_tip_gbp')::NUMERIC,
    CASE
      WHEN COALESCE(ci.bounty_reward_type, 'cash') = 'cash'
       AND COALESCE(ci.bounty_reward_currency, 'GBP') = 'GBP'
      THEN ci.bounty_reward_amount
    END
  ),
  COALESCE(
    (to_jsonb(ci) ->> 'bounty_closes_at')::TIMESTAMPTZ,
    ci.bounty_deadline
  ),
  COALESCE(ci.bounty_is_meta, false),
  COALESCE((to_jsonb(ci) ->> 'bounty_me_too_count')::INTEGER, 0),
  ci.created_at
FROM public.content_items ci
WHERE ci.post_type = 'bounty'
  AND NOT EXISTS (
    SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = ci.id
  );


-- =============================================================================
-- 6b. Backfill, pass 2 — meta parents
-- =============================================================================
-- Separate pass because a meta child can be inserted before its parent: the
-- parent's bounties.id does not exist until pass 1 has run to completion, and
-- pass 1 has no ordering guarantee. Both passes read the same mapping —
-- legacy_item_id -> bounties.id — which is the mapping NS-P46 through NS-P49
-- will read too.
--
-- A parent that is not itself a post_type = 'bounty' row has no header and
-- therefore no id to point at; the join drops it and the child keeps
-- meta_parent_id NULL. That is the honest outcome: content_items.
-- bounty_meta_parent_id is a plain FK to content_items and nothing ever
-- constrained it to point at a bounty.
UPDATE public.bounties b
SET meta_parent_id = parent.id
FROM public.content_items ci
JOIN public.bounties parent
  ON parent.legacy_item_id = ci.bounty_meta_parent_id
WHERE b.legacy_item_id = ci.id
  AND ci.bounty_meta_parent_id IS NOT NULL
  AND b.meta_parent_id IS DISTINCT FROM parent.id;


-- =============================================================================
-- 7. The backfill assertion
-- =============================================================================
-- NS-P45's first acceptance is that the header count equals the legacy bounty
-- count, so it is asserted here rather than left to a query someone remembers
-- to run. A mismatch aborts the migration with the two numbers in the message.
--
-- The only way this can fire is a legacy bounty that pass 1 could not write,
-- and the only candidate is a constraint on THIS table rejecting it — every
-- input column is either NOT NULL and foreign-keyed already (creator_id) or
-- mapped to a legal value above. If it ever does fire, the message names the
-- gap and nothing has been committed.
DO $$
DECLARE
  _legacy_bounties INTEGER;
  _headers         INTEGER;
BEGIN
  SELECT count(*) INTO _legacy_bounties
  FROM public.content_items WHERE post_type = 'bounty';

  SELECT count(*) INTO _headers
  FROM public.bounties WHERE legacy_item_id IS NOT NULL;

  IF _legacy_bounties <> _headers THEN
    RAISE EXCEPTION
      'NS-P45 backfill incomplete: % content_items bounties, % header rows',
      _legacy_bounties, _headers;
  END IF;

  RAISE NOTICE 'NS-P45: % legacy bounties backfilled into public.bounties', _headers;
END $$;
