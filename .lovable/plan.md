

# Plan: Seed 25 fake posts + fix build error

## 1. Fix build error in ContentBlockViewer.tsx (line 443)

Replace `p.replaceAll(...)` with `p.split(...).join(...)` — this avoids the ES2021 `replaceAll` requirement without changing `tsconfig`.

## 2. Seed 25 posts via edge function

Create a new edge function `supabase/functions/seed-new-posts/index.ts` that:

- Picks an existing demo user (queries `profiles` for any demo user like `alex_prompt`, or falls back to the first available profile)
- Inserts 25 `content_items` rows with `status: 'approved'` covering all content types and post type variations:
  - ~6 Builds (Agent Blueprint, Workflow Template, Agent Stack, Model Config Guide, Integration Guide)
  - ~6 Techniques (Prompt File, Evaluation Framework)
  - ~6 Discoveries (Failure Library, misc)
  - ~7 Discussions (Blog, Open Question, Challenge)
- Each post gets: a unique title, short description, difficulty (mix of Beginner/Intermediate/Advanced), ai_tools array, topics, and `approved_at = now()`
- Optionally inserts 1-2 `content_blocks` per post (text blocks) so the posts have body content

### Config addition
Add `[functions.seed-new-posts]` with `verify_jwt = false` to `supabase/config.toml`.

### How to run
Call it from the Admin panel or directly via the edge function URL. One-time use, idempotent (checks for a marker title).

## Technical details

**Files changed:**
- `src/components/ContentBlockViewer.tsx` — line 443: replace `replaceAll` with `split().join()`
- `supabase/functions/seed-new-posts/index.ts` — new edge function
- `supabase/config.toml` — add function config block

