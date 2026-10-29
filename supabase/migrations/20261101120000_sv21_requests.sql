-- SV-21: OpenBuilds requests from runs, and claims.
--
-- Part 1. bounties.problem and bounties.from_run_id. A request opened from a run that did not work is a Whole build request (it
--    names no gap node), so the words that say what went wrong have no gap_problem to live in (that is a key in a gap node's
--    payload). problem holds them. from_run_id is the build_reproductions row it was opened from; one request per run.
-- Part 3. bounties.size and bounties.target_key. A request for a session or a part of a build names it by the key it has in the
--    build's `making` (sessions_meta[key], workstreams[i].key). size is null for every request that exists today: a step
--    request (it names a gap node) or a whole-build request (it names nothing). One open request per session or part.
-- Part 2. request_claims. One row per request: the request_id is the key, so there can be one active claim, never two. A claim
--    lasts 3 days from when it was made, and again from every change to its fork (trigger below). A claim that has run out
--    is still a row until someone takes it over or the claimer releases it; every read asks for expires_at > now().
--
-- Part 3. request_offers. A session offered to a request for a session or a part: who offered it, their fork (where the copy was
--    made, by addSession's rule), and the copy itself as the offer carries it, `snapshot` = the session's key, model and
--    prompts (text, reply and source), nothing else of the session. The snapshot is what the maker reads and accepts, because the
--    fork is a draft the maker cannot open. The offerer and the request's maker read an offer; only the maker decides it.
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
--   3. The OpenBuilds Sessions tab:
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id, build_id, target_key, problem, created_at FROM public.bounties
--      WHERE size = 'session' AND status = 'open' ORDER BY created_at DESC LIMIT 21;
--      SHOULD SHOW: an Index Scan on idx_bounties_size_open, no Sort, no Seq Scan on bounties.
--   4. The offers on one request (the maker's review):
--      EXPLAIN (ANALYZE, BUFFERS)
--      SELECT id, user_id, session_key, status, created_at FROM public.request_offers
--      WHERE request_id = '<a request with offers>' ORDER BY created_at DESC LIMIT 50;
--      SHOULD SHOW: an Index Scan on idx_request_offers_request, no Sort, no Seq Scan.
--   5. A fork changing (the trigger's lookup on builds):
--      EXPLAIN (ANALYZE, BUFFERS) SELECT request_id FROM public.request_claims WHERE fork_build_id = '<a fork id>';
--      SHOULD SHOW: an Index Scan on idx_request_claims_fork, no Seq Scan.

-- 1. bounties (parts 1 and 3) ------------------------------------------------------------------------------------------------------------

ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS problem text NULL;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS from_run_id uuid NULL REFERENCES public.build_reproductions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bounties_problem_length' AND conrelid = 'public.bounties'::regclass) THEN
    ALTER TABLE public.bounties ADD CONSTRAINT bounties_problem_length CHECK (problem IS NULL OR char_length(problem) <= 4000);
  END IF;
END $$;

ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS size text NULL;
ALTER TABLE public.bounties ADD COLUMN IF NOT EXISTS target_key text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bounties_size_check' AND conrelid = 'public.bounties'::regclass) THEN
    ALTER TABLE public.bounties ADD CONSTRAINT bounties_size_check CHECK (
      (size IS NULL AND target_key IS NULL)
      OR (size IN ('session', 'part') AND target_key IS NOT NULL AND gap_node_id IS NULL)
    );
  END IF;
END $$;

-- One open request per session or part of a build.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bounties_open_target
  ON public.bounties (build_id, size, target_key)
  WHERE size IS NOT NULL AND status = 'open';

-- The OpenBuilds tabs Sessions and Parts read by size, newest first.
CREATE INDEX IF NOT EXISTS idx_bounties_size_open
  ON public.bounties (size, created_at DESC)
  WHERE size IS NOT NULL AND status = 'open';

COMMENT ON COLUMN public.bounties.size IS
  'SV-21. ''session'' or ''part'' for a request at that size; null for a step request (gap_node_id set) or a whole-build request.';
COMMENT ON COLUMN public.bounties.target_key IS
  'SV-21. The key of the session (making.sessions_meta) or the part (making.workstreams[].key) the request is for.';

-- One request per run.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bounties_from_run ON public.bounties (from_run_id) WHERE from_run_id IS NOT NULL;

COMMENT ON COLUMN public.bounties.problem IS
  'SV-21. What went wrong, in the maker''s or the run''s words, for a request that names no gap node. A step request''s words are the gap node''s payload.gap_problem.';
COMMENT ON COLUMN public.bounties.from_run_id IS
  'SV-21. The build_reproductions row (worked = false) a request was opened from. One request per run.';

-- 2. request_claims (part 2) -----------------------------------------------------------------------------------------------------

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

-- 4. request_offers (part 3) -----------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.request_offers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid        NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fork_build_id uuid        NULL REFERENCES public.builds(id) ON DELETE SET NULL,
  session_key   text        NOT NULL,
  snapshot      jsonb       NOT NULL,
  status        text        NOT NULL DEFAULT 'offered',
  created_at    timestamptz NOT NULL DEFAULT now(),
  decided_at    timestamptz NULL,
  CONSTRAINT request_offers_status_check CHECK (status IN ('offered', 'accepted', 'declined')),
  CONSTRAINT request_offers_snapshot_shape CHECK (jsonb_typeof(snapshot) = 'object' AND jsonb_typeof(snapshot -> 'prompts') = 'array'),
  CONSTRAINT request_offers_one_per_session UNIQUE (request_id, user_id, session_key)
);

CREATE INDEX IF NOT EXISTS idx_request_offers_request ON public.request_offers (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_offers_user ON public.request_offers (user_id, created_at DESC);

ALTER TABLE public.request_offers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.request_offers FROM anon, authenticated, service_role;
GRANT SELECT, DELETE ON public.request_offers TO authenticated;
GRANT INSERT (request_id, user_id, fork_build_id, session_key, snapshot) ON public.request_offers TO authenticated;
GRANT UPDATE (status, decided_at) ON public.request_offers TO authenticated;
GRANT ALL ON public.request_offers TO service_role;

DROP POLICY IF EXISTS "The offerer and the request's maker read an offer" ON public.request_offers;
CREATE POLICY "The offerer and the request's maker read an offer"
  ON public.request_offers FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = request_offers.request_id AND b.author_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Readers offer a session to an open request that is not theirs" ON public.request_offers;
CREATE POLICY "Readers offer a session to an open request that is not theirs"
  ON public.request_offers FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND status = 'offered'
    AND EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = request_offers.request_id AND b.status = 'open' AND b.size IS NOT NULL AND b.author_id <> (select auth.uid()))
    AND (fork_build_id IS NULL OR EXISTS (SELECT 1 FROM public.builds f WHERE f.id = request_offers.fork_build_id AND f.creator_id = (select auth.uid())))
  );

DROP POLICY IF EXISTS "The request's maker decides an offer" ON public.request_offers;
CREATE POLICY "The request's maker decides an offer"
  ON public.request_offers FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = request_offers.request_id AND b.author_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = request_offers.request_id AND b.author_id = (select auth.uid())));

DROP POLICY IF EXISTS "Offerers take back an offer nobody has decided" ON public.request_offers;
CREATE POLICY "Offerers take back an offer nobody has decided"
  ON public.request_offers FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) AND status = 'offered');

COMMENT ON TABLE public.request_offers IS
  'SV-21. A session offered to a request for a session or a part. snapshot holds the session''s key, model and prompts (text, reply, source) and nothing else. Read by the offerer and the request''s maker; decided only by the maker.';
