-- =============================================================================
-- NeoScale — gate build-media objects on build readability (NS-P11)
-- =============================================================================
-- WHY THIS EXISTS
-- ---------------
-- 20260825112911 shipped this policy, and it is the one that is live:
--
--   CREATE POLICY "build-media public read"
--     ON storage.objects FOR SELECT
--     TO anon, authenticated
--     USING (bucket_id = 'build-media');
--
-- Every object in the bucket, readable by anyone, with no reference to the
-- build it belongs to. Making the bucket private does not close that: `public`
-- governs the unauthenticated /object/public/ route, while this policy is what
-- the storage API consults when signing a URL. Under it an anonymous caller
-- can sign a URL for any object in the bucket, including the screenshots on
-- somebody's unpublished draft.
--
-- NS-P11 (20260823140000_build_media_storage.sql) specifies the opposite, and
-- says why in as many words: "Private. Nothing in it is served without a signed
-- URL, so a draft build's screenshots are as unreachable as its rows." This
-- restores that policy — the same three-way test the builds SELECT policy
-- applies, and the same one build_media's own row policy already applies.
--
-- WHY THE PATH IS COMPARED AS TEXT
-- --------------------------------
-- (storage.foldername(name))[1] is the first path segment: the build id, by
-- the convention NS-P11 fixed and every writer since has followed —
--
--   <build_id>/<node_id or 'unplaced'>/<uuid>.<ext>
--
-- It is compared against b.id::text rather than cast to uuid. A path whose
-- first segment is not a uuid would make the cast raise 22P02 and take the
-- whole statement down with it; compared as text it simply fails the check and
-- the object is not readable, which is the answer that policy wants.
--
-- SCOPE
-- -----
-- The SELECT policy only. The four write policies from 20260825112911 stay as
-- they are: they are already restricted to the build's owner, so none of them
-- is the hole this closes.
--
-- SAFE TO RUN NOW
-- ---------------
-- build_media holds no rows and the bucket holds no objects, so nothing
-- currently readable becomes unreadable. Both statements are guarded, so this
-- is correct against the live database and against one built from NS-P11,
-- where the policy already carries this name.
-- =============================================================================

DROP POLICY IF EXISTS "build-media public read" ON storage.objects;

DROP POLICY IF EXISTS "Build media objects follow build readability" ON storage.objects;

CREATE POLICY "Build media objects follow build readability"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'build-media'
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );
