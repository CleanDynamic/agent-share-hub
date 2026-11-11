-- UX-11 part e, schema half: the backup table for the notification keys the request system wrote.
--
-- WHAT IT DOES
--   Creates legacy_backup_20261110.notification_preferences_before (id, notification_preferences), readable by no client role.
--   It changes no existing row.
--
-- THE DATA HALF IS NOT HERE. Lovable's migration tool refuses a file that changes existing rows, so the copy into this table and
-- the removal of the retired keys from profiles.notification_preferences live in supabase/seeds/ux11-retire-request-notifications.sql,
-- run once after this file. UX-15 does not depend on it: a leftover retired key is never read (UX-15 maps no kind to it).
--
-- Running this twice changes nothing the second time.

create schema if not exists legacy_backup_20261110;
revoke all on schema legacy_backup_20261110 from public, anon, authenticated;

create table if not exists legacy_backup_20261110.notification_preferences_before (
  id uuid primary key,
  notification_preferences jsonb not null
);
revoke all on legacy_backup_20261110.notification_preferences_before from public, anon, authenticated;
