-- SV-21: OpenBuilds requests from runs, and claims.
--
-- 1. bounties.problem and bounties.from_run_id. A request opened from a run that did not work is a Whole build request (it
--    names no gap node), so the words that say what went wrong have no gap_problem to live in (that is a key in a gap node's
--    payload). problem holds them. from_run_id is the build_reproductions row it was opened from; one request per run.
-- 2. request_claims. One row per request: the request_id is the key, so there can be one active claim, never two. A claim
--    lasts 3 days from when it was made, and again from every change to its fork (trigger below). A claim that has run out
--    is still a row until someone takes it over or the claimer releases it; every read asks for expires_at > now().
--
-- WHO MAY DO WHAT. Anyone reads a claim (OpenBuilds says who has it). The claimer inserts their own, on an open request that
-- is not theirs, and may change only fork_build_id (column grant), so nobody sets their own expiry. A claim is deleted by its
-- claimer, or by anyone once it has run out, which is how a lapsed claim is taken over: delete the expired row, insert yours;
-- the key makes the second of two takeovers fail rather than double up.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The active claims of one page of requests (OpenBuilds, with the requests' second round):
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT request_id, user_id, claimed_at, expires_at, fork_build_id FROM public.request_claims
--      WHERE request_id = ANY (ARRAY['<an open request id>']::uuid[]) AND expires_at > now() LIMIT 100;
--      SHOULD SHOW: an Index Scan on request_claims_pkey, no Seq Scan on request_claims.
--   2. One reader's active claims (Your claims):
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT request_id, expires_at, fork_build_id FROM public.request_claims
--      WHERE user_id = '<a reader with a claim>' AND expires_at > now() ORDER BY expires_at LIMIT 50;
--      SHOULD SHOW: an Index Scan on idx_request_claims_user_expires, no Sort, no Seq Scan.
--   3. A fork changing (the trigger's lookup on builds):
--      EXPLAIN (ANALYZE, BUFFERS) SELECT request_id FROM public.request_claims WHERE fork_build_id = '<a fork id>';
--      SHOULD SHOW: an Index Scan on idx_request_claims_fork, no Seq Scan.

-- 1. bounties ------------------------------------------------------------------------------------------------------------

ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS problem text NULL;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS from_run_id uuid NULL REFERENCES public.build_reproductions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bounties_problem_length' AND conrelid = 'public.bounties'::regclass) THEN
    ALTER TABLE public.bounties ADD CONSTRAINT bounties_problem_length CHECK (problem IS NULL OR char_length(problem) <= 4000);
  END IF;
END $$;

-- One request per run.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bounties_from_run ON public.bounties (from_run_id) WHERE from_run_id IS NOT NULL;

COMMENT ON COLUMN public.bounties.problem IS
  'SV-21. What went wrong, in the maker''s or the run''s words, for a request that names no gap node. A step request''s words are the gap node''s payload.gap_problem.';
COMMENT ON COLUMN public.bounties.from_run_id IS
  'SV-21. The build_reproductions row (worked = false) a request was opened from. One request per run.';

-- 2. request_claims -----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.request_claims (
  request_id    uuid        PRIMARY KEY REFERENCES public.bounties(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  fork_build_id uuid        NULL REFERENCES public.builds(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_request_claims_user_expires ON public.request_claims (user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_request_claims_fork ON public.request_claims (fork_build_id) WHERE fork_build_id IS NOT NULL;

ALTER TABLE public.request_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.request_claims FROM anon, authenticated, service_role;
GRANT SELECT ON public.request_claims TO anon, authenticated;
GRANT INSERT (request_id, user_id, fork_build_id) ON public.request_claims TO authenticated;
GRANT UPDATE (fork_build_id) ON public.request_claims TO authenticated;
GRANT DELETE ON public.request_claims TO authenticated;
GRANT ALL ON public.request_claims TO service_role;

DROP POLICY IF EXISTS "Anyone reads claims" ON public.request_claims;
CREATE POLICY "Anyone reads claims"
  ON public.request_claims FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Readers claim open requests that are not theirs" ON public.request_claims;
CREATE POLICY "Readers claim open requests that are not theirs"
  ON public.request_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = request_claims.request_id AND b.status = 'open' AND b.author_id <> (select auth.uid()))
    AND (fork_build_id IS NULL OR EXISTS (SELECT 1 FROM public.builds f WHERE f.id = request_claims.fork_build_id AND f.creator_id = (select auth.uid())))
  );

DROP POLICY IF EXISTS "Claimers point their claim at their fork" ON public.request_claims;
CREATE POLICY "Claimers point their claim at their fork"
  ON public.request_claims FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (
    user_id = (select auth.uid())
    AND (fork_build_id IS NULL OR EXISTS (SELECT 1 FROM public.builds f WHERE f.id = request_claims.fork_build_id AND f.creator_id = (select auth.uid())))
  );

DROP POLICY IF EXISTS "Claimers release their claims, anyone clears one that has run out" ON public.request_claims;
CREATE POLICY "Claimers release their claims, anyone clears one that has run out"
  ON public.request_claims FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) OR expires_at <= now());

COMMENT ON TABLE public.request_claims IS
  'SV-21. Who is working on a request: one row per request (the key), 3 days from the claim and from each change to its fork. Anyone reads; the claimer writes their own.';

-- 3. A claim lasts 3 days from its last change -----------------------------------------------------------------------------

-- Pointing a claim at a fork starts the 3 days again.
CREATE OR REPLACE FUNCTION public.request_claims_renew_on_fork()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.fork_build_id IS DISTINCT FROM OLD.fork_build_id THEN
    NEW.expires_at := now() + interval '3 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_claims_renew_on_fork ON public.request_claims;
CREATE TRIGGER trg_request_claims_renew_on_fork
  BEFORE UPDATE OF fork_build_id ON public.request_claims
  FOR EACH ROW EXECUTE FUNCTION public.request_claims_renew_on_fork();

-- A change to the fork starts them again. SECURITY DEFINER because the person editing the fork has no right to write the
-- claim's expiry; it writes one thing, for the claim that names this build, and takes its arguments from the row changed.
CREATE OR REPLACE FUNCTION public.request_claims_renew_on_build_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.request_claims
     SET expires_at = now() + interval '3 days'
   WHERE fork_build_id = NEW.id
     AND user_id = NEW.creator_id;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.request_claims_renew_on_build_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_claims_renew_on_fork() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_builds_renew_request_claim ON public.builds;
CREATE TRIGGER trg_builds_renew_request_claim
  AFTER UPDATE ON public.builds
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION public.request_claims_renew_on_build_change();
