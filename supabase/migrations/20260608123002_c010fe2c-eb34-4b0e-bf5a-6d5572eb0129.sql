
DROP POLICY IF EXISTS "Public can view items in public collections" ON public.collection_items;
CREATE POLICY "Items follow collection visibility"
ON public.collection_items
FOR SELECT
TO public
USING (
  collection_id IN (
    SELECT id FROM public.collections
    WHERE visibility IN ('public','unlisted')
       OR owner_id = auth.uid()
       OR public.is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authenticated users can read content files" ON storage.objects;
CREATE POLICY "Owners can read own content files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'content-files'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Creators can insert own results" ON public.content_item_results;
DROP POLICY IF EXISTS "Creators can update own results" ON public.content_item_results;
DROP POLICY IF EXISTS "Creators can delete own results" ON public.content_item_results;
CREATE POLICY "Creators can insert own results" ON public.content_item_results
FOR INSERT TO authenticated
WITH CHECK (content_item_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));
CREATE POLICY "Creators can update own results" ON public.content_item_results
FOR UPDATE TO authenticated
USING (content_item_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));
CREATE POLICY "Creators can delete own results" ON public.content_item_results
FOR DELETE TO authenticated
USING (content_item_id IN (SELECT id FROM public.content_items WHERE creator_id = auth.uid()));

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications as themselves"
ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid() OR (actor_id IS NULL AND recipient_id = auth.uid()));

DROP POLICY IF EXISTS "Public can view all interactions" ON public.user_interactions;
CREATE POLICY "Authenticated can view interactions"
ON public.user_interactions
FOR SELECT TO authenticated USING (true);

REVOKE SELECT (stripe_account_id) ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.profile_stats FROM anon, authenticated;
