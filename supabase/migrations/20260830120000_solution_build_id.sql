-- =============================================================================
-- NeoScale — a solution can BE a rebuild (NS-P53)
-- =============================================================================
-- One column, one non-tightening check, one partial index, and one amended
-- function. No table is created and no existing row changes meaning.
--
-- WHAT THIS COLUMN IS FOR
-- Until now a solution was a payload: the solver filled in the gap node's
-- fields in a sheet on somebody else's page and submitted the object. That
-- path is untouched and stays the quick one. What it cannot express is the
-- answer that needed the whole build to find — a solver who had to change the
-- model, re-order two steps and add a check before the gap could be filled at
-- all has a REBUILD, not a payload, and the only way to submit it before now
-- was to publish it and then retype its one interesting node into a form.
--
-- solution_build_id is that submission. The solver rebuilds the bounty's build
-- (Phase R, NS-P36-P40), fills the gap inside their own copy, publishes it as
-- theirs, and files THAT as the solution. What the author accepts is still one
-- node payload — the record cannot absorb a whole foreign build into one gap —
-- but the payload now comes from the solver's published node, and the credit on
-- the filled node links back to the build it came from.
--
-- ON DELETE SET NULL, deliberately, and it is the same argument
-- builds.solves_node_id took in NS-P37. A solver who deletes their build has
-- not withdrawn their solution: the payload was pulled into the author's build
-- at acceptance and lives there on its own. What is lost is the LINK, and a
-- solution row that vanished with it would take the acceptance log's subject
-- with it. CASCADE here would let a solver delete an accepted answer out of
-- somebody else's history by deleting their own page.
-- =============================================================================


-- =============================================================================
-- 1. The column
-- =============================================================================
ALTER TABLE public.solutions
  ADD COLUMN IF NOT EXISTS solution_build_id UUID NULL
    REFERENCES public.builds(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.solutions.solution_build_id IS
  'NS-P53. The solver''s own published build, submitted as the solution: a rebuild of the bounty''s build with the gap filled inside it. NULL on a typed-payload solution and on every legacy row. ON DELETE SET NULL — deleting the rebuild removes the link, never the accepted answer.';


-- =============================================================================
-- 2. The check, which is deliberately not a tightening
-- =============================================================================
-- What it says: a solution carries an answer — a payload, a build, or both.
-- What it does NOT do is make either one required in a way no existing row
-- satisfies. content_payload has been NOT NULL DEFAULT '{}' since the table was
-- created in 20260503132953, so the left arm is already true of every row that
-- exists and of every row the legacy path will write; the constraint states the
-- invariant for readers and for the next writer without re-litigating a column
-- that thousands of legacy rows already satisfy.
--
-- BOTH SET IS THE ORDINARY CASE ON THE NEW PATH, not an edge one.
-- submitSolutionRebuild writes the matched node's payload into content_payload
-- as well as the build id, so a reader who cannot load the solver's build still
-- sees what was offered, and so the acceptance re-validation has something to
-- check when the solver's page is momentarily unreadable. The build is the
-- source of truth at acceptance; the payload is the summary that survives it.
--
-- Added through a DO block because Postgres has no ADD CONSTRAINT IF NOT
-- EXISTS, and this migration must be safe to re-apply after a partial failure —
-- the house style everywhere in NS-P46 through NS-P50.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'solutions_carries_an_answer'
      AND conrelid = 'public.solutions'::regclass
  ) THEN
    -- NOT VALID, then VALIDATE as its own statement: adding a validated check
    -- holds ACCESS EXCLUSIVE for the length of a full scan, and VALIDATE takes
    -- the weaker SHARE UPDATE EXCLUSIVE. The scan finds nothing either way —
    -- see above — but a migration that blocks writes to solutions for no
    -- reason is a migration that blocks writes to solutions.
    ALTER TABLE public.solutions
      ADD CONSTRAINT solutions_carries_an_answer
      CHECK (content_payload IS NOT NULL OR solution_build_id IS NOT NULL)
      NOT VALID;

    ALTER TABLE public.solutions VALIDATE CONSTRAINT solutions_carries_an_answer;
  END IF;
END $$;


-- =============================================================================
-- 3. The index
-- =============================================================================
-- PARTIAL, for the reason NS-P37's index on builds(solves_node_id) is partial:
-- the column is NULL on every legacy row and on every typed-payload solution,
-- which is and will remain the great majority of the table, and an index that
-- carries a NULL entry per row is an index paying write cost for rows no query
-- will ever look for through it.
--
-- The questions it answers: "has this build already been filed as a solution?"
-- (submitSolutionRebuild, before it writes a second one) and the ON DELETE SET
-- NULL scan, which without this index is a sequential pass over solutions every
-- time anybody deletes a build.
CREATE INDEX IF NOT EXISTS idx_solutions_solution_build
  ON public.solutions (solution_build_id)
  WHERE solution_build_id IS NOT NULL;


