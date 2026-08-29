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

**Added** NS-P46 (28 Aug 2026). **The two shim columns were dropped by NS-P50
(29 Aug 2026); the two map tables are kept until NS-P56 signs off.**

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
| ~~`solutions.legacy_bounty_item_id` and `solution_acceptance_log.legacy_bounty_item_id`~~ | columns | **Dropped by NS-P50.** They were the shim the live legacy read path ran on, derived by `set_legacy_bounty_item_id()` from `bounties.legacy_item_id`. Every reader now resolves that mapping through `resolveBountyByLegacyItem` and filters `bounty_id`. |

### Why the shim column exists

A legacy bounty page routes on a `content_items` id. After the repoint that id
is not in `solutions.bounty_id` any more, so every read starting from a route
param would return nothing — which looks exactly like a bounty nobody has
solved, not like a bug. The column keeps the old id on the row; each read that
needs it was moved across and flagged `// NS-P46 shim` in the source.

**NS-P50 removed them**, in
`supabase/migrations/20260829180000_drop_bounty_shims.sql`, after the commit
before it rewired every caller onto `bounties` directly. The two columns, their
two indexes, `set_legacy_bounty_item_id()` and its two triggers went together.
`src/lib/bounty-solver/legacyBountyShim.test.ts` became
`legacyBountyRedirect.test.ts` and asserts the new path — the question it asks
(does the legacy bounty page still find its own solutions?) outlived the shim
that used to answer it.

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

### The thing NS-P50 had to decide — decided

`solution_acceptance_log` carried `"Public can read acceptance log"` with
`USING (true)`, untouched by NS-P46 because it named no table the repoint moved.
NS-P50's `accept_bounty_solution` is what gives that table rows for bounties on
unpublished builds, so
`supabase/migrations/20260829160000_accept_bounty_solution.sql` replaced it with
two policies mirroring the `solutions` read rule: readable when the bounty's
home is public, and otherwise by the solver, the bounty author and admins.
Nobody who could read a row before lost it — every pre-existing row is a legacy
bounty, and the legacy branch is the approved-item test that made those rows
public in the first place.

While it was there, one more fact worth writing down: **`solution_acceptance_log`
has row level security enabled and no INSERT policy at all, and never has.** No
client role can append to it, so the legacy `acceptSolution`'s insert has always
been refused by policy with its error discarded. The new path appends through
the SECURITY DEFINER function instead, which is why that function needs the
definer right at all.

## The NS-P47 repoint — four map tables, four shim columns, one dual-write

**Added** NS-P47 (29 Aug 2026). **The four shim columns were dropped by NS-P50
(29 Aug 2026); the four map tables are kept until NS-P56 signs off.**

Nothing is frozen here either. `supabase/migrations/20260829120000_repoint_bounty_satellites.sql`
repeats the NS-P46 recipe on the four remaining generation-2 satellites that
foreign-keyed `content_items` directly, through the same `legacy_item_id`
mapping:

| Table | `bounty_id` before | `bounty_id` after |
| --- | --- | --- |
| `bounty_discussion_comments` | `content_items(id)` CASCADE | `bounties(id)` CASCADE |
| `bounty_comment_last_read` | `content_items(id)` CASCADE | `bounties(id)` CASCADE |
| `bounty_deadline_extensions` | `content_items(id)` CASCADE | `bounties(id)` CASCADE |
| `bounty_author_review` | `content_items(id)` CASCADE | `bounties(id)` CASCADE |

Every delete action is preserved. `content_items → bounties` is itself CASCADE,
so deleting a legacy content item still empties the whole satellite set — the
path is one hop longer and the outcome identical.

| Object | Kind | Why it stays |
| --- | --- | --- |
| `public.ns_p47_migration_map_bounty_discussion_comments` | table | One row per repointed comment: its id, and the `content_items` id its `bounty_id` held before. RLS on, no policy — operator access only. |
| `public.ns_p47_migration_map_bounty_deadline_extensions` | table | The same, keyed on `id`. |
| `public.ns_p47_migration_map_bounty_author_review` | table | The same, keyed on `id`. |
| `public.ns_p47_migration_map_bounty_comment_last_read` | table | The same, keyed on `(old_bounty_id, user_id)` — that table has no surrogate key and its primary key is the pair being rewritten. |
| `legacy_bounty_item_id` on all four | columns | The shim the live legacy read path runs on. Derived by NS-P46's `set_legacy_bounty_item_id()`, never written by a client. |

### Two tables named by the prompt that were NOT repointed

`bounty_comment_reactions` is **indirect**: its only foreign key is
`comment_id → bounty_discussion_comments(id)`. It holds no `content_items` id,
no policy on it names `content_items`, and no client query against it carries a
bounty id. There was nothing in it to repoint. The migration asserts this in
preflight rather than assuming it.

`bounty_me_too` is **generation 1**, and the rule recorded above — *"Generation-1
tables are not repointed and not dropped"* — forbids NS-P45–P49 from adding a
foreign key to it. It is also not on the database: it answers PGRST205, which is
why its one caller writes `.from("bounty_me_too" as any)` and why it is absent
from `src/integrations/supabase/types.ts`. Its `content_id` still keys
`content_items` and NS-P47 did not touch it.

### The me-too counter is now a dual-write, and that is deliberate

Where generation 1 exists, `update_bounty_me_too_count()` maintains **both**
counters from the same me-too write: `content_items.bounty_me_too_count`
exactly as before, and `bounties.me_too_count` in addition, resolved through
`bounties.legacy_item_id`. No column changed and no constraint was added to
`bounty_me_too`; only the function body did.

Both are recomputed from the same `COUNT(*)` rather than incremented, so they
cannot drift apart. The legacy counter is the one `BountyCard.tsx` and the
me-too sorts in `Browse.tsx` and `Discover.legacy.tsx` read, and it is **not**
retired here — **NS-P54 retires it**, and until then a me-too moves two numbers
on purpose. The rewrite also pins `search_path` on what was a `SECURITY DEFINER`
function without one.

On the live project this whole section is a no-op that says so in a `NOTICE`.

### Why the shim columns exist

The same reason NS-P46's do, plus one that is specific to this set: the live
thread subscribes with a `postgres_changes` filter, which is a single column
comparison evaluated by the replication stream. It cannot join, so either the
old id is on the row or the legacy thread stops updating live.

**NS-P50 removed them**, with NS-P46's two, in the same migration: the four
columns, their four indexes and their four triggers, and
`set_legacy_bounty_item_id()` with the last of the six.

The realtime filter was the interesting one. A `postgres_changes` filter cannot
join, so `useBountyDiscussionUpdates` and `useBountySolutionUpdates` now resolve
the header id **before** they open the channel and filter `bounty_id` — the
subscription became asynchronous, and tears down cleanly if the page is left
during the resolve.

One live bug came out with the shims: `getDiscussionThread`'s accepted-solver
lookup named `solutions.bounty_id` and was handed the route's `content_items`
id, so it had matched nothing since NS-P46 and no comment had carried its
"accepted solver" mark. The resolve fixes it.

### Reversing the repoint

Section 2 of the migration carries the four steps in order. The order matters:
the derivation triggers reject the rollback UPDATE if they are still attached
when it runs, and the `bounty_comment_last_read` step joins back through the
mapping because its map is keyed on the old pair.

### What is still live, and must stay live

- The legacy bounty thread: rendering, posting, reacting, marking read; the
  author's deadline extensions, triage notes and analytics. Proven under real
  RLS by `supabase/tests/ns-p47-repoint-bounty-satellites.sql` (checks 6 and 7)
  and at the data layer by
  `src/lib/bounty-solver/legacyDiscussionShim.test.ts`.
- Every generation-1 read, unchanged. NS-P47 froze nothing.

### One thing NS-P50 left open, on purpose

`bounty_comment_reactions` carries `"Public view comment reactions"` with
`USING (true)` and does not join the comment, so a reaction on a comment nobody
can read is itself readable. NS-P50 did not tighten it, and the reasoning is the
same one NS-P47 gave plus one more: NS-P50 writes no row to that table and
creates no new exposure there, so tightening it would be an unrelated behaviour
change on a live legacy surface inside a migration whose job is dropping
columns. It is still a real gap, and it is still worth a prompt of its own —
the fix is to join `bounty_discussion_comments` in the policy the way the
solution-comments policy joins `solutions`.

