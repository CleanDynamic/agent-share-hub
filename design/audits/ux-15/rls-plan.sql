-- UX-15 Part 1: the RLS test plan, as a script.
--
-- A blocks B; then B cannot follow, message, reply to, like, react to, mention or comment on A, cannot start a topic from A's build,
-- cannot see the block row, and is not notified of A. A sees the block row. C (not blocked) still can do all of it.
--
-- HOW TO RUN. It was written against a scratch Postgres 16 with a stub of the touched tables (design/audits/ux-15/README.md says how
-- to rebuild it), then 20261111120000_ux15_settings_blocking.sql applied. Against the real project, run it in the SQL editor on a
-- branch or a copy, after the migration: it needs three throwaway users and a few rows that the real tables guard with more columns,
-- so on the real database use the same steps by hand with three test accounts (the list is the "-- T" comments). It ends in ROLLBACK.
--
-- psql -v ON_ERROR_STOP=1 -d <db> -f design/audits/ux-15/rls-plan.sql

BEGIN;

-- Fixtures, as the table owner ----------------------------------------------------------------------------------------------------
INSERT INTO auth.users (id) VALUES
  ('a0000000-0000-0000-0000-00000000000a'), ('b0000000-0000-0000-0000-00000000000b'), ('c0000000-0000-0000-0000-00000000000c');
INSERT INTO public.profiles (id, username) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'ava'), ('b0000000-0000-0000-0000-00000000000b', 'ben'), ('c0000000-0000-0000-0000-00000000000c', 'cy');
INSERT INTO public.builds (id, creator_id) VALUES ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a');
INSERT INTO public.openbuild_posts (id, author_id, root_id, body) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'a2000000-0000-0000-0000-000000000001', 'A topic');
INSERT INTO public.dm_threads (id, participant_a, participant_b, type) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'direct');
INSERT INTO public.dm_messages (id, thread_id, sender_id) VALUES
  ('a4000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a');
-- both follow each other before the block (T9)
INSERT INTO public.follows (follower_id, following_id) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b'),
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a');

