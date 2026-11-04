-- =============================================================================
-- UX-04 Part 2: posts, replies and what they carry. Acceptance checks.
-- =============================================================================
--   1. a root's root_id is its own id; a reply's root_id is the root's at depth 1, 2 and 3; a supplied root_id is overwritten
--   2. a post cannot be written as someone else; a reply needs a parent that exists; a reply cannot be put in a space
--   3. who_can_post: a non-member cannot post or reply in a members space; a member can
--   4. a reward is refused where a space does not allow one (on insert and on edit), and on a reply
--   5. hidden posts are not read by a bystander; their author, the root's author and a moderator read them
--   6. a bystander cannot edit, pin or hide; another user cannot edit the words; a reply's author cannot hide their own reply;
--      nobody changes a post's author
--   7. the root's author and a moderator pin and hide, only as themselves; unhiding clears the reason
--   8. a post with no words needs an attachment; create_post writes post, spaces, attachments and mentions in one transaction
--   9. tags: at most five, each at most 30 characters
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v mod_id=<profiles.id> -v member_id=<profiles.id> \
--     -v stranger_id=<profiles.id> -v bystander_id=<profiles.id> -f supabase/tests/ux04-p2-posts.sql
-- Five different existing profiles: the space creator, a moderator, a member, the author of the root post, a bystander.
-- One transaction, ended by ROLLBACK. Every check raises on failure.
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

-- Setup. "ux04-members" is members-only with no rewards; "ux04-open" is open with rewards. The creator invites the moderator and
-- the member into both, then promotes the moderator.
SELECT pg_temp.as_user(:'creator_id');
INSERT INTO public.spaces (slug, name, creator_id, who_can_post, rewards_allowed) VALUES
  ('ux04-members', 'Members', :'creator_id', 'members', false),
  ('ux04-open',    'Open',    :'creator_id', 'anyone',  true);
INSERT INTO public.space_members (space_id, user_id, role, invited)
  SELECT s.id, v.u, 'member', true FROM public.spaces s, (VALUES (:'mod_id'::uuid), (:'member_id'::uuid)) v(u) WHERE s.slug IN ('ux04-members', 'ux04-open');
UPDATE public.space_members SET role = 'moderator' WHERE user_id = :'mod_id';
SELECT id AS open_space FROM public.spaces WHERE slug = 'ux04-open' \gset
SELECT id AS members_space FROM public.spaces WHERE slug = 'ux04-members' \gset

-- The stranger writes the root in the open space; the member replies three deep.
SELECT pg_temp.as_user(:'stranger_id');
SELECT public.create_post(jsonb_build_object('body', 'a root', 'space_ids', jsonb_build_array(:'open_space'))) AS root \gset
SELECT pg_temp.as_user(:'member_id');
SELECT public.create_post(jsonb_build_object('body', 'depth 1', 'parent_id', :'root')) AS d1 \gset
SELECT public.create_post(jsonb_build_object('body', 'depth 2', 'parent_id', :'d1')) AS d2 \gset
SELECT public.create_post(jsonb_build_object('body', 'depth 3', 'parent_id', :'d2')) AS d3 \gset

-- 1
SELECT pg_temp.expect('1a a root''s root_id is its own id', (SELECT root_id = id FROM public.openbuild_posts WHERE id = :'root'));
SELECT pg_temp.expect('1b a reply''s root_id is the root at depth 1, 2 and 3',
  (SELECT count(*) FROM public.openbuild_posts WHERE id IN (:'d1', :'d2', :'d3') AND root_id = :'root') = 3);
INSERT INTO public.openbuild_posts (author_id, parent_id, root_id, body) VALUES (:'member_id', :'d1', :'d3', 'tries to choose its root') RETURNING id AS forged \gset
SELECT pg_temp.expect('1c a supplied root_id is overwritten', (SELECT root_id = :'root' FROM public.openbuild_posts WHERE id = :'forged'));

-- 2
SELECT pg_temp.refused('2a a post written as someone else',
  format($q$INSERT INTO public.openbuild_posts (author_id, body) VALUES (%L, 'forged')$q$, :'creator_id'));
SELECT pg_temp.refused_with('2b a reply to a post that does not exist',
  $q$INSERT INTO public.openbuild_posts (author_id, parent_id, body) VALUES (auth.uid(), gen_random_uuid(), 'orphan')$q$, 'gone');
SELECT pg_temp.refused('2c a reply cannot be put in a space',
  format($q$INSERT INTO public.post_spaces (post_id, space_id) VALUES (%L, %L)$q$, :'d1', :'open_space'));
