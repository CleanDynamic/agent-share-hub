-- =============================================================================
-- UX-04 Part 3: the authorship rule. Acceptance checks.
-- =============================================================================
--   1. a reply with someone else's build is refused, with the rule's words
--   2. a reply with your own step is allowed
--   3. a root post with a build whose maker opted out is refused, with the rule's words
--   4. a root post with an allowed build is allowed, and carries no copy
--   5. someone else's draft cannot be attached, even to a root post
--   6. your own draft needs the copy taken at attach time, and keeps it
--   7. a rebuild counts as the rebuilder's own work
--   8. where SV-16 names a contributor, the contributor made the step and the session, not the build's maker
--   9. media must sit under the author's own storage folder, on a reply and on a root post
--  10. a step that is not in the build named is refused
--  11. a part is a group of sessions named by part_key, and is the build maker's
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v mod_id=<profiles.id> -v member_id=<profiles.id> \
--     -v stranger_id=<profiles.id> -f supabase/tests/ux04-p3-authorship.sql
-- creator_id is the maker of the builds, member_id the contributor and the rebuilder, stranger_id the author of the root posts.
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

-- Setup, as the connecting role: the maker's builds, a draft, a rebuild by the member, steps and a session with a contributor.
SELECT pg_temp.as_admin();
INSERT INTO public.builds (creator_id, slug, title, shape, status, published_at, allow_as_post_source) VALUES
  (:'creator_id', 'ux04-open-build',  'Open build',  'app', 'published', now(), true),
  (:'creator_id', 'ux04-closed-build', 'Closed build', 'app', 'published', now(), false),
  (:'creator_id', 'ux04-draft-build',  'Draft build',  'app', 'draft', NULL, true),
  (:'member_id',  'ux04-own-draft',    'Member draft', 'app', 'draft', NULL, true);
SELECT id AS open_b FROM public.builds WHERE slug = 'ux04-open-build' \gset
SELECT id AS closed_b FROM public.builds WHERE slug = 'ux04-closed-build' \gset
SELECT id AS draft_b FROM public.builds WHERE slug = 'ux04-draft-build' \gset
SELECT id AS own_draft_b FROM public.builds WHERE slug = 'ux04-own-draft' \gset
INSERT INTO public.builds (creator_id, slug, title, shape, status, published_at, parent_build_id)
  VALUES (:'member_id', 'ux04-rebuild', 'Rebuild', 'app', 'published', now(), :'open_b');
SELECT id AS rebuild_b FROM public.builds WHERE slug = 'ux04-rebuild' \gset
UPDATE public.builds SET making = jsonb_build_object('sessions_meta', jsonb_build_object('s1', jsonb_build_object('contributor_id', :'member_id'))) WHERE id = :'open_b';
INSERT INTO public.build_nodes (build_id, type, title) VALUES (:'open_b', 'prompt', 'maker step') RETURNING id AS maker_n \gset
INSERT INTO public.build_nodes (build_id, type, title, contributor_id) VALUES (:'open_b', 'prompt', 'contributed step', :'member_id') RETURNING id AS contrib_n \gset
INSERT INTO public.build_nodes (build_id, type, title) VALUES (:'closed_b', 'prompt', 'closed step') RETURNING id AS closed_n \gset

-- The root post everything replies to.
SELECT pg_temp.as_user(:'stranger_id');
SELECT public.create_post('{"body":"a question"}') AS root \gset

-- 1 & 2
SELECT pg_temp.refused_with('1 a reply with someone else''s build',
  format($q$SELECT public.create_post(jsonb_build_object('body','r','parent_id',%L,'attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',%L))))$q$, :'root', :'open_b'),
  'A reply can attach only your own work.');
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.expect('2 a reply with your own step',
  public.create_post(jsonb_build_object('body','r','parent_id',:'root','attachments',jsonb_build_array(jsonb_build_object('kind','step','build_id',:'open_b','node_id',:'maker_n')))) IS NOT NULL);

-- 3 & 4
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.refused_with('3 a root post with an opted-out build',
  format($q$SELECT public.create_post(jsonb_build_object('body','q','attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',%L))))$q$, :'closed_b'),
  'This build''s maker doesn''t allow it to start posts.');
SELECT pg_temp.refused_with('3b nor through one of its steps',
  format($q$SELECT public.create_post(jsonb_build_object('body','q','attachments',jsonb_build_array(jsonb_build_object('kind','step','build_id',%L,'node_id',%L))))$q$, :'closed_b', :'closed_n'),
  'doesn''t allow it to start posts');
SELECT public.create_post(jsonb_build_object('body','q','attachments',jsonb_build_array(
  jsonb_build_object('kind','build','build_id',:'open_b','snapshot','{"copied":"anyway"}'::jsonb)))) AS ok_post \gset
SELECT pg_temp.expect('4 a root post with an allowed build, and no copy of published work',
  (SELECT snapshot IS NULL FROM public.post_attachments WHERE post_id = :'ok_post' AND position = 0));

-- 5
SELECT pg_temp.refused_with('5 someone else''s draft, even on a root post',
  format($q$SELECT public.create_post(jsonb_build_object('body','q','attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',%L,'snapshot','{"x":1}'::jsonb))))$q$, :'draft_b'),
  'not published');

