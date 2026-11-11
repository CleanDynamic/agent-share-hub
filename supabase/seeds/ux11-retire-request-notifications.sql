-- UX-11 part e, data half: the notification kinds the request system wrote are retired, and their switches are removed from
-- profiles.notification_preferences.
--
-- THIS IS A DATA CHANGE, NOT A MIGRATION. It lives in supabase/seeds/ because Lovable's migration tool refuses files that change
-- existing rows. Run it once, after supabase/migrations/20261110140000_ux11_retire_request_notifications.sql (which creates the
-- backup table), through Lovable's data tool or the Supabase SQL editor:
--   psql "$DATABASE_URL" -f supabase/seeds/ux11-retire-request-notifications.sql
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
-- shows them with that message and no badge.
--
-- RESTORE:
--   update public.profiles p set notification_preferences = b.notification_preferences
--   from legacy_backup_20261110.notification_preferences_before b where b.id = p.id;
--
-- EXPLAIN (ANALYZE, BUFFERS) the update before relying on it, in the SQL editor:
--   explain (analyze, buffers) update public.profiles set notification_preferences = notification_preferences - '{solution,solved}'::text[]
--   where notification_preferences ?| '{solution,solved}'::text[];
-- SHOULD SHOW a Seq Scan on profiles (the jsonb ?| test has no index) and a time in the low milliseconds per thousand rows.

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
