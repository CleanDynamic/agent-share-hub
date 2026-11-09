-- scratch stub of the pieces the UX-15 migration touches. NOT part of the repo.
do $r$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; end if; end $r$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create table auth.users (id uuid primary key);
create table public.profiles (id uuid primary key references auth.users(id) on delete cascade, username text, is_private boolean,
  profile_settings jsonb, notification_preferences jsonb not null default '{"new_follower": true, "content_approved": true}');
create table public.builds (id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id) on delete cascade,
  status text default 'published', title text, outcome text, made_for text[] default '{}', made_with text[] default '{}',
  reproduction_count int default 0, published_at timestamptz default now(), parent_build_id uuid);
create table public.build_nodes (id uuid primary key default gen_random_uuid(), build_id uuid, title text, position int);
create table public.follows (id uuid primary key default gen_random_uuid(), follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade, unique (follower_id, following_id));
create table public.openbuild_posts (id uuid primary key default gen_random_uuid(), author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.openbuild_posts(id) on delete cascade, root_id uuid references public.openbuild_posts(id) on delete cascade,
  body text not null default '', about_build_id uuid, about_node_id uuid, reward_gbp numeric, still_open boolean not null default false,
  tags text[] not null default '{}', closes_at timestamptz, pinned_by uuid, pinned_at timestamptz, hidden_by uuid, hidden_reason text,
  site_hidden_by uuid, site_hidden_at timestamptz, site_hidden_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.dm_threads (id uuid primary key default gen_random_uuid(), participant_a uuid, participant_b uuid, type text not null default 'direct');
create table public.dm_messages (id uuid primary key default gen_random_uuid(), thread_id uuid references public.dm_threads(id), sender_id uuid not null);
create table public.dm_reactions (id uuid primary key default gen_random_uuid(), message_id uuid references public.dm_messages(id), user_id uuid not null);
create table public.post_mentions (post_id uuid, user_id uuid);
create table public.post_likes (post_id uuid, user_id uuid);
create table public.post_reactions (post_id uuid, user_id uuid, kind text);
create table public.post_attachments (post_id uuid, position smallint, build_id uuid);
create table public.build_likes (build_id uuid, user_id uuid);
create table public.build_comments (id uuid primary key default gen_random_uuid(), build_id uuid, author_id uuid not null);
create table public.notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid, actor_id uuid, notification_type text, build_id uuid,
  target_type text, target_id uuid, body text, metadata jsonb, created_at timestamptz default now());
create table public.legacy_items (id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id), title text);
create table public.legacy_notes (id uuid primary key default gen_random_uuid(), item_id uuid references public.legacy_items(id) on delete cascade, verified_by uuid references public.profiles(id));

do $$ declare t text; begin
  foreach t in array array['follows','openbuild_posts','dm_threads','dm_messages','dm_reactions','post_mentions','post_likes','post_reactions','post_attachments','build_likes','build_comments','builds','profiles','notifications','legacy_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "stub select" on public.%I for select using (true)', t);
    execute format('create policy "stub insert" on public.%I for insert to authenticated with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;
grant select on public.build_nodes to authenticated;
-- the "live" functions, created without checking their bodies (the tables they read are not all here)
set check_function_bodies = off;
\i /tmp/live_functions.sql
create trigger trg_posts_guard_update before update on public.openbuild_posts for each row execute function public.posts_guard_update();
create function public.viewer_owns_root(u uuid) returns boolean language sql as 'select false';
create function public.viewer_moderates_post(u uuid) returns boolean language sql as 'select false';
