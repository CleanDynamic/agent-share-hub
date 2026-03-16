

# NeoScale AI — Architecture Plan

## 1. Supabase Tables

| Table | Key Columns | Purpose |
|-------|------------|---------|
| **profiles** | `id (uuid, pk)`, `username (unique)`, `full_name`, `avatar_url`, `bio`, `website` | User/creator profiles, linked to `auth.users` |
| **user_roles** | `id`, `user_id (fk auth.users)`, `role (enum: admin, moderator, user)` | Role-based access (stored separately for security) |
| **agents** | `id`, `creator_id (fk profiles)`, `title`, `slug (unique)`, `description`, `instructions`, `model_compatibility (text[])`, `price (int, cents)`, `status (pending/approved/rejected)`, `thumbnail_url` | The core content items |
| **agent_files** | `id`, `agent_id (fk agents)`, `file_path`, `version`, `file_size` | Versioned files per agent (never overwrite — append new versions) |
| **tags** | `id`, `name (unique)` | Categories/tags |
| **agent_tags** | `agent_id`, `tag_id` | Junction table for many-to-many tagging |
| **downloads** | `id`, `user_id (fk profiles)`, `agent_id (fk agents)`, `created_at` | Track who downloaded what |
| **purchases** | `id`, `user_id`, `agent_id`, `stripe_session_id`, `created_at` | Track paid acquisitions (created via webhook, not client-side) |
| **subscriptions** | `id`, `user_id`, `creator_id`, `status`, `stripe_id` | Creator subscriptions |
| **service_listings** | `id`, `creator_id`, `title`, `base_price`, `description` | Custom service offerings by creators |

## 2. RLS Policies

**agents:**
- **SELECT**: Public can see `status = 'approved'`; creators see their own (any status); admins see all — using a `has_role()` security definer function to avoid recursion
- **INSERT**: Authenticated users only
- **UPDATE**: Only the `creator_id` owner, or admins

**agent_files:**
- **SELECT**: Allowed if the agent is free (`price = 0`), or the user has a matching `purchases` record, or the user is the creator

**profiles:**
- **SELECT**: Public (all)
- **UPDATE**: Only `auth.uid() = id`

**user_roles:**
- **SELECT/INSERT/UPDATE/DELETE**: Admin-only via `has_role(auth.uid(), 'admin')` security definer function — never self-referencing queries

**downloads / purchases:**
- **INSERT**: Authenticated, `user_id = auth.uid()`
- **SELECT**: Own records only

## 3. Supabase Storage Buckets

| Bucket | Access | Contents |
|--------|--------|----------|
| **agent-assets** | Public | Thumbnails, preview images |
| **agent-files** | Private | Actual `.json`, `.txt`, `.zip` agent files — accessed via signed URLs after purchase verification |
| **avatars** | Public | User profile pictures |

## 4. Pages & Routes

| Route | Page |
|-------|------|
| `/` | Landing — hero, featured agents grid |
| `/explore` | Filterable/searchable agent grid (`?category=...&model=claude`) |
| `/agents/:slug` | Agent detail — instructions (code block, not raw HTML), compatibility tags, download/buy |
| `/creators/:username` | Creator profile + their listings |
| `/submit` | Multi-step agent submission form |
| `/dashboard` | User's library (purchased/downloaded agents) |
| `/dashboard/sales` | Creator analytics and file management |
| `/admin` | Approval queue (admin-only) |
| `/auth` | Login / Sign up |

## 5. Gotchas to Avoid

1. **Roles on profiles table** — Never. Separate `user_roles` table with security definer function to prevent privilege escalation and RLS recursion.
2. **Version control** — Don't overwrite agent files. Use `agent_files` with version tracking so buyers keep access to the version they purchased.
3. **Prompt injection** — Never render raw `instructions` as HTML. Use a code block with copy-to-clipboard.
4. **Purchase records** — Create `purchases` rows only from Stripe webhook confirmation, never from client-side redirect (users can manipulate redirects).
5. **Search performance** — Use Postgres `pg_trgm` extension for fuzzy search instead of `LIKE` queries, which get slow at scale.
6. **File access** — Use signed URLs with expiry for private files, never expose bucket paths directly.

## Implementation Approach

We'll use **Lovable Cloud** (preferred) to spin up the Supabase backend without needing an external account. We'll build the frontend with the existing React + Tailwind + shadcn/ui stack, following the "Paper & Ink" design system with Geist Sans typography, sharp 2px radii, and International Klein Blue (`#0055FF`) as the sole accent color.

