-- Security findings from the Lovable scan of 27 November 2026, fixed in one migration.
--
--  1. Read rules that let everyone through (USING (true)) on tables whose rows belong to something with its own visibility:
--     they now follow their parent. Catalogue and public profile tables keep USING (true) on purpose (listed at the end).
--     Four logging tables let anyone insert rows in anyone's name: the name is now the caller's or empty.
--  2. Storage update rules had no WITH CHECK, so an owner could move a file into someone else's folder; the content-files
--     upload rule did not check the folder at all. Every write now ties the file to its owner.
--  3. The blocks, versions and block variations of a paid item were readable by everyone once it was approved. They are now
--     readable only by the item's creator, its collaborators and admins (no purchase of a content item is recorded anywhere
--     yet; when one is, add it to public.can_read_item_body).
--  4. A tool submitter could insert their tool already approved (or official). Submissions now start as pending.
--  5. A bounty author could raise the reward to give a solver up to 150 experience points. Accepting a solution now gives a
--     fixed amount, at most three times a day per solver.
--  6. An approved but private content item was readable by everyone, so anyone signed in could export it. The read rule
--     now honours visibility, and every table that follows the item inherits that.
--  (7. Removed collaborators keep their access: fixed in the app, src/components/dm/, where DM media links were signed for a
--      year. No database change.)

BEGIN;

-- ---------------------------------------------------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so a policy can ask about an item without depending on (or recursing into) its own rules.
-- ---------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_read_item(_item uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.content_items ci
     WHERE ci.id = _item
       AND (
             (ci.status = 'approved' AND coalesce(ci.visibility, 'public') <> 'private')
          OR ci.creator_id = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.content_collaborators cc WHERE cc.content_id = ci.id AND cc.collaborator_id = (SELECT auth.uid()))
          OR public.is_admin((SELECT auth.uid()))
           )
  );
$$;

-- The body of an item (its blocks, versions and files): readable when the item is, and, for a paid item, only by its
-- creator, its collaborators and admins.
CREATE OR REPLACE FUNCTION public.can_read_item_body(_item uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.content_items ci
     WHERE ci.id = _item
       AND public.can_read_item(ci.id)
       AND (
             coalesce(ci.monetisation_type, 'free') <> 'paid'
          OR ci.creator_id = (SELECT auth.uid())
          OR EXISTS (SELECT 1 FROM public.content_collaborators cc WHERE cc.content_id = ci.id AND cc.collaborator_id = (SELECT auth.uid()))
          OR public.is_admin((SELECT auth.uid()))
           )
  );
$$;

