# Clear reconnaissance

2026-09-28

The live results were not supplied. The RC-P01 message had no "LOVABLE RESULTS BELOW" section, and the owner said to continue without them. The queries are now in docs/reconciliation/rc-recon.sql, ready to run against the live database. Nothing in this file is live data. Every value that needs Q1–Q7 reads "not supplied", and the only filled values come from the repository and say so.

## Q1

Not supplied.

## Q2

Not supplied.

## Q3

Not supplied.

## Q4

Not supplied.

## Q5

Not supplied.

## Q6

Not supplied.

## Q7

Not supplied.

## Derived

| Value | Result |
|---|---|
| POSTS | not supplied (needs Q1) |
| FK_TOTAL | not supplied (needs Q2) |
| FK_CASCADE | not supplied (needs Q2) |
| FK_SETNULL | not supplied (needs Q2) |
| FK_BLOCKING | not supplied (needs Q2) |
| SURVIVORS_OK | not supplied (needs Q2) |
| FK_UNINDEXED | 19, checked against types.ts because Q2 was not supplied (below) |
| LEGACY_STORAGE_OBJECTS | not supplied (needs Q4) |
| BUILD_COLUMNS_PRESENT | not supplied (needs Q6) |
| DEMO_ADMINS | not supplied (needs Q7) |
| HOLD_CONSTANT | not supplied (needs Q7) |

### FK_UNINDEXED

Q2 was not supplied, so the check ran over the 45 types.ts references listed under "repo only" below. A column counts as indexed when a migration in supabase/migrations creates an index that starts with it: a CREATE INDEX, or a UNIQUE or PRIMARY KEY constraint, since Postgres builds an index for each. Postgres never indexes a foreign-key column by itself, so each content_items row the clear deletes makes Postgres scan every referencing table that has no such index ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md⟧. The live database may differ from the migrations ⟦buildgallery-repo-map › 4⟧.

No index on the column (19):

- ad_impressions.content_id — check live
- collab_split_contests.content_id — check live
- content_blocks.content_id — check live
- content_changelogs.content_id — check live
- content_comments.content_id — check live
- content_items.fork_of_content_id — check live
- content_microtags.content_id — check live
- content_tips.content_id — check live
- content_versions.content_id — check live
- content_views.content_id — check live
- downloads.content_id — check live
- draft_autosave_log.content_id — check live
- learning_path_steps.content_id — check live
- notifications.content_id — check live
- project_components.inline_content_id — check live
- project_components.linked_content_id — check live
- revenue_splits.content_id — check live
- tool_compatibility.content_id — check live
- user_interactions.content_id — check live

In an index only after another column, so a lookup by this column alone gets little help from it (7, not counted in the 19):

- collection_items.content_id — unique (collection_id, content_id) — check live
- content_dependencies.requires_content_id — unique (content_id, requires_content_id) — check live
- curator_recommendations.content_id — unique (curator_id, content_id) — check live
- dm_messages.shared_content_id — dm_messages_shared_content_idx (shared_content_type, shared_content_id) — check live
- dm_threads.pinned_content_id — dm_threads_pinned_content_idx (pinned_content_type, pinned_content_id) — check live
- user_library.content_id — unique (user_id, content_id) — check live
- user_saves.content_id — unique (user_id, content_id) — check live

## Compared with the repository

Q2 was not supplied, so only the repository side can be listed. src/integrations/supabase/types.ts was read, not edited ⟦buildgallery-repo-map › 4⟧.

### live only

Not supplied (needs Q2).

### repo only

With no Q2 to match against, every types.ts reference to content_items is listed: 45 references in 39 tables. "Nullable" is the column's Row type in types.ts (`string | null`); Q2's not_null is the live answer. "Index in migrations" is the evidence behind FK_UNINDEXED.

| Reference | Nullable | Index in migrations |
|---|---|---|
| ad_impressions.content_id | no | none |
| ai_export_log.post_id | no | idx_ael_post (post_id, exported_at) |
| bounties.legacy_item_id | yes | idx_bounties_legacy_item_unique (legacy_item_id), partial |
| builds.source_content_item_id | yes | idx_builds_source_content_item (source_content_item_id) |
| collab_invites.content_id | no | unique (content_id, invitee_id) |
| collab_split_contests.content_id | no | none |
| collection_items.content_id | no | second in unique (collection_id, content_id) |
| content_blocks.content_id | no | none |
| content_changelogs.content_id | no | none |
| content_collaborators.content_id | no | unique (content_id, collaborator_id) |
| content_comments.content_id | no | none |
| content_dependencies.content_id | no | unique (content_id, requires_content_id) |
| content_dependencies.requires_content_id | no | second in unique (content_id, requires_content_id) |
| content_item_results.content_item_id | no | idx_content_item_results_item_position (content_item_id, position) |
| content_items.bounty_meta_parent_id | yes | idx_content_items_meta_parent (bounty_meta_parent_id) |
| content_items.fork_of_content_id | yes | none |
| content_microtags.content_id | no | none |
| content_ratings.content_id | no | unique (content_id, user_id) |
| content_tips.content_id | no | none |
| content_verifications.content_id | no | unique (content_id, user_id) |
| content_versions.content_id | no | none |
| content_views.content_id | no | none |
| curator_recommendations.content_id | no | second in unique (curator_id, content_id) |
| dm_messages.shared_content_id | yes | second in dm_messages_shared_content_idx (shared_content_type, shared_content_id) |
| dm_threads.pinned_content_id | yes | second in dm_threads_pinned_content_idx (pinned_content_type, pinned_content_id) |
| downloads.content_id | no | none |
| draft_autosave_log.content_id | no | none |
| learning_path_steps.content_id | no | none |
| meta_bounty_pledges.meta_bounty_id | no | idx_pledges_meta_bounty (meta_bounty_id) |
| notifications.content_id | yes | none |
| post_lineage.parent_post_id | no | idx_post_lineage_parent (parent_post_id) |
| post_lineage.post_id | no | primary key (post_id) |
| post_lineage.root_post_id | no | idx_post_lineage_root (root_post_id) |
| post_view_log.post_id | no | idx_pvl_post (post_id, viewed_at) |
| project_components.inline_content_id | yes | none |
| project_components.linked_content_id | yes | none |
| reading_progress.post_id | no | idx_rp_post (post_id) |
| reblogs.original_post_id | no | idx_reblogs_original_created (original_post_id, created_at) |
| reblogs.root_original_post_id | no | idx_reblogs_root_created (root_original_post_id, created_at) |
| revenue_splits.content_id | yes | none |
| solver_leaderboard_cache.bounty_id | no | idx_leaderboard_bounty_rank (bounty_id, rank) |
| tool_compatibility.content_id | no | none |
| user_interactions.content_id | no | none |
| user_library.content_id | no | second in unique (user_id, content_id) |
| user_saves.content_id | no | second in unique (user_id, content_id) |

Repository notes for the next prompt:

- types.ts shows dm_messages.shared_content_id, dm_threads.pinned_content_id and builds.source_content_item_id as nullable. That is the repository's view; SURVIVORS_OK still needs Q2.
- types.ts's builds Row has rebuild_count, so the repo map's note that it lacks the column is out of date. Whether the column is live is Q6.
- The repo map's "45 tables hold a foreign key to content_items" is 45 references in 39 tables.
