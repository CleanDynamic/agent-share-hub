-- =============================================================================
-- NeoScale — accepting a solution on a build bounty, in one transaction
-- (NS-P50)
-- =============================================================================
-- One function, one amended trigger function, one tightened read policy. No
-- table is created, no column is added, and nothing on the legacy acceptance
-- path is touched: src/lib/bounty-solver/acceptSolution.ts keeps merging a
-- stage_grids blob for a content_items bounty exactly as it did, because that
-- bounty has no build to write a node into.
--
-- WHY A FUNCTION AND NOT FIVE CLIENT WRITES
-- Accepting a solution on a build is five writes that are one fact:
--
--   1. the solution becomes 'accepted'
--   2. an append-only acceptance row is written
--   3. the bounty becomes 'solved' and names the solution it accepted
--   4. THE GAP NODE IS REPLACED by the accepted payload and stops being a gap
--   5. a 'milestone' event is appended to the build's sequence
--
-- Step 4 is the one that makes a client-side sequence untenable. Half of this
-- applied is not a slower version of the whole: it is a build whose node is
-- filled with an answer that no bounty records accepting, or a bounty marked
-- solved over a gap that is still a gap. PostgREST gives a browser no
-- transaction to put the five in, so they go in a function, where the function
-- body IS the transaction and any RAISE rolls back every write above it.
--
-- SECURITY DEFINER, AND WHAT REPLACES THE POLICIES IT BYPASSES
-- The definer right is needed for step 2 above all: solution_acceptance_log has
-- row level security enabled and NO insert policy at all — it has had none
-- since it was created, so no client role can append to it and the legacy
-- path's insert has always been refused by policy and its error discarded. A
-- function that appends the row and can be seen to check the caller first is a
-- better answer than a new INSERT policy that has to restate the same check in
-- a language that cannot read the solution it is about.
--
-- Step 5 needs it too: build_events is writable by the build's creator, and the
-- bounty author is that creator today — but nothing in the schema says the two
-- must stay the same person, and an acceptance that half-applies the day they
-- diverge is exactly what this function exists to prevent.
--
-- Every authorisation this function performs is stated in section 1 and none of
-- it is inherited from RLS. search_path is pinned empty and every reference is
-- schema-qualified, so no search path a caller sets can put a different
-- build_nodes in front of this one.
-- =============================================================================


