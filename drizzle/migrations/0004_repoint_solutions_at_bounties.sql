DO $$
DECLARE
  _missing        TEXT;
  _orphan_count   INTEGER;
BEGIN
  IF to_regclass('public.bounties') IS NULL THEN
    RAISE EXCEPTION 'NS-P46 preflight: public.bounties does not exist';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.bounties WHERE legacy_item_id IS NOT NULL
  ) AND EXISTS (
    SELECT 1 FROM public.content_items WHERE post_type = 'bounty'
  ) THEN
    RAISE EXCEPTION 'NS-P46 preflight: public.bounties holds no legacy rows but content_items does';
  END IF;
  SELECT count(*), string_agg(DISTINCT s.bounty_id::TEXT, ', ')
    INTO _orphan_count, _missing
  FROM public.solutions s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bounties b WHERE b.legacy_item_id = s.bounty_id
  );
  IF _orphan_count > 0 THEN
    RAISE EXCEPTION
      'NS-P46 preflight: % solutions rows have no bounties header. Unmapped bounty_id values: %',
      _orphan_count, _missing;
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
  IF (
    SELECT count(DISTINCT c.conrelid)
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.conrelid IN ('public.solution_votes'::regclass, 'public.solution_comments'::regclass)
      AND c.confrelid = 'public.solutions'::regclass
  ) <> 2 THEN
    RAISE EXCEPTION
      'NS-P46 preflight: solution_votes and solution_comments do not both foreign-key public.solutions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solutions'::regclass
      AND tgname = 'trg_validate_solution_bounty'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P46 preflight: trg_validate_solution_bounty is not on public.solutions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.solutions'::regclass
      AND tgname = 'trg_solutions_updated_at'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'NS-P46 preflight: trg_solutions_updated_at is not on public.solutions';
  END IF;
  RAISE NOTICE 'NS-P46 preflight passed';
END $$;

CREATE TABLE public.ns_p46_migration_map_solutions AS
SELECT id, bounty_id AS old_bounty_id
FROM public.solutions;

CREATE TABLE public.ns_p46_migration_map_acceptance_log AS
SELECT id, bounty_id AS old_bounty_id
FROM public.solution_acceptance_log;

ALTER TABLE public.ns_p46_migration_map_solutions
  ADD CONSTRAINT ns_p46_migration_map_solutions_pkey PRIMARY KEY (id);
ALTER TABLE public.ns_p46_migration_map_acceptance_log
  ADD CONSTRAINT ns_p46_migration_map_acceptance_log_pkey PRIMARY KEY (id);

ALTER TABLE public.ns_p46_migration_map_solutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ns_p46_migration_map_acceptance_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ns_p46_migration_map_solutions FROM anon, authenticated;
REVOKE ALL ON public.ns_p46_migration_map_acceptance_log FROM anon, authenticated;
GRANT ALL ON public.ns_p46_migration_map_solutions TO service_role;
GRANT ALL ON public.ns_p46_migration_map_acceptance_log TO service_role;

COMMENT ON TABLE public.ns_p46_migration_map_solutions IS
  'NS-P46 rollback net: solutions.id -> the content_items id its bounty_id held before the repoint. No RLS policy, on purpose — operator access only.';
COMMENT ON TABLE public.ns_p46_migration_map_acceptance_log IS
  'NS-P46 rollback net: solution_acceptance_log.id -> the content_items id its bounty_id held before the repoint. No RLS policy, on purpose — operator access only.';

ALTER TABLE public.solutions
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;
ALTER TABLE public.solution_acceptance_log
  ADD COLUMN legacy_bounty_item_id UUID NULL
    REFERENCES public.content_items(id) ON DELETE SET NULL;

CREATE INDEX idx_solutions_legacy_bounty_item
  ON public.solutions (legacy_bounty_item_id)
  WHERE legacy_bounty_item_id IS NOT NULL;
CREATE INDEX idx_sal_legacy_bounty_item
  ON public.solution_acceptance_log (legacy_bounty_item_id)
  WHERE legacy_bounty_item_id IS NOT NULL;

ALTER TABLE public.solutions DISABLE TRIGGER trg_solutions_updated_at;

