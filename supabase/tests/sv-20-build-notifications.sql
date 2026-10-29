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

DO $$
DECLARE _n int;
BEGIN
  SELECT count(*) INTO _n FROM public.notifications
   WHERE recipient_id = :'saver_id'::uuid AND notification_type = 'reproduced' AND target_type = 'node';
  IF _n <> 1 THEN RAISE EXCEPTION 'SV-20: the saver should hear once about the run, heard % times', _n; END IF;

  SELECT count(*) INTO _n FROM public.notifications
   WHERE recipient_id = :'maker_id'::uuid AND notification_type = 'reproduced' AND target_type = 'build';
  IF _n < 1 THEN RAISE EXCEPTION 'SV-20: the maker should still hear'; END IF;

  SELECT count(*) INTO _n FROM public.notifications
   WHERE recipient_id = :'actor_id'::uuid AND notification_type = 'reproduced';
  IF _n <> 0 THEN RAISE EXCEPTION 'SV-20: nobody is told of their own act'; END IF;
END $$;

-- Off by default: a saver with notify false hears nothing.
UPDATE public.saved_items SET notify = false WHERE user_id = :'saver_id' AND ref = '00000000-0000-0000-0000-0000000000a1';
DELETE FROM public.notifications WHERE recipient_id = :'saver_id';
DELETE FROM public.build_reproductions WHERE build_id = :'build_id' AND user_id = :'actor_id';
INSERT INTO public.build_reproductions (build_id, user_id, worked) VALUES (:'build_id', :'actor_id', false);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.notifications WHERE recipient_id = :'saver_id'::uuid) THEN
    RAISE EXCEPTION 'SV-20: a saver who turned notify off was told';
  END IF;
END $$;

\echo 'ALL CHECKS PASSED'
ROLLBACK;
