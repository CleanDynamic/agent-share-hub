

# Community-Powered AI Tool Registry — Plan

## Answers to Your Questions

### 1. Table Structure

A new `ai_tools_registry` table acts as the single source of truth:

```text
ai_tools_registry
├── id (uuid, PK)
├── name (text, unique, not null) — e.g. "ChatGPT"
├── submitted_by (uuid, nullable, references profiles.id)
├── status (text, default 'pending') — 'pending' | 'approved' | 'rejected'
├── created_at (timestamptz, default now())
├── approved_at (timestamptz, nullable)
└── rejected_reason (text, nullable)
```

The 8 existing tools (Any Tool, ChatGPT, Claude, Gemini, Grok, Zapier, Make, n8n) get seeded as rows with `status = 'approved'` and `submitted_by = null`.

**RLS policies:**
- Public SELECT where `status = 'approved'` (everyone can read the approved list)
- Authenticated INSERT with `submitted_by = auth.uid()` (logged-in users can submit)
- Admin SELECT all rows (for the review queue)
- Admin UPDATE (to approve/reject)

### 2. How Pages Load the Tools List

Every page that currently has a hardcoded `AI_TOOLS` array (Browse, Upload, Onboarding, ContentDetail) will instead call a shared React Query hook:

```text
useApprovedTools() → SELECT name FROM ai_tools_registry WHERE status = 'approved' ORDER BY name
```

This query gets cached by React Query with a reasonable stale time. When an admin approves a new tool, it appears everywhere on next page load — zero code changes needed.

The hardcoded arrays in `Browse.tsx`, `Upload.tsx`, and `Onboarding.tsx` get replaced with this hook's data.

### 3. Submission Fields

Minimal to reduce spam surface:
- **Tool name** (text, required, max 50 chars, trimmed)
- That's it. The admin decides if it's real. No URLs or descriptions needed — keeps the form simple and the spam vector tiny.

The submission UI is a small inline form: a text input + "Suggest a tool" button, shown below the AI tools checkbox list on the Upload page and optionally on Browse filters.

### 4. Spam Prevention

- **Auth-gated**: Only logged-in users can submit. Anonymous submissions blocked by RLS.
- **Rate limiting via unique constraint**: `UNIQUE(name)` prevents duplicate submissions. A compound unique on `(submitted_by, name)` or a simple check prevents the same user flooding.
- **Short field, strict validation**: Max 50 chars, alphanumeric + spaces only, trimmed. No URLs, no HTML.
- **No public visibility until approved**: Pending tools are invisible to non-admins.
- **Client-side duplicate check**: Before submitting, query if the name already exists (approved or pending) and show feedback.

### 5. Gotchas with Dynamic Enum-Like Lists

- **Loading states**: The tools list is async now, so filter UIs and checkbox lists need a loading/skeleton state. React Query handles this cleanly.
- **Stale data on content_items**: Existing content rows store tool names as `text[]`. If a tool name changes or gets removed, old content still references the old string. Solution: treat names as immutable once approved — no renaming, only soft-delete if needed.
- **"Any Tool" is special**: It's a meta-option, not a real tool. Seed it but handle it separately in filter logic (it means "no filter").
- **Ordering**: Alphabetical sort keeps the list predictable as it grows.

## Implementation Steps

1. **Database migration**: Create `ai_tools_registry` table with RLS. Seed the 8 existing tools as approved rows.
2. **Shared hook**: Create `useApprovedTools()` in a hooks file using React Query.
3. **Replace hardcoded arrays**: Update Browse, Upload, Onboarding, and ContentDetail to use the hook instead of static arrays.
4. **Submission UI**: Add "Suggest a tool" inline form to the Upload page (and optionally Browse filters). Validates input and inserts into `ai_tools_registry`.
5. **Admin tab**: Add a "Tool Submissions" tab to the Admin panel showing pending tools with Approve/Reject actions.

