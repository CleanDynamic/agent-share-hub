-- =============================================================================
-- buildgallery — nightly import expiry (EX-P13, migration 2 of 2)
-- =============================================================================
-- APPLY AFTER 20260921120000_import_ceilings.sql. That one installs the ceiling
-- trigger; this one installs the sweep that keeps the open ceiling from being a
-- one-way door, and section 1 below asserts against a table that one has
-- already changed.
--
-- An import that is never finished and never claimed would otherwise hold one
-- of its creator's five open slots for ever. EX-P05 gave every row an
-- expires_at (now() + 7 days, IMPORT_TTL_DAYS); nothing has ever read it.
-- This is what reads it.
--
-- THERE ARE TWO SWEEPS, AND THIS IS THE SECOND.
--
--   1. begin_import, in supabase/functions/mcp/index.ts, expires the CALLER'S
--      OWN overdue rows under the caller's own client at the start of every
--      open, and deletes their chunk objects. That one has a session, so it
--      can reach storage; it is what makes the open ceiling self-healing for
--      an active creator, because it runs immediately before the insert the
--      ceiling trigger is about to count.
--
--   2. This job, nightly, for EVERYONE — including the creator who connected
--      once, left five imports open and never came back, whose rows sweep 1
--      will never run over because they never call begin_import again.
--
-- THIS ONE TOUCHES NO STORAGE, deliberately. Object deletion needs the storage
-- API, which needs an HTTP call and a session; a cron job has neither, and
-- reaching for the service-role key to give it one is contract prohibition 2.
-- So the nightly job flips status and nothing else. A leftover chunk object in
-- a private bucket, readable by exactly one account that has already been told
-- its import expired, is a tolerable residue; a service-role key in this
-- feature is not. Sweep 1 collects those objects the next time that creator
-- opens an import.
--
-- =============================================================================
-- ON pg_cron AND LOVABLE CLOUD
-- =============================================================================
-- pg_cron is ALREADY INSTALLED on this project: migration
-- 20260318160154_f6278df5-990c-4693-ad81-d9ffe100399e.sql runs
-- CREATE EXTENSION IF NOT EXISTS pg_cron, and has been deployed. So the
-- expectation is that section 3 schedules cleanly.
--
-- It is not ASSUMED, for two reasons. The Supabase CLI is not used on this
-- project, so nothing here has been run against zybdotagjwektucfdkri; and that
-- migration installs the extension WITH SCHEMA extensions, whereas pg_cron's
-- own objects conventionally live in a schema named cron. Section 3 therefore
-- resolves the extension's real schema from the catalogue instead of naming
-- either, and if pg_cron is absent it raises a WARNING naming the fact that no
-- job was scheduled rather than failing the deploy or passing silently.
-- =============================================================================


-- =============================================================================
-- 1. The precondition this job cannot work without
-- =============================================================================
-- expire_import_sessions is SECURITY INVOKER, so the nightly UPDATE runs as
-- whichever role scheduled the job — and that role must not be subject to RLS
-- on import_sessions, or the job runs every night, reports success, and expires
-- nothing belonging to anybody. RLS would filter the UPDATE to rows where
-- (select auth.uid()) = user_id, and a cron job has no auth.uid() at all, so
-- the filter would match zero rows and the UPDATE would report zero and raise
-- nothing. That is the exact failure mode a nightly job must not have.
--
-- A role is exempt from RLS when it holds BYPASSRLS, or when it owns the table
-- (or is a member of the owning role) and FORCE ROW LEVEL SECURITY is off.
-- EX-P05 enabled RLS and did not FORCE it, so owner exemption is the mechanism
-- this job relies on.
--
-- Both halves are asserted here rather than trusted, and the assertion ABORTS
-- THE MIGRATION on failure. That is deliberate and it is the louder of the two
-- available failures: a migration that stops with this message is a deploy that
-- needs a decision, where a migration that schedules the job anyway is a
-- feature that is quietly broken for as long as nobody checks. Migration 1 is a
-- separate file precisely so the ceilings land either way.
--
-- If this fires, the fix is a design conversation, not a workaround. Do NOT
-- reach for SECURITY DEFINER to get round it: that would give the function its
-- creator's privileges over every row in the table, which is the bypass this
-- assertion exists to make explicit rather than accidental.
DO $$
DECLARE
  _owner      NAME;
  _forced     BOOLEAN;
  _bypassrls  BOOLEAN;
  _exempt     BOOLEAN;
BEGIN
  SELECT pg_get_userbyid(c.relowner), c.relforcerowsecurity
  INTO _owner, _forced
  FROM pg_class c
  WHERE c.oid = 'public.import_sessions'::regclass;

  SELECT r.rolbypassrls INTO _bypassrls
  FROM pg_roles r
  WHERE r.rolname = current_user;

  -- pg_has_role(..., 'USAGE') is true when current_user IS the owner and when
  -- it is a member of the owning role, which is the same set of roles Postgres
  -- exempts from RLS. Checking it is stricter than comparing names.
  _exempt := coalesce(_bypassrls, false)
             OR (NOT _forced AND pg_has_role(current_user, _owner, 'USAGE'));

  IF NOT _exempt THEN
    RAISE EXCEPTION
      'EX-P13 ABORTED: role % cannot bypass RLS on public.import_sessions (owner %, FORCE ROW LEVEL SECURITY %). A pg_cron job scheduled by this role would run every night and expire nothing. Resolve before scheduling; do not switch the function to SECURITY DEFINER to get round it.',
      current_user, _owner, _forced;
  END IF;

  RAISE NOTICE
    'EX-P13: % may bypass RLS on public.import_sessions (owner %, forced %, bypassrls %) — the nightly job will see every creator''s rows',
    current_user, _owner, _forced, coalesce(_bypassrls, false);
