-- =============================================================================
-- buildgallery — import sessions table, imports bucket, policies (EX-P05)
-- =============================================================================
-- The extractive connector is a pipe, not an editor. It carries a conversation
-- verbatim into a waiting import; a human chooses what matters later, in their
-- own browser, with their own session. This migration builds the place that
-- import waits in: one table for the state of an import, one private bucket for
-- the numbered chunks of conversation text, and the policies that make both
-- readable by exactly one account — the one that opened them.
--
-- It touches no existing table, bucket, policy or migration. Every policy below
-- is scoped either to public.import_sessions or to bucket_id = 'imports', so
-- none of them can widen anything already in place.
--
-- PATH CONVENTION — fixed here and depended on by every later step:
--
--   <user_id>/<import_id>/<seq>.txt
--
-- The FIRST segment is the owner, and it is what the object policies read. An
-- object whose first segment is not the caller's own uid is not readable, not
-- writable and not deletable, so the convention is not a nicety: it is the
-- access rule. Reading the owner straight off the path means a storage policy
-- needs no subquery against this table at all.
--
-- THIS REPLACES docs/connector/RECON.md answer 13 point 4, which proposed the
-- import_id as the first segment. See docs/connector/HANDOVER.md, EX-P05.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO. There is no trigger, no
-- function and no view here. updated_at is therefore the writer's job, not a
-- trigger's; expiry (EX-P13) and the two per-creator ceilings that the contract
-- says belong in the database arrive with the steps that need them. A table
-- that exists before the code that fills it is the point of this step.
-- =============================================================================


-- =============================================================================
-- 1. import_sessions
-- =============================================================================
-- One row per import, from the moment buildgallery_begin_import opens it to the
-- moment the browser claims it. The row carries state and counts; the
-- conversation text itself never lands here — it lives in the bucket below as
-- numbered objects, and what survives the parse lands in `proposal`.
--
-- user_id references auth.users rather than public.profiles because the
-- connector authenticates a token, not a profile, and (select auth.uid()) is
-- an auth.users id. ON DELETE CASCADE: a deleted account leaves no waiting
-- imports behind.
--
-- target_build_id and build_id are two different facts and are kept apart on
-- purpose. target_build_id is what the CREATOR ASKED FOR — an existing draft
-- named at finish_import — and build_id is WHERE IT ACTUALLY WENT once the
-- browser materialised it. They are equal on a successful import into a chosen
-- draft, and both ON DELETE SET NULL so a deleted build leaves the import's own
-- history legible rather than deleting it.
--
-- secret_findings holds [{kind, count}] and NOTHING ELSE. The whole point of
-- the scanner is that the secret does not survive; a findings column that
-- carried the matched text would hand it straight back.
CREATE TABLE public.import_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- which tool is sending; see the CHECK below
  client            TEXT NULL,
  -- a caller's hint at the format. A hint, never a verdict: detection reads
  -- content, never the filename and never this.
  source_hint       TEXT NULL,
  -- idempotency for begin_import: the same fingerprint, still unclaimed,
  -- returns the EXISTING import rather than opening a second one
  fingerprint       TEXT NULL,
  -- sha256 of the assembled, redacted text. Set by finish_import, never before:
  -- there is nothing to hash until the chunks are assembled, and hashing the
  -- unredacted text would make the digest a function of the secret.
  content_hash      TEXT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  -- chunks actually stored
  chunk_count       INTEGER NOT NULL DEFAULT 0,
  -- chunks the caller said it would send, so a gap is detectable at finish
  expected_chunks   INTEGER NULL,
  total_chars       INTEGER NOT NULL DEFAULT 0,
  -- what the caller claimed it was sending. Kept beside the measured counts so
  -- a caller that under-sends can be told so in the numbers it used itself.
  declared_turns    INTEGER NULL,
  declared_chars    INTEGER NULL,
  -- which intake reader won the bid, and the one line it gives for why
  reader_id         TEXT NULL,
  detection_reason  TEXT NULL,
  -- the intake envelope, stored unchanged. Data, never instruction: nothing
  -- reads this looking for something to obey.
  proposal          JSONB NULL,
  -- [{kind, count}] only. NEVER the secret.
  secret_findings   JSONB NULL,
  -- the creator-facing failure line, from the contract's error table. Never an
  -- internal error, never a stack trace, never any conversation content.
  error             TEXT NULL,
  target_build_id   UUID NULL REFERENCES public.builds(id) ON DELETE SET NULL,
  build_id          UUID NULL REFERENCES public.builds(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- no trigger maintains this in EX-P05; the writer sets it
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',

  -- The six clients the connector knows how to be called by. NULL passes, as
  -- an IN test against NULL is NULL and a CHECK admits NULL — an import whose
  -- caller did not say what it was is legal.
  --
  -- A caller naming a seventh client is NOT this constraint's problem to
  -- report: EX-P06's begin_import maps anything outside this list to
  -- 'unknown', so an unexpected value can never make the insert fail.
  CONSTRAINT import_sessions_client_check
    CHECK (client IN ('claude', 'claude-code', 'chatgpt', 'cursor', 'web', 'unknown')),

  -- open       — created, chunks may still arrive
  -- assembling — finish_import is running: reading, redacting, parsing
  -- parsed     — a proposal is waiting for the creator
  -- claimed    — the browser took it; the build exists
  -- failed     — it did not parse, and `error` says what the creator is told
  -- duplicate  — the same conversation was already waiting
  -- expired    — it outlived expires_at without being claimed
  CONSTRAINT import_sessions_status_check
    CHECK (status IN ('open', 'assembling', 'parsed', 'claimed', 'failed', 'duplicate', 'expired')),

  -- MAX_TOTAL_CHARS in supabase/functions/mcp/constants.ts, which is itself
  -- MAX_RAW_TEXT_CHARS. The edge function refuses a chunk that would cross this
  -- line and says so in the caller's own numbers; this CHECK is the backstop
  -- for the case the function cannot cover — concurrent appends, each legal on
  -- its own, that are not legal together.
  CONSTRAINT import_sessions_total_chars_check
    CHECK (total_chars <= 400000)
);