-- A storage folder name that may or may not be a uuid.
CREATE OR REPLACE FUNCTION public.try_uuid(_text text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN _text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN _text::uuid END;
$$;

-- The creator of the content item a content-files path belongs to: `<item>/...` or `covers/<item>/...`.
CREATE OR REPLACE FUNCTION public.content_file_item(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
           WHEN (storage.foldername(_name))[1] = 'covers' THEN public.try_uuid((storage.foldername(_name))[2])
           ELSE public.try_uuid((storage.foldername(_name))[1])
         END;
$$;

REVOKE ALL ON FUNCTION public.can_read_item(uuid), public.can_read_item_body(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_item(uuid), public.can_read_item_body(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.try_uuid(text), public.content_file_item(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Content items honour visibility.
-- ---------------------------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view approved content" ON public.content_items;
CREATE POLICY "Anyone can view approved content" ON public.content_items
  FOR SELECT
  USING (
         (status = 'approved' AND coalesce(visibility, 'public') <> 'private')
      OR creator_id = (SELECT auth.uid())
      OR (SELECT public.is_admin((SELECT auth.uid())))
  );

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Paid bodies.
-- ---------------------------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can view blocks of approved content" ON public.content_blocks;
CREATE POLICY "Public can view blocks of approved content" ON public.content_blocks
  FOR SELECT USING (public.can_read_item_body(content_id));

DROP POLICY IF EXISTS "Public can view variations of approved content" ON public.block_variations;
CREATE POLICY "Public can view variations of approved content" ON public.block_variations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.content_blocks cb WHERE cb.id = block_variations.block_id AND public.can_read_item_body(cb.content_id))
  );

DROP POLICY IF EXISTS "Public can view versions" ON public.content_versions;
DROP POLICY IF EXISTS "Versions follow their item's body" ON public.content_versions;
CREATE POLICY "Versions follow their item's body" ON public.content_versions
  FOR SELECT USING (public.can_read_item_body(content_id));

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Tables that follow a content item.
-- ---------------------------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public read canvas_arrows" ON public.canvas_arrows;
DROP POLICY IF EXISTS "Canvas arrows follow their item" ON public.canvas_arrows;
CREATE POLICY "Canvas arrows follow their item" ON public.canvas_arrows FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "Public read canvas_stages" ON public.canvas_stages;
DROP POLICY IF EXISTS "Canvas stages follow their item" ON public.canvas_stages;
CREATE POLICY "Canvas stages follow their item" ON public.canvas_stages FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "Public can view changelogs" ON public.content_changelogs;
DROP POLICY IF EXISTS "Changelogs follow their item" ON public.content_changelogs;
CREATE POLICY "Changelogs follow their item" ON public.content_changelogs FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "Public can view dependencies" ON public.content_dependencies;
DROP POLICY IF EXISTS "Dependencies follow their item" ON public.content_dependencies;
CREATE POLICY "Dependencies follow their item" ON public.content_dependencies FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "Public can view microtags" ON public.content_microtags;
DROP POLICY IF EXISTS "Microtags follow their item" ON public.content_microtags;
CREATE POLICY "Microtags follow their item" ON public.content_microtags FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "Public can view all ratings" ON public.content_ratings;
DROP POLICY IF EXISTS "Ratings follow their item" ON public.content_ratings;
CREATE POLICY "Ratings follow their item" ON public.content_ratings FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "Public can view verifications" ON public.content_verifications;
DROP POLICY IF EXISTS "Verifications follow their item" ON public.content_verifications;
CREATE POLICY "Verifications follow their item" ON public.content_verifications FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "Public can view collaborators" ON public.content_collaborators;
DROP POLICY IF EXISTS "Collaborators follow their item" ON public.content_collaborators;
CREATE POLICY "Collaborators follow their item" ON public.content_collaborators
  FOR SELECT USING (collaborator_id = (SELECT auth.uid()) OR public.can_read_item(content_id));

DROP POLICY IF EXISTS "bounty_me_too_public_select" ON public.bounty_me_too;
DROP POLICY IF EXISTS "Me too marks follow their item" ON public.bounty_me_too;
CREATE POLICY "Me too marks follow their item" ON public.bounty_me_too FOR SELECT USING (public.can_read_item(content_id));

DROP POLICY IF EXISTS "bounty_responses_public_select" ON public.bounty_responses;
DROP POLICY IF EXISTS "Bounty responses follow their bounty" ON public.bounty_responses;
CREATE POLICY "Bounty responses follow their bounty" ON public.bounty_responses
  FOR SELECT USING (responder_id = (SELECT auth.uid()) OR public.can_read_item(bounty_content_id));

DROP POLICY IF EXISTS "Public can read leaderboard cache" ON public.solver_leaderboard_cache;
DROP POLICY IF EXISTS "Leaderboard follows its bounty" ON public.solver_leaderboard_cache;
CREATE POLICY "Leaderboard follows its bounty" ON public.solver_leaderboard_cache FOR SELECT USING (public.can_read_item(bounty_id));

DROP POLICY IF EXISTS "Post lineage readable by everyone" ON public.post_lineage;
DROP POLICY IF EXISTS "Post lineage is viewable by everyone" ON public.post_lineage;
DROP POLICY IF EXISTS "Post lineage follows its post" ON public.post_lineage;
CREATE POLICY "Post lineage follows its post" ON public.post_lineage FOR SELECT USING (public.can_read_item(post_id));

-- Tables that follow a parent with its own read rule: the EXISTS runs as the caller, so the parent's rule applies.

DROP POLICY IF EXISTS "bounty_verifications_public_select" ON public.bounty_response_verifications;
DROP POLICY IF EXISTS "Verifications follow their response" ON public.bounty_response_verifications;
CREATE POLICY "Verifications follow their response" ON public.bounty_response_verifications
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.bounty_responses r WHERE r.id = bounty_response_verifications.response_id));

DROP POLICY IF EXISTS "Public can view votes" ON public.solution_votes;
DROP POLICY IF EXISTS "Votes follow their solution" ON public.solution_votes;
CREATE POLICY "Votes follow their solution" ON public.solution_votes
  FOR SELECT USING (voter_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.solutions s WHERE s.id = solution_votes.solution_id));

DROP POLICY IF EXISTS "Public can read deadline extensions" ON public.bounty_deadline_extensions;
DROP POLICY IF EXISTS "Deadline extensions follow their bounty" ON public.bounty_deadline_extensions;
CREATE POLICY "Deadline extensions follow their bounty" ON public.bounty_deadline_extensions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = bounty_deadline_extensions.bounty_id));

DROP POLICY IF EXISTS "Anyone reads claims" ON public.request_claims;
DROP POLICY IF EXISTS "Claims follow their bounty" ON public.request_claims;
CREATE POLICY "Claims follow their bounty" ON public.request_claims
  FOR SELECT TO anon, authenticated
  USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.bounties b WHERE b.id = request_claims.request_id));