END
$$;


-- =============================================================================
-- 2. The expiry function
-- =============================================================================
-- Status only. No storage, no delete, no proposal touched, nothing written that
-- a creator would have to undo — an expired row keeps its counts, its reader,
-- its detection_reason and its error, so an import that ran out of time still
-- reads as what it was.
--
-- The three live states are exactly the ones EX-P05's CHECK calls live:
--   open       — chunks may still arrive
--   assembling — finish_import was running
--   parsed     — a proposal was waiting and nobody came for it
-- claimed, failed, duplicate and expired are terminal states and are left alone;
-- re-expiring an expired row would churn updated_at nightly for ever.
--
-- SECURITY INVOKER, per the step's own condition, with section 1 above
-- asserting that the invoking role can actually see other creators' rows.
-- SET search_path = '' for the same reason as migration 1.
--
-- Returns the number of rows flipped so a manual run says what it did, and so
-- the cron job's own record carries something more useful than "SELECT 1".
CREATE OR REPLACE FUNCTION public.expire_import_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _expired INTEGER;
BEGIN
  UPDATE public.import_sessions
  SET status     = 'expired',
      updated_at = now()
  WHERE expires_at < now()
    AND status IN ('open', 'assembling', 'parsed');

  GET DIAGNOSTICS _expired = ROW_COUNT;

  RETURN _expired;
END
$$;

COMMENT ON FUNCTION public.expire_import_sessions() IS
  'Nightly sweep: flips public.import_sessions past expires_at from open/assembling/parsed to expired. Status only — it touches no storage, because a cron job has no session to reach the storage API with and the mcp function may never use the service-role key. Returns the number of rows flipped.';


-- =============================================================================
-- 2b. Execute privileges
-- =============================================================================
-- Postgres grants EXECUTE on a new function to PUBLIC, and public is an exposed
-- schema, so without this the function is a PostgREST RPC endpoint that anon
-- and authenticated can both call. Under RLS an authenticated caller would only
-- expire their own rows, so this is not a data leak — but it is an unadvertised
-- write endpoint on the connector's table, reachable by anyone with the anon
-- key, and nothing needs it: the job runs as the owner, and owners may always
-- execute their own functions regardless of these grants.
--
-- service_role is revoked too. Nothing in this feature holds that key — the mcp
-- function never touches it (contract prohibition 2) — so a grant to it would
-- be a door with no one behind it.
REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM anon, authenticated, service_role;


-- =============================================================================
-- 3. The nightly job
-- =============================================================================
-- 03:20 UTC daily. Off the hour and off the half hour on purpose: every other
-- scheduled thing in the world runs at :00, and an expiry sweep has no reason
-- to queue behind them.
--
-- The schedule is resolved through the catalogue rather than written as
-- cron.schedule(...) or extensions.schedule(...), because this project installed
-- pg_cron WITH SCHEMA extensions and pg_cron conventionally owns a schema named
-- cron. Reading extnamespace is correct under either.
--
-- Unscheduled first, so re-applying this migration re-points the job rather
-- than colliding with itself.
--
-- WHICH ROLE THE JOB RUNS AS: whichever role executes this migration. pg_cron
-- records current_user on the job row and runs it as that role thereafter.
-- Section 1 has already refused to let this file get here if that role cannot
-- bypass RLS on import_sessions.
DO $$
DECLARE
  _cron_schema NAME;
  _job_name    CONSTANT TEXT := 'expire-import-sessions';
  _schedule    CONSTANT TEXT := '20 3 * * *';
  _command     CONSTANT TEXT := 'SELECT public.expire_import_sessions();';
BEGIN
  SELECT n.nspname
  INTO _cron_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_cron';

  IF _cron_schema IS NULL THEN
    RAISE WARNING
      'EX-P13: pg_cron is not installed, so the nightly job "%" was NOT scheduled. public.expire_import_sessions() exists and is correct, but nothing calls it: imports will only expire when their own creator next opens an import. Install pg_cron and re-run this migration, or schedule the call some other way.',
      _job_name;
    RETURN;
  END IF;

  -- unschedule() raises if the job does not exist, so it is guarded rather
  -- than swallowed: an exception handler here would also hide a real failure.
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = _cron_schema AND c.relname = 'job'
  ) THEN
    EXECUTE format(
      'SELECT %I.unschedule(jobid) FROM %I.job WHERE jobname = %L',
      _cron_schema, _cron_schema, _job_name
    );
  END IF;

  EXECUTE format(
    'SELECT %I.schedule(%L, %L, %L)',
    _cron_schema, _job_name, _schedule, _command
  );

  RAISE NOTICE
    'EX-P13: scheduled "%" at % (UTC) as role %, running %',
    _job_name, _schedule, current_user, _command;
END
$$;