-- =============================================================================
-- 4. Acceptance pulls the payload from the solver's build
-- =============================================================================
-- The function keeps every check and every write it had in NS-P50 and gains one
-- branch: a solution carrying solution_build_id fills the author's gap node
-- with the payload of the SOLVER'S filled node, not with the snapshot stored on
-- the solutions row, and the credit written onto the node names the build it
-- came from.
--
-- WHY THE NODE IS NAMED BY THE CALLER RATHER THAN FOUND HERE.
-- The solver's build is a fork of the author's, and a fork shares NO node ids
-- with its source — fork.ts mints every id fresh and copies no pointer back
-- (see the header of src/lib/build/rebuild.ts). Matching a node to its
-- counterpart is therefore a heuristic, and it is one this database has no
-- business reimplementing: matchNodes() pairs on carried source_ref identity
-- first and on structural descent second, it is the same function the publish
-- gate's diff runs, and a second copy of it in plpgsql would be a second copy
-- that drifts. So the client resolves the pair and passes the id, and
-- EVERYTHING THAT MATTERS ABOUT IT IS VERIFIED HERE:
--
--   * the node belongs to the build the SOLUTION ROW names — not to any build
--     the caller feels like naming, because the id comes from the row, not the
--     argument;
--   * that build is the solver's own, published, and declares solves_node_id =
--     this bounty's gap;
--   * the node is of the gap's own type, is not itself a gap, and has a payload
--     with something in it.
--
-- What a caller can still choose is WHICH qualifying node of the solver's
-- published rebuild is pulled. The only caller who can choose it is the bounty
-- author — nobody else gets past the ownership check — the material is the
-- solver's own published work either way, and the author could type any payload
-- they liked into their own node without this function's help. So the residual
-- freedom is "the author picks a different one of the solver's published nodes
-- for their own build, and still credits the solver", which is not a privilege
-- worth a second identity heuristic to close.
--
-- p_solved_node_id DEFAULTS TO NULL and is ignored entirely on a typed-payload
-- solution, so the NS-P50 call — rpc with the two named arguments — keeps
-- working unchanged and keeps meaning exactly what it meant.

-- The two-argument function is dropped rather than left beside the new one.
-- CREATE OR REPLACE cannot add a parameter, and a three-argument function
-- created alongside it would leave the old body as the exact match for every
-- two-argument call — the amendment would silently never run.
DROP FUNCTION IF EXISTS public.accept_bounty_solution(UUID, UUID);

