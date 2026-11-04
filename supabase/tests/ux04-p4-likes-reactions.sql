-- =============================================================================
-- UX-04 Part 4: likes and space reactions. Acceptance checks.
-- =============================================================================
--   1. a rating is refused in a space without ratings, and allowed in one with them; a dislike likewise
--   2. a post in no space takes no extra reactions; a reply is judged by its root's spaces
--   3. a post in two spaces takes a reaction only if both switched it on
--   4. a rating is 1 to 5 and a dislike has no value; one reaction per kind per reader; a reader cannot react as someone else
--   5. a like is the reader's own, counts once on openbuild_posts.like_count, and goes with an unlike
--   6. saved_items accepts a post and still refuses an unknown kind; a reader saves only as themselves
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v mod_id=<profiles.id> -v member_id=<profiles.id> \
--     -v stranger_id=<profiles.id> -f supabase/tests/ux04-p4-likes-reactions.sql
-- Four different existing profiles. One transaction, ended by ROLLBACK. Every check raises on failure.
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

SELECT pg_temp.as_user(:'creator_id');
INSERT INTO public.spaces (slug, name, creator_id, reactions) VALUES
  ('ux04-rated',   'Rated',   :'creator_id', ARRAY['rating']),
  ('ux04-both',    'Both',    :'creator_id', ARRAY['rating', 'dislike']),
  ('ux04-plain',   'Plain',   :'creator_id', '{}');
SELECT id AS rated FROM public.spaces WHERE slug = 'ux04-rated' \gset
SELECT id AS both_s FROM public.spaces WHERE slug = 'ux04-both' \gset
SELECT id AS plain FROM public.spaces WHERE slug = 'ux04-plain' \gset

SELECT pg_temp.as_user(:'member_id');
SELECT public.create_post(jsonb_build_object('body','in rated',  'space_ids', jsonb_build_array(:'rated')))             AS p_rated \gset
SELECT public.create_post(jsonb_build_object('body','in plain',  'space_ids', jsonb_build_array(:'plain')))             AS p_plain \gset
SELECT public.create_post(jsonb_build_object('body','in both',   'space_ids', jsonb_build_array(:'both_s')))            AS p_both \gset
SELECT public.create_post(jsonb_build_object('body','in rated and both', 'space_ids', jsonb_build_array(:'rated', :'both_s'))) AS p_two \gset
SELECT public.create_post(jsonb_build_object('body','in no space')) AS p_none \gset
SELECT public.create_post(jsonb_build_object('body','a reply in rated', 'parent_id', :'p_rated')) AS r_rated \gset

SELECT pg_temp.as_user(:'stranger_id');
-- 1
SELECT pg_temp.affects('1a a rating in a space with ratings',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 4)$q$, :'p_rated', :'stranger_id'), 1);
SELECT pg_temp.refused_with('1b a rating in a space without ratings',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 4)$q$, :'p_plain', :'stranger_id'), 'Ratings are not switched on');
SELECT pg_temp.refused_with('1c a dislike in a space that has only ratings',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind) VALUES (%L, %L, 'dislike')$q$, :'p_rated', :'stranger_id'), 'Dislikes are not switched on');
SELECT pg_temp.affects('1d a dislike in a space with dislikes',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind) VALUES (%L, %L, 'dislike')$q$, :'p_both', :'stranger_id'), 1);

-- 2
SELECT pg_temp.refused('2a a post in no space takes no extra reactions',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 3)$q$, :'p_none', :'stranger_id'));
SELECT pg_temp.affects('2b a reply takes what its root''s space switched on',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 5)$q$, :'r_rated', :'stranger_id'), 1);

-- 3
SELECT pg_temp.refused_with('3a a dislike on a post in two spaces where only one has dislikes',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind) VALUES (%L, %L, 'dislike')$q$, :'p_two', :'stranger_id'), 'Dislikes are not switched on');
SELECT pg_temp.affects('3b a rating where both have ratings',
  format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 2)$q$, :'p_two', :'stranger_id'), 1);

-- 4
SELECT pg_temp.refused('4a a rating of 6', format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 6)$q$, :'p_both', :'stranger_id'));
SELECT pg_temp.refused('4b a rating with no value', format($q$INSERT INTO public.post_reactions (post_id, user_id, kind) VALUES (%L, %L, 'rating')$q$, :'p_both', :'stranger_id'));
SELECT pg_temp.refused('4c a dislike with a value', $q$UPDATE public.post_reactions SET value = 1 WHERE kind = 'dislike' AND user_id = auth.uid()$q$);
SELECT pg_temp.refused('4d one rating per reader', format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 1)$q$, :'p_rated', :'stranger_id'));
SELECT pg_temp.affects('4e a reader changes their rating', format($q$UPDATE public.post_reactions SET value = 1 WHERE post_id = %L AND user_id = auth.uid() AND kind = 'rating'$q$, :'p_rated'), 1);
SELECT pg_temp.refused('4f a reaction as someone else', format($q$INSERT INTO public.post_reactions (post_id, user_id, kind, value) VALUES (%L, %L, 'rating', 3)$q$, :'p_rated', :'creator_id'));

-- 5
SELECT pg_temp.affects('5a a like', format($q$INSERT INTO public.post_likes (post_id, user_id) VALUES (%L, %L)$q$, :'p_plain', :'stranger_id'), 1);
SELECT pg_temp.refused('5b a like as someone else', format($q$INSERT INTO public.post_likes (post_id, user_id) VALUES (%L, %L)$q$, :'p_plain', :'creator_id'));
SELECT pg_temp.refused('5c one like per reader', format($q$INSERT INTO public.post_likes (post_id, user_id) VALUES (%L, %L)$q$, :'p_plain', :'stranger_id'));
SELECT pg_temp.expect('5d the count follows', (SELECT like_count = 1 FROM public.openbuild_posts WHERE id = :'p_plain'));
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.affects('5e a reader cannot remove someone else''s like', format($q$DELETE FROM public.post_likes WHERE post_id = %L$q$, :'p_plain'), 0);
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.affects('5f an unlike', format($q$DELETE FROM public.post_likes WHERE post_id = %L AND user_id = auth.uid()$q$, :'p_plain'), 1);
SELECT pg_temp.expect('5g and the count goes back', (SELECT like_count = 0 FROM public.openbuild_posts WHERE id = :'p_plain'));

-- 6
SELECT pg_temp.affects('6a saved_items accepts a post',
  format($q$INSERT INTO public.saved_items (user_id, kind, ref) VALUES (%L, 'post', %L)$q$, :'stranger_id', :'p_plain'), 1);
SELECT pg_temp.refused('6b and still refuses an unknown kind',
  format($q$INSERT INTO public.saved_items (user_id, kind, ref) VALUES (%L, 'poster', 'x')$q$, :'stranger_id'));
SELECT pg_temp.refused('6c a save as someone else', format($q$INSERT INTO public.saved_items (user_id, kind, ref) VALUES (%L, 'post', %L)$q$, :'creator_id', :'p_plain'));
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.expect('6d the post''s author does not see who saved it', NOT EXISTS (SELECT 1 FROM public.saved_items WHERE kind = 'post'));

RESET ROLE;
ROLLBACK;
\echo 'ALL CHECKS PASSED'