SELECT pg_temp.refused('2d a post cannot arrive already hidden or pinned',
  format($q$INSERT INTO public.openbuild_posts (author_id, body, pinned_by) VALUES (%L, 'x', %L)$q$, :'member_id', :'member_id'));

-- 3
SELECT pg_temp.as_user(:'bystander_id');
SELECT pg_temp.refused('3a a non-member cannot start a post in a members space',
  format($q$SELECT public.create_post(jsonb_build_object('body', 'nope', 'space_ids', jsonb_build_array(%L)))$q$, :'members_space'));
SELECT pg_temp.as_user(:'member_id');
SELECT public.create_post(jsonb_build_object('body', 'members root', 'space_ids', jsonb_build_array(:'members_space'))) AS mroot \gset
SELECT pg_temp.expect('3b a member starts a post in a members space', EXISTS (SELECT 1 FROM public.post_spaces WHERE post_id = :'mroot' AND space_id = :'members_space'));
SELECT pg_temp.as_user(:'bystander_id');
SELECT pg_temp.refused('3c a non-member cannot reply in a members space',
  format($q$SELECT public.create_post(jsonb_build_object('body', 'nope', 'parent_id', %L))$q$, :'mroot'));
SELECT pg_temp.as_user(:'mod_id');
SELECT pg_temp.expect('3d a member replies in a members space', public.create_post(jsonb_build_object('body', 'ok', 'parent_id', :'mroot')) IS NOT NULL);

-- 4
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.refused('4a a reward is refused in a space without rewards',
  format($q$SELECT public.create_post(jsonb_build_object('body', 'bounty', 'reward_gbp', 10, 'space_ids', jsonb_build_array(%L)))$q$, :'members_space'));
SELECT pg_temp.expect('4b a reward is allowed in a space with rewards',
  public.create_post(jsonb_build_object('body', 'bounty', 'reward_gbp', 10, 'space_ids', jsonb_build_array(:'open_space'))) IS NOT NULL);
SELECT pg_temp.refused('4c a reward cannot be added by an edit where the space does not allow it',
  format($q$UPDATE public.openbuild_posts SET reward_gbp = 5 WHERE id = %L$q$, :'mroot'));
SELECT pg_temp.refused('4d a reply cannot carry a reward',
  format($q$SELECT public.create_post(jsonb_build_object('body', 'r', 'reward_gbp', 5, 'parent_id', %L))$q$, :'root'));

-- 5
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.affects('5a a moderator hides a reply', format($q$UPDATE public.openbuild_posts SET hidden_by = %L, hidden_reason = 'off topic' WHERE id = %L$q$, :'creator_id', :'d1'), 1);
SELECT pg_temp.expect('5b the moderator still reads it', EXISTS (SELECT 1 FROM public.openbuild_posts WHERE id = :'d1'));
SELECT pg_temp.as_user(:'bystander_id');
SELECT pg_temp.expect('5c a bystander does not read it', NOT EXISTS (SELECT 1 FROM public.openbuild_posts WHERE id = :'d1'));
RESET ROLE; SET LOCAL ROLE anon;
SELECT pg_temp.expect('5d a signed-out reader does not read it', NOT EXISTS (SELECT 1 FROM public.openbuild_posts WHERE id = :'d1'));
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.expect('5e its author reads it', EXISTS (SELECT 1 FROM public.openbuild_posts WHERE id = :'d1'));
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.expect('5f the root''s author reads it', EXISTS (SELECT 1 FROM public.openbuild_posts WHERE id = :'d1'));
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.affects('5g the moderator unhides it', format($q$UPDATE public.openbuild_posts SET hidden_by = NULL WHERE id = %L$q$, :'d1'), 1);
SELECT pg_temp.expect('5h unhiding clears the reason', (SELECT hidden_reason IS NULL FROM public.openbuild_posts WHERE id = :'d1'));

-- 6
SELECT pg_temp.as_user(:'bystander_id');
SELECT pg_temp.affects('6a a bystander cannot edit', format($q$UPDATE public.openbuild_posts SET body = 'mine now' WHERE id = %L$q$, :'d2'), 0);
SELECT pg_temp.affects('6b a bystander cannot hide', format($q$UPDATE public.openbuild_posts SET hidden_by = %L WHERE id = %L$q$, :'bystander_id', :'d2'), 0);
SELECT pg_temp.affects('6c a bystander cannot pin', format($q$UPDATE public.openbuild_posts SET pinned_by = %L WHERE id = %L$q$, :'bystander_id', :'d2'), 0);
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.refused_with('6d the root''s author cannot edit another user''s words',
  format($q$UPDATE public.openbuild_posts SET body = 'rewritten' WHERE id = %L$q$, :'d2'), 'Only the author can edit');
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.refused_with('6e a reply''s author cannot hide their own reply',
  format($q$UPDATE public.openbuild_posts SET hidden_by = %L WHERE id = %L$q$, :'member_id', :'d2'), 'author or a moderator');