CREATE OR REPLACE FUNCTION public.accept_bounty_solution(
  p_bounty_id      UUID,
  p_solution_id    UUID,
  p_solved_node_id UUID DEFAULT NULL
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
  _gap         public.build_nodes%ROWTYPE;
  _solved      public.build_nodes%ROWTYPE;
  _rebuild     public.builds%ROWTYPE;
  _payload     JSONB;
  _source_ref  JSONB;
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

  SELECT * INTO _gap FROM public.build_nodes WHERE id = _bounty.gap_node_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the gap node % this bounty names no longer exists', _bounty.gap_node_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- --- what will be written onto the gap node -------------------------------
  --
  -- The typed-payload default, which is NS-P50's behaviour exactly. The rebuild
  -- branch below replaces both values or raises; there is no third outcome
  -- where half of one path meets half of the other.
  _payload := _solution.content_payload;
  _source_ref := jsonb_build_object(
    'source', 'bounty',
    'solution_id', p_solution_id,
    'solver_id', _solution.solver_id
  );

  IF _solution.solution_build_id IS NOT NULL THEN
    IF p_solved_node_id IS NULL THEN
      RAISE EXCEPTION
        'solution % was submitted as a rebuild; p_solved_node_id must name the filled node inside build %',
        p_solution_id, _solution.solution_build_id
        USING ERRCODE = 'check_violation',
              HINT = 'The caller matches the gap to its counterpart with matchNodes() and passes the id.';
    END IF;

    SELECT * INTO _rebuild FROM public.builds WHERE id = _solution.solution_build_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION
        'the build solution % was submitted as no longer exists', p_solution_id
        USING ERRCODE = 'no_data_found',
              HINT = 'solution_build_id is ON DELETE SET NULL, so this is a build deleted mid-acceptance.';
    END IF;

    -- The rebuild is the SOLVER'S. Anything else would let an acceptance credit
    -- one person for another person's build.
    IF _rebuild.creator_id <> _solution.solver_id THEN
      RAISE EXCEPTION
        'build % is not the solver''s, so it cannot be their solution', _rebuild.id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Published, because an accepted answer has to be one a reader can go and
    -- check. 'gallery' is a curated published build, not a third state, exactly
    -- as listRebuilds treats it.
    IF _rebuild.status NOT IN ('published', 'gallery') THEN
      RAISE EXCEPTION
        'build % is %, and only a published rebuild can be a solution', _rebuild.id, _rebuild.status
        USING ERRCODE = 'check_violation';
    END IF;

    -- It has to say it is solving THIS gap. This is the declaration
    -- startSolutionRebuild wrote onto the draft and publishing carried through;
    -- a rebuild that solves a different gap, or none, is somebody else's answer.
    IF _rebuild.solves_node_id IS DISTINCT FROM _bounty.gap_node_id THEN
      RAISE EXCEPTION
        'build % solves % and not the gap node % this bounty names',
        _rebuild.id, COALESCE(_rebuild.solves_node_id::TEXT, 'nothing'), _bounty.gap_node_id
        USING ERRCODE = 'check_violation';
    END IF;

    SELECT * INTO _solved FROM public.build_nodes WHERE id = p_solved_node_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'node % does not exist', p_solved_node_id
        USING ERRCODE = 'no_data_found';
    END IF;

    -- The node comes from the build the ROW names. p_solved_node_id is an
    -- argument and solution_build_id is stored data; the argument may only
    -- point inside what the row already committed to.
    IF _solved.build_id <> _rebuild.id THEN
      RAISE EXCEPTION
        'node % is not part of build %, which is what solution % was submitted as',
        p_solved_node_id, _rebuild.id, p_solution_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Same type as the gap. The question decides the shape of the answer here
    -- for the same reason submitSolution validates against the gap's schema.
    IF _solved.type <> _gap.type THEN
      RAISE EXCEPTION
        'node % is a % and the gap it would fill is a %', p_solved_node_id, _solved.type, _gap.type
        USING ERRCODE = 'check_violation';
    END IF;

    -- Filled, and filled with something. A rebuild that published the gap still
    -- empty has not solved it, and substituting an empty payload would clear
    -- the flag on the author's node while answering nothing.
    IF _solved.is_gap THEN
      RAISE EXCEPTION
        'node % is still a gap in the solver''s own build', p_solved_node_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF _solved.payload IS NULL OR _solved.payload = '{}'::jsonb THEN
      RAISE EXCEPTION
        'node % has an empty payload, so there is nothing to pull into the gap', p_solved_node_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- THE PULL. The solver's node as it stands now, not the snapshot taken when
    -- the solution was filed: the build is the published record and the row's
    -- content_payload is a copy of it, and where the two disagree the one a
    -- reader can open is the one that is true.
    _payload := _solved.payload;

    -- The credit gains the build, so the filled node links to the rebuild the
    -- answer came from and not only to the person who wrote it. Same {source,
    -- ...} shape every other writer uses; a reader switching on
    -- source_ref.source still finds 'bounty'.
    _source_ref := _source_ref || jsonb_build_object(
      'solution_build_id', _rebuild.id,
      'solution_node_id', _solved.id
    );
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
  -- gap_node_id is still a gap. NS-P50 taught it that a solved bounty is the one
  -- case where the answer may be no — but only a row that already says 'solved'
  -- gets that exemption, so the status has to be written before the node stops
  -- being a gap, not after.
  UPDATE public.bounties
  SET status = 'solved',
      solved_at = _accepted_at,
      accepted_solution_id = p_solution_id
  WHERE id = p_bounty_id;

  -- 4. The gap node becomes the answer.
  --
  -- REPLACE, not merge. The payload was validated against the node type's
  -- schema before it was submitted, and merging it over whatever the gap node
  -- carried would leave keys from the question inside the answer with nothing
  -- saying which is which.
  --
  -- source_ref is the solver's credit and the only place the build itself
  -- records who filled this node — and, on the rebuild path, where the answer
  -- was published.
  UPDATE public.build_nodes
  SET payload = _payload,
      is_gap = false,
      source_ref = _source_ref
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
  --
  -- solution_build_id rides in the event payload as well as on the node, so the
  -- sequence can link a solve to the rebuild it came from without re-reading
  -- the node's source_ref.
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
      'node_id', _bounty.gap_node_id,
      'solution_build_id', _solution.solution_build_id
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
    'accepted_at', _accepted_at,
    'solution_build_id', _solution.solution_build_id
  );
END;
$$;

COMMENT ON FUNCTION public.accept_bounty_solution(UUID, UUID, UUID) IS
  'Accepts one submitted solution on a bounty that lives on a build, in one transaction: marks the solution accepted, appends the acceptance log row, solves the bounty, replaces the gap node payload (is_gap false, source_ref crediting the solver), and appends a milestone event. Where the solution carries solution_build_id the payload is pulled from p_solved_node_id inside the solver''s published rebuild — which must be the solver''s own, published, declare solves_node_id = this bounty''s gap, and hold a filled node of the gap''s type — and source_ref gains solution_build_id. Refuses anything that is not the bounty author, a legacy bounty, a bounty with no gap node, an already-solved bounty, or a solution that does not answer the named gap.';

-- anon has no auth.uid() and would be refused by the first check anyway; the
-- REVOKE is here so a definer-right function is never reachable by an
-- unauthenticated caller by accident.
REVOKE EXECUTE ON FUNCTION public.accept_bounty_solution(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_bounty_solution(UUID, UUID, UUID) TO authenticated;
