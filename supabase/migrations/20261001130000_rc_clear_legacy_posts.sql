-- RC-P04 — clear every legacy post. One transaction. Guards fail closed.
--
-- Deletes every row of public.content_items and everything that hangs off it.
-- What hangs off it is found from the live catalogue when this runs, because
-- the live database has drifted from supabase/migrations and a list written in
-- advance cannot be trusted:
--
--   - A row that cannot exist without its post goes with it: every foreign key
--     that cascades, and every NOT NULL one that does not, followed down as far
--     as the schema goes. Children are deleted before their parents, so a
--     RESTRICT or NO ACTION key never stops the clear half way.
--   - A row that can exist without its post stays, with the link emptied: every
--     nullable key that does not cascade, and every key from profiles, builds,
--     build_nodes, dm_messages, dm_threads and follows, none of which loses a
--     row. Direct messages, message threads and builds survive this way.
--   - Legacy notifications (content_id set) and legacy bounties
--     (legacy_item_id set) are deleted, with everything that hangs off them.
--
-- Nothing is dropped and storage is not touched: the tables stay (RC-P33 may
-- drop them) and the files stay until sign-off (RC-P34), so the copy that
-- 20261001120000_rc_backup_legacy.sql took can still be restored.
--
-- Every guard raises an exception whose message starts "RC-P04:", and a raise
-- rolls the whole block back: the clear happens completely or not at all. Run
-- again after it has succeeded, the first guard refuses, because the backup
-- then holds more posts than the live table.
--
-- To rehearse without changing anything, run `set rc.dry_run = 'on';` in the
-- same session first. The block then does everything, and ends by raising
-- "RC-P04 DRY RUN OK: …" with what it would have cleared, which rolls it back.
DO $$
DECLARE
  keep constant text[] := array['profiles', 'builds', 'build_nodes', 'dm_messages', 'dm_threads', 'follows'];
  survivor_links constant text[] := array['dm_messages.shared_content_id', 'dm_threads.pinned_content_id', 'builds.source_content_item_id'];
  seed_links constant text[] := array['notifications.content_id', 'bounties.legacy_item_id'];
  max_depth constant int := 10;
  max_nodes constant int := 5000;
  live bigint;
  backed_up bigint;
  d int;
  node record;
  fk record;
  child_col name;
  child_notnull boolean;
  child_keep boolean;
  child_seed boolean;
  parent_col name;
  child_cond text;
  link text;
  link_tbl regclass;
  link_col text;
  problem text;
  held jsonb := '{}';
  k text;
  n bigint;
  report text;
