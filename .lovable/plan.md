

## Diagnosis

The error **"new row violates row-level security policy for table content_blocks"** occurs because the upload flow performs several async operations (file uploads, cover image upload, dependency inserts, revenue split inserts, collab invite inserts, notification inserts) **between** the `content_items` INSERT and the `content_blocks` INSERT. During these intermediate operations, the auth JWT can become stale or the session state can shift, causing `auth.uid()` to return null in the RLS subquery check.

The content_blocks INSERT RLS policy requires:
```sql
content_id IN (SELECT id FROM content_items WHERE creator_id = auth.uid())
```

If `auth.uid()` is null by the time content_blocks is inserted, this check fails even though the content_item was successfully created moments earlier.

## Fix

**Restructure the submit flow in `Upload.tsx`** to insert content_blocks immediately after content_items, before any other async work. This minimizes the window for token staleness.

### Reordered submit sequence:

1. Refresh session + get user (existing)
2. INSERT content_items (existing)
3. **INSERT content_blocks + block_variations** (moved up from after all the updates)
4. Upload cover image, WTE images, tool_url, custom_use_case (existing)
5. Insert dependencies, revenue_splits, collab_invites, notifications (existing)
6. Save tags (existing)

Additionally, add a session refresh check before the blocks loop as a safety net:
```typescript
const { error: refreshErr } = await supabase.auth.refreshSession();
if (refreshErr) throw new Error("Session expired. Please sign in again.");
```

### Files to edit:
- **`src/pages/Upload.tsx`**: Reorder the submit function body so content_blocks insert happens on lines immediately following the content_items insert (before cover image upload, dependencies, collab invites, etc.)

No database or RLS changes needed. The policies are correct; the issue is purely a client-side ordering/timing problem.

