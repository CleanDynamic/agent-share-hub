## Goal
Make `/upload/blueprint` (and the same shell for blog/bounty) read as a structured, symmetrical page — not a stack of expanded panels. Cover, title+description, and "Your results" all land as **collapsed dropdown toggles** so the editor itself is the visual anchor.

## Current problems
- `CompactUploadHeader` always renders cover slot + title + description expanded — heavy block at the top.
- "Your results" lives **below** the TipTap editor with a permanently visible drop zone, far away from the metadata.
- Spacing is inconsistent: header card has `880px` max-width while the editor uses `720px`; `ResultsSection` re-anchors to `720px`. That's the asymmetry.

## New layout (top → bottom, all centered, single 720px column)

```text
┌──── BLUEPRINT · BUILD ─────────────────────────┐  (type chip row, 720px)
├────────────────────────────────────────────────┤
│ ▸ Add cover image                          [+] │  collapsed toggle
├────────────────────────────────────────────────┤
│ ▸ Title & description                      [+] │  collapsed toggle (summary shows
│                                                │   title preview when filled)
├────────────────────────────────────────────────┤
│ ▸ Your results                             [+] │  collapsed toggle
└────────────────────────────────────────────────┘

           ── 24px gap ──

┌──── TipTap editor (720px) ─────────────────────┐
│ Tell your story…                               │
│                                                │
└────────────────────────────────────────────────┘
```

Each toggle row: 48px tall, full 720px width, `rgba(22,22,30,0.40)` bg, `0.5px solid rgba(255,255,255,0.10)` border, 10px radius, left-aligned label (Inter 13/500), right-aligned chevron. Hover lifts border opacity to 0.18. Rows stack with 8px gaps.

When expanded, the row grows downward into the existing control (cover dropzone / title+desc inputs / `ResultsCarouselEditor`) with 16px internal padding. Collapsing animates height (160ms ease-out).

## Changes

### 1. New `src/components/upload/UploadSectionToggle.tsx`
Small controlled disclosure primitive: props `{ label, summary?, defaultOpen?, filled?, children }`. Renders the row + animated content area. Shows a teal dot when `filled` is true (cover set / title typed / results added) so users see progress without expanding.

### 2. Rewrite `src/components/upload/CompactUploadHeader.tsx`
- Drop the single bordered card. Render three `UploadSectionToggle` rows:
  1. **Cover image** — `filled = !!coverUrl`, summary = "1 image" or "—". Body = current dropzone, full-width, 120px tall when open (taller than current 24px sliver so it actually reads as a cover slot).
  2. **Title & description** — `filled = title.trim().length > 0`, summary = `title || "Untitled"`. Body = current title input + textarea + char counter.
  3. **Your results** — receives `children` from Upload.tsx so the page passes `<ResultsSection contentItemId={…} />` in. `filled` derived from a new `hasResults` prop.
- Keep the type chip + sticky mini-bar behavior at the top (unchanged).
- Width becomes `720px` to match the editor.

### 3. `src/pages/Upload.tsx`
- Move the `<ResultsSection contentItemId={currentDraftId} />` block (lines ~1530–1533) **out** of the bottom slot and pass it into `CompactUploadHeader` as a `resultsSlot` prop (or children-of-toggle pattern).
- Wrap `ArticleEditor` container at `720px` max-width to match.
- Add 24px vertical spacing between header stack and editor.
- Add a `hasResults` boolean derived from whatever `ResultsSection` already exposes (fallback: check `currentDraftId`'s results count via the same hook `ResultsCarouselEditor` uses); pass to header.

### 4. Defaults
All three toggles start **collapsed** on a fresh draft. On an existing draft, auto-open any toggle whose `filled` is true so users see their data immediately. The cover/title/results sticky mini-bar still scrolls to top on click.

## Out of scope
- No changes to TipTap editor, toolbar, footer status bar, `Insert Grid / Save / Publish` buttons, or `ResultsCarouselEditor` internals.
- No backend/schema changes.
- No changes to blog/bounty editors beyond inheriting the new header (same component).

## Files touched
- `src/components/upload/UploadSectionToggle.tsx` (new)
- `src/components/upload/CompactUploadHeader.tsx` (rewrite render)
- `src/pages/Upload.tsx` (move results into header, align widths)
