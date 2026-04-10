

## Add "User Evidence" Section, Auto-Create Tutorial Blocks for Stages, File Uploads in Tutorials, and Collapsible Header Fields

### What changes

**1. Collapsible Title, Description, and Evidence sections in CanvasHeader**
Currently title and description are always-visible inputs taking up vertical space. Convert them into collapsible dropdown toggles (chevron + label) that expand/collapse on click. All three sections (Title, Description, User Evidence) start collapsed but are marked mandatory (Title/Description show a red dot if empty). This keeps the canvas area maximized on load.

**2. Add "User Evidence" collapsible section** (`CanvasHeader.tsx`)
Below Description, add a new collapsible "Your Results" section with:
- A media type toggle: **Photo(s)**, **Video**, or **Written only**
- **Photo(s)**: file input accepting `image/*`, multiple files, rendered as a small horizontal thumbnail strip (carousel-like, max ~5). Uses `URL.createObjectURL` for local preview.
- **Video**: file input accepting `video/*`, single file, shows a small video thumbnail preview.
- **Written only**: just the caption.
- A **caption** textarea (max 500 chars) with character counter, shared across all media types.
- The entire section is compact — collapsed it's a single 32px row; expanded it's ~120px max.

Pass new props up through `CanvasShellProps`: `evidenceMedia`, `onEvidenceMediaChange`, `evidenceCaption`, `onEvidenceCaptionChange`.

**3. Auto-create a tutorial_step block when a stage is added** (`useCanvasDocument.ts`)
In `addStage`, after creating the stage, automatically call `addBlock('tutorial_step', ...)` with the block's `stageId` set to the new stage and `subheading` set to `"Stage N: {title}"`. The block is centered on the grid at the next available row.

**4. Tutorial block: support actual file uploads, not just URLs** (`ContentBlockBuilder.tsx` — `TutorialStepEditor`)
- For Image and Video media types, replace the URL-first approach with a file-upload-first approach:
  - Primary action: file picker button (`Upload image` / `Upload video`)
  - Secondary: small "or paste URL" text input below
  - Store the file object on the block as `tutorialMediaFile` and preview via `URL.createObjectURL`
- For Carousel: replace "paste URLs one per line" with a multi-file picker (`input multiple accept="image/*"`), showing thumbnails. Keep an "or paste URLs" fallback textarea.

**5. State management in Upload.tsx**
Add `evidenceMediaFiles` (File[]), `evidenceMediaType` ('photos' | 'video' | 'written'), and `evidenceCaption` (string) state. Pass through to `CanvasShell` → `CanvasHeader`. On save/publish, upload evidence files to storage bucket and store URLs in the draft's `content_items` row (new columns: `evidence_media_urls text[]`, `evidence_media_type text`, `evidence_caption text`).

### Files to edit

| File | What |
|------|------|
| `src/components/canvas/CanvasHeader.tsx` | Convert title/description to collapsible toggles, add collapsible "Your Results" evidence section |
| `src/components/canvas/CanvasShell.tsx` | Pass evidence props through to CanvasHeader |
| `src/hooks/useCanvasDocument.ts` | Auto-create tutorial_step block when stage is added |
| `src/components/ContentBlockBuilder.tsx` | Update TutorialStepEditor to prioritize file uploads over URLs for image/video/carousel |
| `src/pages/Upload.tsx` | Add evidence state, pass to CanvasShell, save evidence on draft save |

### Database migration
Add three columns to `content_items`:
```sql
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS evidence_media_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evidence_media_type text DEFAULT 'written',
  ADD COLUMN IF NOT EXISTS evidence_caption text DEFAULT '';
```