---

## The NS-P48 repoint — one map table, two shim columns, and a table closed forward

**Added** NS-P48 (29 Aug 2026). **The two shim columns were dropped by NS-P50
(29 Aug 2026); the map table is kept until NS-P56 signs off. The freeze is not a
shim, did not expire with them, and is asserted by NS-P50's own SQL test.**

This one is not only a repoint.
`supabase/migrations/20260829140000_repoint_meta_sub_definitions.sql` moves both
of `meta_bounty_sub_definitions`' id columns off `content_items` and onto
`bounties`, through the same `legacy_item_id` mapping, and then closes the table
to anything that is not a legacy bounty.

| Column | Before | After |
| --- | --- | --- |
| `meta_bounty_id` | `content_items(id)` CASCADE | `bounties(id)` CASCADE |
| `spawned_bounty_id` | `content_items(id)` SET NULL | `bounties(id)` SET NULL |

Both delete actions are preserved and both were read off the old constraints and
asserted before they were dropped. `content_items → bounties` is itself CASCADE,
so deleting a legacy meta still deletes its sub-definitions, and deleting a
spawned bounty still clears the pointer and leaves the sub-definition standing.

| Object | Kind | Why it stays |
| --- | --- | --- |
| `public.ns_p48_migration_map_meta_subs` | table | One row per repointed sub-definition: its id, and the two `content_items` ids it held before. RLS on, no policy — operator access only. |
| ~~`legacy_meta_item_id`, `legacy_spawned_item_id`~~ | columns | **Dropped by NS-P50.** They were the shims the live legacy meta surfaces ran on, derived by `set_meta_sub_legacy_item_ids()`. The strip resolves its whole screenful in one batched lookup; `getMetaBountyState` maps each spawn pointer back so `MetaBountyBody` still navigates to a `/content/:id` that exists. |
| `public.set_meta_sub_legacy_item_ids()` | function | Keeps both shims equal to their bounty's `legacy_item_id` on every write. NS-P46's `set_legacy_bounty_item_id()` could not be reused: it reads `NEW.bounty_id` and writes `NEW.legacy_bounty_item_id`, and this table has neither column. |

### Why the table is closed, and what that means

Series decision 7: under the record model a meta-bounty is one build with
several gap nodes. `build_nodes.is_gap` names the gap (NS-P36),
`bounties.gap_node_id` is the header for it (NS-P45), and
`solutions.slot_kind = 'node'` is how an answer names it (NS-P46). The whole
mechanism already exists, so a sub-definition has no forward meaning — it is the
generation-2 spelling of the same idea.

**A new sub-definition therefore requires a parent bounty with
`legacy_item_id IS NOT NULL`, and this is enforced twice on purpose.** The
INSERT policy carries the rule, which is where a PostgREST client meets it.
`trg_mbsd_freeze_to_legacy` carries it too, because row level security does not
bind `service_role` and the code NS-P50 writes may not be a browser —
`supabase/functions/seed-ecosystem/index.ts` is already a service-role writer of
this table. The trigger also fires on `UPDATE OF meta_bounty_id`, which closes
the way round the INSERT rule: file the row against a legacy meta, then move it.

Nothing else about the table is frozen. Its author can still read, edit and
delete their own sub-definitions, legacy or not; check 6d of the SQL test proves
it. Deleting the last one is how this table empties.

### Why the shim columns exist

A legacy meta-bounty page routes on a `content_items` id, the home
ActiveCompetitions strip works entirely in `content_items` ids, and the discover
free-text expansion returns ids that are OR-included into a `content_items` id
filter. After the repoint none of those ids is in `meta_bounty_id` any more, so
every one of those reads would return nothing — which looks exactly like a
meta-bounty nobody has broken into sub-bounties, not like a bug.

`legacy_spawned_item_id` exists for a narrower reason: `getMetaBountyState`
hands `spawnedBountyId` to `MetaBountyBody`, which navigates to `/content/:id`
with it. A `bounties` id there is a 404 on a bounty that exists.

**NS-P50 removed them**: the two columns, their two indexes,
`set_meta_sub_legacy_item_ids()` and `trg_mbsd_legacy_item_ids`.
`trg_mbsd_freeze_to_legacy` did not go — it is the decision, not the
scaffolding — and check 2 of
`supabase/tests/ns-p50-drop-bounty-shims.sql` fails if a later hand drops it.

### Two legacy write paths now create a `bounties` header

NS-P45 backfilled one header per `content_items` bounty that existed the day it
ran and wired nothing to write one afterwards, so a legacy bounty created since
then has none — and since NS-P48 a sub-definition cannot be filed against a
bounty that has none. `createMetaBounty` and the spawn branch of
`pledgeToSubBounty` therefore call
`src/lib/bounty-competition/createLegacyBountyHeader.ts` immediately after
creating their `content_items` row, and file against the id it returns. NS-P45's
INSERT policy on `bounties` is written for exactly this window: the author of
the content item, and only them, may attach its header. NS-P50 rewires both onto
builds and gap nodes and deletes the file.

### Reversing the repoint

The order matters and is not obvious — the two triggers NS-P48 installs reject
the rollback UPDATE if they are still attached when it runs. Section 2 of the
migration carries the four steps, in order, and they were run end to end against
a Postgres 16 harness before being written down: every row came back on the id
it started with and no `updated_at` moved.

### What is still live, and must stay live

- The home ActiveCompetitions strip, the discover free-text expansion, and the
  legacy meta-bounty page with its pledge and spawn affordances. Proven under
  real RLS by `supabase/tests/ns-p48-repoint-meta-sub-definitions.sql` (checks 5
  and 6) and at the data layer by
  `src/lib/bounty-competition/legacyMetaShim.test.ts`.
- `meta_bounty_pledges`, entirely untouched — its `meta_bounty_id` still keys
  `content_items` and its `sub_definition_id` still keys this table. It is
  NS-P49's, and check 3 of the SQL test asserts NS-P48 left it alone.

### Two things NS-P50 left open, and why

`meta_bounty_sub_definitions` carries `"Public can read sub definitions"` with
`USING (true)`, so anyone can read the sub-definitions of a meta bounty whose
`content_items` row is not approved. NS-P50 did not tighten it: it writes no row
to that table, the freeze still makes the worse version impossible (there can be
no sub-definition on an unpublished build), and the change would be an unrelated
one inside a migration that drops columns. Still real, still worth its own
prompt.

`supabase/functions/seed-ecosystem/index.ts` writes `meta_bounty_id` and
`solutions.bounty_id` as `content_items` ids with the service role. It has been
broken since NS-P46 for `solutions` and since NS-P48 for sub-definitions —
loudly, with a foreign-key error, not silently. NS-P50 did not fix it either: it
is a seeding function on the retired path, it is not reached by any user flow,
and repairing it means deciding what a seeded ecosystem should look like under
the record model. Still unowned.

---

## NS-P50 — the shims gone, and what the new path introduced

**Added** NS-P50 (29 Aug 2026). Nothing here is frozen or retired. This section
exists because NS-P50 is the first prompt that gives `public.bounties` rows a
life outside `content_items`, and three of its consequences are the kind that
are discovered at the worst moment if they are not written down.

`src/lib/bounty/` is the forward path: a bounty is a gap node in a build, a
solution is a payload for that node's type, and accepting one substitutes the
answer into the build. `src/lib/bounty-solver/` is the legacy path and is
unchanged in behaviour — it reads the same `bounties` table through
`resolveBountyByLegacyItem`, which is the seam the shim columns used to be.

### A build whose gap was solved cannot be deleted

`solution_acceptance_log.bounty_id` is `ON DELETE RESTRICT` — an append-only
record of who solved what must not vanish with the row it is about — and
`builds → bounties` is `CASCADE`. The restrict therefore reaches all the way up:
`deleteBuild` on a build with an accepted solution fails, and the error names
`bounties`.

Before NS-P50 no build could have an acceptance row, so this is new behaviour on
the build path. It is deliberate and it is asserted, as check 6 of
`scripts/verify-bounty-flow.ts`. **Whatever ships a delete affordance for builds
owns the answer**: either the affordance refuses with an explanation, or the
product decides an acceptance may be archived rather than kept, which is a
change to what "append-only" means and not a change to a foreign key.

### A build bounty has no notification target

