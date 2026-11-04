-- =============================================================================
-- UX-04 Part 5: notifications about posts. Acceptance checks.
-- =============================================================================
--   1. a reply tells the parent's author once, in plain words, and never the replier
--   2. a reply two deep tells the parent's author and, once, the root's author; the root's author is not told twice
--   3. a mention tells the mentioned person, never the author mentioning themselves, and not a person the reply already told
--   4. a like tells the post's author, never the liker
--   5. a root post that attaches someone else's work tells that work's maker; attaching your own tells nobody; a reply tells nobody
--   6. a pin tells the pinned post's author, never the pinner
--   7. no message holds an em dash
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v mod_id=<profiles.id> -v member_id=<profiles.id> \
--     -v stranger_id=<profiles.id> -f supabase/tests/ux04-p5-notifications.sql
-- creator_id writes the root post and pins, member_id and stranger_id reply and react, mod_id is mentioned. Four different existing profiles.
-- One transaction, ended by ROLLBACK. Every check raises on failure.
-- =============================================================================

\if :{?stranger_id}
\else
  \echo 'ERROR: pass -v creator_id, mod_id, member_id and stranger_id (four different profiles.id uuids)'
  \quit
\endif
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
BEGIN;
\ir ux04-helpers.sql

-- how many notifications of a kind a person has about a post, and from whom
CREATE FUNCTION pg_temp.told(who uuid, kind text, post uuid) RETURNS integer LANGUAGE sql AS $$
  SELECT count(*)::int FROM public.notifications n WHERE n.recipient_id = who AND n.notification_type = kind AND n.target_id = post
$$;

-- Setup: the creator's build (published) with a step, and an opted-out build, as the connecting role.
SELECT pg_temp.as_admin();
INSERT INTO public.builds (creator_id, slug, title, shape, status, published_at, allow_as_post_source) VALUES
  (:'creator_id', 'ux04-n-build', 'N build', 'app', 'published', now(), true),
  (:'stranger_id', 'ux04-n-own', 'Own build', 'app', 'published', now(), true);
SELECT id AS cbuild FROM public.builds WHERE slug = 'ux04-n-build' \gset
SELECT id AS sbuild FROM public.builds WHERE slug = 'ux04-n-own' \gset

SELECT pg_temp.as_user(:'creator_id');
SELECT public.create_post('{"body":"root"}') AS root \gset

-- 1
SELECT pg_temp.as_user(:'member_id');
SELECT public.create_post(jsonb_build_object('body','one','parent_id',:'root')) AS r1 \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('1a the root''s author is told once', pg_temp.told(:'creator_id', 'post_reply', :'r1') = 1);
SELECT pg_temp.expect('1b in plain words', (SELECT body FROM public.notifications WHERE target_id = :'r1' AND notification_type = 'post_reply') = 'replied to your topic');
SELECT pg_temp.expect('1c and the replier is not told', NOT EXISTS (SELECT 1 FROM public.notifications WHERE recipient_id = :'member_id' AND target_id = :'r1'));
SELECT pg_temp.expect('1d the actor is the replier', (SELECT actor_id FROM public.notifications WHERE target_id = :'r1' AND notification_type = 'post_reply') = :'member_id'::uuid);
SELECT pg_temp.expect('1e the root''s author is not told twice (parent and root are the same person)', pg_temp.told(:'creator_id', 'post_thread', :'r1') = 0);

-- 2
SELECT pg_temp.as_user(:'stranger_id');
SELECT public.create_post(jsonb_build_object('body','two','parent_id',:'r1')) AS r2 \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('2a the parent''s author is told', pg_temp.told(:'member_id', 'post_reply', :'r2') = 1);
SELECT pg_temp.expect('2b with words for a reply', (SELECT body FROM public.notifications WHERE target_id = :'r2' AND notification_type = 'post_reply') = 'replied to your reply');
SELECT pg_temp.expect('2c the root''s author is told once, as the thread''s owner', pg_temp.told(:'creator_id', 'post_thread', :'r2') = 1 AND pg_temp.told(:'creator_id', 'post_reply', :'r2') = 0);
SELECT pg_temp.expect('2d the replier is not told', NOT EXISTS (SELECT 1 FROM public.notifications WHERE recipient_id = :'stranger_id' AND target_id = :'r2'));
SELECT pg_temp.as_user(:'creator_id');
SELECT public.create_post(jsonb_build_object('body','three','parent_id',:'r2')) AS r3 \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('2e the root''s author replying deep is not told of themselves', pg_temp.told(:'creator_id', 'post_thread', :'r3') = 0 AND pg_temp.told(:'creator_id', 'post_reply', :'r3') = 0);
SELECT pg_temp.expect('2f the parent''s author is told', pg_temp.told(:'stranger_id', 'post_reply', :'r3') = 1);

