-- =============================================================================
-- UX-04 Part 6: Home's feed carries posts and every reply. Acceptance checks.
-- =============================================================================
--   1. Everyone: every topic that is not hidden is a 'post', in a space or in none, by anyone; the answer is the same for a
--      signed-in reader, another signed-in reader and a signed-out one; every conversation with a visible reply is one reply_group
--   2. Following: a topic by the viewer, by someone they follow, and in a space they belong to are 'post's; a stranger's
--      spaceless topic is not; hidden entries never appear, even for the people who can read them elsewhere
--   3. reply_group: one item per topic however many replies, carrying the newest reply, the exact reply count and the number new
--      to the viewer (replies after topic_reads.seen_at, none with no row; null in the Everyone scope)
--   4. a reply by someone the viewer follows groups under any root; a reply by anyone under the viewer's own root groups; the
--      viewer's own reply alone does not; a reply by an unfollowed person under a stranger's root does not
--   5. a hidden reply, and a reply under a hidden root, never appear
--   6. the four old kinds still load, with the new columns null
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v mod_id=<profiles.id> -v member_id=<profiles.id> \
--     -v stranger_id=<profiles.id> -v bystander_id=<profiles.id> -f supabase/tests/ux04-p6-feed.sql
-- member_id is the viewer; stranger_id is someone the viewer follows; creator_id makes the spaces and roots; mod_id and bystander_id
-- are people the viewer does not follow. Five different existing profiles. One transaction, ended by ROLLBACK.
-- =============================================================================

\if :{?bystander_id}
\else
  \echo 'ERROR: pass -v creator_id, mod_id, member_id, stranger_id and bystander_id (five different profiles.id uuids)'
  \quit
\endif
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on
\pset format unaligned
BEGIN;
\ir ux04-helpers.sql

-- the post ids a feed call returns, of one kind, as text (ordered)
CREATE FUNCTION pg_temp.ids(kind text, following boolean) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(post_id::text, ',' ORDER BY item_at DESC, post_id), '')
    FROM public.get_build_feed(now() + interval '1 day', 50, following) WHERE item_kind = kind
$$;

-- Setup as the connecting role, with explicit times so "newest" means something inside one transaction.
SELECT pg_temp.as_admin();
INSERT INTO public.spaces (slug, name, creator_id) VALUES ('ux04-feed', 'Feed', :'creator_id') RETURNING id AS space \gset
INSERT INTO public.space_members (space_id, user_id) VALUES (:'space', :'member_id');
INSERT INTO public.follows (follower_id, following_id) VALUES (:'member_id', :'stranger_id');
SELECT now() - interval '2 hours' AS t0 \gset

INSERT INTO public.openbuild_posts (author_id, body, created_at) VALUES (:'creator_id', 'in the space', :'t0'::timestamptz + interval '1 minute') RETURNING id AS in_space \gset
INSERT INTO public.post_spaces (post_id, space_id, created_at) VALUES (:'in_space', :'space', :'t0'::timestamptz + interval '1 minute');
INSERT INTO public.openbuild_posts (author_id, body, created_at) VALUES (:'creator_id', 'spaceless by a stranger', :'t0'::timestamptz + interval '2 minutes') RETURNING id AS spaceless \gset
INSERT INTO public.openbuild_posts (author_id, body, created_at) VALUES (:'stranger_id', 'by someone followed', :'t0'::timestamptz + interval '3 minutes') RETURNING id AS by_followed \gset
INSERT INTO public.openbuild_posts (author_id, body, created_at) VALUES (:'member_id', 'by the viewer', :'t0'::timestamptz + interval '4 minutes') RETURNING id AS by_me \gset
INSERT INTO public.openbuild_posts (author_id, body, created_at, hidden_by) VALUES (:'creator_id', 'hidden in a space', :'t0'::timestamptz + interval '5 minutes', :'creator_id') RETURNING id AS hidden_in_space \gset
INSERT INTO public.post_spaces (post_id, space_id, created_at) VALUES (:'hidden_in_space', :'space', :'t0'::timestamptz + interval '5 minutes');
INSERT INTO public.openbuild_posts (author_id, body, created_at, hidden_by) VALUES (:'stranger_id', 'hidden by someone followed', :'t0'::timestamptz + interval '6 minutes', :'stranger_id') RETURNING id AS hidden_followed \gset
-- a root in a space the viewer is not in, for the Everyone scope
INSERT INTO public.spaces (slug, name, creator_id) VALUES ('ux04-elsewhere', 'Elsewhere', :'creator_id') RETURNING id AS other_space \gset
INSERT INTO public.openbuild_posts (author_id, body, created_at) VALUES (:'mod_id', 'in another space', :'t0'::timestamptz + interval '7 minutes') RETURNING id AS elsewhere \gset
INSERT INTO public.post_spaces (post_id, space_id, created_at) VALUES (:'elsewhere', :'other_space', :'t0'::timestamptz + interval '7 minutes');

