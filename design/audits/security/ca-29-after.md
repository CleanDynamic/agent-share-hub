# CA-29 · Security after

The Part 0 table in `ca-29-before.md`, with what each row is now.

## Edge functions

| Function | `verify_jwt` now | What it trusts now | State |
| --- | --- | --- | --- |
| `update-user-password` | n/a | n/a | **Deleted.** `src/test/ca29PasswordFunction.test.ts` holds it deleted and `updateUserById` out of `supabase/functions`. The live copy must be deleted by hand (Lovable message in the report). |
| `create-checkout-session` | default true | the item's `price_gbp` and `monetisation_type` from `content_items`; return addresses on `ALLOWED_ORIGINS`; the buyer's id from the token | `price_amount` in the body is not read. A body that does not fit gets a 400 naming the field. A foreign `success_url` or `cancel_url` gets a 400. |
| `create-split-checkout-session` | **true** (was false) | the item's price and its `revenue_splits` from the database; return addresses; buyer id from the token | same. No caller in `src`. |
| `create-pwyw-checkout-session` | **true** (was false) | the item's `is_pwyw` and `pwyw_floor_gbp`; the buyer's amount between the floor (and £1) and £1,000 | **Writes nothing.** Stats no longer move at checkout start. |
| `create-donation-session` | default true | the amount (whole pence, £1 to £1,000), the creator id, return addresses | return addresses checked, body checked. |
| `create-subscription-session` | default true | the creator's own `profiles.subscription_price_id`; a login; return addresses | `price_id` in the body is not read. No caller in `src`. |
| `create-project-package-session` | default true | the project's `package_price_gbp`; a login; return addresses, with the `origin` header used only when it is an allowed origin | success address now carries `session_id={CHECKOUT_SESSION_ID}`, which `verify-project-package` needs. |
| `verify-project-package` | default true | a login; Stripe's `payment_status`; the session's metadata against the caller | errors are 401, 402, 403 and 400 by cause; the upsert's error is no longer dropped. |
| `notify-version-update` | **true** (was false) | a login; the creator from the token; ownership from `content_items.creator_id` | `creator_id` in the body is not read. 401, 403 and 404 by cause. |
| `check-compatibility-status` | false (deliberate) | the `x-cron-secret` header against `CRON_SECRET`; with no secret set nobody can run it | 401 otherwise. **Nothing schedules it today** (pg_cron is installed, no job exists). |
| `generate-ai-pdf` | **true** (was false) | the post's `status` and `visibility`; the caller's id against `creator_id` | public and approved only, or the owner. A non-owner of a private post gets 404 and no cached address. The address of a PDF of a non-public post is not stored on the row. |
| `post-json`, `sitemap-xml` | false (deliberate) | public rows, read with the public key | every origin allowed; error text no longer sent. |
| `public-api` | false (deliberate) | public rows, public key | every origin allowed; error text no longer sent. `ipCounts` stays (see below). |
| `import-github-readme` | **true** (was false) | a `https://github.com/owner/repo[/blob/branch/path]` address, parsed; the only fetch is `https://api.github.com/repos/...` | any other address: 400. GitHub's own error text is no longer sent. |
| `generate-build-layers`, `parse-repo`, `parse-lovable`, `parse-transcript` | true (unchanged) | login and build ownership (unchanged) | CORS helper, a zod schema in `schema.ts`, one error shape. Too-long text keeps its 413. |
| `mcp` | false (documented) | `withSupabase({ auth: 'user' })` | unchanged; CORS is answered by `@supabase/server`. |

Module-level state in edge functions after the change: `public-api/index.ts` `ipCounts` (a per-instance rate limiter keyed by caller IP; left, because moving it into the handler removes the limit). The clients built once at module level from environment values (`createClient`, `new Stripe`) hold nothing about a caller.

## Raw HTML

| Place | Now |
| --- | --- |
| `ContentBlockViewer.tsx` | **Removed.** The prompt is React text split on `{{name}}`; each variable is a `<span>` with the same style. `src/components/ContentBlockViewer.prompt.test.tsx`. |
| `components/ui/chart.tsx` | kept, with a comment (CSS from the chart's own config). |
| `pages/site/compose/listNest.tsx` | kept, with a comment (`outerHTML` of an element React drew). |
| `pages/site/compose/mapMorph.tsx` | kept, with a comment (same). |
| any new use | fails `src/lib/rawHtmlGuard.test.ts`. |

## Database functions

`supabase/migrations/20261026120000_ca29_function_access.sql` (written, **not applied**), checked by `supabase/tests/ca29-function-access.sql`.

| Function | Now |
| --- | --- |
| `claim_challenge`, `mark_depth_revealed`, `mark_welcome_xp_shown`, `record_daily_activity`, `respec_track`, `set_user_track`, `soft_delete_primitive_comment`, `resolve_report` | EXECUTE revoked from PUBLIC and anon; granted to authenticated. |
| `get_quest_state` | refuses a `_user_id` that is not the caller's; revoked from PUBLIC and anon. |
| the 51 `SECURITY DEFINER` trigger functions | EXECUTE revoked from PUBLIC, anon and authenticated. |
| the two bounty triggers without one (and anything else the live catalogue shows) | `search_path = public`. |
| `rc_notify`, `rc_award_badge`, `rc_grant_xp`, `award_xp`, `accept_bounty_solution` | already closed; untouched. |
| `get_visible_surfaces`, `get_email_by_username`, `is_admin`, `is_thread_admin`, `is_thread_member`, `has_perk`, `can_delete_primitive_comment`, `increment_*_count`, `get_post_lineage` | **left open on purpose** (see the migration header and the report). |

## Errors

`reportError(error, context)` in `src/lib/errors/report.ts` is called by `ErrorBoundary`, `RouteBoundary`, `PanelBoundary`, the query client's two caches, the window's `error` and `unhandledrejection`, and the checkout, notification, PDF and password reset paths. It keeps the last 50 (kind, code, context; never the message), prints in development, and sends a scrubbed copy to Sentry only when `VITE_SENTRY_DSN` is set. The remaining dropped writes are in `ca-29-dropped-errors.md`.
