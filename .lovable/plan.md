

# NeoScale Feature Expansion + Build Error Fixes

## Phase 1: Fix Build Errors (3 files)

### 1.1 — Fix `verify-project-package/index.ts` import
Change `npm:@supabase/supabase-js@2.57.2` to `https://esm.sh/@supabase/supabase-js@2` (same fix applied to other edge functions previously).

### 1.2 — Fix `Browse.tsx` variable hoisting (TS2448)
`bountyTypeFilter` and `bountyStatusTabFilter` are declared at line 352 but referenced in a `useMemo` at line 216/223. Move their declarations above the `useMemo` that uses them (before line 210).

### 1.3 — Fix `CreatorProfile.tsx` deep type (TS2589)
The `.eq("bounty_enabled" as any, true)` query at line 198 triggers excessive type instantiation. Cast the query chain with `as any` to break the deep type recursion (same pattern used in `ReblogButton.tsx`).

---

## Phase 2: Compatibility Table on Content Detail

Replace the simple "Works with" pill list with a structured compatibility table.

### Database
- Add new table `tool_compatibility` with columns: `id`, `content_id`, `tool_name`, `tool_version`, `verified_at`, `verified_by`, `status` (enum: works/partial/broken), `notes`.
- RLS: public SELECT, authenticated INSERT/UPDATE for creator or verifier.

### Content Detail page
- Below the existing "Works with" section, render a table with columns: Tool, Version, Status (green check / amber warning / red x), Verified date, Notes.
- If no compatibility entries exist, fall back to showing the current pill list.
- Creators see an "Add compatibility entry" button that opens an inline form (tool dropdown from `ai_tools_registry`, version text input, status select, optional notes).

---

## Phase 3: Topics Filter System

Add a `topics` text array column to `content_items` and a predefined topics list.

### Database
- `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}'::text[]`

### Topics list (predefined, stored in code)
- Git Workflows, Prompt Engineering, CI/CD & DevOps, API Integration, Data Analysis, Web Scraping, Content Creation, Code Review, Testing & QA, Security, Database, Infrastructure

### Upload form
- Add a "Topics" multi-select section (checkboxes like use_cases) below the existing Use Cases field.

### Browse page
- Add Topics as a new filter group in the filter drawer, same pattern as use_cases.

### Feed cards
- Display topic pills alongside existing use_case pills.

---

## Phase 4: GitHub Import on Upload Form

### Upload form changes
- Add an "Import from GitHub" button at the top of the Blueprint upload form (next to the upload type selector area).
- When clicked, show a text input for a GitHub URL (e.g. `https://github.com/user/repo` or `https://github.com/user/repo/blob/main/README.md`).
- A "Fetch" button triggers a backend edge function.

### Edge function: `import-github-readme`
- Accepts a GitHub URL, extracts owner/repo/path.
- Calls `https://api.github.com/repos/{owner}/{repo}/readme` (or specific file via contents API).
- Returns the decoded markdown content.
- No API key needed for public repos (rate limited to 60/hr).

### Pre-fill logic (client-side)
- Parse the returned markdown:
  - First `# heading` → Title field
  - First paragraph → Description field
  - Remaining content → a single "Long Text" content block with the full markdown
- Creator can then edit all pre-filled fields before submitting.

---

## Phase 5: Public API

### Edge function: `public-api`
- Single edge function with path-based routing.
- Endpoints:
  - `GET /blueprints` — list approved content with pagination, filters (type, tool, difficulty, topic).
  - `GET /blueprints/:id` — single blueprint detail with blocks.
  - `GET /tools` — list approved AI tools from registry.
- Returns JSON with standard pagination (`page`, `per_page`, `total`).
- Rate limited by IP (simple in-memory counter).
- No auth required (public read-only, respects existing RLS for approved content).

### API docs page
- New route `/api-docs` with a simple static page documenting the endpoints, parameters, and example responses.
- Accessible from the footer.

---

## Phase 6: Promote Install Guide

### Content type ordering
- Move "AI Agent Install Guide" to position 3 in `ORDERED_CONTENT_TYPES` and `BLUEPRINT_CONTENT_TYPES` (after Agent Blueprint, before Model Config Guide).

### Browse page
- Give Install Guide its own featured section or prominent position in the type filter pills.

### Content Detail page
- When viewing an Agent Blueprint, show a "Related Install Guides" section in the sidebar that queries for Install Guides tagged with the same AI tools.

### Upload form
- When "AI Agent Install Guide" is selected, show helper text: "Install Guides bridge the gap between a Blueprint and actually using it. Include step-by-step setup instructions."

---

## Technical Details

### Files to modify
- `supabase/functions/verify-project-package/index.ts` — fix import
- `src/pages/Browse.tsx` — fix variable hoisting
- `src/pages/CreatorProfile.tsx` — fix type depth
- `src/lib/content-types.ts` — reorder Install Guide, add TOPICS constant
- `src/pages/Upload.tsx` — add Topics checkboxes, GitHub import button, Install Guide helper text
- `src/pages/ContentDetail.tsx` — compatibility table, related install guides
- `src/components/FeedItem.tsx` — display topics
- New: `supabase/functions/import-github-readme/index.ts`
- New: `supabase/functions/public-api/index.ts`
- New: `src/pages/ApiDocs.tsx`
- New: `src/components/CompatibilityTable.tsx`
- Database migrations for `tool_compatibility` table and `topics` column

### Execution order
1. Fix all 3 build errors first
2. Database migrations
3. Topics filter system
4. Compatibility table
5. GitHub import
6. Public API
7. Install Guide promotion

