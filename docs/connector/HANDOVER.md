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

`supabase/functions/_shared/redact/index.ts` exports `redactSecrets(text)`:
thirteen kinds, `[REDACTED:<kind>]` in place, findings as `[{kind, count}]`
only. Pure — no I/O, no Deno API, no imports — and covered by 27 `deno test`
cases beside it, including every negative the step named and a key wrapped
across a line break. **Nothing calls it yet.** EX-P08 wires it in: once, on the
assembled text inside `finish_import`, before the reader and before the content
hash, and writes its findings to `import_sessions.secret_findings`. The skill's
new section **The secret scanner** is the contract; open question 5 is closed.
The EX-P06 heading above is blank because that session wrote no line — the
pipe itself landed in commit `830ac3a`.

## EX-P08 — The parse

## EX-P09 — The pickup

## EX-P10 — The destination choice

## EX-P11 — The honest fallback

`routeImport` in `supabase/functions/mcp/index.ts` replaces `registry.route()`
inside `finish_import`: it reads every bid, parses with the winner, and hands
the fallback — **the last registered reader, by position, not by name** — what
the winner could not read. A win under `UNCERTAIN_BELOW` (0.3), a tie at the
top, or a winner that then reads nothing records
`detection_reason` as `uncertain: <top two bids, in the readers' own words>;
read with <who read it>`, and the reply gains one sentence: "It was hard to tell
what kind of conversation this is, so the structure may be rougher than usual."
`FinishImportOutput.reader` gained `uncertain: boolean`; the already-parsed
replay derives it from the stored reason through `isUncertainReason`, so the two
faces cannot drift. **No migration** — `detection_reason` has been TEXT since
EX-P05, so this step adds no RLS policy and the `(select auth.uid())` rule has
nothing to bind to.

**Three things for the next session.** First, **`source_only` is never handed to
the fallback**, only `unrecognised` is: a reader that says `source_only` has
recognised the file, and re-reading a package.json as a transcript would turn
its explanation into a proposal full of nothing. The caller still gets the
contract's Unparseable content wording byte for byte; the reader's own line goes
on the row and no further. Second, **only a genuinely empty import now fails as
unrecognised**, because `parseTranscript` returns zero turns only for
empty-or-whitespace text — every other string becomes at least one event. A
non-text import cannot actually arrive here: chunks come over JSON-RPC as
strings. Third, **EX-P09's panel needed no change** — it already tested
`detection_reason` for the `uncertain` prefix and rendered its own rougher-
structure sentence, and `e2e/tier3/waiting-imports.spec.ts` already asserted it
against an `uncertain: …` fixture. EX-P12 adding readers needs to know only that
the fallback is found by position, so a new reader registered before the
transcript reader inherits this behaviour without being taught about it.

## EX-P12 — Readers, one per tool

`supabase/functions/_shared/intake/readers/claude.ts` reads the Claude.ai
account export (`conversations.json`), registered between `lovableReader` and
`transcriptReader` so the fallback is still last by position. It is **not an
adapter** — there is no parse-claude function to front — so the parse lives in
the reader, built on the substrate helpers, and nothing else in the substrate
changed. 21 `deno test` cases beside it, on two fixtures under `readers/fixtures/`
whose shape is a real export's and whose every word is invented.

**Five mapping decisions, each confirmed before the code was written**, each
marked on the event it affects rather than done silently: several conversations
become one envelope with a warning naming them (the connector never selects —
the creator does, on the upload page); thinking is dropped because this format
ships it already empty (`thinking: ""`, `thinking_hidden: true`) and its
`summaries` are the platform's own summary; tool calls fold to one line naming
the tool and whether it failed, never their inputs or results; an
`injected_prompt_block` is left out because Claude.ai wrote it and the creator
did not; `attachments[].extracted_content` is carried under a marker and
`files[]` is names only, because the export holds no file bytes and this
connector does not reach into Claude.ai to fetch them. **No migration**, so the
`(select auth.uid())` rule has nothing to bind to here.

**Four things for the next session.**

First, **the file drop is NOT the escape hatch the contract says it is.** The
skill's ceiling error tells a creator to drop the file on
`agent-share-hub.lovable.app/compose/new`, "which has no such limit". It has the
same limit: `src/pages/ComposeNew.tsx:438` rejects anything over
`MAX_RAW_TEXT_CHARS` (`src/lib/build/intake.ts:113`, 400,000) before the build is
created, and `parse-transcript/index.ts:107` and `parse-lovable/index.ts:103`
repeat it as a 413. Those two error strings are the ones to fix, and fixing them
is a Part 4 change.