`createNotification` fills `notifications.content_id` when `targetType` is
`'bounty'`, and that column is foreign-keyed to `content_items`. A `bounties` id
there is a rejected insert. So the two notifications the new path sends —
solution submitted, solution accepted — carry no `targetType` and put
`bounty_id`, `build_id`, `node_id` and `solution_id` in `metadata` instead. They
arrive; they do not deep-link. Giving notifications a target type that can name
a build is a schema change and belongs with whatever renders these.

### The gap trigger learned about solving

NS-P45's `assert_bounty_gap_node()` asserted `is_gap` on every insert and update
of a gap-bearing bounty. Accepting a solution clears `is_gap`, so under the
original rule a solved bounty's row could never be written again — not to close
it, not by an admin. NS-P50 amended the function: the node must still belong to
the build always, and must still be a gap unless the bounty is `solved`.
`'closed'` and `'expired'` get no exemption, because those are bounties whose
gap was never filled.

### What NS-P50 did NOT do

- **`meta_bounty_pledges` is still NS-P49's**, untouched. Its `meta_bounty_id`
  is still a `content_items` id, which is why `getMetaBountyState` reads two
  different kinds of id in one function and says so in a comment.
- **`createLegacyBountyHeader` still exists**, and `createMetaBounty` and the
  spawn branch of `pledgeToSubBounty` still call it. NS-P48 anticipated NS-P50
  rewiring both onto builds and gap nodes; that is a change to what a meta
  bounty IS, not a shim removal, and it belongs with the prompt that moves
  meta-bounties onto the record model.
- **The three earlier SQL acceptance tests still assert the shims.** Checks in
  `ns-p46-repoint-solutions.sql`, `ns-p47-repoint-bounty-satellites.sql` and
  `ns-p48-repoint-meta-sub-definitions.sql` that name a `legacy_*_item_id`
  column cannot pass after this migration; they are the record of what those
  migrations proved on the day they ran. `ns-p50-drop-bounty-shims.sql` is the
  one to run now.

---

## Legacy bounty creation

**Frozen** NS-P54 (29 Aug 2026) — entry points, writers and the dual counter, in
one prompt.

**Replaced by** the bounty on a build: a gap node marked unsolved in the
composer (`src/components/compose/BountySection.tsx`), priced in the publish
sheet, filed against `public.bounties`, surfaced on the build page, the gallery
and the feed, and answered by a typed payload or a rebuild — NS-P45 through
NS-P53. That path was proven before this retirement was taken, which is the
gate the whole series works to.

**Flag** `LEGACY_BOUNTY_CREATE_ENABLED` in `src/lib/bounty-legacy/flags.ts`,
currently `false`.

### Why the form moved rather than the feature

`/bounty/new` asked a creator to start from the ask — to describe a hole before
they had done any of the work around it. Almost nobody does. The gap panel asks
the same question at the one moment the answer is already in front of them:
they are publishing a build, and one part of it is missing.

### The volume this retired

Measured 29 Aug 2026 against the project in `supabase/config.toml`, read-only
through the publishable (anon) key.

| Probe | Answer |
| --- | --- |
| `content_items` where `post_type = 'bounty'` | **3** |
| ...of those, created in the last 7 days | **0** |
| Newest of the three | 2026-08-14 — fifteen days before this freeze |
| `content_items` readable in total, for scale | 76 |

Nobody has created a legacy bounty in a fortnight. The freeze is still the
point regardless of the number: it is what stops the shape coming back.

### What the flag holds down

| Layer | What is frozen |
| --- | --- |
| Route (commit 1) | `/bounty/new` — `BountyUpload`'s submit handler, which inserted an APPROVED `content_items` row straight from a three-step form |
| Route (commit 1) | `/upload/bounty` **with no `?id`** — `BountyUploadShell`'s bootstrap, which minted a draft row on arrival and redirected to itself |
| Affordance (commit 1) | The upload picker's **Bounty** card (`ROUTE_FOR_TYPE.bounty` in `src/contexts/UploadPickerContext.tsx`) and Home's bounties-tab empty CTA (`onEmptyCTAClick` in `src/pages/Home.tsx`) — both now land on `/compose/new`. The label "Post a bounty" is unchanged: the destination moved, the promise did not |
| Write (commit 2) | `createMetaBounty` and `promoteBountyToBlueprint` in `src/lib/bounty-competition/` |

Each frozen writer calls `assertLegacyBountyCreateEnabled()` as its first
statement, before any state is read and before any row is touched. While the
flag is false that throws:

```ts
LegacyBountyValidationError(
  "BOUNTY_RETIRED",
  "Bounties are now part of publishing a build — mark a part unsolved in the composer."
)
```

It is a refusal, not a rolled-back write: no query of any kind is built behind
the error, which is what the specs assert.

`/bounty/new` is wrapped in `LegacyUploadRoute` — the same NS-P25 component that
carries the previous publishing tool's banner — with `ProtectedRoute` left
outermost, so a signed-out visitor still meets the login redirect rather than a
notice over one. The notice gains a second line on the two bounty routes only;
`/upload/blueprint` and `/upload/blog` still create, and a retirement that is
not theirs would be noise on them.

### What is still live, and must stay live

- **A bounty draft already in progress.** `/upload/bounty?id={draftId}` mounts
  the shared editor in bounty mode and still saves and publishes through
  `Upload.tsx`, which NS-P54 does not touch. `src/pages/Drafts.tsx` still routes
  a `post_type = 'bounty'` draft there, deliberately. What stopped is the
  bootstrap that MINTED a new draft, not the editor that finishes one.
- **Every legacy bounty read page**: `/content/:id` with its solutions and
  discussion, `/b/:id/thread`, `/b/:id/leaderboard`, and the legacy meta-bounty
  page with its pledge and spawn affordances.
- **Solving one.** All of `src/lib/bounty-solver/`, `markSolutionReviewStatus`,
  `getBountyAnalytics`, `extendBountyDeadline`, and `refreshLeaderboardCache` —
  which is deliberately outside the freeze and says so in its own header,
  because it creates no bounty and freezing it would leave the leaderboard page
  rendering stale ranks after every vote with nothing on screen to say why.
- **`pledgeToSubBounty`.** Its spawn branch still writes a `content_items` row
  when a pledge crosses a sub-bounty's threshold. It hangs off a meta-bounty
  that already exists rather than creating one, it is reachable from
  `MetaBountyBody` on the live `ContentDetail`, and it is NS-P49's. Freezing it
  here would break a live surface this prompt is told to leave alone.

### The dual counter, ended

`supabase/migrations/20260830140000_single_me_too_counter.sql` replaces one
function body. `public.update_bounty_me_too_count()` stops writing
`content_items.bounty_me_too_count` and keeps writing `bounties.me_too_count`.
Nothing else changes: no table, column, index, policy, trigger or row.

NS-P47 made that a dual-write on purpose, and said so here, because the legacy
surfaces read the `content_items` counter. This ends it and repoints those
surfaces in the same commit, so no surface is left reading a number that has
stopped moving.

| Call site | Was | Is |
| --- | --- | --- |
| `src/components/BountyCard.tsx` — the "N have this" line | `item.bounty_me_too_count` | `useLegacyMeTooCount(item.id, frozen)` |
| `src/pages/Discover.legacy.tsx` — the default me-too sort | `a.bounty_me_too_count` | `useLegacyMeTooCounts(ids)`, frozen value as the per-row fallback |
| `src/pages/Browse.tsx` — an identical me-too sort | unchanged | **Unreachable.** No module imports this file; it is a stale copy of `Discover.legacy` |
| `src/pages/ContentDetail.legacy.tsx` — the me-too toggle and count | unchanged | **Unreachable.** No route registers it and no module imports it, as NS-P44 measured |

Both repointed readers keep the frozen column as their **fallback** and render
it immediately. A bounty with no `bounties` header, or a database where the
header table is not applied, shows the last true number rather than a zero —
which would assert that nobody ever needed it. The loader
(`src/lib/bounty/legacyMeToo.ts`) coalesces every id asked for in the same
microtask, so a screenful of bounty cards costs one resolve and one count query
rather than one pair per card.

**The column keeps its last value.** Not dropped, and not zeroed. A frozen
number that was true on the day it froze is a record.

### The rule this leaves behind