UPDATE public.solutions SET legacy_bounty_item_id = bounty_id;
UPDATE public.solution_acceptance_log SET legacy_bounty_item_id = bounty_id;

DROP TRIGGER IF EXISTS trg_validate_solution_bounty ON public.solutions;
DROP FUNCTION IF EXISTS public.validate_solution_bounty();

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
      RAISE EXCEPTION 'NS-P46: no bounty_id -> content_items foreign key found on %', _tbl;
    END IF;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', _tbl, _name);
    RAISE NOTICE 'NS-P46: dropped % on %', _name, _tbl;
  END LOOP;
END $$;

UPDATE public.solutions s
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = s.bounty_id;

UPDATE public.solution_acceptance_log l
SET bounty_id = b.id
FROM public.bounties b
WHERE b.legacy_item_id = l.bounty_id;

ALTER TABLE public.solutions ENABLE TRIGGER trg_solutions_updated_at;

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
  SELECT count(*) INTO _unresolved
  FROM public.solutions s
  JOIN public.bounties b ON b.id = s.bounty_id
  WHERE s.legacy_bounty_item_id IS DISTINCT FROM b.legacy_item_id;
  IF _unresolved > 0 THEN
    RAISE EXCEPTION 'NS-P46: % solutions rows have a legacy_bounty_item_id that disagrees with their bounty', _unresolved;
  END IF;
  RAISE NOTICE 'NS-P46: % solutions and % acceptance log rows repointed', _sol_now, _log_now;
END $$;

ALTER TABLE public.solutions
  ADD CONSTRAINT solutions_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE CASCADE;

ALTER TABLE public.solution_acceptance_log
  ADD CONSTRAINT solution_acceptance_log_bounty_id_fkey
  FOREIGN KEY (bounty_id) REFERENCES public.bounties(id) ON DELETE RESTRICT;

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
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_legacy_bounty_item_id()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_solutions_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();
CREATE TRIGGER trg_sal_legacy_bounty_item
  BEFORE INSERT OR UPDATE OF bounty_id ON public.solution_acceptance_log
  FOR EACH ROW EXECUTE FUNCTION public.set_legacy_bounty_item_id();

DO $$
DECLARE
  _name TEXT;
BEGIN
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
    RAISE EXCEPTION 'solutions.bounty_id % is not a bounty', NEW.bounty_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW.slot_kind = 'node' THEN
    IF _build_id IS NULL THEN
      RAISE EXCEPTION
        'solutions.slot_kind = ''node'' needs a build-backed bounty; bounty % is a legacy bounty', NEW.bounty_id
        USING ERRCODE = 'check_violation';
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
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    IF _legacy_item_id IS NULL THEN
      RAISE EXCEPTION
        'solutions.slot_kind = % needs a legacy bounty; bounty % lives on a build', NEW.slot_kind, NEW.bounty_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_solution_slot()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_validate_solution_slot
  BEFORE INSERT OR UPDATE OF bounty_id, slot_kind, slot_id ON public.solutions
  FOR EACH ROW EXECUTE FUNCTION public.validate_solution_slot();

ALTER TABLE public.bounties
  ADD CONSTRAINT bounties_accepted_solution_id_fkey
  FOREIGN KEY (accepted_solution_id) REFERENCES public.solutions(id) ON DELETE SET NULL;

CREATE INDEX idx_bounties_accepted_solution
  ON public.bounties (accepted_solution_id)
  WHERE accepted_solution_id IS NOT NULL;

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

DROP POLICY IF EXISTS "Solver can view own solutions" ON public.solutions;
CREATE POLICY "Solver can view own solutions"
  ON public.solutions FOR SELECT TO authenticated
  USING (solver_id = (select auth.uid()));

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

DROP POLICY IF EXISTS "Solver can insert own solution" ON public.solutions;
CREATE POLICY "Solver can insert own solution"
  ON public.solutions FOR INSERT TO authenticated
  WITH CHECK (solver_id = (select auth.uid()));

DROP POLICY IF EXISTS "Solver can update own solution" ON public.solutions;
CREATE POLICY "Solver can update own solution"
  ON public.solutions FOR UPDATE TO authenticated
  USING (solver_id = (select auth.uid()))
  WITH CHECK (solver_id = (select auth.uid()));

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