-- =============================================================================
-- 1. The acceptance function
-- =============================================================================
-- p_bounty_id and p_solution_id are both required and are checked against each
-- other: a solution id alone would let a caller who owns bounty A accept a
-- solution filed against bounty B by naming it, because the ownership check
-- would read A's author and the writes would land on B.
--
-- RETURNS JSONB rather than void: the client needs the accepted_at it wrote,
-- the node it replaced and the event it appended, and a second round trip to
-- read back what this function already has in hand is a round trip for nothing.
CREATE OR REPLACE FUNCTION public.accept_bounty_solution(
  p_bounty_id   UUID,
  p_solution_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _caller      UUID := (select auth.uid());
  _bounty      public.bounties%ROWTYPE;
  _solution    public.solutions%ROWTYPE;
  _accepted_at TIMESTAMPTZ := now();
  _ordinal     INTEGER;
  _handle      TEXT;
  _event_id    UUID;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'accept_bounty_solution requires a signed-in caller'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- FOR UPDATE on both rows, taken before anything is written: two authors
  -- racing on the same bounty, or one author double-clicking, must serialise
  -- here rather than both passing the "not solved yet" check below.
  SELECT * INTO _bounty FROM public.bounties WHERE id = p_bounty_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bounty % does not exist', p_bounty_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF _bounty.author_id <> _caller AND NOT public.is_admin(_caller) THEN
    RAISE EXCEPTION 'only the bounty author may accept a solution'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The legacy half is refused rather than handled. A content_items bounty has
  -- no build, no nodes and no event sequence; steps 4 and 5 have nothing to
  -- write to, and the stage_grids merge they would replace is a different
  -- operation on a frozen path.
  IF _bounty.build_id IS NULL THEN
    RAISE EXCEPTION
      'bounty % is a legacy content_items bounty; accept it through the legacy path', p_bounty_id
      USING ERRCODE = 'check_violation',
            HINT = 'This function fills a gap node in a build.';
  END IF;

  IF _bounty.gap_node_id IS NULL THEN
    RAISE EXCEPTION
      'bounty % names no gap node, so there is nothing to fill', p_bounty_id
      USING ERRCODE = 'check_violation',
            HINT = 'A build-level bounty with no gap_node_id cannot be solved by node substitution.';
  END IF;

  IF _bounty.accepted_solution_id IS NOT NULL THEN
    RAISE EXCEPTION 'bounty % has already accepted a solution', p_bounty_id
      USING ERRCODE = 'unique_violation';
  END IF;

  SELECT * INTO _solution
  FROM public.solutions
  WHERE id = p_solution_id AND bounty_id = p_bounty_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'solution % is not filed against bounty %', p_solution_id, p_bounty_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF _solution.status <> 'submitted' THEN
    RAISE EXCEPTION
      'solution % is %, and only a submitted solution can be accepted', p_solution_id, _solution.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- The solution must answer THIS bounty's gap. trg_validate_solution_slot
  -- already proved slot_id is a gap node of the bounty's build when the row was
  -- written; it did not prove it is the node this bounty is the header for, and
  -- a build with two gaps has two of them.
  IF _solution.slot_kind <> 'node' OR _solution.slot_id <> _bounty.gap_node_id THEN
    RAISE EXCEPTION
      'solution % answers %/% and not the gap node % this bounty names',
      p_solution_id, _solution.slot_kind, _solution.slot_id, _bounty.gap_node_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- 1. The solution is accepted.
  UPDATE public.solutions
  SET status = 'accepted', accepted_at = _accepted_at
  WHERE id = p_solution_id;

  -- 2. The acceptance log. bounty_id is a bounties id since NS-P46, which is
  -- what p_bounty_id is; nothing derives a legacy id for a bounty on a build.
  INSERT INTO public.solution_acceptance_log (
    solution_id, bounty_id, solver_id, bounty_author_id, slot_kind, slot_id, accepted_at
  ) VALUES (
    p_solution_id, p_bounty_id, _solution.solver_id, _bounty.author_id,
    _solution.slot_kind, _solution.slot_id, _accepted_at
  );

  -- 3. The bounty is solved. THIS RUNS BEFORE STEP 4, and the order is not
  -- cosmetic: trg_bounties_gap_node_valid fires on this UPDATE and asks whether
  -- gap_node_id is still a gap. Section 2 below teaches it that a solved bounty
  -- is the one case where the answer may be no — but only a row that already
  -- says 'solved' gets that exemption, so the status has to be written before
  -- the node stops being a gap, not after.
  UPDATE public.bounties
  SET status = 'solved',
      solved_at = _accepted_at,
      accepted_solution_id = p_solution_id
  WHERE id = p_bounty_id;

  -- 4. The gap node becomes the answer.
  --
  -- REPLACE, not merge. The solution's payload was validated against the node
  -- type's schema before it was submitted, and merging it over whatever the gap
  -- node carried would leave keys from the question inside the answer with
  -- nothing saying which is which.
  --
  -- source_ref is the solver's credit and the only place the build itself
  -- records who filled this node. It keeps the {source, ...} shape every other
  -- writer uses, so a reader that switches on source_ref.source finds 'bounty'
  -- alongside 'buildfile' and the rest.
  UPDATE public.build_nodes
  SET payload = _solution.content_payload,
      is_gap = false,
      source_ref = jsonb_build_object(
        'source', 'bounty',
        'solution_id', p_solution_id,
        'solver_id', _solution.solver_id
      )
  WHERE id = _bounty.gap_node_id;

  -- 5. The solve becomes a moment in the sequence.
  --
  -- Ordinals are dense and 1-based, and this appends: MAX + 1 over the build,
  -- computed under the bounty's row lock, so two acceptances on the same build
  -- cannot both claim the same ordinal.
  SELECT COALESCE(MAX(e.ordinal), 0) + 1 INTO _ordinal
  FROM public.build_events e
  WHERE e.build_id = _bounty.build_id;

  SELECT COALESCE(NULLIF(p.username, ''), NULLIF(p.display_name, ''), 'a solver')
    INTO _handle
  FROM public.profiles p
  WHERE p.id = _solution.solver_id;

  -- visibility 'kept', against the 'folded' default: a gap being solved is the
  -- kind of thing the sequence exists to show, and a reader who has not opened
  -- the folded turns should still see it.
  INSERT INTO public.build_events (
    build_id, ordinal, occurred_at, kind, payload, visibility, produced_node_id
  ) VALUES (
    _bounty.build_id,
    _ordinal,
    _accepted_at,
    'milestone',
    jsonb_build_object(
      'text', 'Gap solved by @' || COALESCE(_handle, 'a solver'),
      'bounty_id', p_bounty_id,
      'solution_id', p_solution_id,
      'solver_id', _solution.solver_id,
      'node_id', _bounty.gap_node_id
    ),
    'kept',
    _bounty.gap_node_id
  )
  RETURNING id INTO _event_id;

  RETURN jsonb_build_object(
    'bounty_id', p_bounty_id,
    'solution_id', p_solution_id,
    'solver_id', _solution.solver_id,
    'author_id', _bounty.author_id,
    'node_id', _bounty.gap_node_id,
    'event_id', _event_id,
    'accepted_at', _accepted_at
  );
END;
$$;

COMMENT ON FUNCTION public.accept_bounty_solution(UUID, UUID) IS
  'Accepts one submitted solution on a bounty that lives on a build, in one transaction: marks the solution accepted, appends the acceptance log row, solves the bounty, replaces the gap node payload with the accepted one (is_gap false, source_ref crediting the solver), and appends a milestone event. Refuses anything that is not the bounty author, a legacy bounty, a bounty with no gap node, an already-solved bounty, or a solution that does not answer the named gap.';

-- anon has no auth.uid() and would be refused by the first check anyway; the
-- REVOKE is here so a definer-right function is never reachable by an
-- unauthenticated caller by accident.
REVOKE EXECUTE ON FUNCTION public.accept_bounty_solution(UUID, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_bounty_solution(UUID, UUID) TO authenticated;


-- =============================================================================
-- 2. The gap validity trigger, amended for the moment after the gap is filled
-- =============================================================================
-- NS-P45's assert_bounty_gap_node() asserts that gap_node_id names a node of
-- build_id with is_gap = true, on EVERY insert and update of a gap-bearing
-- bounty. That was right while a gap could only ever be open. It is wrong the
-- instant one is filled: step 4 above clears is_gap, and from then on the
-- bounty row can never be updated again — not to close it, not to extend it,
-- not by an admin — because the trigger re-reads a node that is deliberately no
-- longer a gap and raises.
--
-- The fix is not to drop the assertion. It is to say what it always meant: a
-- bounty that is still asking names a live gap; a bounty that has been solved
-- names the node it filled. Both halves still require the node to belong to the
-- build, which is the part no CHECK constraint can express and the part that
-- stops a bounty pointing at someone else's node.
--
-- 'closed' and 'expired' get no exemption, on purpose: those are bounties whose
-- gap was never filled, so the node should still be a gap and a row that says
-- otherwise is worth failing on.
CREATE OR REPLACE FUNCTION public.assert_bounty_gap_node()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.gap_node_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.build_nodes n
    WHERE n.id = NEW.gap_node_id
      AND n.build_id = NEW.build_id
  ) THEN
    RAISE EXCEPTION
      'bounties.gap_node_id % is not a node of build %', NEW.gap_node_id, NEW.build_id
      USING ERRCODE = 'check_violation',
            HINT = 'The node must belong to build_id.';
  END IF;

  IF NEW.status <> 'solved' AND NOT EXISTS (
    SELECT 1
    FROM public.build_nodes n
    WHERE n.id = NEW.gap_node_id
      AND n.build_id = NEW.build_id
      AND n.is_gap
  ) THEN
    RAISE EXCEPTION
      'bounties.gap_node_id % is not a gap node of build %', NEW.gap_node_id, NEW.build_id
      USING ERRCODE = 'check_violation',
            HINT = 'The node must have is_gap = true while the bounty is unsolved.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_bounty_gap_node() IS
  'Validates bounties.gap_node_id: the node must belong to build_id always, and must have is_gap = true unless the bounty is solved. NS-P45 required the gap flag unconditionally; NS-P50 exempts a solved bounty, whose acceptance is what cleared the flag.';

-- The trigger itself is unchanged and is not recreated: CREATE OR REPLACE
-- FUNCTION replaces the body under the existing trg_bounties_gap_node_valid.


-- =============================================================================
-- 3. The acceptance log stops being world-readable
-- =============================================================================
-- docs/retired-surfaces.md, "One thing NS-P50 has to decide": the log carries
-- "Public can read acceptance log" with USING (true), which was harmless while
-- every row belonged to an approved content_items bounty. Section 1 gives it
-- rows for bounties on builds, and a build is a DRAFT until its creator
-- publishes it. Left alone, this policy would announce that a named solver
-- filled a named slot on an unpublished build — the existence of the work, its
-- author and its solver — to anyone who asks.
--
-- The replacement mirrors the solutions SELECT policy NS-P46 wrote, which is
-- the policy governing the row this log is about: readable when the bounty's
-- home is public, and otherwise readable by the solver, the bounty author and
-- admins. Nobody who could read a row before loses it — every pre-existing row
-- is a legacy bounty, and the legacy branch below is the approved-item test
-- that made those rows public in the first place.
DROP POLICY IF EXISTS "Public can read acceptance log" ON public.solution_acceptance_log;

-- Both replacements are dropped first as well, so this section is re-runnable:
-- the house style throughout NS-P46 and NS-P47 is DROP IF EXISTS then CREATE,
-- and a migration that aborts on its own second run is a migration nobody can
-- safely re-apply after a partial failure.
DROP POLICY IF EXISTS "Acceptance log is readable when its bounty is" ON public.solution_acceptance_log;
DROP POLICY IF EXISTS "Solver and author can read their acceptance rows" ON public.solution_acceptance_log;

CREATE POLICY "Acceptance log is readable when its bounty is"
  ON public.solution_acceptance_log FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.bounties b
      WHERE b.id = solution_acceptance_log.bounty_id
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

-- The people the row is about, whatever the home's visibility. Separate
-- policies rather than more OR branches on the one above: SELECT policies are
-- OR'd together by Postgres anyway, and TO authenticated on these two keeps the
-- (select auth.uid()) lookups off every anonymous read of a public bounty.
CREATE POLICY "Solver and author can read their acceptance rows"
  ON public.solution_acceptance_log FOR SELECT TO authenticated
  USING (
    solver_id = (select auth.uid())
    OR bounty_author_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );

COMMENT ON TABLE public.solution_acceptance_log IS
  'Append-only record of accepted solutions. Readable when the bounty''s home is public, and by the solver, the bounty author and admins otherwise — NS-P50 replaced the USING (true) policy when accept_bounty_solution() began writing rows for bounties on unpublished builds.';
