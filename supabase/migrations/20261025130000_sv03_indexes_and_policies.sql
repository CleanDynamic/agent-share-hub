-- =============================================================================
-- SV-03 part 8: the index the Drafts list needs, and access rules that ran their auth call once per row
-- =============================================================================
-- 1. INDEXES. The three the prompt names:
--      builds (creator_id, status, updated_at DESC)   MISSING: only idx_builds_creator (creator_id) exists. Added below.
--      build_saves (user_id, created_at DESC)         already exists as idx_build_saves_user_created
--                                                     (20261001180000_rc_build_social.sql). Not added again.
--      build_sessions (build_id, position)            already exists as build_sessions_build_position_key, a unique index
--                                                     (20261021120000_ca12_sessions.sql). Not added again.
--
-- 2. ACCESS RULES. A policy that writes auth.uid() or auth.jwt() bare makes Postgres call it for every row it tests; written
--    (select auth.uid()) it is called once and the answer is reused. Reading supabase/migrations/ at its newest definition of
--    each policy finds 267 policies, on 91 tables, that still have a bare call (listed at the foot of this header). The live
--    database has drifted from that folder (RULES.md section 8), so this migration does not copy the folder's text: it reads
--    each policy as the live database holds it (pg_policies), wraps the calls that are bare, and changes nothing else about
--    it (ALTER POLICY, so no policy is ever absent and its roles and command stay). A policy with no bare call is left alone,
--    and so is a policy that is not there. Running it twice changes nothing the second time.
--
-- Apply exactly as written. Then run the Supabase performance advisor and list what is left, and run the plans below.
--
-- THE PLANS TO RUN ONCE IT IS APPLIED (as a signed-in user, in the SQL editor with the role set, or through the app's own
-- request). Paste each plan back.
--
--   Drafts, the list (SV-03 part 2):
--     EXPLAIN (ANALYZE, BUFFERS)
--     SELECT id, title, updated_at, session_count FROM public.builds
--      WHERE creator_id = '<a maker id>' AND status = 'draft' ORDER BY updated_at DESC LIMIT 50;
--     SHOULD SHOW: an Index Scan (or Index Only Scan) on idx_builds_creator_status_updated, no Sort node, no sequential scan
--     on public.builds, and auth.uid() under InitPlan (one call), not under the scan filter.
--
--   Library, Saved (SV-03 part 5):
--     EXPLAIN (ANALYZE, BUFFERS)
--     SELECT s.created_at, b.id FROM public.build_saves s JOIN public.builds b ON b.id = s.build_id
--      WHERE s.user_id = '<a reader id>' ORDER BY s.created_at DESC LIMIT 24;
--     SHOULD SHOW: an Index Scan on idx_build_saves_user_created, no Sort node, a Nested Loop into builds by its primary
--     key, no sequential scan on public.builds.
--
--   The Gallery list (SV-03 part 4), the same one request listGallery and listGalleryFeed make:
--     EXPLAIN (ANALYZE, BUFFERS)
--     SELECT id, title, classification FROM public.builds
--      WHERE status IN ('published', 'gallery') ORDER BY reproduction_count DESC, last_confirmed_at DESC NULLS LAST,
--            published_at DESC NULLS LAST LIMIT 20;
--     SHOULD SHOW: no sequential scan on public.builds once the table is large; if it shows one, say so, and the sort keys
--     (which are locked by CONTRACT section 4) are the reason, not this migration.
--
--   compose_open (SV-03 part 3, step 4) was NOT built: opening a draft takes two request rounds without it, so there is
--   no plan to run for it.
--
-- THE 267 POLICIES THAT THE FOLDER SHOWS WITH A BARE CALL (table: policy). The live list may be shorter; the migration
-- finds the live ones itself.
--   ad_impressions: Admins can view all ad impressions
--   ai_export_log: Post author or admin can read exports
--   ai_tools_registry: Admins can update tools
--   ai_tools_registry: Anyone can view approved tools
--   ai_tools_registry: Authenticated users can submit tools
--   block_connections: Creators manage block_connections on own content
--   block_connections: View block_connections for approved or own content
--   block_references: Creators manage block_references on own content
--   block_references: View block_references for approved or own content
--   block_variations: Creators can delete own block variations
--   block_variations: Creators can update own block variations
--   block_variations: Creators can view own block variations
--   block_variations: Users can insert their own block variations
--   block_versions: Creators delete block_versions on own content
--   block_versions: Creators insert block_versions on own content
--   block_versions: View block_versions for approved or own content
--   blocks: Creators delete blocks on own content
--   blocks: Creators insert blocks on own content
--   blocks: Creators update blocks on own content
--   blocks: View blocks for approved or own content
--   bounty_comment_reactions: Reactor adds
--   bounty_comment_reactions: Reactor removes
--   bounty_me_too: bounty_me_too_auth_delete
--   bounty_me_too: bounty_me_too_auth_insert
--   bounty_response_verifications: bounty_verifications_auth_delete
--   bounty_response_verifications: bounty_verifications_auth_insert
--   bounty_responses: bounty_responses_auth_insert
--   bounty_responses: bounty_responses_poster_mark_solution
--   bounty_responses: bounty_responses_responder_delete
--   bounty_responses: bounty_responses_responder_update
--   canvas_arrows: Creator manages canvas_arrows
--   canvas_stages: Creator manages canvas_stages
--   canvas_versions: Creator manages canvas_versions
--   challenge_history: users_read_own_history
--   collab_invites: Admin can select all invites
--   collab_invites: Invitee can select own invites
--   collab_invites: Invitee can update invites
--   collab_invites: Inviter can insert invites
--   collab_invites: Inviter can select own invites
--   collab_invites: Inviter can update invites
--   collab_split_contests: Admin full access to contests
--   collab_split_contests: Contestant can insert own contests
--   collab_split_contests: Contestant can select own contests
--   collab_split_contests: Uploader can select contests
--   collab_split_contests: Uploader can update contest status
--   collection_follows: Users can follow collections
--   collection_follows: Users can unfollow collections
--   collection_items: Collection owner can delete items
--   collection_items: Collection owner can insert items
--   collection_items: Items follow collection visibility
--   collections: Owner can delete own collections
--   collections: Owner can insert collections
--   collections: Owner can update own collections
--   collections: Public can view collections by visibility
--   comment_likes: Users can delete own likes
--   comment_likes: Users can insert own likes
--   content_blocks: Creators can delete own content blocks
--   content_blocks: Creators can update own content blocks
--   content_blocks: Creators can view own content blocks
--   content_blocks: Users can insert their own content blocks
--   content_changelogs: Admin can update changelogs
--   content_changelogs: Creator can insert changelogs
--   content_collaborators: Accepted invitee can insert collaborator
--   content_collaborators: Collaborator can delete own row
--   content_collaborators: Creator can insert primary collaborator
--   content_comments: Public can view non-deleted comments
--   content_comments: Users can insert own comments
--   content_comments: Users can soft-delete own comments
--   content_dependencies: Creator can delete dependencies
--   content_dependencies: Creator can insert dependencies
--   content_item_results: Creators can delete own results
--   content_item_results: Creators can insert own results
--   content_item_results: Creators can update own results
--   content_item_results: Public can view results of approved content
--   content_items: Anyone can view approved content
--   content_items: Creators can delete own content
--   content_items: Creators can delete their own drafts
--   content_items: Creators can insert content
--   content_items: Creators can update own content
--   content_items: Creators can update their own drafts
--   content_items: Creators can view their own drafts
--   content_microtags: Creator can delete microtags
--   content_microtags: Creator can insert microtags
--   content_ratings: Users can insert own ratings
--   content_ratings: Users can update own ratings
--   content_share_views: Thread members can read share views
--   content_share_views: Viewer can log own view
--   content_tips: Owner or admin can update tips
--   content_tips: Public can view non-deleted tips
--   content_tips: Users can insert tips
--   content_verifications: Users can delete own verifications
--   content_verifications: Users can insert own verifications
--   content_versions: Creator can insert versions
--   content_views: Admins can view all views
--   creator_marks: creator_marks_owner_update
--   curator_applications: Admin can select all applications
--   curator_applications: Admin can update applications
--   curator_applications: User can insert own application
--   curator_applications: User can select own application
--   curator_recommendations: Admin can update all recommendations
--   curator_recommendations: Curator can insert own recommendations
--   curator_recommendations: Curator can update own recommendations
--   curators: Admin can insert curators
--   curators: Admin can update curators
--   daily_challenges: users_read_own_daily
--   daily_challenges: users_update_own_daily
--   dm_messages: Members can insert messages
--   dm_messages: Members can read thread messages
--   dm_messages: Sender can edit own message within 5 minutes
--   dm_messages: Sender or thread admin can delete
--   dm_presence: Users can manage their own presence
--   dm_presence: Users can see presence of people they have threads with
--   dm_reactions: Users can manage their own reactions
--   dm_reactions: Users can see reactions in their threads
--   dm_thread_members: Members can update own membership flags
--   dm_thread_members: Members can view thread members
--   dm_thread_members: Self or admin can leave or remove
--   dm_thread_members: Thread admins can add members
--   dm_threads: Members can see their threads
--   dm_threads: Members can update thread metadata
--   dm_threads: Users can insert threads they are part of
--   document_comments: Authenticated users insert document_comments
--   document_comments: Authors and creators delete document_comments
--   document_comments: Authors and creators update document_comments
--   document_comments: Authors can delete own comments
--   document_comments: Authors can insert own comments
--   document_comments: Authors can update own comments
--   document_comments: Document creator can resolve any comment
--   document_comments: View comments on accessible documents
--   document_comments: View document_comments for approved or own content
--   downloads: Admins can view all downloads
--   downloads: Creators can view downloads of own content
--   draft_autosave_log: Creators can insert own autosave logs
--   draft_autosave_log: Creators can view own autosave logs
--   follows: Users can follow others
--   follows: Users can unfollow
--   learning_path_progress: Users can insert own progress
--   learning_path_progress: Users can update own progress
--   learning_path_progress: Users can view own progress
--   learning_path_steps: Path creator can delete steps
--   learning_path_steps: Path creator can insert steps
--   learning_path_steps: Path creator can update steps
--   learning_paths: Creator can insert paths
--   learning_paths: Creator can update own paths
--   learning_paths: Public can view approved paths
--   library_folders: Users can delete own folders
--   library_folders: Users can insert own folders
--   library_folders: Users can select own folders
--   library_folders: Users can update own folders
--   messages: Recipient can mark as read
--   messages: Users can send messages
--   messages: Users can view own threads
--   meta_bounty_pledges: Pledger can insert own pledge
--   meta_bounty_pledges: Pledger can update own pledge
--   meta_bounty_pledges: Public can view non-anonymous pledges
--   microtag_definitions: Admin can delete microtag definitions
--   microtag_definitions: Admin can insert microtag definitions
--   microtag_definitions: Admin can update microtag definitions
--   notifications: Recipients can delete own notifications
--   notifications: Recipients can read own notifications
--   notifications: Recipients can update own notifications
--   notifications: Users can insert notifications as themselves
--   notifications: Users can update own notifications
--   notifications: Users can view own notifications
--   post_lineage: Authors can insert lineage for own posts
--   post_view_log: Post author or admin can read views
--   primitive_comment_reactions: Users can add own reactions
--   primitive_comment_reactions: Users can remove own reactions
--   primitive_comments: Authenticated users can comment
--   primitive_comments: Author can edit within 5 minutes
--   primitive_comments: Author or post owner can delete
--   profiles: Users can insert their own profile
--   profiles: Users can update their own profile
--   project_components: Creators can delete own project components
--   project_components: Creators can insert own project components
--   project_components: Creators can update own project components
--   project_package_purchases: Admins can view all package purchases
--   project_package_purchases: Users can insert own package purchases
--   project_package_purchases: Users can view own package purchases
--   projects: Admins can update any project
--   projects: Creators can insert own projects
--   projects: Creators can update own projects
--   projects: Public can view approved projects
--   reading_progress: Readers insert own progress
--   reading_progress: Readers see own progress
--   reading_progress: Readers update own progress
--   reblog_bookmarks: Reblog bookmarks owner-only read
--   reblog_bookmarks: Users bookmark reblogs
--   reblog_bookmarks: Users remove own bookmark
--   reblog_likes: Users like reblogs
--   reblog_likes: Users unlike own
--   reblog_reports: Admin can delete reports
--   reblog_reports: Admin can update reports
--   reblog_reports: Reporter can insert own report
--   reblog_reports: Reporter can read own reports
--   reblogs: Authenticated users can create reblogs
--   reblogs: Public can view non-hidden active reblogs
--   reblogs: Reblogger can edit within 5 minutes
--   reblogs: Reblogger can view own reblog including deleted
--   revenue_splits: Admin can select all splits
--   revenue_splits: Recipient can select own splits
--   revenue_splits: Setter can delete own splits
--   revenue_splits: Setter can insert splits
--   revenue_splits: Setter can select own splits
--   service_enquiries: Admins can view all enquiries
--   service_enquiries: Creators can view enquiries for own listings
--   service_listings: Anyone can view active listings
--   service_listings: Creators can delete own listings
--   service_listings: Creators can insert own listings
--   service_listings: Creators can update own listings
--   solution_comments: Authenticated post solution comment
--   solution_comments: Solution comment author delete
--   solution_comments: Solution comment edit within 5 minutes
--   solution_votes: Authenticated can vote
--   solution_votes: Voter can remove own vote
--   solver_leaderboard_cache: Admin can manage leaderboard cache
--   stages: Creators delete stages on own content
--   stages: Creators insert stages on own content
--   stages: Creators update stages on own content
--   stages: View stages for approved or own content
--   storage: Authenticated users can upload result media
--   storage: Owners can read own content files
--   storage: Users can delete own avatar
--   storage: Users can delete own content files
--   storage: Users can delete own profile assets
--   storage: Users can delete their own result media
--   storage: Users can update own avatar
--   storage: Users can update own content files
--   storage: Users can update own profile assets
--   storage: Users can update their own result media
--   storage: Users can upload DM images
--   storage: Users can upload DM voice
--   storage: Users can upload own avatar
--   storage: Users can upload own profile assets
--   storage: Users can view DM images in their threads
--   storage: Users can view DM voice in their threads
--   storage: Users delete own reblog media
--   storage: Users upload own reblog media
--   streak_days: Users can view own streak days
--   streak_days: Users view own streak days
--   subscriptions: Authenticated users can insert subscriptions
--   subscriptions: Users can update their own subscriptions
--   subscriptions: Users can view their own subscriptions
--   tip_upvotes: Users can delete own upvotes
--   tip_upvotes: Users can insert own upvotes
--   tool_compatibility: Authenticated can insert compatibility
--   tool_compatibility: Users can delete own compatibility
--   tool_compatibility: Users can update own compatibility
--   user_badges: Users can view own badges
--   user_badges: user_badges_select_own
--   user_badges: user_badges_update_own_reveal
--   user_challenge_progress: Users can view own challenge progress
--   user_interactions: Users can insert own interactions
--   user_library: Users can delete own library
--   user_library: Users can insert own library
--   user_library: Users can select own library
--   user_library: Users can update own library
--   user_perks: Users view own perks
--   user_progress: Users can view own progress
--   user_progress: users_insert_own_progress
--   user_progress: users_read_own_progress
--   user_progress: users_update_own_progress
--   user_saves: Users can save content
--   user_saves: Users can unsave content
--   user_saves: Users can view own saves
--   xp_events: Users can view own xp_events
--   xp_events: users_read_own_xp_events
--
-- =============================================================================

