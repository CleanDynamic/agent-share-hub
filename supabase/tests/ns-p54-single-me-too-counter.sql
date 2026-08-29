-- =============================================================================
-- NeoScale — one me-too counter, not two: acceptance checks (NS-P54)
-- =============================================================================
-- Proves the NS-P54 commit-3 acceptances that are facts about Postgres rather
-- than about TypeScript:
--
--   1. public.update_bounty_me_too_count() keeps the posture NS-P47 gave it —
--      SECURITY DEFINER, search_path pinned empty, EXECUTE revoked from PUBLIC,
--      anon and authenticated — and its body no longer names content_items
--   2. the trigger on public.bounty_me_too is UNCHANGED: still
--      AFTER INSERT OR DELETE, still FOR EACH ROW, still the same name. The
--      migration replaces a function body and nothing else
--   3. content_items.bounty_me_too_count still EXISTS, with its type and its
--      value. It is frozen, not dropped and not zeroed
--   4. THE COUNTER CLAIM, end to end: a me-too write moves
--      bounties.me_too_count and leaves content_items.bounty_me_too_count
--      exactly where it was, on the way up AND on the way down
--   5. the new path's own me-too is untouched: bounty_me_too_marks still has
--      its own trigger maintaining the same bounties column, and NS-P54 did not
--      go near it
--
-- USAGE
--   psql "$DATABASE_URL" -f supabase/tests/ns-p54-single-me-too-counter.sql
--
-- It takes no parameters: everything it needs it creates, and the whole script
-- runs inside one transaction and ends in ROLLBACK. It leaves nothing behind
-- and is safe against a database with real rows.
--
-- WHAT IT DOES ON A DATABASE WHERE GENERATION 1 WAS NEVER APPLIED. It says so
-- and stops. public.bounty_me_too answers PGRST205 on the project in
-- supabase/config.toml — the NS-P44 audit measured it and NS-P47's own DO block
-- already took its "nothing installed" branch there — so checks 1 to 4 have no
-- subject on that host. Check 5 still runs where bounty_me_too_marks exists.
--
-- RUN AT THE TIME OF WRITING, unlike the NS-P52 script, against a real
-- PostgreSQL 16.13. The harness carried profiles, content_items, bounties,
-- bounty_me_too and bounty_me_too_marks in the shapes their migrations give
-- them, the NS-P47 dual-write function copied verbatim from
-- 20260829120000_repoint_bounty_satellites.sql section 11, and the anon and
-- authenticated roles the REVOKE names.
--
--   * Before the migration: CHECK 1 FAILED, naming the surviving content_items
--     leg. That is what makes the five passes below worth reading — the script
--     is a gate, not a formality.
--   * After it: all five passed, with check 4 showing bounties.me_too_count
--     move 0 -> 1 -> 0 while content_items.bounty_me_too_count stayed at 41.
--   * The migration's three guard branches were exercised on three separate
--     databases: bounty_me_too absent (NOTICE, no-op — the live project's
--     case), the trigger detached (WARNING, no-op), and public.bounties absent
--     (WARNING, dual-write left in place).
--
-- That harness is not this project. The first run HERE is still where the
-- migration's behaviour against real rows and real RLS is established.
-- =============================================================================

BEGIN;

\set ON_ERROR_STOP on

-- =============================================================================
-- 0. Is there anything to check?
-- =============================================================================
DO $$
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL THEN
    RAISE NOTICE 'NS-P54 checks 1-4 SKIPPED: public.bounty_me_too is absent (generation 1, never applied on this database). The migration is a no-op here and says so in its own NOTICE.';
  END IF;
END
$$;