-- 6
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.refused_with('6a your own draft without a copy',
  format($q$SELECT public.create_post(jsonb_build_object('body','r','parent_id',%L,'attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',%L))))$q$, :'root', :'own_draft_b'),
  'needs a copy');
SELECT public.create_post(jsonb_build_object('body','r','parent_id',:'root','attachments',jsonb_build_array(
  jsonb_build_object('kind','build','build_id',:'own_draft_b','snapshot','{"title":"Member draft"}'::jsonb)))) AS draft_post \gset
SELECT pg_temp.expect('6b your own draft with the copy', (SELECT snapshot ->> 'title' = 'Member draft' FROM public.post_attachments WHERE post_id = :'draft_post'));

-- 7. the member's rebuild is the member's own work, on a reply
SELECT pg_temp.expect('7 a rebuild counts as the rebuilder''s own work',
  public.create_post(jsonb_build_object('body','r','parent_id',:'root','attachments',jsonb_build_array(jsonb_build_object('kind','build','build_id',:'rebuild_b')))) IS NOT NULL);

-- 8. SV-16: the contributor made the step and the session
SELECT pg_temp.expect('8a the contributor replies with the step they made, in the maker''s build',
  public.create_post(jsonb_build_object('body','r','parent_id',:'root','attachments',jsonb_build_array(jsonb_build_object('kind','step','build_id',:'open_b','node_id',:'contrib_n')))) IS NOT NULL);
SELECT pg_temp.expect('8b the contributor replies with the session they made',
  public.create_post(jsonb_build_object('body','r','parent_id',:'root','attachments',jsonb_build_array(jsonb_build_object('kind','session','build_id',:'open_b','session_key','s1')))) IS NOT NULL);
SELECT pg_temp.refused_with('8c the contributor cannot reply with the maker''s step',
  format($q$SELECT public.create_post(jsonb_build_object('body','r','parent_id',%L,'attachments',jsonb_build_array(jsonb_build_object('kind','step','build_id',%L,'node_id',%L))))$q$, :'root', :'open_b', :'maker_n'),
  'A reply can attach only your own work.');
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.refused_with('8d the maker cannot reply with the contributor''s step',
  format($q$SELECT public.create_post(jsonb_build_object('body','r','parent_id',%L,'attachments',jsonb_build_array(jsonb_build_object('kind','step','build_id',%L,'node_id',%L))))$q$, :'root', :'open_b', :'contrib_n'),
  'A reply can attach only your own work.');
SELECT pg_temp.refused_with('8e nor with the contributor''s session',
  format($q$SELECT public.create_post(jsonb_build_object('body','r','parent_id',%L,'attachments',jsonb_build_array(jsonb_build_object('kind','session','build_id',%L,'session_key','s1'))))$q$, :'root', :'open_b'),
  'A reply can attach only your own work.');

-- 9. media
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.refused_with('9a media in someone else''s folder, on a reply',
  format($q$SELECT public.create_post(jsonb_build_object('body','r','parent_id',%L,'attachments',jsonb_build_array(jsonb_build_object('kind','media','media_path',%L,'media_kind','image'))))$q$, :'root', :'creator_id' || '/pic.png'),
  'your own storage folder');
SELECT pg_temp.refused_with('9b media in someone else''s folder, on a root post',
  format($q$SELECT public.create_post(jsonb_build_object('body','q','attachments',jsonb_build_array(jsonb_build_object('kind','media','media_path',%L,'media_kind','image'))))$q$, :'creator_id' || '/pic.png'),
  'your own storage folder');
SELECT pg_temp.expect('9c media in your own folder',
  public.create_post(jsonb_build_object('body','r','parent_id',:'root','attachments',jsonb_build_array(jsonb_build_object('kind','media','media_path',:'stranger_id' || '/pic.png','media_kind','image')))) IS NOT NULL);

-- 11. a part is a group of sessions, named by part_key, and belongs to the build's maker
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.expect('11a the maker replies with their own part',
  public.create_post(jsonb_build_object('body','r','parent_id',:'root','attachments',jsonb_build_array(jsonb_build_object('kind','part','build_id',:'open_b','part_key','ws-1')))) IS NOT NULL);
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.refused_with('11b someone else cannot reply with it',
  format($q$SELECT public.create_post(jsonb_build_object('body','r','parent_id',%L,'attachments',jsonb_build_array(jsonb_build_object('kind','part','build_id',%L,'part_key','ws-1'))))$q$, :'root', :'open_b'),
  'A reply can attach only your own work.');
SELECT pg_temp.refused('11c a part with no key', format($q$SELECT public.create_post(jsonb_build_object('body','r','attachments',jsonb_build_array(jsonb_build_object('kind','part','build_id',%L))))$q$, :'open_b'));
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.expect('11d a root post may start from someone''s part when the build allows it',
  public.create_post(jsonb_build_object('body','q','attachments',jsonb_build_array(jsonb_build_object('kind','part','build_id',:'open_b','part_key','ws-1')))) IS NOT NULL);

-- 10
SELECT pg_temp.refused_with('10 a step that is not in the build named',
  format($q$SELECT public.create_post(jsonb_build_object('body','q','attachments',jsonb_build_array(jsonb_build_object('kind','step','build_id',%L,'node_id',%L))))$q$, :'open_b', :'closed_n'),
  'not in that build');

RESET ROLE;
ROLLBACK;
\echo 'ALL CHECKS PASSED'