-- 1. Everyone
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.ids('post', false) AS everyone_member \gset
SELECT pg_temp.as_user(:'bystander_id');
SELECT pg_temp.ids('post', false) AS everyone_other \gset
SELECT pg_temp.as_admin(); SET LOCAL ROLE anon;
SELECT pg_temp.ids('post', false) AS everyone_anon \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('1a Everyone has every topic that is not hidden, in a space or not, newest first',
  :'everyone_member' = :'elsewhere' || ',' || :'by_me' || ',' || :'by_followed' || ',' || :'spaceless' || ',' || :'in_space');
SELECT pg_temp.expect('1b and the same for another reader and for a signed-out one', :'everyone_member' = :'everyone_other' AND :'everyone_member' = :'everyone_anon');
SELECT pg_temp.expect('1c with no replies yet, Everyone has no reply_group', pg_temp.ids('reply_group', false) = '');

-- 2. Following (the viewer)
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.expect('2a Following has the viewer''s, the followed''s and the viewer''s spaces'' roots, newest first, and no hidden one',
  pg_temp.ids('post', true) = :'by_me' || ',' || :'by_followed' || ',' || :'in_space');
SELECT pg_temp.expect('2b a spaceless topic by a stranger and a topic in a space the viewer is not in are not there',
  position(:'spaceless' in pg_temp.ids('post', true)) = 0 AND position(:'elsewhere' in pg_temp.ids('post', true)) = 0);
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.expect('2c the author who can read their hidden post still does not see it on Home',
  position(:'hidden_in_space' in pg_temp.ids('post', false)) = 0 AND position(:'hidden_in_space' in pg_temp.ids('post', true)) = 0);
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.expect('2d nor the one they hid themselves', position(:'hidden_followed' in pg_temp.ids('post', true)) = 0);
SELECT pg_temp.as_admin(); SET LOCAL ROLE anon;
SELECT pg_temp.expect('2e a signed-out reader has nothing in Following', pg_temp.ids('post', true) = '');

-- 3 & 4. Replies. The viewer made `by_me`. Replies come from the followed stranger, an unfollowed bystander and the viewer.
SELECT pg_temp.as_admin();
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'bystander_id', :'by_me', 'late help', :'t0'::timestamptz + interval '10 minutes') RETURNING id AS rm1 \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'mod_id', :'by_me', 'more help', :'t0'::timestamptz + interval '11 minutes') RETURNING id AS rm2 \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at, hidden_by) VALUES (:'bystander_id', :'by_me', 'rude', :'t0'::timestamptz + interval '12 minutes', :'member_id') RETURNING id AS rm_hidden \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'stranger_id', :'in_space', 'a followed reply', :'t0'::timestamptz + interval '13 minutes') RETURNING id AS rf1 \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'stranger_id', :'rf1', 'and another', :'t0'::timestamptz + interval '14 minutes') RETURNING id AS rf2 \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'bystander_id', :'spaceless', 'unfollowed under a stranger', :'t0'::timestamptz + interval '15 minutes') RETURNING id AS ru \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'member_id', :'spaceless', 'my own reply', :'t0'::timestamptz + interval '16 minutes') RETURNING id AS rme \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'stranger_id', :'hidden_in_space', 'followed reply under a hidden root', :'t0'::timestamptz + interval '17 minutes') RETURNING id AS rh \gset
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at, hidden_by) VALUES (:'stranger_id', :'spaceless', 'a hidden followed reply', :'t0'::timestamptz + interval '18 minutes', :'creator_id') RETURNING id AS rfh \gset

SELECT pg_temp.as_user(:'member_id');
INSERT INTO public.topic_reads (user_id, root_id, seen_at) VALUES (:'member_id', :'by_me', :'t0'::timestamptz + interval '9 minutes');
SELECT pg_temp.expect('3a one reply_group for each root, newest first: the followed reply''s thread and the viewer''s own root',
  (SELECT string_agg(post_id::text, ',' ORDER BY item_at DESC) FROM public.get_build_feed(now() + interval '1 day', 50, true) WHERE item_kind = 'reply_group') = :'in_space' || ',' || :'by_me');
