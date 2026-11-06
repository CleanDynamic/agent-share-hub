-- UX-11 follow-up, step 3a: a full backup of the bounty-era data, in its own schema, before anything is removed.
--
-- THIS FILE IS SAFE TO APPLY NOW. It only COPIES. It drops, deletes and changes nothing, and nothing reads the new schema.
--
-- WHAT IT WRITES, into the schema legacy_backup_20261110 (the date is the day this file was written):
--   one copy of each bounty-era table, under the same name (bounties, solutions, solution_votes, solution_comments,
--   solution_acceptance_log, solver_leaderboard_cache, bounty_discussion_comments, bounty_comment_reactions,
--   bounty_comment_last_read, bounty_deadline_extensions, bounty_author_review, bounty_me_too, bounty_me_too_marks,
--   bounty_responses, bounty_response_verifications, meta_bounty_pledges, meta_bounty_sub_definitions), for each one that exists;
--   content_items_bounty          every content_items row with post_type = 'bounty', whole;
--   content_items_bounty_columns  the bounty_* columns of every OTHER content_items row that has a value in any of them
--                                 (id plus those columns), so dropping the columns later loses nothing;
--   build_nodes_open_marks        every build_nodes row marked is_gap, or of the 'gap' type, whole (for step 2 of the clear-out);
--   allowed_owners                an EMPTY table (user_id uuid, note text). The drop migration refuses to run until Miles has
--                                 filled it with his own account and his test accounts, and every owner of a row is in it.
--   owner_summary()               one row per table: how many rows, how many distinct user ids own them;
--   owners()                      the distinct (table, user id) pairs, to read against allowed_owners.
-- Access: service_role only. anon, authenticated and PUBLIC have no grant on the schema.
--
-- STEP 0, THE COUNT (run after applying, as the project owner, in the SQL editor):
--   select * from legacy_backup_20261110.owner_summary();
--   select table_name, count(*) from legacy_backup_20261110.owners() group by 1 order by 1;
--   select user_id, array_agg(distinct table_name) from legacy_backup_20261110.owners() group by 1;   -- who they are
-- If every user id is Miles's or a test account, insert them into legacy_backup_20261110.allowed_owners. If any other real person
-- owns a row, stop and tell Miles: the drop migration will not run either way.
--
-- RESTORE (a table, or all of them), as service_role:
--   insert into public.<table> select * from legacy_backup_20261110.<table>;                      -- after re-creating <table> from
--                                                                                                    the migrations that made it
--   insert into public.content_items select * from legacy_backup_20261110.content_items_bounty;   -- bounty rows
--   update public.content_items c set bounty_status = b.bounty_status, ... from legacy_backup_20261110.content_items_bounty_columns b
--     where b.id = c.id;                                                                           -- the columns, name by name
--   update public.build_nodes n set is_gap = b.is_gap, payload = b.payload from legacy_backup_20261110.build_nodes_open_marks b
--     where b.id = n.id;                                                                           -- the marks
-- The copies are `create table ... as table`, so they carry the data and column types, not constraints, defaults or policies: a
-- restore of a dropped table starts from the migration that created it (supabase/migrations/*bounty*, *solution*), then the insert.
--
-- EXPLAIN: every statement here is a one-off full read of a table, none of them on a request path. No index is added.

create schema if not exists legacy_backup_20261110;
revoke all on schema legacy_backup_20261110 from public, anon, authenticated;
grant usage on schema legacy_backup_20261110 to service_role;

do $$
declare
  t text;
  tables text[] := array[
    'bounties', 'solutions', 'solution_votes', 'solution_comments', 'solution_acceptance_log', 'solver_leaderboard_cache',
    'bounty_discussion_comments', 'bounty_comment_reactions', 'bounty_comment_last_read', 'bounty_deadline_extensions',
    'bounty_author_review', 'bounty_me_too', 'bounty_me_too_marks', 'bounty_responses', 'bounty_response_verifications',
    'meta_bounty_pledges', 'meta_bounty_sub_definitions'
  ];
  bounty_cols text;
begin
  foreach t in array tables loop
    if to_regclass('public.' || quote_ident(t)) is not null
       and to_regclass('legacy_backup_20261110.' || quote_ident(t)) is null then
      execute format('create table legacy_backup_20261110.%I as table public.%I', t, t);
    end if;
  end loop;

  if to_regclass('legacy_backup_20261110.content_items_bounty') is null then
    create table legacy_backup_20261110.content_items_bounty as
      select * from public.content_items where post_type = 'bounty';
  end if;

  select string_agg(quote_ident(column_name), ', ' order by column_name),
         string_agg('c.' || quote_ident(column_name) || ' is not null', ' or ' order by column_name)
    into bounty_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'content_items' and column_name like 'bounty\_%';
  if bounty_cols is not null and to_regclass('legacy_backup_20261110.content_items_bounty_columns') is null then
    execute format(
      'create table legacy_backup_20261110.content_items_bounty_columns as select c.id, %s from public.content_items c where c.post_type is distinct from ''bounty'' and (%s)',
      (select string_agg('c.' || quote_ident(column_name), ', ' order by column_name) from information_schema.columns
        where table_schema = 'public' and table_name = 'content_items' and column_name like 'bounty\_%'),
      (select string_agg('c.' || quote_ident(column_name) || ' is not null', ' or ' order by column_name) from information_schema.columns
        where table_schema = 'public' and table_name = 'content_items' and column_name like 'bounty\_%')
    );
  end if;

  if to_regclass('legacy_backup_20261110.build_nodes_open_marks') is null then
    create table legacy_backup_20261110.build_nodes_open_marks as
      select * from public.build_nodes where is_gap or type = 'gap';
  end if;

  if to_regclass('legacy_backup_20261110.allowed_owners') is null then
    create table legacy_backup_20261110.allowed_owners (user_id uuid primary key, note text);
  end if;
end $$;

-- One row per backed-up table: its rows and how many distinct user ids own them. An owner column is any of these that the table has.
create or replace function legacy_backup_20261110.owners()
returns table (table_name text, user_id uuid)
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  t record;
  c text;
  candidates text[] := array['author_id', 'creator_id', 'user_id', 'solver_id', 'pledger_id', 'voter_id', 'reactor_id', 'extender_id'];
begin
  for t in select tablename from pg_tables where schemaname = 'legacy_backup_20261110' and tablename <> 'allowed_owners' loop
    foreach c in array candidates loop
      if exists (select 1 from information_schema.columns
                  where table_schema = 'legacy_backup_20261110' and information_schema.columns.table_name = t.tablename and column_name = c) then
        return query execute format('select distinct %L::text, %I::uuid from legacy_backup_20261110.%I where %I is not null', t.tablename, c, t.tablename, c);
      end if;
    end loop;
  end loop;
end $$;

create or replace function legacy_backup_20261110.owner_summary()
returns table (table_name text, row_count bigint, distinct_owners bigint)
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'legacy_backup_20261110' and tablename <> 'allowed_owners' order by tablename loop
    table_name := t.tablename;
    execute format('select count(*) from legacy_backup_20261110.%I', t.tablename) into row_count;
    select count(distinct o.user_id) into distinct_owners from legacy_backup_20261110.owners() o where o.table_name = t.tablename;
    return next;
  end loop;
end $$;

revoke all on all tables in schema legacy_backup_20261110 from public, anon, authenticated;
grant select, insert, delete on legacy_backup_20261110.allowed_owners to service_role;
grant select on all tables in schema legacy_backup_20261110 to service_role;
revoke execute on function legacy_backup_20261110.owners() from public, anon, authenticated;
revoke execute on function legacy_backup_20261110.owner_summary() from public, anon, authenticated;
grant execute on function legacy_backup_20261110.owners() to service_role;
grant execute on function legacy_backup_20261110.owner_summary() to service_role;