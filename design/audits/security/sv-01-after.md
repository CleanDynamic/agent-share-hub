# SV-01 · security after

The table in `sv-01-before.md`, with what each row is now. Written on branch `sv-01-security`.

## Edge functions

| Function | `verify_jwt` now | Now |
| --- | --- | --- |
| `update-user-password` | n/a | Deleted. Source test holds it gone. The running copy still has to be deleted in Supabase (Lovable message in the report). |
| `create-checkout-session` | default true | Price from `content_items.price_gbp` (pounds to pence), only for an approved `paid` item of at least £1; return URLs checked against `_shared/origins.ts`; buyer id from the token. `price_amount` in the body is ignored. |
| `create-split-checkout-session` | true (was false) | Same, plus a signed-in buyer. Splits and Stripe accounts read from the database. Transfers still need a webhook that does not exist. |
| `create-pwyw-checkout-session` | false | Amount held between the item's floor and £1,000; return URLs checked; **writes nothing to the item** (no webhook confirms PWYW payments, so the stats stay where they are). |
| `create-donation-session` | default true | Creator must exist; the name in Stripe is the creator's own; amount £1 to £1,000; return URLs checked. |
| `create-subscription-session` | default true | Body checked (uuid, Stripe price id, return URLs); sign-in required, as before. |
| `create-project-package-session` | default true | Sign-in required; return URLs checked, or built from an allowed `Origin` only. |
| `verify-project-package` | default true | Body checked; the purchase write's error is now read. |
| `notify-version-update` | true (was false) | Sign-in required; creator from the token; caller must own the item; `creator_id` in the body is ignored; insert errors are read. |
| `check-compatibility-status` | false | Needs `x-cron-secret` equal to `CRON_SECRET`; 401 for everyone while the secret is unset. |
| `generate-ai-pdf` | false | A post or reblog that is not public and approved is answered "not found" unless the caller (from the token) is its creator; the check runs before any read of the payload or any upload. |
| `post-json`, `sitemap-xml` | false | Public key, so the database's own rules apply. Still open to every origin. |
| `import-github-readme` | false | Only `github.com/<owner>/<repo>[/blob/<branch>/<path>]` is accepted; only `api.github.com` is fetched; `..` paths refused. |
| `public-api` | false | CORS through the helper (open); error message no longer sent to the browser. |
| `generate-build-layers`, `parse-repo`, `parse-lovable`, `parse-transcript` | true | CORS through the helper (`withCors`); database error text no longer sent to the browser. Their own field checks are kept (see the report). |
| `mcp` | false (deliberate) | Not changed. |

## Raw HTML

| Use | Now |
| --- | --- |
| `ContentBlockViewer.tsx` prompt | Drawn as React text; variables are `<mark>` elements with the same style. |
| `components/ui/chart.tsx` | Kept, comment added. |
| `listNest.tsx`, `mapMorph.tsx` | Kept, comments added; the only source is `outerHTML` of elements React drew. |
| `ContentDetail.tsx` print window (`document.write`), found while searching | Its HTML (`payloadToHtml`) put a post's title and every line of its text in unescaped. It escapes them now. Kept on the allow list with a comment. |
| New raw HTML | A test fails the build for any new `dangerouslySetInnerHTML`, `innerHTML =`, `insertAdjacentHTML` or `document.write(` outside the four allowed files. |

## Database functions

`supabase/migrations/20261025120000_sv01_function_access.sql`, not applied. It changes `get_quest_state` and `get_visible_surfaces` (own id only), `get_post_lineage` (only rows the reader may see), `rc_notify` (no client role may execute), eight signed-in-only progress functions (not executable by `anon` or `PUBLIC`), and sets a `search_path` on every `SECURITY DEFINER` function in `public` that has none.

Not changed, and why: `get_email_by_username`, `increment_*`, `is_admin`, `is_thread_admin`, `is_thread_member`, `has_perk`, `can_delete_primitive_comment`, `award_xp` (see the table in `sv-01-before.md`).

## Errors

`src/lib/errors/report.ts` and `wire.ts`. Wired into `ErrorBoundary`, `RouteBoundary`, `PanelBoundary`, the query client's two caches, and `window` `error` and `unhandledrejection`. A report carries the error's name and code, the route, a source label and identifiers; never its message. `@sentry/react` is a dynamic import and only loads when `VITE_SENTRY_DSN` is set.