**The `bounty_*` columns on `content_items` are dropped only when
`content_items` itself is retired.** There are twelve of them and they are not
NS-P54's to remove one at a time — every one hangs off a table the legacy read
path still serves, and dropping any of them is the same operator decision as
retiring that table, taken under
[Dropping any of this](#dropping-any-of-this) below. The same rule NS-P44 wrote
for the generation-1 tables, applied to the columns beside them.

### Rollback

Reverse order — commit 4, then 3, then 2, then 1 — because each builds on the
one before, the way NS-P43 built on NS-P42's flag.

**Commit 3 (the counter).** Re-apply the NS-P47 function body from
`supabase/migrations/20260829120000_repoint_bounty_satellites.sql` section 11,
which restores the dual-write; both counters recompute from the same
`COUNT(*)`, so the frozen column catches up on the next me-too rather than
needing a backfill. Revert `BountyCard.tsx` and `Discover.legacy.tsx` to
reading the column directly, and
`supabase/tests/ns-p54-single-me-too-counter.sql`, whose check 1 asserts the
single-leg body and will fail — correctly — once it is restored.

**Commits 1 and 2 (the freeze).** Set `LEGACY_BOUNTY_CREATE_ENABLED = true` in
`src/lib/bounty-legacy/flags.ts`. Both routes write again and both helpers
answer; nothing was deleted, so nothing else has to be restored. Three
companion steps:

1. Point `ROUTE_FOR_TYPE.bounty` in `src/contexts/UploadPickerContext.tsx` back
   at `"/upload/bounty"`, and Home's bounties CTA back at
   `openUploadTypePicker("bounty")`.
2. Unwrap `/bounty/new` from `LegacyUploadRoute` in `src/App.tsx`.
3. Revert `src/lib/bounty-legacy/legacyBountyCreateRetired.test.tsx`, which
   asserts the frozen behaviour directly, and the `createMetaBounty` case in
   `src/lib/bounty-competition/legacyMetaRedirect.test.ts`, which NS-P54 updated
   to the freeze rather than deleting — its original NS-P48 filing assertions
   are in that file's history and go back with the flag.

### The NS-P55 gate: every remaining `.insert` on `content_items`

NS-P55 deletes the superseded upload code. Its opening question is whether
anything still writes `content_items`. **The honest answer is that four writers
remain, and the gate is therefore open for the bounty path and not for the
document path.** Audited 29 Aug 2026 by grep across `src/` and
`supabase/functions/`, matching `.insert` within 300 characters of a
`content_items` `.from(...)`, then following each to its affordance.

| Site | Status | Why |
| --- | --- | --- |
| `src/pages/Upload.tsx:694` (draft save) and `:1002` (publish) | **LIVE** | The shared editor, reachable at `/upload/blueprint` and `/upload/blog`. NS-P54 does not touch it; it is NS-P55's business. Note `:1002` writes `post_type: 'bounty'` when mounted in bounty mode, so **publishing an existing bounty draft still creates a bounty row** — deliberately, so a draft in progress is finishable. No route or affordance can create a new such draft |
| `src/components/ProjectUploadForm.tsx:665` | **LIVE** | Mounted by `Upload.tsx`; creates a project. Outside the bounty path entirely |
| `src/lib/bounty-solver/forkSolution.ts:45` | **LIVE** | Creates a blueprint DRAFT by forking a solution. Reachable from `ContentDetail.tsx:1162`. It is part of solving, not of creating a bounty, so NS-P54 leaves it |
| `src/lib/bounty-competition/pledgeToSubBounty.ts:87` | **LIVE, conditional** | The spawn branch, when a pledge crosses a threshold. Reachable through `MetaBountyBody`. NS-P49's, as above |
| `src/pages/BountyUpload.tsx:71` | **Frozen** | NS-P54, `BOUNTY_RETIRED` |
| `src/pages/BountyUploadShell.tsx:61` | **Frozen** | NS-P54, `BOUNTY_RETIRED` |
| `src/lib/bounty-competition/createMetaBounty.ts:60` | **Frozen** | NS-P54, `BOUNTY_RETIRED`. Also had no caller |
| `src/lib/bounty-competition/promoteBountyToBlueprint.ts:97` | **Frozen** | NS-P54, `BOUNTY_RETIRED`. Its affordance was already unreachable — the dialog opens only when `bounty_status === 'solved'` and that column answers 42703 |
| `src/lib/remix/createRemix.ts:64` | **Frozen** | NS-P43, `REMIX_RETIRED` |
| `src/components/ReblogComposer.tsx:612` | **Unreachable** | Mounts only on `reblogOpen`, and both `setReblogOpen(true)` sites (`ReblogCard.tsx:433`, `ReblogDetailView.tsx:313`) are inside `REBLOG_COMPOSE_ENABLED &&` blocks, which is `false` |
| `src/components/ForkModal.tsx:52` | **Unreachable** | Its only trigger is in `ContentDetail.legacy.tsx`, which no route registers and no module imports |
| `supabase/functions/seed-demo-data`, `seed-new-posts`, `seed-ecosystem` | **Service role** | Seeders, not user paths. `seed-ecosystem` has been broken since NS-P46 and NS-P48 and is still unowned |

Two sites that a naive grep for `content_items` near `.insert` catches and
which are **not** `content_items` writes at all, listed so the next audit does
not re-derive them: `src/pages/ContentEdit.tsx:216` and
`src/components/PublishUpdateModal.tsx:95` are `.update()` on `content_items`
whose neighbouring `.insert` is on `content_changelogs` and `content_versions`.
`supabase/functions/generate-ai-pdf` is the same shape against `ai_export_log`.
**Admin moderation is in this category too** — `src/pages/Admin.tsx` changes
`status` on rows that already exist and creates nothing.

**So: no path creates a legacy BOUNTY any more, and four paths still create
other kinds of `content_items` row.** NS-P55 can delete the bounty creation
code named above without stranding a user. It cannot yet treat `content_items`
as write-dead.

---

## `content_items.bounty_health_score` — unmaintained, and always was

**Recorded** NS-P54 (29 Aug 2026). Nothing is frozen here and nothing changed.
This is on the page because three live surfaces read this column, all three
behave as though every bounty were unhealthy, and the cause is not a bug in any
of them: **nothing has ever written it.**

`supabase/migrations/20260504084620_bb398253-4045-4962-a742-191dc1992943.sql`
adds it as a nullable `FLOAT` with no default, and indexes it:

```sql
ADD COLUMN IF NOT EXISTS bounty_health_score FLOAT,
CREATE INDEX IF NOT EXISTS idx_content_items_bounty_health
  ON public.content_items(bounty_health_score DESC) WHERE post_type = 'bounty';
```

There is no trigger, no database function, no edge function and no client write
against it anywhere in the tree — a grep over `supabase/` returns that `ALTER`
and that `CREATE INDEX` and nothing else, and a grep over `src/` returns reads
only. It is a column somebody meant to compute later.

### The measurement

Measured 29 Aug 2026 against the project in `supabase/config.toml`, read-only
through the publishable (anon) key, the same way the NS-P44 audit was run.

| Probe | Answer |
| --- | --- |
| `select=bounty_health_score` | 200 — **the column exists.** The May 2026 competition migration was applied, unlike the March generation-1 one |
| `bounty_health_score=not.is.null`, `count=exact` | **0** of 76 readable rows |
| `bounty_status=not.is.null`, `count=exact` | 3 — the three bounties, for contrast: a column on the same table that IS written |

The sibling columns from that same migration — `bounty_total_submissions`,
`bounty_active_solvers`, `bounty_is_meta`, `bounty_meta_parent_id` — all answer
200 as well, which is what puts "never computed" beyond "never deployed".

### What that means for the three surfaces that read it

| Reader | What it does with the column | What actually happens |
| --- | --- | --- |
| `src/components/home/ActiveCompetitionsSection.tsx` | `.order("bounty_health_score", { ascending: false, nullsFirst: false })` | Every value is NULL, so the ordering is a no-op and the strip's order is whatever Postgres returns |
| `src/lib/discover/queryBlueprints.ts` | the health facet — `high` is `>= 0.7`, `medium` is `>= 0.4 AND < 0.7`, `low` is `< 0.4` | NULL satisfies none of the three comparisons, so **every one of the three filters returns zero rows**. Picking any health value empties the list |
| `src/lib/bounty-competition/getBountyCompetitionState.ts` | returns it as `healthScore` | Always `null` |

### Why it is being recorded rather than fixed or dropped

Computing it is a product decision — what makes a bounty healthy, and on what
cadence — and it is not NS-P54's to take. Dropping it is a column drop, which
this series does not do; it goes with `content_items` under
[Dropping any of this](#dropping-any-of-this). The discover facet is the one
with a user-visible cost, and it is worth its own prompt: an empty result for
every choice is worse than no filter at all.

---

## NS-P55 — the deletion, not taken

**Attempted 29 Aug 2026. Nothing was deleted. No code changed.**

NS-P55 was to run the deletion NS-P26 promised: remove the superseded upload
authoring code and replace its routes with permanent redirects to
`/compose/new`. Its own preconditions stopped it. All three of the gates it
sets for itself fail at this head, and the third one is the reason the other
two matter.

This section is the record of that, so NS-P56 does not re-derive it and so a
later prompt that reopens the deletion knows exactly what has to be true first.

### Gate 1 — the insert audit says four writers remain, not zero

NS-P55 requires "zero reachable inserts into `content_items`". The audit it
cites as its gate is the one immediately above, and that audit's own conclusion
is the opposite: **the gate is open for the bounty path and closed for the
document path.**

Re-run independently on 29 Aug 2026 — every `.insert` within 320 characters of
a `content_items` `.from(...)` across `src/` and `supabase/functions/`, then
followed to its affordance. The result reproduces NS-P54's exactly:

| Live writer | Reachable from |
| --- | --- |
| `src/pages/Upload.tsx:693` (draft save) | `/upload/blueprint`, `/upload/blog` |
| `src/pages/Upload.tsx:1002` (publish) | the same two routes |
| `src/components/ProjectUploadForm.tsx:664` | mounted by `Upload.tsx` |
| `src/lib/bounty-solver/forkSolution.ts:44` | `ContentDetail.tsx:1162` |
| `src/lib/bounty-competition/pledgeToSubBounty.ts:86` | `MetaBountyBody`, conditional on a pledge crossing a threshold |

`src/pages/Upload.tsx:1330` is a sixth grep hit and is **not** a sixth writer —
it is an `.update()` whose neighbouring `.insert` is on `content_dependencies`,
the same false-positive class NS-P54 already listed for `ContentEdit.tsx:216`
and `PublishUpdateModal.tsx:95`.

`LegacyUploadRoute` does not close any of this. It is a banner wrapper — it
renders `LegacyUploadNotice` above its child and nothing else. The editor
underneath it still saves and still publishes, which is what its own header
says it is for.

### Gate 2 — tiers 1 and 2 do not exist

NS-P55 names the full tier-1 and tier-2 Playwright suites as "the safety net
for every commit here" and requires them to pass at head before starting and
after each removal commit.

`e2e/` contains `tier3/` (12 specs) and `fixtures/`. There is no `e2e/tier1/`
and no `e2e/tier2/`, anywhere in the tree. The only reference to either is
`playwright.config.ts:65`, whose mobile project matches `e2e/tier1/*.spec.ts`
and therefore matches nothing — the mobile viewport currently runs zero tests.

A deletion prompt whose stated safety net does not exist has no way to show
that any removal commit was safe. This is the gate that would matter even if
the other two were clean.

### Gate 3 — the import map excludes every candidate

NS-P55 requires that each candidate be checked for importers outside the
deletion set, and excluded rather than forced if one is found. Every candidate
has one.

**Group 2 — the authoring sub-components. All eleven excluded.**

| File | Live importer outside the deletion set |
| --- | --- |
| `ContentBlockBuilder` | `ProjectUploadForm.tsx` (itself a live `content_items` writer) |
| `WhatToExpectBuilder` | `ProjectUploadForm.tsx` |
| `CollabInvitePicker` | `ProjectUploadForm.tsx` |
| `DependencyPicker` | `ProjectUploadForm.tsx` |
| `WorksWithPicker` | `Upload.tsx`, which is not deletable (gate 1) |
| `TopicsPicker` | `Upload.tsx`, same |
| `TipSelector` | `ContentDetail.legacy.tsx` — a protected read surface |
| `PwywPriceSelector` | `ContentDetail.legacy.tsx` — same |
| `BountyResponseComposer` | `ContentDetail.legacy.tsx` — same. Frozen since NS-P44, but frozen is not orphaned |
| `documentPersistence.ts` | `article/ArticleEditor.tsx`, `article/StatusBar.tsx` |
| `documentStore.ts` | **33 importers** across `article/`, `workspace/`, `lib/`, and `layout/RightPanel.tsx` — which hard constraint 6 forbids touching |

**Group 3 — the preview and publish routes. Both excluded.**

- `PublishMetadata` (`/publish/:contentItemId`) is a **live step in the working
  publish flow**: `Upload.tsx:1542` navigates to `/publish/${id}` after a
  successful publish. Deleting it breaks publishing for anyone finishing a
  legacy draft.
- `PostPreview` (`/upload/preview/:draftId`) is the one file in the whole
  candidate set with no importer but `App.tsx` and no inbound navigation from
  anywhere in `src/`. It is genuinely orphaned. It is also a single unreferenced
  route, it is not worth a commit on its own while gate 2 is open, and removing
  it in isolation buys nothing NS-P55 was for.

### The consequence the redirects would have had

Worth stating plainly, because it is the concrete harm the gates prevented.

`src/pages/Drafts.tsx:249–253` — `/drafts`, which NS-P55 explicitly keeps —
routes every legacy draft into exactly the routes NS-P55 would have redirected:

```
blog      → /upload/blog?draft={id}
bounty    → /upload/bounty?id={id}
blueprint → /upload/blueprint?draft={id}
```

A client-side `<Navigate to="/compose/new">` on those paths drops the query
string. Every legacy draft still listed on `/drafts` would become unopenable:
the row stays visible, the button still works, and it lands the creator on an
empty new-build composer with their draft nowhere in it. Silent, and it looks
like data loss to the person it happens to.

### Bundle baseline, measured anyway

`npm run build` at this head passes. Initial chunk
`dist/assets/index-*.js` — **3,301.49 kB raw, 899.13 kB gzip.**

NS-P55 asks whether the TipTap suite leaves the graph under the deletion.
**It does not, and no deletion in this prompt's scope would move it.**
`src/pages/ContentDetail.tsx` — the live read surface — statically imports both
`components/blog/BlogView.tsx` and `components/article/ArticleViewer.tsx`, and
both pull `@tiptap/*`. The editor chain is held in the initial bundle by a read
path, not by the authoring path. The bundle delta of the full proposed deletion
would be approximately zero for TipTap.

### What has to be true before this is reopened

1. **`Upload.tsx` stops being the only way to finish a legacy draft.** Either
   the remaining drafts are migrated to the build record, or `/drafts` stops
   offering to open what can no longer be opened. Until one of those, the
   editor is live content maintenance, and hard constraint 1 protects it.
2. **`ProjectUploadForm`, `forkSolution` and `pledgeToSubBounty` are each
   repointed or frozen** — they are three separate decisions, and only the
   first belongs to the upload path.
3. **Tiers 1 and 2 exist and pass at both viewports.** No removal commit in
   this series should be taken on a tree where the named safety net matches
   zero files.
4. **The redirects carry the draft id**, or the drafts they would strand are
   gone first.

`ContentEdit.tsx` stays regardless, and NS-P55 was already right about that:
editing an existing legacy post is maintenance of live content, not new
authoring.

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

---

# NS-P56 — the series closing report

**Swept 29 Aug 2026, at `a245b8a`.** Two fixes were needed to reach a green
suite, both test-only, plus one reverted misdiagnosis kept in the history. This
section is the handover: what the series delivered, what was verified and how,
and what the operator is left holding.

Read the one thing that changes what you do next first.

## The finding that outranks the rest: the database is twelve migrations behind

Every schema object this series created exists in the repository and **none of
it is live**. Probed against the deployed project (`zybdotagjwektucfdkri`) with
the anon key in `.env`, and against a local Postgres 16 rebuilt from
`supabase/migrations` for comparison:

| Migration | Marker probed | Deployed | Local rebuild |
| --- | --- | --- | --- |
| `20260823120000` core (pre-series) | `builds.parent_build_id` | PRESENT | PRESENT |
| `20260824160000` layers (pre-series) | table `build_layers` | PRESENT | PRESENT |
| `20260827120000` NS-P27 cover | `builds.cover_media_id` | **ABSENT** | PRESENT |
| `20260827140000` NS-P36 rebuild | `builds.rebuild_count` | **ABSENT** | PRESENT |
| `20260827140000` NS-P36 rebuild | `builds.solves_node_id` | **ABSENT** | PRESENT |
| `20260828140000` NS-P45 bounties | table `bounties` | **ABSENT** | PRESENT |
| `20260829200000` NS-P52 me-too | table `bounty_me_too_marks` | **ABSENT** | PRESENT |
| `20260830120000` NS-P53 solution | `solutions.solution_build_id` | **ABSENT** | PRESENT |

`get_build_feed` and `accept_bounty_solution` both return PGRST202 — not found —
on the deployed project. They exist locally.

The boundary is exact: everything through `20260825140200` is live, everything
from `20260827120000` on is not. That is the whole of NS-P27–NS-P56's schema,
twelve migration files.

**What this means in practice.** The Builds tab calls `get_build_feed`, which
does not exist. The bounty surfaces read `bounties`, which does not exist. A
Rebuild reads `rebuild_count` and `solves_node_id`, which do not exist. The
front-end for all of it is deployed from `main`; the schema under it is not.
Whatever is running in production today is not running this series.

**One caveat, stated because it cannot be ruled out from here.** PostgREST
answers from a schema cache, so "not applied" and "applied but the cache is
stale since 27 Aug" produce identical 404s over the anon API. Distinguishing
them needs service-role or direct database access, which this sweep did not
have. Either way the live API does not serve the series' schema, which is the
operational fact. Confirming which it is, is the first thing to do with an
operator credential — and if it is the cache, a reload settles it.

## Scope delivered

Thirty prompts, NS-P27–NS-P56. Commits carrying each label, on this branch:

```
P27:2  P28:2  P29:1  P30:5  P31:2  P32:1  P33:2  P34:5  P35:2  P36:1
P37:3  P38:2  P39:1  P40:2  P41:2  P42:1  P43:3  P44:2  P45:1  P46:2
P47:2  P48:2  P49:0  P50:2  P51:2  P52:3  P53:2  P54:4  P55:1  P56:2
```

**NS-P49 was never taken.** It owned the `meta_bounty_pledges` repoint, and the
table still keys `content_items`:

```
FOREIGN KEY (meta_bounty_id) REFERENCES content_items(id) ON DELETE CASCADE
```

`legacyMetaRedirect.test.ts:206` asserts exactly this and names it "NS-P49's
move". NS-P50 dropped the shim columns for "NS-P46-P49" while the P49 repoint
behind them had not happened. Nothing is broken by this — the legacy meta
surfaces read `content_items` and still work — but the bounty estate is
repointed four tables out of five, and the fifth is not scheduled.

NS-P55 is recorded above as attempted and not taken; its three gates still fail
at this head, and this sweep re-derived gate 1 independently (below).

## Toolchain at head

| Check | Result |
| --- | --- |
| `npm run build` | **passes**, 8.38s |
| `npm run test` (vitest) | **973 passed / 973**, 67 files — after the two fixes below |
| `npx playwright test` | **7 passed, 22 skipped, 0 failed** — see the gap below |
| `npm run lint` | **fails**: 2369 problems (2233 errors, 136 warnings) across 298 files |

The lint failure is a pre-existing baseline, not a regression: 2157 of the 2369
are `@typescript-eslint/no-explicit-any`, and neither file this sweep touched
appears in the output at all. It is stated here because "green" should not be
claimed for a command that exits 1.

## The two fixes

One commit each, both test-only, no product code changed.

**`13f76b7` — the self-confirmation stub was pinned to a calendar date.**
`ReproductionAction.test.tsx` stubbed `recordSelfConfirmation` and
`getBuildHeader` with a literal `last_confirmed_at` of `2026-08-24T09:00:00Z`,
then asserted the block reads "last confirmed working today". `freshnessLabel`
formats relative to `Date.now()` (`signals.ts:210`) and `relativeDays` returns
"today" only at zero days elapsed, so the assertion held on 24 Aug and no other
day; at this head it rendered "5 days ago". The real `recordSelfConfirmation`
writes `new Date().toISOString()` (`signals.ts:173`); the stub now says the
same. The sibling "four months" assertion is unaffected — that string is a
literal in `ReproductionAction.tsx:316`, not a computed interval.

**`a245b8a` — an `updateBuild` stub that returned a bare draft.**
`Publish.test.tsx`'s first case failed intermittently under the full suite and
passed alone.

The first attempt at this (`1827ec2`) raised the readiness wait from
testing-library's 1000ms default to the 3000ms the file already used elsewhere.
It was wrong — the button was not slow to enable, it never enabled — and it is
reverted in `d19aee2`. Recorded here rather than tidied away, because the
misdiagnosis is the instructive part: the assertion that fails is a wait, and
the wait is the last thing to blame.

The cause is stub fidelity. `useComposeBuild.ts:173` writes `updateBuild`'s
returning row into the compose cache as the **entire** build:

```js
(previous) => (previous ? { ...previous, build: row } : previous)
```

which is correct for the real function, whose row carries every column the
record already had. The stub returned `{ ...draft(), ...patch }`, and `draft()`
has `outcome: null`. The completeness autosave (`useComposeBuild.ts:268-271`)
fires on load with `{ completeness: 60 }`, so its stubbed row reset `outcome` to
null moments after render; `publishReadiness` (`PublishControl.tsx:359`) went
not-ready, and `PublishSheet` held `publish-confirm` disabled
(`PublishSheet.tsx:327,540`). Whether that landed before or after the click is a
race — which is what made it intermittent rather than constant, and what made it
pass in isolation, where the timing differs.

The stub now merges the patch onto the build the test seeded through `getBuild`,
so it returns what the persisted row would. Verified over three consecutive
full-suite runs, 973/973 each.

Worth knowing for the next reader: the comment above that cache write says "the
row is authoritative for the keys it just wrote", but the code assigns the whole
row. That is right in production and unforgiving of any stub that returns less
than a complete build — this is the second place it has bitten.

## Spec inventory and results

Twelve tier-3 specs, 29 tests. Desktop project, one recorded run:

| Spec | Tests | Ran | Skipped |
| --- | --- | --- | --- |
| `legacy-bounty-create-retired` | 3 | **3** | 0 |
| `builds-feed` | 5 | **4** | 1 |
| `bounty-publish` | 2 | 0 | 2 |
| `bounty-solve-by-rebuild` | 1 | 0 | 1 |
| `bounty-solve-loop` | 1 | 0 | 1 |
| `gen1-bounty-frozen` | 2 | 0 | 2 |
| `legacy-bounty-discussion` | 2 | 0 | 2 |
| `legacy-bounty-solutions` | 2 | 0 | 2 |
| `legacy-meta-bounty` | 3 | 0 | 3 |
| `lineage-readable` | 2 | 0 | 2 |
| `reblog-retired` | 2 | 0 | 2 |
| `rebuild-attribution` | 4 | 0 | 4 |
| **Total** | **29** | **7** | **22** |

**Nothing failed. Nothing that matters ran.** All 22 skips are
`test.skip(!SLUG || !EMAIL ..., NEEDS_SEED)` guards on 23 `E2E_*` variables —
seeded slugs, legacy bounty URLs and two sets of credentials — pointing at a dev
project with this series' schema and content. No such project is configured;
`.env` carries a URL and an anon key and nothing else. The seven that ran are
the route-and-notice assertions that need no data.

**"Both viewports" could not be delivered, and not for want of trying.**
NS-P55 recorded that tiers 1 and 2 do not exist. They still do not:

```
$ ls -d e2e/tier1 e2e/tier2 e2e/tier3
ls: cannot access 'e2e/tier1': No such file or directory
ls: cannot access 'e2e/tier2': No such file or directory
e2e/tier3
$ npx playwright test --project=mobile --list
Total: 0 tests in 0 files
```

`playwright.config.ts:65` matches the mobile project to `e2e/tier1/*.spec.ts`,
which matches nothing, so the mobile viewport runs zero tests — as it has for
the whole series. The `setup` project matches `*.setup.ts`; there are none, so
no storage state is written and no spec is ever authenticated. A suite cannot be
green at a viewport that collects no tests, and this sweep did not manufacture
one: inventing the safety net is not verifying it.

Two sandbox-only obstacles were worked around without touching the repo, and
neither is a defect in it: the image ships Chromium 1194 while
`@playwright/test` 1.58.2 resolves 1208, and the sandbox has no IPv6 while the
config's `webServer` binds `::`. Both were handled with a throwaway config and a
manually started server, since a CI runner with IPv6 and matching browsers hits
neither.

## RLS spot-proofs

Run against a local Postgres 16 with all 24 series migrations applied, seeded
with two users, three builds, two bounties, two solutions, two events and two
pledges. Each block sets `request.jwt.claims` and `SET LOCAL ROLE` exactly as
PostgREST does. All six behave as designed.

**1 — cross-user draft invisibility (builds).** `SELECT slug, status FROM builds`

| Role | Rows |
| --- | --- |
| anon | `a-published` |
| user A | `a-draft`, `a-published` |
| user B | `a-published`, `b-draft` |

Neither user sees the other's draft. Policy:
`(status <> 'draft') OR (creator_id = (select auth.uid())) OR is_admin(...)`.

**2 — a draft build hides its nodes too (imports).**
`SELECT b.slug, n.type FROM build_nodes n JOIN builds b ON b.id = n.build_id`

| Role | Rows |
| --- | --- |
| anon | `a-published` |
| user A | `a-draft`, `a-published` |
| user B | `a-published` |

An imported build is a draft build; its nodes inherit readability through the
`EXISTS` subquery on the parent, so an import in progress is invisible until
published.

**3 — a bounty on a draft build is invisible.** Deliberately a LEFT join, so a
bounty visible without its build would still show. It does not.

| Role | Rows (`reward_gbp`, home, status) |
| --- | --- |
| anon | `50, a-published, published` |
| user A (author) | `50, a-draft, draft` and `50, a-published, published` |
| user B | `50, a-published, published` |

**4 — solutions travel with their bounty.** `SELECT id, status FROM solutions`

| Role | Rows |
| --- | --- |
| anon | the solution on the published bounty only |
| user A (bounty author) | both |
| user B (the solver) | both |

Public readers get non-draft solutions on published bounties; the author sees
solutions on their own bounties, the solver sees their own. No path leaks the
solution attached to the draft build's bounty to an unrelated reader.

**5 — anonymous pledges are masked.**
`SELECT amount, is_anonymous FROM meta_bounty_pledges`

| Role | Rows |
| --- | --- |
| anon | `40.00, f` |
| user A (pledged 25 anonymously) | `25.00, t` and `40.00, f` |
| user B (pledged 40 openly) | `40.00, f` |

B cannot see A's anonymous pledge; A can see their own. Policy:
`(is_anonymous = false) OR (pledger_id = auth.uid()) OR is_admin(auth.uid())`.

**6 — hidden events, and the layer that actually excludes them.** This one
passes, and it is worth being precise about *where*:

| Query, as user B (not the owner) | Rows |
| --- | --- |
| raw `SELECT ordinal, visibility FROM build_events` | `1 kept`, **`2 hidden`** |
| `... WHERE visibility <> 'hidden'` — what the fork surface issues | `1 kept` |
| same raw read as user A, forking their own build | `1 kept`, `2 hidden` |

RLS lets any reader of a published build select its hidden events. The exclusion
is `getEvents` applying `.neq("visibility", "hidden")` (`events.ts:45`), called
by `forkBuild` as `getEvents(sourceBuildId, { includeHidden: ownBuild })`
(`fork.ts:107`). The code says so itself at `fork.ts:36-40`. So the fork surface
is correct and a direct PostgREST call by a signed-in reader is not covered.
See the recommendations.

## The dead-writer proof, re-run

Verbatim. Independent re-run over 915 files in `src/` and
`supabase/functions/`, pairing every `.insert(` with its nearest preceding
`.from("…")` rather than a character window — 1114 `.from()` calls in total.

A first pass with the window method NS-P54 used returned 20 hits, and a naive
nearest-`from` pass returned 24. Both over-report: the regex has to allow
`.from("comment_likes" as any)`, or those `.from` calls are invisible and their
inserts get attributed to a `content_items` read further up. `CommentsSection`,
`StarRating` and `useCanvasDocument` are all false positives of exactly that
shape. Corrected, the answer is **15 true `content_items` inserts**:

```
src/components/ForkModal.tsx:52
src/components/ProjectUploadForm.tsx:665
src/components/ReblogComposer.tsx:612
src/lib/bounty-competition/createMetaBounty.ts:60
src/lib/bounty-competition/pledgeToSubBounty.ts:87
src/lib/bounty-competition/promoteBountyToBlueprint.ts:97
src/lib/bounty-solver/forkSolution.ts:45
src/lib/remix/createRemix.ts:64
src/pages/BountyUpload.tsx:71
src/pages/BountyUploadShell.tsx:61
src/pages/Upload.tsx:694
src/pages/Upload.tsx:1002
supabase/functions/seed-demo-data/index.ts:229
supabase/functions/seed-ecosystem/index.ts:259
supabase/functions/seed-new-posts/index.ts:98
```

Followed to an affordance, the five **reachable** ones reproduce NS-P54 and
NS-P55 exactly:

| Live writer | Reachable from |
| --- | --- |
| `Upload.tsx:694` (draft save) | `/upload/blueprint`, `/upload/blog` |
| `Upload.tsx:1002` (publish) | the same two routes |
| `ProjectUploadForm.tsx:665` | mounted by `Upload.tsx` |
| `forkSolution.ts:45` | `ContentDetail.tsx:1162` |
| `pledgeToSubBounty.ts:87` | `MetaBountyBody.tsx:269`, mounted at `ContentDetail.tsx:1506` |

The other ten are closed, and each was checked rather than assumed:

- `ForkModal.tsx:52` — mounted only by `ContentDetail.legacy.tsx:1818`, which
  nothing imports and no route renders. Orphaned.
- `ReblogComposer.tsx:612` — both mounts sit behind `reblogOpen`, whose only
  setters are behind `isLoggedIn && REBLOG_COMPOSE_ENABLED` (`ReblogCard.tsx:431`,
  `ReblogDetailView.tsx:309`). The flag is `false`.
- `createRemix.ts:64` — `assertRemixCreateEnabled`; `REMIX_CREATE_ENABLED` is `false`.
- `createMetaBounty.ts:60`, `promoteBountyToBlueprint.ts:97`,
  `BountyUpload.tsx:71`, `BountyUploadShell.tsx:61` —
  `assertLegacyBountyCreateEnabled`; `LEGACY_BOUNTY_CREATE_ENABLED` is `false`.
- the three `seed-*` edge functions — service-role operator tools, not user
  surfaces.

**The gate NS-P55 set for itself is still shut: four reachable writers were
required to be zero, and five remain.** Three of them are not the upload path's
to close — `forkSolution` and `pledgeToSubBounty` are legacy bounty surfaces,
and `ProjectUploadForm` rides on `Upload.tsx`.

A runtime check was attempted and could not be completed: proving no insert
fires at runtime needs the tier-3 suite to actually exercise the authoring
paths, and 22 of its 29 tests skip for want of a seeded project. The static
proof above is what this sweep can stand behind.

## Performance snapshot

**Initial bundle, against NS-P55's claim.** NS-P55 measured
`dist/assets/index-*.js` at 3,301.49 kB raw / 899.13 kB gzip. At this head Vite
reports:

```
dist/assets/index-B-9nJcXl.js    3,301.49 kB │ gzip: 899.13 kB
```

**Byte-identical.** Nothing in NS-P55 or NS-P56 moved the initial chunk, which
is what NS-P55 predicted.

Its reasoning also holds. There is no separate TipTap chunk: `ContentDetail.tsx`
statically imports `ArticleViewer` (line 11) and `BlogView` (line 13), both of
which pull `@tiptap/*`, so the editor suite sits in the initial bundle held by a
**read** path. Monaco is the opposite case and worth not confusing with it —
`@monaco-editor/react` is a dependency but `monaco-editor` is not, so only the
small loader is bundled and the editor itself is fetched at runtime.

**Route measurements**, production build via `vite preview`, desktop 1440×900:

| Route | load | TTFB | FCP | LCP | CLS | reqs | JS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 522ms | 9ms | 636ms | 636ms | 0 | 21 | 3690 kB |
| `/gallery` | 540ms | 7ms | 880ms | 880ms | 0 | 29 | 3791 kB |
| `/b2/:slug` | 549ms | 8ms | 868ms | 868ms | 0 | 30 | 3861 kB |
| `/compose/new` | 537ms | 17ms | 920ms | 920ms | 0 | 25 | 3797 kB |

Read these as **shell** figures. Supabase calls were failed instantly, because
the deployed project cannot answer this series' queries at all (see the top of
this section), so LCP here is the shell painting, not content arriving. CLS of 0
is real but measured on a page with no data in it.

**A finding that is real in production too:** `index.html` loads two
render-blocking Google Fonts stylesheets, Inter and Playfair Display. With them
unreachable, every route measured **12.8s** to `load` and ~13s to FCP — the
browser waiting out two `ERR_CONNECTION_RESET`s, while the 3.3 MB bundle itself
transferred in 221ms. In production they resolve and the cost is a round trip
rather than a timeout, but they are on the critical path to first paint and
nothing renders until they settle. Worth `preconnect`, `font-display: swap`, or
self-hosting.

**Lazy-loading confirmed.** `Compose` and `ComposeNew` are `React.lazy`
(`App.tsx:73,76`) and ship as their own chunks — `Compose-KUTjOAEz.js` 99.12 kB
and `ComposeNew-D6A-3Jiw.js` 19.60 kB. Watching the network per route, a
`Compose*.js` chunk was requested on `/compose/new` and on **none** of `/`,
`/gallery` or `/b2/:slug`. Hard constraint 8 holds.

**`get_build_feed` under realistic rows.** Local Postgres seeded to 20,003
builds (85% published), 60,002 nodes, 40,002 events, 2,002 bounties, then
`ANALYZE`d. Called as `anon` with RLS live, 25 runs of
`get_build_feed(now(), 24)`:

```
min 2.33 ms | median 2.71 ms | p95 4.60 ms | max 12.08 ms
```

The plan is clean. Every one of the five UNION branches takes an index and none
takes a sequential scan — `idx_builds_feed_published`, `idx_builds_feed_rebuilt`,
`idx_build_reproductions_noted`, `idx_bounties_feed_open`, and `builds_pkey` for
the joins. A `Merge Append` with per-branch `LIMIT` feeds a 24-row quicksort of
29 kB. Keyset pagination behaves: `before` is a required cursor, and passing
`NULL` correctly returns nothing rather than scanning the table.

## Migration-map cleanup decision — recommendation, not executed

The brief names these `_ns_migration_map_*`. **No table by that name exists.**
NS-P48 renamed the family to `ns_pNN_migration_map_<what>` deliberately, and
recorded why: a leading underscore would have been the only such identifier in
the schema, and PostgREST exposes it just the same. Seven tables, all with RLS
enabled and **zero policies** — operator-only by design, service-role only:

| Table | Key | Rows, deployed | Rows, local rebuild |
| --- | --- | --- | --- |
| `ns_p46_migration_map_solutions` | `id` | table absent | 0 |
| `ns_p46_migration_map_acceptance_log` | `id` | table absent | 0 |
| `ns_p47_migration_map_bounty_discussion_comments` | `id` | table absent | 0 |
| `ns_p47_migration_map_bounty_deadline_extensions` | `id` | table absent | 0 |
| `ns_p47_migration_map_bounty_author_review` | `id` | table absent | 0 |
| `ns_p47_migration_map_bounty_comment_last_read` | `(old_bounty_id, user_id)` | table absent | 0 |
| `ns_p48_migration_map_meta_subs` | `id` | table absent | 0 |

All seven return HTTP 404 on the deployed project, for the reason at the top of
this report: the migrations that create them have not been applied. The local
counts are 0 because that database was rebuilt from migrations with no
production data — they are a structural check, not a census.

What the maps *would* hold, from the deployed row counts of the tables they
mirror:

```
solutions                     2      bounty_deadline_extensions    0
solution_acceptance_log       0      bounty_author_review          0
bounty_discussion_comments    0      meta_bounty_sub_definitions   5
bounty_comment_last_read      (RLS-masked from anon, as designed)
```

**Seven rows across the entire rollback net.**

**Recommendation: do not schedule a drop. Delete the question instead.**

1. **Nothing to drop.** They do not exist in production. A drop migration today
   would be a no-op against reality and would only add a file.
2. **When the migrations are applied**, they will be created holding ~7 rows.
   That is not a storage concern, an index concern, or a query concern. The cost
   of keeping them is nil.
3. **The gate they were kept for has not been reached.** They were kept "until
   NS-P56 signs off". This sweep does not sign off, because the repoint they
   protect is not live, has never run against production data, and NS-P49's
   share of it was never written at all. A rollback net is retired after the
   thing it protects has proven itself in production. Neither half of that has
   happened.
4. **The earliest sensible drop** is one full release cycle after the series'
   migrations are applied and the bounty surfaces have been exercised against
   real data — and even then it buys ~7 rows. Treat it as tidying, at the same
   time as the `content_items` decision under *Dropping any of this*, not as its
   own prompt.

## Open recommendations

Ordered by what costs most to leave alone.

**1. Establish why the deployed database is twelve migrations behind.** Before
any further feature work. Everything this series built is inert until this is
answered, and the answer decides whether the fix is a schema-cache reload or
twelve migrations and a data check. Nothing below matters more.

**2. Give the suite a safety net that exists.** Tiers 1 and 2 have been named as
the safety net since NS-P26 and have never existed; the mobile viewport has run
zero tests for thirty prompts; there is no `*.setup.ts`, so no spec is ever
authenticated. Either build the tiers and the auth setup, or change
`playwright.config.ts` to stop claiming a mobile project that collects nothing.
The second is ten minutes and stops the config lying.

**3. Seed a dev project and wire the 23 `E2E_*` variables.** 22 of 29 tier-3
tests have never run. The specs are written and look sound; they are simply
pointed at nothing.

**4. NS-P49, or an explicit decision not to.** `meta_bounty_pledges` still keys
`content_items` while its four sibling tables key `bounties`. Either finish the
repoint or record it as deliberate, so the next reader is not left inferring it
from a gap in the commit log.

**5. Hidden events over PostgREST.** A signed-in reader can select
`visibility = 'hidden'` events on any published build directly. The fork surface
is correct; the database is not enforcing it. Either add the predicate to the
`build_events` SELECT policy or record the exposure as accepted — the current
state is a comment in `fork.ts` doing a policy's job.

**6. Two render-blocking font stylesheets.** See the performance section.
`preconnect` plus `font-display: swap`, or self-host.

**7. The RLS wrapping sweep, unchanged from the original handover.** 325
policies use bare `auth.uid()`. `meta_bounty_pledges` is a live example — all
three of its policies. Everything this series added uses
`(select auth.uid())` correctly, so the debt is entirely pre-existing. One
migration, zero code.

**8. Legacy feed consolidation, as the next workstream.** The five old Home tabs
onto database functions, with `get_build_feed` as the template. At 20k builds it
runs in 2.71 ms median on an all-index plan; it is a good pattern to copy.

**9. The flat-shell replacement**, its own workstream, unchanged.

**10. Reblog and remix tables, and the `reblog-media` bucket** become droppable
when the archive window under *Dropping any of this* closes. Nothing in this
series schedules it; the four-step order recorded there still applies.

One incidental, found while seeding and worth a line so nobody re-derives it:
`validate_bounty_publish()` fires only when `post_type = 'bounty'`, and
`content_items_post_type_check` restricts `post_type` to
`build | technique | discovery | discussion`. The trigger cannot fire on any new
row. Legacy bounty rows predate the constraint. Harmless today, confusing later.

## What this sweep did not verify

Stated plainly, because the acceptance criteria asked for more than the
environment could give.

- **No suite ran at the mobile viewport.** There is nothing there to run.
- **22 of 29 tier-3 tests did not execute.** No seeded project, no credentials.
- **No RLS proof ran against production.** The proofs ran against a local
  rebuild with the full migration set — correct for the *policies as written*,
  and silent about the data actually in production.
- **The runtime half of the dead-writer proof was not completed.** The static
  half is above and reproduces the previous two audits.
- **Route timings are shell timings.** No route was measured serving real data,
  because the deployed database cannot serve it.
- **`npm run lint` exits 1** on a large pre-existing baseline, untouched here.

*End of the NS-P27–NS-P56 series.*
