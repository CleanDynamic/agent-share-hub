

## Plan: Add New Tables, Columns, Triggers, and RLS Policies

This is a schema-only change — no frontend code modifications. A single database migration will create all 10 new tables, add columns to `content_items` and `profiles`, create 2 triggers, seed microtag data, and apply all RLS policies.

### Migration Contents

**New Tables (10):**
1. `user_library` — personal library with update tracking
2. `content_dependencies` — declared dependencies between content items
3. `content_changelogs` — short human-readable update notes
4. `revenue_splits` — revenue sharing percentages for co-creators/forks
5. `collab_invites` — co-authorship invitations
6. `content_collaborators` — accepted co-authors
7. `curators` — approved curator accounts
8. `curator_recommendations` — curator editorial picks
9. `curator_applications` — applications to become a curator
10. `content_microtags` + `microtag_definitions` — predefined micro-tag system with 19 seed tags

**New Columns:**
- `content_items`: `last_verified_at`, `compatibility_status`, `verified_by_creator_at`, `pwyw_enabled`, `pwyw_floor_gbp`, `pwyw_avg_paid_gbp`, `pwyw_purchase_count`, `has_curator_recommendation`
- `profiles`: `is_curator`, `curator_application_status`

**Triggers (2):**
- `update_curator_badge()` — on `curator_recommendations` INSERT/UPDATE/DELETE, syncs `content_items.has_curator_recommendation`
- `mark_library_updates()` — on `content_versions` INSERT, sets `user_library.has_update = true` for users whose `last_seen_version` differs

**RLS Policies:** One migration applies all policies as specified — own-row access for user tables, public SELECT for public-facing tables, admin overrides via `is_admin()`, creator access via subqueries on parent content.

**Seed Data:** 19 microtag definitions inserted.

### Technical Notes
- Foreign keys reference `profiles(id)` not `auth.users(id)`, per project conventions
- `revenue_splits.percentage` validated at app layer (sum ≤ 90 per content_id) — no DB check constraint
- `collab_invites` RLS uses separate policies for inviter vs invitee UPDATE access
- `content_collaborators` INSERT uses `SECURITY DEFINER` function approach or service role since it's triggered on invite acceptance (will use a permissive policy allowing authenticated insert where user is the invitee of an accepted invite)

