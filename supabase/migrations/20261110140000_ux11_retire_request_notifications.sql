-- UX-11 part e: the notification kinds the request system wrote are retired, and their switches are removed from
-- profiles.notification_preferences.
--
-- WHAT IT DOES
--   1. Copies, into legacy_backup_20261110.notification_preferences_before, the id and whole preferences object of every profile
--      that holds any retired key (a copy, so the change can be undone).
--   2. Removes the retired keys from those profiles' notification_preferences, one UPDATE.
--
-- THE RETIRED KEYS: solution, solved, bounty_interaction, bounty_solver_overtaken, meta_bounty_sub_spawned,
--   bounty_deadline_approaching, bounty_promoted_to_blueprint, bounty_new, bounty_claimed, bounty_expiring.
-- A key that is not there is not an error. Running this twice changes nothing the second time.
--
-- WHAT IT DOES NOT TOUCH: public.notifications. Rows already written keep their kind and their stored message; the Activity page
-- shows them with that message and no badge. Nothing that writes a retired kind is changed here: those triggers are on the tables
-- the drop migration (design/audits/ux-11/pending) removes.
--
-- RESTORE:
--   update public.profiles p set notification_preferences = b.notification_preferences
--   from legacy_backup_20261110.notification_preferences_before b where b.id = p.id;
--
-- EXPLAIN (ANALYZE, BUFFERS) the update before relying on it, in the SQL editor:
--   explain (analyze, buffers) update public.profiles set notification_preferences = notification_preferences - '{solution,solved}'::text[]
--   where notification_preferences ?| '{solution,solved}'::text[];
-- SHOULD SHOW a Seq Scan on profiles (the jsonb ?| test has no index) and a time in the low milliseconds per thousand rows. A
-- sequential scan is right: one pass over profiles, once.

create schema if not exists legacy_backup_20261110;
revoke all on schema legacy_backup_20261110 from public, anon, authenticated;

create table if not exists legacy_backup_20261110.notification_preferences_before (
  id uuid primary key,
  notification_preferences jsonb not null
);
revoke all on legacy_backup_20261110.notification_preferences_before from public, anon, authenticated;

insert into legacy_backup_20261110.notification_preferences_before (id, notification_preferences)
select id, notification_preferences
from public.profiles
where notification_preferences ?| array[
  'solution', 'solved', 'bounty_interaction', 'bounty_solver_overtaken', 'meta_bounty_sub_spawned',
  'bounty_deadline_approaching', 'bounty_promoted_to_blueprint', 'bounty_new', 'bounty_claimed', 'bounty_expiring'
]
on conflict (id) do nothing;

update public.profiles
set notification_preferences = notification_preferences - array[
  'solution', 'solved', 'bounty_interaction', 'bounty_solver_overtaken', 'meta_bounty_sub_spawned',
  'bounty_deadline_approaching', 'bounty_promoted_to_blueprint', 'bounty_new', 'bounty_claimed', 'bounty_expiring'
]
where notification_preferences ?| array[
  'solution', 'solved', 'bounty_interaction', 'bounty_solver_overtaken', 'meta_bounty_sub_spawned',
  'bounty_deadline_approaching', 'bounty_promoted_to_blueprint', 'bounty_new', 'bounty_claimed', 'bounty_expiring'
];
