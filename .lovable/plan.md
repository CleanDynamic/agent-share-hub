## Investigation findings

Searched `src/` for `supabase.storage.from(...).upload(...)`. Existing call sites:

- **`src/lib/reblog/media.ts`** — closest to a reusable helper. `uploadReblogMedia({ rebloggerId, reblogId, file })` → `{ url, kind }`. Hard-codes the `reblog-media` bucket, no progress, no width/height/duration extraction.
- **`src/components/upload/ResultsSection.tsx`** — inline upload to `content-results` bucket.
- **`src/pages/Upload.tsx`** — many inline calls to `content-files` (cover, block media).
- **`src/components/dm/MessageInputBar.tsx`** — inline `dm-images` / `dm-voice`.
- **`src/pages/Profile.tsx`** — inline `profile-assets` / `avatars`.
- **`src/components/ProjectUploadForm.tsx`**, **`PublishUpdateModal.tsx`**, **`ReblogCard.tsx`**, **`ContentBlockViewer.tsx`** — inline per-feature uploads.

**No generic helper exists.** Each surface inlines its own upload. None extract image dimensions or video metadata, and none expose `onProgress`. The Supabase JS v2 `storage.upload` API doesn't expose progress events, so progress will be simulated/indeterminate.

Existing buckets in code: `content-files`, `content-results`, `reblog-media`, `dm-images`, `dm-voice`, `profile-assets`, `avatars`, `projects`. **No `blueprint-media` bucket exists.**

## Plan

Build the generic helpers per spec; no UI wiring.

### 1. Create `src/lib/media/uploadMedia.ts`

Exports:
```ts
export type UploadMediaArgs = {
  file: File;
  bucket: string;
  pathPrefix: string;
  onProgress?: (pct: number) => void;
};
export type UploadMediaResult = {
  url: string;
  path: string;
  kind: "image" | "video";
  width?: number;
  height?: number;
  durationSec?: number;
};
export async function uploadMedia(args: UploadMediaArgs): Promise<UploadMediaResult>;
export class MediaUploadError extends Error { code: string }
```

Behavior:
- Allowlist MIME: images `image/jpeg|png|webp|gif`, videos `video/mp4|webm|quicktime`. Reject with `MediaUploadError("MEDIA_TYPE_UNSUPPORTED", …)`.
- Size limits: images ≤ 10MB, videos ≤ 100MB → `MEDIA_TOO_LARGE`.
- Resolve `userId` via `supabase.auth.getUser()`; reject if absent.
- Path: `${pathPrefix}/${userId}/${crypto.randomUUID()}.${ext}` (ext derived from MIME, not filename).
- Pre-read intrinsic metadata in parallel with upload start: images via `new Image()` + `URL.createObjectURL(file)` → `naturalWidth/Height`; videos via hidden `<video preload="metadata">` → `videoWidth/Height` + `duration`. Always revoke the object URL.
- `supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" })`. On error, throw `MediaUploadError("UPLOAD_FAILED", error.message)`.
- Progress: SDK v2 has no real progress events for browser uploads — call `onProgress?.(0)` at start, then a small indeterminate tick loop (e.g. ramp 10 → 90 over time) and `onProgress?.(100)` on success. Clear the timer in `finally`.
- Return `{ url: getPublicUrl(path).data.publicUrl, path, kind, width?, height?, durationSec? }`.

### 2. Create `src/lib/media/deleteMedia.ts`

```ts
export async function deleteMedia(args: { bucket: string; path: string }): Promise<void>;
```
Calls `supabase.storage.from(bucket).remove([path])`; throws on error.

### 3. Create `src/lib/media/index.ts`

Barrel re-exporting both modules plus types/error class.

### 4. Bucket SQL (for the user to run — using the storage tools)

The bucket itself will be created with `supabase--storage_create_bucket` (`name: "blueprint-media"`, `public: true`). RLS policies on `storage.objects` will be issued via a migration:

```sql
-- Public read
create policy "blueprint-media public read"
on storage.objects for select
using (bucket_id = 'blueprint-media');

-- Authenticated insert into own folder (first path segment = uid)
create policy "blueprint-media owner insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'blueprint-media'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- Authenticated delete own files
create policy "blueprint-media owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'blueprint-media'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- Optional: owner update (replace metadata)
create policy "blueprint-media owner update"
on storage.objects for update to authenticated
using (
  bucket_id = 'blueprint-media'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
```

All policies use the `(select auth.uid())` form so the planner caches it once per query.

### Out of scope

- No edits to `Upload.tsx`, `CompactUploadHeader`, `ResultsSection`, or any UI component.
- Existing inline uploaders are left untouched (separate migration later if we choose).