SELECT pg_temp.expect('3b the viewer''s root: two visible replies by others make one item carrying the newest, and a count of 2',
  (SELECT reply_id = :'rm2'::uuid AND reply_new_count = 2 AND reply_author_id = :'mod_id'::uuid AND reply_body = 'more help' AND post_body = 'by the viewer' AND post_reply_count = 2
     FROM public.get_build_feed(now() + interval '1 day', 50, true) WHERE item_kind = 'reply_group' AND post_id = :'by_me'));
SELECT pg_temp.expect('3c a followed person''s topic: two replies, one item, the newest carried, none new for a reader with no mark',
  (SELECT reply_id = :'rf2'::uuid AND reply_new_count = 0 AND post_reply_count = 2 FROM public.get_build_feed(now() + interval '1 day', 50, true) WHERE item_kind = 'reply_group' AND post_id = :'in_space'));
SELECT pg_temp.expect('4a an unfollowed reply under a stranger''s root, and the viewer''s own reply, group nothing',
  position(:'spaceless' in coalesce((SELECT string_agg(post_id::text, ',') FROM public.get_build_feed(now() + interval '1 day', 50, true) WHERE item_kind = 'reply_group'), '')) = 0);
SELECT pg_temp.expect('5a a hidden reply is not counted or carried; a hidden root has no group',
  (SELECT reply_new_count = 2 FROM public.get_build_feed(now() + interval '1 day', 50, true) WHERE item_kind = 'reply_group' AND post_id = :'by_me')
  AND position(:'hidden_in_space' in coalesce((SELECT string_agg(post_id::text, ',') FROM public.get_build_feed(now() + interval '1 day', 50, true) WHERE item_kind = 'reply_group'), '')) = 0);

-- the reader opens the topic again later: only replies after that, by others, are new
SELECT pg_temp.as_admin();
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'member_id', :'by_me', 'thanks', :'t0'::timestamptz + interval '20 minutes');
INSERT INTO public.openbuild_posts (author_id, parent_id, body, created_at) VALUES (:'bystander_id', :'by_me', 'you are welcome', :'t0'::timestamptz + interval '21 minutes');
UPDATE public.topic_reads SET seen_at = :'t0'::timestamptz + interval '19 minutes' WHERE user_id = :'member_id' AND root_id = :'by_me';
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.expect('3d after the reader opens the topic again, only later replies by others are new',
  (SELECT reply_new_count = 1 AND post_reply_count = 4 FROM public.get_build_feed(now() + interval '1 day', 50, true) WHERE item_kind = 'reply_group' AND post_id = :'by_me'));

-- Everyone: every conversation with a visible reply, once, the same for every reader, with no reader's count in it
SELECT pg_temp.ids('reply_group', false) AS everyone_groups_member \gset
SELECT pg_temp.as_user(:'bystander_id');
SELECT pg_temp.ids('reply_group', false) AS everyone_groups_other \gset
SELECT pg_temp.as_admin(); SET LOCAL ROLE anon;
SELECT pg_temp.ids('reply_group', false) AS everyone_groups_anon \gset
SELECT pg_temp.as_admin();
SELECT pg_temp.expect('1d Everyone has a reply_group for each topic with a visible reply, newest reply first, and none for a hidden topic',
  :'everyone_groups_member' = :'by_me' || ',' || :'spaceless' || ',' || :'in_space');
SELECT pg_temp.expect('1e the same for another reader and a signed-out one', :'everyone_groups_member' = :'everyone_groups_other' AND :'everyone_groups_member' = :'everyone_groups_anon');
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.expect('1f in Everyone no reader''s new count is carried', (SELECT bool_and(reply_new_count IS NULL) FROM public.get_build_feed(now() + interval '1 day', 50, false) WHERE item_kind = 'reply_group'));

-- 6. the old kinds still load
SELECT pg_temp.as_admin();
INSERT INTO public.builds (creator_id, slug, title, shape, status, published_at) VALUES (:'creator_id', 'ux04-feed-build', 'Feed build', 'app', 'published', :'t0'::timestamptz) RETURNING id AS fb \gset
SELECT pg_temp.expect('6 a published build still comes back as a build, with the new columns empty',
  (SELECT count(*) = 1 AND bool_and(post_id IS NULL AND reply_id IS NULL AND reply_new_count IS NULL AND post_body IS NULL AND slug = 'ux04-feed-build')
     FROM public.get_build_feed(now() + interval '1 day', 50, false) WHERE item_kind = 'build' AND build_id = :'fb'));
SELECT pg_temp.expect('6b a cap holds', (SELECT count(*) <= 3 FROM public.get_build_feed(now() + interval '1 day', 3, false)));

ROLLBACK;
\echo 'ALL CHECKS PASSED'
