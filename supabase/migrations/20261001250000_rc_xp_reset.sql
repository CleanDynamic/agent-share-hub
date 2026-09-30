-- =============================================================================
-- RC-P25 — every user's progress returns to the start, and the old ledger is kept
-- =============================================================================
-- XP-DESIGN.md › Reset: "Every user's xp_total and level return to 0 and 1 on
-- deploy. xp_events is copied to rc_backup, then emptied."
--
-- WHAT IT DOES, in one block and in this order:
--   1. copies public.xp_events and public.user_progress, whole, into
--      rc_backup.xp_events_pre_reset and rc_backup.user_progress_pre_reset;
--   2. sets every XP-derived column of user_progress back to where a new
--      account starts:
--        xp_total     0     the total
--        level        1     the level a total of 0 has on the curve
--        track_xp     0     the XP earned inside a chosen track
--        eligible_at  NULL  the moment the total first reached 250
--   3. empties public.xp_events.
--
-- LEFT ALONE, on purpose. The streak columns (streak_days, streak_current,
-- streak_best, freezes_used_month, last_active_date) and the streak_days table:
-- the series' "must not change". Not XP: track, last_respec_at,
-- depth_revealed_at, welcome_xp_shown_at, counters, quest_state, created_at,
-- updated_at, user_id. Also the level curve and every policy and grant, and the
-- tables the badge catalogue will use, which RC-P26 decides.
--
-- THE COLUMN LIST IS CHECKED, NOT ASSUMED. The two lists above are the columns
-- the repository and the generated types know. If the live table holds any
-- other column, this stops before changing anything and names it: a column
-- derived from XP that the reset did not know about would be left claiming XP
-- nobody has any more.
--
-- IT RUNS ONCE. If either backup table exists the reset has already run, and
-- this says so and changes nothing: a second run would erase what people have
-- earned since the first, and the backup it kept would be the wrong one. To run
-- it again on purpose, drop the two backup tables first.
--
-- IT NEEDS rc_backup, made by 20261001120000 (Deploy queue item 3). It does not
-- create the schema: RC-P02 refuses to run in a schema that already holds a
-- table, so a reset that made it first would spoil the legacy backup.
--
-- A CONSISTENT COPY. The two tables are locked against writers from before the
-- copy to the commit, so no XP can land between the copy and the delete and be
-- erased without being kept ⟦references/lock-short-transactions.md⟧. Both are
-- small, so the lock is brief.
--
-- THE BACKUP IS PRIVATE. rc_backup is not an API schema and RC-P02 revoked it
-- from PUBLIC, anon and authenticated; the two new tables are revoked as well,
-- so nothing depends on the schema's privileges alone
-- ⟦references/security-privileges.md⟧.
-- =============================================================================

DO $$
DECLARE
  _reset_cols constant text[] := ARRAY['xp_total', 'level', 'track_xp', 'eligible_at'];
  _kept_cols  constant text[] := ARRAY[
    'user_id', 'counters', 'quest_state', 'track', 'last_respec_at', 'depth_revealed_at',
    'welcome_xp_shown_at', 'streak_days', 'streak_current', 'streak_best',
    'freezes_used_month', 'last_active_date', 'created_at', 'updated_at'
  ];
  _unknown  text;
  _events   bigint;
  _progress bigint;
  _reset    bigint;
  _deleted  bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'rc_backup') THEN
    RAISE EXCEPTION 'RC-P25: the schema rc_backup does not exist, so there is nowhere to keep the old progress; nothing was changed. Apply the legacy backup (Deploy queue item 3) first';
  END IF;

  IF to_regclass('rc_backup.xp_events_pre_reset') IS NOT NULL
     OR to_regclass('rc_backup.user_progress_pre_reset') IS NOT NULL THEN
    RAISE NOTICE 'RC-P25: the reset has already run (a pre-reset backup exists); nothing was changed';
    RETURN;
  END IF;

  SELECT string_agg(a.attname, ', ' ORDER BY a.attnum) INTO _unknown
    FROM pg_attribute a
   WHERE a.attrelid = 'public.user_progress'::regclass
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.attname <> ALL (_reset_cols || _kept_cols);

  IF _unknown IS NOT NULL THEN
    RAISE EXCEPTION 'RC-P25: public.user_progress holds columns this reset has not classified as XP or not XP: %; nothing was changed. Send the list so each can be classified, and never edit this check to get past it', _unknown;
  END IF;

  LOCK TABLE public.xp_events, public.user_progress IN SHARE ROW EXCLUSIVE MODE;

  CREATE TABLE IF NOT EXISTS rc_backup.xp_events_pre_reset AS SELECT * FROM public.xp_events;
  GET DIAGNOSTICS _events = ROW_COUNT;

  CREATE TABLE IF NOT EXISTS rc_backup.user_progress_pre_reset AS SELECT * FROM public.user_progress;
  GET DIAGNOSTICS _progress = ROW_COUNT;

  REVOKE ALL ON TABLE rc_backup.xp_events_pre_reset, rc_backup.user_progress_pre_reset
    FROM PUBLIC, anon, authenticated;

  -- Only the rows that are not at the start already, so a person who never
  -- earned anything keeps their row untouched.
  UPDATE public.user_progress
     SET xp_total    = 0,
         level       = 1,
         track_xp    = 0,
         eligible_at = NULL
   WHERE xp_total <> 0 OR level <> 1 OR track_xp <> 0 OR eligible_at IS NOT NULL;
  GET DIAGNOSTICS _reset = ROW_COUNT;

  DELETE FROM public.xp_events;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  -- Read it back. Any failure here rolls the whole block back.
  IF _deleted <> _events THEN
    RAISE EXCEPTION 'RC-P25: % ledger rows were copied and % were removed', _events, _deleted;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_progress
     WHERE xp_total <> 0 OR level <> 1 OR track_xp <> 0 OR eligible_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'RC-P25: some progress rows are not at the start after the reset';
  END IF;

  RAISE NOTICE 'RC-P25: % ledger row(s) and % progress row(s) kept in rc_backup; % progress row(s) reset to 0 XP, level 1; the ledger is empty', _events, _progress, _reset;
END
$$;