-- 1. The index -------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_builds_creator_status_updated
  ON public.builds (creator_id, status, updated_at DESC);

-- 2. The policies ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.sv03_wrap_auth(expr text)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  -- A call that is not already the body of a (select ...): Postgres writes the wrapped form as "( SELECT auth.uid() AS uid)".
  SELECT regexp_replace(
           regexp_replace(expr, '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.uid\(\)', '(select auth.uid())', 'g'),
           '(?<![Ss][Ee][Ll][Ee][Cc][Tt] )auth\.jwt\(\)', '(select auth.jwt())', 'g')
$f$;

DO $sv03$
DECLARE
  r record;
  wrapped_using text;
  wrapped_check text;
  statement text;
  changed integer := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (coalesce(qual, '') ~ 'auth\.(uid|jwt)\(\)' OR coalesce(with_check, '') ~ 'auth\.(uid|jwt)\(\)')
  LOOP
    wrapped_using := pg_temp.sv03_wrap_auth(r.qual);
    wrapped_check := pg_temp.sv03_wrap_auth(r.with_check);
    CONTINUE WHEN wrapped_using IS NOT DISTINCT FROM r.qual AND wrapped_check IS NOT DISTINCT FROM r.with_check;

    statement := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF r.qual IS NOT NULL THEN statement := statement || ' USING (' || wrapped_using || ')'; END IF;
    IF r.with_check IS NOT NULL THEN statement := statement || ' WITH CHECK (' || wrapped_check || ')'; END IF;
    EXECUTE statement;
    changed := changed + 1;
  END LOOP;
  RAISE NOTICE 'SV-03: % policies now call auth.uid() and auth.jwt() once per statement', changed;
END
$sv03$;
