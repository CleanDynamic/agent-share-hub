-- =============================================================================
-- UX-04 Part 1: spaces. Acceptance checks.
-- =============================================================================
--   1. the creator is made the space's first moderator
--   2. a user cannot create a space as someone else
--   3. a non-creator cannot update a space; the creator can
--   4. a moderator cannot change roles; the creator can
--   5. an uninvited user cannot join an invite-only space
--   6. a moderator can invite; the invited row is a membership; the invited user can leave
--   7. a user cannot join as a moderator, write an invited row for themselves, or invite when not a moderator
--   8. a user joins an open space as themselves
--
-- USAGE
--   psql "$DATABASE_URL" -v creator_id=<profiles.id> -v mod_id=<profiles.id> -v member_id=<profiles.id> \
--     -v stranger_id=<profiles.id> -f supabase/tests/ux04-p1-spaces.sql
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
INSERT INTO public.spaces (slug, name, who_can_post, creator_id) VALUES
  ('ux04-open', 'Open', 'anyone', :'creator_id'), ('ux04-invite', 'Invite only', 'invite', :'creator_id');
SELECT pg_temp.expect('1 the creator is the first moderator',
  (SELECT count(*) FROM public.space_members m JOIN public.spaces s ON s.id = m.space_id
    WHERE s.slug = 'ux04-open' AND m.user_id = :'creator_id' AND m.role = 'moderator') = 1);

SELECT pg_temp.refused('2 creating a space as someone else',
  format('INSERT INTO public.spaces (slug, name, creator_id) VALUES (%L, %L, %L)', 'ux04-forged', 'Forged', :'stranger_id'));

-- the creator makes the moderator
SELECT pg_temp.affects('4a the creator adds a moderator via invite then promotes',
  format($q$INSERT INTO public.space_members (space_id, user_id, role, invited) SELECT id, %L, 'member', true FROM public.spaces WHERE slug IN ('ux04-open','ux04-invite')$q$, :'mod_id'), 2);
SELECT pg_temp.affects('4b the creator changes a role',
  format($q$UPDATE public.space_members SET role = 'moderator' WHERE user_id = %L$q$, :'mod_id'), 2);

-- 3
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.affects('3a a non-creator cannot update a space', $q$UPDATE public.spaces SET name = 'Hijacked' WHERE slug = 'ux04-open'$q$, 0);
SELECT pg_temp.as_user(:'mod_id');
SELECT pg_temp.affects('3b a moderator cannot update a space', $q$UPDATE public.spaces SET name = 'Hijacked' WHERE slug = 'ux04-open'$q$, 0);
SELECT pg_temp.as_user(:'creator_id');
SELECT pg_temp.affects('3c the creator updates their space', $q$UPDATE public.spaces SET description = 'hello' WHERE slug = 'ux04-open'$q$, 1);
SELECT pg_temp.refused('3d the creator cannot hand a space away by update',
  format($q$UPDATE public.spaces SET creator_id = %L WHERE slug = 'ux04-open'$q$, :'stranger_id'));

-- 4
SELECT pg_temp.as_user(:'mod_id');
SELECT pg_temp.affects('4c a moderator cannot change roles',
  format($q$UPDATE public.space_members SET role = 'moderator' WHERE user_id = %L$q$, :'creator_id'), 0);
SELECT pg_temp.affects('4d a moderator cannot demote the creator',
  format($q$UPDATE public.space_members SET role = 'member' WHERE user_id = %L$q$, :'creator_id'), 0);

-- 5
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.refused('5 an uninvited user cannot join an invite-only space',
  format($q$INSERT INTO public.space_members (space_id, user_id) SELECT id, %L FROM public.spaces WHERE slug = 'ux04-invite'$q$, :'stranger_id'));

-- 7
SELECT pg_temp.refused('7a a user cannot join as a moderator',
  format($q$INSERT INTO public.space_members (space_id, user_id, role) SELECT id, %L, 'moderator' FROM public.spaces WHERE slug = 'ux04-open'$q$, :'stranger_id'));
SELECT pg_temp.refused('7b a user cannot write an invited row for themselves',
  format($q$INSERT INTO public.space_members (space_id, user_id, invited) SELECT id, %L, true FROM public.spaces WHERE slug = 'ux04-invite'$q$, :'stranger_id'));
SELECT pg_temp.refused('7c a non-moderator cannot invite someone else',
  format($q$INSERT INTO public.space_members (space_id, user_id, invited) SELECT id, %L, true FROM public.spaces WHERE slug = 'ux04-invite'$q$, :'member_id'));

-- 6
SELECT pg_temp.as_user(:'mod_id');
SELECT pg_temp.affects('6a a moderator invites',
  format($q$INSERT INTO public.space_members (space_id, user_id, invited) SELECT id, %L, true FROM public.spaces WHERE slug = 'ux04-invite'$q$, :'member_id'), 1);
SELECT pg_temp.as_user(:'member_id');
SELECT pg_temp.expect('6b the invited user is a member', EXISTS (SELECT 1 FROM public.space_members m JOIN public.spaces s ON s.id = m.space_id WHERE s.slug = 'ux04-invite' AND m.user_id = :'member_id'));
SELECT pg_temp.affects('6c the invited user leaves as themselves', $q$DELETE FROM public.space_members m USING public.spaces s WHERE s.id = m.space_id AND s.slug = 'ux04-invite' AND m.user_id = auth.uid()$q$, 1);

-- 8
SELECT pg_temp.as_user(:'stranger_id');
SELECT pg_temp.affects('8 a user joins an open space as themselves',
  format($q$INSERT INTO public.space_members (space_id, user_id) SELECT id, %L FROM public.spaces WHERE slug = 'ux04-open'$q$, :'stranger_id'), 1);
SELECT pg_temp.affects('8b they cannot remove someone else', format($q$DELETE FROM public.space_members WHERE user_id = %L$q$, :'creator_id'), 0);

RESET ROLE;
ROLLBACK;
\echo 'ALL CHECKS PASSED'