-- =============================================================================
-- 1. The function's posture, and that its body no longer names content_items
-- =============================================================================
-- The body check is a substring test on prosrc, which is a blunt instrument and
-- is used deliberately: the claim is "this function cannot write that column",
-- and the only way it could is by naming it.
--
-- LINE COMMENTS ARE STRIPPED FIRST, and that is not a loophole — it is the
-- difference between the test asserting what the function DOES and asserting
-- what it SAYS. prosrc carries the comments, and the surviving body deliberately
-- explains where the removed UPDATE stood, which named the column. Written
-- without this strip, this check failed on its own explanation. The strip
-- handles `--` comments, which are the only kind in that body.
DO $$
DECLARE
  _src   TEXT;
  _body  TEXT;
  _sec   BOOLEAN;
  _cfg   TEXT[];
  _acl   TEXT;
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL THEN RETURN; END IF;

  SELECT p.prosrc, p.prosecdef, p.proconfig, COALESCE(array_to_string(p.proacl, ' '), '(default)')
  INTO _src, _sec, _cfg, _acl
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'update_bounty_me_too_count';

  IF _src IS NULL THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: public.update_bounty_me_too_count() does not exist';
  END IF;

  _body := regexp_replace(_src, '--[^' || chr(10) || ']*', '', 'g');

  IF _body ILIKE '%content_items%' THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: the function body still names content_items outside a comment — the dual-write leg was not removed';
  END IF;

  IF _body NOT ILIKE '%public.bounties%' THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: the function body does not name public.bounties — there is no counter left for it to write';
  END IF;

  IF NOT _sec THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: the function is no longer SECURITY DEFINER; the marker is not the bounty author and the UPDATE policy on bounties admits only the author';
  END IF;

  -- Postgres stores `SET search_path = ''` in proconfig as the quoted form
  -- search_path="" on 16, and the bare search_path= on some earlier versions.
  -- Both mean pinned-empty; anything else means a caller's path can decide
  -- which `bounties` a SECURITY DEFINER function writes.
  IF _cfg IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(_cfg) AS c WHERE c IN ('search_path=', 'search_path=""')
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: search_path is not pinned empty on a SECURITY DEFINER function (proconfig = %)', _cfg;
  END IF;

  IF _acl ILIKE '%anon=X%' OR _acl ILIKE '%authenticated=X%' OR _acl ILIKE '%=X/%postgres%,%' THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: EXECUTE is still granted to a client role (acl = %)', _acl;
  END IF;

  RAISE NOTICE 'CHECK 1 PASSED: single-leg body, SECURITY DEFINER, search_path pinned, EXECUTE not held by a client role.';
END
$$;


-- =============================================================================
-- 2. The trigger is unchanged
-- =============================================================================
-- NS-P54 replaces a function body. If the trigger's name, timing, events or
-- level moved, something else happened.
DO $$
DECLARE
  _def TEXT;
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL THEN RETURN; END IF;

  SELECT pg_get_triggerdef(oid) INTO _def
  FROM pg_trigger
  WHERE tgrelid = 'public.bounty_me_too'::regclass
    AND tgname = 'trg_update_bounty_me_too_count'
    AND NOT tgisinternal;

  IF _def IS NULL THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: trg_update_bounty_me_too_count is gone from public.bounty_me_too';
  END IF;
  IF _def NOT ILIKE '%AFTER INSERT OR DELETE%' OR _def NOT ILIKE '%FOR EACH ROW%' THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: the trigger changed shape: %', _def;
  END IF;

  RAISE NOTICE 'CHECK 2 PASSED: trigger unchanged — AFTER INSERT OR DELETE, FOR EACH ROW.';
END
$$;


-- =============================================================================
-- 3. The frozen column is still there
-- =============================================================================
-- Frozen means the value stops changing. It does not mean dropped, and it does
-- not mean zeroed — a zero would assert that nobody ever needed those bounties,
-- which is false, where the last true value is a record.
DO $$
DECLARE
  _type TEXT;
BEGIN
  SELECT format_type(atttypid, atttypmod) INTO _type
  FROM pg_attribute
  WHERE attrelid = 'public.content_items'::regclass
    AND attname = 'bounty_me_too_count'
    AND NOT attisdropped;

  IF _type IS NULL THEN
    RAISE NOTICE 'CHECK 3 SKIPPED: content_items.bounty_me_too_count does not exist on this database (generation 1 was never applied). Nothing to freeze.';
  ELSE
    RAISE NOTICE 'CHECK 3 PASSED: content_items.bounty_me_too_count still exists as %, not dropped.', _type;
  END IF;
END
$$;


-- =============================================================================
-- 4. The counter claim, end to end
-- =============================================================================
-- A legacy bounty, its header, a starting value on the frozen column that is
-- NOT zero and NOT equal to the row count — so "frozen" and "recomputed" cannot
-- be confused for each other — then a me-too in and a me-too out.
DO $$
DECLARE
  _item     UUID;
  _header   UUID;
  _user     UUID;
  _frozen0  INTEGER;
  _frozen1  INTEGER;
  _frozen2  INTEGER;
  _live1    INTEGER;
  _live2    INTEGER;
  _mark     UUID;
