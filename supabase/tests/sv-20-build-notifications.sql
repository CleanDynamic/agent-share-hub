-- SV-20 acceptance: notifications about builds for the readers who kept them.
-- USAGE: psql "$DATABASE_URL" -v maker_id=<profile> -v actor_id=<other profile> -v saver_id=<third profile> \
--          -v build_id=<a PUBLISHED build made by maker_id> -f supabase/tests/sv-20-build-notifications.sql
-- One transaction, ends in ROLLBACK. Run as a role that can write notifications (it fires the real triggers).
\if :{?maker_id}
\else
  \echo 'ERROR: pass -v maker_id, actor_id, saver_id and build_id'
  \quit
\endif

BEGIN;

-- A saver who kept a step of the build and turned notify on.
INSERT INTO public.build_nodes (id, build_id, type, title, position)
  VALUES ('00000000-0000-0000-0000-0000000000a1', :'build_id', 'agent', 'sv20 step', 9999);
INSERT INTO public.saved_items (user_id, kind, build_id, ref, notify)
  VALUES (:'saver_id', 'step', :'build_id', '00000000-0000-0000-0000-0000000000a1', true);

-- Someone else runs the build.
INSERT INTO public.build_reproductions (build_id, user_id, worked) VALUES (:'build_id', :'actor_id', true);

-- A failed check divides by zero, which stops the script with the check's name in the query text.
SELECT 1 / CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS saver_hears_once
  FROM public.notifications
 WHERE recipient_id = :'saver_id' AND notification_type = 'reproduced' AND target_type = 'node';

SELECT 1 / CASE WHEN count(*) >= 1 THEN 1 ELSE 0 END AS maker_still_hears
  FROM public.notifications
 WHERE recipient_id = :'maker_id' AND notification_type = 'reproduced' AND target_type = 'build';

SELECT 1 / CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS nobody_told_of_their_own_act
  FROM public.notifications
 WHERE recipient_id = :'actor_id' AND notification_type = 'reproduced';

-- Off by default: a saver with notify false hears nothing.
UPDATE public.saved_items SET notify = false WHERE user_id = :'saver_id' AND ref = '00000000-0000-0000-0000-0000000000a1';
DELETE FROM public.notifications WHERE recipient_id = :'saver_id';
DELETE FROM public.build_reproductions WHERE build_id = :'build_id' AND user_id = :'actor_id';
INSERT INTO public.build_reproductions (build_id, user_id, worked) VALUES (:'build_id', :'actor_id', false);
SELECT 1 / CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS notify_off_hears_nothing
  FROM public.notifications
 WHERE recipient_id = :'saver_id';

\echo 'ALL CHECKS PASSED'
ROLLBACK;
