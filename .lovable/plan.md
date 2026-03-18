

## Plan: Auto-approve uploads and skip review screen

### What changes
1. **`src/pages/Upload.tsx`** — Change `status: "pending"` to `status: "approved"` and set `approved_at: new Date().toISOString()` on the content_items insert. Replace the "Submission Received" success screen with a redirect to the new post (`/content/:id`) or a message saying "Your post is live!" with a link to view it.

2. **Same file** — Update the success screen copy:
   - Title: "Your post is live!"
   - Body: "Your blueprint has been published and is now visible in the feed."
   - Buttons: "View Post" (navigates to `/content/:id`) + "Upload Another" (existing reset logic)

### Technical detail
- Line 199: `status: "pending"` → `status: "approved"`
- Add `approved_at: new Date().toISOString()` to the insert object
- Store the inserted content ID in a ref/state so the success screen can link to it
- Lines 388-401: Update success UI with new copy and "View Post" button