Second, **the ceiling bites on the raw file, not on what the reader keeps.** The
captured 10-conversation export is 3,106,403 characters — 7.8x the ceiling — and
three of its ten conversations are over 400,000 on their own, almost entirely
tool payloads. Parsed, the whole thing is a 171,990-character envelope, well
under. So **checking the size after the reader has folded, rather than before it
runs, would admit the file the feature exists for.** That and letting a creator
pick one conversation from a multi-conversation export in the browser are the
two pieces of work this reader is waiting on.

Third, **`parse-lovable`'s detect claims a Claude export.** It reads a top-level
JSON array as its message list and calls it `lovable_trajectory` when the objects
carry `created_at` — which every conversation in a Claude export does — so it
bids 0.95 on one and would win the tie on registration order, reading a whole
conversation as one message. This reader bids **0.98**, above it deliberately and
for a reason written out at the constant: a named schema (`chat_messages`, senders
of human/assistant, typed content blocks) against a structural guess from one
common key. The cleaner fix is in `parse-lovable`'s detect, which EX-P12 was not
allowed to touch. A test pins the collision so it cannot regress quietly.

Fourth, **`message.text` is a trap and the reader never reads it.** It is a
flattened display string: in the captured export, 28 of 113 messages had it
carrying "This block is not supported on your current device yet." in place of
every block the renderer could not draw. Turns are built from the `text` blocks
inside `content`, joined with a blank line — joining matters too, since
consecutive blocks are separate utterances and concatenation runs their
sentences together.

## EX-P13 — Ceilings, idempotency and expiry

**NOT YET DEPLOYED OR CHECKED ON THE LIVE BACKEND.** The Lovable deploys for
EX-P05 onwards are still pending, so nothing below has run against project
`zybdotagjwektucfdkri`. Everything claimed here was proved against a local
PostgreSQL 16.13 replay and `deno test`; the first run on the real backend is
still ahead, and the pg_cron half in particular is unproven there.

Two migrations, **in this apply order**:

1. `supabase/migrations/20260921120000_import_ceilings.sql` — the ceilings
2. `supabase/migrations/20260921120100_import_expiry_cron.sql` — the expiry

`enforce_import_ceilings()` is a BEFORE INSERT FOR EACH ROW trigger on
`import_sessions`, SECURITY INVOKER with `SET search_path = ''`. It takes both
counts — the inserting user's rows created since UTC midnight, and their rows in
`open` or `assembling` — as two `FILTER` aggregates over **one** index scan on
`idx_import_sessions_user_status_created`, whose leading `user_id` column is the
whole predicate (measured: Bitmap Index Scan, 125 rows, 0.183 ms over 5,000 rows
/ 40 users). No quota table. It raises the contract's error-table wording
**verbatim** under a dedicated SQLSTATE, `BGCAP`, and `begin_import` returns that
message to the caller **unchanged** — matched on the code, never on the text,
because the text is the payload. Every other database error still becomes the
generic wording.

**The trigger takes a transaction-scoped advisory lock on the creator first**,
two keys (a feature namespace and the user id). Without it the trigger is still
a read followed by an insert: under READ COMMITTED two concurrent opens can each
count 19 and each insert a 20th, which is the exact failure the contract moved
these ceilings into the database to avoid. It serialises one creator's opens
only; two creators never wait on each other.

**Expiry is two sweeps, and they are not redundant.** `begin_import` expires the
caller's own overdue rows under the caller's own client **before** the insert the
ceiling counts — mark first with one `UPDATE ... RETURNING`, then bin the chunk
objects, never the other way round, because a failed mark after a delete would
strip chunks off a still-open import. It is bounded (`EXPIRY_SWEEP_LIMIT`, 25
object sweeps per open; only `open`/`assembling` can still hold objects, since
`finish_import` clears them) and **best-effort**: a sweep that fails is logged by
code and never fails the open. The nightly pg_cron job is the other sweep — for
everyone, including the creator who never comes back — and **touches no storage
at all**, because a cron job has no session to reach the storage API with and the
service-role key that would give it one is contract prohibition 2.

**On pg_cron.** It is already installed on this project
(`20260318160154_...sql`), so scheduling is expected to work. It is not assumed:
migration 2 resolves the extension's schema from `pg_extension` rather than
naming `cron` or `extensions` (this project installed it `WITH SCHEMA
extensions`), and if pg_cron is absent it raises a **WARNING naming the fact that
no job was scheduled** rather than failing the deploy or passing silently. The
job is `expire-import-sessions`, `20 3 * * *` UTC. **pg_cron is not installed in
the replay container**, so the scheduling branch was exercised against a stub
`cron` schema; the schedule itself is unverified until Lovable applies this.

