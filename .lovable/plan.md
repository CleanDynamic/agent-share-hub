

## Fix: Content Blocks RLS Policies

**Problem**: Upload fails with "new row violates row-level security policy for table content_blocks". While the INSERT policy looks correct in the schema dump, there's a missing SELECT policy for creators to view their own (pending) blocks. The `.insert({...}).select("id").single()` pattern requires both INSERT and SELECT to succeed. Additionally, the `block_variations` table is missing a "creators can view own" SELECT policy.

**Fix**: Run a database migration that drops and recreates all `content_blocks` and `block_variations` RLS policies cleanly, ensuring:

1. **content_blocks INSERT**: `WITH CHECK (content_id IN (SELECT id FROM content_items WHERE creator_id = auth.uid()))`
2. **content_blocks SELECT (public)**: approved content only
3. **content_blocks SELECT (creator)**: own content (any status) — **this is the missing policy**
4. **content_blocks UPDATE/DELETE**: own content only
5. **block_variations**: same pattern, joining through content_blocks → content_items
6. **content_items INSERT**: confirm `creator_id = auth.uid()`

**Implementation**: Single database migration with the user's SQL. No code changes needed — the upload flow in `Upload.tsx` already inserts content_items first, then blocks immediately after.

### Technical Details

**File**: Database migration (via migration tool)

The migration will:
- Drop all existing policies on `content_blocks` by their current names (from schema: "Creators can insert own content blocks", "Creators can delete own content blocks", etc.)
- Recreate them with the same logic plus the missing creator SELECT policy
- Do the same for `block_variations` 
- Confirm `content_items` INSERT policy
- Ensure RLS is enabled on both tables

