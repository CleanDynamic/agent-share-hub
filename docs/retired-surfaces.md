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
