## Fixes

### 1. Remove the duplicate BLUEPRINT chip
`src/components/article/ArticleEditor.tsx` lines 997–1024 render a post-type pill (BLUEPRINT / BLOG / BOUNTY) right above the toolbar. `CompactUploadHeader` already shows this chip at the top. Delete that entire `<div>` block so only the header chip remains.

### 2. Align editor borders to the 720px column
The toolbar and tiptap article are both `maxWidth: 720` but the `ArticleEditor` root is `flex: 1` with no max-width, so the toolbar's background can stretch up to the wrapper (which is already 720). Symptom in the screenshot: editor toolbar reads slightly wider than the header toggle rows because the toolbar bar uses its own padding while toggle rows use `0 16px` insets.

Make both sides share identical bounds:
- In `src/pages/Upload.tsx`, change the editor wrapper from `padding: '24px 20px 40px'` + inner `maxWidth: 720` to the same outer structure as the header (`padding: '12px 20px 0'` for header is fine; editor stays `padding: '24px 20px 40px'`) but constrain the inner wrapper to **the same 720px and add `margin: 0 auto`** explicitly so it can't drift.
- In `ArticleEditor.tsx`, the toolbar container at line ~1122 already uses `maxWidth: 720, margin: '0 auto'`. Also constrain the **outer return `<div>` (line 748)** with `width: '100%', maxWidth: 720, margin: '0 auto'` so the toolbar and article live inside the same box as the header toggles. This eliminates any sub-pixel drift between the two columns.

No other behavior changes. Files touched: `ArticleEditor.tsx`, `Upload.tsx`.
