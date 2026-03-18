-- Drop existing policies on content_blocks
DROP POLICY IF EXISTS "Creators can insert own content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Creators can delete own content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Creators can update own content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Public can view blocks of approved content" ON content_blocks;
DROP POLICY IF EXISTS "Users can insert their own content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Authenticated users can insert content blocks" ON content_blocks;
DROP POLICY IF EXISTS "content_blocks_insert_policy" ON content_blocks;
DROP POLICY IF EXISTS "Public can view content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Anyone can view approved content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Creators can view their own content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Users can update their own content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Users can delete their own content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Public can view approved content blocks" ON content_blocks;
DROP POLICY IF EXISTS "Creators can view own content blocks" ON content_blocks;

-- Recreate content_blocks policies
CREATE POLICY "Users can insert their own content blocks"
ON content_blocks FOR INSERT TO authenticated
WITH CHECK (
  content_id IN (SELECT id FROM content_items WHERE creator_id = auth.uid())
);

CREATE POLICY "Public can view blocks of approved content"
ON content_blocks FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = content_blocks.content_id AND content_items.status = 'approved')
);

CREATE POLICY "Creators can view own content blocks"
ON content_blocks FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = content_blocks.content_id AND content_items.creator_id = auth.uid())
);

CREATE POLICY "Creators can update own content blocks"
ON content_blocks FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = content_blocks.content_id AND content_items.creator_id = auth.uid())
);

CREATE POLICY "Creators can delete own content blocks"
ON content_blocks FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM content_items WHERE content_items.id = content_blocks.content_id AND content_items.creator_id = auth.uid())
);

-- Drop existing policies on block_variations
DROP POLICY IF EXISTS "Creators can insert own block variations" ON block_variations;
DROP POLICY IF EXISTS "Creators can delete own block variations" ON block_variations;
DROP POLICY IF EXISTS "Creators can update own block variations" ON block_variations;
DROP POLICY IF EXISTS "Public can view variations of approved content" ON block_variations;
DROP POLICY IF EXISTS "Users can insert their own block variations" ON block_variations;
DROP POLICY IF EXISTS "Public can view block variations of approved content" ON block_variations;
DROP POLICY IF EXISTS "Creators can view their own block variations" ON block_variations;
DROP POLICY IF EXISTS "Public can view approved block variations" ON block_variations;
DROP POLICY IF EXISTS "Creators can view own block variations" ON block_variations;
DROP POLICY IF EXISTS "Users can insert block variations" ON block_variations;
DROP POLICY IF EXISTS "Public can view block variations" ON block_variations;

-- Recreate block_variations policies
CREATE POLICY "Users can insert their own block variations"
ON block_variations FOR INSERT TO authenticated
WITH CHECK (
  block_id IN (
    SELECT cb.id FROM content_blocks cb
    JOIN content_items ci ON cb.content_id = ci.id
    WHERE ci.creator_id = auth.uid()
  )
);

CREATE POLICY "Public can view variations of approved content"
ON block_variations FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_blocks cb
    JOIN content_items ci ON cb.content_id = ci.id
    WHERE cb.id = block_variations.block_id AND ci.status = 'approved'
  )
);

CREATE POLICY "Creators can view own block variations"
ON block_variations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_blocks cb
    JOIN content_items ci ON cb.content_id = ci.id
    WHERE cb.id = block_variations.block_id AND ci.creator_id = auth.uid()
  )
);

CREATE POLICY "Creators can update own block variations"
ON block_variations FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_blocks cb
    JOIN content_items ci ON cb.content_id = ci.id
    WHERE cb.id = block_variations.block_id AND ci.creator_id = auth.uid()
  )
);

CREATE POLICY "Creators can delete own block variations"
ON block_variations FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM content_blocks cb
    JOIN content_items ci ON cb.content_id = ci.id
    WHERE cb.id = block_variations.block_id AND ci.creator_id = auth.uid()
  )
);

-- Ensure RLS is enabled
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE block_variations ENABLE ROW LEVEL SECURITY;