BEGIN
  IF to_regclass('public.bounty_me_too') IS NULL
     OR to_regclass('public.bounties') IS NULL THEN
    RAISE NOTICE 'CHECK 4 SKIPPED: bounty_me_too and/or bounties is absent on this database.';
    RETURN;
  END IF;

  SELECT id INTO _user FROM public.profiles LIMIT 1;
  IF _user IS NULL THEN
    RAISE NOTICE 'CHECK 4 SKIPPED: no profiles row to mark as.';
    RETURN;
  END IF;

  INSERT INTO public.content_items (creator_id, title, content_type, difficulty, status, post_type)
  VALUES (_user, 'NS-P54 check', 'Prompt File', 'Any', 'draft', 'bounty')
  RETURNING id INTO _item;

  -- A distinctive starting value: not 0, and not the number of rows that will
  -- exist, so a body that recomputed it would be caught rather than coincide.
  UPDATE public.content_items SET bounty_me_too_count = 41 WHERE id = _item;

  INSERT INTO public.bounties (legacy_item_id, author_id, status)
  VALUES (_item, _user, 'open')
  RETURNING id INTO _header;

  SELECT bounty_me_too_count INTO _frozen0 FROM public.content_items WHERE id = _item;

  -- UP
  INSERT INTO public.bounty_me_too (content_id, user_id)
  VALUES (_item, _user)
  RETURNING id INTO _mark;

  SELECT bounty_me_too_count INTO _frozen1 FROM public.content_items WHERE id = _item;
  SELECT me_too_count        INTO _live1   FROM public.bounties      WHERE id = _header;

  IF _frozen1 IS DISTINCT FROM _frozen0 THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: the frozen counter moved on insert: % -> %', _frozen0, _frozen1;
  END IF;
  IF _live1 IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: bounties.me_too_count did not move on insert (got %)', _live1;
  END IF;

  -- DOWN
  DELETE FROM public.bounty_me_too WHERE id = _mark;

  SELECT bounty_me_too_count INTO _frozen2 FROM public.content_items WHERE id = _item;
  SELECT me_too_count        INTO _live2   FROM public.bounties      WHERE id = _header;

  IF _frozen2 IS DISTINCT FROM _frozen0 THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: the frozen counter moved on delete: % -> %', _frozen0, _frozen2;
  END IF;
  IF _live2 IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: bounties.me_too_count did not move back on delete (got %)', _live2;
  END IF;

  RAISE NOTICE 'CHECK 4 PASSED: one me-too moved bounties.me_too_count 0->1->0 and left content_items.bounty_me_too_count at % throughout.', _frozen0;
END
$$;


-- =============================================================================
-- 5. The new path's me-too is untouched
-- =============================================================================
-- bounty_me_too_marks (20260829200000) is the me-too a bounty on a BUILD
-- collects. It has always maintained exactly one counter — the same
-- bounties.me_too_count — through its own trigger. NS-P54 must not have gone
-- near it: two triggers writing one column is how a counter starts drifting.
DO $$
DECLARE
  _def TEXT;
  _src TEXT;
BEGIN
  IF to_regclass('public.bounty_me_too_marks') IS NULL THEN
    RAISE NOTICE 'CHECK 5 SKIPPED: bounty_me_too_marks is absent (20260829200000 not applied here).';
    RETURN;
  END IF;

  SELECT pg_get_triggerdef(oid) INTO _def
  FROM pg_trigger
  WHERE tgrelid = 'public.bounty_me_too_marks'::regclass
    AND tgname = 'trg_bounty_me_too_count'
    AND NOT tgisinternal;

  IF _def IS NULL THEN
    RAISE EXCEPTION 'CHECK 5 FAILED: trg_bounty_me_too_count is gone from bounty_me_too_marks';
  END IF;

  SELECT p.prosrc INTO _src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'recount_bounty_me_too';

  IF _src IS NULL OR _src NOT ILIKE '%bounty_me_too_marks%' THEN
    RAISE EXCEPTION 'CHECK 5 FAILED: recount_bounty_me_too() no longer recounts from bounty_me_too_marks';
  END IF;

  RAISE NOTICE 'CHECK 5 PASSED: the new path''s me-too trigger and function are unchanged.';
END
$$;

ROLLBACK;
