
-- Update the public SELECT policy on collections to handle visibility states
DROP POLICY IF EXISTS "Public can view public collections" ON public.collections;

CREATE POLICY "Public can view collections by visibility" ON public.collections
FOR SELECT TO public
USING (
  visibility = 'public'
  OR visibility = 'unlisted'
  OR owner_id = auth.uid()
  OR is_admin(auth.uid())
);
