# Clear reconnaissance

2026-09-28

The owner ran the queries in docs/reconciliation/rc-recon.sql against the live database and supplied the results on 2026-09-28. They arrived as a summary in the owner's words rather than as query rows, so each Q section below holds the owner's text verbatim. Every value under "Derived" comes from that text alone; where the text does not name enough rows for a value, the value says so. This replaces the version CLEAR-1 wrote before any live results existed.

## Q1

```text
Q1, posts: 87
```

## Q2

```text
Q2, links into posts: 45 in total. I counted them again with a separate query and got the same numbers.

* 35 are deleted along with the post.
* 4 are emptied instead: `content_items.bounty_meta_parent_id`, `dm_threads.pinned_content_id`, `dm_messages.shared_content_id` and `builds.source_content_item_id`.
* 6 block the delete: `content_items.fork_of_content_id`, `project_components.inline_content_id`, `project_components.linked_content_id` and `notifications.content_id`, which can be empty, plus `post_lineage.parent_post_id` and `post_lineage.root_post_id`, which cannot.
* The three survivors (messages, message threads and builds) can all be empty, so SURVIVORS_OK is yes.
```

## Q3

```text
Q3, rows pointing at a post: the largest are content_views 223, content_blocks 139, content_ratings 139, downloads 115, content_microtags 90, user_interactions 87, user_library 76, user_saves 60 and notifications 50. builds, dm_messages and dm_threads have 0.
```

## Q4

```text
Q4, stored files: 1 in build-media and 1 in dm-images.
```

## Q5

```text
Q5, triggers: 22. None of them call anything outside the database.
```

## Q6

```text
Q6, builds columns: `rebuild_count` is there, and so are `created_via` and `source_content_item_id`.
```

## Q7

```text
Q7, counts the clear must not change:

* profiles 24, builds 9, build_nodes 13, dm_messages 3, dm_threads 1, follows 80
* demo accounts 20, of which 0 are admins
```

## Derived

- POSTS = 87
- FK_TOTAL = 45
- FK_CASCADE = 35
- FK_SETNULL = 4
- FK_BLOCKING = 6: content_items.fork_of_content_id, project_components.inline_content_id, project_components.linked_content_id and notifications.content_id, which are nullable; post_lineage.parent_post_id and post_lineage.root_post_id, which are NOT NULL. Q2 does not say which of the six are NO ACTION and which RESTRICT.
- SURVIVORS_OK = yes. The three survivor links, dm_messages.shared_content_id, dm_threads.pinned_content_id and builds.source_content_item_id, are three of the four set-null keys, and all three are nullable.
- FK_UNINDEXED = 4 of the ten keys Q2 names. Q2 does not name its 35 cascading keys; if they are the 35 types.ts references it does not name, 15 more have no index, 19 in all (listed below).
- LEGACY_STORAGE_OBJECTS = 1, the one object outside build-media, which is in dm-images.
- BUILD_COLUMNS_PRESENT = rebuild_count, created_via, source_content_item_id. These are the three names Q6 gives; the full column list was not supplied.
- DEMO_ADMINS = 0, of 20 demo accounts.
- HOLD_CONSTANT = profiles 24, builds 9, build_nodes 13, dm_messages 3, dm_threads 1, follows 80

### FK_UNINDEXED

A column counts as indexed when a migration in supabase/migrations creates an index that starts with it: a CREATE INDEX, or a UNIQUE or PRIMARY KEY constraint, since Postgres builds an index for each. Postgres never indexes a foreign-key column by itself, so for each post the clear deletes it scans every referencing table that has no such index ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md⟧. At Q3's sizes, 223 rows at most in any one table, that costs the one-off clear nothing that matters. The live database may differ from the migrations ⟦buildgallery-repo-map › 4⟧.

Named in Q2, no index in migrations (4):

- content_items.fork_of_content_id — check live
- notifications.content_id — check live
- project_components.inline_content_id — check live
- project_components.linked_content_id — check live

Named in Q2, in an index only after another column, so a lookup by this column alone gets little help from it (2, not counted in the 4):

- dm_messages.shared_content_id — dm_messages_shared_content_idx (shared_content_type, shared_content_id) — check live
- dm_threads.pinned_content_id — dm_threads_pinned_content_idx (pinned_content_type, pinned_content_id) — check live

Not named in Q2, taken from types.ts, no index in migrations (15). Q3 shows the first five are live keys:

- content_views.content_id — check live
- content_blocks.content_id — check live
- downloads.content_id — check live
- content_microtags.content_id — check live
- user_interactions.content_id — check live
- ad_impressions.content_id — check live
- collab_split_contests.content_id — check live
- content_changelogs.content_id — check live
- content_comments.content_id — check live
- content_tips.content_id — check live
- content_versions.content_id — check live
- draft_autosave_log.content_id — check live
- learning_path_steps.content_id — check live
- revenue_splits.content_id — check live
- tool_compatibility.content_id — check live

Not named in Q2, taken from types.ts, in an index only after another column (5): collection_items.content_id, content_dependencies.requires_content_id, curator_recommendations.content_id, user_library.content_id and user_saves.content_id — check live.

