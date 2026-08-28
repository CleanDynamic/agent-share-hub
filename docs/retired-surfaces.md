# Retired surfaces

What has been frozen, when, how to bring it back, and what is still in the
database because of it.

A surface is **frozen**, not deleted. The code stays in the repository, the
rows stay in Postgres, the files stay in storage. What changes is that nothing
new can be written: the affordance is gone from the UI and the write function
throws a named error if anything calls it anyway. Everything already written
keeps rendering exactly as it did.

Nothing on this page has been dropped. Dropping any of it is a separate,
explicit operator decision — see [Dropping any of this](#dropping-any-of-this)
at the end.

---

## Reblog — composing

**Frozen** NS-P42 (entry points, 28 Aug 2026) and NS-P43 (write functions,
28 Aug 2026).

**Replaced by** Rebuild — `src/lib/build/rebuild.ts`, the fork-with-credit
mechanic on the typed build record (`parent_build_id`, `root_build_id`,
`forked_from_event_id`).

**Flag** `REBLOG_COMPOSE_ENABLED` in `src/lib/reblog/flags.ts`, currently
`false`.

### What the flag holds down

| Layer | What is frozen |
| --- | --- |
| Affordances (NS-P42) | The Repeat2 buttons on `FeedItem` and `feed-card`; the Repeat2 button in `reblog/ReblogFeedCard`'s engagement row; "Reblog with quote" in `QuotableSelectionOverlay`; "Reblog this" on `ReblogCard` and on `ReblogDetailView` |
| Writes (NS-P43) | `createReblog`, `updateReblog`, `deleteReblog`, `uploadReblogMedia`, `generateReblogSlug` |

Each write calls `assertReblogAuthoringEnabled()` (`src/lib/reblog/media.ts`)
as its first statement. Importing them is still valid and still type-checks;
calling one while the flag is false throws:

```ts
ReblogValidationError("REBLOG_RETIRED", "Reblogging has been replaced by Rebuild.")
```

### What is still live, and must stay live

- The read path: `getReblog`, `getReblogsOfPost`, `getReblogsByUser`,
  `checkExcerptStillValid`, the realtime hooks, `ContentOrReblogRoute` and
  `ReblogDetailView`. An existing reblog renders at its `/b/:slug` URL.
- Engagement on an existing reblog: `likeReblog`, `bookmarkReblog`, comments,
  reports. A reblog is retired as a thing to write, not as a thing to read and
  react to.

### One consequence worth knowing

`deleteReblog` is frozen with the rest, so a reader has no way to remove their
own reblog from the UI. That capability was already gone before the freeze:
the single call site (`FeedReblogAdapter.handleDelete`) passes
`{ reblogId, rebloggerId }` behind an `as any` cast while the function reads
`args.userId`, so the ownership check never matched and the call always ended
in a throw. Both before and after NS-P43 that site shows "Couldn't delete".
Until the flag is flipped (and the argument name fixed), removing a reblog is
an operator action: set `deleted_at` on the row, which every read path already
filters on.

### Rollback

1. Set `REBLOG_COMPOSE_ENABLED = true` in `src/lib/reblog/flags.ts`.
2. Revert the reblog cases in `src/lib/retiredSurfaces.test.tsx` and the
   NS-P42 spec `src/components/reblog/composeRetired.test.tsx`, which assert
   the frozen behaviour and will fail — correctly — once it is unfrozen.
3. Nothing else. No component was deleted, no migration was written, no row
   was touched. Exercised: with the flag true the affordances reappear, the
   composer mounts, and the write functions answer.

---

## Remix — creation

**Frozen** NS-P43 (28 Aug 2026).

**Replaced by** Rebuild, as above. Remix is the document model's derivation
edge: it clones a `content_items` row into a new draft and writes a
`post_lineage` row linking the two.

**Flag** `REMIX_CREATE_ENABLED` in `src/lib/remix/flags.ts`, currently `false`.

### What the flag holds down

| Layer | What is frozen |
| --- | --- |
| Affordance | `RemixButton` in `RemixLineageRow` on `src/pages/ContentDetail.tsx` — the only reachable control that called `createRemix` |
| Write | `createRemix` (`src/lib/remix/createRemix.ts`) |

`createRemix` calls `assertRemixCreateEnabled()` as its first statement and
throws:

```ts
RemixValidationError("REMIX_RETIRED", "Remixing has been replaced by Rebuild.")
```

### What is still live, and must stay live

- `/b/:slug/lineage` (`src/pages/Lineage.tsx`), its `get_post_lineage` RPC and
  `LineageTreeView`. A lineage recorded before the freeze still draws in full.
- `useLineageParent` and `useRemixCount` (`src/lib/remix/hooks.ts`), and the
  attribution chip and descendant badge they feed in that same
  `RemixLineageRow`. A derived post still shows where it came from and how many
  came from it — the row renders, with one button fewer.

### A note on ForkModal

`src/components/ForkModal.tsx` is a different, older mechanism: it writes
`fork_of_content_id` / `fork_of_creator_id` directly and never calls
`createRemix`. Its only trigger lives in `src/pages/ContentDetail.legacy.tsx`,
which no route and no module imports, so it is unreachable and was left
untouched by NS-P43. If that page is ever re-routed, the fork button in it
needs the same guard before it goes live.

### Rollback

1. Set `REMIX_CREATE_ENABLED = true` in `src/lib/remix/flags.ts`.
2. Revert the remix cases in `src/lib/retiredSurfaces.test.tsx`.
3. Nothing else. Exercised: with the flag true the button returns to the
   lineage row and `createRemix` answers.

---

## Generation-1 bounty responses

**Frozen** NS-P44 (28 Aug 2026).

**Replaced by** generation 2 — `solutions` and its satellites, served by
`src/lib/bounty-solver/` (17 files), `BountySolvePage` and the bounty surfaces
of `src/pages/ContentDetail.tsx`. Generation 1 is the March 2026 shape:
`bounty_responses` with its `inline_blocks` jsonb, `upvotes`, `verified_count`
and generated `score` column, plus `bounty_me_too`,
`bounty_response_verifications` and a row of `bounty_*` columns on
`content_items`.

**Flag** `GEN1_BOUNTY_RESPONSES_ENABLED` in `src/lib/bounty-gen1/flags.ts`,
currently `false`.

### The audit, before the freeze

Measured 28 Aug 2026 against the Supabase project this repository points at —
`project_id` in `supabase/config.toml`, the same host in `.env` and
`netlify.toml`, and the only Supabase host that appears anywhere in the tree.
Read-only, through the publishable (anon) key, one `count=exact` HEAD per table.

| Table | Rows | Newest row | Verdict |
| --- | --- | --- | --- |
| `bounty_responses` | none — no table | none | **Never deployed.** PGRST205, "could not find the table in the schema cache" |
| `bounty_response_verifications` | none — no table | none | **Never deployed.** PGRST205 |
| `bounty_me_too` | none — no table | none | **Never deployed.** PGRST205 |
| `solutions` (generation 2, for comparison) | 2 | 2026-08-18T13:21:39Z | Live, and the system in use |

Reference points from the same run: `content_items` 76 rows (newest
2026-08-17T13:21:23Z), of which 3 are `post_type = 'bounty'`; `profiles` 23;
`builds` 1. Every generation-2 satellite — `solution_votes`,
`solution_acceptance_log`, `solution_comments`, `bounty_discussion_comments`,
`bounty_comment_reactions`, `bounty_comment_last_read` — answers 200 with a
count of 0. They exist and are empty, which is a different thing from what the
three generation-1 tables answer.

**Why "never deployed" and not "empty".** A table that exists but is closed by
RLS answers 200 with a count of zero, the way `solution_votes` does above. A
table that is not there answers PGRST205 — and so does a table name invented for
the probe, which was run as a control and came back identical. Two more probes
put it beyond doubt: `content_items.bounty_enabled` and
`profiles.bounties_solved` each answer Postgres error 42703, "column does not
exist", which comes from the planner rather than from the schema cache. No
migration in `supabase/migrations/` drops any of it. So
`supabase/migrations/20260323000001_bounty_system.sql` was authored in March and
never applied to this project.

**What was not measured, and cannot be from here.** There is no second Supabase
project in this repository, so "the production-mirroring dev database" and
production are the same host as far as this tree can see. The session held no
service-role key, so the numbers above are what the anon role can see under RLS:
for `solutions` that is the public, non-draft rows on published bounties, not
necessarily every row. For the three generation-1 tables the distinction does not
arise — RLS cannot hide a table that is absent.

### Where generation 1 is referenced, and whether anything can reach it

| File | Reference | Reachable? |
| --- | --- | --- |
| `src/components/BountyResponseComposer.tsx` | inserts into `bounty_responses` | **No.** Its only mount is `ContentDetail.legacy.tsx`, below |
| `src/pages/ContentDetail.legacy.tsx` | the response list, the sort, `bounty_me_too` toggle, `bounty_response_verifications` write, mark-as-solution, and the composer mount | **No.** No route registers it and no module imports it — `App.tsx` routes `/content/:id` to `ContentDetail.tsx`, and `Discover.legacy` is the only `.legacy` page with a route (`/discover-legacy`) |
| `src/pages/CreatorProfile.tsx` | the Solutions tab reads `bounty_responses`; the "★ N bounties solved" chip reads `profile.bounties_solved` | **Route yes, code no.** `/creator/:username` is live, but the tab is only added when `bounties_solved > 0`, and that column does not exist on `profiles`, so `?? 0` makes it 0 for every creator. The tab never appears and its query, gated on `activeTab === "solutions"`, never fires |
| `src/pages/Profile.legacy.tsx` | the same tab and chip | **No.** Not routed, not imported |
| `supabase/functions/seed-demo-data/index.ts` | inserts `bounty_responses`, `bounty_response_verifications`, `bounty_me_too` | **Not a UI path.** Left untouched — it is a demo seeder, and against the current schema its inserts fail the same way the composer's would. It is the one generation-1 write path outside this freeze |

The prompt that ordered this work expected the composer to mount on the live
`ContentDetail`, which would have meant responses might still be arriving. It
does not, so none are — and the freeze below was applied anyway, because the
point of a freeze is the shape not coming back, not the row count on the day.

### What the flag holds down

| Layer | What is frozen |
| --- | --- |
| Affordance | The "Submit a Blueprint →" button in the bounty response section of `ContentDetail.legacy.tsx` — the only control that set `composerOpen` |
| Component | `BountyResponseComposer` renders `null`, so mounting it opens nothing, from any call site, including one added after the freeze |
| Write | The composer's `handleSubmit` calls `assertGen1BountyResponsesEnabled()` before it inserts |

The gate throws:

```ts
Gen1BountyValidationError(
  "GEN1_BOUNTY_RESPONSES_RETIRED",
  "Generation-1 bounty responses are frozen. Bounties are solved through solutions."
)
```

The implementation is left whole — every hook, field and branch of the composer
still compiles and still works. The guard is a wrapper around it rather than an
early return inside it, because the implementation calls hooks and returning
before them would make the hook order conditional.

### What is still live, and must stay live

- Every read of a generation-1 row, wherever it renders today: the response list
  and its sort, the me-too count, the verification counts and the mark-as-
  solution control in `ContentDetail.legacy.tsx`; the Solutions tab and the
  "★ N bounties solved" chip on `CreatorProfile.tsx` and `Profile.legacy.tsx`.
  None of them is inside the flag. Whatever they render before the freeze they
  render after it.
- All of generation 2. `solutions`, `solution_votes`, `solution_acceptance_log`,
  `solution_comments`, `bounty_discussion_comments`, `bounty_comment_reactions`,
  `bounty_comment_last_read`, every file in `src/lib/bounty-solver/`, and the
  bounty surfaces of `ContentDetail.tsx`. Untouched by NS-P44.

### The rule NS-P45 through NS-P49 must follow

**Generation-1 tables are not repointed and not dropped.** NS-P45 creates the
`bounties` header table; it must not carry `bounty_responses`,
`bounty_me_too` or `bounty_response_verifications` with it, must not add a
foreign key to any of them, and must not backfill from them. Nothing in
NS-P45–P49 drops them either.

They ride with the frozen legacy read path until the operator retires
`content_items` entirely — every one of them hangs off `content_items(id)`, so
their retirement is that decision, not a separate one, and it is taken under
[Dropping any of this](#dropping-any-of-this) below.

**The number NS-P45's backfill has to account for is zero, and the reason
matters more than the number.** There is nothing to migrate from generation 1 —
no rows, and no tables to hold them. A backfill written against
`bounty_responses` will not return an empty set; it will fail with PGRST205 or
42703. The generation-1 counters on `content_items` are in the same position:
`bounty_enabled`, `bounty_status`, `bounty_me_too_count`,
`bounty_solved_response_id`, `bounty_closes_at`, `bounty_tip_gbp` and
`bounty_gap` are all absent, so any code reading them — `BountyCard.tsx`,
`Browse.tsx`'s me-too sort, `CreatorProfile.tsx`'s Bounties tab — is already
reading `undefined` and falling back. The live bounty count to size against is
the generation-2 one: 3 `content_items` rows with `post_type = 'bounty'`, and 2
`solutions` between them.

### Rollback

1. Set `GEN1_BOUNTY_RESPONSES_ENABLED = true` in `src/lib/bounty-gen1/flags.ts`.
2. Revert the first describe block of
   `src/lib/bounty-gen1/gen1ResponsesRetired.test.tsx`, which asserts the frozen
   behaviour and will fail — correctly — once it is unfrozen. Its second block,
   the read-path proof, passes either way and stays. Exercised: with the flag
   true, three of the four cases fail and the read-path case still passes.
3. **Apply `supabase/migrations/20260323000001_bounty_system.sql`**, which this
   rollback needs and the reblog and remix rollbacks above do not. Unfreezing
   alone gives you a composer that submits into a table that is not there. The
   migration also needs its five RLS policies rewritten to
   `(select auth.uid())` before it is applied — it was authored with bare
   `auth.uid()`, which re-evaluates per row.
4. Re-route `src/pages/ContentDetail.legacy.tsx`, or mount the composer
   somewhere reachable. Nothing in the live routing table reaches it today.

Nothing was deleted, no component was removed, and no migration was written by
NS-P44.

---

## The NS-P46 repoint — two map tables and a shim column

**Added** NS-P46 (28 Aug 2026). **Kept until NS-P56 signs off.**

Nothing is frozen here. This section is on this page because NS-P46 left three
objects in the database whose only job is to make a change reversible, and an
object with no product purpose needs a written reason to exist and a written
date to stop existing.

`supabase/migrations/20260828160000_repoint_solutions.sql` moved
`solutions.bounty_id` and `solution_acceptance_log.bounty_id` off
`content_items(id)` and onto `bounties(id)`, through the `legacy_item_id`
mapping NS-P45 backfilled.

| Object | Kind | Why it stays |
| --- | --- | --- |
| `public.ns_p46_migration_map_solutions` | table | One row per repointed solution: its id, and the `content_items` id its `bounty_id` held before. The only record of the old values. RLS on, no policy — operator access only. |
| `public.ns_p46_migration_map_acceptance_log` | table | The same, for `solution_acceptance_log`. |
| `solutions.legacy_bounty_item_id` and `solution_acceptance_log.legacy_bounty_item_id` | columns | The shim the live legacy read path runs on. Derived by `set_legacy_bounty_item_id()` from `bounties.legacy_item_id`, never written by a client. |

### Why the shim column exists

A legacy bounty page routes on a `content_items` id. After the repoint that id
is not in `solutions.bounty_id` any more, so every read starting from a route
param would return nothing — which looks exactly like a bounty nobody has
solved, not like a bug. The column keeps the old id on the row; each read that
needs it was moved across and flagged `// NS-P46 shim` in the source.

**NS-P50 removes them.** `grep -rn "NS-P46 shim" src/` is the complete list:
19 lines at the time of writing — 16 of them call sites across 15 files, plus
the field's declaration in `bounty-solver/types.ts` and the header of
`legacyBountyShim.test.ts`, which is the spec that fails when a shim is removed
without its caller being rewired. When the last call site is rewired onto
`bounties` directly, the two columns, `set_legacy_bounty_item_id()` and its two
triggers go with them.

### Reversing the repoint

The order matters and is not obvious — the triggers NS-P46 installs reject the
rollback UPDATE if they are still attached when it runs. Section 2 of the
migration carries the four steps, in order, and they were run end to end
against a Postgres 16 harness before being written down.

### What is still live, and must stay live

- The legacy bounty page: its solutions list, its per-slot counts, its
  provenance panel, its solver leaderboard and analytics, and voting on a
  solution. Proven under real RLS by
  `supabase/tests/ns-p46-repoint-solutions.sql` (check 6) and at the data layer
  by `src/lib/bounty-solver/legacyBountyShim.test.ts`.
- Every one of the twelve legacy `bounty_*` columns on `content_items`. NS-P46
  reads them through the shim and does not drop, rename or stop writing any.

### One thing NS-P50 has to decide

`solution_acceptance_log` still carries `"Public can read acceptance log"` with
`USING (true)`, untouched by NS-P46 because it names no table the repoint
moved. Once the new path writes acceptance rows for bounties on unpublished
builds, that policy publishes them. Tightening it is a behaviour change on a
live surface and belongs with the prompt that gives it rows.

---

## What remains in the database

No schema change was made by NS-P42 or NS-P43. Every object below still
exists, still has its RLS policies, and is still read by the live read paths.

| Object | Kind | Why it stays |
| --- | --- | --- |
| `public.reblogs` | table | Every published reblog. Read on `/b/:slug`, in the legacy feed tabs, and by `getReblogsOfPost` / `getReblogsByUser`. |
| `public.reblog_likes` | table | Likes on those reblogs; `likeReblog` still writes here. |
| `public.reblog_bookmarks` | table | Bookmarks on those reblogs; `bookmarkReblog` still writes here. |
| `public.reblog_reports` | table | Moderation history, and reporting an existing reblog still works. |
| `public.post_lineage` | table | Every derivation recorded by remix. Read by the lineage page, `useLineageParent` and `useRemixCount`. |
| `reblog-media` | storage bucket | The images and videos attached to published reblogs. Public read; the upload path is frozen. |

`content_items.reblog_count` also stays — it is a counter column on a live
table, maintained by triggers, and read by surfaces outside this retirement.

## Dropping any of this

Dropping these tables or the bucket is **an explicit future operator decision,
outside the NS-P27–NS-P56 series**. Nothing in that series schedules it and no
prompt in it should perform it. When it is taken, in this order:

1. **Export first.** Dump every table listed above (`pg_dump --data-only` per
   table, or CSV from the SQL editor) and mirror the `reblog-media` bucket to
   cold storage. Keep the export somewhere that outlives the database.
2. **Verify the export** opens and contains the row counts you expect, before
   anything is dropped.
3. **Confirm nothing still reads it.** Every read path named above has to be
   retired first — a dropped `reblogs` table turns `/b/:slug` for a published
   reblog into an error, not into a tidy 404.
4. **Then drop**, one object per migration, so each step is revertable on its
   own.

Until all four have happened, these objects are archived in place, not
deprecated.