**THE THING THE NEXT SESSION MUST NOT UNDO.** `expire_import_sessions()` is
SECURITY INVOKER and a pg_cron job runs as whichever role scheduled it, so that
role must be exempt from RLS on `import_sessions` or **the job runs every night,
raises nothing, and expires nothing**. Exemption comes from owning the table with
FORCE ROW LEVEL SECURITY off — EX-P05 enabled RLS and did not FORCE it. This was
proved in the replay against a role that owns the table and holds
`rolbypassrls = f` (not the local superuser, whose BYPASSRLS would have proved
the wrong mechanism): user A's overdue row was expired by that role with no JWT
claim set. The negative was proved too — with FORCE on, the same call expires
**0 rows and raises nothing**. So migration 2 **asserts the condition at apply
time and ABORTS** if the applying role cannot bypass RLS. If that abort ever
fires on Lovable, it is a design conversation: **do not reach for SECURITY
DEFINER to get round it.** Check 7 of the SQL test pins both halves.

`supabase/tests/ex-p13-ceilings-and-expiry.sql`, eight checks: the trigger's
posture; the 21st insert of the day raises; the 6th live import raises
(`assembling` counts as open — a test written against `status = 'open'` alone
would miss it); positive controls for both, so a table that refused everything
could not pass; **the EX-P05 `total_chars <= 400000` CHECK confirmed still in
place** (EX-P13 confirms it, it did not add it); the expiry function's posture
and grants; the job-role check above; and that the nightly job leaves terminal
and not-yet-due rows alone. All eight passed on the replay, and five deliberate
sabotages were each caught by the right check. **Not run against the live
backend.**

**Two things for the next session.** First, **there was no in-memory counter in
the mcp function to remove.** The step asked for one; a scan for module-scope
mutable state (`let`, `var`, `Map`, `globalThis`) found none — every module-level
`const` is a schema, a string or a number. The only in-memory limiter in the repo
is `ipCounts` / `rateLimit` at `supabase/functions/public-api/index.ts:10`, which
is a different function on a different path and was **deliberately left alone**.

Second, **the ceilings are now written in two languages**. SQL cannot import
`constants.ts`, so the trigger carries its own `20`, `5` and `7`. The guard is a
test, not a comment: "the migration's ceilings are the constants file's ceilings"
in `supabase/functions/mcp/index.test.ts` reads both files and fails if they
disagree. Change one, change both. Note also that `EXPIRY_SWEEP_LIMIT` and
`CEILING_ERRCODE` joined `constants.ts`, and `LIVE_STATUSES` in `index.ts` was
reused rather than copied there.

## EX-P14 — Provenance

**NOT YET DEPLOYED OR CHECKED ON THE LIVE BACKEND**, like EX-P05 onwards.
`supabase/migrations/20260921130000_builds_created_via.sql` adds one nullable
JSONB column, `public.builds.created_via`, with a comment and nothing else — no
default, no backfill, no index, **no policy change and therefore no new
`auth.uid()` of either form**. The four policies on `builds` are column-agnostic
and already right: a visitor reads it because the published row is readable, and
a creator writes it because their own row is writable. `ADD COLUMN` with no
default is catalogue-only on PG11+, so it applies in constant time.

`claimImport` records it **last**, after the rows are written and after the
import is marked claimed, through `src/lib/build/provenance.ts`. **This is a
browser write through the data layer, with the creator's own session** — not an
edge-function write, so prohibitions 1 and 2 are untouched and the `mcp`
function was not opened. The `client` and `reader_id` it stores ride the
RETURNING clause of the claim's existing UPDATE (`id, client, reader_id`), so
provenance costs **no extra read** on the new-build path and one on the existing-
draft path, where the current value has to be read before it can be appended to.

`recordCreatedVia` **never throws**, and that is the design, not an oversight:
by the time it runs the creator's conversation is already in their draft, so a
claim that reported failure over a caption would be lying about the part that
mattered. It is the trade `applyRepoHeader` already makes on the paste path. A
failure logs **a code and the build id and nothing else** — the database's own
error code, never its message, because a message can quote a value.

**Three things for the next session.**

First, **the append is read-then-write and is not atomic.** Two claims into the
same draft at the same moment could each read the same array, and the later write
wins, so one import id would be missing from the label. Making it atomic needs
the append done in SQL by a database function; for a caption, on a race a single
creator has to open two tabs to cause, that was judged more surface than the
fault is worth. Written down here so the next person meets it as a decision
rather than a bug.

Second, **`created_via` is deliberately NOT in `BUILD_COLUMNS`.** That list is
spent by the gallery, the drafts list and every profile's builds, and none of
them draws a provenance line — so the build page reads the one column for the
one build in its own query (`getCreatedVia`), and no list pays for a JSONB blob
it will not render. Resist adding it to the shared list; the page already has
four small queries of exactly this shape.

