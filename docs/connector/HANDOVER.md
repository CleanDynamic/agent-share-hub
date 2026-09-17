# The extractive connector — handover

One heading per step of the build sequence, EX-P00 to EX-P19. A session writes
its line under its own heading when it stops, so **the newest entry says where
the last session got to**. Keep entries to a line or two: what landed, what is
open, what the next session should read first.

The contract for every step is `.claude/skills/buildgallery-extractor/SKILL.md`.
Read it at the top of each one.

| Step | Title | Merge to main after? |
|---|---|---|
| EX-P00 | Reconnaissance (read-only) | no |
| EX-P01 | The contract documents | no |
| EX-P02 | The door skeleton | no |
| EX-P03 | The consent page | **yes** |
| EX-P04 | The lock | no |
| EX-P05 | The import tables and the bucket | no |
| EX-P06 | The pipe | no |
| EX-P07 | The secret scanner | no |
| EX-P08 | The parse | no |
| EX-P09 | The pickup | **yes** |
| EX-P10 | The destination choice | **yes** |
| EX-P11 | The honest fallback | no |
| EX-P12 | Readers, one per tool | no |
| EX-P13 | Ceilings, idempotency and expiry | no |
| EX-P14 | Provenance | no |
| EX-P15 | Hostile content | no |
| EX-P16 | Observability | no |
| EX-P17 | The connect page | **yes** |
| EX-P18 | Evaluations | no |
| EX-P19 | Live vocabulary (optional) | no |

---

## EX-P00 — Reconnaissance (read-only)

Findings are in [`docs/connector/RECON.md`](./RECON.md), including five blocking
questions for later steps under "Blocking questions for the next step".

## EX-P01 — The contract documents

Created `.claude/skills/buildgallery-extractor/SKILL.md` (the connector's single
source of truth) and this file. No application code. RECON's five blocking
questions are carried into the skill's "Open questions"; question 1 (the SDK
cannot speak `2026-07-28`) still blocks EX-P02.

## EX-P02 — The door skeleton

`supabase/functions/mcp/` exists and speaks MCP. Built on
`@modelcontextprotocol/server@^2.0.0` (not `@modelcontextprotocol/sdk`), whose
`SUPPORTED_PROTOCOL_VERSIONS` tops out at **2025-11-25** — so **open question 1
narrows but stays open**: the 2026-07-28 vocabulary ships as schemas
(`server/discover`, the result `_meta` object, tasks, subscriptions), the
handshake does not. Constants live in `constants.ts` as the contract requires,
declared now and consumed from EX-P05. `[functions.mcp] verify_jwt = false` in
`config.toml`, uniquely and deliberately — the gate is code, not gateway; the
comment there says why. The verbatim instruction sentence is NOT yet in the
server instructions: it tells a caller to send a conversation, and no tool
accepts one until EX-P06. Add it there.

## EX-P03 — The consent page

`/oauth/consent` is live in the app: `src/pages/OAuthConsent.tsx` on `AuthShell`,
lazy and registered outside `<Route element={<Layout />}>`, with the three
supabase-js OAuth server helpers wrapped in `src/lib/auth/oauthConsent.ts`. Both
decisions pass `skipBrowserRedirect` so the page navigates to the URL the helper
returns. Tier-3 coverage in `e2e/tier3/oauth-consent.spec.ts` is the two error
states (no `authorization_id`; signed out) at both viewports — **the happy path
is unproven**, because approving a real request needs a pending authorization
and an owning session, and this suite has no auth fixture. Next session: the
authorization path is already set to `/oauth/consent` in the backend, so this
goes live on the merge to main that the table above marks for this step.

## EX-P04 — The lock

`pipeline([withOAuthProtectedResource(), withSupabase<Database>({ auth: 'user' })],
handler)`. No token or a bad token is a 401 carrying
`WWW-Authenticate: Bearer resource_metadata="…"`; discovery answers
unauthenticated at `.../functions/v1/mcp/oauth-protected-resource`. Neither URL
is configured by hand — the middleware derives both from `SUPABASE_FUNCTION_SLUG`,
which the platform sets. **Tests must set that variable**, or the derivation
falls back to composing a path from the request and doubles the `/functions/v1`
prefix, proving the wrong branch.