## Compared with the repository

src/integrations/supabase/types.ts was read, not edited ⟦buildgallery-repo-map › 4⟧.

### live only

None among the ten keys Q2 names: each is one of the types.ts references to content_items. Q2 does not name its 35 cascading keys, so they cannot be matched one by one. Both sides count 45, and types.ts has exactly 35 references that Q2 does not name.

### repo only

Cannot be listed until Q2's 35 cascading keys are named. If they are the 35 rows marked "not named" below, no reference is repo only.

| Reference | Nullable in types.ts | Live ON DELETE (Q2) | Index in migrations |
|---|---|---|---|
| ad_impressions.content_id | no | not named | none |
| ai_export_log.post_id | no | not named | idx_ael_post (post_id, exported_at) |
| bounties.legacy_item_id | yes | not named | idx_bounties_legacy_item_unique (legacy_item_id), partial |
| builds.source_content_item_id | yes | set null | idx_builds_source_content_item (source_content_item_id) |
| collab_invites.content_id | no | not named | unique (content_id, invitee_id) |
| collab_split_contests.content_id | no | not named | none |
| collection_items.content_id | no | not named | second in unique (collection_id, content_id) |
| content_blocks.content_id | no | not named | none |
| content_changelogs.content_id | no | not named | none |
| content_collaborators.content_id | no | not named | unique (content_id, collaborator_id) |
| content_comments.content_id | no | not named | none |
| content_dependencies.content_id | no | not named | unique (content_id, requires_content_id) |
| content_dependencies.requires_content_id | no | not named | second in unique (content_id, requires_content_id) |
| content_item_results.content_item_id | no | not named | idx_content_item_results_item_position (content_item_id, position) |
| content_items.bounty_meta_parent_id | yes | set null | idx_content_items_meta_parent (bounty_meta_parent_id) |
| content_items.fork_of_content_id | yes | blocks | none |
| content_microtags.content_id | no | not named | none |
| content_ratings.content_id | no | not named | unique (content_id, user_id) |
| content_tips.content_id | no | not named | none |
| content_verifications.content_id | no | not named | unique (content_id, user_id) |
| content_versions.content_id | no | not named | none |
| content_views.content_id | no | not named | none |
| curator_recommendations.content_id | no | not named | second in unique (curator_id, content_id) |
| dm_messages.shared_content_id | yes | set null | second in dm_messages_shared_content_idx (shared_content_type, shared_content_id) |
| dm_threads.pinned_content_id | yes | set null | second in dm_threads_pinned_content_idx (pinned_content_type, pinned_content_id) |
| downloads.content_id | no | not named | none |
| draft_autosave_log.content_id | no | not named | none |
| learning_path_steps.content_id | no | not named | none |
| meta_bounty_pledges.meta_bounty_id | no | not named | idx_pledges_meta_bounty (meta_bounty_id) |
| notifications.content_id | yes | blocks | none |
| post_lineage.parent_post_id | no | blocks | idx_post_lineage_parent (parent_post_id) |
| post_lineage.post_id | no | not named | primary key (post_id) |
| post_lineage.root_post_id | no | blocks | idx_post_lineage_root (root_post_id) |
| post_view_log.post_id | no | not named | idx_pvl_post (post_id, viewed_at) |
| project_components.inline_content_id | yes | blocks | none |
| project_components.linked_content_id | yes | blocks | none |
| reading_progress.post_id | no | not named | idx_rp_post (post_id) |
| reblogs.original_post_id | no | not named | idx_reblogs_original_created (original_post_id, created_at) |
| reblogs.root_original_post_id | no | not named | idx_reblogs_root_created (root_original_post_id, created_at) |
| revenue_splits.content_id | yes | not named | none |
| solver_leaderboard_cache.bounty_id | no | not named | idx_leaderboard_bounty_rank (bounty_id, rank) |
| tool_compatibility.content_id | no | not named | none |
| user_interactions.content_id | no | not named | none |
| user_library.content_id | no | not named | second in unique (user_id, content_id) |
| user_saves.content_id | no | not named | second in unique (user_id, content_id) |

Repository notes for the next prompt:

- The ten keys Q2 names have the same ON DELETE action and nullability in supabase/migrations as they have live. The four set-null keys are ON DELETE SET NULL there. The six blocking keys have no ON DELETE clause, which is NO ACTION, and post_lineage's two are NOT NULL. So the migrations have not drifted on any key the clear treats differently from a cascade.
- Q4's one object outside build-media is in dm-images, a current bucket ⟦buildgallery-repo-map › 4⟧. The four legacy buckets (content-files, content-results, reblog-media, ai-pdfs) hold no objects, so RC-P34 has no legacy files to remove.
- Q7 counts 20 demo accounts; L-P03-2's text says eight. L-P03-2 and supabase/migrations/20261001123000_rc_rotate_demo_passwords.sql both select the accounts by their two email domains, so both cover all 20.
- Q6 confirms rebuild_count is live. types.ts has it too, so the repo map's §4 note that types.ts lacks it is out of date, as CLEAR-1 recorded.