BEGIN
  PERFORM set_config('lock_timeout', '10s', true);

  -- The backup exists and is of this data.
  IF to_regclass('rc_backup.content_items') IS NULL OR to_regclass('rc_backup._manifest') IS NULL THEN
    RAISE EXCEPTION 'RC-P04: there is no backup in rc_backup; apply 20261001120000_rc_backup_legacy.sql first';
  END IF;
  SELECT count(*) INTO live FROM public.content_items;
  EXECUTE 'SELECT count(*) FROM rc_backup.content_items' INTO backed_up;
  IF live <> backed_up THEN
    RAISE EXCEPTION 'RC-P04: rc_backup holds % posts and public.content_items holds %, so the backup is not of this data', backed_up, live;
  END IF;

  -- This is the database the RC series describes.
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = to_regclass('public.builds') AND attname = 'rebuild_count' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'RC-P04: builds.rebuild_count is not live, so this is not the database the RC series describes';
  END IF;

  -- The plan: which rows go, and which keep their row with a link emptied.
  CREATE TEMP TABLE rc_plan (
    seq      serial PRIMARY KEY,
    depth    int NOT NULL,
    tbl      regclass NOT NULL,
    action   text NOT NULL CHECK (action IN ('delete', 'empty')),
    col      name,
    cond     text NOT NULL,
    path     oid[] NOT NULL,
    affected bigint
  ) ON COMMIT DROP;

  INSERT INTO rc_plan (depth, tbl, action, cond, path)
  VALUES (0, 'public.content_items', 'delete', 'true', array['public.content_items'::regclass::oid]);
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.notifications') AND attname = 'content_id' AND NOT attisdropped) THEN
    INSERT INTO rc_plan (depth, tbl, action, cond, path)
    VALUES (1, 'public.notifications', 'delete', 'content_id IS NOT NULL', array['public.notifications'::regclass::oid]);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.bounties') AND attname = 'legacy_item_id' AND NOT attisdropped) THEN
    INSERT INTO rc_plan (depth, tbl, action, cond, path)
    VALUES (1, 'public.bounties', 'delete', 'legacy_item_id IS NOT NULL', array['public.bounties'::regclass::oid]);
  END IF;

  FOR d IN 0 .. max_depth LOOP
    FOR node IN SELECT * FROM rc_plan WHERE depth = d AND action = 'delete' ORDER BY seq LOOP
      FOR fk IN
        SELECT c.conname, c.conrelid, c.conkey, c.confkey, c.confdeltype
        FROM pg_constraint c
        WHERE c.contype = 'f' AND c.confrelid = node.tbl AND c.conrelid <> node.tbl
        ORDER BY c.conrelid, c.conname
      LOOP
        IF cardinality(fk.conkey) <> 1 THEN
          RAISE EXCEPTION 'RC-P04: % is a multi-column foreign key into %, which this clear does not handle', fk.conname, node.tbl;
        END IF;
        IF fk.confdeltype = 'd' THEN
          RAISE EXCEPTION 'RC-P04: % uses ON DELETE SET DEFAULT, which this clear does not handle', fk.conname;
        END IF;
        SELECT a.attname, a.attnotnull INTO child_col, child_notnull
        FROM pg_attribute a WHERE a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1];
        SELECT a.attname INTO parent_col
        FROM pg_attribute a WHERE a.attrelid = node.tbl AND a.attnum = fk.confkey[1];
        SELECT ns.nspname = 'public' AND c.relname = ANY (keep),
               ns.nspname = 'public' AND (c.relname || '.' || child_col) = ANY (seed_links)
          INTO child_keep, child_seed
        FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE c.oid = fk.conrelid;
        child_cond := format('%I IN (SELECT %I FROM %s WHERE %s)', child_col, parent_col, node.tbl, node.cond);

        IF child_keep OR (NOT child_seed AND fk.confdeltype <> 'c' AND NOT child_notnull) THEN
          IF child_notnull THEN
            RAISE EXCEPTION 'RC-P04: %.% is NOT NULL, so its rows cannot stay with the link emptied', fk.conrelid::regclass, child_col;
          END IF;
          INSERT INTO rc_plan (depth, tbl, action, col, cond, path)
          VALUES (d + 1, fk.conrelid, 'empty', child_col, child_cond, node.path || fk.conrelid::oid);
        ELSIF fk.conrelid = ANY (node.path) THEN
          CONTINUE;  -- a cycle back to an ancestor, whose own delete takes these rows
        ELSIF d + 1 > max_depth THEN
          RAISE EXCEPTION 'RC-P04: the chain below content_items goes deeper than % levels, at %', max_depth, fk.conrelid::regclass;
        ELSE
          INSERT INTO rc_plan (depth, tbl, action, cond, path)
          VALUES (d + 1, fk.conrelid, 'delete', child_cond, node.path || fk.conrelid::oid);
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- The survivor links the RC plan names, emptied even where the live table has lost the key.
  FOREACH link IN ARRAY survivor_links LOOP
    link_tbl := to_regclass('public.' || split_part(link, '.', 1));
    link_col := split_part(link, '.', 2);
    IF link_tbl IS NOT NULL AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = link_tbl AND attname = link_col AND NOT attisdropped) THEN
      IF (SELECT attnotnull FROM pg_attribute WHERE attrelid = link_tbl AND attname = link_col) THEN
        RAISE EXCEPTION 'RC-P04: % is NOT NULL, so its rows cannot stay with the link emptied', link;
      END IF;
      INSERT INTO rc_plan (depth, tbl, action, col, cond, path)
      VALUES (1, link_tbl, 'empty', link_col, format('%I IN (SELECT id FROM public.content_items)', link_col), array[link_tbl::oid]);
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM rc_plan) > max_nodes THEN
    RAISE EXCEPTION 'RC-P04: the plan has more than % steps, which is not the schema this clear was written for', max_nodes;
  END IF;

  -- Every table the plan touches was copied by the backup.
  SELECT string_agg(DISTINCT p.tbl::text, ', ') INTO problem
  FROM rc_plan p
  JOIN pg_class c ON c.oid = p.tbl
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE NOT EXISTS (SELECT 1 FROM rc_backup._manifest m WHERE m.source = format('%I.%I', ns.nspname, c.relname));
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'RC-P04: rc_backup has no copy of %, so the backup must be taken again', problem;
  END IF;

  -- No trigger on those tables calls out of the database when a row is deleted or changed.
  SELECT string_agg(format('%s on %s', t.tgname, t.tgrelid::regclass), ', ') INTO problem
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE NOT t.tgisinternal
    AND t.tgenabled <> 'D'
    AND t.tgrelid IN (SELECT tbl FROM rc_plan)
    AND (t.tgtype & 24) <> 0
    AND (ns.nspname = 'supabase_functions' OR p.prosrc ~* '(net\.http_|http_request|http_post|http_get)');
  IF problem IS NOT NULL THEN
    RAISE EXCEPTION 'RC-P04: % would call out of the database for every row cleared', problem;
  END IF;

  -- The row counts that must not change.
  FOREACH k IN ARRAY keep LOOP
    IF to_regclass('public.' || k) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', k) INTO n;
      held := held || jsonb_build_object(k, n);
    END IF;
  END LOOP;

  -- Empty the links first, while every parent row still exists; then delete, deepest first.
  FOR node IN SELECT * FROM rc_plan WHERE action = 'empty' ORDER BY depth, seq LOOP
    EXECUTE format('UPDATE %s SET %I = NULL WHERE %s', node.tbl, node.col, node.cond);
    GET DIAGNOSTICS n = ROW_COUNT;
    UPDATE rc_plan SET affected = n WHERE seq = node.seq;
  END LOOP;
  FOR node IN SELECT * FROM rc_plan WHERE action = 'delete' ORDER BY depth DESC, seq DESC LOOP
    EXECUTE format('DELETE FROM %s WHERE %s', node.tbl, node.cond);
    GET DIAGNOSTICS n = ROW_COUNT;
    UPDATE rc_plan SET affected = n WHERE seq = node.seq;
  END LOOP;

  -- The clear is complete, and nothing else moved.
  SELECT count(*) INTO n FROM public.content_items;
  IF n <> 0 THEN
    RAISE EXCEPTION 'RC-P04: % posts remain after the clear', n;
  END IF;
  FOREACH link IN ARRAY survivor_links || seed_links LOOP
    link_tbl := to_regclass('public.' || split_part(link, '.', 1));
    link_col := split_part(link, '.', 2);
    IF link_tbl IS NOT NULL AND EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = link_tbl AND attname = link_col AND NOT attisdropped) THEN
      EXECUTE format('SELECT count(*) FROM %s WHERE %I IS NOT NULL', link_tbl, link_col) INTO n;
      IF n <> 0 THEN
        RAISE EXCEPTION 'RC-P04: % rows still have % set after the clear', n, link;
      END IF;
    END IF;
  END LOOP;
  FOR k IN SELECT jsonb_object_keys(held) LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', k) INTO n;
    IF n <> (held ->> k)::bigint THEN
      RAISE EXCEPTION 'RC-P04: % went from % to % rows, and only a link may change there', k, held ->> k, n;
    END IF;
  END LOOP;

  SELECT string_agg(line, '; ' ORDER BY line) INTO report
  FROM (
    SELECT CASE WHEN action = 'delete' THEN format('%s deleted from %s', sum(affected), tbl)
                ELSE format('%s emptied in %s.%s', sum(affected), tbl, col) END AS line
    FROM rc_plan
    GROUP BY action, tbl, col
    HAVING sum(affected) > 0
  ) lines;
  report := coalesce(report, 'nothing to clear');

  IF coalesce(current_setting('rc.dry_run', true), '') = 'on' THEN
    RAISE EXCEPTION 'RC-P04 DRY RUN OK: %', report;
  END IF;
  RAISE NOTICE 'RC-P04: cleared. %', report;
END $$;