-- =============================================================================
-- 2. Indexes
-- =============================================================================
-- The composite serves buildgallery_list_imports. Column order is equality,
-- equality, then range: user_id and status are matched, created_at is ordered.
--
-- WHAT IT DOES AND DOES NOT DO, measured with EXPLAIN over 5,000 rows rather
-- than assumed:
--
--   WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC
--     -> Index Scan, no sort node. The whole query is the index.
--
--   WHERE user_id = $1 ORDER BY created_at DESC
--     -> Sort + Seq Scan. With no status predicate the rows under a user_id
--        are ordered by status FIRST, so created_at is not sorted within the
--        scan and the planner sorts. The index does not serve this ordering.
--
-- The second shape is the one buildgallery_list_imports asks for when the
-- caller names no state, so EX-P06 should either pass a status or expect the
-- sort. At a per-creator row count this is cheap; it is recorded here because
-- a composite index is easy to assume is doing more work than it is. A
-- (user_id, created_at DESC) index would serve the unfiltered shape, and is
-- not added now because EX-P05's brief fixes this index list.
CREATE INDEX idx_import_sessions_user_status_created
  ON public.import_sessions (user_id, status, created_at DESC);

-- Postgres does not index a foreign key for you. Both of these carry ON DELETE
-- SET NULL, and an unindexed one turns deleting a build into a full scan of
-- this table while holding a lock on it.
CREATE INDEX idx_import_sessions_target_build
  ON public.import_sessions (target_build_id);

CREATE INDEX idx_import_sessions_build
  ON public.import_sessions (build_id);

-- IDEMPOTENCY, MECHANISM ONE — begin_import.
-- The contract requires a retried begin_import to return the existing import
-- rather than open a second one. This index is what makes that a guarantee
-- instead of a race: two concurrent begins with the same fingerprint cannot
-- both insert. It is partial because the exclusion is meant to hold only over
-- imports that are still LIVE — an import that was claimed, expired, failed or
-- was already ruled a duplicate must not block the creator from sending that
-- same conversation again.
CREATE UNIQUE INDEX uniq_import_sessions_user_fingerprint
  ON public.import_sessions (user_id, fingerprint)
  WHERE fingerprint IS NOT NULL
    AND status NOT IN ('claimed', 'expired', 'duplicate', 'failed');

-- IDEMPOTENCY, MECHANISM THREE — finish_import.
-- finish_import hashes the assembled, redacted text and refuses to make a
-- second copy of a conversation already waiting. Scoped to status = 'parsed'
-- because that is precisely the set "waiting for review": once claimed, the
-- creator may legitimately import the same conversation into a second build.
CREATE UNIQUE INDEX uniq_import_sessions_user_content_hash
  ON public.import_sessions (user_id, content_hash)
  WHERE content_hash IS NOT NULL
    AND status = 'parsed';


