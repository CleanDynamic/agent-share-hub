-- UX-11 follow-up, step 3c: drop the request / bounty system from the database.
--
-- *** NOT IN supabase/migrations YET, ON PURPOSE: IT WAITS FOR MILES'S OWNER LIST. ***
-- No code in src/, supabase/functions or scripts reads these tables or columns any more (UX-11 part f; the grep is in
-- design/audits/ux-11/REPORT.md). What is left is the owner list: this file raises when legacy_backup_20261110.allowed_owners is
-- empty, and a migration that raises in Lovable's queue holds up every migration after it. So it is copied into
-- supabase/migrations only when Miles has sent the list, in the same change that inserts the list into allowed_owners.
--
-- IT REFUSES TO RUN unless all of these hold (the first statement checks them and raises):
--   1. 20261110120000_ux11_legacy_backup.sql was applied, and every backed-up table has as many rows as the live one;
--   2. legacy_backup_20261110.allowed_owners holds at least one id (Miles's account and his test accounts), and EVERY user id that
--      owns a row in a bounty-era table is in it. If another real person owns a row, it stops and Miles decides.
--
-- WHAT IT DROPS
--   tables      the 19 bounty-era tables (the 17 below, and request_claims and request_offers from 20261101120000_sv21_requests.sql, which
--               hang off bounties by a foreign key and would otherwise be left behind with nothing to point at;
--               this file copies those two into the backup schema itself before it drops them) (bounties, solutions, solution_votes, solution_comments, solution_acceptance_log,
--               solver_leaderboard_cache, bounty_discussion_comments, bounty_comment_reactions, bounty_comment_last_read,
--               bounty_deadline_extensions, bounty_author_review, bounty_me_too, bounty_me_too_marks, bounty_responses,
--               bounty_response_verifications, meta_bounty_pledges, meta_bounty_sub_definitions; and the two named above). CASCADE removes the triggers,
--               policies, indexes and views that belong to a dropped table and nothing else.
--   REDEFINED   (create or replace / drop and create, before the tables go, so no function is ever left pointing at a missing
--               table): has_open_ask (topics only), get_build_feed (no request items), maker_stats (no gaps_solved),
--               maker_build_metrics (no open_bounties or solutions_waiting).
--   functions   request_claims_renew_on_fork, request_claims_renew_on_build_change (with the trigger on builds), accept_bounty_solution, assert_bounty_gap_node, assert_meta_sub_definition_is_legacy, assign_bounty_sequential_id,
--               handle_solution_vote_change, rc_badge_solution_accepted, rc_notify_solution, rc_xp_solution_accepted,
--               recount_bounty_me_too, set_legacy_bounty_item_id, set_meta_sub_legacy_item_ids, top_solvers,
--               update_bounty_me_too_count, update_bounty_status_on_solution, update_bounty_verified_count, validate_bounty_publish,
--               validate_solution_bounty, validate_solution_slot.
--   rows        content_items where post_type = 'bounty' (their comments, ratings and the rest go with them only where a foreign key
--               says ON DELETE CASCADE; run the dependency check below first and read the answer).
--   columns     every content_items.bounty_* column.
--
-- DEPENDENCY CHECK, run before applying, and read every row (each should be empty or already covered above):
--   select conrelid::regclass, conname, confdeltype from pg_constraint where confrelid = 'public.content_items'::regclass and contype = 'f';
--   select schemaname, viewname from pg_views where definition ilike '%bount%' or definition ilike '%solution%';
--   select schemaname, tablename, policyname from pg_policies where coalesce(qual, '') ilike '%bount%' or coalesce(with_check, '') ilike '%bount%';
--   select tgrelid::regclass, tgname from pg_trigger t join pg_proc p on p.oid = t.tgfoid where not tgisinternal and p.proname ~ 'bount|solution|solver|meta_sub';
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (prosrc ilike '%bounties%' or prosrc ilike '%bounty_%') ;
--   explain (analyze, buffers) delete from public.content_items where post_type = 'bounty';   -- inside a transaction you roll back
-- The plan should show an index or a small seq scan on content_items and one trigger per cascading child, no more.
--
-- LOVABLE MESSAGE (send after copying this file to supabase/migrations):
--   Apply supabase/migrations/<the copied file> exactly as written. Change nothing else.
--   Then run the dependency check in its header and paste the rows back.

begin;

do $$
declare
  t text;
  live bigint;
  backed bigint;
  strangers bigint;
begin
  if to_regnamespace('legacy_backup_20261110') is null then
    raise exception 'The backup schema legacy_backup_20261110 does not exist. Apply 20261110120000_ux11_legacy_backup.sql first.';
  end if;
  foreach t in array array[
    'bounties', 'solutions', 'solution_votes', 'solution_comments', 'solution_acceptance_log', 'solver_leaderboard_cache',
    'bounty_discussion_comments', 'bounty_comment_reactions', 'bounty_comment_last_read', 'bounty_deadline_extensions',
    'bounty_author_review', 'bounty_me_too', 'bounty_me_too_marks', 'bounty_responses', 'bounty_response_verifications',
    'meta_bounty_pledges', 'meta_bounty_sub_definitions'
  ] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('select count(*) from public.%I', t) into live;
      execute format('select count(*) from legacy_backup_20261110.%I', t) into backed;
      if backed < live then
        raise exception 'The backup of % holds % rows, the live table % (rows were added after the backup). Re-run the backup in a new schema.', t, backed, live;
      end if;
    end if;
  end loop;

  select count(*) into live from public.content_items where post_type = 'bounty';
  select count(*) into backed from legacy_backup_20261110.content_items_bounty;
  if backed < live then
    raise exception 'The backup of the bounty content_items rows holds % rows, the live table %.', backed, live;
  end if;

  if not exists (select 1 from legacy_backup_20261110.allowed_owners) then
    raise exception 'legacy_backup_20261110.allowed_owners is empty. Miles lists his own and his test accounts there first.';
  end if;

  select count(distinct o.user_id) into strangers
    from legacy_backup_20261110.owners() o
   where o.user_id not in (select user_id from legacy_backup_20261110.allowed_owners);
  if strangers > 0 then
    raise exception '% user id(s) outside allowed_owners own request / bounty rows. Stop: Miles decides. select * from legacy_backup_20261110.owners() shows them.', strangers;
  end if;
end $$;

-- request_claims and request_offers: copy them into the backup schema (inside this transaction), then count who owns their rows.
do $$
declare
  t text;
  strangers bigint := 0;
  n bigint;
begin
  foreach t in array array['request_claims', 'request_offers'] loop
    if to_regclass('public.' || quote_ident(t)) is not null then
      execute format('create table if not exists legacy_backup_20261110.%I as table public.%I', t, t);
      execute format('revoke all on legacy_backup_20261110.%I from public, anon, authenticated', t);
      execute format('select count(distinct user_id) from public.%I where user_id not in (select user_id from legacy_backup_20261110.allowed_owners)', t) into n;
      strangers := strangers + n;
    end if;
  end loop;
  if strangers > 0 then
    raise exception '% user id(s) outside allowed_owners own request_claims / request_offers rows. Stop: Miles decides.', strangers;
  end if;
end $$;

-- 1. Functions that read the tables are rewritten first -----------------------------------------------------------------------

create or replace function public.has_open_ask(b public.builds)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select public.still_open_topic_count(b) > 0;
$$;

drop function if exists public.maker_stats(uuid);
create function public.maker_stats(uid uuid)
returns table (builds bigint, reproductions_received bigint, rebuilds_of_their_work bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with theirs as (
    select b.id from public.builds b where b.creator_id = maker_stats.uid and b.status in ('published', 'gallery')
  )
  select
    (select count(*) from theirs) as builds,
    (select count(*) from public.build_reproductions r join theirs t on t.id = r.build_id
      where r.worked and r.user_id <> maker_stats.uid) as reproductions_received,
    (select count(*) from public.builds c join public.builds p on p.id = c.parent_build_id
      where p.creator_id = maker_stats.uid and c.creator_id <> maker_stats.uid and c.status in ('published', 'gallery')) as rebuilds_of_their_work;
$$;
revoke all on function public.maker_stats(uuid) from public;
grant execute on function public.maker_stats(uuid) to anon, authenticated;

drop function if exists public.maker_build_metrics(uuid);
create function public.maker_build_metrics(uid uuid)
returns table (build_id uuid, runs bigint, worked bigint, failed_last_30_days bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with theirs as (
    select b.id, b.reproduction_count, b.last_confirmed_at, b.published_at
      from public.builds b
     where b.creator_id = maker_build_metrics.uid and b.status in ('published', 'gallery')
     order by b.reproduction_count desc, b.last_confirmed_at desc nulls last, b.published_at desc nulls last, b.id desc
     limit 50
  )
  select t.id as build_id, runs.total as runs, runs.worked as worked, runs.failed_last_30_days as failed_last_30_days
    from theirs t
    cross join lateral (
      select count(*) as total,
             count(*) filter (where r.worked) as worked,
             count(*) filter (where not r.worked and r.confirmed_at >= now() - interval '30 days') as failed_last_30_days
        from public.build_reproductions r
       where r.build_id = t.id and r.user_id <> maker_build_metrics.uid
    ) runs
   order by t.reproduction_count desc, t.last_confirmed_at desc nulls last, t.published_at desc nulls last, t.id desc;
$$;
revoke all on function public.maker_build_metrics(uuid) from public;
grant execute on function public.maker_build_metrics(uuid) to anon, authenticated;

-- get_build_feed: the same function as 20261107170000_ux04_feed.sql, with the 'bounty' branch of the union taken out. Its columns are
-- unchanged (bounty_id, bounty_reward_gbp and bounty_gap_title come back NULL), so create or replace is enough and the grants stand.
CREATE OR REPLACE FUNCTION public.get_build_feed(
  before         TIMESTAMPTZ DEFAULT now(),
  page_size      INT DEFAULT 20,
  only_following BOOLEAN DEFAULT false
)
RETURNS TABLE (
  item_kind             TEXT,
  item_at               TIMESTAMPTZ,
  build_id              UUID,
  slug                  TEXT,
  title                 TEXT,
  outcome               TEXT,
  shape                 TEXT,
  cover_media_id        UUID,
  creator_id            UUID,
  creator_username      TEXT,
  creator_display       TEXT,
  creator_avatar        TEXT,
  reproduction_count    INT,
  rebuild_count         INT,
  parent_build_id       UUID,
  source_title_at_fork  TEXT,
  source_handle_at_fork TEXT,
  rebuild_note          TEXT,
  repro_note            TEXT,
  repro_model           TEXT,
  repro_user_username   TEXT,
  status                TEXT,
  made_for              TEXT[],
  last_confirmed_at     TIMESTAMPTZ,
  last_confirmed_model  TEXT,
  cover_bucket          TEXT,
  cover_path            TEXT,
  cover_kind            TEXT,
  cover_poster_path     TEXT,
  repro_worked          BOOLEAN,
  bounty_id             UUID,
  bounty_reward_gbp     NUMERIC,
  bounty_gap_title      TEXT,
  -- UX-04: the root post of a 'post' or 'reply_group' row. Null on every other kind.
  post_id               UUID,
  post_created_at       TIMESTAMPTZ,
  post_author_id        UUID,
  post_author_username  TEXT,
  post_author_display   TEXT,
  post_author_avatar    TEXT,
  post_body             TEXT,
  post_still_open       BOOLEAN,
  post_reward_gbp       NUMERIC,
  post_reply_count      INT,
  -- UX-04: the newest reply of a 'reply_group' row, and how many replies are new to the viewer. Null on every other kind.
  reply_id              UUID,
  reply_at              TIMESTAMPTZ,
  reply_author_id       UUID,
  reply_author_username TEXT,
  reply_author_display  TEXT,
  reply_author_avatar   TEXT,
  reply_body            TEXT,
  reply_new_count       INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH bounds AS (
    -- The cap is INSIDE the function: page_size arrives over the wire from a browser. A caller asking for a million gets fifty.
    SELECT LEAST(GREATEST(COALESCE(get_build_feed.page_size, 20), 1), 50) AS n
  ),
  followed AS (SELECT following_id FROM public.follows WHERE follower_id = (select auth.uid())),
  -- ---------------------------------------------------------------------------------------------------------------------
  -- 'post': the root posts this page shows, newest first, each once. UNION (not ALL) drops a post found by two legs.
  -- ---------------------------------------------------------------------------------------------------------------------
  post_hits AS (
    SELECT u.id, u.created_at
    FROM (
      -- following: by the viewer or by someone they follow, one index range per person
      (
        SELECT x.id, x.created_at
        FROM (SELECT f.following_id AS id FROM followed f UNION SELECT (select auth.uid())) who
        CROSS JOIN LATERAL (
          SELECT p.id, p.created_at
          FROM public.openbuild_posts p
          WHERE p.author_id = who.id
            AND p.parent_id IS NULL
            AND p.hidden_by IS NULL
            AND p.created_at < get_build_feed.before
          ORDER BY p.created_at DESC
          LIMIT (SELECT bounds.n FROM bounds)
        ) x
        WHERE only_following
        ORDER BY x.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
      UNION
      -- following: in a space the viewer belongs to, one index range per space
      (
        SELECT sp.post_id AS id, sp.created_at
        FROM public.space_members m
        CROSS JOIN LATERAL (
          SELECT s.post_id, s.created_at
          FROM public.post_spaces s
          WHERE s.space_id = m.space_id
            AND s.created_at < get_build_feed.before
          ORDER BY s.created_at DESC
          LIMIT (SELECT bounds.n FROM bounds)
        ) sp
        WHERE only_following
          AND m.user_id = (select auth.uid())
        ORDER BY sp.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
      UNION
      -- everyone: any topic that is not hidden, in a space or in none
      (
        SELECT p.id, p.created_at
        FROM public.openbuild_posts p
        WHERE NOT only_following
          AND p.parent_id IS NULL
          AND p.hidden_by IS NULL
          AND p.created_at < get_build_feed.before
        ORDER BY p.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
    ) u
    -- a post found through a space may be hidden or a reply by the time it is read; the join below is the last word
    ORDER BY u.created_at DESC
    LIMIT (SELECT bounds.n FROM bounds)
  ),
  -- ---------------------------------------------------------------------------------------------------------------------
  -- 'reply_group': the newest qualifying reply of each root, from two legs. Each leg reads up to four pages of replies so that one
  -- busy thread cannot crowd out the others; a page can still come back short when it does.
  -- ---------------------------------------------------------------------------------------------------------------------
  reply_hits AS (
    SELECT DISTINCT ON (c.root_id) c.root_id, c.id AS reply_id, c.created_at
    FROM (
      -- someone the viewer follows replied
      (
        SELECT x.id, x.root_id, x.created_at
        FROM followed f
        CROSS JOIN LATERAL (
          SELECT r.id, r.root_id, r.created_at
          FROM public.openbuild_posts r
          WHERE r.author_id = f.following_id
            AND r.parent_id IS NOT NULL
            AND r.hidden_by IS NULL
            AND r.created_at < get_build_feed.before
          ORDER BY r.created_at DESC
          LIMIT (SELECT bounds.n * 4 FROM bounds)
        ) x
        WHERE only_following
          AND f.following_id <> (select auth.uid())
        ORDER BY x.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
      UNION ALL
      -- anyone but the viewer replied under a root the viewer made
      (
        SELECT r.id, r.root_id, r.created_at
        FROM public.openbuild_posts root
        JOIN public.openbuild_posts r ON r.root_id = root.id
        WHERE only_following
          AND root.author_id = (select auth.uid())
          AND root.parent_id IS NULL
          AND r.parent_id IS NOT NULL
          AND r.hidden_by IS NULL
          AND r.author_id <> (select auth.uid())
          AND r.created_at < get_build_feed.before
        ORDER BY r.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
      UNION ALL
      -- anyone replied under one of the 50 newest topics of a space the viewer belongs to
      (
        SELECT r.id, r.root_id, r.created_at
        FROM public.space_members m
        CROSS JOIN LATERAL (
          SELECT s.post_id
          FROM public.post_spaces s
          WHERE s.space_id = m.space_id
          ORDER BY s.created_at DESC
          LIMIT 50
        ) ps
        JOIN public.openbuild_posts r ON r.root_id = ps.post_id
        WHERE only_following
          AND m.user_id = (select auth.uid())
          AND r.parent_id IS NOT NULL
          AND r.hidden_by IS NULL
          AND r.author_id <> (select auth.uid())
          AND r.created_at < get_build_feed.before
        ORDER BY r.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
      UNION ALL
      -- everyone: any reply
      (
        SELECT r.id, r.root_id, r.created_at
        FROM public.openbuild_posts r
        WHERE NOT only_following
          AND r.parent_id IS NOT NULL
          AND r.hidden_by IS NULL
          AND r.created_at < get_build_feed.before
        ORDER BY r.created_at DESC
        LIMIT (SELECT bounds.n * 4 FROM bounds)
      )
    ) c
    ORDER BY c.root_id, c.created_at DESC
  ),
  page AS MATERIALIZED (
    SELECT
      u.item_kind,
      u.item_at,
      u.build_id,
      u.repro_note,
      u.repro_model,
      u.repro_user_id,
      u.repro_worked,
      u.bounty_id,
      u.bounty_reward_gbp,
      u.gap_node_id,
      u.post_id,
      u.reply_id,
      u.reply_new_count
    FROM (
      -- -------------------------------------------------------------------
      -- 'build': a published build that is nobody's child
      -- -------------------------------------------------------------------
      (
        SELECT
          'build'::TEXT   AS item_kind,
          b.published_at  AS item_at,
          b.id            AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked,
          NULL::UUID      AS bounty_id,
          NULL::NUMERIC   AS bounty_reward_gbp,
          NULL::UUID      AS gap_node_id,
          NULL::UUID      AS post_id,
          NULL::UUID      AS reply_id,
          NULL::INT       AS reply_new_count
        FROM public.builds b
        WHERE b.status IN ('published', 'gallery')
          AND b.published_at IS NOT NULL
          AND b.parent_build_id IS NULL
          AND b.published_at < get_build_feed.before
          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
        ORDER BY b.published_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'rebuild': a published build that names a parent
      -- -------------------------------------------------------------------
      (
        SELECT
          'rebuild'::TEXT AS item_kind,
          b.published_at  AS item_at,
          b.id            AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked,
          NULL::UUID      AS bounty_id,
          NULL::NUMERIC   AS bounty_reward_gbp,
          NULL::UUID      AS gap_node_id,
          NULL::UUID      AS post_id,
          NULL::UUID      AS reply_id,
          NULL::INT       AS reply_new_count
        FROM public.builds b
        WHERE b.status IN ('published', 'gallery')
          AND b.published_at IS NOT NULL
          AND b.parent_build_id IS NOT NULL
          AND b.published_at < get_build_feed.before
          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
        ORDER BY b.published_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'repro_note': somebody ran a published build and wrote something
      -- -------------------------------------------------------------------
      (
        SELECT
          'repro_note'::TEXT AS item_kind,
          r.confirmed_at     AS item_at,
          r.build_id         AS build_id,
          r.note             AS repro_note,
          r.model_used       AS repro_model,
          r.user_id          AS repro_user_id,
          r.worked           AS repro_worked,
          NULL::UUID         AS bounty_id,
          NULL::NUMERIC      AS bounty_reward_gbp,
          NULL::UUID         AS gap_node_id,
          NULL::UUID         AS post_id,
          NULL::UUID         AS reply_id,
          NULL::INT          AS reply_new_count
        FROM public.build_reproductions r
        WHERE r.note IS NOT NULL
          AND btrim(r.note) <> ''
          AND r.confirmed_at < get_build_feed.before
          AND (NOT only_following OR r.user_id IN (SELECT following_id FROM followed))
          AND EXISTS (
            SELECT 1
            FROM public.builds b
            WHERE b.id = r.build_id
              AND b.status IN ('published', 'gallery')
          )
        ORDER BY r.confirmed_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'post': a root post (UX-04)
      -- -------------------------------------------------------------------
      (
        SELECT
          'post'::TEXT    AS item_kind,
          h.created_at    AS item_at,
          NULL::UUID      AS build_id,
          NULL::TEXT      AS repro_note,
          NULL::TEXT      AS repro_model,
          NULL::UUID      AS repro_user_id,
          NULL::BOOLEAN   AS repro_worked,
          NULL::UUID      AS bounty_id,
          NULL::NUMERIC   AS bounty_reward_gbp,
          NULL::UUID      AS gap_node_id,
          h.id            AS post_id,
          NULL::UUID      AS reply_id,
          NULL::INT       AS reply_new_count
        FROM post_hits h
        -- the last word on hidden: a post found by the space leg is checked here as well
        WHERE EXISTS (SELECT 1 FROM public.openbuild_posts p WHERE p.id = h.id AND p.hidden_by IS NULL)
        ORDER BY h.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )

      UNION ALL

      -- -------------------------------------------------------------------
      -- 'reply_group': one item per root, carrying its newest reply and the count of new ones (UX-04)
      -- -------------------------------------------------------------------
      (
        SELECT
          'reply_group'::TEXT AS item_kind,
          h.created_at        AS item_at,
          NULL::UUID          AS build_id,
          NULL::TEXT          AS repro_note,
          NULL::TEXT          AS repro_model,
          NULL::UUID          AS repro_user_id,
          NULL::BOOLEAN       AS repro_worked,
          NULL::UUID          AS bounty_id,
          NULL::NUMERIC       AS bounty_reward_gbp,
          NULL::UUID          AS gap_node_id,
          h.root_id           AS post_id,
          h.reply_id          AS reply_id,
          CASE WHEN NOT only_following THEN NULL ELSE COALESCE((
            SELECT count(*)::INT
            FROM (
              SELECT 1
              FROM public.openbuild_posts x
              WHERE x.root_id = h.root_id
                AND x.parent_id IS NOT NULL
                AND x.hidden_by IS NULL
                AND x.author_id <> (select auth.uid())
                AND x.created_at > (
                  SELECT t.seen_at FROM public.topic_reads t WHERE t.user_id = (select auth.uid()) AND t.root_id = h.root_id
                )
              LIMIT 100
            ) counted
          ), 0) END                   AS reply_new_count
        FROM reply_hits h
        JOIN public.openbuild_posts rt ON rt.id = h.root_id AND rt.hidden_by IS NULL
        ORDER BY h.created_at DESC
        LIMIT (SELECT bounds.n FROM bounds)
      )
    ) u
    ORDER BY u.item_at DESC
    LIMIT (SELECT bounds.n FROM bounds)
  )
  SELECT
    page.item_kind,
    page.item_at,
    page.build_id,
    b.slug,
    b.title,
    b.outcome,
    b.shape,
    b.cover_media_id,
    b.creator_id,
    p.username     AS creator_username,
    p.display_name AS creator_display,
    p.avatar_url   AS creator_avatar,
    b.reproduction_count,
    b.rebuild_count,
    b.parent_build_id,
    b.source_title_at_fork,
    b.source_handle_at_fork,
    b.rebuild_note,
    page.repro_note,
    page.repro_model,
    rp.username    AS repro_user_username,
    b.status,
    b.made_for,
    b.last_confirmed_at,
    b.last_confirmed_model,
    cm.bucket      AS cover_bucket,
    cm.path        AS cover_path,
    cm.kind        AS cover_kind,
    cm.poster_path AS cover_poster_path,
    page.repro_worked,
    page.bounty_id,
    page.bounty_reward_gbp,
    gn.title       AS bounty_gap_title,
    page.post_id,
    pr.created_at  AS post_created_at,
    pr.author_id   AS post_author_id,
    pa.username    AS post_author_username,
    pa.display_name AS post_author_display,
    pa.avatar_url  AS post_author_avatar,
    left(pr.body, 1000) AS post_body,
    pr.still_open  AS post_still_open,
    pr.reward_gbp  AS post_reward_gbp,
    pr.reply_count AS post_reply_count,
    page.reply_id,
    rr.created_at  AS reply_at,
    rr.author_id   AS reply_author_id,
    ra.username    AS reply_author_username,
    ra.display_name AS reply_author_display,
    ra.avatar_url  AS reply_author_avatar,
    left(rr.body, 1000) AS reply_body,
    page.reply_new_count
  FROM page
  -- LEFT now: a post row has no build. Every build row still has its build and its maker, by primary key, fifty at most.
  LEFT JOIN public.builds b
    ON b.id = page.build_id
  LEFT JOIN public.profiles p
    ON p.id = b.creator_id
  LEFT JOIN public.build_media cm
    ON cm.id = b.cover_media_id
  LEFT JOIN public.profiles rp
    ON rp.id = page.repro_user_id
  LEFT JOIN public.build_nodes gn
    ON gn.id = page.gap_node_id
  -- the root post and its maker, and the newest reply and its maker
  LEFT JOIN public.openbuild_posts pr
    ON pr.id = page.post_id
  LEFT JOIN public.profiles pa
    ON pa.id = pr.author_id
  LEFT JOIN public.openbuild_posts rr
    ON rr.id = page.reply_id
  LEFT JOIN public.profiles ra
    ON ra.id = rr.author_id
  ORDER BY page.item_at DESC, page.build_id DESC NULLS LAST, page.post_id DESC NULLS LAST, page.item_kind DESC;
$$;


-- 2. The tables (CASCADE removes the triggers, policies and indexes that belong to them and nothing else).
drop trigger if exists trg_builds_renew_request_claim on public.builds;
drop table if exists
  public.request_offers, public.request_claims,
  public.bounty_response_verifications, public.bounty_responses, public.bounty_me_too_marks, public.bounty_me_too,
  public.bounty_author_review, public.bounty_deadline_extensions, public.bounty_comment_last_read, public.bounty_comment_reactions,
  public.bounty_discussion_comments, public.solution_comments, public.solution_votes, public.solution_acceptance_log,
  public.solver_leaderboard_cache, public.meta_bounty_pledges, public.meta_bounty_sub_definitions, public.solutions, public.bounties
  cascade;

drop function if exists public.request_claims_renew_on_build_change cascade;
drop function if exists public.request_claims_renew_on_fork cascade;
drop function if exists public.accept_bounty_solution cascade;
drop function if exists public.assert_bounty_gap_node cascade;
drop function if exists public.assert_meta_sub_definition_is_legacy cascade;
drop function if exists public.assign_bounty_sequential_id cascade;
drop function if exists public.handle_solution_vote_change cascade;
drop function if exists public.rc_badge_solution_accepted cascade;
drop function if exists public.rc_notify_solution cascade;
drop function if exists public.rc_xp_solution_accepted cascade;
drop function if exists public.recount_bounty_me_too cascade;
drop function if exists public.set_legacy_bounty_item_id cascade;
drop function if exists public.set_meta_sub_legacy_item_ids cascade;
drop function if exists public.top_solvers cascade;
drop function if exists public.update_bounty_me_too_count cascade;
drop function if exists public.update_bounty_status_on_solution cascade;
drop function if exists public.update_bounty_verified_count cascade;
drop function if exists public.validate_bounty_publish cascade;
drop function if exists public.validate_solution_bounty cascade;
drop function if exists public.validate_solution_slot cascade;

delete from public.content_items where post_type = 'bounty';

-- The materialized view profile_stats reads content_items.bounty_status, so the column cannot go while it stands. It is rebuilt without
-- its two bounty columns (bounties_posted, bounties_solved), keeping its unique index and the revoked grants; nothing in src/ reads it.
drop materialized view if exists public.profile_stats;
create materialized view public.profile_stats as
 select p.id as user_id,
    coalesce(sum(ci.view_count), 0::bigint) as total_views,
    count(*) filter (where ci.post_type = 'blueprint' and ci.status = 'approved') as blueprints_count,
    count(*) filter (where ci.post_type = 'blog' and ci.status = 'approved') as blogs_count,
    coalesce(avg(nullif(ci.estimated_reading_minutes, 0)), 0::numeric)::numeric(10,2) as avg_reading_minutes
   from public.profiles p
     left join public.content_items ci on ci.creator_id = p.id
  group by p.id;
create unique index profile_stats_user_id_idx on public.profile_stats (user_id);
revoke all on public.profile_stats from anon, authenticated;

alter table public.content_items
  drop column if exists bounty_acceptance_criteria, drop column if exists bounty_active_solvers, drop column if exists bounty_closes_at,
  drop column if exists bounty_deadline, drop column if exists bounty_enabled, drop column if exists bounty_gap,
  drop column if exists bounty_health_score, drop column if exists bounty_is_meta, drop column if exists bounty_lifetime_acceptances,
  drop column if exists bounty_lifetime_submissions, drop column if exists bounty_lifetime_votes_received,
  drop column if exists bounty_me_too_count, drop column if exists bounty_meta_parent_id, drop column if exists bounty_reward_amount,
  drop column if exists bounty_reward_currency, drop column if exists bounty_reward_type, drop column if exists bounty_sequential_id,
  drop column if exists bounty_solutions_accepted, drop column if exists bounty_solutions_submitted, drop column if exists bounty_solved_count,
  drop column if exists bounty_solved_response_id, drop column if exists bounty_solver_acceptance_rate,
  drop column if exists bounty_status, drop column if exists bounty_submissions_paused, drop column if exists bounty_tip_gbp,
  drop column if exists bounty_total_reward_earned, drop column if exists bounty_total_slots, drop column if exists bounty_total_submissions,
  drop column if exists bounty_reward, drop column if exists bounty_solved_at, drop column if exists bounty_slots_total,
  drop column if exists bounty_slots_filled;

commit;