SELECT pg_temp.affects('6f an author edits their own post', format($q$UPDATE public.openbuild_posts SET body = 'edited' WHERE id = %L$q$, :'d2'), 1);
SELECT pg_temp.expect('6g an edit moves updated_at', (SELECT updated_at > created_at FROM public.openbuild_posts WHERE id = :'d2'));
SELECT pg_temp.refused_with('6h nobody changes a post''s author',
  format($q$UPDATE public.openbuild_posts SET author_id = %L WHERE id = %L$q$, :'stranger_id', :'d2'), 'author and place');

-- 7
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.affects('7a the root''s author hides a reply under their post', format($q$UPDATE public.openbuild_posts SET hidden_by = %L, hidden_reason = 'rude' WHERE id = %L$q$, :'stranger_id', :'d3'), 1);
SELECT pg_temp.affects('7b and unhides it', format($q$UPDATE public.openbuild_posts SET hidden_by = NULL WHERE id = %L$q$, :'d3'), 1);
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.refused_with('7c a moderator cannot pin as someone else',
  format($q$UPDATE public.openbuild_posts SET pinned_by = %L WHERE id = %L$q$, :'member_id', :'d2'), 'only as yourself');
SELECT pg_temp.affects('7d a moderator pins', format($q$UPDATE public.openbuild_posts SET pinned_by = %L WHERE id = %L$q$, :'creator_id', :'d2'), 1);
SELECT pg_temp.expect('7e pinning stamps pinned_at', (SELECT pinned_at IS NOT NULL FROM public.openbuild_posts WHERE id = :'d2'));
SELECT pg_temp.affects('7f and unpins', format($q$UPDATE public.openbuild_posts SET pinned_by = NULL WHERE id = %L$q$, :'d2'), 1);
SELECT pg_temp.expect('7g unpinning clears pinned_at', (SELECT pinned_at IS NULL FROM public.openbuild_posts WHERE id = :'d2'));

-- 8. create_post is one transaction; the body rule is checked at commit
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.refused_with('8a a post with no words and nothing attached',
  $q$INSERT INTO public.openbuild_posts (author_id, body) VALUES (auth.uid(), '   '); SET CONSTRAINTS ALL IMMEDIATE$q$, 'needs words');
SELECT public.create_post(jsonb_build_object(
  'body', '', 'space_ids', jsonb_build_array(:'open_space'), 'mention_ids', jsonb_build_array(:'bystander_id'),
  'attachments', jsonb_build_array(jsonb_build_object('kind', 'media', 'media_path', 'entries/' || :'member_id' || '/pic.png', 'media_kind', 'image')))) AS media_post \gset
SET CONSTRAINTS ALL IMMEDIATE;
SELECT pg_temp.expect('8b an empty body is allowed with an attachment, and the spaces, attachment and mention arrive with it',
  (SELECT count(*) FROM public.post_spaces WHERE post_id = :'media_post') = 1
  AND (SELECT count(*) FROM public.post_attachments WHERE post_id = :'media_post') = 1
  AND (SELECT count(*) FROM public.post_mentions WHERE post_id = :'media_post' AND user_id = :'bystander_id') = 1);
SELECT pg_temp.refused('8c a refused attachment leaves no post behind',
  $q$SELECT public.create_post(jsonb_build_object('body', 'atomic', 'attachments', jsonb_build_array(jsonb_build_object('kind', 'media'))))$q$);
SELECT pg_temp.expect('8d (nothing was written)', NOT EXISTS (SELECT 1 FROM public.openbuild_posts WHERE body = 'atomic'));
SELECT pg_temp.refused('8e only the author attaches to a post',
  format($q$INSERT INTO public.post_attachments (post_id, position, kind, media_path, media_kind) SELECT %L, 5, 'media', 'x/y.png', 'image'$q$, :'root'));

-- 9
SELECT pg_temp.refused('9a six tags', $q$SELECT public.create_post('{"body":"t","tags":["a","b","c","d","e","f"]}')$q$);
SELECT pg_temp.refused('9b a tag of 31 characters', format($q$SELECT public.create_post(jsonb_build_object('body', 't', 'tags', jsonb_build_array(%L)))$q$, repeat('x', 31)));
SELECT pg_temp.expect('9c five tags of 30 characters', public.create_post(jsonb_build_object('body', 't', 'tags', jsonb_build_array(repeat('x', 30), 'b', 'c', 'd', 'e'))) IS NOT NULL);

RESET ROLE;
ROLLBACK;
\echo 'ALL CHECKS PASSED'