DROP POLICY IF EXISTS "Public can view all likes" ON public.comment_likes;
DROP POLICY IF EXISTS "Comment likes follow their comment" ON public.comment_likes;
CREATE POLICY "Comment likes follow their comment" ON public.comment_likes
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.content_comments c WHERE c.id = comment_likes.comment_id));

DROP POLICY IF EXISTS "Public can view upvotes" ON public.tip_upvotes;
DROP POLICY IF EXISTS "Tip upvotes follow their tip" ON public.tip_upvotes;
CREATE POLICY "Tip upvotes follow their tip" ON public.tip_upvotes
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.content_tips t WHERE t.id = tip_upvotes.tip_id));

DROP POLICY IF EXISTS "Reblog likes readable by all" ON public.reblog_likes;
DROP POLICY IF EXISTS "Reblog likes follow their reblog" ON public.reblog_likes;
CREATE POLICY "Reblog likes follow their reblog" ON public.reblog_likes
  FOR SELECT USING (liker_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.reblogs r WHERE r.id = reblog_likes.reblog_id));

DROP POLICY IF EXISTS "Public can view collection follows" ON public.collection_follows;
DROP POLICY IF EXISTS "Collection follows follow their collection" ON public.collection_follows;
CREATE POLICY "Collection follows follow their collection" ON public.collection_follows
  FOR SELECT USING (follower_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM public.collections c WHERE c.id = collection_follows.collection_id));

DROP POLICY IF EXISTS "Everyone reads a build's profile display" ON public.build_profile_display;
DROP POLICY IF EXISTS "Profile display follows its build" ON public.build_profile_display;
CREATE POLICY "Profile display follows its build" ON public.build_profile_display
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_profile_display.build_id));

-- A person's own interactions are theirs: the app only ever reads its own rows.
DROP POLICY IF EXISTS "Authenticated can view interactions" ON public.user_interactions;
DROP POLICY IF EXISTS "Users read their own interactions" ON public.user_interactions;
CREATE POLICY "Users read their own interactions" ON public.user_interactions
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.is_admin((SELECT auth.uid()))));

-- Logging tables: anyone may log (signed-out views count), but never in someone else's name.
DROP POLICY IF EXISTS "Anyone can insert ad impressions" ON public.ad_impressions;
CREATE POLICY "Anyone can insert ad impressions" ON public.ad_impressions
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Anyone can insert views" ON public.content_views;
CREATE POLICY "Anyone can insert views" ON public.content_views
  FOR INSERT WITH CHECK ((user_id IS NULL OR user_id = (SELECT auth.uid())) AND public.can_read_item(content_id));

DROP POLICY IF EXISTS "Anyone can log a view" ON public.post_view_log;
CREATE POLICY "Anyone can log a view" ON public.post_view_log
  FOR INSERT WITH CHECK ((viewer_id IS NULL OR viewer_id = (SELECT auth.uid())) AND public.can_read_item(post_id));

DROP POLICY IF EXISTS "Anyone can log an export" ON public.ai_export_log;
DROP POLICY IF EXISTS "Readers can log their own export" ON public.ai_export_log;
CREATE POLICY "Readers can log their own export" ON public.ai_export_log
  FOR INSERT WITH CHECK ((exporter_id IS NULL OR exporter_id = (SELECT auth.uid())) AND public.can_read_item_body(post_id));

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Storage: every write tied to its owner.
-- ---------------------------------------------------------------------------------------------------------------------

ALTER POLICY "Authors replace entry media" ON storage.objects
  WITH CHECK (bucket_id = 'build-media' AND (storage.foldername(name))[1] = 'entries' AND (storage.foldername(name))[2] = ((SELECT auth.uid()))::text);

ALTER POLICY "Creators update build media objects" ON storage.objects
  WITH CHECK (bucket_id = 'build-media' AND EXISTS (SELECT 1 FROM public.builds b WHERE b.id::text = (storage.foldername(objects.name))[1] AND b.creator_id = (SELECT auth.uid())));

ALTER POLICY "build-media owner update" ON storage.objects
  WITH CHECK (bucket_id = 'build-media' AND EXISTS (SELECT 1 FROM public.builds b WHERE b.id = public.try_uuid(split_part(objects.name, '/', 1)) AND (b.creator_id = (SELECT auth.uid()) OR (SELECT public.is_admin((SELECT auth.uid()))))));

ALTER POLICY "Users can update own avatar" ON storage.objects
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = ((SELECT auth.uid()))::text);

ALTER POLICY "Users can update own profile assets" ON storage.objects
  WITH CHECK (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = ((SELECT auth.uid()))::text);

ALTER POLICY "Users can update their own result media" ON storage.objects
  WITH CHECK (bucket_id = 'content-results' AND ((SELECT auth.uid()))::text = (storage.foldername(name))[1]);

