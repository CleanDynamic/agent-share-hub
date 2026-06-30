## Fix: cover upload RLS rejection

**Root cause**
The `blueprint-media` storage policies require `auth.uid()::text = (storage.foldername(name))[1]` — the user id must be the **first** path segment. `src/lib/media/uploadMedia.ts` currently builds `${pathPrefix}/${userId}/${uuid}.${ext}`, putting `pathPrefix` (e.g. `blueprint-covers`) first, so every insert violates the policy.

**Change**
In `src/lib/media/uploadMedia.ts`, swap the path order to put the user id first:

```
${userId}/${cleanPrefix}/${crypto.randomUUID()}.${ext}
```

No schema, policy, or UI changes. Existing callers (only `CoverImageField` so far) are unaffected — they don't construct paths themselves.

**Verify**
- Re-upload a cover image; confirm the file lands at `blueprint-media/{uid}/blueprint-covers/...` and the draft persists `cover_image_url` / `cover_image_path`.
- Confirm Replace and Remove still work (they use the returned `path`, which now includes the new ordering).