CREATE SCHEMA ux15_t;
GRANT USAGE ON SCHEMA ux15_t TO authenticated;
-- A helper that runs a statement as a user and says whether the database refused it -------------------------------------------------
CREATE FUNCTION ux15_t.as_user(_uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', _uid::text, true);
END $$;

CREATE FUNCTION ux15_t.denied(_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION WHEN insufficient_privilege THEN
    RETURN;  -- the row-level policy refused it, which is what is wanted
  END;
  RAISE EXCEPTION 'NOT REFUSED: %', _sql;
END $$;

CREATE FUNCTION ux15_t.allowed(_sql text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE _sql;
END $$;


-- T0: before any block, B can reach A -------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT ux15_t.as_user('b0000000-0000-0000-0000-00000000000b');
SELECT ux15_t.allowed($q$ INSERT INTO public.post_likes (post_id, user_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $q$);
SELECT ux15_t.allowed($q$ INSERT INTO public.build_likes (build_id, user_id) VALUES ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $q$);
RESET ROLE;
DELETE FROM public.post_likes; DELETE FROM public.build_likes;

-- A blocks B ----------------------------------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT ux15_t.as_user('a0000000-0000-0000-0000-00000000000a');
INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
-- A cannot write a block as B
SELECT ux15_t.denied($q$ INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ('b0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000c') $q$);
RESET ROLE;

-- T9: the follows went, both ways
DO $$ BEGIN
  IF (SELECT count(*) FROM public.follows) <> 0 THEN RAISE EXCEPTION 'T9: follows survived the block'; END IF;
END $$;

-- T1 to T8: B can no longer reach A --------------------------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT ux15_t.as_user('b0000000-0000-0000-0000-00000000000b');
SELECT ux15_t.denied($q$ INSERT INTO public.follows (follower_id, following_id) VALUES ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a') $q$);                                  -- T1 follow
SELECT ux15_t.denied($q$ INSERT INTO public.dm_threads (participant_a, participant_b) VALUES ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b') $q$);                                -- T2 new thread
SELECT ux15_t.denied($q$ INSERT INTO public.dm_messages (thread_id, sender_id) VALUES ('a3000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $q$);                                       -- T3 message
SELECT ux15_t.denied($q$ INSERT INTO public.dm_reactions (message_id, user_id) VALUES ('a4000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $q$);                                       -- T3b message reaction
SELECT ux15_t.denied($q$ INSERT INTO public.openbuild_posts (author_id, parent_id, root_id, body) VALUES ('b0000000-0000-0000-0000-00000000000b', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'hi') $q$); -- T4 reply
SELECT ux15_t.denied($q$ INSERT INTO public.post_mentions (post_id, user_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a') $q$);                                          -- T5 mention
SELECT ux15_t.denied($q$ INSERT INTO public.post_likes (post_id, user_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $q$);                                             -- T6 like
SELECT ux15_t.denied($q$ INSERT INTO public.post_reactions (post_id, user_id, kind) VALUES ('a2000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b', 'dislike') $q$);                      -- T6 reaction
SELECT ux15_t.denied($q$ INSERT INTO public.build_likes (build_id, user_id) VALUES ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $q$);                                         -- T6b build like
SELECT ux15_t.denied($q$ INSERT INTO public.build_comments (build_id, author_id) VALUES ('a1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-00000000000b') $q$);                                    -- T7 build comment
SELECT ux15_t.denied($q$ INSERT INTO public.post_attachments (post_id, position, build_id) VALUES ('a2000000-0000-0000-0000-000000000001', 0, 'a1000000-0000-0000-0000-000000000001') $q$);                       -- T8 topic from A's build
-- T15: B cannot see the block, in either direction
DO $$ BEGIN
  IF (SELECT count(*) FROM public.user_blocks) <> 0 THEN RAISE EXCEPTION 'T15: B can read a block row'; END IF;
END $$;
-- T13: B asking about the pair gets the same fact the refused write gave; a stranger gets nothing
DO $$ BEGIN
  IF NOT public.is_blocked_between('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a') THEN RAISE EXCEPTION 'T13: B-A should be blocked'; END IF;
END $$;
SELECT ux15_t.as_user('c0000000-0000-0000-0000-00000000000c');
DO $$ BEGIN
  IF public.is_blocked_between('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b') THEN RAISE EXCEPTION 'T13: a stranger learned of a block'; END IF;
END $$;

-- C is not blocked: the same writes go through ------------------------------------------------------------------------------------
SELECT ux15_t.allowed($q$ INSERT INTO public.follows (follower_id, following_id) VALUES ('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a') $q$);
SELECT ux15_t.allowed($q$ INSERT INTO public.openbuild_posts (author_id, parent_id, root_id, body) VALUES ('c0000000-0000-0000-0000-00000000000c', 'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'hi') $q$);
SELECT ux15_t.allowed($q$ INSERT INTO public.post_likes (post_id, user_id) VALUES ('a2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c') $q$);
SELECT ux15_t.allowed($q$ INSERT INTO public.build_comments (build_id, author_id) VALUES ('a1000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c') $q$);
RESET ROLE;

-- A sees the row they wrote
SET LOCAL ROLE authenticated;
SELECT ux15_t.as_user('a0000000-0000-0000-0000-00000000000a');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.user_blocks) <> 1 THEN RAISE EXCEPTION 'A cannot read their own block'; END IF;
END $$;
RESET ROLE;

-- T10 and T11: notifications --------------------------------------------------------------------------------------------------------
SELECT public.rc_notify('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'post_like', NULL, 'post', 'a2000000-0000-0000-0000-000000000001', 'liked your topic');
SELECT public.rc_notify('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'post_like', NULL, 'post', 'a2000000-0000-0000-0000-000000000001', 'liked your topic');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.notifications) <> 0 THEN RAISE EXCEPTION 'T10: a notification crossed a block'; END IF;
END $$;
-- C hears of A (no preference stored: a missing key counts as on)
SELECT public.rc_notify('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'post_like', NULL, 'post', 'a2000000-0000-0000-0000-000000000001', 'liked your topic');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.notifications) <> 1 THEN RAISE EXCEPTION 'T11: a missing key did not count as on'; END IF;
END $$;
-- C turns post_like off: the next one is skipped; another kind still arrives
SET LOCAL ROLE authenticated;
SELECT ux15_t.as_user('c0000000-0000-0000-0000-00000000000c');
SELECT public.set_notification_preference('post_like', false);
RESET ROLE;
DELETE FROM public.notifications;
SELECT public.rc_notify('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'post_like', NULL, 'post', 'a2000000-0000-0000-0000-000000000099', 'liked your topic');
SELECT public.rc_notify('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'post_pinned', NULL, 'post', 'a2000000-0000-0000-0000-000000000099', 'pinned your topic');
SELECT public.rc_notify('c0000000-0000-0000-0000-00000000000c', 'a0000000-0000-0000-0000-00000000000a', 'solution', NULL, 'post', 'a2000000-0000-0000-0000-000000000098', 'retired kind still sent');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.notifications WHERE notification_type = 'post_like') <> 0 THEN RAISE EXCEPTION 'T11: a turned-off kind was written'; END IF;
  IF (SELECT count(*) FROM public.notifications WHERE notification_type = 'post_pinned') <> 1 THEN RAISE EXCEPTION 'T11: another kind was lost'; END IF;
  IF (SELECT count(*) FROM public.notifications WHERE notification_type = 'solution') <> 1 THEN RAISE EXCEPTION 'T11: a kind with no key must always be sent'; END IF;
END $$;

-- T12 and T14: the three reads were patched from their live text ------------------------------------------------------------------
DO $$
DECLARE _n int;
BEGIN
  SELECT (length(d) - length(replace(d, 'is_blocked_between', ''))) / length('is_blocked_between') INTO _n
    FROM (SELECT pg_get_functiondef('public.get_build_feed(timestamptz, integer, boolean)'::regprocedure) AS d) x;
  IF _n <> 9 THEN RAISE EXCEPTION 'T12: get_build_feed has % block checks, expected 9', _n; END IF;
  IF position('is_blocked_between' in pg_get_functiondef('public.profile_reader_view(text)'::regprocedure)) = 0 THEN RAISE EXCEPTION 'T13: profile_reader_view not patched'; END IF;
  IF position('is_blocked_between' in pg_get_functiondef('public.search_build_ids(text, integer)'::regprocedure)) = 0 THEN RAISE EXCEPTION 'T14: search_build_ids not patched'; END IF;
END $$;

-- T16 and T17: deleting A ---------------------------------------------------------------------------------------------------------
INSERT INTO public.openbuild_posts (id, author_id, root_id, body) VALUES
  ('c2000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-00000000000c', 'c2000000-0000-0000-0000-000000000001', 'C topic');
INSERT INTO public.openbuild_posts (id, author_id, parent_id, root_id, body) VALUES
  ('a2000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 'c2000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'A replies in C topic');
INSERT INTO public.legacy_items (id, creator_id, title) VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 'old item');
INSERT INTO public.legacy_notes (item_id, verified_by) VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.sub', '', true);  -- the service role carries no user
SELECT public.delete_account_rows('a0000000-0000-0000-0000-00000000000a');
SELECT public.delete_account_rows('a0000000-0000-0000-0000-00000000000a');  -- T17: a second run finds nothing and succeeds
RESET ROLE;  -- auth.admin.deleteUser runs as the auth service; here, the owner
DELETE FROM auth.users WHERE id = 'a0000000-0000-0000-0000-00000000000a';  -- the cascade and the SET NULL, through the patched guard
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.openbuild_posts WHERE id = 'a2000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'T16: the deleted person''s own topic survived'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.openbuild_posts WHERE id = 'a2000000-0000-0000-0000-000000000002' AND body = 'This reply was removed' AND author_id IS NULL AND removed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'T16: the reply in another person''s topic was not replaced';
  END IF;
  IF EXISTS (SELECT 1 FROM public.legacy_items WHERE creator_id = 'a0000000-0000-0000-0000-00000000000a') THEN RAISE EXCEPTION 'T16: a no-cascade row survived'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-00000000000a') THEN RAISE EXCEPTION 'T16: the profile survived'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_blocks) THEN RAISE EXCEPTION 'T16: the block row survived its blocker'; END IF;
END $$;

SELECT 'UX-15 RLS plan: all checks passed' AS result;
ROLLBACK;
