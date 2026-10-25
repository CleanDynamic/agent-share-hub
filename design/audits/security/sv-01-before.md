# SV-01 · security baseline and plan

Checked on branch `sv-01-security`, from main at `eff1bce`. Miles did not paste the Supabase security advisor's findings, so the database part of this audit comes from `supabase/migrations/` only (each function's latest definition). The live database has drifted from the migrations (RULES.md section 8), so Part 6's migration is written to be correct in both worlds and the Lovable message asks for the advisor to be re-run afterwards.

## Assumptions

Each fact in "What is wrong now", and what was found on disk.

| # | Fact in the prompt | Found |
| --- | --- | --- |
| 1 | `update-user-password` takes `user_id` and `password` from the body, uses the service key, checks nothing, nothing in `src` calls it | True. 15 lines, `auth.admin.updateUserById`, no auth check. No `config.toml` entry, so the gateway default (`verify_jwt = true`) applies, and the public anon key is a valid JWT. No caller in `src`. |
| 2 | `ContentBlockViewer.tsx` line 701 uses `dangerouslySetInnerHTML` on `highlightVars(getFilledPrompt())` | True, same line. `highlightVars` is a regex replace that wraps `{{name}}` in a `<mark>`. |
| 3 | Checkout functions trust `price_amount`, `success_url`, `cancel_url`, and PWYW stats are written at checkout start | True for `create-checkout-session` and `create-split-checkout-session` (only `>= 100` is checked). True for the return URLs in all four. `create-pwyw-checkout-session` writes `pwyw_purchase_count` and `pwyw_avg_paid_gbp` after `sessions.create` (line 98 on). No caller in `src` for `create-split-checkout-session` or `create-subscription-session`. `create-donation-session` also trusts `amount_pence` (that is a tip, so the amount is the buyer's to choose) and `creator_id`. `create-project-package-session` falls back to the `Origin` header when no return URL is sent, and takes `success_url` and `cancel_url` unchecked when it is. |
| 4 | Open functions with `verify_jwt = false` and no login check | True for `notify-version-update` (trusts `creator_id`), `check-compatibility-status` (no schedule found in `supabase/migrations/`, the only `cron` migrations are the import expiry and the search index), `generate-ai-pdf` (service key, no check on `status` or `visibility`, uploads to the public `ai-pdfs` bucket and caches `ai_pdf_url` on the item, so a private or draft post's text can be published), `post-json` and `sitemap-xml` (service key where the public key would do; both already filter to `status = approved`, and `post-json` also to public visibility). |
| 5 | 18 functions answer every origin | True: 18 `index.ts` files carry `Access-Control-Allow-Origin: *`. |
| 6 | Inputs aren't checked | True. Every function reads `await req.json()` and uses fields as they come. `mcp` uses zod via its own `deno.json`; the other functions have no `deno.json`. |
| 7 | The connector address is written twice | True: `src/lib/connect/connector.ts:15` and `src/pages/Connect.tsx:81`. |
| 8 | Errors go nowhere | See Part 7 below for the counts. No `.github/` folder exists, so there is no third-party upload workflow. |

## Plan

- Part 1: remove `update-user-password`. -> verified by: a source test that the folder is gone and `updateUserById` appears nowhere in `supabase/functions`.
- Part 2: draw prompt text as React text, split on the variable pattern; guard raw HTML. -> verified by: a render test with markup in the prompt, a before/after snapshot, a copy test, and a source guard with an allow list.
- Part 3: price and splits from the database, return URLs checked against `_shared/origins.ts`, PWYW stats no longer written at checkout start, buyer id from the token. -> verified by: handler tests with a faked Stripe and database (lower body price ignored, foreign `success_url` gets 400, PWYW start changes no stats).
- Part 4: login or secret on every open function that writes; `generate-ai-pdf` refuses anything not public and approved unless the caller owns it; public key for `post-json` and `sitemap-xml`; GitHub host check; `config.toml`; module-level state. -> verified by: handler tests (unsigned refused, non-owner refused, missing secret refused).
- Part 5: one CORS helper, zod on the functions that write, spend or call out, one error shape. -> verified by: tests (foreign origin gets no allow header, a missing field gets 400 naming it).
- Part 6: one migration, `<timestamp>_sv01_function_access.sql`. -> verified by: a written check list (the repo has no SQL tests) plus a source test that the migration contains each statement.
- Part 7: `reportError`, wired in the three boundaries, the query client and `window`; no-console as a warning. -> verified by: tests (render error reaches `reportError` with the route; a failed query reaches it once; no DSN means no Sentry chunk).
- Part 8: after-table, secret and em dash search, `audit:design`.

## Baseline numbers

Measured on a clean checkout of main at `eff1bce`, in a separate worktree.

- `npm test`: 507 test files, 8,671 tests. **18 files and 65 tests already fail** before this prompt (AppShell, BountySection, flat-shell.wide, noRail, siteFrame, onePrompt.composer.snapshot, retiredSurfaces, theme compliance, motion, ns-classes, rcStates, BuildPage, SandboxCard, SandboxPage.sessionEdits, ca21.p6, ca26.p3, ca27.p3, referenceActions.ui). SV-01 must not add to them.
- `npx tsc --noEmit -p tsconfig.app.json`: clean.
- `npm run lint`: 2,451 problems (1,964 errors, 487 warnings), nearly all `no-explicit-any`. SV-01 adds none in the files it writes.
- `vite build`: first download `index-*.js` 598.07 kB, 187.66 kB gzip.

## The table

One row per edge function, per database function that needs a decision, and per raw HTML use. `Trusts` is what the code believes without checking.

### Edge functions

| Function | `verify_jwt` | Caller in `src` | Trusts | Will do |
| --- | --- | --- | --- | --- |
| `update-user-password` | default true (anon key passes) | none | `user_id` and `password` from the body | Delete (P1) |
| `create-checkout-session` | default true | `ContentCard.tsx`, `ContentDetail.legacy.tsx` | `price_amount`, `success_url`, `cancel_url` | Price from `content_items.price_gbp`, check URLs, buyer from token (P3) |
| `create-split-checkout-session` | false | none | `price_amount`, return URLs | Same; require a login (P3, P4) |
| `create-pwyw-checkout-session` | false | `PwywPriceSelector.tsx` | return URLs; writes stats at checkout start | Check URLs, bound the amount, stop writing stats (P3) |
| `create-donation-session` | default true | `TipSelector.tsx` | return URLs, `creator_id`, `creator_display_name` | Check URLs, check the creator exists, name from the database (P3) |
| `create-subscription-session` | default true | none | return URLs, `price_id` | Check URLs; already requires a login (P3) |
| `create-project-package-session` | default true | `ProjectDetail.tsx` | return URLs, `Origin` header | Check URLs (P3) |
| `verify-project-package` | default true | `ProjectDetail.tsx` | nothing it should not (checks `paid` and metadata) | CORS and error shape only (P5) |
| `notify-version-update` | false | `PublishUpdateModal.tsx`, `ContentEdit.tsx` | `creator_id` from the body; who owns `content_id` | Login, creator from token, ownership check (P4) |
| `check-compatibility-status` | false | none; nothing schedules it | the caller | `x-cron-secret` against `CRON_SECRET` (P4) |
| `generate-ai-pdf` | false | `generateAIPdf.ts`, `ReblogDetail.tsx` | the caller; `status` and `visibility` of the item | Refuse anything not public and approved unless the caller owns it (P4) |
| `post-json` | false | `netlify.toml` rewrite | service key | Public key; stays open to every origin (P4, P5) |
| `sitemap-xml` | false | `netlify.toml` rewrite | service key | Public key; stays open to every origin (P4, P5) |
| `import-github-readme` | false | `Upload.tsx` | the host: the regex finds `github.com/...` anywhere in the string, but only ever builds `https://api.github.com/...` URLs | Anchor the match to `https://github.com/`, refuse a path with `..` (P4) |
| `public-api` | false | docs page | public reads, module-level `ipCounts` rate-limit map | CORS stays open (P5); map listed under module state |
| `mcp` | false (deliberate, gated in code) | none from `src` | its own middleware | Untouched except the CORS helper is not used (it has its own discovery rules) |
| `generate-build-layers`, `parse-repo`, `parse-lovable`, `parse-transcript` | true | `src/lib/build/*` | the body | Shared CORS helper and a zod check (P5) |

### Raw HTML

| Use | Source of the markup | Will do |
| --- | --- | --- |
| `ContentBlockViewer.tsx:701` | the maker's own prompt text | Change to React text (P2) |
| `components/ui/chart.tsx:70` | CSS built from the chart's own config | Keep, add a comment (P2) |
| `pages/site/compose/listNest.tsx:72` | `cloneHtml` in `useBuildSorting.ts`, the `outerHTML` of an element React already drew | Keep, add a comment (P2) |
| `pages/site/compose/mapMorph.tsx:65` (`innerHTML =`) | `outerHTML` of an element React already drew | Keep, add a comment (P2) |

### Database functions (`SECURITY DEFINER`, latest definition in `supabase/migrations/`)

76 `SECURITY DEFINER` functions. Most are triggers (not callable as RPC) or already revoke `PUBLIC`, `anon` and `authenticated`, or already check `auth.uid()`. The ones that need a decision:

| Function | Reads or writes | `auth.uid()` check | Who can execute | Will do |
| --- | --- | --- | --- | --- |
| `get_quest_state(_user_id)` | reads and inserts `user_progress` for `_user_id` | none on `_user_id`; falls back to `auth.uid()` only when null | default `PUBLIC` plus `authenticated` | Refuse a `_user_id` that isn't the caller (P6) |
| `get_visible_surfaces(_user_id)` | same | same | same | Same (P6) |
| `get_post_lineage(_root_id)` | reads `content_items` titles and slugs, bypassing RLS | none | `authenticated` and `anon` | Only public and approved rows, or the caller's own (P6) |
| `rc_notify(...)` | inserts a notification for any recipient | none | default `PUBLIC` | Revoke from `PUBLIC`, `anon`, `authenticated`; the trigger functions that call it run as the owner (P6) |
| `mark_welcome_xp_shown()`, `mark_depth_revealed()` | write own `user_progress` | yes, raises when null | default `PUBLIC` | Revoke from `PUBLIC` and `anon` (P6) |
| `update_bounty_status_on_solution`, `update_bounty_verified_count` | trigger functions | n/a | n/a | Set `search_path` (P6) |
| `get_email_by_username(_username)` | reads `auth.users.email` | none | default `PUBLIC` (needed before sign-in) | Not changed: sign-in by username depends on it (`signInWithEmailOrUsername.ts`). Reported as a question. |
| `increment_content_view_count`, `increment_download_count`, `increment_project_view_count` | counters | none | default `PUBLIC` | Not changed: anonymous visitors count views. Reported. |
| `is_admin`, `is_thread_admin`, `is_thread_member`, `has_perk`, `can_delete_primitive_comment` | boolean checks used inside RLS policies | n/a | default `PUBLIC` | Not changed: revoking would break the policies that call them. Reported. |
| `award_xp` | writes XP | yes (`_user_id <> auth.uid()` raises) | revoked from `PUBLIC`, `anon` and `authenticated` by `20261001230000_rc_xp_close.sql` (RC-P25); my first scan read the older grant | Not changed; RULES.md says no client path may be added. |
