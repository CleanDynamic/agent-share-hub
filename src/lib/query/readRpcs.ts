// G1: which database functions are reads.
//
// A table read is a GET or a HEAD, so the method says what it is. A database function is called with a POST whatever
// it does, so the method cannot tell its reads from its writes, and the read limit (readLimit.ts) needs to know which
// is which. Every function the app calls is named here, once, as one or the other; readRpcs.test.ts reads every
// `.rpc(` call site in src and fails on a name that is in neither list.

/** Functions that only read: their calls get the read limit. */
export const READ_RPCS: ReadonlySet<string> = new Set([
  "builds_count_spread",
  "classification_facets",
  "collection_saved_by_count",
  "gallery_facets",
  "get_build_feed",
  "get_profile_feed",
  "get_profile_side",
  "get_quest_state",
  "get_visible_surfaces",
  "is_admin",
  "is_blocked_between",
  "list_filter_set_groups",
  "list_profile_follows",
  "maker_build_metrics",
  "maker_stats",
  "rebuild_tree",
  "saved_items_used_in",
  "search_build_ids",
  "site_hidden_posts_of",
  "works_on_model_counts",
]);

/** Functions that change something: never cut by the read limit. */
export const WRITE_RPCS: ReadonlySet<string> = new Set([
  "accept_legal_terms",
  "admin_set_curator",
  "claim_challenge",
  "create_post",
  "increment_content_view_count",
  "increment_download_count",
  "increment_project_view_count",
  "mark_depth_revealed",
  "mark_welcome_xp_shown",
  "record_daily_activity",
  "resolve_report",
  "respec_track",
  "save_profile",
  "set_build_post_media",
  "set_notification_preference",
  "set_user_track",
  "soft_delete_primitive_comment",
]);