`buildgallery_whoami` now returns the signed-in account's id, email and display
name, plus one line on what the connector does and cannot do, in both markdown
and `structuredContent`. Email comes from `ctx.userClaims` (the verified JWT);
display name from `profiles` through `ctx.supabase` with named columns, falling
back to `username`, then `null`. No migration: `profiles` is already
`SELECT USING (true)`, so **this step adds no RLS policy** and the
`(select auth.uid())` rule has nothing to bind to here.

**Two things for the next session.** First, `ctx.supabaseAdmin` exists on the
middleware context — a client that bypasses RLS. This function must never touch
it; it is built lazily, so leaving it alone means the service-role key is never
read. A test enforces this by scanning the non-comment source. Second,
`database.types.ts` is deliberately partial — `profiles` and three columns.
Widen it by exactly the tables each step adds, never before the migration lands.

`@supabase/server@1.7.0` was hours old when this was pinned; the caret range
resolves to newest-at-deploy either way, so there is no lockfile to age out.

## EX-P05 — The import tables and the bucket

`supabase/migrations/20260917120000_import_sessions.sql` creates
`public.import_sessions`, the private `imports` bucket (50,000 bytes,
`text/plain`), five indexes and eight policies. RLS is owner-only in all four
directions on the table and on the bucket's objects, and every one of the
twelve `auth.uid()` calls across those eight policies is `(select auth.uid())`.
`anon` is explicitly REVOKEd: Supabase's default privileges grant a new public
table to `anon` at creation, so "grant nothing to anon" needs saying out loud
rather than being left to RLS. No trigger, no function, no view — `updated_at`
is the writer's job until something adds one.

Acceptance is `supabase/tests/ex-p05-import-sessions.sql`, seven checks.
**Not run against the live backend**, per the environment rule; it was run
against a local PostgreSQL 16.13 replay of this repository's migrations, where
all seven passed and four deliberate sabotages were each caught by the right
check. The first run against project `zybdotagjwektucfdkri` is still ahead.

**Three things for the next session.**

First, **`client` carries a CHECK constraint** over the six values
(`claude`, `claude-code`, `chatgpt`, `cursor`, `web`, `unknown`); NULL also
passes. **EX-P06's `begin_import` must map any value outside those six to
`'unknown'`** before it inserts. A caller naming a seventh client is not an
error to report — it is a value to normalise — and without that mapping an
unexpected `client` makes the insert fail instead.

Second, **the first path segment in the imports bucket is the `user_id`**, not
the `import_id`: objects live at `{user_id}/{import_id}/{seq}.txt` and the
object policies compare segment 1 against `(select auth.uid())::text`. **This
replaces `docs/connector/RECON.md` answer 13 point 4**, which proposed the
import id there; later steps follow the spec, not that line. RECON is left as
written — it is the record of what EX-P00 found, not a live specification. The
practical gain is that a storage policy needs no subquery against
`import_sessions` to decide anything.

Third, **`supabase/functions/mcp/database.types.ts` still needs
`import_sessions` adding, in EX-P06.** EX-P04's rule is to widen it by exactly
the tables each step adds and never before the migration lands. The migration
has now landed, but nothing in the function reads the table until the pipe
exists, so the widening belongs with the code that needs it.

## EX-P06 — The pipe

## EX-P07 — The secret scanner

## EX-P08 — The parse

## EX-P09 — The pickup

## EX-P10 — The destination choice

## EX-P11 — The honest fallback

## EX-P12 — Readers, one per tool

## EX-P13 — Ceilings, idempotency and expiry

## EX-P14 — Provenance

## EX-P15 — Hostile content

## EX-P16 — Observability

## EX-P17 — The connect page

## EX-P18 — Evaluations

## EX-P19 — Live vocabulary (optional)