-- =============================================================================
-- 3. Row level security — owner only, in all four directions
-- =============================================================================
-- An import is one account's private working material: a whole conversation,
-- pre-redaction on the way in, that its owner has not chosen to show anyone.
-- So there is no published-row escape hatch here and no admin escape hatch
-- either, which is what makes these four policies simpler than the ones on
-- build_media next door — the rule is the same rule four times.
--
-- Every current-user call is wrapped as (select auth.uid()) so Postgres
-- evaluates it once per statement rather than once per row.
--
-- TO authenticated on all four: anon holds no grant on this table (section 4)
-- and would fail the predicate anyway, but naming the role means an anonymous
-- caller is turned away before the predicate is ever considered.
--
-- UPDATE carries WITH CHECK as well as USING. USING alone would let an owner
-- hand a row to another account by rewriting user_id — the row would pass the
-- read test on the way in and vanish on the way out.

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import sessions are readable by their owner"
  ON public.import_sessions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Import sessions are opened by their owner"
  ON public.import_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Import sessions are updated by their owner"
  ON public.import_sessions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Import sessions are deleted by their owner"
  ON public.import_sessions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);


-- =============================================================================
-- 4. Grants — nothing to anon
-- =============================================================================
-- This REVOKE is not decoration. Supabase sets default privileges on the public
-- schema that grant ALL on a newly created table to anon, authenticated and
-- service_role, so a bare CREATE TABLE has already given anon a grant by the
-- time this line is read. RLS would still return no rows — anon's
-- (select auth.uid()) is NULL and NULL = user_id is never true — but "anon has
-- a grant that RLS happens to defeat" and "anon has no grant" are different
-- states, and only the second survives someone adding a permissive policy
-- later. The same belt-and-braces reasoning is at
-- 20260828160000_repoint_solutions.sql:221-226.
--
-- Revoking from authenticated first is what makes the GRANT below exact: the
-- default grant is ALL, which is wider than the four verbs this table needs.
--
-- service_role keeps the platform default deliberately — the mcp edge function
-- NEVER uses the service-role key (contract prohibition 2), but expiry and the
-- per-creator ceilings arrive later as database-side work, and revoking it here
-- would be this step reaching into theirs.
REVOKE ALL ON public.import_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_sessions TO authenticated;


-- =============================================================================
-- 5. The imports bucket
-- =============================================================================
-- Private. Nothing in it is served without a signed URL, so a chunk of somebody
-- half-sent conversation is as unreachable as the row that tracks it.
--
-- file_size_limit is 50,000 BYTES and MAX_CHUNK_CHARS is 40,000 CHARACTERS.
-- These are different units and the ceiling that bites first depends on the
-- text: 1.25 bytes per character of headroom covers ASCII and ordinary Latin-1
-- prose comfortably, and does not cover 40,000 characters of CJK or emoji,
-- which are three and four bytes each. The character ceiling is the one the
-- caller is told about and the one EX-P06 enforces, with the error naming the
-- limit and the next action; this byte limit is the storage API's own backstop
-- against an object that bypasses that path entirely.
--
-- allowed_mime_types is a single-entry list rather than NULL — the opposite of
-- the choice build-media made, and for the opposite reason. build-media accepts
-- a family of types whose list lives in media.ts beside the kind mapping that
-- depends on it, so a second copy here would eventually disagree. This bucket
-- accepts exactly one type, forever: a chunk of a conversation is text/plain.
-- There is no second list for it to disagree with.
--
-- ON CONFLICT (id) DO NOTHING so a replay of this migration against a database
-- that already has the bucket is a no-op rather than an error, matching
-- 20260823140000_build_media_storage.sql.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('imports', 'imports', false, 50000, ARRAY['text/plain'])
ON CONFLICT (id) DO NOTHING;


-- =============================================================================
-- 6. Object policies
-- =============================================================================
-- (storage.foldername(name))[1] is the first path segment: the owner's uid, per
-- the PATH CONVENTION at the top of this file. It is compared as text against
-- (select auth.uid())::text rather than casting the segment to uuid, because a
-- path whose first segment is not a uuid would make that cast ERROR rather than
-- simply fail the check — and a policy that can raise is a policy an attacker
-- can use to tell one failure from another.
--
-- Note the direction of the cast: auth.uid() is already a uuid and is cast
-- once, per statement, to text. Casting the other way — segment to uuid — would
-- be per row as well as raisable.
--
-- The dm-images precedent this pattern comes from (RECON answer 13) writes bare
-- auth.uid() in all four of its positions. That form re-evaluates per row and
-- is automatic-fail 1 in the code-review skill, so the structure is copied and
-- the predicate is not.
--
-- UPDATE carries WITH CHECK for the same reason the table's UPDATE policy does:
-- USING alone governs which objects may be touched, not where they may be moved
-- to, so an owner could rename an object into another account's folder.
--
-- There IS a DELETE policy here, where build-media's precedent has none. It is
-- not a widening of what the connector can do — the connector never deletes
-- anything, and destructiveHint stays false across all seven tools. It is the
-- creator binning their own waiting import from their own browser, which the
-- contract names as the one deletion in the whole feature.

CREATE POLICY "Import objects are readable by their owner"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Import objects are written by their owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Import objects are updated by their owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Import objects are deleted by their owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