ALTER POLICY "blueprint-media owner update" ON storage.objects
  WITH CHECK (bucket_id = 'blueprint-media' AND ((SELECT auth.uid()))::text = (storage.foldername(name))[1]);

-- content-files: paths are `<item>/...` and `covers/<item>/...` (src/pages/Upload.tsx, src/components/ProjectUploadForm.tsx),
-- so a file belongs to the creator of that item. The old rules compared the first folder with the user's id, which never
-- matched these paths for reads, updates or deletes, and checked nothing for uploads.
DROP POLICY IF EXISTS "Authenticated users can upload content files" ON storage.objects;
DROP POLICY IF EXISTS "Creators upload their items' files" ON storage.objects;
CREATE POLICY "Creators upload their items' files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-files' AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = public.content_file_item(name) AND ci.creator_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can update own content files" ON storage.objects;
DROP POLICY IF EXISTS "Creators update their items' files" ON storage.objects;
CREATE POLICY "Creators update their items' files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'content-files' AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = public.content_file_item(name) AND ci.creator_id = (SELECT auth.uid())))
  WITH CHECK (bucket_id = 'content-files' AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = public.content_file_item(name) AND ci.creator_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Users can delete own content files" ON storage.objects;
DROP POLICY IF EXISTS "Creators delete their items' files" ON storage.objects;
CREATE POLICY "Creators delete their items' files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'content-files' AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = public.content_file_item(name) AND ci.creator_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Owners can read own content files" ON storage.objects;
DROP POLICY IF EXISTS "Readers of an item's body read its files" ON storage.objects;
CREATE POLICY "Readers of an item's body read its files" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'content-files' AND public.can_read_item_body(public.content_file_item(name)));

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Tool submissions start as pending.
-- ---------------------------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authenticated users can submit tools" ON public.ai_tools_registry;
CREATE POLICY "Authenticated users can submit tools" ON public.ai_tools_registry
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_admin((SELECT auth.uid())))
    OR (
          submitted_by = (SELECT auth.uid())
      AND status = 'pending'
      AND approved_at IS NULL
      AND approved_by IS NULL
      AND coalesce(is_official, false) = false
    )
  );

ALTER POLICY "Admins can update tools" ON public.ai_tools_registry
  WITH CHECK ((SELECT public.is_admin((SELECT auth.uid()))));

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Accepting a solution gives a fixed amount, capped per day. The reward is set by the bounty's author and nothing is
--    paid, so it cannot decide anyone's points.
-- ---------------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rc_xp_solution_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Accepting your own solution earns nothing.
  IF NEW.solver_id IS NOT DISTINCT FROM NEW.bounty_author_id THEN
    RETURN NULL;
  END IF;

  -- At most three accepted solutions a day count for one solver, from any authors.
  IF (
    SELECT count(*)
      FROM public.xp_events e
     WHERE e.user_id = NEW.solver_id
       AND e.reason = 'solution_accepted'
       AND e.created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
  ) >= 3 THEN
    RETURN NULL;
  END IF;

  PERFORM public.rc_grant_xp(NEW.solver_id, 50, 'solution_accepted', 'solution', NEW.solution_id);
  RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. DM media: messages stop holding year-long signed links. Each is rewritten to a reference to its object, which the app
--    signs for ten minutes as the person looking (src/lib/dm/dmMedia.ts). Links already copied elsewhere stay valid until
--    they expire; only moving the objects would end them early.
-- ---------------------------------------------------------------------------------------------------------------------

UPDATE public.dm_messages
   SET image_url = 'storage:dm-images/' || split_part(substring(image_url FROM '/storage/v1/object/sign/dm-images/(.*)$'), '?', 1)
 WHERE image_url LIKE '%/storage/v1/object/sign/dm-images/%';

UPDATE public.dm_messages
   SET voice_url = 'storage:dm-voice/' || split_part(substring(voice_url FROM '/storage/v1/object/sign/dm-voice/(.*)$'), '?', 1)
 WHERE voice_url LIKE '%/storage/v1/object/sign/dm-voice/%';

COMMIT;

-- Kept as USING (true) on purpose, because these rows are public by design (mark them as accepted in the Lovable scan):
--   badges, challenges, site_challenges, perks, feature_flags, node_types, microtag_definitions, meta_bounty_sub_definitions,
--   model_releases, tool_compatibility (catalogues and reference data);
--   profiles (public profile; private columns are guarded by sec00_profiles_guard), follows, creator_marks, profile_pins,
--   guilds, guild_members, spaces, space_members (public social graph and community spaces, no private kind exists);
--   primitive_comments, primitive_comment_reactions, bounty_comment_reactions (comments on public things; their anchors are
--   polymorphic, so they cannot follow one parent table).
