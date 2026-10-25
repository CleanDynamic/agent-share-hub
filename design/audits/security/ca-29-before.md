# CA-29 · Security baseline and plan

Read at `1954f55` (main, 25 October 2026). The prompt's facts were written at `6b8fe912`; the checks below are against the files on disk.

## Assumptions

Each fact in "What is wrong now", and what the files show.

1. **Open password function.** True. `supabase/functions/update-user-password/index.ts` reads `user_id` and `password` from the body and calls `auth.admin.updateUserById` with the service key. No login check, no ownership check, no `config.toml` block (so `verify_jwt` defaults to true, and the site's public key is a valid JWT). Nothing in `src` calls it (`grep update-user-password src` finds nothing). The reset page uses `supabase.auth.updateUser({ password })` in `src/lib/auth/passwordReset.ts:24`, on the recovery session.
2. **Prompt text drawn as HTML.** True. `ContentBlockViewer.tsx:701` sets `dangerouslySetInnerHTML` to `highlightVars(getFilledPrompt())`; `highlightVars` is a regex replace on the unescaped string. Reached from `PromptViewer` (line 1339) through `RenderBlockContent`, which `components/build/renderers/shared.tsx` and `artefact.tsx` import.
3. **Checkout trusts the browser.** True.
   - `create-checkout-session` and `create-split-checkout-session` take `price_amount` from the body; the only check is `>= 100`.
   - `create-checkout-session`, `create-donation-session`, `create-pwyw-checkout-session` and `create-split-checkout-session` take `success_url` and `cancel_url` from the body. Also `create-subscription-session` (same shape). `create-project-package-session` takes optional `success_url` and `cancel_url` from the body and falls back to the `origin` header: same hole, not named in the prompt, fixed the same way.
   - `create-pwyw-checkout-session` writes `pwyw_purchase_count` and `pwyw_avg_paid_gbp` after the Stripe session is created (line 98 onward), at checkout start.
   - Item price: `content_items.price_gbp` (numeric, pounds). For sale is `monetisation_type = 'paid'` (the card uses this: `isPaid = monetisation_type === "paid"`). PWYW is `is_pwyw` with `pwyw_floor_gbp`.
   - No caller in `src` for `create-split-checkout-session` or `create-subscription-session`. True.
   - `verify-project-package` is the only place that checks `payment_status === "paid"`, and it only handles project packages (metadata `project_id`). Nothing confirms a PWYW payment. No Stripe webhook function exists in `supabase/functions`.
4. **Open functions.** True for `notify-version-update`, `check-compatibility-status`, `generate-ai-pdf`, `post-json`, `sitemap-xml`, all `verify_jwt = false` in `config.toml`, all using the service key.
   - `notify-version-update` takes `creator_id` from the body and checks no login and no ownership. Caller: `PublishUpdateModal.tsx:110`.
   - `check-compatibility-status`: no caller in `src`; **no schedule in `supabase/migrations/`** (`grep -ri "cron\|check-compatibility" supabase/migrations` finds none).
   - `generate-ai-pdf`: **does not refuse drafts or private posts.** It reads `status` and `visibility` but never tests them; its cache branch also returns a stored URL without any test. The reblog branch reads any reblog not soft-deleted and never looks at the original post's state. It uploads to the public `ai-pdfs` bucket. Caller: `src/lib/content-detail/generateAIPdf.ts`.
   - `post-json`, `sitemap-xml`: read public rows with `SUPABASE_SERVICE_ROLE_KEY ?? SUPABASE_ANON_KEY`.
5. **CORS.** True: 18 `index.ts` files carry `Access-Control-Allow-Origin: *` (`mcp` does not; it is gated by `withSupabase`).
6. **Inputs.** True: every function reads `await req.json()` and uses fields as they come. `mcp/deno.json` maps `zod/v4` to `npm:zod@^4.2.0/v4`. `zod` 3.25.76 is in `package.json` and carries a `zod/v4` entry, so a test under vitest resolves the same specifier.
7. **Connector address.** True: `src/lib/connect/connector.ts:15` and `src/pages/Connect.tsx:81`.
8. **Errors.** Not re-counted yet; Part 7 counts.

Differences from the prompt and the repo map:

- `buildgallery-repo-map` lists four seeders (`seed-demo-data` and others) with `verify_jwt = false`. They are not on disk (RC-P03 deleted them).
- The repo map says `award_xp` is open. It is closed on disk by `20261001230000_rc_xp_close.sql` (RC-P25).
- CA-28 merge could not be confirmed from the log (`git log --grep CA-28` finds nothing). Main is at the commit that added the CA series, so the work proceeds on main.
- `.github/` does not exist: no workflow uploads files to a third party.

## Plan

- Part 1: delete `supabase/functions/update-user-password/` -> verified by: source check test (folder gone, no `updateUserById` under `supabase/functions`).
- Part 2: draw the filled prompt as React text, split on the variable pattern; guard test for raw HTML -> verified by: render test with `<img onerror>` and `<script>`, pre-change snapshot of the segments, copy test, allow-list guard test.
- Part 3: price and splits from the database, return addresses from one constant, PWYW stats no longer written at checkout start, buyer id from the token -> verified by: handler tests with a faked Stripe client and faked data (low body price ignored, foreign `success_url` gets 400, PWYW start changes no stats).
- Part 4: login and ownership on `notify-version-update`; `x-cron-secret` on `check-compatibility-status`; public-and-approved test on `generate-ai-pdf`; public key on `post-json` and `sitemap-xml`; `api.github.com` only on `import-github-readme`; `config.toml` `verify_jwt` updates; module-level state list -> verified by: refusal test per function, plus a source check of `config.toml`.
- Part 5: `_shared/cors.ts` and `_shared/origins.ts`, zod schema at the top of every function that writes, spends or calls out, one error shape -> verified by: foreign origin gets no allow header, missing field gets 400 naming it.
- Part 6: one migration `_ca29_function_access.sql` -> verified by: source test over the migration text and a written per-function check list in the report (the repo has no SQL test runner).
- Part 7: `src/lib/errors/report.ts`, wired into the three boundaries, `QueryCache` and `MutationCache`, `window` events; connector address in one place; `no-console` as a warning -> verified by: render error reaches `reportError` with the route, failed query reaches it once, no Sentry chunk without a DSN.
- Part 8: after audit, secret and em dash search, `npm run audit:design`.

## Table

Edge functions (`config` is the `verify_jwt` in `supabase/config.toml`; a function with no block defaults to true).

| Function | config | Caller | What it trusts | Plan |
| --- | --- | --- | --- | --- |
| `update-user-password` | none (true) | none | `user_id`, `password` from the body, with the service key | Part 1: delete |
| `create-checkout-session` | none (true) | `ContentCard.tsx:169` | `price_amount`, `success_url`, `cancel_url` | Part 3: database price, allowed origins, buyer id from token, schema |
| `create-split-checkout-session` | false | none | `price_amount`, return URLs, no login | Part 3: database price and splits, allowed origins; Part 4: true |
| `create-pwyw-checkout-session` | false | `PwywPriceSelector.tsx:40` | amount (bounded below only), return URLs, writes stats at start | Part 3: bounds, origins, no stats at start; Part 4: true |
| `create-donation-session` | none (true) | `TipSelector.tsx:30` | `amount_pence`, `creator_id`, return URLs | Part 3: origins; Part 5: schema, upper bound |
| `create-subscription-session` | none (true) | none | `price_id`, `creator_id`, return URLs; checks a login | Part 3: origins; Part 5: schema |
| `create-project-package-session` | none (true) | `ProjectDetail.tsx:292` | return URLs and `origin` header; price already from the database | Part 3: origins (same hole); Part 5: schema |
| `verify-project-package` | none (true) | `ProjectDetail.tsx:236` | checks login and `payment_status`; price from the database | Part 5: CORS helper, error shape |
| `notify-version-update` | false | `PublishUpdateModal.tsx:110` | `creator_id`, `content_id`, no login | Part 4: login, owner from `content_items.creator_id`; true |
| `check-compatibility-status` | false | none found; no schedule found | nothing; anyone can run it | Part 4: `x-cron-secret` against `CRON_SECRET`, otherwise 401 |
| `generate-ai-pdf` | false | `generateAIPdf.ts` | `postId`, `reblogId`; service key; does not test status or visibility | Part 4: public and approved, or the caller owns it; reblogs follow their original |
| `post-json` | false | public | public rows | Part 4: public key; stays open to every origin |
| `sitemap-xml` | false | public | public rows | Part 4: public key; stays open to every origin |
| `public-api` | false | public | public rows with the public key | Part 4: keep; module-level `ipCounts` listed; open CORS kept |
| `import-github-readme` | false | `Upload.tsx:2946` | a URL; the regex is unanchored so `github.com` anywhere in the string matches, but the fetch is always to `api.github.com` with parsed owner and repo | Part 4: confirm host; owner and repo shape check; Part 5: schema |
| `generate-build-layers` | true | `layers.ts:284` | login and build ownership already checked | Part 5: CORS helper, schema, error shape |
| `parse-repo`, `parse-lovable`, `parse-transcript` | true | `repo.ts`, `lovable.ts`, `intake.ts` | login and build ownership already checked | Part 5: CORS helper, schema, error shape |
| `mcp` | false (documented) | connector | `withSupabase({ auth: 'user' })` on every request but discovery | No change in code; Part 5 leaves its discovery address open |

Module-level state in edge functions: only `public-api/index.ts:10`, `ipCounts`, a `Map` keyed by caller IP. It is a per-instance rate limiter and holds a caller identifier across requests. Listed; left in place because moving it inside the handler would remove the limit.

Raw HTML.

| Place | Source of the string | Plan |
| --- | --- | --- |
| `ContentBlockViewer.tsx:701` | the maker's prompt text, then the reader's variable values | Part 2: React text |
| `components/ui/chart.tsx:70` | the chart's own `config` (keys and colours) and the generated id | keep, comment |
| `pages/site/compose/listNest.tsx:72` | `cloneHtml` in `useBuildSorting.ts:384`: `cloneNode(true)` then `outerHTML` of an element the page drew | keep, comment |
| `pages/site/compose/mapMorph.tsx:65` | `copyOf` in the same file: `cloneNode` then `outerHTML` of an element the page drew | keep, comment |

Database functions (`SECURITY DEFINER`, latest definition in `supabase/migrations/`). "Callable" means a non-trigger function: reachable by RPC. Trigger functions cannot be called by RPC (PostgreSQL refuses), and EXECUTE is checked only when a trigger is created, so revoking it from the API roles changes nothing for the triggers.

| Function | Reads / writes | `auth.uid()` | Who can execute (migrations) | Plan (Part 6) |
| --- | --- | --- | --- | --- |
| `accept_bounty_solution` | bounties, solutions | yes | revoked from PUBLIC, anon; granted authenticated | none |
| `award_xp` | xp, progress | yes | revoked from PUBLIC, anon, authenticated by RC-P25 | none |
| `claim_challenge` | challenge progress, xp | yes | granted authenticated; PUBLIC default stays | revoke PUBLIC, anon |
| `get_quest_state(_user_id)` | any user's quest state; inserts a `user_progress` row for that id | takes `COALESCE(_user_id, auth.uid())`: **any id works, for anon too** | granted authenticated; PUBLIC default stays | refuse a `_user_id` that is not the caller's; revoke PUBLIC, anon (no caller in `src` passes another id) |
| `get_visible_surfaces(_user_id)` | a profile's level and track; inserts a `user_progress` row for that id | same shape | granted authenticated; PUBLIC default stays | **left:** a signed-out reader sees a profile through it (`profileProgress.ts:94`) |
| `mark_depth_revealed`, `record_daily_activity`, `respec_track`, `set_user_track` | own progress | yes | granted authenticated; PUBLIC default stays | revoke PUBLIC, anon |
| `mark_welcome_xp_shown` | own progress | yes | no grant: PUBLIC default | revoke PUBLIC, anon; grant authenticated |
| `soft_delete_primitive_comment` | comments | yes | revoked from `public`, granted authenticated; anon's default grant stays | revoke PUBLIC, anon |
| `resolve_report` | reports | yes (admin) | revoked from PUBLIC, anon; granted authenticated | re-state (harmless) |
| `rc_notify`, `rc_award_badge`, `rc_grant_xp` | notifications, badges, xp | no | `REVOKE ALL ... FROM PUBLIC, anon, authenticated` in their own migrations (`20261001200000`, `20261001240000`, `20261001260000`) | none |
| `get_email_by_username` | profiles, auth email | no | PUBLIC default | **left, reported:** the sign-in page calls it before login (`signInWithEmailOrUsername.ts:24`), so anon must keep it; replacing it needs a design decision |
| `get_post_lineage` | public posts | no | granted authenticated, anon | none (public read) |
| `increment_content_view_count`, `increment_download_count`, `increment_project_view_count` | counters | no | PUBLIC default | left, reported (public counters, no owner) |
| `is_admin`, `is_thread_admin`, `is_thread_member`, `has_perk`, `can_delete_primitive_comment` | role tables | no | PUBLIC default | left: RLS policies call them as the querying role, so revoking anon would break reads |
| 51 trigger functions (26 with no revoke anywhere in the migrations) | various | n/a | PUBLIC default (except the RC ones) | revoke PUBLIC, anon, authenticated |
| `update_bounty_status_on_solution`, `update_bounty_verified_count` | bounties | n/a | n/a | set `search_path` (only definers found without one) |

The migration also runs a catalogue pass: any `SECURITY DEFINER` function in `public` without a `search_path` setting gets one, because the live database has drifted from the migration files.

## Baseline

See the end of this file.
