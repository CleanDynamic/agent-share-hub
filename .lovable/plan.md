# Phase 15.2: Quote-Reblog UI Wiring

Wire the v0 selection overlay into the app, support excerpts in the reblog compose flow, and render excerpt cards in feed + detail surfaces.

## Files to create

1. **`src/components/quoting/QuotableSelectionOverlay.tsx`** — paste v0 session A verbatim. Floating pill toolbar (Reblog / Annotate / Copy) anchored to text selection rect; dismisses on Escape, scroll, outside click.

2. **`src/components/reblog/EmbeddedExcerptCard.tsx`** — paste v0 session C (re-typed cleanly since the pasted JSX is truncated/garbled — reconstruct from prop shape and styling cues). Renders quoted excerpt with author chip, post-type pill, expand/collapse for >360 chars, "may have been edited" warning when `!isExcerptStillValid`, unavailable placeholder when `!isSourceAvailable`.

3. **`src/components/quoting/QuotableSelectionProvider.tsx`** — singleton mount. Owns selection state, listens to `selectionchange`, validates min length ≥4 and that anchor+focus both live inside a `data-quotable="true"` ancestor, computes overlay placement (above when room, else below), exposes selection's source post + block IDs via `data-source-post-id` / `data-source-block-id` on the quotable wrapper. Actions:
   - `onQuoteReblog` → calls `useReblogCompose().openReblog(...)` with new `excerptContext`.
   - `onAnnotate` → toast placeholder (Phase 16C).
   - `onCopy` → `navigator.clipboard.writeText` + toast.

## Files to edit

4. **`src/contexts/ReblogComposeContext.tsx`**
   - `ReblogTargetInput` gains `excerptContext?: { text, sourceBlockId?, sourceBlockTypeLabel? }`.
   - Plumb into local state; pass to sheet; on post, forward to `createReblog` as `excerptText` / `excerptSourceBlockId` / `excerptSourceBlockTypeLabel`.

5. **`src/components/reblog/ReblogComposeSheet.tsx`** (existing)
   - Accept `excerptContext` prop + `sourcePost` for `EmbeddedExcerptCard`.
   - When excerpt present: swap `EmbeddedOriginalCard` for `EmbeddedExcerptCard`; placeholder = "Add your take on this quote…".

6. **`src/components/reblog/ReblogFeedCard.tsx`**
   - Accept optional `excerpt` + `isExcerptStillValid` props.
   - When `excerpt` set: render `EmbeddedExcerptCard` instead of `EmbeddedOriginalCard`; pill label = "QUOTE".

7. **`src/pages/ReblogDetail.tsx`** — same swap; click on excerpt card → `navigate('/b/{slug}?excerpt-anchor={blockId}&excerpt-text-hash={hash}')`.

8. **`src/pages/ContentDetail.tsx`**
   - Read `excerpt-anchor` / `excerpt-text-hash` from URL on mount.
   - After render, find matching block element (by `data-block-id`) or text node, scroll into view, apply `.excerpt-pulse` class for 1s.
   - Add `data-quotable="true"` + `data-source-post-id={post.id}` on article body wrapper and on each block wrapper (with `data-source-block-id`).

9. **`src/components/AppLayout.tsx`** (or wherever Phase 14 shell lives) — mount `<QuotableSelectionProvider />` once.

10. **`src/index.css`** — add `.excerpt-pulse` keyframes (1s outline pulse in `hsl(var(--brand-orange))` ≈ Sienna `#E8571A`) and `@keyframes overlay-in` for the toolbar fade-in.

## Quotable surface decoration

Add `data-quotable="true"` (and `data-source-block-id={id}` where applicable) to:
- Article body renderer wrapper (TipTap output)
- Each Block component
- Each Stage component
- Each Slide content area
- Solution content (bounty-solver)

## Technical notes

- Selection containment check: walk both `range.startContainer` and `range.endContainer` parents, both must reach the same `[data-quotable="true"]` ancestor; sourceBlockId = nearest `[data-source-block-id]`; sourcePostId = nearest `[data-source-post-id]`.
- Position math: `rect = range.getBoundingClientRect()`; default `placement="above"` with `y = rect.top - 8`; if `rect.top < 60` flip to below (`y = rect.bottom + 12`). `x = rect.left + rect.width/2`.
- Touch: `selectionchange` already fires on mobile after `touchend`; debounce with `requestAnimationFrame` to wait for selection finalization.
- Hash for excerpt anchor: reuse SHA-256 from `validateExcerpt` if exported, otherwise pass plain text via query string.

## Out of scope
- Annotation persistence (Phase 16C).
- Realtime/optimistic reblog insertion.
- Editing already-posted excerpt reblogs.