Third, **nothing reads it but the page, and that was checked rather than
assumed.** `grep -n created_via src/lib/build/signals.ts src/lib/build/
gallery.ts` returns nothing, which is the whole point: completeness does not
count it, the gallery neither ranks nor gates on it, and a provenance mark that
moved a build up a list would be a reason to game how work arrived instead of
what it is. The line is `--text2` body prose in its own element — **never a
badge, never a warning colour** — and the guard that decides whether to render
it sits OUTSIDE the `<Section>` wrapper, because an empty flex item in a
`gap: 32` column would cost 32px of blank page to every build made before this
step. A tier-3 spec measures that.

Coverage: 24 unit tests on `provenance.ts` (the three shapes, the unknown-key
preservation, the no-duplicate-id guard, and that the log carries only a code
and an id), 25 on the line's copy, 4 added to `imports.test.ts`, and
`e2e/tier3/provenance-line.spec.ts` — 11 browser tests: the copy end to end and
the muted token resolved in BOTH themes, no sideways scroll at 390/768/1400
with the line present, and the two no-provenance cases. The migration itself was
applied to a local PostgreSQL 16.13 and checked for the column's type and
nullability, the comment, zero policies, zero new indexes and the three shapes
round-tripping. **Not run against project `zybdotagjwektucfdkri`.**

## EX-P15 — Hostile content

## EX-P16 — Observability

## EX-P16-fix — Bundle-safe shared readers

**`mcp` could not deploy.** Lovable bundles a function from its own folder and
`_shared/` only, and `_shared/intake/readers/lovable.ts` and
`readers/transcript.ts` imported their parsers from the `parse-lovable` and
`parse-transcript` folders. Both parsers now live in `_shared/intake/parsers/`,
unchanged apart from their import paths and a one-line note. In each function's
folder the only change besides `parse.ts` moving out is the one import line in
`index.ts`. Proven identical three ways: the moved files equal the originals once
the import paths are rewritten; a 115-input snapshot of both parsers, all three
readers and the registry was byte-identical before and after; and the new
`e2e/tier3/paste-transcript.spec.ts` recorded identical exchanges before and
after, meaning the same request, proposal, review text and database writes, at
both widths. `src/test/edgeBundles.test.ts` fails if anything under `mcp/` or
`_shared/` imports from outside again. **The first `mcp` deploy is still ahead,
on the merge to main.**

**Three things for the next session.** First, prohibition 4 now names
`_shared/intake/parsers/transcript.ts` explicitly: it is `parse-transcript`'s
parser, and the move did not free it. Second, three places still name the old
paths and were left alone because this step could not touch them:
`src/lib/build/intake.ts:37` (prohibition 4) and the file lists in
`parse-lovable/README.md` and `parse-transcript/README.md`. Third, running the
e2e suite in a cloud container needs Vite started on 127.0.0.1, because
`vite.config.ts` listens on `::` and the container has no IPv6. It also needs a
local Playwright config pointing `launchOptions.executablePath` at
`/opt/pw-browsers/chromium`, because the container's Chromium 1194 is older than
the 1208 that Playwright 1.58.2 expects. Neither was committed.

## EX-P17 — The connect page

## EX-P18 — Evaluations

## EX-P18-fix2 — The drafts picker

**Not yet checked on the live site.** The destination step's counts read
(`TARGET_COUNT_COLUMNS` in `src/lib/build/imports.ts`) embedded `build_nodes` and
`build_events` without naming a foreign key; `builds` is joined to each more than one
way, so PostgREST refused it (PGRST201) and every creator with a draft was told "Your
drafts could not be read" and offered none. Both embeds now name their
`*_build_id_fkey`, the hint `list_drafts` already uses for `build_nodes`. The unit fake
and the tier-3 stub now refuse an unnamed embed the way PostgREST does — both had
answered it, which is how it passed.

## EX-P18-fix2b — Draft owner check on the destination step

**Not yet checked on the live site.** `resolveDestination` in `src/pages/ComposeNew.tsx`
read a named `target_build_id` by id and offered it if it was a draft, trusting RLS —
but an admin can read every draft, so an admin whose own import row named someone
else's (a hand-edited row; the connector stores only the caller's own) saw its title.
It now checks `creator_id` against `useAuth()` first and answers "no longer exists",
as `verifyClaimTarget` already refused the claim itself.

## EX-P18-fix3 — Repair npm ci

`npm ci` failed on main from `87b970f` ("Applied 16 migrations"): Lovable's `04d2824`
added drizzle-kit, drizzle-orm and postgres (tsx comes with drizzle-kit) to package.json
and bun.lock for its own migration tooling, `drizzle.config.ts` and `drizzle/`, and left
package-lock.json alone. npm regenerated package-lock.json: 62 dev-only entries added,
nothing else moved, so both lockfiles list the same 697 packages. package.json and
bun.lock are untouched, so what Lovable installs is unchanged. Lovable only updates
bun.lock, so this recurs the next time it adds a package.

## EX-P19 — Live vocabulary (optional)
