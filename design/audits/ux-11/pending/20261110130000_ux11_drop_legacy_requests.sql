-- UX-11 follow-up, step 3c: drop the request / bounty system from the database.
--
-- *** NOT IN supabase/migrations ON PURPOSE. DO NOT APPLY YET. ***
-- Live code still reads these columns and tables (the list is in design/audits/ux-11/REPORT.md, "What still reads the database").
-- Applying this before that code is gone breaks Home, Builds, the legacy upload editor and the notifications. When the code is
-- gone, copy this file to supabase/migrations/ under a newer timestamp, apply it, and send the Lovable message at the foot.
--
-- IT REFUSES TO RUN unless all of these hold (the first statement checks them and raises):
--   1. 20261110120000_ux11_legacy_backup.sql was applied, and every backed-up table has as many rows as the live one;
--   2. legacy_backup_20261110.allowed_owners holds at least one id (Miles's account and his test accounts), and EVERY user id that
--      owns a row in a bounty-era table is in it. If another real person owns a row, it stops and Miles decides.
--
-- WHAT IT DROPS
--   tables      the 17 bounty-era tables (bounties, solutions, solution_votes, solution_comments, solution_acceptance_log,
--               solver_leaderboard_cache, bounty_discussion_comments, bounty_comment_reactions, bounty_comment_last_read,
--               bounty_deadline_extensions, bounty_author_review, bounty_me_too, bounty_me_too_marks, bounty_responses,
--               bounty_response_verifications, meta_bounty_pledges, meta_bounty_sub_definitions). CASCADE removes the triggers,
--               policies, indexes and views that belong to a dropped table and nothing else.
--   functions   accept_bounty_solution, assert_bounty_gap_node, assert_meta_sub_definition_is_legacy, assign_bounty_sequential_id,
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

-- Functions first (a trigger function cannot be dropped while a trigger uses it; the tables go with CASCADE below).
drop table if exists
  public.bounty_response_verifications, public.bounty_responses, public.bounty_me_too_marks, public.bounty_me_too,
  public.bounty_author_review, public.bounty_deadline_extensions, public.bounty_comment_last_read, public.bounty_comment_reactions,
  public.bounty_discussion_comments, public.solution_comments, public.solution_votes, public.solution_acceptance_log,
  public.solver_leaderboard_cache, public.meta_bounty_pledges, public.meta_bounty_sub_definitions, public.solutions, public.bounties
  cascade;

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