-- 3
SELECT pg_temp.as_user(:'member_id');
SELECT public.create_post(jsonb_build_object('body','hi','parent_id',:'r3','mention_ids',jsonb_build_array(:'mod_id', :'member_id', :'stranger_id', :'creator_id'))) AS r4 \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('3a a mention tells the person mentioned', pg_temp.told(:'mod_id', 'post_mention', :'r4') = 1);
SELECT pg_temp.expect('3b in plain words', (SELECT body FROM public.notifications WHERE recipient_id = :'mod_id' AND target_id = :'r4') = 'mentioned you');
SELECT pg_temp.expect('3c nobody is told of mentioning themselves', pg_temp.told(:'member_id', 'post_mention', :'r4') = 0);
SELECT pg_temp.expect('3d a person who is neither parent nor root is told of the mention',
  pg_temp.told(:'stranger_id', 'post_mention', :'r4') = 1 AND pg_temp.told(:'stranger_id', 'post_reply', :'r4') = 0);
SELECT pg_temp.expect('3e the parent''s author (here also the root''s), told of the reply, is not told of the mention too',
  pg_temp.told(:'creator_id', 'post_mention', :'r4') = 0 AND pg_temp.told(:'creator_id', 'post_reply', :'r4') = 1);
SELECT pg_temp.as_user(:'member_id');
SELECT public.create_post(jsonb_build_object('body','again','parent_id',:'r2','mention_ids',jsonb_build_array(:'creator_id', :'stranger_id'))) AS r5 \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('3f the parent''s author and the root''s author, told of the reply, are not told of the mention too',
  pg_temp.told(:'stranger_id', 'post_mention', :'r5') = 0 AND pg_temp.told(:'creator_id', 'post_mention', :'r5') = 0
  AND pg_temp.told(:'stranger_id', 'post_reply', :'r5') = 1 AND pg_temp.told(:'creator_id', 'post_thread', :'r5') = 1);

-- 4
SELECT pg_temp.as_user(:'member_id');
INSERT INTO public.post_likes (post_id, user_id) VALUES (:'root', :'member_id'), (:'r1', :'member_id');
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('4a a like tells the post''s author', pg_temp.told(:'creator_id', 'post_like', :'root') = 1);
SELECT pg_temp.expect('4b in plain words', (SELECT body FROM public.notifications WHERE target_id = :'root' AND notification_type = 'post_like') = 'liked your topic');
SELECT pg_temp.expect('4c liking your own topic tells nobody', pg_temp.told(:'member_id', 'post_like', :'r1') = 0);

-- 5
SELECT pg_temp.as_user(:'stranger_id');
SELECT public.create_post(jsonb_build_object('body','from your build','attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',:'cbuild')))) AS started \gset
SELECT public.create_post(jsonb_build_object('body','from my build','attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',:'sbuild')))) AS own \gset
SELECT public.create_post(jsonb_build_object('body','reply with my build','parent_id',:'root','attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',:'sbuild')))) AS reply_own \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('5a a root post that starts from someone''s build tells its maker', pg_temp.told(:'creator_id', 'post_started', :'started') = 1);
SELECT pg_temp.expect('5b in plain words', (SELECT body FROM public.notifications WHERE target_id = :'started' AND notification_type = 'post_started') = 'started a topic from your build');
SELECT pg_temp.expect('5c and names the build', (SELECT build_id FROM public.notifications WHERE target_id = :'started' AND notification_type = 'post_started') = :'cbuild'::uuid);
SELECT pg_temp.expect('5d attaching your own work tells nobody', NOT EXISTS (SELECT 1 FROM public.notifications WHERE target_id IN (:'own', :'reply_own') AND notification_type = 'post_started'));

-- 6
SELECT pg_temp.as_user(:'creator_id');
UPDATE public.openbuild_posts SET pinned_by = :'creator_id' WHERE id = :'r1';
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('6a a pin tells the reply''s author', pg_temp.told(:'member_id', 'post_pinned', :'r1') = 1);
SELECT pg_temp.expect('6b in plain words', (SELECT body FROM public.notifications WHERE target_id = :'r1' AND notification_type = 'post_pinned') = 'pinned your reply');
SELECT pg_temp.as_user(:'creator_id');
UPDATE public.openbuild_posts SET pinned_by = :'creator_id' WHERE id = :'root';
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('6c pinning your own post tells nobody', pg_temp.told(:'creator_id', 'post_pinned', :'root') = 0);

-- 7
SELECT pg_temp.expect('7 no message holds an em dash', NOT EXISTS (SELECT 1 FROM public.notifications WHERE body LIKE '%' || chr(8212) || '%' OR body LIKE '%' || chr(8211) || '%'));

ROLLBACK;
\echo 'ALL CHECKS PASSED'
